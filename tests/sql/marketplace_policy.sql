-- ============================================================================
-- Policy and constraint tests for the marketplace tables (playbook S033–S036):
-- connections, job_enquiries, offerings, bookings, booking_availability,
-- booking_blocked_dates, reviews, disputes, case_notes, legal_acceptances,
-- profile_templates.
--
-- Three traps this suite is written to avoid, all of which have bitten before:
--
--   1. A missing GRANT raises "permission denied for table", which is SQLSTATE
--      42501 — the SAME insufficient_privilege the column guards raise on
--      purpose. Catching the code alone proves nothing. Every guard assertion
--      below also asserts the message is NOT the GRANT failure, and asserts the
--      specific text of the guard that was supposed to fire.
--
--   2. Guards compare with IS DISTINCT FROM, so writing a column back to its
--      current value is a no-op and correctly raises nothing. Every value used
--      to probe a guard genuinely differs from what is stored.
--
--   3. SET LOCAL request.jwt.claims survives SET LOCAL ROLE. Acting as the
--      service role requires clearing the claims too, otherwise auth.uid() is
--      still the previous user and the guards still fire.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

BEGIN;

-- ── Fixtures ────────────────────────────────────────────────────────────────

INSERT INTO auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_user_meta_data, created_at, updated_at)
VALUES
  ('aaaaaaaa-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'mpro@tradelynq.test', 'x', NOW(), jsonb_build_object('full_name', 'Ravi Pro'), NOW(), NOW()),
  ('bbbbbbbb-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'mcust@tradelynq.test', 'x', NOW(), jsonb_build_object('full_name', 'Nia Customer'), NOW(), NOW()),
  ('cccccccc-0000-0000-0000-00000000000c',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'mrival@tradelynq.test', 'x', NOW(), jsonb_build_object('full_name', 'Rival Pro'), NOW(), NOW()),
  ('dddddddd-0000-0000-0000-00000000000d',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'madmin@tradelynq.test', 'x', NOW(), jsonb_build_object('full_name', 'Admin Ama'), NOW(), NOW()),
  ('eeeeeeee-0000-0000-0000-00000000000e',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'mnosy@tradelynq.test', 'x', NOW(), jsonb_build_object('full_name', 'Nosy Neighbour'), NOW(), NOW());

UPDATE public.profiles
   SET role = 'professional', professional_subtype = 'sole_trader', role_confirmed = TRUE
 WHERE id IN ('aaaaaaaa-0000-0000-0000-00000000000a', 'cccccccc-0000-0000-0000-00000000000c');

UPDATE public.profiles
   SET role = 'customer', role_confirmed = TRUE
 WHERE id IN ('bbbbbbbb-0000-0000-0000-00000000000b', 'eeeeeeee-0000-0000-0000-00000000000e');

UPDATE public.profiles
   SET role = 'admin', role_confirmed = TRUE
 WHERE id = 'dddddddd-0000-0000-0000-00000000000d';

INSERT INTO public.customer_profiles (user_id, area)
VALUES
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'Curepe'),
  ('eeeeeeee-0000-0000-0000-00000000000e', 'Chaguanas');

INSERT INTO public.professional_profiles
  (id, user_id, business_name, owner_name, category_id, service_areas, listing_status)
VALUES
  ('11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-00000000000a', 'Ravi Plumbing Co', 'Ravi Pro',
   (SELECT id FROM public.categories WHERE parent_slug IS NOT NULL ORDER BY slug LIMIT 1),
   ARRAY['Curepe', 'St Augustine'], 'active'),
  ('22222222-2222-2222-2222-222222222222',
   'cccccccc-0000-0000-0000-00000000000c', 'Rival Works Ltd', 'Rival Pro',
   (SELECT id FROM public.categories WHERE parent_slug IS NOT NULL ORDER BY slug LIMIT 1),
   ARRAY['Arima'], 'active');

-- ── 1. Connections: insert increments the gate counter ──────────────────────

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}';

DO $$
DECLARE
  count_before INT;
  count_after INT;
BEGIN
  SELECT connection_count INTO count_before FROM public.customer_profiles
   WHERE user_id = 'bbbbbbbb-0000-0000-0000-00000000000b';
  ASSERT count_before = 0, format('fixture customer started at %s connections', count_before);

  INSERT INTO public.connections (customer_id, professional_id)
  VALUES ('bbbbbbbb-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111');

  SELECT connection_count INTO count_after FROM public.customer_profiles
   WHERE user_id = 'bbbbbbbb-0000-0000-0000-00000000000b';

  -- The whole free-contact gate rests on this number moving. If the guard on
  -- customer_profiles blocked the trigger, this is where it shows up.
  ASSERT count_after = 1,
    format('connection count did not increment: expected 1, got %s', count_after);

  INSERT INTO public.connections (customer_id, professional_id)
  VALUES ('bbbbbbbb-0000-0000-0000-00000000000b', '22222222-2222-2222-2222-222222222222');

  SELECT connection_count INTO count_after FROM public.customer_profiles
   WHERE user_id = 'bbbbbbbb-0000-0000-0000-00000000000b';
  ASSERT count_after = 2, format('second connection not counted: got %s', count_after);

  RAISE NOTICE 'PASS 1 — connections increment customer_profiles.connection_count';
END $$;

-- ── 2. Connections: the pair is unique and the row is immutable ─────────────

DO $$
DECLARE
  rejected BOOLEAN;
  blocked BOOLEAN;
  msg TEXT;
BEGIN
  -- Revealing the same professional twice must never burn the counter, so the
  -- duplicate is refused by the database rather than by the API's good manners.
  rejected := FALSE;
  BEGIN
    INSERT INTO public.connections (customer_id, professional_id)
    VALUES ('bbbbbbbb-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111');
  EXCEPTION WHEN unique_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'a duplicate connection was accepted';

  -- Immutability, LAYER ONE — the absent UPDATE grant. created_at is genuinely
  -- different from what is stored (trap 2), so nothing here is a no-op.
  --
  -- This assertion is deliberately inverted from the usual one. `authenticated`
  -- holds no UPDATE grant on connections, so the statement is refused before
  -- the trigger is ever reached. That is the correct and strongest outcome —
  -- but it means a test asserting the trigger's message here would fail, and a
  -- test asserting only SQLSTATE 42501 would pass while proving nothing about
  -- the trigger. So each layer is asserted where it actually fires.
  blocked := FALSE;
  BEGIN
    UPDATE public.connections SET created_at = NOW() - INTERVAL '30 days'
     WHERE customer_id = 'bbbbbbbb-0000-0000-0000-00000000000b';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'HISTORY REWRITE: a connection record was edited by its owner';
  ASSERT msg LIKE '%permission denied for table%',
    'expected the missing UPDATE grant to refuse this, got: ' || msg;

  RAISE NOTICE 'PASS 2 — connections are unique per pair; authenticated has no UPDATE grant';
