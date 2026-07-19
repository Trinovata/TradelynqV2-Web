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
     AND NOT has_table_privilege('authenticated', c.oid, 'SELECT')
     AND NOT has_table_privilege('anon', c.oid, 'SELECT');

  ASSERT offenders IS NULL,
    'Tables with policies but NO GRANT to anon or authenticated: ' || offenders ||
    E'\n  These are unreachable at runtime. Add: GRANT SELECT[, INSERT, UPDATE] ON public.<t> TO authenticated;';

  RAISE NOTICE 'PASS 4 — every policied table is reachable by at least one role';
END $$;

-- ── 5. Policies must not grant a role no GRANT backs ────────────────────────
-- The mirror of 4: a policy naming `anon` on a table anon cannot SELECT is dead
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
     AND NOT has_table_privilege('anon', c.oid, 'SELECT');

  ASSERT offenders IS NULL,
    'Policies granting anon on tables anon cannot SELECT (dead policy): ' || offenders;

  RAISE NOTICE 'PASS 5 — no dead anon policies';
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

\echo ''
\echo '================================================'
\echo ' schema invariants: ALL CHECKS PASSED'
\echo '================================================'
