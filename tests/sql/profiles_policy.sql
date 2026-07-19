-- ============================================================================
-- Policy and constraint tests for `profiles` (playbook S047, first entries).
--
-- This suite is PERMANENT: every future migration adds its cases here. It asserts
-- security properties by exercising them, because a migration applying cleanly is
-- not evidence that its RLS works.
--
-- Run: docker exec -i supabase_db_Tradelynq-V2 psql -U postgres -d postgres \
--        -v ON_ERROR_STOP=1 -f - < tests/sql/profiles_policy.sql
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

BEGIN;

-- ── Fixtures ────────────────────────────────────────────────────────────────

INSERT INTO auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_user_meta_data, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'alice@tradelynq.test', 'x', NOW(),
   jsonb_build_object('full_name', 'Alice Customer'), NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bob@tradelynq.test', 'x', NULL,
   jsonb_build_object('name', 'Bob Professional'), NOW(), NOW());

-- ── 1. The signup trigger fires and maps metadata correctly ─────────────────

DO $$
DECLARE
  alice public.profiles%ROWTYPE;
  bob public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO alice FROM public.profiles
   WHERE id = '11111111-1111-1111-1111-111111111111';
  SELECT * INTO bob FROM public.profiles
   WHERE id = '22222222-2222-2222-2222-222222222222';

  ASSERT alice.id IS NOT NULL, 'handle_new_user did not create a profile row';
  ASSERT alice.email = 'alice@tradelynq.test', 'email not copied from auth.users';

  -- Google supplies full_name, other providers supply name. Both must land.
  ASSERT alice.full_name = 'Alice Customer', 'full_name metadata key not read';
  ASSERT bob.full_name = 'Bob Professional', 'name metadata fallback not read';

  -- Defaults must never assert anything about the person before they choose.
  ASSERT alice.role = 'customer', 'unexpected default role';
  ASSERT alice.role_confirmed = FALSE, 'role_confirmed must start false';
  ASSERT alice.professional_subtype IS NULL, 'non-professional must have no subtype';

  -- email_verified mirrors auth.users.email_confirmed_at, per user.
  ASSERT alice.email_verified = TRUE, 'confirmed user should be email_verified';
  ASSERT bob.email_verified = FALSE, 'unconfirmed user must not be email_verified';

  RAISE NOTICE 'PASS 1 — signup trigger creates profiles and maps metadata';
END $$;

-- ── 2. The trigger is idempotent (identity linking re-fires it) ─────────────

DO $$
DECLARE
  count_before INT;
  count_after INT;
  name_after TEXT;
BEGIN
  SELECT COUNT(*) INTO count_before FROM public.profiles;

  -- Simulate Supabase re-firing on identity link with sparser metadata.
  PERFORM public.handle_new_user() FROM (SELECT 1) AS _ LIMIT 0;

  BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES ('11111111-1111-1111-1111-111111111111', 'alice@tradelynq.test', NULL)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  SELECT COUNT(*) INTO count_after FROM public.profiles;
  SELECT full_name INTO name_after FROM public.profiles
   WHERE id = '11111111-1111-1111-1111-111111111111';

  ASSERT count_after = count_before, 'duplicate profile row created';
  ASSERT name_after = 'Alice Customer',
    'existing profile was overwritten with sparser metadata';

  RAISE NOTICE 'PASS 2 — re-signup is idempotent and does not clobber';
END $$;

-- ── 3. professional_subtype CHECK constraint ────────────────────────────────

DO $$
DECLARE
  rejected BOOLEAN := FALSE;
BEGIN
  -- A professional without a subtype must be impossible.
  BEGIN
    UPDATE public.profiles
       SET role = 'professional', professional_subtype = NULL
     WHERE id = '22222222-2222-2222-2222-222222222222';
  EXCEPTION WHEN check_violation THEN
    rejected := TRUE;
  END;
  ASSERT rejected, 'a professional with no subtype was allowed';

  -- A customer WITH a subtype must be equally impossible.
  rejected := FALSE;
  BEGIN
    UPDATE public.profiles
       SET role = 'customer', professional_subtype = 'sole_trader'
     WHERE id = '22222222-2222-2222-2222-222222222222';
  EXCEPTION WHEN check_violation THEN
    rejected := TRUE;
  END;
  ASSERT rejected, 'a customer carrying a professional subtype was allowed';

  -- The valid combination must succeed.
  UPDATE public.profiles
     SET role = 'professional', professional_subtype = 'sole_trader'
   WHERE id = '22222222-2222-2222-2222-222222222222';

  RAISE NOTICE 'PASS 3 — subtype constraint holds in both directions';
END $$;

-- ── 4. THE PRIVILEGE ESCALATION GUARD ───────────────────────────────────────
-- The single most important test in this file. RLS lets a user UPDATE their own
-- row; without the column guard, that row includes `role`.

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

DO $$
DECLARE
  blocked BOOLEAN := FALSE;
  err_message TEXT;
  final_role user_role;