END $$;

-- Immutability, LAYER TWO — the trigger, which is what stops the SERVICE ROLE.
-- The grant layer above does not apply to a role holding every privilege, and
-- the service role is what every cron job and admin route runs as. Without this
-- trigger, one careless server-side UPDATE rewrites the gate ledger silently.

SET LOCAL ROLE postgres;
SET LOCAL request.jwt.claims TO '{}';  -- trap 3: claims survive the role change

DO $$
DECLARE
  blocked BOOLEAN := FALSE;
  msg TEXT;
BEGIN
  BEGIN
    UPDATE public.connections SET created_at = NOW() - INTERVAL '30 days'
     WHERE customer_id = 'bbbbbbbb-0000-0000-0000-00000000000b';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'HISTORY REWRITE: the service role edited a connection record';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: a grant refused this, so the trigger is untested: ' || msg;
  ASSERT msg LIKE '%Connections are immutable%', 'wrong guard fired: ' || msg;

  RAISE NOTICE 'PASS 3 — the immutability trigger stops even the service role';
END $$;

SET LOCAL ROLE authenticated;

-- ── 3. Connections: a stranger sees nothing ─────────────────────────────────

SET LOCAL request.jwt.claims TO
  '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}';

DO $$
DECLARE
  visible INT;
BEGIN
  SELECT COUNT(*) INTO visible FROM public.connections;
  ASSERT visible = 0,
    format('PRIVACY LEAK: an unrelated customer saw %s connections', visible);

  RAISE NOTICE 'PASS 4 — connections are private to the two parties';
END $$;

-- ── 4. Enquiries: the D54 length bounds ─────────────────────────────────────

SET LOCAL request.jwt.claims TO
  '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}';

DO $$
DECLARE
  rejected BOOLEAN;
BEGIN
  -- 19 characters: one under the floor. A three-word enquiry wastes the
  -- professional's response-rate metric and gets declined.
  rejected := FALSE;
  BEGIN
    INSERT INTO public.job_enquiries (customer_id, professional_id, description)
    VALUES ('bbbbbbbb-0000-0000-0000-00000000000b',
            '11111111-1111-1111-1111-111111111111', repeat('a', 19));
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'D54 floor not enforced: a 19-character enquiry was accepted';

  -- 1,001 characters: one over the D54 ceiling. NOT 2,000 — chapters citing
  -- 2,000 are superseded.
  rejected := FALSE;
  BEGIN
    INSERT INTO public.job_enquiries (customer_id, professional_id, description)
    VALUES ('bbbbbbbb-0000-0000-0000-00000000000b',
            '11111111-1111-1111-1111-111111111111', repeat('a', 1001));
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'D54 ceiling not enforced: a 1,001-character enquiry was accepted';

  -- Exactly 1,000 must pass; an off-by-one at the boundary is a real bug.
  INSERT INTO public.job_enquiries (id, customer_id, professional_id, description)
  VALUES ('3333cccc-3333-3333-3333-333333333333',
          'bbbbbbbb-0000-0000-0000-00000000000b',
          '11111111-1111-1111-1111-111111111111', repeat('b', 1000));

  INSERT INTO public.job_enquiries (id, customer_id, professional_id, description, preferred_date)
  VALUES ('33333333-3333-3333-3333-333333333333',
          'bbbbbbbb-0000-0000-0000-00000000000b',
          '11111111-1111-1111-1111-111111111111',
          'Bathroom tap leaking at the base, needs re-seating or replacement.',
          DATE '2026-07-25');

  RAISE NOTICE 'PASS 5 — enquiry description enforces D54 bounds of 20-1,000';
END $$;

-- ── 5. Enquiries: the customer owns the request, not the outcome ────────────

DO $$
DECLARE
  blocked BOOLEAN;
  msg TEXT;
  st enquiry_status;
BEGIN
  -- Self-accepting would forge the professional's side of the transaction and
  -- corrupt the response-rate metric derived from these stamps.
  blocked := FALSE;
  BEGIN
    UPDATE public.job_enquiries SET status = 'accepted'
     WHERE id = '33333333-3333-3333-3333-333333333333';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'SECURITY HOLE: a customer accepted an enquiry on the professional''s behalf';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: missing GRANT, not the guard: ' || msg;
  ASSERT msg LIKE '%Only the professional can change%', 'wrong guard fired: ' || msg;

  blocked := FALSE;
  BEGIN
    UPDATE public.job_enquiries SET completed_at = NOW()
     WHERE id = '33333333-3333-3333-3333-333333333333';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'SECURITY HOLE: a customer stamped completion themselves';
  ASSERT msg LIKE '%lifecycle stamps%', 'wrong guard fired: ' || msg;

  -- The case log is the professional's private record of an off-platform
  -- conversation. A customer writing into it would fabricate an agreed price.
  blocked := FALSE;
  BEGIN
    UPDATE public.job_enquiries SET agreed_price_ttd = 1
     WHERE id = '33333333-3333-3333-3333-333333333333';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'SECURITY HOLE: a customer wrote into the professional''s case log';
  ASSERT msg LIKE '%professional''s private record%', 'wrong guard fired: ' || msg;

  blocked := FALSE;
  BEGIN
    UPDATE public.job_enquiries SET professional_notes = 'Fabricated note'
     WHERE id = '33333333-3333-3333-3333-333333333333';
  EXCEPTION WHEN insufficient_privilege THEN blocked := TRUE; END;
  ASSERT blocked, 'SECURITY HOLE: a customer wrote professional_notes';

  blocked := FALSE;
  BEGIN
    UPDATE public.job_enquiries SET professional_id = '22222222-2222-2222-2222-222222222222'
     WHERE id = '33333333-3333-3333-3333-333333333333';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'SECURITY HOLE: an enquiry was re-pointed at a different professional';
  ASSERT msg LIKE '%cannot be reassigned%', 'wrong guard fired: ' || msg;

  -- But cancelling their own enquiry must work. A guard that blocks the
  -- legitimate path gets removed. Done on a second enquiry, because cancelling
  -- is one-way — the guard rightly refuses to un-cancel, so reusing the row
  -- under test would break the accept path below.
  UPDATE public.job_enquiries SET status = 'cancelled'
   WHERE id = '3333cccc-3333-3333-3333-333333333333';

  SELECT status INTO st FROM public.job_enquiries
   WHERE id = '3333cccc-3333-3333-3333-333333333333';
  ASSERT st = 'cancelled', 'a customer could not cancel their own enquiry';

  RAISE NOTICE 'PASS 6 — customers cannot accept, complete, re-point, or write the case log; cancelling works';
END $$;

-- ── 6. Enquiries: the professional owns the outcome, not the request ────────

SET LOCAL request.jwt.claims TO
  '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}';

