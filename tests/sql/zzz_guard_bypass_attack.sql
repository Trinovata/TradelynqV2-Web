-- ============================================================================
-- Adversarial tests for the trigger-depth guard bypass.
--
-- The column guards on professional_profiles and customer_profiles bypass when
-- `pg_trigger_depth() > 1`, so that platform-owned triggers (rating
-- recalculation, connection counting) can write the very columns those guards
-- protect. That is a hole cut in a security control, and a hole cut for a good
-- reason is still a hole.
--
-- This file tries to get through it. Every test here is an ATTACK: it asserts a
-- direct write is still refused, and that the bypass cannot be reached from
-- anything a client controls.
--
-- Named zzz_ so it runs last — after the schema is proven sound and the domain
-- suites have set expectations.
--
-- Why trigger depth and not a session GUC: a client can `SET` any GUC on its own
-- connection, so a GUC-gated bypass is client-forgeable. `pg_trigger_depth()`
-- rises only inside actual trigger execution, and `authenticated` has no rights
-- to create a trigger. The claim this file tests is that the second half of that
-- sentence actually holds.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

BEGIN;

-- ── Fixtures ────────────────────────────────────────────────────────────────

INSERT INTO auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_user_meta_data, created_at, updated_at)
VALUES
  ('dddddddd-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'attacker-pro@tradelynq.test', 'x', NOW(),
   jsonb_build_object('full_name', 'Attacker Pro'), NOW(), NOW()),
  ('eeeeeeee-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'attacker-cust@tradelynq.test', 'x', NOW(),
   jsonb_build_object('full_name', 'Attacker Customer'), NOW(), NOW());

UPDATE public.profiles
   SET role = 'professional', professional_subtype = 'sole_trader', role_confirmed = TRUE
 WHERE id = 'dddddddd-0000-0000-0000-000000000001';

UPDATE public.profiles SET role = 'customer', role_confirmed = TRUE
 WHERE id = 'eeeeeeee-0000-0000-0000-000000000002';

INSERT INTO public.professional_profiles (id, user_id, business_name, owner_name)
VALUES ('11110000-0000-0000-0000-00000000aaaa',
        'dddddddd-0000-0000-0000-000000000001', 'Attacker Services', 'Attacker Pro');

INSERT INTO public.customer_profiles (user_id, area, connection_count)
VALUES ('eeeeeeee-0000-0000-0000-000000000002', 'Chaguanas', 1);

-- ── ATTACK 1: direct write at depth 0 ───────────────────────────────────────

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}';

DO $$
DECLARE
  blocked BOOLEAN := FALSE;
  msg TEXT;
BEGIN
  BEGIN
    UPDATE public.professional_profiles
       SET average_rating = 5.00, review_count = 500
     WHERE id = '11110000-0000-0000-0000-00000000aaaa';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;

  ASSERT blocked,
    'BYPASS BREACHED: the trigger-depth exception let a direct self-rating through';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: blocked by a missing GRANT, not the guard: ' || msg;
  ASSERT msg LIKE '%derived from reviews%', 'wrong guard fired: ' || msg;

  RAISE NOTICE 'PASS 1 — direct self-rating still refused at trigger depth 0';
END $$;

DO $$
DECLARE
  blocked BOOLEAN := FALSE;
BEGIN
  BEGIN
    UPDATE public.professional_profiles SET verification_status = 'fully_verified'
     WHERE id = '11110000-0000-0000-0000-00000000aaaa';
  EXCEPTION WHEN insufficient_privilege THEN blocked := TRUE; END;

  ASSERT blocked, 'BYPASS BREACHED: self-verification allowed';
  RAISE NOTICE 'PASS 2 — direct self-verification still refused';
END $$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"eeeeeeee-0000-0000-0000-000000000002","role":"authenticated"}';

DO $$
DECLARE
  blocked BOOLEAN := FALSE;
BEGIN
  BEGIN
    UPDATE public.customer_profiles SET connection_count = 0
     WHERE user_id = 'eeeeeeee-0000-0000-0000-000000000002';
  EXCEPTION WHEN insufficient_privilege THEN blocked := TRUE; END;

  ASSERT blocked, 'BYPASS BREACHED: the gate counter was resettable directly';
  RAISE NOTICE 'PASS 3 — direct connection-count reset still refused';
END $$;

-- ── ATTACK 2: can a client manufacture trigger depth? ───────────────────────
-- The whole safety argument rests on `authenticated` being unable to create a
-- trigger. If it can, it writes a trigger that fires on a table it owns rows in,
-- and inside that trigger every guard is bypassed.

DO $$
DECLARE
  created BOOLEAN := FALSE;
BEGIN
  BEGIN
    EXECUTE 'CREATE FUNCTION public.attacker_fn() RETURNS TRIGGER LANGUAGE plpgsql AS $f$ BEGIN RETURN NEW; END; $f$';
    created := TRUE;
  EXCEPTION WHEN insufficient_privilege OR syntax_error_or_access_rule_violation THEN
    created := FALSE;
  END;

  ASSERT NOT created,
    'BYPASS BREACHED: authenticated can CREATE FUNCTION, so it can reach trigger depth > 1';

  RAISE NOTICE 'PASS 4 — authenticated cannot create functions';