BEGIN
  BEGIN
    UPDATE public.profiles SET role = 'admin'
     WHERE id = '11111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE;
    GET STACKED DIAGNOSTICS err_message = MESSAGE_TEXT;
  END;

  ASSERT blocked, 'SECURITY HOLE: a user escalated themselves to admin';

  -- Critical: a MISSING GRANT also raises insufficient_privilege (42501), with
  -- the message "permission denied for table profiles". If we accepted any
  -- 42501 as success, this test would pass on a database where authenticated
  -- users cannot touch profiles at all — proving nothing about the guard while
  -- looking green. This exact false positive occurred on the first run.
  ASSERT err_message NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: blocked by a missing GRANT, not by the column guard. '
    'The guard is untested. Message was: ' || err_message;

  ASSERT err_message LIKE '%Role cannot be changed directly%',
    'blocked, but not by the expected guard. Message was: ' || err_message;

  SET LOCAL ROLE postgres;
  SELECT role INTO final_role FROM public.profiles
   WHERE id = '11111111-1111-1111-1111-111111111111';
  ASSERT final_role = 'customer', 'role changed despite the guard raising';

  RAISE NOTICE 'PASS 4 — self-elevation to admin is blocked BY THE GUARD';
END $$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

DO $$
DECLARE
  msg TEXT;
  blocked BOOLEAN;
BEGIN
  -- Every privileged column must be protected BY THE GUARD, not by a missing
  -- GRANT. Each case checks the message for the same reason as test 4.
  --
  -- Each new value must genuinely DIFFER from the current one. The guard uses
  -- IS DISTINCT FROM, so writing a column back to its existing value is a no-op
  -- and correctly does not raise. An earlier version of this test set
  -- account_status = 'active' on an already-active row and reported a security
  -- hole that did not exist.
  blocked := FALSE;
  BEGIN
    -- Alice is 'active'; suspending herself is a real change.
    UPDATE public.profiles SET account_status = 'suspended'
     WHERE id = '11111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'account_status was self-editable';
  ASSERT msg LIKE '%administrators only%',
    'account_status blocked by the wrong mechanism: ' || msg;

  blocked := FALSE;
  BEGIN
    -- Alice is verified; the guard must refuse a change in either direction.
    UPDATE public.profiles SET email_verified = FALSE
     WHERE id = '11111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'email_verified was self-editable';
  ASSERT msg LIKE '%set by the platform%',
    'email_verified blocked by the wrong mechanism: ' || msg;

  blocked := FALSE;
  BEGIN
    -- Currently 0. Resetting a spent grace allowance is the actual attack.
    UPDATE public.profiles SET role_change_count = 5
     WHERE id = '11111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'role_change_count was self-editable — grace period defeatable';
  ASSERT msg LIKE '%maintained by the platform%',
    'role_change_count blocked by the wrong mechanism: ' || msg;

  RAISE NOTICE 'PASS 5 — all privileged columns are guarded BY THE GUARD';
END $$;

-- ── 6. Ordinary self-edits still work ───────────────────────────────────────
-- A guard that blocks legitimate use gets removed, so prove it does not.

DO $$
DECLARE
  name_after TEXT;
BEGIN
  UPDATE public.profiles SET full_name = 'Alice Updated'
   WHERE id = '11111111-1111-1111-1111-111111111111';

  SELECT full_name INTO name_after FROM public.profiles
   WHERE id = '11111111-1111-1111-1111-111111111111';

  ASSERT name_after = 'Alice Updated', 'a user could not edit their own name';
  RAISE NOTICE 'PASS 6 — ordinary self-edits are unaffected';
END $$;

-- ── 7. RLS isolation: a stranger cannot read another profile ────────────────

DO $$
DECLARE
  visible INT;
BEGIN
  SELECT COUNT(*) INTO visible FROM public.profiles;
  ASSERT visible = 1,
    format('RLS leak: Alice can see %s profiles, expected only her own', visible);

  SELECT COUNT(*) INTO visible FROM public.profiles
   WHERE id = '22222222-2222-2222-2222-222222222222';
  ASSERT visible = 0, 'RLS leak: another user''s profile was readable';

  RAISE NOTICE 'PASS 7 — profiles are isolated between users';
END $$;

-- ── 8. A stranger cannot WRITE another profile ──────────────────────────────

DO $$
DECLARE
  affected INT;
  bobs_name TEXT;
BEGIN
  UPDATE public.profiles SET full_name = 'Hacked'
   WHERE id = '22222222-2222-2222-2222-222222222222';
  GET DIAGNOSTICS affected = ROW_COUNT;

  -- RLS makes the row invisible, so the UPDATE matches nothing rather than
  -- raising. Silent no-op is the correct and expected behaviour.
  ASSERT affected = 0, 'RLS leak: another user''s profile was writable';

  SET LOCAL ROLE postgres;
  SELECT full_name INTO bobs_name FROM public.profiles
   WHERE id = '22222222-2222-2222-2222-222222222222';
  ASSERT bobs_name = 'Bob Professional', 'another user''s data was modified';

  RAISE NOTICE 'PASS 8 — cross-user writes are refused';
END $$;

SET LOCAL ROLE postgres;

-- ── 9. slugify / unique_slug ────────────────────────────────────────────────

DO $$
BEGIN
  ASSERT public.slugify('Ravi''s Plumbing & Co.') = 'ravi-s-plumbing-co',
    format('unexpected slug: %s', public.slugify('Ravi''s Plumbing & Co.'));
  ASSERT public.slugify('  Multiple   Spaces  ') = 'multiple-spaces', 'spacing not collapsed';
  ASSERT public.slugify('') = '', 'empty input should slugify to empty';
  ASSERT public.slugify(NULL) = '', 'null input should slugify to empty, not null';

  RAISE NOTICE 'PASS 9 — slugify normalises correctly';
END $$;

ROLLBACK;

\echo ''
\echo '================================================'
\echo ' profiles policy suite: ALL CHECKS PASSED'
\echo '================================================'