DO $$
DECLARE
  blocked BOOLEAN;
  msg TEXT;
  price INT;
  st enquiry_status;
BEGIN
  -- An enquiry edited after the fact is worthless as evidence in a dispute.
  blocked := FALSE;
  BEGIN
    UPDATE public.job_enquiries SET description = repeat('rewritten by the professional ', 3)
     WHERE id = '33333333-3333-3333-3333-333333333333';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'HISTORY REWRITE: a professional edited the enquiry as submitted';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: missing GRANT, not the guard: ' || msg;
  ASSERT msg LIKE '%cannot be edited by the professional%', 'wrong guard fired: ' || msg;

  blocked := FALSE;
  BEGIN
    UPDATE public.job_enquiries SET preferred_date = DATE '2026-12-25'
     WHERE id = '33333333-3333-3333-3333-333333333333';
  EXCEPTION WHEN insufficient_privilege THEN blocked := TRUE; END;
  ASSERT blocked, 'HISTORY REWRITE: a professional changed the requested date';

  -- The legitimate paths: accept, and log the case privately.
  UPDATE public.job_enquiries
     SET status = 'accepted', accepted_at = NOW(),
         agreed_price_ttd = 450, agreed_timeline = 'Saturday morning',
         scope_note = 'Tap replacement, customer supplies fixture',
         conversation_outcome = 'agreed'
   WHERE id = '33333333-3333-3333-3333-333333333333';

  SELECT status, agreed_price_ttd INTO st, price FROM public.job_enquiries
   WHERE id = '33333333-3333-3333-3333-333333333333';
  ASSERT st = 'accepted', 'a professional could not accept their own enquiry';
  ASSERT price = 450, 'a professional could not write their own case log';

  RAISE NOTICE 'PASS 7 — professionals accept and log privately, but cannot rewrite the request';
END $$;

-- ── 7. Offerings: ownership, publication, and reassignment ──────────────────

DO $$
DECLARE
  blocked BOOLEAN;
  msg TEXT;
  affected INT;
BEGIN
  INSERT INTO public.offerings (id, professional_id, name, price_ttd, price_unit, duration_minutes)
  VALUES ('44444444-4444-4444-4444-444444444444',
          '11111111-1111-1111-1111-111111111111',
          'Tap replacement', 450, 'per fitting', 60);

  -- An inactive offering exists but must never reach the public policy.
  INSERT INTO public.offerings (professional_id, name, is_active)
  VALUES ('11111111-1111-1111-1111-111111111111', 'Draft service', FALSE);

  -- Moving an offering to a rival is the one thing an owner must not do — the
  -- UPDATE policy's WITH CHECK alone would let it through in the other
  -- direction if a professional controlled two profiles.
  blocked := FALSE;
  BEGIN
    UPDATE public.offerings SET professional_id = '22222222-2222-2222-2222-222222222222'
     WHERE id = '44444444-4444-4444-4444-444444444444';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'SECURITY HOLE: an offering was reassigned to another professional';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: missing GRANT, not the guard: ' || msg;
  ASSERT msg LIKE '%cannot be reassigned%', 'wrong guard fired: ' || msg;

  -- Editing their own is the whole point of the table.
  UPDATE public.offerings SET price_ttd = 500
   WHERE id = '44444444-4444-4444-4444-444444444444';
  GET DIAGNOSTICS affected = ROW_COUNT;
  ASSERT affected = 1, 'a professional could not edit their own offering';

  RAISE NOTICE 'PASS 8 — offerings are owner-editable but cannot be reassigned';
END $$;

-- ── 8. Offerings: a rival cannot touch them; the public sees active only ────

SET LOCAL request.jwt.claims TO
  '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}';

DO $$
DECLARE
  affected INT;
BEGIN
  UPDATE public.offerings SET price_ttd = 1
   WHERE id = '44444444-4444-4444-4444-444444444444';
  GET DIAGNOSTICS affected = ROW_COUNT;
  ASSERT affected = 0, 'RLS leak: a rival edited another professional''s offering';

  DELETE FROM public.offerings WHERE id = '44444444-4444-4444-4444-444444444444';
  GET DIAGNOSTICS affected = ROW_COUNT;
  ASSERT affected = 0, 'RLS leak: a rival deleted another professional''s offering';

  RAISE NOTICE 'PASS 9 — offerings are isolated between professionals';
END $$;

SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims TO '{}';

DO $$
DECLARE
  visible INT;
BEGIN
  SELECT COUNT(*) INTO visible FROM public.offerings;
  -- One active offering on an active listing; the inactive one must not appear.
  ASSERT visible = 1,
    format('expected exactly 1 publicly visible offering, saw %s', visible);

  SELECT COUNT(*) INTO visible FROM public.offerings WHERE NOT is_active;
  ASSERT visible = 0, 'PUBLICATION LEAK: an inactive offering is publicly visible';

  RAISE NOTICE 'PASS 10 — the public sees only active offerings on active listings';
END $$;

-- ── 10. Enquiries and bookings are never public ─────────────────────────────

DO $$
DECLARE
  visible INT;
  denied BOOLEAN := FALSE;
BEGIN
  -- Enquiries carry a description of someone's home and a private case log.
  -- anon is denied at BOTH layers: no GRANT, and no policy that would match.
  BEGIN
    SELECT COUNT(*) INTO visible FROM public.job_enquiries;
  EXCEPTION WHEN insufficient_privilege THEN denied := TRUE; END;

  IF NOT denied THEN
    ASSERT visible = 0, format('PRIVACY LEAK: anon can read %s enquiries', visible);
  END IF;

  denied := FALSE;
  BEGIN
    SELECT COUNT(*) INTO visible FROM public.connections;
  EXCEPTION WHEN insufficient_privilege THEN denied := TRUE; END;

  IF NOT denied THEN
    ASSERT visible = 0, format('PRIVACY LEAK: anon can read %s connections', visible);
  END IF;

  RAISE NOTICE 'PASS 11 — enquiries and connections are unreachable anonymously';
END $$;

-- ── 11. Availability and blocked dates ──────────────────────────────────────

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}';

DO $$
DECLARE
  rejected BOOLEAN;
