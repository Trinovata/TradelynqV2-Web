-- ============================================================================
-- Revoke dangerous default grants (SECURITY — runs last, deliberately)
--
-- ## What this fixes
--
-- Supabase's bootstrap grants broad table privileges to `anon`, `authenticated`,
-- and `service_role` in the public schema. Among them are three that no client
-- role should ever hold:
--
--   TRUNCATE   — **CRITICAL. Row Level Security does not apply to TRUNCATE.**
--                Verified empirically on this schema: an anonymous, entirely
--                unauthenticated caller could `TRUNCATE public.customer_profiles
--                CASCADE` and destroy every row, with every policy in place and
--                RLS both ENABLED and FORCED. Policies govern SELECT, INSERT,
--                UPDATE, and DELETE. TRUNCATE is none of those — it is a DDL-ish
--                table-level operation and goes straight through.
--
--   TRIGGER    — lets a client attach a trigger to a platform table. The column
--                guards bypass at `pg_trigger_depth() > 1` so the platform's own
--                triggers can maintain derived columns; that bypass is only safe
--                while clients cannot reach trigger depth. TRIGGER privilege is
--                exactly the reachability they must not have.
--
--   REFERENCES — lets a client add foreign keys to platform tables, which can
--                block deletes and leak row existence through FK violations.
--
-- ## Why this file is numbered to run LAST
--
-- REVOKE only affects tables that already exist. Numbered 999999 so it applies
-- after every table in every earlier migration, whenever one is added. The
-- ALTER DEFAULT PRIVILEGES statements below then cover tables created later.
--
-- Both halves are required: the REVOKE fixes today, the DEFAULT PRIVILEGES fix
-- tomorrow. Neither alone is sufficient.
--
-- The schema-invariant suite asserts this stays true, so a future migration that
-- re-grants (or a Supabase upgrade that re-applies its defaults) fails CI rather
-- than silently reopening the hole.
-- ============================================================================

-- ── Existing tables ─────────────────────────────────────────────────────────
--
-- SECURITY FIX (20 Jul 2026): this file originally scoped every statement to
-- `IN SCHEMA public`, which left `storage.objects`, `storage.buckets`, and
-- `supabase_functions.hooks` with full anon DML **including TRUNCATE**. An
-- adversarial test confirmed `SET ROLE anon; TRUNCATE storage.objects CASCADE;`
-- wiped every row — destroying every uploaded portfolio image and every KYC
-- document reference on the platform, from an unauthenticated session.
--
-- The irony is that this file's own header explains that RLS does not apply to
-- TRUNCATE, and then fixed it in exactly one schema. Storage is where the most
-- sensitive objects live.

REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM authenticated;

-- service_role bypasses RLS by design and is server-only, but it has no business
-- truncating tables or attaching triggers either — a compromised service key
-- should not be able to wipe the platform in one statement.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM service_role;

-- anon must never write. Any public write path (guest enquiry, prelaunch signup)
-- goes through an API route holding a server-side client, never the anon key.
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;

-- ── Future tables ───────────────────────────────────────────────────────────
-- Applies to tables created by `postgres`, which is the role migrations run as.

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon;

-- ── Other schemas: storage, and Supabase's own ──────────────────────────────
--
-- `storage.objects` holds every portfolio image and every KYC document
-- reference. It is protected by RLS policies (20260719000018_storage.sql) — and
-- TRUNCATE goes straight past all of them.
--
-- Storage's normal DML grants are left intact: the storage API operates as the
-- calling role, so revoking SELECT/INSERT/UPDATE/DELETE here would break every
-- upload and every image. Only the three privileges no client ever needs are
-- removed.

-- ## A REVOKE this migration cannot complete on its own
--
-- `storage.objects` is owned by `supabase_storage_admin`, and migrations run as
-- `postgres`, which is NOT a member of that role. Postgres does not error on a
-- REVOKE by a non-owner — it issues a notice and changes nothing. So the
-- statements below are attempted, and then VERIFIED, because a silent no-op is
-- exactly how this hole survived the first hardening pass.
--
-- Where it cannot be completed, the migration raises a WARNING naming the exact
-- remedy rather than finishing quietly. See docs/OPS-STORAGE-GRANTS.md.

