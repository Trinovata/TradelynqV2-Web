-- ============================================================================
-- reviews, disputes, case notes, legal acceptances, profile templates
-- (playbook S035–S036)
--
-- Trust is the product, and this file is where trust is written down. Two rules
-- shape everything below:
--
--   1. Nobody scores themselves. The rating is derived by trigger from moderated
--      reviews and is unwritable by hand.
--   2. Nothing that adjudicates a person is editable after the fact. Case notes
--      are append-only; legal acceptances are versioned rows, never updates.
-- ============================================================================

CREATE TYPE dispute_category AS ENUM (
  'billing',
  'service_quality',
  'fake_review',
  'misconduct',
  'other'
);

CREATE TYPE dispute_status AS ENUM ('open', 'investigating', 'resolved', 'closed');

-- ============================================================================
-- reviews
-- ============================================================================

CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,

  -- Nullable: seeded reviews (a professional's pre-platform clients, verified by
  -- an admin phoning them) have no platform account behind them. SET NULL on
  -- delete rather than CASCADE — a closed customer account must not silently
  -- erase a professional's earned rating.
  customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  job_enquiry_id UUID REFERENCES public.job_enquiries(id) ON DELETE SET NULL,

  reviewer_name TEXT NOT NULL,
  reviewer_phone TEXT,

  star_rating INTEGER NOT NULL,
  -- D54: 20–600 characters. Canonical.
  testimonial TEXT NOT NULL,
  photo_url TEXT,

  status review_status NOT NULL DEFAULT 'pending',

  -- Admin-entered on the professional's behalf. Approving one additionally
  -- requires the admin to confirm they contacted the client
  -- (api-admin-cron.md §2.1), which is API-side; the flag is what makes such a
  -- review distinguishable at all.
  is_seeded BOOLEAN NOT NULL DEFAULT FALSE,

  moderated_at TIMESTAMPTZ,
  moderated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejection_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT review_star_rating_range CHECK (star_rating BETWEEN 1 AND 5),
  CONSTRAINT review_testimonial_length CHECK (
    char_length(testimonial) BETWEEN 20 AND 600
  ),
  -- A moderation decision with no timestamp is unauditable.
  --
  -- Deliberately requires `moderated_at` only, NOT `moderated_by`. moderated_by
  -- is ON DELETE SET NULL, so requiring it would mean closing a former
  -- moderator's account violates this constraint on every review they ever
  -- touched — the account deletion fails outright and the person cannot leave.
  -- Attribution degrades to NULL; the durable record of WHO decided lives in
  -- admin_audit_log, which is append-only and does not reference profiles.
  CONSTRAINT review_moderation_is_attributable CHECK (
    status = 'pending' OR moderated_at IS NOT NULL
  ),
  CONSTRAINT review_rejection_has_reason CHECK (
    status <> 'rejected' OR rejection_reason IS NOT NULL
  )
);

COMMENT ON TABLE public.reviews IS
  'Customer reviews of professionals. Ratings on professional_profiles are derived from the moderated rows here by trigger.';
COMMENT ON COLUMN public.reviews.testimonial IS
  'D54: 20-600 characters, canonical.';
COMMENT ON COLUMN public.reviews.is_seeded IS
  'Admin-entered pre-platform review. Approval requires client-contact confirmation API-side; this flag makes it auditable.';

-- One review per enquiry: api-marketplace.md §6 returns 409 DUPLICATE, and a
-- unique index means the API cannot lose that race. Partial, because seeded
-- reviews carry no enquiry and must not collide with one another on NULL.
CREATE UNIQUE INDEX reviews_one_per_enquiry_idx
  ON public.reviews (job_enquiry_id)
  WHERE job_enquiry_id IS NOT NULL;

CREATE INDEX reviews_professional_idx ON public.reviews (professional_id);
CREATE INDEX reviews_customer_idx ON public.reviews (customer_id);
CREATE INDEX reviews_moderated_by_idx ON public.reviews (moderated_by);
-- The storefront's reviews section: this professional's published reviews.
CREATE INDEX reviews_published_idx
  ON public.reviews (professional_id, created_at DESC)
  WHERE status IN ('approved', 'featured');