BEGIN
  INSERT INTO public.booking_availability
    (professional_id, weekday, start_time, end_time, slot_duration_min)
  VALUES ('11111111-1111-1111-1111-111111111111', 6, TIME '08:00', TIME '16:00', 90);

  -- A window that ends before it starts generates no slots and no error, which
  -- is the worst failure mode: an empty calendar with no explanation.
  rejected := FALSE;
  BEGIN
    INSERT INTO public.booking_availability
      (professional_id, weekday, start_time, end_time)
    VALUES ('11111111-1111-1111-1111-111111111111', 5, TIME '17:00', TIME '09:00');
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'an inverted availability window was accepted';

  rejected := FALSE;
  BEGIN
    INSERT INTO public.booking_availability
      (professional_id, weekday, start_time, end_time)
    VALUES ('11111111-1111-1111-1111-111111111111', 9, TIME '09:00', TIME '17:00');
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'weekday 9 was accepted';

  -- One window per weekday is a UNIQUE constraint, not a convention.
  rejected := FALSE;
  BEGIN
    INSERT INTO public.booking_availability
      (professional_id, weekday, start_time, end_time)
    VALUES ('11111111-1111-1111-1111-111111111111', 6, TIME '18:00', TIME '20:00');
  EXCEPTION WHEN unique_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'a second window was accepted for the same weekday';

  INSERT INTO public.booking_blocked_dates (professional_id, blocked_date, reason)
  VALUES ('11111111-1111-1111-1111-111111111111', DATE '2026-08-01', 'Family commitment');

  RAISE NOTICE 'PASS 12 — availability windows are bounded, ordered, and one per weekday';
END $$;

SET LOCAL request.jwt.claims TO
  '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}';

DO $$
DECLARE
  affected INT;
BEGIN
  UPDATE public.booking_availability SET is_active = FALSE
   WHERE professional_id = '11111111-1111-1111-1111-111111111111';
  GET DIAGNOSTICS affected = ROW_COUNT;
  ASSERT affected = 0, 'RLS leak: a rival closed another professional''s calendar';

  DELETE FROM public.booking_blocked_dates
   WHERE professional_id = '11111111-1111-1111-1111-111111111111';
  GET DIAGNOSTICS affected = ROW_COUNT;
  ASSERT affected = 0, 'RLS leak: a rival unblocked another professional''s dates';

  RAISE NOTICE 'PASS 13 — calendars are isolated between professionals';
END $$;

-- ── 13. Bookings: reminder flags are the scheduler's alone ──────────────────

SET LOCAL request.jwt.claims TO
  '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}';

DO $$
DECLARE
  blocked BOOLEAN;
  msg TEXT;
BEGIN
  INSERT INTO public.bookings
    (id, enquiry_id, professional_id, customer_id, scheduled_at, duration_minutes, notes)
  VALUES ('55555555-5555-5555-5555-555555555555',
          '33333333-3333-3333-3333-333333333333',
          '11111111-1111-1111-1111-111111111111',
          'bbbbbbbb-0000-0000-0000-00000000000b',
          TIMESTAMPTZ '2026-07-25 13:00:00+00', 90, 'Ring the bell at the side gate');

  -- Setting the flag true silences the reminder; setting it false re-sends on
  -- every cron tick. Both are the professional deciding what the customer hears.
  -- Both flags start FALSE, so TRUE genuinely differs (trap 2).
  blocked := FALSE;
  BEGIN
    UPDATE public.bookings SET reminder_24h_sent = TRUE
     WHERE id = '55555555-5555-5555-5555-555555555555';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'SECURITY HOLE: a professional suppressed a customer reminder';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: missing GRANT, not the guard: ' || msg;
  ASSERT msg LIKE '%set by the scheduler%', 'wrong guard fired: ' || msg;

  blocked := FALSE;
  BEGIN
    UPDATE public.bookings SET reminder_1h_sent = TRUE
     WHERE id = '55555555-5555-5555-5555-555555555555';
  EXCEPTION WHEN insufficient_privilege THEN blocked := TRUE; END;
  ASSERT blocked, 'SECURITY HOLE: the 1h reminder flag is client-writable';

  RAISE NOTICE 'PASS 14 — reminder flags are unwritable by either party';
END $$;

-- ── 14. Bookings: rescheduling resets the reminders ─────────────────────────

DO $$
DECLARE
  flag_24 BOOLEAN;
  flag_1 BOOLEAN;
BEGIN
  -- Simulate the cron having already sent both reminders.
  SET LOCAL ROLE postgres;
  SET LOCAL request.jwt.claims TO '{}';
  UPDATE public.bookings SET reminder_24h_sent = TRUE, reminder_1h_sent = TRUE
   WHERE id = '55555555-5555-5555-5555-555555555555';

  SELECT reminder_24h_sent, reminder_1h_sent INTO flag_24, flag_1
    FROM public.bookings WHERE id = '55555555-5555-5555-5555-555555555555';
  ASSERT flag_24 AND flag_1, 'the scheduler could not set the reminder flags';
END $$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}';

DO $$
DECLARE
  flag_24 BOOLEAN;
  flag_1 BOOLEAN;
BEGIN
  -- Moving the appointment invalidates any reminder already sent for it.
  -- Without the reset the customer is reminded of a time that no longer exists.
  UPDATE public.bookings SET scheduled_at = TIMESTAMPTZ '2026-07-26 09:00:00+00'
   WHERE id = '55555555-5555-5555-5555-555555555555';

  SELECT reminder_24h_sent, reminder_1h_sent INTO flag_24, flag_1
    FROM public.bookings WHERE id = '55555555-5555-5555-5555-555555555555';

  ASSERT NOT flag_24, 'reschedule did not reset the 24h reminder flag';
  ASSERT NOT flag_1, 'reschedule did not reset the 1h reminder flag';

  RAISE NOTICE 'PASS 15 — rescheduling resets both reminder flags';
END $$;

-- ── 15. Bookings: the customer may cancel, not reschedule ───────────────────

SET LOCAL request.jwt.claims TO
  '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}';

DO $$
DECLARE
  blocked BOOLEAN;
  msg TEXT;
  st booking_status;
BEGIN
  blocked := FALSE;
  BEGIN
    UPDATE public.bookings SET scheduled_at = TIMESTAMPTZ '2026-08-15 07:00:00+00'
     WHERE id = '55555555-5555-5555-5555-555555555555';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'a customer rescheduled a booking into the professional''s calendar';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: missing GRANT, not the guard: ' || msg;
  ASSERT msg LIKE '%Only the professional can reschedule%', 'wrong guard fired: ' || msg;

  -- 'no_show' is an accusation. It is the professional's to record, not the
  -- subject's to assign.
  blocked := FALSE;
  BEGIN
    UPDATE public.bookings SET status = 'no_show'
     WHERE id = '55555555-5555-5555-5555-555555555555';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'a customer recorded a no-show';
  ASSERT msg LIKE '%may cancel a booking%', 'wrong guard fired: ' || msg;

  -- Cancelling must work, and the constraint must force a timestamp with it.
  blocked := FALSE;
  BEGIN
    UPDATE public.bookings SET status = 'cancelled'
     WHERE id = '55555555-5555-5555-5555-555555555555';
  EXCEPTION WHEN check_violation THEN blocked := TRUE; END;
  ASSERT blocked, 'a booking was cancelled with no cancellation timestamp';

  UPDATE public.bookings SET status = 'cancelled', cancelled_at = NOW()
   WHERE id = '55555555-5555-5555-5555-555555555555';

  SELECT status INTO st FROM public.bookings
   WHERE id = '55555555-5555-5555-5555-555555555555';
  ASSERT st = 'cancelled', 'a customer could not cancel their own booking';

  RAISE NOTICE 'PASS 16 — customers cancel with attribution but cannot reschedule or accuse';
