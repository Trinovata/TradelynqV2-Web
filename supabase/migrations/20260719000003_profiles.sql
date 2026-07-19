-- ============================================================================
-- profiles — the central user record (playbook S030)
--
-- One row per auth.users row, created automatically by the handle_new_user
-- trigger. Everything else in the schema hangs off this table.
--
-- `professional_subtype` is first-class from day one. In V1 the worker/business
-- distinction lived in *which table you had a row in*, which meant every query
-- that cared had to check two places. Here the role and its subtype are on the
-- identity record, and the profile tables are detail.
-- ============================================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  email TEXT NOT NULL,
  full_name TEXT,
  phone_number TEXT,
  avatar_url TEXT,

  role user_role NOT NULL DEFAULT 'customer',

  -- Required when role = 'professional', meaningless otherwise. Enforced by the
  -- CHECK constraint below rather than by application code, because four
  -- different clients write to this table.
  professional_subtype professional_subtype,

  -- False until the user completes /auth/select-role. Middleware routes anyone
  -- with role_confirmed = false to the selection screen regardless of role, so
  -- the DEFAULT above is a placeholder, never an assumption about the person.
  role_confirmed BOOLEAN NOT NULL DEFAULT FALSE,

  account_status account_status NOT NULL DEFAULT 'active',
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified BOOLEAN NOT NULL DEFAULT FALSE,

  -- Role grace period: 72 hours, at most 2 changes. Both facts live here so the
  -- rule is enforceable in one query rather than reconstructed from an audit log.
  role_selected_at TIMESTAMPTZ,
  role_change_count INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A professional must declare a subtype; nobody else may have one. This is
  -- what makes "which profile table does this user own" answerable from the
  -- identity row alone.
  CONSTRAINT professional_subtype_required_for_professionals CHECK (
    (role = 'professional' AND professional_subtype IS NOT NULL)
    OR (role <> 'professional' AND professional_subtype IS NULL)
  ),

  CONSTRAINT role_change_count_bounded CHECK (role_change_count >= 0)
);

COMMENT ON TABLE public.profiles IS
  'Central user record, 1:1 with auth.users. Role and subtype answer "who is this" without a table lookup.';
COMMENT ON COLUMN public.profiles.professional_subtype IS
  'Required iff role = professional. Determines profile table, verification track, and crossover billing path.';
COMMENT ON COLUMN public.profiles.role_confirmed IS
  'False until /auth/select-role completes. The role DEFAULT is a placeholder, not an assumption.';

CREATE INDEX profiles_role_idx ON public.profiles (role) WHERE account_status = 'active';
CREATE INDEX profiles_email_idx ON public.profiles (lower(email));
CREATE INDEX profiles_account_status_idx ON public.profiles (account_status)
  WHERE account_status <> 'active';

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Row Level Security ──────────────────────────────────────────────────────
-- ENABLE makes policies apply. FORCE makes them apply to the table owner too,
-- so a mistake in a SECURITY DEFINER function cannot quietly read everything.
-- The service-role key still bypasses (it holds BYPASSRLS) — that is the
-- intended escape hatch for admin and cron paths, and why admin.ts is
-- server-only.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Base table privileges. RLS narrows what a role may reach; it does not grant
-- the right to reach anything in the first place. Without these GRANTs every
-- policy below is unreachable and the application cannot read its own users.
--
-- These two layers fail in ways that look identical — a missing GRANT raises
-- "permission denied for table", which is SQLSTATE 42501, the same
-- insufficient_privilege that the column guard raises deliberately. That is a
-- genuine trap: a policy test can pass because the user was blocked by a
-- MISSING grant rather than by the intended guard. The policy suite therefore
-- asserts on message text, not just SQLSTATE.
--
-- No INSERT or DELETE for authenticated: rows are created by handle_new_user
-- and removed only by cascade from auth.users.
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- anon gets nothing. Public professional data is served from the professional
-- profile tables and their views, never from the identity record.

-- Helper: is the caller an admin? Written as a function so the check is defined
-- once. SECURITY DEFINER because it must read profiles to answer, and the
-- caller's own RLS policy is what we are in the middle of evaluating —
-- recursing into it would be circular.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND account_status = 'active'
  );
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'Admin check for RLS policies. SECURITY DEFINER to avoid recursing into the policy being evaluated.';

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- No INSERT policy by design: rows are created solely by handle_new_user on
-- signup. A user cannot manufacture a profile for an id that has no auth record.
--
-- No DELETE policy by design: deletion cascades from auth.users. Accounts are
-- closed by setting account_status, never by removing the row — enquiries,
-- reviews, invoices, and audit entries all reference it.

-- ── Privilege escalation guard ──────────────────────────────────────────────
-- The UPDATE policy above lets a user edit their own row. That is correct for
-- full_name and avatar_url, and catastrophic for `role`: without this trigger a
-- user could set their own role to 'admin' with a single PATCH.
--
-- RLS governs WHICH ROWS you may touch, never WHICH COLUMNS, so the column-level
-- rule has to be a trigger.

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Admins and service-role callers legitimately change these. auth.uid() is
  -- NULL for the service role, which is how a cron job or admin route is
  -- distinguished from a browser session.
  IF (SELECT auth.uid()) IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Role cannot be changed directly. Use the assign-role endpoint.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
    RAISE EXCEPTION 'Account status is set by administrators only.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.role_change_count IS DISTINCT FROM OLD.role_change_count
     OR NEW.role_selected_at IS DISTINCT FROM OLD.role_selected_at THEN
    RAISE EXCEPTION 'Role grace-period fields are maintained by the platform.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Verification flags are set by the platform after it verifies something.
  IF NEW.email_verified IS DISTINCT FROM OLD.email_verified
     OR NEW.phone_verified IS DISTINCT FROM OLD.phone_verified THEN
    RAISE EXCEPTION 'Verification flags are set by the platform.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_guard_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

COMMENT ON FUNCTION public.guard_profile_privileged_columns() IS
  'Blocks self-service edits to role, account_status, grace fields, and verification flags. RLS cannot express column-level rules.';

-- ── Signup trigger ──────────────────────────────────────────────────────────
-- Creates the profile row when Supabase Auth creates a user.
--
-- HARDENING (the reason this is written the way it is):
--
--   SECURITY DEFINER is unavoidable — the trigger runs as the anonymous signup
--   caller, who has no rights on public.profiles. But a SECURITY DEFINER
--   function with a mutable search_path is a privilege-escalation primitive: an
--   attacker who can create objects in a schema earlier on the path can shadow
--   a table or function name and have it execute with the definer's rights.
--
--   Mitigations, all three required:
--     1. `SET search_path = ''` — nothing resolves implicitly.
--     2. Every identifier fully qualified (public.profiles, not profiles).
--     3. Inputs come from auth.users columns and are inserted as parameters,
--        never concatenated into SQL.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, email_verified)
  VALUES (
    NEW.id,
    NEW.email,
    -- Google OAuth supplies 'full_name'; other providers use 'name'. Neither is
    -- guaranteed, and a NULL name is fine — onboarding collects it properly.
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name'
    ),
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.email_confirmed_at IS NOT NULL
  )
  -- Supabase can re-fire this on identity linking (e.g. the same address
  -- signing in with Google after an email signup). The profile already exists
  -- and must not be overwritten with sparser OAuth metadata.
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates the profile row on signup. SECURITY DEFINER with pinned empty search_path and fully-qualified identifiers.';

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
