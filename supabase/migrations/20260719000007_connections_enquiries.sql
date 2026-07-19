-- ============================================================================
-- connections + job_enquiries — the marketplace contact record (playbook S033a)
--
-- These two tables are the load-bearing middle of the product. `connections` is
-- the ledger the free-contact gate counts; `job_enquiries` is the work request
-- that ledger unlocks.
--
-- Both reference `professional_profiles(id)` rather than V1's `worker_profiles`
-- — one professional table, per 20260719000005.
-- ============================================================================

-- ── Shared helper ───────────────────────────────────────────────────────────
-- "Does the caller own this professional_profiles row?" Used by every policy in
-- this migration and the three that follow. Written once, as a SECURITY DEFINER
-- function, for two reasons:
--
--   1. Inlining `professional_id IN (SELECT id FROM professional_profiles WHERE
--      user_id = auth.uid())` into a policy makes that subquery itself subject
--      to professional_profiles' RLS. It happens to work today because a
--      professional can see their own row — but it couples every satellite
--      policy to the parent's policy set, which is exactly the drift that split
--      V1 into two stacks.
--   2. One definition means one place to fix.

CREATE OR REPLACE FUNCTION public.owns_professional_profile(profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.professional_profiles
    WHERE id = profile_id
      AND user_id = (SELECT auth.uid())
  );
$$;

COMMENT ON FUNCTION public.owns_professional_profile(UUID) IS
  'Ownership test for professional satellite tables. SECURITY DEFINER so satellite policies do not inherit the parent table''s RLS.';

GRANT EXECUTE ON FUNCTION public.owns_professional_profile(UUID) TO anon, authenticated;

-- ============================================================================
-- connections
-- ============================================================================
--
-- One row per (customer, professional) contact reveal. The row IS the fact:
-- it is written once and never edited, because the connection counter, the KYC
-- gate, and any future dispute over "did they ever actually contact me" all read
-- it. An editable connection record is a rewritable history.

CREATE TABLE public.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,

  -- No updated_at: this table has no update path, so a column tracking updates
  -- would be permanently equal to created_at and quietly imply otherwise.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Revealing the same professional twice is a no-op that must never burn the
  -- counter (api-marketplace.md §3: duplicate reveal returns existing: true).
  -- Enforcing that here means the API cannot get it wrong under a race.
  CONSTRAINT connections_unique_pair UNIQUE (customer_id, professional_id)
);

COMMENT ON TABLE public.connections IS
  'Immutable ledger of customer-to-professional contact reveals. Drives customer_profiles.connection_count and the KYC gate.';

CREATE INDEX connections_customer_idx ON public.connections (customer_id);
CREATE INDEX connections_professional_idx ON public.connections (professional_id);
-- The professional's "who contacted me recently" list reads this ordering.
CREATE INDEX connections_professional_recent_idx
  ON public.connections (professional_id, created_at DESC);

-- ── Connection count maintenance ────────────────────────────────────────────
-- Recomputed by COUNT rather than incremented by +1. An increment is correct
-- only if it never runs twice and never misses; a recount is correct by
-- construction, and at two-to-a-few rows per customer it costs nothing. This is
-- also what makes DELETE (admin cleanup, cascade) self-healing.

CREATE OR REPLACE FUNCTION public.sync_customer_connection_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target UUID := COALESCE(NEW.customer_id, OLD.customer_id);
BEGIN
  UPDATE public.customer_profiles
     SET connection_count = (
       SELECT COUNT(*) FROM public.connections WHERE customer_id = target
     )
   WHERE user_id = target;

  RETURN NULL;  -- AFTER trigger; return value is ignored
END;
$$;

COMMENT ON FUNCTION public.sync_customer_connection_count() IS
  'Recomputes customer_profiles.connection_count from connections. Recount, not increment, so it is idempotent and self-healing.';

CREATE TRIGGER connections_sync_count
  AFTER INSERT OR DELETE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.sync_customer_connection_count();