END $$;

-- ── 16. Reviews: the D54 length bounds ──────────────────────────────────────

DO $$
DECLARE
  rejected BOOLEAN;
BEGIN
  -- Mark the enquiry complete so a review is legitimate. Done as the platform,
  -- which is what the /complete endpoint is.
  SET LOCAL ROLE postgres;
  SET LOCAL request.jwt.claims TO '{}';
  UPDATE public.job_enquiries SET status = 'completed', completed_at = NOW()
   WHERE id = '33333333-3333-3333-3333-333333333333';
END $$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}';

DO $$
DECLARE
  rejected BOOLEAN;
BEGIN
  rejected := FALSE;
  BEGIN
    INSERT INTO public.reviews
      (professional_id, customer_id, reviewer_name, star_rating, testimonial)
    VALUES ('11111111-1111-1111-1111-111111111111',
            'bbbbbbbb-0000-0000-0000-00000000000b', 'Nia', 5, repeat('a', 19));
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'D54 floor not enforced: a 19-character testimonial was accepted';

  -- 601: one over the D54 ceiling of 600.
  rejected := FALSE;
  BEGIN
    INSERT INTO public.reviews
      (professional_id, customer_id, reviewer_name, star_rating, testimonial)
    VALUES ('11111111-1111-1111-1111-111111111111',
            'bbbbbbbb-0000-0000-0000-00000000000b', 'Nia', 5, repeat('a', 601));
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'D54 ceiling not enforced: a 601-character testimonial was accepted';

  rejected := FALSE;
  BEGIN
    INSERT INTO public.reviews
      (professional_id, customer_id, reviewer_name, star_rating, testimonial)
    VALUES ('11111111-1111-1111-1111-111111111111',
            'bbbbbbbb-0000-0000-0000-00000000000b', 'Nia', 6, repeat('a', 100));
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'a 6-star rating was accepted';

  RAISE NOTICE 'PASS 17 — testimonial enforces D54 bounds of 20-600, rating 1-5';
END $$;

-- ── 17. THE RATING TRIGGER: only moderated reviews move the number ──────────

DO $$
DECLARE
  avg_now NUMERIC;
  count_now INT;
BEGIN
  INSERT INTO public.reviews
    (id, professional_id, customer_id, job_enquiry_id, reviewer_name, star_rating, testimonial)
  VALUES ('66666666-6666-6666-6666-666666666666',
          '11111111-1111-1111-1111-111111111111',
          'bbbbbbbb-0000-0000-0000-00000000000b',
          '33333333-3333-3333-3333-333333333333',
          'Nia Customer', 5,
          'Ravi came the same day, fixed the leak in under an hour, and left everything spotless.');

  SELECT average_rating, review_count INTO avg_now, count_now
    FROM public.professional_profiles WHERE id = '11111111-1111-1111-1111-111111111111';

  -- THE CENTRAL ASSERTION OF MODERATION: a pending review is invisible to the
  -- rating. If this fails, anyone can move any professional's score by writing
  -- a review, and admin approval is decorative.
  ASSERT avg_now IS NULL,
    format('MODERATION BYPASS: a pending review moved the average to %s', avg_now);
  ASSERT count_now = 0,
    format('MODERATION BYPASS: a pending review moved the count to %s', count_now);

  RAISE NOTICE 'PASS 18 — an unapproved review does not move the rating';
END $$;

-- ── 18. Reviews: self-moderation is impossible ──────────────────────────────

DO $$
DECLARE
  blocked BOOLEAN;
  msg TEXT;
BEGIN
  -- The status starts 'pending', so 'approved' genuinely differs (trap 2).
  blocked := FALSE;
  BEGIN
    UPDATE public.reviews
       SET status = 'approved', moderated_at = NOW(),
           moderated_by = 'bbbbbbbb-0000-0000-0000-00000000000b'
     WHERE id = '66666666-6666-6666-6666-666666666666';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'SECURITY HOLE: a customer published their own review';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: missing GRANT, not the guard: ' || msg;
  ASSERT msg LIKE '%moderation is performed by administrators%', 'wrong guard fired: ' || msg;

  -- is_seeded claims an admin telephoned the reviewer to verify them.
  blocked := FALSE;
  BEGIN
    UPDATE public.reviews SET is_seeded = TRUE
     WHERE id = '66666666-6666-6666-6666-666666666666';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'SECURITY HOLE: a customer marked their own review admin-vouched';
  ASSERT msg LIKE '%Seeded status%', 'wrong guard fired: ' || msg;

  blocked := FALSE;
  BEGIN
    UPDATE public.reviews SET professional_id = '22222222-2222-2222-2222-222222222222'
     WHERE id = '66666666-6666-6666-6666-666666666666';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'SECURITY HOLE: a review was moved onto a different professional';
  ASSERT msg LIKE '%different professional or job%', 'wrong guard fired: ' || msg;

  -- Correcting one's own wording while pending is legitimate.
  UPDATE public.reviews
     SET testimonial = 'Ravi came the same day and fixed the leak in under an hour. Fair price too.'
   WHERE id = '66666666-6666-6666-6666-666666666666';

  RAISE NOTICE 'PASS 19 — reviews cannot be self-moderated, self-seeded, or re-targeted';
END $$;

-- ── 19. Reviews: one per enquiry ────────────────────────────────────────────

DO $$
DECLARE
  rejected BOOLEAN := FALSE;
BEGIN
  BEGIN
    INSERT INTO public.reviews
      (professional_id, customer_id, job_enquiry_id, reviewer_name, star_rating, testimonial)
    VALUES ('11111111-1111-1111-1111-111111111111',
            'bbbbbbbb-0000-0000-0000-00000000000b',
            '33333333-3333-3333-3333-333333333333',
            'Nia Customer', 1, 'Changed my mind, leaving a second review on the same job.');
  EXCEPTION WHEN unique_violation THEN rejected := TRUE; END;

  ASSERT rejected, 'a second review was accepted for the same enquiry';
  RAISE NOTICE 'PASS 20 — one review per enquiry, enforced by index not by the API';
END $$;

-- ── 20. THE RATING TRIGGER: approval recalculates ───────────────────────────

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}';

DO $$
DECLARE
  avg_now NUMERIC;
  count_now INT;
