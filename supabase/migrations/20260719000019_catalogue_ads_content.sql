-- ============================================================================
-- catalogue, WhatsApp, AI knowledge, content library, ads, referrals
-- (playbook S044 — the last Phase-1 block)
--
-- These are the surfaces that sit beside the marketplace rather than inside it:
-- the showcase feed, the WhatsApp context an AI assistant reads, generated
-- content, sponsored placements, and insurance referral clicks.
--
-- ## Consolidation note (D-entry pending)
--
-- `reference/database.md` gives `business_id -> business_profiles(id)` for
-- catalogue_posts, whatsapp_messages, business_knowledge and content_library,
-- and `worker_id -> worker_profiles(id)` for insurance_referrals. **Neither
-- table exists in V2** — S031 consolidated both into `professional_profiles`.
-- Every one of those FKs is therefore `professional_id ->
-- professional_profiles(id)`. This follows the same precedence already applied
-- across Phase 1 and is recorded here rather than resolved silently.
--
-- ## The theme: RLS filters rows, never columns
--
-- Two tables here are publicly readable, and both carry columns that must not
-- be public — a sponsor's contact email and what they paid, a catalogue poster's
-- identity. S030 learned this the expensive way on professional_profiles: a
-- policy that returns the right ROWS still returns every COLUMN of them. So the
-- public grants below are column-scoped, not table-scoped.
-- ============================================================================

-- pgvector, for the AI assistant's knowledge retrieval. Supabase convention is
-- to keep extensions out of `public` so they cannot collide with application
-- objects or be captured by a search_path.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ============================================================================
-- catalogue_posts — the showcase feed
-- ============================================================================

CREATE TABLE public.catalogue_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,

  -- Who pressed post. Separate from professional_id because a post may be made
  -- by a customer showing work they commissioned (poster_type = 'customer'),
  -- and the credit and the moderation trail belong to different people.
  posted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- 'professional', not the reference doc's 'business': S028 carried the
  -- vocabulary canon into the enum values themselves.
  poster_type catalogue_poster_type NOT NULL DEFAULT 'professional',

  image_urls TEXT[] NOT NULL,
  primary_image TEXT,
  caption TEXT,
  category TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  location TEXT,

  -- Default TRUE: the feed is post-moderated, not pre-moderated. A showcase that
  -- takes a day to appear is a showcase nobody posts to. Admin can retract.
  is_approved BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,

  -- Trigger-maintained from catalogue_saves; never written by application code.
  view_count INTEGER NOT NULL DEFAULT 0,
  save_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A post with no images is not a showcase post. Enforced here because the
  -- feed's layout assumes at least one image and would render an empty tile.
  --
  -- COALESCE is load-bearing, not defensive noise. `array_length('{}', 1)`
  -- returns NULL rather than 0, and `NULL >= 1` evaluates to NULL — which a
  -- CHECK constraint treats as satisfied. Written without it, this constraint
  -- rejects nothing at all for exactly the input it exists to reject. The test
  -- suite caught it on the first run.
  CONSTRAINT catalogue_post_has_images
    CHECK (COALESCE(array_length(image_urls, 1), 0) >= 1),
  CONSTRAINT catalogue_post_counts_non_negative
    CHECK (view_count >= 0 AND save_count >= 0)
);

CREATE INDEX catalogue_posts_professional_idx ON public.catalogue_posts (professional_id);
CREATE INDEX catalogue_posts_posted_by_idx ON public.catalogue_posts (posted_by);
-- The feed's own query: approved posts, newest first, featured lifted.
CREATE INDEX catalogue_posts_feed_idx
  ON public.catalogue_posts (is_approved, is_featured DESC, created_at DESC);
CREATE INDEX catalogue_posts_tags_idx ON public.catalogue_posts USING GIN (tags);

CREATE TRIGGER catalogue_posts_updated_at
  BEFORE UPDATE ON public.catalogue_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.catalogue_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogue_posts FORCE ROW LEVEL SECURITY;

