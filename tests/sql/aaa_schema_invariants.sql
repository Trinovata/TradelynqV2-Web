-- ============================================================================
-- Schema-wide invariants — the automatic guard (playbook S047)
--
-- Named `aaa_` so it runs first: if the schema itself is unsound, the
-- table-specific suites are testing a broken foundation.
--
-- Every other suite tests a table someone remembered to write tests for. This
-- one tests EVERY table, including ones added later by someone who did not read
-- the conventions. It exists because two of this project's real defects were
-- omissions rather than mistakes:
--
--   * a table with policies but no GRANT — unreachable, and the migration
--     applied perfectly cleanly
--   * RLS enabled but not FORCED — silently bypassed by the table owner
--
-- Neither is visible in review. Both are trivially detectable from the catalog.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

-- ── 1. RLS is ENABLED on every table ────────────────────────────────────────

DO $$
DECLARE
  offenders TEXT;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO offenders
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND NOT c.relrowsecurity;

  ASSERT offenders IS NULL,
    'Tables without RLS enabled: ' || offenders ||
    E'\n  Add: ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY;';

  RAISE NOTICE 'PASS 1 — RLS enabled on every public table';
END $$;

-- ── 2. RLS is FORCED on every table ─────────────────────────────────────────

DO $$
DECLARE
  offenders TEXT;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO offenders
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND c.relrowsecurity
     AND NOT c.relforcerowsecurity;

  -- Without FORCE, the table owner bypasses every policy — which means a bug in
  -- any SECURITY DEFINER function reads the whole table instead of one row.
  ASSERT offenders IS NULL,
    'Tables with RLS enabled but NOT forced: ' || offenders ||
    E'\n  Add: ALTER TABLE public.<t> FORCE ROW LEVEL SECURITY;';

  RAISE NOTICE 'PASS 2 — RLS forced on every public table';
END $$;

-- ── 3. Every table has at least one policy ──────────────────────────────────

DO $$
DECLARE
  offenders TEXT;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO offenders
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid);

  -- RLS on with no policies denies everything. That is safe but almost never
  -- intended, and it fails at runtime rather than at migration time.
  ASSERT offenders IS NULL,
    'Tables with RLS but NO policies (everything denied): ' || offenders;

  RAISE NOTICE 'PASS 3 — every table has at least one policy';
END $$;

-- ── 4. THE GRANT CHECK ──────────────────────────────────────────────────────
-- The defect that already shipped once. RLS narrows what a role may reach; it
-- does not grant the right to reach anything. A table with policies but no
-- GRANT is completely unreachable and the application breaks at runtime.

-- NOTE on column-level grants: `has_table_privilege(role, tbl, 'SELECT')` is
-- FALSE when a role holds only column-level SELECT. `professional_profiles`
-- grants anon an explicit column allow-list (so identity documents are not
-- world-readable), so table-level checks report a live policy as dead.
-- `has_any_column_privilege` covers both forms and is what these checks use.

DO $$
DECLARE
  offenders TEXT;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO offenders
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
     AND NOT has_any_column_privilege('authenticated', c.oid, 'SELECT')
     AND NOT has_any_column_privilege('anon', c.oid, 'SELECT');

  ASSERT offenders IS NULL,
    'Tables with policies but NO GRANT to anon or authenticated: ' || offenders ||
    E'\n  These are unreachable at runtime. Add: GRANT SELECT[, INSERT, UPDATE] ON public.<t> TO authenticated;';

  RAISE NOTICE 'PASS 4 — every policied table is reachable by at least one role';
END $$;

-- ── 4b. Per-COMMAND reachability ────────────────────────────────────────────
-- Check 4 only proves a table is readable by someone. A table with an INSERT
-- policy but no INSERT grant is just as unreachable, and check 4 passes it
-- happily because SELECT is granted. This closes that gap per command.

DO $$
DECLARE
  offenders TEXT;