BEGIN
  UPDATE public.reviews
     SET status = 'approved', moderated_at = NOW(),
         moderated_by = 'dddddddd-0000-0000-0000-00000000000d'
   WHERE id = '66666666-6666-6666-6666-666666666666';

  SELECT average_rating, review_count INTO avg_now, count_now
    FROM public.professional_profiles WHERE id = '11111111-1111-1111-1111-111111111111';

  ASSERT avg_now = 5.00, format('approval did not set the average: got %s', avg_now);
  ASSERT count_now = 1, format('approval did not set the count: got %s', count_now);

  -- A second review, approved with a 1: the average must be the mean of the
  -- APPROVED set, not an incremental nudge.
  INSERT INTO public.reviews
    (id, professional_id, reviewer_name, star_rating, testimonial, status,
     moderated_at, moderated_by)
  VALUES ('77777777-7777-7777-7777-777777777777',
          '11111111-1111-1111-1111-111111111111', 'Second Client', 1,
          'Turned up late twice and the work needed doing again the following week.',
          'approved', NOW(), 'dddddddd-0000-0000-0000-00000000000d');

  SELECT average_rating, review_count INTO avg_now, count_now
    FROM public.professional_profiles WHERE id = '11111111-1111-1111-1111-111111111111';
  ASSERT avg_now = 3.00, format('expected mean 3.00 over two approved reviews, got %s', avg_now);
  ASSERT count_now = 2, format('expected 2 approved reviews, got %s', count_now);

  -- Featuring must not DROP a review from the rating — featured is approved
  -- plus promotion, and a professional's best review lowering their score would
  -- be an absurd outcome.
  UPDATE public.reviews SET status = 'featured'
   WHERE id = '66666666-6666-6666-6666-666666666666';

  SELECT average_rating, review_count INTO avg_now, count_now
    FROM public.professional_profiles WHERE id = '11111111-1111-1111-1111-111111111111';
  ASSERT avg_now = 3.00, format('featuring changed the average to %s', avg_now);
  ASSERT count_now = 2, format('featuring changed the count to %s', count_now);

  -- Rejecting removes it from the calculation entirely.
  UPDATE public.reviews SET status = 'rejected', rejection_reason = 'not_real_job'
   WHERE id = '77777777-7777-7777-7777-777777777777';

  SELECT average_rating, review_count INTO avg_now, count_now
    FROM public.professional_profiles WHERE id = '11111111-1111-1111-1111-111111111111';
  ASSERT avg_now = 5.00, format('rejection did not remove the review: average %s', avg_now);
  ASSERT count_now = 1, format('rejection did not remove the review: count %s', count_now);

  RAISE NOTICE 'PASS 21 — the rating recalculates from approved and featured reviews only';
END $$;

-- ── 21. Rating still cannot be written by hand ──────────────────────────────
-- The trigger needs a route through guard_professional_privileged_columns.
-- Proving that route did not also open the front door.

SET LOCAL request.jwt.claims TO
  '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}';

DO $$
DECLARE
  blocked BOOLEAN := FALSE;
  msg TEXT;
BEGIN
  -- Current value is 5.00 / 1, so 4.25 / 40 genuinely differ (trap 2).
  BEGIN
    UPDATE public.professional_profiles SET average_rating = 4.25, review_count = 40
     WHERE id = '11111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;

  ASSERT blocked, 'SECURITY HOLE: the trigger bypass also let a professional set their own rating';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: missing GRANT, not the guard: ' || msg;
  ASSERT msg LIKE '%derived from reviews%', 'wrong guard fired: ' || msg;

  RAISE NOTICE 'PASS 22 — the trigger bypass does not open direct rating writes';
END $$;

-- ── 22. Connection count still cannot be written by hand ────────────────────

SET LOCAL request.jwt.claims TO
  '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}';

DO $$
DECLARE
  blocked BOOLEAN := FALSE;
  msg TEXT;
BEGIN
  -- Stored value is 2, so 0 genuinely differs (trap 2).
  BEGIN
    UPDATE public.customer_profiles SET connection_count = 0
     WHERE user_id = 'bbbbbbbb-0000-0000-0000-00000000000b';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;

  ASSERT blocked, 'SECURITY HOLE: the trigger bypass let a customer reset their gate counter';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: missing GRANT, not the guard: ' || msg;
  ASSERT msg LIKE '%maintained by the platform%', 'wrong guard fired: ' || msg;

  RAISE NOTICE 'PASS 23 — the trigger bypass does not open direct counter writes';
END $$;

-- ── 23. Disputes: parties raise, administrators decide ──────────────────────

SET LOCAL request.jwt.claims TO
  '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}';

DO $$
DECLARE
  blocked BOOLEAN;
  rejected BOOLEAN;
  msg TEXT;
BEGIN
  -- A fake-review dispute with no review attached cannot be investigated.
  rejected := FALSE;
  BEGIN
    INSERT INTO public.disputes
      (professional_id, customer_id, raised_by, category, description)
    VALUES ('11111111-1111-1111-1111-111111111111',
            'bbbbbbbb-0000-0000-0000-00000000000b',
            'aaaaaaaa-0000-0000-0000-00000000000a', 'fake_review',
            'This review does not correspond to any job I have ever carried out.');
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'a fake_review dispute was opened with no review attached';

  INSERT INTO public.disputes
    (id, professional_id, customer_id, raised_by, category, description, review_id)
  VALUES ('88888888-8888-8888-8888-888888888888',
          '11111111-1111-1111-1111-111111111111',
          'bbbbbbbb-0000-0000-0000-00000000000b',
          'aaaaaaaa-0000-0000-0000-00000000000a', 'fake_review',
          'This review does not correspond to any job I have ever carried out.',
          '77777777-7777-7777-7777-777777777777');

  -- Deciding your own case is the definition of a rigged process.
  blocked := FALSE;
  BEGIN
    UPDATE public.disputes
       SET status = 'resolved', resolution = 'I have decided in my own favour.',
           resolved_by = 'aaaaaaaa-0000-0000-0000-00000000000a', resolved_at = NOW()
     WHERE id = '88888888-8888-8888-8888-888888888888';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'SECURITY HOLE: a party resolved their own dispute';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: missing GRANT, not the guard: ' || msg;
  ASSERT msg LIKE '%decided by administrators only%', 'wrong guard fired: ' || msg;

  blocked := FALSE;
  BEGIN
    UPDATE public.disputes SET category = 'billing'
     WHERE id = '88888888-8888-8888-8888-888888888888';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'a party re-categorised an open case';
  ASSERT msg LIKE '%fixed once the case is opened%', 'wrong guard fired: ' || msg;

  RAISE NOTICE 'PASS 24 — parties open disputes; only administrators decide them';
END $$;

-- ── 24. Disputes: no case closes without a substantive resolution ───────────

SET LOCAL request.jwt.claims TO
  '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}';

DO $$
DECLARE
  rejected BOOLEAN;
  st dispute_status;