-- Column-scoped for anon. `posted_by` is deliberately absent: the feed shows a
-- business, not the user id of whoever operated the account, and exposing it
-- would let a scraper join public posts to platform identities.
GRANT SELECT (
  id, professional_id, poster_type, image_urls, primary_image, caption,
  category, tags, location, is_featured, view_count, save_count, created_at
) ON public.catalogue_posts TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogue_posts TO authenticated;

CREATE POLICY catalogue_posts_select_public ON public.catalogue_posts
  FOR SELECT TO anon, authenticated
  USING (is_approved);

CREATE POLICY catalogue_posts_select_own ON public.catalogue_posts
  FOR SELECT TO authenticated
  USING (posted_by = (SELECT auth.uid()) OR public.owns_professional_profile(professional_id));

CREATE POLICY catalogue_posts_select_admin ON public.catalogue_posts
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY catalogue_posts_write_own ON public.catalogue_posts
  FOR ALL TO authenticated
  USING (posted_by = (SELECT auth.uid()))
  WITH CHECK (posted_by = (SELECT auth.uid()));

CREATE POLICY catalogue_posts_write_admin ON public.catalogue_posts
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Moderation and popularity are not self-serve. Without this guard the
-- write_own policy above would let a poster set is_featured, is_approved, or
-- their own save_count — RLS grants the row, so only a column guard can refuse
-- the field.
CREATE OR REPLACE FUNCTION public.guard_catalogue_post_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- An update reaching here from inside another trigger is the platform
  -- maintaining its own derived state, not a user editing a field.
  -- `sync_catalogue_save_count` updates save_count on the post whenever a save
  -- is added or removed, and that legitimate write would otherwise be refused
  -- by the save_count check below — the guard would block the very mechanism
  -- that makes the count trustworthy.
  --
  -- `pg_trigger_depth() > 1` is the precise test: it is true only when this
  -- trigger fired as a consequence of another trigger's statement. It cannot be
  -- forged from the client, because a trigger function returning TRIGGER cannot
  -- be invoked directly outside trigger context.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved
     OR NEW.is_featured IS DISTINCT FROM OLD.is_featured
     OR NEW.view_count IS DISTINCT FROM OLD.view_count
     OR NEW.save_count IS DISTINCT FROM OLD.save_count THEN
    RAISE EXCEPTION 'moderation state and engagement counts are not self-serve'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER catalogue_posts_guard_columns
  BEFORE UPDATE ON public.catalogue_posts
  FOR EACH ROW EXECUTE FUNCTION public.guard_catalogue_post_columns();

-- ============================================================================
-- catalogue_saves
-- ============================================================================

CREATE TABLE public.catalogue_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.catalogue_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Saving twice is the same as saving once. A unique pair makes the toggle
  -- idempotent, so a double-tap on a slow connection cannot inflate save_count.
  CONSTRAINT catalogue_saves_unique_pair UNIQUE (user_id, post_id)
);

CREATE INDEX catalogue_saves_user_idx ON public.catalogue_saves (user_id, created_at DESC);
CREATE INDEX catalogue_saves_post_idx ON public.catalogue_saves (post_id);

ALTER TABLE public.catalogue_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogue_saves FORCE ROW LEVEL SECURITY;

-- No anon, and no UPDATE: a save has no mutable field. Unsaving is a DELETE,
-- which S101's optimistic unsave/undo needs.
GRANT SELECT, INSERT, DELETE ON public.catalogue_saves TO authenticated;

CREATE POLICY catalogue_saves_own ON public.catalogue_saves
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- save_count is derived here rather than in application code, because four
-- clients write this database and a count maintained in one is wrong in three.
CREATE OR REPLACE FUNCTION public.sync_catalogue_save_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.catalogue_posts
       SET save_count = save_count + 1
     WHERE id = NEW.post_id;
    RETURN NEW;
  END IF;

  UPDATE public.catalogue_posts
     SET save_count = GREATEST(0, save_count - 1)
   WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER catalogue_saves_sync_count
  AFTER INSERT OR DELETE ON public.catalogue_saves
  FOR EACH ROW EXECUTE FUNCTION public.sync_catalogue_save_count();

