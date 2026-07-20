-- ============================================================================
-- professional_profiles — ONE table for every professional (playbook S031)
--
-- ## The consolidation decision (needs ratification as a D-entry)
--
-- V1 has two parallel tables, `worker_profiles` and `business_profiles`. V2 has
-- one. This is the single largest structural change in the rebuild, so the
-- reasoning is recorded here rather than in a commit message:
--
-- 1. `business_profiles` is a strict SUBSET of `worker_profiles`. Compare them
--    column for column and every business field has a worker equivalent —
--    company_name/business_name, contact_name/owner_name, description/bio, and
--    identical category_id, service_areas, listing_status, slug, and socials.
--    The only genuine additions are `employee_range` and the tier columns.
--    Two tables where one is a subset of the other are not two concepts.
--
-- 2. The cleanup programme names this exact split as the platform's core
--    problem: "worker/business professional domain split in two parallel
--    stacks… consolidate before adding more parallel features."
--
-- 3. V2 Phase 6 is explicitly "ONE component set, both roles", and S117 gates
--    that phase on "zero user-facing 'worker'". A unified UI over split tables
--    means every query, policy, and index written twice — which is how the two
--    stacks drifted apart in the first place.
--
-- 4. S033 already mandates this shape for satellites: "offerings
--    (professional-unified: one table, professional_id + role discriminator —
--    consolidation-clean from day one)". Unified satellites hanging off split
--    parents would be incoherent.
--
-- Against: S031 literally names `worker_profiles` and `business_profiles`, and
-- 09 §9.2 describes a `professional_profiles_view` over both. But §9.2 was
-- written for the evolve-in-place path (D59), which D60 superseded the same day
-- — its "additive column + backfill + view" sequence only makes sense when you
-- cannot drop tables. On a clean build the view's destination IS the table.
--
-- What distinguishes a registered business is `profiles.professional_subtype`,
-- not a separate table.
-- ============================================================================

CREATE TABLE public.professional_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Public storefront URL segment. Collision-safe via unique_slug().
  slug TEXT UNIQUE,

  -- ── Identity ──────────────────────────────────────────────────────────────
  -- `business_name` is the trading name for every subtype: a sole trader's is
  -- often their own name, a registered business's is the registered name.
  business_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  tagline TEXT,
  bio TEXT,

  -- ── Classification ────────────────────────────────────────────────────────
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  secondary_category_ids UUID[] NOT NULL DEFAULT '{}',
  availability availability_type,
  business_type business_type NOT NULL DEFAULT 'service_provider',

  -- Registered businesses only; NULL for sole traders and students. This is one
  -- of exactly two columns that were unique to V1's business_profiles.
  employee_range TEXT,

  -- ── Contact (gated) ───────────────────────────────────────────────────────
  -- Redacted server-side until the customer passes the connection gate. The API
  -- omits these from the payload entirely rather than sending and hiding them.
  contact_phone TEXT,
  contact_whatsapp TEXT,
  home_address TEXT,

  -- ── Presentation ──────────────────────────────────────────────────────────
  profile_photo_url TEXT,
  cover_photo_url TEXT,
  portfolio_urls TEXT[] NOT NULL DEFAULT '{}',
  website_url TEXT,
  instagram_handle TEXT,

  -- Array of { name, price_ttd?, description? }. JSONB rather than a table
  -- because services are edited as a whole list, never queried across
  -- professionals — the price filter reads the derived from_price below.
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  business_hours JSONB,
  certifications JSONB,

  -- ── Location ──────────────────────────────────────────────────────────────
  service_areas TEXT[] NOT NULL DEFAULT '{}',
  business_address TEXT,
  google_place_id TEXT,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),

  -- ── Trust & verification ──────────────────────────────────────────────────
  verification_status verification_status NOT NULL DEFAULT 'not_started',
  national_id_url TEXT,
  national_id_back_url TEXT,
  national_id_verified BOOLEAN NOT NULL DEFAULT FALSE,
  national_id_verified_at TIMESTAMPTZ,
  national_id_verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  selfie_url TEXT,
  date_of_birth DATE,

  has_insurance BOOLEAN NOT NULL DEFAULT FALSE,
  insurance_type TEXT,
  insurance_provider TEXT,
  insurance_policy_number TEXT,
  insurance_expires_at TIMESTAMPTZ,
  insurance_cert_url TEXT,
  insurance_verified_at TIMESTAMPTZ,
  insurance_verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- ── Listing state ─────────────────────────────────────────────────────────
  listing_status listing_status NOT NULL DEFAULT 'draft',
  onboarding_step INTEGER NOT NULL DEFAULT 1,
  is_organisation BOOLEAN NOT NULL DEFAULT FALSE,
  tenure_started DATE,

  -- ── Derived, trigger-maintained ───────────────────────────────────────────
  -- Never written by application code. Recomputed from approved reviews.
  average_rating NUMERIC(3, 2),
  review_count INTEGER NOT NULL DEFAULT 0,
  search_vector TSVECTOR,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT professional_rating_range CHECK (
    average_rating IS NULL OR (average_rating >= 0 AND average_rating <= 5)
  ),
  CONSTRAINT professional_review_count_non_negative CHECK (review_count >= 0),
  CONSTRAINT professional_onboarding_step_range CHECK (onboarding_step BETWEEN 1 AND 5),
  CONSTRAINT professional_employee_range_valid CHECK (
    employee_range IS NULL OR employee_range IN ('1-5', '6-20', '21-50', '50+')
  ),
  -- Both coordinates or neither; half a coordinate pair silently maps to the
  -- Gulf of Guinea.
  CONSTRAINT professional_coords_paired CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (latitude IS NOT NULL AND longitude IS NOT NULL)
  ),
  -- A listing cannot go live without the fields the storefront needs to render.
  CONSTRAINT professional_active_listing_is_complete CHECK (
    listing_status <> 'active'
    OR (category_id IS NOT NULL AND slug IS NOT NULL AND array_length(service_areas, 1) > 0)
  )
);