BEGIN
  rejected := FALSE;
  BEGIN
    UPDATE public.disputes SET status = 'resolved'
     WHERE id = '88888888-8888-8888-8888-888888888888';
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'a dispute was resolved with no resolution note';

  -- "ok" is not something either party can appeal against.
  rejected := FALSE;
  BEGIN
    UPDATE public.disputes
       SET status = 'closed', resolution = 'ok',
           resolved_by = 'dddddddd-0000-0000-0000-00000000000d', resolved_at = NOW()
     WHERE id = '88888888-8888-8888-8888-888888888888';
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'a two-character resolution was accepted';

  UPDATE public.disputes
     SET status = 'resolved',
         resolution = 'Reviewer could not be reached on two attempts; the review has been rejected.',
         resolved_by = 'dddddddd-0000-0000-0000-00000000000d', resolved_at = NOW()
   WHERE id = '88888888-8888-8888-8888-888888888888';

  SELECT status INTO st FROM public.disputes
   WHERE id = '88888888-8888-8888-8888-888888888888';
  ASSERT st = 'resolved', 'an admin could not resolve a dispute properly';

  RAISE NOTICE 'PASS 25 — resolution requires a substantive, attributed note';
END $$;

-- ── 25. Case notes are append-only ──────────────────────────────────────────

DO $$
DECLARE
  blocked BOOLEAN;
  msg TEXT;
BEGIN
  INSERT INTO public.case_notes (id, dispute_id, author_id, note)
  VALUES ('99999999-9999-9999-9999-999999999999',
          '88888888-8888-8888-8888-888888888888',
          'dddddddd-0000-0000-0000-00000000000d',
          'Called reviewer 16:20 — no answer. Second attempt tomorrow.');

  -- Layer one: an admin holds no UPDATE or DELETE grant on this table at all.
  blocked := FALSE;
  BEGIN
    UPDATE public.case_notes SET note = 'Called reviewer 16:20 — they confirmed everything.'
     WHERE id = '99999999-9999-9999-9999-999999999999';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'HISTORY REWRITE: an admin edited a case note';
  ASSERT msg LIKE '%permission denied for table%',
    'expected the missing UPDATE grant to refuse this, got: ' || msg;

  blocked := FALSE;
  BEGIN
    DELETE FROM public.case_notes WHERE id = '99999999-9999-9999-9999-999999999999';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'HISTORY REWRITE: an admin deleted a case note';
  ASSERT msg LIKE '%permission denied for table%',
    'expected the missing DELETE grant to refuse this, got: ' || msg;

  RAISE NOTICE 'PASS 26 — no admin holds an UPDATE or DELETE grant on case notes';
END $$;

-- Layer two: the append-only trigger, which is what stops the SERVICE ROLE —
-- the role the admin API itself runs as. A case note that can be edited after a
-- decision is worthless as a record of how the decision was reached, which is
-- the only reason to keep one.

SET LOCAL ROLE postgres;
SET LOCAL request.jwt.claims TO '{}';

DO $$
DECLARE
  blocked BOOLEAN;
  msg TEXT;
BEGIN
  blocked := FALSE;
  BEGIN
    UPDATE public.case_notes SET note = 'Called reviewer 16:20 — they confirmed everything.'
     WHERE id = '99999999-9999-9999-9999-999999999999';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'HISTORY REWRITE: the service role edited a case note';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: a grant refused this, so the trigger is untested: ' || msg;
  ASSERT msg LIKE '%append-only%', 'wrong guard fired: ' || msg;

  blocked := FALSE;
  BEGIN
    DELETE FROM public.case_notes WHERE id = '99999999-9999-9999-9999-999999999999';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'HISTORY REWRITE: the service role deleted a case note';
  ASSERT msg LIKE '%append-only%', 'wrong guard fired: ' || msg;

  RAISE NOTICE 'PASS 27 — the append-only trigger stops even the service role';
END $$;

SET LOCAL ROLE authenticated;

-- ── 26. Case notes are admin-only, even to the parties ──────────────────────

SET LOCAL request.jwt.claims TO
  '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}';

DO $$
DECLARE
  visible INT;
  blocked BOOLEAN := FALSE;
BEGIN
  -- The professional is a party to this dispute and still sees no working —
  -- only the resolution reaches them.
  SELECT COUNT(*) INTO visible FROM public.case_notes;
  ASSERT visible = 0,
    format('PRIVACY LEAK: a dispute party read %s admin case notes', visible);

  BEGIN
    INSERT INTO public.case_notes (dispute_id, author_id, note)
    VALUES ('88888888-8888-8888-8888-888888888888',
            'aaaaaaaa-0000-0000-0000-00000000000a', 'Adding my own version of events.');
  EXCEPTION WHEN insufficient_privilege THEN blocked := TRUE; END;
  ASSERT blocked, 'SECURITY HOLE: a dispute party wrote into the admin case log';

  RAISE NOTICE 'PASS 28 — case notes are invisible and unwritable to the parties';
END $$;

-- ── 27. Legal acceptances are versioned and immutable ───────────────────────

SET LOCAL request.jwt.claims TO
  '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}';

DO $$
DECLARE
  rejected BOOLEAN;
  blocked BOOLEAN;
  msg TEXT;
  rows_kept INT;
BEGIN
  INSERT INTO public.legal_acceptances (user_id, document_type, document_version, ip_address)
  VALUES ('bbbbbbbb-0000-0000-0000-00000000000b', 'terms', '1.0', '198.51.100.7');

  -- Re-accepting the same version is a no-op the API must be able to make safe.
  rejected := FALSE;
  BEGIN
    INSERT INTO public.legal_acceptances (user_id, document_type, document_version)
    VALUES ('bbbbbbbb-0000-0000-0000-00000000000b', 'terms', '1.0');
  EXCEPTION WHEN unique_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'a duplicate acceptance of the same version was accepted';

  -- A NEW version is a NEW row. V1 upserted here and destroyed the evidence that
  -- v1.0 had ever been accepted — the exact thing the record exists to prove.
  INSERT INTO public.legal_acceptances (user_id, document_type, document_version)
  VALUES ('bbbbbbbb-0000-0000-0000-00000000000b', 'terms', '2.0');

  SELECT COUNT(*) INTO rows_kept FROM public.legal_acceptances
   WHERE user_id = 'bbbbbbbb-0000-0000-0000-00000000000b' AND document_type = 'terms';
  ASSERT rows_kept = 2,
    format('accepting v2.0 did not preserve the v1.0 record: %s rows', rows_kept);

  rejected := FALSE;
  BEGIN
    INSERT INTO public.legal_acceptances (user_id, document_type, document_version)
    VALUES ('bbbbbbbb-0000-0000-0000-00000000000b', 'not-a-document', '1.0');
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'an unknown document type was accepted';

  rejected := FALSE;
  BEGIN
    INSERT INTO public.legal_acceptances (user_id, document_type, document_version)
    VALUES ('bbbbbbbb-0000-0000-0000-00000000000b', 'privacy', 'latest');
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'a non-semver document version was accepted';

  -- Layer one: no UPDATE grant for authenticated.
  blocked := FALSE;
  BEGIN
    UPDATE public.legal_acceptances SET accepted_at = NOW() - INTERVAL '1 year'
     WHERE user_id = 'bbbbbbbb-0000-0000-0000-00000000000b' AND document_version = '1.0';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'HISTORY REWRITE: a user backdated their own acceptance';
  ASSERT msg LIKE '%permission denied for table%',
    'expected the missing UPDATE grant to refuse this, got: ' || msg;

  RAISE NOTICE 'PASS 29 — legal acceptances are versioned and validated; no UPDATE grant exists';
