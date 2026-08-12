-- ============================================================================
-- professional_enquiry_inbox — the read primitive behind /enquiries
--
-- ## The problem this solves
--
-- A professional owns their `job_enquiries` rows (RLS: `owns_professional_profile`),
-- so they can read the enquiry itself. But the enquiring customer's NAME lives on
-- `public.profiles`, whose SELECT policy is `id = auth.uid()` — a professional can
-- never read another person's profile row. A naïve `job_enquiries → profiles`
-- join therefore returns a null name under RLS, and the inbox has no one to show.
--
-- The design deliberately reveals ONE field pre-acceptance: the customer's first
-- name (copy deck 05 §5.1 shows `{first_name}` on New/pending rows). Full contact
-- — phone, email, surname — stays gated behind acceptance and the `connections`
-- ledger, and is NOT exposed here. So this function is the minimum reveal: the
-- owning professional's own enquiries, each carrying only the customer's first
-- name in addition to the enquiry's own columns.
--
-- SECURITY DEFINER because it must read `profiles`, which the caller cannot. It
-- is safe because it takes no caller-supplied identity: the row set is fixed by
-- `owns_professional_profile(auth.uid())`, so the worst a caller can do is read
-- their own inbox. search_path is pinned empty and every identifier fully
-- qualified, per the SECURITY DEFINER discipline the schema-invariant suite
-- enforces.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.professional_enquiry_inbox()
RETURNS TABLE (
  id UUID,
  status public.enquiry_status,
  source public.job_source,
  description TEXT,
  preferred_date DATE,
  contact_preference public.contact_preference,
  created_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  category_id UUID,
  agreed_price_ttd NUMERIC,
  agreed_timeline TEXT,
  scope_note TEXT,
  professional_notes TEXT,
  declined_reason TEXT,
  customer_first_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    e.id,
    e.status,
    e.source,
    e.description,
    e.preferred_date,
    e.contact_preference,
    e.created_at,
    e.accepted_at,
    e.completed_at,
    e.category_id,
    e.agreed_price_ttd,
    e.agreed_timeline,
    e.scope_note,
    e.professional_notes,
    e.declined_reason,
    -- First token of the display name only. NULL when the customer has no name
    -- set, so the UI can fall back rather than render an empty string.
    NULLIF(split_part(COALESCE(p.full_name, ''), ' ', 1), '') AS customer_first_name
  FROM public.job_enquiries e
  JOIN public.profiles p ON p.id = e.customer_id
  WHERE public.owns_professional_profile(e.professional_id)
  ORDER BY e.created_at DESC;
$$;

COMMENT ON FUNCTION public.professional_enquiry_inbox() IS
  'The calling professional''s enquiries, each with the customer''s FIRST NAME only. SECURITY DEFINER so it can read profiles (which the professional cannot); row set fixed by owns_professional_profile, so it reveals nothing beyond the caller''s own inbox. Full contact stays gated behind acceptance.';

-- Postgres grants EXECUTE to PUBLIC by default; that would make anon a caller.
-- Revoke it and name the one role that may call this. (No anon: an enquiry inbox
-- is meaningless without a professional identity, and PUBLIC execute on a
-- SECURITY DEFINER function is exactly what the invariant suite forbids.)
REVOKE ALL ON FUNCTION public.professional_enquiry_inbox() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.professional_enquiry_inbox() TO authenticated;