-- Partial: the admin moderation queue only ever reads what is undecided.
CREATE INDEX reviews_moderation_queue_idx ON public.reviews (created_at)
  WHERE status = 'pending';

CREATE TRIGGER reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Rating recalculation ────────────────────────────────────────────────────
--
-- Recomputed from scratch on every change, for the same reason the connection
-- counter is: an incremental average is unrecoverable once it drifts, and a
-- professional's rating is the single number the whole marketplace is ranked on.
--
-- 'approved' AND 'featured' both count. `featured` is `approved` plus editorial
-- promotion — a state transition that DROPPED a review from the rating would
-- mean featuring your best review lowered your score.
--
-- 'pending' and 'rejected' count for nothing. That is the load-bearing half of
-- moderation: an unmoderated review must not move the number.

CREATE OR REPLACE FUNCTION public.recalculate_professional_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target UUID := COALESCE(NEW.professional_id, OLD.professional_id);
BEGIN
  UPDATE public.professional_profiles p
     SET average_rating = agg.avg_rating,
         review_count = agg.n
    FROM (
      SELECT
        -- ROUND to the column's scale so the stored value and a recomputation
        -- compare equal; without it the guard's IS DISTINCT FROM can trip on
        -- an unrounded intermediate.
        ROUND(AVG(r.star_rating)::NUMERIC, 2) AS avg_rating,
        COUNT(*)::INTEGER AS n
      FROM public.reviews r
      WHERE r.professional_id = target
        AND r.status IN ('approved', 'featured')
    ) AS agg
   WHERE p.id = target;

  RETURN NULL;  -- AFTER trigger
END;
$$;

COMMENT ON FUNCTION public.recalculate_professional_rating() IS
  'Recomputes average_rating and review_count from approved and featured reviews only. Full recount, not incremental — a drifted average is unrecoverable.';

-- Fires on the columns that can change the answer. Listing `status` explicitly
-- rather than a bare UPDATE keeps a professional editing an unrelated column
-- from triggering a table scan of their reviews.
CREATE TRIGGER reviews_recalculate_rating
  AFTER INSERT OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_professional_rating();

CREATE TRIGGER reviews_recalculate_rating_on_moderation
  AFTER UPDATE OF status, star_rating, professional_id ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_professional_rating();

-- ── Letting the trigger through the professional guard ──────────────────────
-- `guard_professional_privileged_columns` (20260719000005) blocks any write to
-- average_rating / review_count and bypasses only for NULL auth.uid() or an
-- admin. The recalculation above runs inside the *reviewer's* transaction with
-- the reviewer's JWT in scope, so without this it is blocked by the guard meant
-- to stop professionals rating themselves.
--
-- `pg_trigger_depth() > 1` means "another trigger issued this UPDATE". A client
-- PATCH is depth 1 and stays blocked. It is unforgeable by `authenticated`,
-- which cannot create triggers on these tables — unlike a session GUC, which
-- any client could set. Same fix, same reasoning as 20260719000007 applied to
-- customer_profiles. The rest of the body is unchanged from 20260719000005.

CREATE OR REPLACE FUNCTION public.guard_professional_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.national_id_verified IS DISTINCT FROM OLD.national_id_verified
     OR NEW.national_id_verified_at IS DISTINCT FROM OLD.national_id_verified_at
     OR NEW.national_id_verified_by IS DISTINCT FROM OLD.national_id_verified_by
     OR NEW.insurance_verified_at IS DISTINCT FROM OLD.insurance_verified_at
     OR NEW.insurance_verified_by IS DISTINCT FROM OLD.insurance_verified_by THEN
    RAISE EXCEPTION 'Verification state is set by administrators only.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.average_rating IS DISTINCT FROM OLD.average_rating
     OR NEW.review_count IS DISTINCT FROM OLD.review_count THEN
    RAISE EXCEPTION 'Ratings are derived from reviews and cannot be set directly.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.listing_status IS DISTINCT FROM OLD.listing_status
     AND NOT (OLD.listing_status = 'draft' AND NEW.listing_status = 'pending_review') THEN
    RAISE EXCEPTION 'Listing status is set by administrators. Submit for review instead.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT, UPDATE ON public.reviews TO authenticated;