BEGIN
  SELECT string_agg(DISTINCT c.relname || ': ' || cmd_name || ' policy without grant', ', ')
    INTO offenders
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN LATERAL (
      SELECT CASE p.polcmd
               WHEN 'a' THEN 'INSERT'
               WHEN 'w' THEN 'UPDATE'
               WHEN 'd' THEN 'DELETE'
             END AS cmd_name
    ) AS cmd
   WHERE n.nspname = 'public'
     AND cmd.cmd_name IS NOT NULL
     -- Only where the policy actually names a client role.
     AND EXISTS (
       SELECT 1 FROM unnest(p.polroles) AS r
        WHERE pg_get_userbyid(r) IN ('anon', 'authenticated')
     )
     AND NOT EXISTS (
       SELECT 1 FROM unnest(p.polroles) AS r
        WHERE pg_get_userbyid(r) IN ('anon', 'authenticated')
          -- DELETE has no column-level form, so it must be tested at table
          -- level; INSERT and UPDATE can be granted per column.
          AND CASE
                WHEN cmd.cmd_name = 'DELETE'
                  THEN has_table_privilege(pg_get_userbyid(r), c.oid, 'DELETE')
                ELSE has_any_column_privilege(pg_get_userbyid(r), c.oid, cmd.cmd_name)
              END
     );

  ASSERT offenders IS NULL,
    'Policies whose command has no matching GRANT (unreachable): ' || offenders;

  RAISE NOTICE 'PASS 4b — every INSERT/UPDATE/DELETE policy has a matching grant';
END $$;

-- ── 5. Policies must not name a role no GRANT backs ─────────────────────────
-- The mirror of 4: a policy naming `anon` on a table anon cannot read is dead
-- code that reads as a public path in review.

DO $$
DECLARE
  offenders TEXT;
BEGIN
  SELECT string_agg(DISTINCT c.relname || '.' || p.polname, ', ') INTO offenders
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND 'anon' = ANY (SELECT pg_get_userbyid(unnest(p.polroles)))
     AND NOT has_any_column_privilege('anon', c.oid, 'SELECT');

  ASSERT offenders IS NULL,
    'Policies granting anon on tables anon cannot SELECT (dead policy): ' || offenders;

  RAISE NOTICE 'PASS 5 — no dead anon policies';
END $$;

-- ── 5b. No client role may hold EXECUTE via PUBLIC on a SECURITY DEFINER fn ──
-- Postgres grants EXECUTE on new functions to PUBLIC by default, so a
-- `GRANT … TO authenticated` reads like an allow-list while anon inherits
-- EXECUTE anyway. That is precisely how deduct_tool_credits became callable by
-- anon, which made it an unauthenticated API for draining a competitor's
-- credits. Every SECURITY DEFINER function must revoke PUBLIC explicitly.

DO $$
DECLARE
  offenders TEXT;
BEGIN
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO offenders
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prosecdef
     -- A NULL proacl means default privileges, i.e. PUBLIC holds EXECUTE.
     AND (p.proacl IS NULL OR EXISTS (
       SELECT 1 FROM unnest(p.proacl) AS acl
        WHERE acl::text LIKE '=X/%'   -- '=X/owner' is the PUBLIC grant
     ))
     -- Trigger functions cannot be invoked directly by a client.
     AND p.prorettype <> 'trigger'::regtype;

  ASSERT offenders IS NULL,
    'SECURITY DEFINER functions callable by PUBLIC (so by anon): ' || offenders ||
    E'\n  Add: REVOKE ALL ON FUNCTION public.<fn>(<args>) FROM PUBLIC;';

  RAISE NOTICE 'PASS 5c — no SECURITY DEFINER function is PUBLIC-executable';
END $$;

-- ── 6. Every foreign key is indexed ─────────────────────────────────────────
-- An unindexed FK makes every cascade and every join over it a sequential scan.
-- Cheap to fix at migration time, painful to diagnose under load.

DO $$
DECLARE
  offenders TEXT;
BEGIN
  SELECT string_agg(DISTINCT rel.relname || '.' || att.attname, ', ') INTO offenders
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN unnest(con.conkey) AS fk_col ON TRUE
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = fk_col
   WHERE con.contype = 'f'
     AND nsp.nspname = 'public'
     AND NOT EXISTS (
       SELECT 1 FROM pg_index i
        WHERE i.indrelid = rel.oid
          -- The FK column must be the index's FIRST column to be usable for it.
          AND att.attnum = i.indkey[0]
     );

  ASSERT offenders IS NULL,
    'Foreign keys with no leading index: ' || offenders ||
    E'\n  Every FK needs an index whose FIRST column is the FK column.';

  RAISE NOTICE 'PASS 6 — every foreign key is indexed';