COMMENT ON TABLE public.professional_profiles IS
  'One row per professional, all subtypes. Replaces V1 worker_profiles + business_profiles. Subtype lives on profiles.';
COMMENT ON COLUMN public.professional_profiles.employee_range IS
  'Registered businesses only. One of two columns that were unique to V1 business_profiles.';
COMMENT ON COLUMN public.professional_profiles.contact_phone IS
  'GATED. Redacted server-side until the connection gate passes — omitted from the payload, not hidden client-side.';
COMMENT ON COLUMN public.professional_profiles.average_rating IS
  'Trigger-maintained from approved reviews. Never written by application code.';

-- ── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX professional_profiles_user_id_idx ON public.professional_profiles (user_id);
CREATE INDEX professional_profiles_category_idx ON public.professional_profiles (category_id)
  WHERE listing_status = 'active';
CREATE INDEX professional_profiles_listing_status_idx
  ON public.professional_profiles (listing_status);
CREATE INDEX professional_profiles_slug_idx ON public.professional_profiles (slug);

-- GIN on service_areas: every area-filtered search hits this. V1 left this index
-- outstanding (v2/10 flagged it as a TODO before the professionals index page
-- could ship); it is present from the start here.
CREATE INDEX professional_profiles_service_areas_idx
  ON public.professional_profiles USING GIN (service_areas);
CREATE INDEX professional_profiles_secondary_categories_idx
  ON public.professional_profiles USING GIN (secondary_category_ids);
CREATE INDEX professional_profiles_search_idx
  ON public.professional_profiles USING GIN (search_vector);

-- Ranking reads this constantly: subscribed-first, then rating.
CREATE INDEX professional_profiles_ranking_idx
  ON public.professional_profiles (average_rating DESC NULLS LAST, review_count DESC)
  WHERE listing_status = 'active';

-- Admin-reference FKs. Rarely queried directly, but both are ON DELETE SET NULL,
-- so removing an admin profile scans every professional row without these.
-- Partial, since the vast majority of rows are unverified and NULL.
CREATE INDEX professional_profiles_national_id_verified_by_idx
  ON public.professional_profiles (national_id_verified_by)
  WHERE national_id_verified_by IS NOT NULL;
CREATE INDEX professional_profiles_insurance_verified_by_idx
  ON public.professional_profiles (insurance_verified_by)
  WHERE insurance_verified_by IS NOT NULL;

-- ── Triggers ────────────────────────────────────────────────────────────────

CREATE TRIGGER professional_profiles_updated_at
  BEFORE UPDATE ON public.professional_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Slug on insert, and on a rename while still in draft. Once a listing is live
-- its URL is load-bearing — shared on WhatsApp, indexed by Google, printed on
-- cards — so a rename after publication keeps the original slug.
CREATE OR REPLACE FUNCTION public.professional_profile_set_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.slug IS NULL
     OR (TG_OP = 'UPDATE'
         AND NEW.business_name IS DISTINCT FROM OLD.business_name
         AND OLD.listing_status = 'draft') THEN
    NEW.slug := public.unique_slug(NEW.business_name, 'professional_profiles', 'slug', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER professional_profiles_slug
  BEFORE INSERT OR UPDATE ON public.professional_profiles
  FOR EACH ROW EXECUTE FUNCTION public.professional_profile_set_slug();

-- Full-text search vector. Weighted so a name match outranks a bio match:
-- searching "Ravi" should surface Ravi before someone who mentions Ravi in prose.
CREATE OR REPLACE FUNCTION public.professional_profile_set_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.business_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.owner_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.tagline, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.service_areas, ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.bio, '')), 'D');
  RETURN NEW;
END;
$$;

CREATE TRIGGER professional_profiles_search_vector
  BEFORE INSERT OR UPDATE ON public.professional_profiles
  FOR EACH ROW EXECUTE FUNCTION public.professional_profile_set_search_vector();

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.professional_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_profiles FORCE ROW LEVEL SECURITY;