DO $$
DECLARE
  target_schema TEXT;
  still_granted TEXT;
BEGIN
  FOREACH target_schema IN ARRAY ARRAY['storage', 'supabase_functions'] LOOP
    -- Guarded: `supabase_functions` is absent on some stacks, and a missing
    -- schema must not fail the whole migration.
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = target_schema);

    BEGIN
      EXECUTE format(
        'REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA %I FROM anon, authenticated',
        target_schema
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated',
        target_schema
      );
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;  -- Reported by the verification below, which is the reliable signal.
    END;
  END LOOP;

  -- Verify rather than assume.
  SELECT string_agg(DISTINCT table_schema || '.' || table_name, ', ') INTO still_granted
    FROM information_schema.role_table_grants
   WHERE table_schema IN ('storage', 'supabase_functions')
     AND privilege_type = 'TRUNCATE'
     AND grantee IN ('anon', 'authenticated');

  IF still_granted IS NOT NULL THEN
    RAISE WARNING E'\n'
      '================================================================\n'
      ' UNRESOLVED: client roles retain TRUNCATE on: %\n'
      '\n'
      ' RLS does NOT apply to TRUNCATE. An unauthenticated caller holding\n'
      ' the anon key can destroy every row in these tables — which for\n'
      ' storage.objects means every portfolio image and every KYC document\n'
      ' reference on the platform.\n'
      '\n'
      ' This migration cannot fix it: these tables are owned by\n'
      ' supabase_storage_admin and migrations run as postgres, which is not\n'
      ' a member of that role. A non-owner REVOKE silently does nothing.\n'
      '\n'
      ' REMEDY — run as a role that owns the storage schema:\n'
      '   REVOKE TRUNCATE ON ALL TABLES IN SCHEMA storage FROM anon, authenticated;\n'
      '\n'
      ' On hosted Supabase, run it in the SQL editor (which executes with\n'
      ' higher privilege than a migration) and re-verify. Full instructions:\n'
      ' docs/OPS-STORAGE-GRANTS.md\n'
      '================================================================',
      still_granted;
  END IF;
END $$;

-- ── Functions ───────────────────────────────────────────────────────────────
--
-- Postgres grants EXECUTE on every new function to PUBLIC by default. That makes
-- a `GRANT … TO authenticated` look like an allow-list when it is really a
-- no-op — anon inherits EXECUTE through PUBLIC either way.
--
-- That default is how `deduct_tool_credits` ended up callable by anon, turning
-- an ownership-checked spend function into an unauthenticated API for draining a
-- competitor's credits. The lesson generalises, so every SECURITY DEFINER
-- function now states its callers explicitly.

-- Helpers used INSIDE RLS policies. Policies are evaluated with the caller's
-- privileges, so anon and authenticated genuinely need EXECUTE — a public
-- storefront read evaluates `owns_professional_profile` as anon.
--
-- Safe to expose because none of them takes a caller-controlled identity: each
-- derives the subject from `auth.uid()`, so the worst a caller can do is ask a
-- question about themselves. Granted explicitly rather than inherited, so the
-- exposure is a decision on the page rather than a default nobody chose.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_owner_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_owner_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.has_admin_capability(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_admin_capability(TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.owns_professional_profile(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_professional_profile(UUID)
  TO anon, authenticated, service_role;

-- `unique_slug` is SECURITY DEFINER over a CALLER-NAMED table, which makes it a
-- row-existence oracle: a client could ask whether a slug exists in any table it
-- names. It is only ever called from slug triggers, which are themselves
-- SECURITY DEFINER and run as the definer, so no client needs EXECUTE at all.
REVOKE ALL ON FUNCTION public.unique_slug(TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unique_slug(TEXT, TEXT, TEXT, UUID) TO service_role;

-- Creating functions is governed by CREATE on the schema, not by a grant here.
REVOKE CREATE ON SCHEMA public FROM anon, authenticated;