-- Published reviews are public: they are most of why the storefront converts.
CREATE POLICY reviews_select_public ON public.reviews
  FOR SELECT TO anon, authenticated
  USING (status IN ('approved', 'featured'));

-- A professional sees their own pending reviews. They cannot act on them
-- (moderation is admin-side) but they must be able to raise a dispute, which
-- requires knowing the review exists.
CREATE POLICY reviews_select_own_professional ON public.reviews
  FOR SELECT TO authenticated
  USING (public.owns_professional_profile(professional_id));

CREATE POLICY reviews_select_own_customer ON public.reviews
  FOR SELECT TO authenticated
  USING (customer_id = (SELECT auth.uid()));

CREATE POLICY reviews_select_admin ON public.reviews
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY reviews_insert_own_customer ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = (SELECT auth.uid()));

-- Admins insert seeded reviews on a professional's behalf — a real client from
-- before the platform, telephoned and confirmed. Without this policy `is_seeded`
-- would be a column nothing could ever set through a user session.
CREATE POLICY reviews_insert_admin ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- The author may correct their own wording while it is still pending. Once
-- moderated the text is evidence and stops being editable (guard below).
CREATE POLICY reviews_update_own_customer ON public.reviews
  FOR UPDATE TO authenticated
  USING (customer_id = (SELECT auth.uid()))
  WITH CHECK (customer_id = (SELECT auth.uid()));

CREATE POLICY reviews_update_admin ON public.reviews
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- No DELETE policy and no DELETE grant: a review is removed by rejection, which
-- keeps the audit trail. Deletion is a service-role operation only.
-- No UPDATE path for professionals at all — see the missing policy, deliberate.

-- ── Column guard ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_review_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Foreign-key SET NULL actions (customer_id, moderated_by, job_enquiry_id)
  -- arrive as UPDATEs at depth > 1. Refusing them would block account deletion.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Self-moderation is the whole ballgame: a customer who could set
  -- status = 'approved' publishes straight onto a professional's storefront.
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.moderated_at IS DISTINCT FROM OLD.moderated_at
     OR NEW.moderated_by IS DISTINCT FROM OLD.moderated_by
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
    RAISE EXCEPTION 'Review moderation is performed by administrators only.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- `is_seeded` marks a review as admin-vouched. A customer setting it would be
  -- claiming an admin phoned them.
  IF NEW.is_seeded IS DISTINCT FROM OLD.is_seeded THEN
    RAISE EXCEPTION 'Seeded status is set by administrators only.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.professional_id IS DISTINCT FROM OLD.professional_id
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.job_enquiry_id IS DISTINCT FROM OLD.job_enquiry_id THEN
    RAISE EXCEPTION 'A review cannot be moved to a different professional or job.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Once published or rejected, the text is part of a decision.
  IF OLD.status <> 'pending'
     AND (NEW.testimonial IS DISTINCT FROM OLD.testimonial
          OR NEW.star_rating IS DISTINCT FROM OLD.star_rating) THEN
    RAISE EXCEPTION 'A moderated review can no longer be edited.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER reviews_guard_columns
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.guard_review_columns();

COMMENT ON FUNCTION public.guard_review_columns() IS
  'Blocks self-moderation, self-seeding, re-targeting, and post-moderation edits.';

-- ============================================================================
-- disputes
-- ============================================================================

CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Who opened it. Either party may — 06-ADMIN-CONSOLE describes a two-party
  -- case panel, and D40 puts a dispute action on the professional's reviews page.
  raised_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  category dispute_category NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,

  -- The evidence rail. Nullable and SET NULL: a dispute outlives the thing it
  -- was about, and the case notes still have to make sense afterwards.
  review_id UUID REFERENCES public.reviews(id) ON DELETE SET NULL,
  enquiry_id UUID REFERENCES public.job_enquiries(id) ON DELETE SET NULL,

  status dispute_status NOT NULL DEFAULT 'open',
  resolution TEXT,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT dispute_description_length CHECK (
    char_length(description) BETWEEN 20 AND 2000
  ),
  -- "No dispute closes without a resolution note" (06-ADMIN-CONSOLE §2.2),
  -- written as a constraint so it holds regardless of which client closes it.
  -- The 10-character floor matches the console's textarea minimum: "ok" is not
  -- a resolution either party can appeal against.
  --
  -- `resolved_by` is deliberately absent from this check for the same reason as
  -- reviews.moderated_by above: it is ON DELETE SET NULL, and requiring it would
  -- make closing a former admin's account fail against every case they resolved.
  CONSTRAINT dispute_resolution_is_complete CHECK (
    status NOT IN ('resolved', 'closed')
    OR (resolution IS NOT NULL
        AND char_length(resolution) >= 10
        AND resolved_at IS NOT NULL)
  ),
  -- A fake-review dispute with no review attached cannot be investigated.
  CONSTRAINT dispute_fake_review_names_a_review CHECK (
    category <> 'fake_review' OR review_id IS NOT NULL
  )
);

