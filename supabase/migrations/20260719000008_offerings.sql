-- ============================================================================
-- offerings — structured services, one table for every professional (S033b)
--
-- V1's `offerings` carried BOTH `worker_profile_id` and `business_profile_id`
-- with a CHECK enforcing exactly one, and then paid for it: two SELECT policies,
-- two INSERT policies, two UPDATE policies, two DELETE policies, two indexes,
-- and two API routes (`/api/workers/offerings`, `/api/business/offerings`) that
-- api-operations.md §6 describes as "identical in shape".
--
-- With one professional table the discriminator disappears entirely. There is
-- no role column here because there is nothing to discriminate: what kind of
-- professional owns this offering is answered by
-- profiles.professional_subtype, one join away, and no query in the product
-- needs it to render an offering.
-- ============================================================================

CREATE TABLE public.offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,

  name TEXT NOT NULL,
  description TEXT,

  -- Integer TTD (law 5). NULL means "on enquiry", which is the honest state for
  -- most trades work and must stay expressible — a 0 would render "TTD $0".
  price_ttd INTEGER,
  -- Free text beside the price: "per session", "per room", "from". Not an enum:
  -- the range across beauty, trades, tutoring, and events is open-ended, and a
  -- wrong enum here blocks a professional from describing their own pricing.
  price_unit TEXT,

  duration_minutes INTEGER,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT offering_name_length CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  CONSTRAINT offering_price_non_negative CHECK (price_ttd IS NULL OR price_ttd >= 0),
  CONSTRAINT offering_duration_positive CHECK (
    duration_minutes IS NULL OR duration_minutes > 0
  ),
  CONSTRAINT offering_display_order_non_negative CHECK (display_order >= 0)
);

COMMENT ON TABLE public.offerings IS
  'Structured service offerings, keyed to professional_profiles. Replaces V1''s dual-owner offerings table and its duplicated policy set.';
COMMENT ON COLUMN public.offerings.price_ttd IS
  'Integer TTD. NULL means "on enquiry" — a distinct state from zero, which would render TTD $0.';
COMMENT ON COLUMN public.offerings.price_unit IS
  'Free text ("per session", "per room"). Not an enum: the range across categories is open-ended.';

CREATE INDEX offerings_professional_idx ON public.offerings (professional_id);
CREATE INDEX offerings_category_idx ON public.offerings (category_id);
-- The storefront's services section and the ProfessionalCard from-price both
-- read active offerings for one professional in display order.
CREATE INDEX offerings_professional_display_idx
  ON public.offerings (professional_id, display_order, created_at)
  WHERE is_active;
-- The public /offerings browse surface filters on category and sorts by price.
CREATE INDEX offerings_public_price_idx
  ON public.offerings (category_id, price_ttd)
  WHERE is_active;

CREATE TRIGGER offerings_updated_at
  BEFORE UPDATE ON public.offerings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offerings FORCE ROW LEVEL SECURITY;

-- anon gets SELECT: `/offerings` and `/offerings/[id]` are public browse
-- surfaces and part of the acquisition funnel.
GRANT SELECT ON public.offerings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.offerings TO authenticated;

-- Public reads active offerings belonging to active listings. Both conditions:
-- an active offering on a suspended listing must not survive the suspension.
CREATE POLICY offerings_select_public ON public.offerings
  FOR SELECT TO anon, authenticated
  USING (
    is_active
    AND EXISTS (
      SELECT 1 FROM public.professional_profiles p
      WHERE p.id = offerings.professional_id
        AND p.listing_status = 'active'
    )
  );

CREATE POLICY offerings_select_own ON public.offerings
  FOR SELECT TO authenticated
  USING (public.owns_professional_profile(professional_id));

CREATE POLICY offerings_select_admin ON public.offerings
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY offerings_insert_own ON public.offerings
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_professional_profile(professional_id));

CREATE POLICY offerings_update_own ON public.offerings
  FOR UPDATE TO authenticated
  USING (public.owns_professional_profile(professional_id))
  WITH CHECK (public.owns_professional_profile(professional_id));

-- Unlike listings and enquiries, a hard DELETE is right here: an offering is
-- catalogue content, not history. Nothing references it after removal, and a
-- professional who mistypes a service should not carry a tombstone for ever.
CREATE POLICY offerings_delete_own ON public.offerings
  FOR DELETE TO authenticated
  USING (public.owns_professional_profile(professional_id));

CREATE POLICY offerings_write_admin ON public.offerings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Column guard ────────────────────────────────────────────────────────────
-- Only one rule: an offering cannot be moved to another professional. Everything
-- else on this table is the professional's own content, which is exactly why
-- there is no long guard here — a guard that blocks nothing real gets ignored,
-- and then a real one gets ignored with it.

CREATE OR REPLACE FUNCTION public.guard_offering_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.professional_id IS DISTINCT FROM OLD.professional_id THEN
    RAISE EXCEPTION 'An offering cannot be reassigned to another professional.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER offerings_guard_owner
  BEFORE UPDATE ON public.offerings
  FOR EACH ROW EXECUTE FUNCTION public.guard_offering_owner();

COMMENT ON FUNCTION public.guard_offering_owner() IS
  'Blocks reassigning an offering. The UPDATE policy checks the OLD row''s owner; without this the WITH CHECK could be satisfied by moving the row to a profile you also own — or, with a second account, away from you.';