END $$;

DO $$
DECLARE
  created BOOLEAN := FALSE;
BEGIN
  BEGIN
    EXECUTE 'CREATE TRIGGER attacker_trg BEFORE UPDATE ON public.customer_profiles '
            'FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()';
    created := TRUE;
  EXCEPTION WHEN OTHERS THEN
    created := FALSE;
  END;

  ASSERT NOT created,
    'BYPASS BREACHED: authenticated can CREATE TRIGGER on a platform table';

  RAISE NOTICE 'PASS 5 — authenticated cannot create triggers on platform tables';
END $$;

-- ── ATTACK 3: is the bypass GUC-forgeable? ──────────────────────────────────
-- pg_trigger_depth() is a function of execution state, not a setting. Confirm a
-- client cannot raise it by SET, which is what makes it preferable to a GUC.

DO $$
DECLARE
  depth INT;
BEGIN
  BEGIN
    EXECUTE 'SET LOCAL pg_trigger_depth = 5';
  EXCEPTION WHEN OTHERS THEN
    NULL;  -- expected: not a settable parameter
  END;

  SELECT pg_trigger_depth() INTO depth;
  ASSERT depth = 0,
    format('BYPASS BREACHED: trigger depth is client-settable (saw %s)', depth);

  RAISE NOTICE 'PASS 6 — trigger depth is not client-settable';
END $$;

-- ── The bypass DOES work for the platform's own triggers ────────────────────
-- A bypass that blocks the legitimate path gets widened by the next person to
-- hit it, so prove the intended path still functions.

SET LOCAL ROLE postgres;
SET LOCAL request.jwt.claims TO '{}';

DO $$
DECLARE
  rating NUMERIC;
  count_after INTEGER;
BEGIN
  INSERT INTO public.reviews
    (professional_id, reviewer_name, star_rating, testimonial, status, moderated_at, is_seeded)
  VALUES
    ('11110000-0000-0000-0000-00000000aaaa', 'Test Reviewer', 4,
     'Reliable work, turned up when they said they would, tidy finish.',
     'approved', NOW(), TRUE);

  SELECT average_rating, review_count INTO rating, count_after
    FROM public.professional_profiles
   WHERE id = '11110000-0000-0000-0000-00000000aaaa';

  ASSERT count_after = 1,
    format('the rating trigger did not run through the guard (count=%s)', count_after);
  ASSERT rating = 4.00, format('unexpected rating: %s', rating);

  RAISE NOTICE 'PASS 7 — the platform rating trigger writes through the guard as intended';
END $$;

-- ── An unmoderated review must not move the number ──────────────────────────
-- The load-bearing half of moderation.

DO $$
DECLARE
  rating NUMERIC;
  count_after INTEGER;
BEGIN
  INSERT INTO public.reviews
    (professional_id, reviewer_name, star_rating, testimonial, status)
  VALUES
    ('11110000-0000-0000-0000-00000000aaaa', 'Pending Reviewer', 1,
     'This review is pending moderation and must not count toward the score.',
     'pending');

  SELECT average_rating, review_count INTO rating, count_after
    FROM public.professional_profiles
   WHERE id = '11110000-0000-0000-0000-00000000aaaa';

  ASSERT count_after = 1,
    format('a PENDING review moved the count to %s — moderation is decorative', count_after);
  ASSERT rating = 4.00,
    format('a PENDING review moved the rating to %s', rating);

  RAISE NOTICE 'PASS 8 — pending reviews do not move the rating';
END $$;

-- ── Account deletion must not be blocked by attribution constraints ─────────
-- The bug this file's sibling found: an ON DELETE SET NULL column required to be
-- NOT NULL makes the referenced admin undeletable, which is also an erasure
-- problem under data protection.

DO $$
DECLARE
  admin_id UUID := '99990000-0000-0000-0000-00000000ffff';
  deleted BOOLEAN := FALSE;
BEGIN
  INSERT INTO auth.users
    (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
     raw_user_meta_data, created_at, updated_at)
  VALUES (admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', 'leaving-admin@tradelynq.test', 'x', NOW(),
          jsonb_build_object('full_name', 'Leaving Admin'), NOW(), NOW());

  UPDATE public.profiles SET role = 'admin', role_confirmed = TRUE WHERE id = admin_id;

  -- This admin verifies a customer, then leaves the company.
  UPDATE public.customer_profiles
     SET kyc_status = 'verified', kyc_verified_at = NOW(), kyc_verified_by = admin_id
   WHERE user_id = 'eeeeeeee-0000-0000-0000-000000000002';

  BEGIN
    DELETE FROM auth.users WHERE id = admin_id;
    deleted := TRUE;
  EXCEPTION WHEN check_violation THEN
    deleted := FALSE;
  END;

  ASSERT deleted,
    'A KYC-verifying admin cannot be deleted — the attribution CHECK blocks it. '
    'Requiring an ON DELETE SET NULL column to be NOT NULL makes people undeletable.';

  RAISE NOTICE 'PASS 9 — a departing admin can be deleted; attribution degrades to NULL';
END $$;

ROLLBACK;

\echo ''
\echo '================================================'
\echo ' guard bypass attack suite: ALL ATTACKS REPELLED'
\echo '================================================'