COMMENT ON TABLE public.disputes IS
  'Two-party dispute case. Resolution requires a substantive note and an attributed resolver — enforced here, not only in the console.';

CREATE INDEX disputes_professional_idx ON public.disputes (professional_id);
CREATE INDEX disputes_customer_idx ON public.disputes (customer_id);
CREATE INDEX disputes_raised_by_idx ON public.disputes (raised_by);
CREATE INDEX disputes_review_idx ON public.disputes (review_id);
CREATE INDEX disputes_enquiry_idx ON public.disputes (enquiry_id);
-- ON DELETE SET NULL: removing an admin profile scans every dispute without this.
CREATE INDEX disputes_resolved_by_idx ON public.disputes (resolved_by)
  WHERE resolved_by IS NOT NULL;
-- Partial: the admin queue is age-ordered over open cases only, and the
-- median-resolution-time metric reads the closed set separately.
CREATE INDEX disputes_open_queue_idx ON public.disputes (created_at)
  WHERE status IN ('open', 'investigating');

CREATE TRIGGER disputes_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes FORCE ROW LEVEL SECURITY;

-- No anon, ever. No DELETE: a dispute is closed, never erased.
GRANT SELECT, INSERT, UPDATE ON public.disputes TO authenticated;

CREATE POLICY disputes_select_own_professional ON public.disputes
  FOR SELECT TO authenticated
  USING (public.owns_professional_profile(professional_id));

CREATE POLICY disputes_select_own_customer ON public.disputes
  FOR SELECT TO authenticated
  USING (customer_id = (SELECT auth.uid()) OR raised_by = (SELECT auth.uid()));

CREATE POLICY disputes_select_admin ON public.disputes
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY disputes_insert_own ON public.disputes
  FOR INSERT TO authenticated
  WITH CHECK (raised_by = (SELECT auth.uid()));

-- Parties may add context to their own open case; the guard below confines that
-- to `description`. Everything adjudicative is admin-only.
CREATE POLICY disputes_update_parties ON public.disputes
  FOR UPDATE TO authenticated
  USING (
    raised_by = (SELECT auth.uid())
    OR customer_id = (SELECT auth.uid())
    OR public.owns_professional_profile(professional_id)
  )
  WITH CHECK (
    raised_by = (SELECT auth.uid())
    OR customer_id = (SELECT auth.uid())
    OR public.owns_professional_profile(professional_id)
  );

CREATE POLICY disputes_update_admin ON public.disputes
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.guard_dispute_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Foreign-key SET NULL actions (customer_id, review_id, enquiry_id,
  -- resolved_by) arrive as UPDATEs at depth > 1; refusing them would block
  -- account deletion.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- A party who could move their own case to 'resolved' would decide it.
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.resolution IS DISTINCT FROM OLD.resolution
     OR NEW.resolved_by IS DISTINCT FROM OLD.resolved_by
     OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at THEN
    RAISE EXCEPTION 'Dispute outcomes are decided by administrators only.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.professional_id IS DISTINCT FROM OLD.professional_id
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.raised_by IS DISTINCT FROM OLD.raised_by
     OR NEW.category IS DISTINCT FROM OLD.category THEN
    RAISE EXCEPTION 'Dispute parties and category are fixed once the case is opened.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER disputes_guard_columns
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.guard_dispute_columns();

COMMENT ON FUNCTION public.guard_dispute_columns() IS
  'Parties may extend their description; status, resolution, attribution, parties, and category are admin-only.';