-- ============================================================================
-- whatsapp_messages — immutable transcript
-- ============================================================================
--
-- Private in every direction. This is correspondence, and it is also the corpus
-- the AI assistant reads, so a leak here is both a privacy breach and a prompt-
-- injection surface.

CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,

  from_number TEXT NOT NULL,
  to_number TEXT,
  message TEXT NOT NULL,
  direction whatsapp_direction NOT NULL,
  media_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX whatsapp_messages_professional_idx
  ON public.whatsapp_messages (professional_id, created_at DESC);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages FORCE ROW LEVEL SECURITY;

-- No anon. No UPDATE and no DELETE to anyone: a transcript that can be edited
-- is not a transcript, and it is evidence in a dispute.
GRANT SELECT, INSERT ON public.whatsapp_messages TO authenticated;

CREATE POLICY whatsapp_messages_select_own ON public.whatsapp_messages
  FOR SELECT TO authenticated
  USING (public.owns_professional_profile(professional_id));

CREATE POLICY whatsapp_messages_select_admin ON public.whatsapp_messages
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY whatsapp_messages_insert_own ON public.whatsapp_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_professional_profile(professional_id));

-- ============================================================================
-- business_knowledge — the AI assistant's retrieval corpus
-- ============================================================================

CREATE TABLE public.business_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,

  content TEXT NOT NULL,

  -- 1536 dimensions matches the embedding model in use. Fixed rather than bare
  -- `vector`, because an index cannot be built on an unconstrained vector and a
  -- dimension mismatch would otherwise fail at query time, not at write time.
  embedding extensions.vector(1536),

  source TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX business_knowledge_professional_idx
  ON public.business_knowledge (professional_id);

-- HNSW over IVFFlat: IVFFlat needs training data to build a useful index and
-- degrades badly when the table is small, which is exactly the state every new
-- professional starts in. HNSW is usable from the first row.
CREATE INDEX business_knowledge_embedding_idx
  ON public.business_knowledge USING hnsw (embedding extensions.vector_cosine_ops);

CREATE TRIGGER business_knowledge_updated_at
  BEFORE UPDATE ON public.business_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.business_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_knowledge FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_knowledge TO authenticated;

CREATE POLICY business_knowledge_own ON public.business_knowledge
  FOR ALL TO authenticated
  USING (public.owns_professional_profile(professional_id))
  WITH CHECK (public.owns_professional_profile(professional_id));

CREATE POLICY business_knowledge_admin ON public.business_knowledge
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- content_library
-- ============================================================================

CREATE TABLE public.content_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,

  content_type content_type NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Published without a timestamp makes "when did this go out" unanswerable.
  CONSTRAINT content_published_has_timestamp CHECK (
    is_published = FALSE OR published_at IS NOT NULL
  )
);

CREATE INDEX content_library_professional_idx
  ON public.content_library (professional_id, created_at DESC);

CREATE TRIGGER content_library_updated_at
  BEFORE UPDATE ON public.content_library
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.content_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_library FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_library TO authenticated;

CREATE POLICY content_library_own ON public.content_library
  FOR ALL TO authenticated
  USING (public.owns_professional_profile(professional_id))
  WITH CHECK (public.owns_professional_profile(professional_id));

CREATE POLICY content_library_admin ON public.content_library
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- ad_packages — internal pricing definitions
-- ============================================================================
--
-- Deliberately NOT public. These are what we charge sponsors, which is
-- commercial information; the public surface renders a campaign, never its
-- package or its price.

CREATE TABLE public.ad_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ad_type ad_type NOT NULL,
  duration_days INTEGER NOT NULL,
  price_ttd INTEGER NOT NULL,
  placement_zones TEXT[] NOT NULL DEFAULT '{}',
  max_impressions INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ad_package_duration_positive CHECK (duration_days > 0),
  CONSTRAINT ad_package_price_non_negative CHECK (price_ttd >= 0),
  CONSTRAINT ad_package_impressions_positive CHECK (
    max_impressions IS NULL OR max_impressions > 0
  )
);

ALTER TABLE public.ad_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_packages FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_packages TO authenticated;

CREATE POLICY ad_packages_admin ON public.ad_packages
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- sponsor_campaigns
-- ============================================================================

