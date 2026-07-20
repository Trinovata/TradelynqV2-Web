-- ============================================================================
-- Admin RBAC, Enterprise webhooks, registration cases (playbook S043)
-- Spec: details/admin-permissions.md §3–§4
-- ============================================================================

-- ============================================================================
-- admin_roles — capability-based admin permissions
-- ============================================================================
--
-- `profiles.role = 'admin'` is the coarse gate; this table refines it.
--
-- THE FAIL-CLOSED RULE: an admin **without** a row here has ZERO capabilities.
-- Not "all", not "the defaults" — zero. Someone promoted to admin gains nothing
-- until an owner grants it explicitly, so a mistaken promotion is inert rather
-- than catastrophic.
--
-- Owners ignore `grants` entirely (implicit `*`). Employees hold an array of
-- dot-path capability keys, where wildcards are GRANT-side only: a grant may say
-- `queue.*`, but a check always tests a concrete key like
-- `queue.approvals.decide`. That asymmetry is deliberate — a wildcard in a check
-- would silently widen as new capabilities are added.

CREATE TABLE public.admin_roles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  level TEXT NOT NULL,

  -- Array of capability keys, e.g. ["queue.approvals.*", "money.view"].
  -- Ignored entirely when level = 'owner'.
  grants JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Who granted this. ON DELETE SET NULL, and therefore NOT required — the
  -- departing-admin trap. Durable attribution lives in admin_audit_log.
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT admin_level_valid CHECK (level IN ('owner', 'employee')),
  CONSTRAINT admin_grants_is_array CHECK (jsonb_typeof(grants) = 'array')
);

COMMENT ON TABLE public.admin_roles IS
  'Capability grants per admin. An admin with NO row here has zero capabilities — fail-closed by design.';
COMMENT ON COLUMN public.admin_roles.grants IS
  'Capability keys. Wildcards permitted here (grant side) but never in a check — a wildcard check would widen silently as capabilities are added.';

CREATE INDEX admin_roles_level_idx ON public.admin_roles (level);
CREATE INDEX admin_roles_granted_by_idx ON public.admin_roles (granted_by)
  WHERE granted_by IS NOT NULL;

CREATE TRIGGER admin_roles_updated_at
  BEFORE UPDATE ON public.admin_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.admin_roles TO authenticated;

-- ── Capability checking ─────────────────────────────────────────────────────
--
-- Defined BEFORE the policies that call them, and after the table they read.
-- That ordering is forced and slightly awkward: the policy needs the function,
-- the function needs the table, so the table cannot carry its policies inline.

/**
 * Is the caller an owner-level admin?
 *
 * SECURITY DEFINER because it reads admin_roles while that table's own policy is
 * being evaluated — recursing into the policy under evaluation is circular.
 */
CREATE OR REPLACE FUNCTION public.is_owner_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.admin_roles r
      JOIN public.profiles p ON p.id = r.user_id
     WHERE r.user_id = (SELECT auth.uid())
       AND r.level = 'owner'
       AND p.role = 'admin'
       AND p.account_status = 'active'
  );
$$;

COMMENT ON FUNCTION public.is_owner_admin() IS
  'Owner-level check. Verifies profiles.role = admin too — an admin_roles row alone is not authority.';

/**
 * Does a grants array satisfy a concrete capability key?
 *
 * Matching rules:
 *   `*`                    matches everything
 *   `queue.*`              matches `queue.approvals.decide`
 *   `queue.approvals.*`    matches `queue.approvals.decide`
 *   `queue.approvals.decide` matches only itself
 *
 * The check key must be concrete. Passing a wildcard AS the key would invert the
 * asymmetry and let `queue.*` satisfy itself trivially.
 */