-- ============================================================================
-- case_notes — append-only
-- ============================================================================
--
-- The dispute timeline. `POST /api/admin/case-notes { dispute_id, note }` and
-- nothing else: no PATCH, no DELETE, in the API or here.
--
-- Append-only is the point. A case note that can be edited after a decision is
-- worth nothing as a record of how the decision was reached — which is the only
-- reason to keep one.

CREATE TABLE public.case_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  dispute_id UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  -- SET NULL, not CASCADE: an admin leaving the organisation must not delete
  -- the reasoning behind every case they touched.
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  note TEXT NOT NULL,

  -- Internal notes never surface to either party. False means the note is
  -- quotable in the resolution message.
  is_internal BOOLEAN NOT NULL DEFAULT TRUE,

  -- No updated_at: there are no updates.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT case_note_length CHECK (char_length(btrim(note)) BETWEEN 1 AND 2000)
);

COMMENT ON TABLE public.case_notes IS
  'Append-only dispute timeline. No UPDATE or DELETE path exists for any role including service-role — enforced by trigger, not only by policy.';

CREATE INDEX case_notes_dispute_idx ON public.case_notes (dispute_id, created_at DESC);
CREATE INDEX case_notes_author_idx ON public.case_notes (author_id);

CREATE OR REPLACE FUNCTION public.reject_case_note_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Foreign-key actions are implemented as internal triggers, so a cascade from
  -- a deleted dispute, or the ON DELETE SET NULL on author_id when an admin's
  -- account is closed, arrives here as an UPDATE/DELETE at trigger depth > 1.
  -- Blocking those would make account deletion fail outright. A direct
  -- statement from any client runs at depth 1 and is still refused.
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  RAISE EXCEPTION 'Case notes are append-only. Add a correcting note instead.'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER case_notes_reject_update
  BEFORE UPDATE ON public.case_notes
  FOR EACH ROW EXECUTE FUNCTION public.reject_case_note_mutation();

CREATE TRIGGER case_notes_reject_delete
  BEFORE DELETE ON public.case_notes
  FOR EACH ROW EXECUTE FUNCTION public.reject_case_note_mutation();

COMMENT ON FUNCTION public.reject_case_note_mutation() IS
  'Hard-stops direct UPDATE and DELETE on case_notes for every role including service-role. Foreign-key cascades (depth > 1) pass, so account deletion still works.';

ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_notes FORCE ROW LEVEL SECURITY;

-- Admin-only, both ways. Parties see the resolution, not the working.
GRANT SELECT, INSERT ON public.case_notes TO authenticated;

CREATE POLICY case_notes_select_admin ON public.case_notes
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY case_notes_insert_admin ON public.case_notes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND author_id = (SELECT auth.uid()));

-- ============================================================================
-- legal_acceptances — versioned
-- ============================================================================
--
-- V1 was UNIQUE (user_id, doc_type) and upserted on a new version, which means
-- accepting v2.0 destroyed the evidence that v1.0 was ever accepted. That is
-- backwards: the record exists precisely so that "what did they agree to, and
-- when" is answerable for a version that is no longer current.
--
-- V2 is UNIQUE (user_id, document_type, document_version) — one row per
-- acceptance, kept for ever. "Current" is a query, not a row.

CREATE TABLE public.legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- TEXT with a CHECK rather than an enum: the document set changes on a legal
  -- timetable, and adding a value to an enum in a migration is a heavier
  -- operation than the change deserves.
  document_type TEXT NOT NULL,
  document_version TEXT NOT NULL,

  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Evidentiary. Captured at acceptance and never touched again.
  ip_address TEXT,
  user_agent TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT legal_acceptance_unique UNIQUE (user_id, document_type, document_version),
  CONSTRAINT legal_document_type_known CHECK (
    document_type IN ('privacy', 'terms', 'eula', 'reviews')
  ),
  -- Semver-ish: "1.0", "1.0.2". A free-text version makes "have they accepted
  -- the current one" unanswerable.
  CONSTRAINT legal_document_version_shape CHECK (
    document_version ~ '^[0-9]+\.[0-9]+(\.[0-9]+)?$'
  )
);

