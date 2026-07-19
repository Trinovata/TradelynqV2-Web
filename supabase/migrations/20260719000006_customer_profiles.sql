-- ============================================================================
-- customer_profiles — the customer side (playbook S031)
--
-- V1's `homeowner_profiles`, renamed. "Homeowner" is a leftover from the
-- trades-only origin and misdescribes most of the marketplace: someone booking
-- a makeup artist, a tutor, or a photographer is not transacting as a homeowner.
--
-- Holds the connection gate and the KYC package. Both are trust machinery, so
-- both are guarded against self-service edits.
-- ============================================================================

CREATE TABLE public.customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,

  area TEXT,
  contact_preference contact_preference NOT NULL DEFAULT 'whatsapp',

  -- ── The connection gate ───────────────────────────────────────────────────
  -- Two free professional contacts, then identity verification. Maintained by
  -- trigger from the connections table so it cannot drift from reality — and
  -- guarded below, because a customer who could edit this counter would walk
  -- straight through the gate.
  connection_count INTEGER NOT NULL DEFAULT 0,

  -- ── KYC package ───────────────────────────────────────────────────────────
  -- Storage paths under kyc/{userId}/, never public URLs. The bucket is private
  -- and access is by short-lived signed URL, issued to admins and audited.
  kyc_status customer_kyc_status NOT NULL DEFAULT 'not_required',
  id_document_1_url TEXT,
  id_document_2_url TEXT,
  selfie_url TEXT,
  date_of_birth DATE,
  verified_address TEXT,
  kyc_submitted_at TIMESTAMPTZ,
  kyc_verified_at TIMESTAMPTZ,
  kyc_verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  kyc_rejection_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT customer_connection_count_non_negative CHECK (connection_count >= 0),
  -- A verified KYC record must record WHEN it was verified.
  --
  -- Deliberately requires `kyc_verified_at` only, NOT `kyc_verified_by`. An
  -- earlier version required both, which was a real bug found by testing account
  -- deletion: `kyc_verified_by` is ON DELETE SET NULL, so closing a former
  -- admin's account violated this constraint on every customer they had ever
  -- verified. The deletion failed outright and the admin became undeletable —
  -- which is also a data-protection problem, since a person who cannot be
  -- deleted cannot exercise erasure.
  --
  -- Attribution degrades to NULL here; the durable record of WHO decided lives
  -- in admin_audit_log, which is append-only and holds no FK to profiles.
  CONSTRAINT customer_kyc_verified_is_attributable CHECK (
    kyc_status <> 'verified' OR kyc_verified_at IS NOT NULL
  ),
  CONSTRAINT customer_kyc_rejection_has_reason CHECK (
    kyc_status <> 'rejected' OR kyc_rejection_reason IS NOT NULL
  )
);

COMMENT ON TABLE public.customer_profiles IS
  'Customer-side profile. V1 homeowner_profiles renamed — "homeowner" misdescribes most of the marketplace.';
COMMENT ON COLUMN public.customer_profiles.connection_count IS
  'Trigger-maintained from connections. Guarded: a self-editable counter defeats the gate.';
COMMENT ON COLUMN public.customer_profiles.id_document_1_url IS
  'Storage path under kyc/{userId}/, never a public URL. Bucket is private; access is by audited signed URL.';

CREATE INDEX customer_profiles_user_id_idx ON public.customer_profiles (user_id);
-- Partial: the admin KYC queue only ever reads rows awaiting a decision.
CREATE INDEX customer_profiles_kyc_queue_idx ON public.customer_profiles (kyc_submitted_at)
  WHERE kyc_status IN ('pending', 'submitted');
-- ON DELETE SET NULL: removing an admin profile scans every customer without this.
CREATE INDEX customer_profiles_kyc_verified_by_idx ON public.customer_profiles (kyc_verified_by)
  WHERE kyc_verified_by IS NOT NULL;

CREATE TRIGGER customer_profiles_updated_at
  BEFORE UPDATE ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Nothing here is public. A customer profile carries identity documents, date
-- of birth, and address; there is no anonymous read path at all.

ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_profiles FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.customer_profiles TO authenticated;

CREATE POLICY customer_profiles_select_own ON public.customer_profiles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY customer_profiles_select_admin ON public.customer_profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY customer_profiles_insert_own ON public.customer_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY customer_profiles_update_own ON public.customer_profiles
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY customer_profiles_update_admin ON public.customer_profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Column guard ────────────────────────────────────────────────────────────

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

CREATE TRIGGER customer_profiles_guard_privileged_columns
  BEFORE UPDATE ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_customer_privileged_columns();

COMMENT ON FUNCTION public.guard_customer_privileged_columns() IS
  'Blocks self-editing the connection counter and self-approving KYC.';