CREATE OR REPLACE FUNCTION public.matches_grants(
  capability_key TEXT,
  grants JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  grant_key TEXT;
  prefix TEXT;
BEGIN
  -- A wildcard as the CHECK key is a programming error, not a permissive case.
  IF capability_key LIKE '%*%' THEN
    RAISE EXCEPTION 'Capability checks must use a concrete key, got: %', capability_key
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  FOR grant_key IN SELECT jsonb_array_elements_text(grants) LOOP
    IF grant_key = '*' THEN
      RETURN TRUE;
    END IF;

    IF grant_key = capability_key THEN
      RETURN TRUE;
    END IF;

    IF grant_key LIKE '%.*' THEN
      prefix := left(grant_key, length(grant_key) - 1);  -- 'queue.*' -> 'queue.'
      IF capability_key LIKE prefix || '%' THEN
        RETURN TRUE;
      END IF;
    END IF;
  END LOOP;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.matches_grants(TEXT, JSONB) IS
  'Wildcard-aware grant matching. Raises if given a wildcard as the check key — that asymmetry is the whole safety property.';

/**
 * The full capability check: session, admin role, and the grant.
 *
 * Mirrors requireAdminCapability() in the API layer so the same answer is
 * reachable from a policy as from a route handler.
 */
CREATE OR REPLACE FUNCTION public.has_admin_capability(capability_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  role_row public.admin_roles%ROWTYPE;
  -- Types need schema qualification too under `SET search_path = ''` — an
  -- unqualified `user_role` here fails with "type does not exist", which is the
  -- same protection that makes the pinned search_path worth having.
  profile_role public.user_role;
  profile_status public.account_status;
BEGIN
  SELECT role, account_status INTO profile_role, profile_status
    FROM public.profiles WHERE id = (SELECT auth.uid());

  IF profile_role IS DISTINCT FROM 'admin' OR profile_status IS DISTINCT FROM 'active' THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO role_row FROM public.admin_roles WHERE user_id = (SELECT auth.uid());

  -- No row = no capabilities. The fail-closed rule.
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF role_row.level = 'owner' THEN
    RETURN TRUE;
  END IF;

  RETURN public.matches_grants(capability_key, role_row.grants);
END;
$$;

COMMENT ON FUNCTION public.has_admin_capability(TEXT) IS
  'Session + admin role + grant. An admin with no admin_roles row gets FALSE for everything.';

-- ── admin_roles policies (now that is_owner_admin exists) ───────────────────

-- An employee may read their own row — the admin shell needs it to render only
-- granted navigation. That is UX; the server check is the security boundary.
CREATE POLICY admin_roles_select_own ON public.admin_roles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Owners see and manage everyone.
CREATE POLICY admin_roles_owner_all ON public.admin_roles
  FOR ALL TO authenticated
  USING (public.is_owner_admin())
  WITH CHECK (public.is_owner_admin());

-- ── Grant presets ───────────────────────────────────────────────────────────
-- Seedable profiles from the spec, so granting a new hire is picking a preset
-- rather than hand-assembling capability keys and getting one wrong.

CREATE TABLE public.admin_grant_presets (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  grants JSONB NOT NULL,

  CONSTRAINT preset_grants_is_array CHECK (jsonb_typeof(grants) = 'array')
);

COMMENT ON TABLE public.admin_grant_presets IS
  'Seedable grant profiles. Picking a preset is less error-prone than hand-assembling capability keys.';

ALTER TABLE public.admin_grant_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_grant_presets FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.admin_grant_presets TO authenticated;

CREATE POLICY admin_presets_owner_read ON public.admin_grant_presets
  FOR SELECT TO authenticated
  USING (public.is_owner_admin());

INSERT INTO public.admin_grant_presets (slug, name, description, grants) VALUES
  ('moderation', 'Moderation hire',
   'Approvals, reviews, and orders. No money surfaces.',
   '["queue.approvals.*","queue.reviews.*","queue.orders.*","directory.users.view","analytics.account360.view"]'::jsonb),
  ('ops_generalist', 'Ops generalist',
   'All queues plus directory mutations and platform analytics. No money surfaces.',
   '["queue.*","directory.users.view","directory.users.mutate","ads.view","analytics.platform.view","analytics.account360.view"]'::jsonb),
  ('finance', 'Finance',
   'Money surfaces, manual payments, subscription overrides.',
   '["money.view","money.manual_payment","money.subscription_override","analytics.account360.view","analytics.account360.money","analytics.platform.view","directory.users.view"]'::jsonb);

-- NOTE: the first owner is NOT seeded here. Seeding an owner requires a real
-- auth.users id, which does not exist until someone signs up on the target
-- environment. Hardcoding a UUID would create a dangling row on every fresh
-- database and, worse, an owner grant pointing at nobody.
--
-- Bootstrap instead with scripts/seed-dev.ts locally, or a one-time SQL insert
-- against production after the first admin signs up. Playbook S154 covers it as
-- an explicit launch step.

-- ============================================================================
-- webhook_configs — Enterprise outbound webhooks
-- ============================================================================

CREATE TABLE public.webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,

  url TEXT NOT NULL,

  -- Encrypted at rest with WEBHOOK_SECRET_KEY. Shown to the user exactly ONCE,
  -- at creation — thereafter it can only be rotated, never revealed, because a
  -- retrievable signing secret is a shared secret with everyone who has ever had
  -- database read access.
  secret_encrypted TEXT NOT NULL,

  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Auto-disable after 5 consecutive failures. A dead endpoint that is retried
  -- forever is a slow denial of service against our own dispatcher.
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  disabled_at TIMESTAMPTZ,
  disabled_reason TEXT,

  last_success_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- HTTPS only. A signed payload over plaintext HTTP is still readable by
  -- anyone on the path, and these carry customer contact details.
  CONSTRAINT webhook_url_is_https CHECK (url ~ '^https://'),
  CONSTRAINT webhook_failures_non_negative CHECK (consecutive_failures >= 0),
  CONSTRAINT webhook_disabled_has_reason CHECK (
    disabled_at IS NULL OR disabled_reason IS NOT NULL
  ),
  CONSTRAINT webhook_has_events CHECK (array_length(events, 1) > 0)
);

COMMENT ON TABLE public.webhook_configs IS
  'Enterprise outbound webhooks. Secret is encrypted and shown once — a retrievable signing secret is shared with everyone who has ever had DB read access.';

CREATE INDEX webhook_configs_professional_idx ON public.webhook_configs (professional_id);
CREATE INDEX webhook_configs_active_idx ON public.webhook_configs (professional_id)
  WHERE is_active = TRUE AND disabled_at IS NULL;

CREATE TRIGGER webhook_configs_updated_at
  BEFORE UPDATE ON public.webhook_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_configs FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_configs TO authenticated;

CREATE POLICY webhook_configs_own ON public.webhook_configs
  FOR ALL TO authenticated
  USING (public.owns_professional_profile(professional_id))
  WITH CHECK (public.owns_professional_profile(professional_id));

CREATE POLICY webhook_configs_admin_read ON public.webhook_configs
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- The owner must not be able to clear their own failure counter and defeat the
-- auto-disable, nor un-disable an endpoint the platform switched off.
CREATE OR REPLACE FUNCTION public.guard_webhook_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR public.is_admin() OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.consecutive_failures IS DISTINCT FROM OLD.consecutive_failures
     OR NEW.last_success_at IS DISTINCT FROM OLD.last_success_at THEN
    RAISE EXCEPTION 'Webhook delivery statistics are maintained by the platform.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Re-enabling is allowed — that is how an owner fixes their endpoint and
  -- resumes — but only by clearing BOTH fields together, so the row cannot end
  -- up disabled with no reason recorded.
  IF OLD.disabled_at IS NOT NULL AND NEW.disabled_at IS NULL
     AND NEW.disabled_reason IS NOT NULL THEN
    RAISE EXCEPTION 'Clear the disabled reason when re-enabling a webhook.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER webhook_configs_guard
  BEFORE UPDATE ON public.webhook_configs
  FOR EACH ROW EXECUTE FUNCTION public.guard_webhook_privileged_columns();

-- ── Delivery log ────────────────────────────────────────────────────────────

CREATE TABLE public.webhook_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_config_id UUID NOT NULL
    REFERENCES public.webhook_configs(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL,
  status_code INTEGER,
  succeeded BOOLEAN NOT NULL DEFAULT FALSE,
  attempt INTEGER NOT NULL DEFAULT 1,
  duration_ms INTEGER,
  error TEXT,

  -- Truncated. The full payload can contain customer contact details, and a
  -- delivery log is not a place to accumulate a second copy of them.
  response_excerpt TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT webhook_attempt_positive CHECK (attempt >= 1)
);

COMMENT ON TABLE public.webhook_delivery_log IS
  'Per-attempt delivery record. Response bodies are truncated — this is a log, not a second copy of customer data.';

CREATE INDEX webhook_delivery_config_idx
  ON public.webhook_delivery_log (webhook_config_id, created_at DESC);
CREATE INDEX webhook_delivery_failures_idx
  ON public.webhook_delivery_log (webhook_config_id)
  WHERE succeeded = FALSE;

ALTER TABLE public.webhook_delivery_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_delivery_log FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.webhook_delivery_log TO authenticated;

CREATE POLICY webhook_delivery_select_own ON public.webhook_delivery_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.webhook_configs w
       WHERE w.id = webhook_delivery_log.webhook_config_id
         AND public.owns_professional_profile(w.professional_id)
    )
  );