COMMENT ON TABLE public.legal_acceptances IS
  'One immutable row per (user, document, version). V1 upserted per document and destroyed the prior acceptance; this keeps every one.';
COMMENT ON COLUMN public.legal_acceptances.ip_address IS
  'Evidentiary, captured once at acceptance. TEXT not INET — proxied client addresses are not always parseable.';

CREATE INDEX legal_acceptances_user_idx ON public.legal_acceptances (user_id);
-- `GET /api/legal/status` asks "which of these versions has this user accepted",
-- on almost every gated request.
CREATE INDEX legal_acceptances_lookup_idx
  ON public.legal_acceptances (user_id, document_type, document_version);

CREATE OR REPLACE FUNCTION public.reject_legal_acceptance_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Legal acceptances are immutable. Record a new acceptance instead.'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER legal_acceptances_reject_update
  BEFORE UPDATE ON public.legal_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.reject_legal_acceptance_mutation();

ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_acceptances FORCE ROW LEVEL SECURITY;

-- No UPDATE, no DELETE for anyone. Rows go in and stay.
GRANT SELECT, INSERT ON public.legal_acceptances TO authenticated;

CREATE POLICY legal_acceptances_select_own ON public.legal_acceptances
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY legal_acceptances_select_admin ON public.legal_acceptances
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY legal_acceptances_insert_own ON public.legal_acceptances
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================================
-- profile_templates + seed
-- ============================================================================
--
-- Category-aware onboarding presets: what a beauty professional is asked for
-- differs from what a plumber is asked for. Reference data, edited by admins,
-- read by everyone.

CREATE TABLE public.profile_templates (
  -- TEXT key, not UUID: these are referenced by name in seeds and onboarding
  -- config, and a readable FK value is worth more than a generated one for a
  -- table with a dozen rows that a human maintains.
  id TEXT PRIMARY KEY,

  label TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,

  -- Ordered [{ id, title, component, position, required }].
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  primary_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  optional_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggested_services JSONB NOT NULL DEFAULT '[]'::jsonb,
  trust_badges JSONB NOT NULL DEFAULT '[]'::jsonb,

  primary_cta TEXT NOT NULL DEFAULT 'enquire',
  cta_label TEXT NOT NULL DEFAULT 'Send enquiry',

  pricing_format TEXT NOT NULL DEFAULT 'on_enquiry',
  pricing_label TEXT NOT NULL DEFAULT 'Contact for pricing',

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 99,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT profile_template_id_is_kebab CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- DESIGN.md bans literal hex, and the categories table already enforces it.
  -- A template that smuggled one in would render outside the token system.
  CONSTRAINT profile_template_colour_is_token CHECK (color !~ '^#'),
  CONSTRAINT profile_template_pricing_format_known CHECK (
    pricing_format IN ('on_enquiry', 'fixed', 'from', 'hourly', 'range')
  ),
  CONSTRAINT profile_template_cta_known CHECK (
    primary_cta IN ('enquire', 'book', 'call', 'message')
  )
);

COMMENT ON TABLE public.profile_templates IS
  'Category-aware onboarding and storefront presets. Reference data: admin-writable, world-readable.';
COMMENT ON COLUMN public.profile_templates.color IS
  'Tailwind semantic token name. A literal hex is rejected by CHECK, as in categories.';

CREATE INDEX profile_templates_active_idx ON public.profile_templates (display_order)
  WHERE is_active;

CREATE TRIGGER profile_templates_updated_at
  BEFORE UPDATE ON public.profile_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.profile_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_templates FORCE ROW LEVEL SECURITY;

-- anon reads: the templates shape public storefront rendering, so a signed-out
-- visitor loading a profile needs them. Same posture as categories.
GRANT SELECT ON public.profile_templates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profile_templates TO authenticated;

CREATE POLICY profile_templates_select_public ON public.profile_templates
  FOR SELECT TO anon, authenticated
  USING (is_active);

CREATE POLICY profile_templates_select_admin ON public.profile_templates
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY profile_templates_write_admin ON public.profile_templates
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Seed ────────────────────────────────────────────────────────────────────
-- Four templates covering the shapes that differ most: appointment-led beauty,
-- quote-led trades, project-led creative, and session-led tuition. The rest are
-- added by admins as categories prove they need them — seeding twelve
-- speculative templates would mean twelve to maintain before anyone uses one.