END $$;

-- ── 7. Every SECURITY DEFINER function pins search_path ─────────────────────
-- A SECURITY DEFINER function with a mutable search_path is a privilege
-- escalation primitive: an attacker who can create objects in an earlier schema
-- shadows a name and has it execute with the definer's rights.

DO $$
DECLARE
  offenders TEXT;
BEGIN
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO offenders
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prosecdef
     AND NOT EXISTS (
       SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) AS cfg
        WHERE cfg LIKE 'search_path=%'
     );

  ASSERT offenders IS NULL,
    'SECURITY DEFINER functions without a pinned search_path: ' || offenders ||
    E'\n  Add: SET search_path = '''' and fully qualify every identifier.';

  RAISE NOTICE 'PASS 7 — every SECURITY DEFINER function pins search_path';
END $$;

-- ── 8. Tables with updated_at maintain it by trigger ────────────────────────

DO $$
DECLARE
  offenders TEXT;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO offenders
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND a.attname = 'updated_at'
     AND a.attnum > 0
     AND NOT EXISTS (
       SELECT 1 FROM pg_trigger t
        WHERE t.tgrelid = c.oid AND NOT t.tgisinternal
          AND pg_get_triggerdef(t.oid) LIKE '%update_updated_at_column%'
     );

  -- An updated_at maintained by application code is wrong the first time
  -- anything else writes the row — cron, admin tooling, or a webhook consumer.
  ASSERT offenders IS NULL,
    'Tables with updated_at but no maintaining trigger: ' || offenders;

  RAISE NOTICE 'PASS 8 — updated_at is trigger-maintained everywhere';
END $$;

-- ── 9. No client role holds TRUNCATE ────────────────────────────────────────
-- CRITICAL. Row Level Security does NOT apply to TRUNCATE. A role holding it can
-- destroy every row in a table with all policies in place and RLS both enabled
-- and forced. This was verified empirically against this schema: `anon` could
-- TRUNCATE customer_profiles CASCADE while entirely unauthenticated.
--
-- The grant comes from Supabase's bootstrap defaults, so it returns by default
-- on any new table unless ALTER DEFAULT PRIVILEGES is also set. This check is
-- what makes the fix durable.

DO $$
DECLARE
  offenders TEXT;
BEGIN
  SELECT string_agg(DISTINCT grantee || ' on ' || table_name, ', ') INTO offenders
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND privilege_type = 'TRUNCATE'
     AND grantee IN ('anon', 'authenticated', 'service_role');

  ASSERT offenders IS NULL,
    'CRITICAL — client roles hold TRUNCATE (RLS does not apply to it): ' || offenders ||
    E'\n  See migration 20260719999999_harden_grants.sql.';

  RAISE NOTICE 'PASS 9 — no client role can TRUNCATE';
END $$;

-- ── 10. No client role holds TRIGGER ────────────────────────────────────────
-- The column guards bypass at pg_trigger_depth() > 1 so platform triggers can
-- maintain derived columns. That bypass is safe only while clients cannot reach
-- trigger depth, and TRIGGER privilege is exactly that reachability.

DO $$
DECLARE
  offenders TEXT;
BEGIN
  SELECT string_agg(DISTINCT grantee || ' on ' || table_name, ', ') INTO offenders
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND privilege_type = 'TRIGGER'
     AND grantee IN ('anon', 'authenticated');

  ASSERT offenders IS NULL,
    'Client roles hold TRIGGER, which makes the guard bypass reachable: ' || offenders;

  RAISE NOTICE 'PASS 10 — no client role can attach triggers';
END $$;

-- ── 11. anon holds no write privilege ───────────────────────────────────────
-- Public write paths (guest enquiry, prelaunch signup) go through an API route
-- with a server-side client. The anon key never writes directly.

DO $$
DECLARE
  offenders TEXT;
BEGIN
  SELECT string_agg(DISTINCT privilege_type || ' on ' || table_name, ', ') INTO offenders
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public'
     AND grantee = 'anon'
     AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');

  ASSERT offenders IS NULL, 'anon holds write privileges: ' || offenders;

  RAISE NOTICE 'PASS 11 — anon is read-only';
END $$;

\echo ''
\echo '================================================'
\echo ' schema invariants: ALL CHECKS PASSED'
\echo '================================================'