CREATE TABLE public.sponsor_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  company_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,

  ad_type ad_type NOT NULL,
  placement_zone TEXT,
  creative_url TEXT,
  link_url TEXT,

  amount_paid_ttd INTEGER,
  package_id UUID REFERENCES public.ad_packages(id) ON DELETE SET NULL,

  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Counters moved only by the RPCs below.
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  weight INTEGER NOT NULL DEFAULT 1,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT sponsor_campaign_window_ordered CHECK (ends_at > starts_at),
  CONSTRAINT sponsor_campaign_weight_positive CHECK (weight >= 1),
  CONSTRAINT sponsor_campaign_counts_non_negative
    CHECK (impressions >= 0 AND clicks >= 0),
  CONSTRAINT sponsor_campaign_amount_non_negative CHECK (
    amount_paid_ttd IS NULL OR amount_paid_ttd >= 0
  ),
  CONSTRAINT sponsor_campaign_zone_valid CHECK (
    placement_zone IS NULL
    OR placement_zone IN ('sidebar', 'header', 'category', 'search', 'home')
  )
);

-- The rotation query: live campaigns for a zone, heaviest first.
CREATE INDEX sponsor_campaigns_live_idx
  ON public.sponsor_campaigns (is_active, placement_zone, starts_at, ends_at, weight DESC);
CREATE INDEX sponsor_campaigns_package_idx ON public.sponsor_campaigns (package_id);

CREATE TRIGGER sponsor_campaigns_updated_at
  BEFORE UPDATE ON public.sponsor_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.sponsor_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_campaigns FORCE ROW LEVEL SECURITY;

-- THE COLUMN GRANT THAT MATTERS.
--
-- The rotation is rendered for signed-out visitors, so anon must read campaigns
-- — but `contact_email` and `amount_paid_ttd` are commercial data. RLS returns
-- whole rows, so the row policy below cannot withhold them; only this
-- column-scoped grant can. Same failure mode as professional_profiles at S030.
GRANT SELECT (
  id, ad_type, placement_zone, creative_url, link_url, company_name,
  starts_at, ends_at, weight
) ON public.sponsor_campaigns TO anon;

GRANT SELECT (
  id, ad_type, placement_zone, creative_url, link_url, company_name,
  starts_at, ends_at, weight
) ON public.sponsor_campaigns TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.sponsor_campaigns TO authenticated;

CREATE POLICY sponsor_campaigns_select_live ON public.sponsor_campaigns
  FOR SELECT TO anon, authenticated
  USING (is_active AND NOW() >= starts_at AND NOW() <= ends_at);

CREATE POLICY sponsor_campaigns_admin ON public.sponsor_campaigns
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admin needs the commercial columns the public grant withholds.
GRANT SELECT (contact_email, amount_paid_ttd, package_id, impressions, clicks, is_active,
              created_at, updated_at)
  ON public.sponsor_campaigns TO authenticated;

-- ── Atomic counters ─────────────────────────────────────────────────────────
--
-- SECURITY DEFINER because an impression must be recordable by an anonymous
-- visitor who has no UPDATE grant on the table — and must not require one, or
-- the grant becomes a way to rewrite campaign state.
--
-- The UPDATE is a single statement, so it is atomic without an explicit lock:
-- `impressions = impressions + 1` is computed by the database, not read into
-- the client and written back, which is where lost updates come from.