INSERT INTO public.profile_templates
  (id, label, icon, color, display_order, primary_cta, cta_label,
   pricing_format, pricing_label, sections, primary_fields, suggested_services, trust_badges)
VALUES
  ('beauty-and-wellness', 'Beauty & Wellness', 'scissors', 'pink', 1,
   'book', 'Book appointment', 'fixed', 'From TTD $80',
   '[{"id":"bio","title":"About","component":"bio","position":1,"required":true},
     {"id":"offerings","title":"Services & prices","component":"offerings","position":2,"required":true},
     {"id":"portfolio","title":"Portfolio","component":"portfolio","position":3,"required":false},
     {"id":"reviews","title":"Reviews","component":"reviews","position":4,"required":false},
     {"id":"hours","title":"Hours & location","component":"hours","position":5,"required":false}]'::jsonb,
   '[{"key":"specialties","label":"Specialties","type":"multi_select"},
     {"key":"accepts_walkins","label":"Accepts walk-ins","type":"toggle"}]'::jsonb,
   '[{"name":"Wash & set"},{"name":"Box braids"},{"name":"Manicure & pedicure"},
     {"name":"Makeup application"}]'::jsonb,
   '["id_verified","insured"]'::jsonb),

  ('home-and-trades', 'Home & Trades', 'wrench', 'amber', 2,
   'enquire', 'Send enquiry', 'on_enquiry', 'Contact for a quote',
   '[{"id":"bio","title":"About","component":"bio","position":1,"required":true},
     {"id":"offerings","title":"What I do","component":"offerings","position":2,"required":true},
     {"id":"areas","title":"Areas served","component":"areas","position":3,"required":true},
     {"id":"portfolio","title":"Recent work","component":"portfolio","position":4,"required":false},
     {"id":"reviews","title":"Reviews","component":"reviews","position":5,"required":false}]'::jsonb,
   '[{"key":"emergency_callouts","label":"Emergency callouts","type":"toggle"},
     {"key":"years_experience","label":"Years of experience","type":"number"}]'::jsonb,
   '[{"name":"Leak repair"},{"name":"Rewiring"},{"name":"Tiling"},{"name":"General maintenance"}]'::jsonb,
   '["id_verified","insured","registered_business"]'::jsonb),

  ('creative-and-events', 'Creative & Events', 'camera', 'violet', 3,
   'enquire', 'Enquire about a date', 'from', 'Packages from TTD $1,500',
   '[{"id":"bio","title":"About","component":"bio","position":1,"required":true},
     {"id":"portfolio","title":"Work","component":"portfolio","position":2,"required":true},
     {"id":"offerings","title":"Packages","component":"offerings","position":3,"required":true},
     {"id":"reviews","title":"Reviews","component":"reviews","position":4,"required":false}]'::jsonb,
   '[{"key":"travels_nationally","label":"Travels nationally","type":"toggle"},
     {"key":"turnaround_days","label":"Typical turnaround (days)","type":"number"}]'::jsonb,
   '[{"name":"Event coverage"},{"name":"Portrait session"},{"name":"Full-day package"}]'::jsonb,
   '["id_verified","portfolio_verified"]'::jsonb),

  ('tuition-and-lessons', 'Tuition & Lessons', 'graduation-cap', 'sky', 4,
   'book', 'Book a session', 'hourly', 'Per session',
   '[{"id":"bio","title":"About","component":"bio","position":1,"required":true},
     {"id":"offerings","title":"Subjects & rates","component":"offerings","position":2,"required":true},
     {"id":"credentials","title":"Qualifications","component":"credentials","position":3,"required":true},
     {"id":"reviews","title":"Reviews","component":"reviews","position":4,"required":false}]'::jsonb,
   '[{"key":"levels_taught","label":"Levels taught","type":"multi_select"},
     {"key":"online_available","label":"Online sessions","type":"toggle"}]'::jsonb,
   '[{"name":"CSEC Mathematics"},{"name":"CAPE Biology"},{"name":"Primary school literacy"}]'::jsonb,
   '["id_verified","qualification_verified"]'::jsonb);
