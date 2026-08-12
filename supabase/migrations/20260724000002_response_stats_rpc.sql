-- ============================================================================
-- professional_response_stats — the RP2 aggregate (playbook S081, D57/RP2,
-- v2/17 §RP2: "usually responds in ~2h" on storefronts).
--
-- job_enquiries is RLS-private (participants only), but the response-time
-- surface is a PUBLIC trust signal. A SECURITY DEFINER aggregate is the
-- narrowest possible bridge: it returns exactly two numbers — a median and a
-- sample size — never a row, a customer, or a timestamp. The 90-day window
-- keeps the signal current (a professional who got faster is not haunted by
-- their slow first month), and only accepted enquiries count: acceptance is
-- the first professional-visible response we record today. Swap the basis to
-- `enquiry_viewed_by_pro` when that event lands (v2/17 names it) — the
-- function signature will not need to change.
--
-- Hardening per the house SECURITY DEFINER rules (S030): search_path pinned
-- empty, identifiers fully qualified, EXECUTE revoked from PUBLIC before the
-- explicit grants — new functions are PUBLIC-executable by default, and a
-- bare GRANT adds nothing.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.professional_response_stats(p_professional_id UUID)
RETURNS TABLE (median_minutes NUMERIC, sample INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    percentile_cont(0.5) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (e.accepted_at - e.created_at)) / 60.0
    ) AS median_minutes,
    COUNT(*)::INTEGER AS sample
  FROM public.job_enquiries e
  WHERE e.professional_id = p_professional_id
    AND e.accepted_at IS NOT NULL
    AND e.accepted_at > e.created_at
    AND e.created_at > NOW() - INTERVAL '90 days';
$$;

REVOKE ALL ON FUNCTION public.professional_response_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.professional_response_stats(UUID) TO anon, authenticated;

COMMENT ON FUNCTION public.professional_response_stats(UUID) IS
  'RP2 storefront chip. Aggregate-only bridge over RLS-private enquiries: median accepted-response minutes + sample count, 90-day window. Render the chip only when sample >= 5.';