-- ── Making the platform's own writes possible ───────────────────────────────
--
-- THE PROBLEM: `guard_customer_privileged_columns` (20260719000006) blocks any
-- write to connection_count, and it bypasses only when auth.uid() IS NULL or
-- the caller is an admin. The trigger above runs inside the customer's own
-- transaction, with the customer's JWT still in scope — SECURITY DEFINER
-- changes the *database role*, not auth.uid(). So the platform's own counter
-- update is blocked by the guard meant to stop the customer editing it.
--
-- THE FIX: `pg_trigger_depth() > 1` means "this UPDATE was issued by another
-- trigger, not by a client statement". A client PATCH runs at depth 1 and is
-- still blocked. An authenticated user cannot forge this — creating a trigger
-- on these tables requires ownership, which `authenticated` does not have. It
-- is a stronger signal than a session GUC, which any client could set.
--
-- The rest of the guard body is unchanged from 20260719000006.

CREATE OR REPLACE FUNCTION public.guard_customer_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Cascaded from a platform trigger (see the note above this function).
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- The whole gate rests on this number.
  IF NEW.connection_count IS DISTINCT FROM OLD.connection_count THEN
    RAISE EXCEPTION 'Connection count is maintained by the platform.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- A customer may move themselves to 'submitted' by uploading documents.
  -- Every other transition — verified, rejected — is an administrator's.
  IF NEW.kyc_status IS DISTINCT FROM OLD.kyc_status
     AND NOT (OLD.kyc_status IN ('not_required', 'pending', 'rejected')
              AND NEW.kyc_status = 'submitted') THEN
    RAISE EXCEPTION 'Verification decisions are made by administrators only.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.kyc_verified_at IS DISTINCT FROM OLD.kyc_verified_at
     OR NEW.kyc_verified_by IS DISTINCT FROM OLD.kyc_verified_by
     OR NEW.verified_address IS DISTINCT FROM OLD.verified_address THEN
    RAISE EXCEPTION 'Verification decisions are made by administrators only.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

-- ── Immutability ────────────────────────────────────────────────────────────
-- Two layers, because they fail differently. No UPDATE policy means a client
-- UPDATE silently affects zero rows — safe, but indistinguishable from "the row
-- wasn't there". The trigger turns any update, from any role including the
-- service role, into a loud error naming the rule.

CREATE OR REPLACE FUNCTION public.reject_connection_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Connections are immutable. Create a new connection or delete this one.'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER connections_reject_update
  BEFORE UPDATE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.reject_connection_mutation();

COMMENT ON FUNCTION public.reject_connection_mutation() IS
  'Hard-stops UPDATE on connections. The absent UPDATE policy fails silently; this fails loudly, including for the service role.';

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections FORCE ROW LEVEL SECURITY;

-- No anon: who contacted whom is private to the two parties.
-- No UPDATE, no DELETE for authenticated: immutable, and removal is an admin or
-- cascade action only.
GRANT SELECT, INSERT ON public.connections TO authenticated;

CREATE POLICY connections_select_own_customer ON public.connections
  FOR SELECT TO authenticated
  USING (customer_id = (SELECT auth.uid()));

-- The professional must see who has unlocked them — it is their lead list.
CREATE POLICY connections_select_own_professional ON public.connections
  FOR SELECT TO authenticated
  USING (public.owns_professional_profile(professional_id));

CREATE POLICY connections_select_admin ON public.connections
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Only the customer creates the connection, and only for themselves: a
-- professional manufacturing connections would inflate a customer's counter
-- and push them into KYC they never triggered.
CREATE POLICY connections_insert_own_customer ON public.connections
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = (SELECT auth.uid()));

CREATE POLICY connections_delete_admin ON public.connections
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- job_enquiries
-- ============================================================================

-- Where the off-platform conversation landed. Professional-private.
CREATE TYPE conversation_outcome AS ENUM ('talking', 'agreed', 'declined');