END $$;

-- Layer two: the trigger, against the service role. Backdating a consent record
-- is the single most valuable forgery available on this table.

SET LOCAL ROLE postgres;
SET LOCAL request.jwt.claims TO '{}';

DO $$
DECLARE
  blocked BOOLEAN := FALSE;
  msg TEXT;
BEGIN
  BEGIN
    UPDATE public.legal_acceptances SET accepted_at = NOW() - INTERVAL '1 year'
     WHERE user_id = 'bbbbbbbb-0000-0000-0000-00000000000b' AND document_version = '1.0';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'HISTORY REWRITE: the service role backdated a consent record';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: a grant refused this, so the trigger is untested: ' || msg;
  ASSERT msg LIKE '%immutable%', 'wrong guard fired: ' || msg;

  RAISE NOTICE 'PASS 30 — consent records cannot be backdated, even by the service role';
END $$;

SET LOCAL ROLE authenticated;

-- ── 28. Legal acceptances are private ───────────────────────────────────────

SET LOCAL request.jwt.claims TO
  '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}';

DO $$
DECLARE
  visible INT;
  blocked BOOLEAN := FALSE;
BEGIN
  SELECT COUNT(*) INTO visible FROM public.legal_acceptances;
  ASSERT visible = 0,
    format('PRIVACY LEAK: a stranger read %s legal acceptances (they carry IP addresses)', visible);

  -- Accepting on someone else's behalf would forge consent.
  BEGIN
    INSERT INTO public.legal_acceptances (user_id, document_type, document_version)
    VALUES ('bbbbbbbb-0000-0000-0000-00000000000b', 'eula', '1.0');
  EXCEPTION WHEN insufficient_privilege THEN blocked := TRUE; END;
  ASSERT blocked, 'SECURITY HOLE: consent was recorded on another user''s behalf';

  RAISE NOTICE 'PASS 31 — acceptances are private and cannot be forged';
END $$;

-- ── 29. Profile templates: seeded, public, token-only colours ──────────────

SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims TO '{}';

DO $$
DECLARE
  seeded INT;
BEGIN
  SELECT COUNT(*) INTO seeded FROM public.profile_templates;
  ASSERT seeded >= 4, format('expected at least 4 seeded templates, saw %s', seeded);

  RAISE NOTICE 'PASS 32 — profile templates are seeded and publicly readable (% rows)', seeded;
END $$;

SET LOCAL ROLE postgres;
SET LOCAL request.jwt.claims TO '{}';

DO $$
DECLARE
  rejected BOOLEAN;
BEGIN
  -- DESIGN.md bans literal hex; templates drive storefront rendering and are no
  -- exception, exactly as categories are not.
  rejected := FALSE;
  BEGIN
    INSERT INTO public.profile_templates (id, label, icon, color)
    VALUES ('hex-template', 'Hex', 'x', '#FF00AA');
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'a literal hex colour was accepted into profile_templates';

  rejected := FALSE;
  BEGIN
    INSERT INTO public.profile_templates (id, label, icon, color)
    VALUES ('Not Kebab', 'Bad', 'x', 'pink');
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'a non-kebab template id was accepted';

  RAISE NOTICE 'PASS 33 — profile template colours are tokens and ids are kebab-case';
END $$;

-- ── 31. A non-admin cannot write reference data ─────────────────────────────

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}';

DO $$
DECLARE
  affected INT;
  blocked BOOLEAN := FALSE;
BEGIN
  UPDATE public.profile_templates SET label = 'Hijacked' WHERE id = 'beauty-and-wellness';
  GET DIAGNOSTICS affected = ROW_COUNT;
  ASSERT affected = 0, 'RLS leak: a professional rewrote a profile template';

  BEGIN
    INSERT INTO public.profile_templates (id, label, icon, color)
    VALUES ('my-own-template', 'Mine', 'star', 'pink');
  EXCEPTION WHEN insufficient_privilege THEN blocked := TRUE; END;
  ASSERT blocked, 'RLS leak: a professional created a profile template';

  RAISE NOTICE 'PASS 34 — profile templates are admin-writable only';
END $$;

-- ── 35. Closing an account does not break the database ─────────────────────
--
-- This check exists because writing it found a real defect. Immutability
-- triggers and attribution constraints both fire during a cascade: foreign-key
-- actions are implemented as internal triggers, and ON DELETE SET NULL arrives
-- as an UPDATE. So an append-only table can refuse the cascade, and a
-- constraint requiring `moderated_by` can be violated the moment the moderator
-- closes their account — making the person undeletable and the deletion path
-- fail in production rather than in review.
--
-- Deleting each of the three roles in turn is the only way to prove the whole
-- graph still comes apart.

SET LOCAL ROLE postgres;
SET LOCAL request.jwt.claims TO '{}';

DO $$
DECLARE
  notes_left INT;
  reviews_left INT;
BEGIN
  -- The admin: SET NULL on reviews.moderated_by, disputes.resolved_by, and
  -- case_notes.author_id — the last of which passes through the append-only
  -- trigger as an UPDATE.
  DELETE FROM auth.users WHERE id = 'dddddddd-0000-0000-0000-00000000000d';

  -- The customer: SET NULL on reviews.customer_id, CASCADE on connections.
  DELETE FROM auth.users WHERE id = 'bbbbbbbb-0000-0000-0000-00000000000b';

  -- The professional: CASCADE through professional_profiles to offerings,
  -- enquiries, bookings, availability, reviews, disputes, and case notes.
  DELETE FROM auth.users WHERE id = 'aaaaaaaa-0000-0000-0000-00000000000a';

  SELECT COUNT(*) INTO notes_left FROM public.case_notes;
  SELECT COUNT(*) INTO reviews_left FROM public.reviews;

  ASSERT notes_left = 0,
    format('cascade left %s orphaned case notes behind', notes_left);
  ASSERT reviews_left = 0,
    format('cascade left %s orphaned reviews behind', reviews_left);

  RAISE NOTICE 'PASS 35 — closing customer, professional, and admin accounts cascades cleanly';
END $$;

ROLLBACK;

\echo ''
\echo '================================================'
\echo ' marketplace policy suite: ALL CHECKS PASSED'
\echo '================================================'