CREATE OR REPLACE FUNCTION public.increment_campaign_impressions(campaign_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.sponsor_campaigns
     SET impressions = impressions + 1
   WHERE id = campaign_id
     AND is_active
     AND NOW() BETWEEN starts_at AND ends_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_campaign_clicks(campaign_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.sponsor_campaigns
     SET clicks = clicks + 1
   WHERE id = campaign_id
     AND is_active
     AND NOW() BETWEEN starts_at AND ends_at;
END;
$$;

-- REVOKE before GRANT, always.
--
-- A new function is EXECUTE-able by PUBLIC by default, so a bare `GRANT … TO
-- anon` adds nothing and leaves the function reachable by every role including
-- future ones. Revoking first is what turns the GRANT into an actual allow-list
-- — the same reasoning `harden_grants` applies to `is_admin()`, and the schema
-- invariant suite fails the build without it.
--
-- The window check inside each function is what stops an expired campaign from
-- accruing billable impressions after it ends.
REVOKE ALL ON FUNCTION public.increment_campaign_impressions(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_campaign_clicks(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_campaign_impressions(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_campaign_clicks(UUID) TO anon, authenticated;

-- ============================================================================
-- insurance_referrals — click analytics, immutable
-- ============================================================================

CREATE TABLE public.insurance_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,

  referral_url TEXT NOT NULL,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Hashed, never raw. The analytic question is "how many distinct people",
  -- which a hash answers; storing the address would build a queryable log of
  -- who visited which insurer, which is not ours to keep.
  ip_hash TEXT,
  user_agent TEXT
);

CREATE INDEX insurance_referrals_professional_idx
  ON public.insurance_referrals (professional_id, clicked_at DESC);

ALTER TABLE public.insurance_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_referrals FORCE ROW LEVEL SECURITY;

-- No anon grant of any kind, in either direction.
--
-- The click happens signed-out, so the obvious design is `GRANT INSERT TO anon`
-- — but `20260719999999_harden_grants.sql` establishes a platform-wide rule that
-- anon never writes directly to a public table, and that rule is right: a direct
-- INSERT grant lets anyone flood this table with fabricated referral clicks,
-- which is both a spam vector and a corrupted analytic.
--
-- The write therefore goes through the SECURITY DEFINER function below, matching
-- how campaign impressions are recorded. Reads stay owner-and-admin only: a
-- public read would expose which professionals are shopping for insurance.
GRANT SELECT ON public.insurance_referrals TO authenticated;

CREATE POLICY insurance_referrals_select_own ON public.insurance_referrals
  FOR SELECT TO authenticated
  USING (public.owns_professional_profile(professional_id));

CREATE POLICY insurance_referrals_select_admin ON public.insurance_referrals
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- The only write path. Takes the raw IP and hashes it here rather than trusting
-- the caller to have done so — a client-supplied "hash" is just a string, and
-- accepting one would let the raw address arrive by mistake and be stored.
CREATE OR REPLACE FUNCTION public.record_insurance_referral(
  target_professional UUID,
  url TEXT,
  client_ip TEXT DEFAULT NULL,
  client_user_agent TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Silently ignore a click against a professional who does not exist, rather
  -- than raising: the FK would leak whether an id is real to an anonymous
  -- caller, turning this endpoint into an enumeration oracle.
  IF NOT EXISTS (
    SELECT 1 FROM public.professional_profiles WHERE id = target_professional
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.insurance_referrals
    (professional_id, referral_url, ip_hash, user_agent)
  VALUES (
    target_professional,
    url,
    CASE WHEN client_ip IS NULL THEN NULL
         ELSE encode(extensions.digest(client_ip, 'sha256'), 'hex') END,
    client_user_agent
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.record_insurance_referral(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  public.record_insurance_referral(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ============================================================================
-- Grant hygiene (mirrors 20260719999999_harden_grants.sql)
-- ============================================================================
--
-- RLS does not apply to TRUNCATE, and Supabase grants it to client roles by
-- default. Every new table has to be re-hardened or it reopens the hole the
-- security advisory documented.

REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.catalogue_posts FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.catalogue_saves FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.whatsapp_messages FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.business_knowledge FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.content_library FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.ad_packages FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.sponsor_campaigns FROM anon, authenticated;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.insurance_referrals FROM anon, authenticated;

COMMENT ON TABLE public.catalogue_posts IS
  'Showcase feed. Post-moderated (is_approved defaults true); moderation and engagement counts are guarded against self-serve edits.';
COMMENT ON TABLE public.whatsapp_messages IS
  'Immutable correspondence. No UPDATE or DELETE grant to any client role.';
COMMENT ON TABLE public.sponsor_campaigns IS
  'Publicly readable through a COLUMN-scoped grant: contact_email and amount_paid_ttd are never exposed to anon.';