CREATE TABLE public.job_enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,

  status enquiry_status NOT NULL DEFAULT 'pending',

  -- D54: 20–1,000 characters. Canonical — chapters citing 2,000 are superseded.
  -- The floor matters as much as the ceiling: a three-word enquiry wastes the
  -- professional's response-rate metric and gets declined.
  description TEXT NOT NULL,
  preferred_date DATE,
  contact_preference contact_preference NOT NULL DEFAULT 'whatsapp',

  -- Enquiries logged manually by the professional (a WhatsApp message, a phone
  -- call) are still enquiries. The source chip on the list renders from this.
  source job_source NOT NULL DEFAULT 'platform',

  -- ── Lifecycle stamps ──────────────────────────────────────────────────────
  -- The response-rate metric derives from these, so they are set by the
  -- transition endpoints and guarded against the customer below.
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  declined_reason TEXT,

  -- ── Structured case log — PROFESSIONAL-PRIVATE ────────────────────────────
  -- Written by POST /api/enquiries/[id]/notes. RLS cannot hide columns from a
  -- row the customer is allowed to read, so these are redacted server-side in
  -- exactly the way professional_profiles.contact_phone is: the API selects an
  -- explicit column list and omits them. Anything reading this table for a
  -- customer surface MUST do the same.
  agreed_price_ttd INTEGER,
  agreed_timeline TEXT,
  scope_note TEXT,
  conversation_outcome conversation_outcome,
  professional_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT enquiry_description_length CHECK (char_length(description) BETWEEN 20 AND 1000),
  -- Integer TTD everywhere money lives; a negative agreed price is a typo.
  CONSTRAINT enquiry_agreed_price_non_negative CHECK (
    agreed_price_ttd IS NULL OR agreed_price_ttd >= 0
  ),
  -- "Declined" with no reason gives the customer nothing to act on, and the
  -- decline copy surfaces the reason verbatim.
  CONSTRAINT enquiry_declined_has_reason CHECK (
    status <> 'declined' OR declined_reason IS NOT NULL
  ),
  -- Review eligibility is gated on completion, so completion needs a timestamp.
  CONSTRAINT enquiry_completed_has_timestamp CHECK (
    status <> 'completed' OR completed_at IS NOT NULL
  )
);

COMMENT ON TABLE public.job_enquiries IS
  'Customer work request to a professional. Carries the professional-private structured case log.';
COMMENT ON COLUMN public.job_enquiries.description IS
  'D54: 20-1,000 characters, canonical. Chapters citing 2,000 are superseded.';
COMMENT ON COLUMN public.job_enquiries.professional_notes IS
  'PROFESSIONAL-PRIVATE. Redacted server-side by explicit column list — RLS cannot filter columns.';
COMMENT ON COLUMN public.job_enquiries.agreed_price_ttd IS
  'PROFESSIONAL-PRIVATE. Integer TTD (law 5: no floats where money lives).';

CREATE INDEX job_enquiries_customer_idx ON public.job_enquiries (customer_id);
CREATE INDEX job_enquiries_professional_idx ON public.job_enquiries (professional_id);
CREATE INDEX job_enquiries_category_idx ON public.job_enquiries (category_id);
-- The professional's inbox is the hot path: their rows, newest first.
CREATE INDEX job_enquiries_professional_inbox_idx
  ON public.job_enquiries (professional_id, created_at DESC);
-- Partial: the "New" tab and the response-SLA amber chip only read pending rows.
CREATE INDEX job_enquiries_pending_idx ON public.job_enquiries (professional_id, created_at)
  WHERE status = 'pending';
-- Review eligibility joins on completed enquiries only.
CREATE INDEX job_enquiries_completed_idx ON public.job_enquiries (customer_id, completed_at)
  WHERE status = 'completed';

CREATE TRIGGER job_enquiries_updated_at
  BEFORE UPDATE ON public.job_enquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.job_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_enquiries FORCE ROW LEVEL SECURITY;