CREATE POLICY webhook_delivery_admin_read ON public.webhook_delivery_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- registration_cases — the business registration service
-- ============================================================================

CREATE TABLE public.registration_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'intake',
  track TEXT NOT NULL DEFAULT 'assisted',

  proposed_business_name TEXT,
  -- Alternatives, in preference order. Name rejection is the most common cause
  -- of a stalled registration, so collecting fallbacks upfront saves a round trip.
  alternate_names TEXT[] NOT NULL DEFAULT '{}',

  fee_ttd NUMERIC(10, 2),
  paid_at TIMESTAMPTZ,

  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  registration_number TEXT,

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT registration_status_valid CHECK (
    status IN ('intake', 'awaiting_payment', 'in_progress', 'submitted', 'completed', 'cancelled')
  ),
  CONSTRAINT registration_track_valid CHECK (track IN ('diy', 'assisted', 'full_service')),
  CONSTRAINT registration_completed_has_number CHECK (
    status <> 'completed' OR registration_number IS NOT NULL
  )
);

COMMENT ON TABLE public.registration_cases IS
  'Business registration service cases. Completing a case is what moves a sole trader onto the registered crossover rate.';

CREATE INDEX registration_cases_user_idx ON public.registration_cases (user_id);
CREATE INDEX registration_cases_open_idx ON public.registration_cases (created_at)
  WHERE status NOT IN ('completed', 'cancelled');

CREATE TRIGGER registration_cases_updated_at
  BEFORE UPDATE ON public.registration_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.registration_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_cases FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.registration_cases TO authenticated;

CREATE POLICY registration_cases_select_own ON public.registration_cases
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY registration_cases_insert_own ON public.registration_cases
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY registration_cases_admin_all ON public.registration_cases
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- No self-UPDATE grant at all: once a case is open, every subsequent state
-- change is the platform's. A customer editing their own case status could mark
-- it completed and claim the registered crossover rate without registering.