-- ── SECURITY: column-level grants (fixed 20 Jul 2026) ───────────────────────
--
-- The previous version granted table-wide SELECT to anon. **RLS filters ROWS,
-- never COLUMNS**, so the `listing_status = 'active'` policy did nothing to
-- protect the sensitive columns on those rows. An adversarial test confirmed
-- that as `anon`, `national_id_url`, `selfie_url`, `date_of_birth`,
-- `home_address`, and `insurance_policy_number` all returned in cleartext.
--
-- The `kyc-documents` bucket was locked private while the URLs pointing into it
-- were world-readable — the lock and the key stored in different places.
--
-- anon now receives an explicit column allow-list: exactly the fields a public
-- storefront renders. A new column is NOT public by default; someone must add
-- it here deliberately, which is the correct direction for that decision to
-- fail in.
GRANT SELECT (
  id,
  user_id,
  slug,
  business_name,
  owner_name,
  tagline,
  bio,
  category_id,
  secondary_category_ids,
  availability,
  business_type,
  employee_range,
  profile_photo_url,
  cover_photo_url,
  portfolio_urls,
  website_url,
  instagram_handle,
  services,
  business_hours,
  certifications,
  service_areas,
  business_address,
  latitude,
  longitude,
  verification_status,
  national_id_verified,
  has_insurance,
  insurance_type,
  insurance_provider,
  insurance_expires_at,
  listing_status,
  is_organisation,
  tenure_started,
  average_rating,
  review_count,
  created_at,
  updated_at
) ON public.professional_profiles TO anon;

-- Deliberately NOT granted to anon:
--   contact_phone, contact_whatsapp, home_address  — gated behind the connection
--     gate; the API redacts them, and now the database does too
--   national_id_url, national_id_back_url, selfie_url, date_of_birth  — identity
--     documents and PII
--   insurance_policy_number  — a policy number is not public trust signal;
--     `has_insurance` and the expiry date are
--   insurance_cert_url, google_place_id, search_vector, onboarding_step
--   national_id_verified_at/_by, insurance_verified_at/_by  — moderation trail

-- `authenticated` keeps table-wide SELECT: the owner must read their own row in
-- full, and RLS confines them to it. Contact-field redaction for OTHER
-- professionals' rows is the API's job (details/api-marketplace.md §2.1), which
-- is verified separately at S080.
GRANT SELECT ON public.professional_profiles TO authenticated;
GRANT INSERT, UPDATE ON public.professional_profiles TO authenticated;

-- Public reads active listings only. Note this exposes the gated contact
-- columns at the row level — RLS cannot filter columns. Redaction is the API's
-- job (details/api-marketplace.md §2.1), and S080 verifies by curl that the
-- fields are absent from the payload pre-reveal. Anything reading this table
-- directly for a public surface MUST select an explicit column list.
CREATE POLICY professional_profiles_select_public ON public.professional_profiles
  FOR SELECT TO anon, authenticated
  USING (listing_status = 'active');

CREATE POLICY professional_profiles_select_own ON public.professional_profiles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY professional_profiles_select_admin ON public.professional_profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY professional_profiles_insert_own ON public.professional_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY professional_profiles_update_own ON public.professional_profiles
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY professional_profiles_update_admin ON public.professional_profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- No DELETE policy: listings are withdrawn by setting listing_status, never
-- removed. Enquiries, reviews, jobs, and invoices all reference this row.

-- ── Column guard ────────────────────────────────────────────────────────────
-- Same reasoning as profiles: RLS grants row access, and this row contains
-- fields a professional must not set for themselves. Self-verification would
-- make the entire trust ladder decorative.

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

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.national_id_verified IS DISTINCT FROM OLD.national_id_verified
     OR NEW.national_id_verified_at IS DISTINCT FROM OLD.national_id_verified_at
     OR NEW.national_id_verified_by IS DISTINCT FROM OLD.national_id_verified_by
     OR NEW.insurance_verified_at IS DISTINCT FROM OLD.insurance_verified_at
     OR NEW.insurance_verified_by IS DISTINCT FROM OLD.insurance_verified_by THEN
    RAISE EXCEPTION 'Verification state is set by administrators only.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Ratings are computed from reviews. A professional who could write their own
  -- rating would make every rating on the platform meaningless.
  IF NEW.average_rating IS DISTINCT FROM OLD.average_rating
     OR NEW.review_count IS DISTINCT FROM OLD.review_count THEN
    RAISE EXCEPTION 'Ratings are derived from reviews and cannot be set directly.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Publication is an admin decision: draft → pending_review is the
  -- professional's move, everything beyond it is moderation.
  IF NEW.listing_status IS DISTINCT FROM OLD.listing_status
     AND NOT (OLD.listing_status = 'draft' AND NEW.listing_status = 'pending_review') THEN
    RAISE EXCEPTION 'Listing status is set by administrators. Submit for review instead.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER professional_profiles_guard_privileged_columns
  BEFORE UPDATE ON public.professional_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_professional_privileged_columns();

COMMENT ON FUNCTION public.guard_professional_privileged_columns() IS
  'Blocks self-verification, self-rating, and self-publication. RLS cannot express column-level rules.';
