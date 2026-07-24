-- ============================================================================
-- professional_subtypes() — the public read behind the storefront "track" badge
--
-- ## The problem
--
-- Public cards and storefronts show a professional's track (Student /
-- Sole trader / Registered business), derived from profiles.professional_subtype.
-- But profiles' SELECT policy is `id = auth.uid()`, so anon and other-user reads
-- return nothing — the join in decorateCards silently came back empty and EVERY
-- public card fell back to 'sole_trader'. The badge was decorative noise, never
-- the truth.
--
-- ## The fix
--
-- A SECURITY DEFINER function that returns the subtype for the requested users,
-- but ONLY for professionals who have an ACTIVE public listing — i.e. exactly the
-- people whose storefront already displays this badge. It therefore reveals
-- nothing that is not already public, while letting anon read the one field the
-- profiles policy hides. search_path pinned, PUBLIC execute revoked, granted to
-- anon + authenticated (a public storefront renders for signed-out visitors).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.professional_subtypes(p_user_ids UUID[])
RETURNS TABLE (user_id UUID, professional_subtype public.professional_subtype)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.professional_subtype
  FROM public.profiles p
  WHERE p.id = ANY (p_user_ids)
    AND EXISTS (
      SELECT 1 FROM public.professional_profiles pp
      WHERE pp.user_id = p.id
        AND pp.listing_status = 'active'
    );
$$;

COMMENT ON FUNCTION public.professional_subtypes(UUID[]) IS
  'The business track (subtype) for the given users, but only for professionals with an ACTIVE public listing — so it exposes nothing beyond the public storefront. Backs the public "track" badge that profiles'' RLS would otherwise hide.';

REVOKE ALL ON FUNCTION public.professional_subtypes(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.professional_subtypes(UUID[]) TO anon, authenticated;