-- No anon. No DELETE: enquiries are cancelled by status, never removed —
-- bookings, reviews, and the response-rate metric all reference them.
GRANT SELECT, INSERT, UPDATE ON public.job_enquiries TO authenticated;

CREATE POLICY job_enquiries_select_own_customer ON public.job_enquiries
  FOR SELECT TO authenticated
  USING (customer_id = (SELECT auth.uid()));

CREATE POLICY job_enquiries_select_own_professional ON public.job_enquiries
  FOR SELECT TO authenticated
  USING (public.owns_professional_profile(professional_id));

CREATE POLICY job_enquiries_select_admin ON public.job_enquiries
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- The customer creates the enquiry. A professional logging a WhatsApp lead does
-- so through a server route holding the service key, because that write names a
-- customer_id other than its own and must be attributable.
CREATE POLICY job_enquiries_insert_own_customer ON public.job_enquiries
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = (SELECT auth.uid()));

CREATE POLICY job_enquiries_update_parties ON public.job_enquiries
  FOR UPDATE TO authenticated
  USING (
    customer_id = (SELECT auth.uid())
    OR public.owns_professional_profile(professional_id)
  )
  WITH CHECK (
    customer_id = (SELECT auth.uid())
    OR public.owns_professional_profile(professional_id)
  );

CREATE POLICY job_enquiries_update_admin ON public.job_enquiries
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Column guard ────────────────────────────────────────────────────────────
-- The UPDATE policy above is deliberately generous: both parties need to write
-- to this row. That makes the column rules the entire security boundary here.
--
--   The customer must not: accept, complete, or decline on the professional's
--   behalf, nor write into the professional's private case log.
--
--   The professional must not: rewrite what was asked for. A description edited
--   after the fact makes the enquiry unusable as evidence in a dispute.
--
--   Neither may re-point the enquiry at a different person.

CREATE OR REPLACE FUNCTION public.guard_job_enquiry_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller UUID := (SELECT auth.uid());
BEGIN
  IF caller IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Foreign-key actions (category_id ON DELETE SET NULL) and any future
  -- platform trigger arrive at depth > 1. Client statements run at depth 1.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Re-pointing an enquiry rewrites who asked and who was asked.
  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.professional_id IS DISTINCT FROM OLD.professional_id THEN
    RAISE EXCEPTION 'Enquiry parties cannot be reassigned.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF caller = OLD.customer_id THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status <> 'cancelled' THEN
      RAISE EXCEPTION 'Only the professional can change an enquiry''s status. Customers may cancel.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
       OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
       OR NEW.declined_reason IS DISTINCT FROM OLD.declined_reason THEN
      RAISE EXCEPTION 'Enquiry lifecycle stamps are set by the professional.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NEW.agreed_price_ttd IS DISTINCT FROM OLD.agreed_price_ttd
       OR NEW.agreed_timeline IS DISTINCT FROM OLD.agreed_timeline
       OR NEW.scope_note IS DISTINCT FROM OLD.scope_note
       OR NEW.conversation_outcome IS DISTINCT FROM OLD.conversation_outcome
       OR NEW.professional_notes IS DISTINCT FROM OLD.professional_notes THEN
      RAISE EXCEPTION 'The case log is the professional''s private record.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

  ELSE
    -- The professional. They own the outcome; they do not own the request.
    IF NEW.description IS DISTINCT FROM OLD.description
       OR NEW.preferred_date IS DISTINCT FROM OLD.preferred_date
       OR NEW.contact_preference IS DISTINCT FROM OLD.contact_preference THEN
      RAISE EXCEPTION 'The enquiry as submitted cannot be edited by the professional.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER job_enquiries_guard_columns
  BEFORE UPDATE ON public.job_enquiries
  FOR EACH ROW EXECUTE FUNCTION public.guard_job_enquiry_columns();

COMMENT ON FUNCTION public.guard_job_enquiry_columns() IS
  'Splits an enquiry into customer-owned and professional-owned columns. The UPDATE policy lets both parties in; this decides what each may touch.';
