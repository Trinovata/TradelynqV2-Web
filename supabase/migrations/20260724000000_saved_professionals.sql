-- ============================================================================
-- saved_professionals — the customer's shortlist (playbook S084)
--
-- Pack api-marketplace.md §7: "POST /api/homeowners/saved-workers → 200
-- { saved: true, count: 3 } (toggle semantics)". V2 vocabulary supersedes the
-- pack's V1 naming (worker → professional, homeowner → customer), following
-- the precedent logged on POST /api/connections (S083).
--
-- The row's existence IS the saved state. Toggle = insert / delete; there is
-- no update path, so there is no updated_at and no UPDATE grant — mirroring
-- `connections` (20260719000007), whose unique-pair pattern this table copies.
--
-- No denormalised counter: the response's `count` is computed per-request
-- (SELECT COUNT of the customer's rows), matching the "recount, not increment"
-- doctrine at zero cost — a shortlist is a handful of rows.
--
-- PRIVACY DECISION (S084 flag F2): the professional does NOT get a
-- "who saved me" policy. Unlike `connections` — their lead list, explicitly
-- granted in 20260719000007 — no spec grants save visibility to the
-- professional. A save is the customer's private bookmark. Reversible later by
-- adding one SELECT policy.
-- ============================================================================

CREATE TABLE public.saved_professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,

  -- No updated_at: no update path (toggle = insert/delete), so a column
  -- tracking updates would be permanently equal to created_at.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Toggle semantics: saving twice is the unique violation the API turns into
  -- the delete half of the toggle. Enforced here so a race cannot double-save.
  CONSTRAINT saved_professionals_unique_pair UNIQUE (customer_id, professional_id)
);

COMMENT ON TABLE public.saved_professionals IS
  'Customer''s saved-professionals shortlist. Row existence IS the saved state; toggle = insert/delete. Private to the customer (S084 flag F2: no professional visibility).';

-- The /saved list reads the customer's rows newest-first; the leading
-- customer_id column also serves as the FK index (aaa invariant 6).
CREATE INDEX saved_professionals_customer_idx
  ON public.saved_professionals (customer_id, created_at DESC);
-- FK index for the professional-profile delete cascade path.
CREATE INDEX saved_professionals_professional_idx
  ON public.saved_professionals (professional_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.saved_professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_professionals FORCE ROW LEVEL SECURITY;

-- Start from zero: harden_grants (20260719999999) altered default privileges,
-- but Supabase's bootstrap defaults may still grant more than this table
-- wants. The grant set below is the whole contract.
REVOKE ALL ON public.saved_professionals FROM anon, authenticated;

-- No anon: a shortlist reveals who a customer is considering hiring.
-- No UPDATE: there is no update path — the per-command reachability check in
-- aaa_schema_invariants.sql demands grants match policies exactly, and no
-- UPDATE policy exists to match one.
GRANT SELECT, INSERT, DELETE ON public.saved_professionals TO authenticated;

CREATE POLICY saved_select_own ON public.saved_professionals
  FOR SELECT TO authenticated
  USING (customer_id = (SELECT auth.uid()));

CREATE POLICY saved_select_admin ON public.saved_professionals
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Only for themselves: a saved row names the customer, so a forged one would
-- plant entries in someone else's list.
CREATE POLICY saved_insert_own ON public.saved_professionals
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = (SELECT auth.uid()));

-- The customer un-saves their own; admins may clean up (support).
CREATE POLICY saved_delete_own ON public.saved_professionals
  FOR DELETE TO authenticated
  USING (customer_id = (SELECT auth.uid()) OR public.is_admin());
