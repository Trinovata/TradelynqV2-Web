-- ============================================================================
-- Policy and constraint tests for the commerce tables (playbook S037–S040):
-- subscription_plans, subscriptions, payments, quotes, jobs, job_logs,
-- invoices, recurring_invoices, tool_credit_accounts/ledger/bundles,
-- client_contacts, user_activity_log, admin_audit_log, store_orders.
--
-- This is money code, so the assertions are written against the four ways this
-- kind of test lies:
--
--   1. A missing GRANT raises "permission denied for table" — SQLSTATE 42501,
--      the SAME insufficient_privilege the column guards raise deliberately.
--      Catching the code proves nothing. Every guard assertion below also
--      asserts the message is NOT the GRANT failure AND asserts the specific
--      text of the guard that was supposed to fire.
--
--   2. Guards compare with IS DISTINCT FROM, so writing a column back to its
--      current value raises nothing and the test passes having tested nothing.
--      Every probe value below genuinely differs from what is stored.
--
--   3. SET LOCAL request.jwt.claims SURVIVES SET LOCAL ROLE. Acting as the
--      service role means clearing the claims too, or auth.uid() is still the
--      previous user and the guards still fire.
--
--   4. A concurrency test that runs in one session tests nothing about
--      concurrency. §14 opens a genuinely separate database session and proves
--      the second caller BLOCKS on the row lock rather than reading a stale
--      balance — which is the only thing standing between the platform and
--      double-spent credits.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

BEGIN;

-- ── Fixtures ────────────────────────────────────────────────────────────────

INSERT INTO auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_user_meta_data, created_at, updated_at)
VALUES
  ('aaaa1111-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'cpro@tradelynq.test', 'x', NOW(), jsonb_build_object('full_name', 'Kavita Pro'), NOW(), NOW()),
  ('bbbb1111-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ccust@tradelynq.test', 'x', NOW(), jsonb_build_object('full_name', 'Anand Customer'), NOW(), NOW()),
  ('cccc1111-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'crival@tradelynq.test', 'x', NOW(), jsonb_build_object('full_name', 'Rival Pro'), NOW(), NOW()),
  ('dddd1111-0000-0000-0000-0000000000d1',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'cadmin@tradelynq.test', 'x', NOW(), jsonb_build_object('full_name', 'Admin Zane'), NOW(), NOW());

UPDATE public.profiles
   SET role = 'professional', professional_subtype = 'sole_trader', role_confirmed = TRUE
 WHERE id IN ('aaaa1111-0000-0000-0000-0000000000a1', 'cccc1111-0000-0000-0000-0000000000c1');

UPDATE public.profiles
   SET role = 'customer', role_confirmed = TRUE
 WHERE id = 'bbbb1111-0000-0000-0000-0000000000b1';

UPDATE public.profiles
   SET role = 'admin', role_confirmed = TRUE
 WHERE id = 'dddd1111-0000-0000-0000-0000000000d1';

INSERT INTO public.customer_profiles (user_id, area)
VALUES ('bbbb1111-0000-0000-0000-0000000000b1', 'Sangre Grande');

INSERT INTO public.professional_profiles
  (id, user_id, business_name, owner_name, category_id, service_areas, listing_status)
VALUES
  ('31111111-1111-1111-1111-111111111111',
   'aaaa1111-0000-0000-0000-0000000000a1', 'Kavita AC Services', 'Kavita Pro',
   (SELECT id FROM public.categories WHERE parent_slug IS NOT NULL ORDER BY slug LIMIT 1),
   ARRAY['Sangre Grande'], 'active'),
  ('32222222-2222-2222-2222-222222222222',
   'cccc1111-0000-0000-0000-0000000000c1', 'Rival Cooling Ltd', 'Rival Pro',
   (SELECT id FROM public.categories WHERE parent_slug IS NOT NULL ORDER BY slug LIMIT 1),
   ARRAY['Arima'], 'active');

-- ============================================================================
-- 1. subscription_plans mirror pricing v3.1 exactly
-- ============================================================================
--
-- The seeded prices ARE the prices customers are charged. A drift between this
-- table and lib/constants/pricing.ts is a professional billed one amount and
-- shown another, so the assertion is literal and to the dollar.

DO $$
DECLARE
  n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.subscription_plans;
  ASSERT n = 5, format('expected 5 tiers, found %s', n);

  ASSERT (SELECT monthly_price_ttd FROM public.subscription_plans WHERE tier = 'presence') = 200,
    'presence must be TTD 200 (pricing v3.1)';
  ASSERT (SELECT monthly_price_ttd FROM public.subscription_plans WHERE tier = 'growth') = 700,
    'growth must be TTD 700 (pricing v3.1)';
  ASSERT (SELECT monthly_price_ttd FROM public.subscription_plans WHERE tier = 'studio') = 1300,
    'studio must be TTD 1300 (pricing v3.1)';
  ASSERT (SELECT monthly_price_ttd FROM public.subscription_plans WHERE tier = 'pro') = 2100,
    'pro must be TTD 2100 (pricing v3.1)';
  ASSERT (SELECT monthly_price_ttd FROM public.subscription_plans WHERE tier = 'enterprise') = 3500,
    'enterprise must be TTD 3500 (pricing v3.1)';

  -- The credit allowances gate real spend; a wrong one hands away AI tools.
  ASSERT (SELECT monthly_tool_credits FROM public.subscription_plans WHERE tier = 'presence') = 0,
    'presence includes no credits';
  ASSERT (SELECT monthly_tool_credits FROM public.subscription_plans WHERE tier = 'growth') = 50,
    'growth includes 50 credits';
  ASSERT (SELECT monthly_tool_credits FROM public.subscription_plans WHERE tier = 'studio') = 200,
    'studio includes 200 credits';
  ASSERT (SELECT monthly_tool_credits FROM public.subscription_plans WHERE tier = 'pro') = 500,
    'pro includes 500 credits';
  ASSERT (SELECT monthly_tool_credits FROM public.subscription_plans WHERE tier = 'enterprise') IS NULL,
    'enterprise credits are unlimited, represented as NULL';

  -- Feature flags drive requireTierFeature(). CRM is Studio and above.
  ASSERT (SELECT bool_and(NOT includes_crm) FROM public.subscription_plans
           WHERE tier IN ('presence', 'growth')),
    'CRM must not be included below Studio';
  ASSERT (SELECT bool_and(includes_crm) FROM public.subscription_plans
           WHERE tier IN ('studio', 'pro', 'enterprise')),
    'CRM must be included from Studio up';
  ASSERT (SELECT includes_webhooks AND includes_n8n FROM public.subscription_plans
           WHERE tier = 'enterprise'),
    'webhooks and n8n are Enterprise';
  ASSERT NOT EXISTS (SELECT 1 FROM public.subscription_plans
                      WHERE includes_webhooks AND tier <> 'enterprise'),
    'webhooks must not leak below Enterprise';

  RAISE NOTICE 'PASS 1 — subscription_plans match pricing v3.1 to the dollar';
END $$;

-- ============================================================================
-- 2. Only ONE live subscription per professional
-- ============================================================================

INSERT INTO public.subscriptions
  (id, professional_id, plan_id, status, current_period_start, current_period_end)
VALUES
  ('51111111-1111-1111-1111-111111111111',
   '31111111-1111-1111-1111-111111111111',
   (SELECT id FROM public.subscription_plans WHERE tier = 'growth'),
   'active', NOW() - INTERVAL '5 days', NOW() + INTERVAL '25 days');

DO $$
DECLARE
  rejected BOOLEAN;
BEGIN
  -- A second ACTIVE subscription is the double-billing bug. Two concurrent
  -- checkout callbacks both seeing "no subscription" is precisely the race this
  -- index exists to lose safely.
  rejected := FALSE;
  BEGIN
    INSERT INTO public.subscriptions
      (professional_id, plan_id, status, current_period_start, current_period_end)
    VALUES
      ('31111111-1111-1111-1111-111111111111',
       (SELECT id FROM public.subscription_plans WHERE tier = 'pro'),
       'active', NOW(), NOW() + INTERVAL '30 days');
  EXCEPTION WHEN unique_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'DOUBLE BILLING: a second active subscription was accepted';

  -- 'paused' also occupies the slot: resuming beside a second row produces two.
  rejected := FALSE;
  BEGIN
    INSERT INTO public.subscriptions
      (professional_id, plan_id, status, current_period_start, current_period_end)
    VALUES
      ('31111111-1111-1111-1111-111111111111',
       (SELECT id FROM public.subscription_plans WHERE tier = 'presence'),
       'paused', NOW(), NOW() + INTERVAL '30 days');
  EXCEPTION WHEN unique_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'a paused subscription was allowed beside an active one';

  -- A CANCELLED one may coexist: leaving and coming back must be possible, and
  -- the old row is a revenue record that stays.
  INSERT INTO public.subscriptions
    (professional_id, plan_id, status, cancelled_at,
     current_period_start, current_period_end)
  VALUES
    ('31111111-1111-1111-1111-111111111111',
     (SELECT id FROM public.subscription_plans WHERE tier = 'presence'),
     'cancelled', NOW() - INTERVAL '1 year',
     NOW() - INTERVAL '13 months', NOW() - INTERVAL '12 months');

  RAISE NOTICE 'PASS 2 — exactly one live subscription per professional; cancelled history coexists';
END $$;

-- ============================================================================
-- 3. Subscription constraints that protect money
-- ============================================================================

DO $$
DECLARE
  rejected BOOLEAN;
BEGIN
  -- The crossover rate applies after six PAID months. Stamping it earlier is
  -- charging +TTD $150 before it is owed.
  rejected := FALSE;
  BEGIN
    UPDATE public.subscriptions
       SET crossover_applied_at = NOW()
     WHERE id = '51111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'crossover was stamped at paid_months = 0';

  -- A trial with no end date never ends.
  rejected := FALSE;
  BEGIN
    INSERT INTO public.subscriptions
      (professional_id, plan_id, status, current_period_start, current_period_end)
    VALUES
      ('32222222-2222-2222-2222-222222222222',
       (SELECT id FROM public.subscription_plans WHERE tier = 'growth'),
       'trialling', NOW(), NOW() + INTERVAL '30 days');
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'a trialling subscription with no trial_ends_at was accepted';

  -- Pioneer enrolment must name the category its cap was counted against.
  rejected := FALSE;
  BEGIN
    INSERT INTO public.subscriptions
      (professional_id, plan_id, status, pioneer,
       current_period_start, current_period_end)
    VALUES
      ('32222222-2222-2222-2222-222222222222',
       (SELECT id FROM public.subscription_plans WHERE tier = 'growth'),
       'active', TRUE, NOW(), NOW() + INTERVAL '30 days');
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'a Pioneer enrolment with no category was accepted';

  RAISE NOTICE 'PASS 3 — crossover, trial, and Pioneer invariants hold';
END $$;

-- ============================================================================
-- 4. A professional cannot edit their own subscription state
-- ============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"aaaa1111-0000-0000-0000-0000000000a1","role":"authenticated"}';

DO $$
DECLARE
  blocked BOOLEAN;
  msg TEXT;
  pro_plan UUID := (SELECT id FROM public.subscription_plans WHERE tier = 'pro');
BEGIN
  -- TIER. The whole subscription business in one column: a self-served plan_id
  -- change is Enterprise for the price of Growth.
  blocked := FALSE;
  BEGIN
    UPDATE public.subscriptions SET plan_id = pro_plan
     WHERE id = '51111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'FREE UPGRADE: a professional changed their own tier';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: a missing GRANT refused this, so the guard is untested: ' || msg;
  ASSERT msg LIKE '%tier changes through billing%', 'wrong guard fired: ' || msg;

  -- STATUS. 'active' is the difference between a live listing and a dark one.
  blocked := FALSE;
  BEGIN
    UPDATE public.subscriptions SET status = 'trialling', trial_ends_at = NOW() + INTERVAL '1 year'
     WHERE id = '51111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'a professional set their own subscription status';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: a missing GRANT refused this: ' || msg;
  ASSERT msg LIKE '%status is set by billing%', 'wrong guard fired: ' || msg;

  RAISE NOTICE 'PASS 4 — tier and status are not the subscriber''s to write';
END $$;

-- The crossover clock is probed separately, because the probe has to be a
-- GENUINE change to be worth anything (trap 2): the stored value is seeded to 4
-- by the billing engine here, so the professional's attempt to write 0 below is
-- a real difference rather than an IS DISTINCT FROM no-op.
SET LOCAL ROLE postgres;
SET LOCAL request.jwt.claims TO '{}';  -- trap 3: claims survive the role change
UPDATE public.subscriptions SET paid_months = 4
 WHERE id = '51111111-1111-1111-1111-111111111111';

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"aaaa1111-0000-0000-0000-0000000000a1","role":"authenticated"}';

DO $$
DECLARE
  blocked BOOLEAN;
  msg TEXT;
  stored INT;
BEGIN
  SELECT paid_months INTO stored FROM public.subscriptions
   WHERE id = '51111111-1111-1111-1111-111111111111';
  ASSERT stored = 4, format('fixture paid_months should be 4, is %s', stored);

  blocked := FALSE;
  BEGIN
    -- 0 <> 4: a genuine change, not an IS DISTINCT FROM no-op (trap 2).
    UPDATE public.subscriptions SET paid_months = 0
     WHERE id = '51111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'CROSSOVER EVASION: a sole trader reset their own paid_months';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: a missing GRANT refused this: ' || msg;
  ASSERT msg LIKE '%crossover clock is maintained by billing%', 'wrong guard fired: ' || msg;

  -- Pioneer self-enrolment bypasses both programme caps.
  blocked := FALSE;
  BEGIN
    UPDATE public.subscriptions SET pioneer = TRUE
     WHERE id = '51111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'a professional enrolled themselves in the Pioneer programme';
  ASSERT msg LIKE '%Pioneer enrolment is granted at checkout%', 'wrong guard fired: ' || msg;

  -- And the one thing they MAY do. Without a writable column the UPDATE grant
  -- would be pointless and every guard assertion above would be untestable.
  UPDATE public.subscriptions SET cancellation_requested_at = NOW()
   WHERE id = '51111111-1111-1111-1111-111111111111';
  ASSERT (SELECT cancellation_requested_at IS NOT NULL FROM public.subscriptions
           WHERE id = '51111111-1111-1111-1111-111111111111'),
    'a professional could not request cancellation';

  RAISE NOTICE 'PASS 5 — crossover clock and Pioneer flag are billing''s; cancellation intent is the subscriber''s';
END $$;

-- ============================================================================
-- 5. A stranger sees no subscriptions and no payments
-- ============================================================================

SET LOCAL ROLE postgres;
SET LOCAL request.jwt.claims TO '{}';

INSERT INTO public.payments
  (subscription_id, professional_id, kind, amount_ttd, payment_method, status,
   paid_at, billing_period_key)
VALUES
  ('51111111-1111-1111-1111-111111111111', '31111111-1111-1111-1111-111111111111',
   'subscription', 700, 'stripe', 'successful', NOW(), '2026-07');

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"cccc1111-0000-0000-0000-0000000000c1","role":"authenticated"}';

DO $$
DECLARE
  visible INT;
  blocked BOOLEAN;
  msg TEXT;
BEGIN
  SELECT COUNT(*) INTO visible FROM public.subscriptions;
  ASSERT visible = 0, format('LEAK: a rival saw %s subscriptions', visible);

  SELECT COUNT(*) INTO visible FROM public.payments;
  ASSERT visible = 0, format('LEAK: a rival saw %s payments', visible);

  -- No client role holds INSERT on payments at all. A forged 'successful'
  -- payment row is a forged receipt, so the refusal happens at the grant layer
  -- — before any policy or trigger is consulted.
  blocked := FALSE;
  BEGIN
    INSERT INTO public.payments
      (professional_id, kind, amount_ttd, payment_method, status, paid_at)
    VALUES ('32222222-2222-2222-2222-222222222222', 'subscription', 1, 'manual',
            'successful', NOW());
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'FORGED RECEIPT: a professional inserted their own payment row';
  -- Asserted POSITIVELY here, unlike the guard tests: the absent grant IS the
  -- control being tested, so this is the message we want to see.
  ASSERT msg LIKE '%permission denied for table%',
    'expected the missing INSERT grant to refuse this, got: ' || msg;

  RAISE NOTICE 'PASS 6 — subscriptions and payments are private; payments are unwritable by clients';
END $$;

-- ============================================================================
-- 6. Quotes: totals must close, sent quotes freeze, sellers do not self-accept
-- ============================================================================

SET LOCAL request.jwt.claims TO
  '{"sub":"aaaa1111-0000-0000-0000-0000000000a1","role":"authenticated"}';

DO $$
DECLARE
  rejected BOOLEAN;
  tok TEXT;
BEGIN
  -- Arithmetic that does not close is refused, whatever the client sent.
  rejected := FALSE;
  BEGIN
    INSERT INTO public.quotes
      (professional_id, customer_name, subtotal_ttd, vat_amount_ttd, total_ttd)
    VALUES ('31111111-1111-1111-1111-111111111111', 'Dev Maharaj', 750, 0, 900);
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'a quote whose total disagreed with its own lines was accepted';

  INSERT INTO public.quotes
    (id, professional_id, customer_name, customer_email,
     line_items, subtotal_ttd, vat_percent, vat_amount_ttd, total_ttd, valid_until)
  VALUES
    ('61111111-1111-1111-1111-111111111111',
     '31111111-1111-1111-1111-111111111111', 'Dev Maharaj', 'dev.m@example.com',
     '[{"description":"3-zone AC service","quantity":3,"unit_price":250,"amount":750}]'::jsonb,
     750, 0, 0, 750, CURRENT_DATE + 14);

  -- The token is generated, never supplied, and carries real entropy.
  SELECT public_token INTO tok FROM public.quotes
   WHERE id = '61111111-1111-1111-1111-111111111111';
  ASSERT tok LIKE 'qt_tok_%' AND length(tok) = 71,
    format('quote token has the wrong shape: %s', tok);

  RAISE NOTICE 'PASS 7 — quote totals must close; the public token is server-generated';
END $$;

DO $$
DECLARE
  blocked BOOLEAN;
  msg TEXT;
BEGIN
  -- Sending a draft is the professional's move, and the only status move theirs.
  UPDATE public.quotes SET status = 'sent', sent_at = NOW()
   WHERE id = '61111111-1111-1111-1111-111111111111';

  -- Self-acceptance manufactures the customer's agreement.
  blocked := FALSE;
  BEGIN
    UPDATE public.quotes SET status = 'accepted', responded_at = NOW()
     WHERE id = '61111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'FORGED AGREEMENT: a professional accepted their own quote';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: a missing GRANT refused this: ' || msg;
  ASSERT msg LIKE '%outcome is the customer''s to give%', 'wrong guard fired: ' || msg;

  -- A sent quote is frozen: 1500 <> 750, a genuine change (trap 2).
  blocked := FALSE;
  BEGIN
    UPDATE public.quotes SET subtotal_ttd = 1500, total_ttd = 1500
     WHERE id = '61111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'BAIT AND SWITCH: the price of a sent quote was edited';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: a missing GRANT refused this: ' || msg;
  ASSERT msg LIKE '%sent quote is fixed%', 'wrong guard fired: ' || msg;

  -- Rotating the token silently breaks the link already in the customer's chat.
  blocked := FALSE;
  BEGIN
    UPDATE public.quotes SET public_token = 'qt_tok_' || repeat('a', 64)
     WHERE id = '61111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'a quote''s public token was rewritten';
  ASSERT msg LIKE '%public link cannot be changed%', 'wrong guard fired: ' || msg;

  RAISE NOTICE 'PASS 8 — a sent quote is frozen and its outcome is not the seller''s';
END $$;

-- ============================================================================
-- 7. Jobs: the status machine
-- ============================================================================

DO $$
DECLARE
  rejected BOOLEAN;
  msg TEXT;
  stamp TIMESTAMPTZ;
  deadline TIMESTAMPTZ;
BEGIN
  INSERT INTO public.jobs
    (id, professional_id, customer_name, service_description, job_value_ttd)
  VALUES
    ('71111111-1111-1111-1111-111111111111',
     '31111111-1111-1111-1111-111111111111', 'Dev Maharaj',
     'Deep clean and gas top-up, three split units', 750);

  -- Skipping forward would invoice work nobody recorded doing.
  rejected := FALSE;
  BEGIN
    UPDATE public.jobs SET status = 'completed'
     WHERE id = '71111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN check_violation THEN
    rejected := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT rejected, 'a job jumped from enquiry straight to completed';
  ASSERT msg LIKE '%cannot move to%', 'wrong error fired: ' || msg;

  -- The legal move works, and the trigger stamps it.
  UPDATE public.jobs SET status = 'accepted'
   WHERE id = '71111111-1111-1111-1111-111111111111';
  SELECT accepted_at INTO stamp FROM public.jobs
   WHERE id = '71111111-1111-1111-1111-111111111111';
  ASSERT stamp IS NOT NULL, 'accepted_at was not stamped by the transition trigger';

  -- Entering in_progress arms the completion deadline.
  UPDATE public.jobs SET status = 'in_progress'
   WHERE id = '71111111-1111-1111-1111-111111111111';
  SELECT completion_deadline INTO deadline FROM public.jobs
   WHERE id = '71111111-1111-1111-1111-111111111111';
  ASSERT deadline IS NOT NULL AND deadline > NOW(),
    'the 72-hour completion deadline was not armed';

  -- One step back is legal; real work does go backwards.
  UPDATE public.jobs SET status = 'accepted'
   WHERE id = '71111111-1111-1111-1111-111111111111';

  -- And the first accepted_at survives the round trip rather than being reset.
  ASSERT (SELECT accepted_at FROM public.jobs
           WHERE id = '71111111-1111-1111-1111-111111111111') = stamp,
    'accepted_at was rewritten by a backwards transition';

  RAISE NOTICE 'PASS 9 — the job state machine rejects illegal moves and stamps legal ones';
END $$;

-- The machine binds the SERVICE ROLE too: it is a domain rule, not a privilege
-- rule, so cron and admin scripts get the same answer as the web route.
SET LOCAL ROLE postgres;
SET LOCAL request.jwt.claims TO '{}';

DO $$
DECLARE
  rejected BOOLEAN := FALSE;
  msg TEXT;
BEGIN
  BEGIN
    UPDATE public.jobs SET status = 'invoiced', invoiced_at = NOW()
     WHERE id = '71111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN check_violation THEN
    rejected := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT rejected, 'the service role skipped the job state machine';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: a grant refused this, so the machine is untested: ' || msg;
  ASSERT msg LIKE '%cannot move to%', 'wrong error fired: ' || msg;

  RAISE NOTICE 'PASS 10 — the state machine binds the service role too';
END $$;

-- ============================================================================
-- 8. job_logs are append-only, for every role
-- ============================================================================

INSERT INTO public.job_logs (id, job_id, event_type, old_value, new_value, note)
VALUES ('81111111-1111-1111-1111-111111111111',
        '71111111-1111-1111-1111-111111111111', 'status_change', 'enquiry', 'accepted',
        'Accepted by phone');

DO $$
DECLARE
  blocked BOOLEAN;
  msg TEXT;
BEGIN
  -- Still acting as postgres: the role that bypasses RLS entirely. If the
  -- trigger did not exist, this would silently succeed.
  blocked := FALSE;
  BEGIN
    UPDATE public.job_logs SET note = 'Accepted in writing'
     WHERE id = '81111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'HISTORY REWRITE: the service role edited a job log';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: a grant refused this, so the trigger is untested: ' || msg;
  ASSERT msg LIKE '%append-only%', 'wrong guard fired: ' || msg;

  blocked := FALSE;
  BEGIN
    DELETE FROM public.job_logs WHERE id = '81111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'HISTORY ERASURE: the service role deleted a job log';
  ASSERT msg LIKE '%append-only%', 'wrong guard fired: ' || msg;

  RAISE NOTICE 'PASS 11 — job_logs are append-only including for the service role';
END $$;

-- ============================================================================
-- 9. Invoices: the professional cannot mark their own invoice paid
-- ============================================================================

INSERT INTO public.invoices
  (id, professional_id, job_id, customer_name,
   line_items, subtotal_ttd, vat_percent, vat_amount_ttd, total_ttd,
   status, sent_at, due_date)
VALUES
  ('91111111-1111-1111-1111-111111111111',
   '31111111-1111-1111-1111-111111111111', '71111111-1111-1111-1111-111111111111',
   'Dev Maharaj',
   '[{"description":"AC service","quantity":1,"unit_price":850,"amount":850}]'::jsonb,
   850, 0, 0, 850, 'sent', NOW(), CURRENT_DATE + 14);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"aaaa1111-0000-0000-0000-0000000000a1","role":"authenticated"}';

DO $$
DECLARE
  blocked BOOLEAN;
  msg TEXT;
  num TEXT;
BEGIN
  SELECT invoice_number INTO num FROM public.invoices
   WHERE id = '91111111-1111-1111-1111-111111111111';
  ASSERT num ~ '^INV-[0-9]{4}-[0-9]{4}$',
    format('invoice number was not server-assigned: %s', num);

  -- THE CENTRAL ASSERTION. paid_at settles the customer's obligation, stops the
  -- reminder ladder, feeds lifetime value, and is what reconciliation diffs
  -- against the gateway. A seller-writable "paid" makes all four an opinion.
  blocked := FALSE;
  BEGIN
    UPDATE public.invoices SET status = 'paid', paid_at = NOW()
     WHERE id = '91111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'SELF-SETTLEMENT: a professional marked their own invoice paid';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: a missing GRANT refused this, so the guard is untested: ' || msg;
  ASSERT msg LIKE '%marked paid when payment is recorded%', 'wrong guard fired: ' || msg;

  -- Resetting the reminder count re-runs the schedule at a real customer.
  blocked := FALSE;
  BEGIN
    UPDATE public.invoices SET reminder_count = 5, last_reminder_at = NOW()
     WHERE id = '91111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'a professional drove their own invoice reminder schedule';
  ASSERT msg LIKE '%reminders are scheduled by the platform%', 'wrong guard fired: ' || msg;

  -- The number is the accounting reference; it is fixed at creation.
  blocked := FALSE;
  BEGIN
    UPDATE public.invoices SET invoice_number = 'INV-2020-0001'
     WHERE id = '91111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'an invoice number was rewritten';
  ASSERT msg LIKE '%number and public link are fixed%', 'wrong guard fired: ' || msg;

  -- What the issuer MAY do: cancel an unpaid invoice.
  UPDATE public.invoices SET status = 'cancelled'
   WHERE id = '91111111-1111-1111-1111-111111111111';
  ASSERT (SELECT status FROM public.invoices
           WHERE id = '91111111-1111-1111-1111-111111111111') = 'cancelled',
    'a professional could not cancel their own unpaid invoice';

  RAISE NOTICE 'PASS 12 — an invoice is settled by payment, not by its issuer';
END $$;

-- An ADMIN may record settlement — the guard bypasses for them by design, and
-- the durable record of who did it goes to admin_audit_log.
SET LOCAL request.jwt.claims TO
  '{"sub":"dddd1111-0000-0000-0000-0000000000d1","role":"authenticated"}';

DO $$
BEGIN
  UPDATE public.invoices SET status = 'sent' WHERE id = '91111111-1111-1111-1111-111111111111';
  UPDATE public.invoices SET status = 'paid', paid_at = NOW()
   WHERE id = '91111111-1111-1111-1111-111111111111';

  ASSERT (SELECT status FROM public.invoices
           WHERE id = '91111111-1111-1111-1111-111111111111') = 'paid',
    'an admin could not record a settlement';

  RAISE NOTICE 'PASS 13 — an administrator can record settlement';
END $$;

-- ============================================================================
-- 10. A rival sees none of it
-- ============================================================================

SET LOCAL request.jwt.claims TO
  '{"sub":"cccc1111-0000-0000-0000-0000000000c1","role":"authenticated"}';

DO $$
DECLARE
  n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.quotes;
  ASSERT n = 0, format('LEAK: a rival saw %s quotes', n);
  SELECT COUNT(*) INTO n FROM public.jobs;
  ASSERT n = 0, format('LEAK: a rival saw %s jobs', n);
  SELECT COUNT(*) INTO n FROM public.job_logs;
  ASSERT n = 0, format('LEAK: a rival saw %s job logs', n);
  SELECT COUNT(*) INTO n FROM public.invoices;
  ASSERT n = 0, format('LEAK: a rival saw %s invoices', n);

  RAISE NOTICE 'PASS 14 — quotes, jobs, logs, and invoices are private to their owner';
END $$;

-- ============================================================================
-- 11. Credits: the balance is the ledger's, and it cannot go negative
-- ============================================================================

SET LOCAL ROLE postgres;
SET LOCAL request.jwt.claims TO '{}';

DO $$
DECLARE
  b RECORD;
BEGIN
  -- Bundles mirror CREDIT_BUNDLES in pricing.ts.
  SELECT credits, price_ttd INTO b FROM public.tool_credit_bundles WHERE code = 'b100';
  ASSERT b.credits = 100 AND b.price_ttd = 150, 'b100 must be 100 credits at TTD 150';
  SELECT credits, price_ttd INTO b FROM public.tool_credit_bundles WHERE code = 'b300';
  ASSERT b.credits = 300 AND b.price_ttd = 400, 'b300 must be 300 credits at TTD 400';
  SELECT credits, price_ttd INTO b FROM public.tool_credit_bundles WHERE code = 'b1000';
  ASSERT b.credits = 1000 AND b.price_ttd = 1000, 'b1000 must be 1,000 credits at TTD 1,000';

  RAISE NOTICE 'PASS 15 — credit bundles match pricing v3.1';
END $$;

INSERT INTO public.tool_credit_accounts (id, professional_id, monthly_allowance)
VALUES ('a1111111-1111-1111-1111-111111111111',
        '31111111-1111-1111-1111-111111111111', 200);

INSERT INTO public.tool_credit_ledger (account_id, delta, reason, balance_after)
VALUES ('a1111111-1111-1111-1111-111111111111', 100, 'monthly_grant', 100);

DO $$
DECLARE
  bal INT;
  blocked BOOLEAN;
  msg TEXT;
BEGIN
  SELECT balance INTO bal FROM public.tool_credit_accounts
   WHERE id = 'a1111111-1111-1111-1111-111111111111';
  ASSERT bal = 100, format('the ledger grant did not move the balance: %s', bal);

  -- The balance is unwritable by EVERY role — this is the service role, and the
  -- guard has no auth.uid() escape for the derived columns.
  blocked := FALSE;
  BEGIN
    UPDATE public.tool_credit_accounts SET balance = 99999
     WHERE id = 'a1111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'MINTED CREDITS: the service role wrote a balance directly';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: a grant refused this, so the guard is untested: ' || msg;
  ASSERT msg LIKE '%derived from the ledger%', 'wrong guard fired: ' || msg;

  -- CREDITS CANNOT GO NEGATIVE, even by writing the ledger directly and lying
  -- about balance_after. The account CHECK is the independent second control.
  blocked := FALSE;
  BEGIN
    INSERT INTO public.tool_credit_ledger
      (account_id, delta, reason, tool_name, balance_after)
    VALUES ('a1111111-1111-1111-1111-111111111111', -500, 'tool_use', 'ai_reply', 0);
  EXCEPTION WHEN check_violation THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'NEGATIVE BALANCE: an oversized ledger spend was applied';

  -- Sign discipline: a 'tool_use' that pays you is a typo nobody catches.
  blocked := FALSE;
  BEGIN
    INSERT INTO public.tool_credit_ledger
      (account_id, delta, reason, tool_name, balance_after)
    VALUES ('a1111111-1111-1111-1111-111111111111', 500, 'tool_use', 'ai_reply', 600);
  EXCEPTION WHEN check_violation THEN blocked := TRUE; END;
  ASSERT blocked, 'a tool_use with a positive delta was accepted';

  -- The ledger is append-only, for the service role as well.
  blocked := FALSE;
  BEGIN
    UPDATE public.tool_credit_ledger SET delta = 10000
     WHERE account_id = 'a1111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'the credit ledger was edited';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: a grant refused this: ' || msg;
  ASSERT msg LIKE '%append-only%', 'wrong guard fired: ' || msg;

  RAISE NOTICE 'PASS 16 — the balance is derived, unwritable, and cannot go negative';
END $$;

-- ============================================================================
-- 12. deduct_tool_credits: ownership, sufficiency, and the ledger it writes
-- ============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"aaaa1111-0000-0000-0000-0000000000a1","role":"authenticated"}';

DO $$
DECLARE
  r JSONB;
  bal INT;
BEGIN
  r := public.deduct_tool_credits('31111111-1111-1111-1111-111111111111', 30, 'ai_reply_draft');
  ASSERT (r->>'ok')::BOOLEAN, format('a valid deduction failed: %s', r);
  ASSERT (r->>'balance_after')::INT = 70, format('wrong balance after spend: %s', r);

  SELECT balance INTO bal FROM public.tool_credit_accounts
   WHERE id = 'a1111111-1111-1111-1111-111111111111';
  ASSERT bal = 70, format('the account balance did not follow the ledger: %s', bal);

  -- V1's function had NO ownership check: any caller could name any account and
  -- drain it. This is the regression test for that.
  r := public.deduct_tool_credits('32222222-2222-2222-2222-222222222222', 5, 'ai_reply_draft');
  ASSERT NOT (r->>'ok')::BOOLEAN AND r->>'error' = 'forbidden',
    format('THEFT: a professional spent a rival''s credits: %s', r);

  -- Sufficiency, returned as data rather than raised: the API renders it as a
  -- purchase prompt, not an error.
  r := public.deduct_tool_credits('31111111-1111-1111-1111-111111111111', 5000, 'ai_reply_draft');
  ASSERT NOT (r->>'ok')::BOOLEAN AND r->>'error' = 'insufficient_credits',
    format('an unaffordable spend was allowed: %s', r);

  -- And the balance is untouched by the refusal.
  SELECT balance INTO bal FROM public.tool_credit_accounts
   WHERE id = 'a1111111-1111-1111-1111-111111111111';
  ASSERT bal = 70, format('a refused spend moved the balance: %s', bal);

  r := public.deduct_tool_credits('31111111-1111-1111-1111-111111111111', 0, 'ai_reply_draft');
  ASSERT r->>'error' = 'invalid_amount', format('a zero-credit spend was allowed: %s', r);

  RAISE NOTICE 'PASS 17 — deduct_tool_credits is ownership-checked and refuses what cannot be afforded';
END $$;

-- Enterprise: unlimited must WORK, and must still be recorded. V1 encoded
-- unlimited as -1 and every Enterprise deduction failed insufficient_credits —
-- the top tier was the only one that could not use the tools it paid most for.
SET LOCAL ROLE postgres;
SET LOCAL request.jwt.claims TO '{}';

UPDATE public.tool_credit_accounts SET unlimited = TRUE
 WHERE id = 'a1111111-1111-1111-1111-111111111111';

DO $$
DECLARE
  r JSONB;
  n INT;
BEGIN
  r := public.deduct_tool_credits('31111111-1111-1111-1111-111111111111', 999, 'ai_assistant');
  ASSERT (r->>'ok')::BOOLEAN AND (r->>'unlimited')::BOOLEAN,
    format('an unlimited account could not spend: %s', r);
  ASSERT (SELECT balance FROM public.tool_credit_accounts
           WHERE id = 'a1111111-1111-1111-1111-111111111111') = 70,
    'an unlimited spend moved the balance';

  -- "Unlimited" must not mean "unrecorded".
  SELECT COUNT(*) INTO n FROM public.tool_credit_ledger
   WHERE account_id = 'a1111111-1111-1111-1111-111111111111'
     AND tool_name = 'ai_assistant';
  ASSERT n = 1, 'an unlimited spend left no ledger entry';

  RAISE NOTICE 'PASS 18 — unlimited tiers can spend, and the spend is still ledgered';
END $$;

UPDATE public.tool_credit_accounts SET unlimited = FALSE
 WHERE id = 'a1111111-1111-1111-1111-111111111111';

-- ============================================================================
-- 13. CRM: enquiries synthesise contacts
-- ============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"bbbb1111-0000-0000-0000-0000000000b1","role":"authenticated"}';

INSERT INTO public.job_enquiries (customer_id, professional_id, description)
VALUES ('bbbb1111-0000-0000-0000-0000000000b1', '31111111-1111-1111-1111-111111111111',
        'Three split units need servicing before Divali, Sangre Grande area.');

-- Read as the professional whose book it is: the contact must be visible to
-- its owner, which is a policy assertion as well as a sync assertion.
SET LOCAL request.jwt.claims TO
  '{"sub":"aaaa1111-0000-0000-0000-0000000000a1","role":"authenticated"}';

DO $$
DECLARE
  c RECORD;
BEGIN
  SELECT * INTO c FROM public.client_contacts
   WHERE professional_id = '31111111-1111-1111-1111-111111111111';

  ASSERT FOUND, 'the enquiry created no CRM contact — V1''s silent-miss bug';
  ASSERT c.origin = 'enquiry_sync', format('wrong origin: %s', c.origin);
  ASSERT c.enquiry_count = 1, format('wrong enquiry count: %s', c.enquiry_count);
  ASSERT c.display_name = 'Anand Customer', format('wrong display name: %s', c.display_name);
  ASSERT c.customer_user_id = 'bbbb1111-0000-0000-0000-0000000000b1',
    'the contact was not linked to the customer''s account';

  RAISE NOTICE 'PASS 19 — an enquiry synthesises the professional''s CRM contact';
END $$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"bbbb1111-0000-0000-0000-0000000000b1","role":"authenticated"}';

INSERT INTO public.job_enquiries (customer_id, professional_id, description)
VALUES ('bbbb1111-0000-0000-0000-0000000000b1', '31111111-1111-1111-1111-111111111111',
        'Follow-up: the upstairs unit is still not cooling properly at all.');

SET LOCAL request.jwt.claims TO
  '{"sub":"aaaa1111-0000-0000-0000-0000000000a1","role":"authenticated"}';

DO $$
DECLARE
  n INT;
  cnt INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.client_contacts
   WHERE professional_id = '31111111-1111-1111-1111-111111111111';
  -- V1's ON CONFLICT targeted a non-partial unique over a nullable column and
  -- so never fired; a second enquiry produced a duplicate contact.
  ASSERT n = 1, format('a second enquiry duplicated the contact: %s rows', n);

  SELECT enquiry_count INTO cnt FROM public.client_contacts
   WHERE professional_id = '31111111-1111-1111-1111-111111111111';
  ASSERT cnt = 2, format('the second enquiry did not increment the count: %s', cnt);

  RAISE NOTICE 'PASS 20 — a repeat enquiry touches the same contact rather than duplicating it';
END $$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"aaaa1111-0000-0000-0000-0000000000a1","role":"authenticated"}';

DO $$
DECLARE
  blocked BOOLEAN;
  msg TEXT;
  n INT;
BEGIN
  -- The owner may annotate.
  UPDATE public.client_contacts SET internal_notes = 'Prefers WhatsApp before 5pm',
         tags = ARRAY['repeat', 'ac']
   WHERE professional_id = '31111111-1111-1111-1111-111111111111';

  -- 99 <> 2: a genuine change (trap 2). Lifetime value is the only quantitative
  -- column in the CRM; a self-editable one is a number the professional chose.
  blocked := FALSE;
  BEGIN
    UPDATE public.client_contacts SET lifetime_value_ttd = 99999
     WHERE professional_id = '31111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'a professional wrote their own CRM lifetime value';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: a missing GRANT refused this: ' || msg;
  ASSERT msg LIKE '%history is maintained by the platform%', 'wrong guard fired: ' || msg;

  RAISE NOTICE 'PASS 21 — CRM notes are the professional''s, counters are the platform''s';
END $$;

SET LOCAL request.jwt.claims TO
  '{"sub":"cccc1111-0000-0000-0000-0000000000c1","role":"authenticated"}';

DO $$
DECLARE
  n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.client_contacts;
  ASSERT n = 0, format('LEAK: a rival saw %s CRM contacts', n);

  RAISE NOTICE 'PASS 22 — a rival sees no CRM contacts';
END $$;

-- ============================================================================
-- 14. Activity and audit logs are immutable
-- ============================================================================

SET LOCAL request.jwt.claims TO
  '{"sub":"bbbb1111-0000-0000-0000-0000000000b1","role":"authenticated"}';

DO $$
DECLARE
  rejected BOOLEAN;
BEGIN
  INSERT INTO public.user_activity_log (user_id, event_type, entity_type)
  VALUES ('bbbb1111-0000-0000-0000-0000000000b1', 'search', 'category');

  -- Forging another account's history.
  rejected := FALSE;
  BEGIN
    INSERT INTO public.user_activity_log (user_id, event_type)
    VALUES ('aaaa1111-0000-0000-0000-0000000000a1', 'enquiry_created');
  EXCEPTION WHEN insufficient_privilege THEN rejected := TRUE; END;
  ASSERT rejected, 'a user logged activity against someone else''s account';

  RAISE NOTICE 'PASS 23 — activity is logged against your own account only';
END $$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"dddd1111-0000-0000-0000-0000000000d1","role":"authenticated"}';

INSERT INTO public.admin_audit_log
  (id, admin_id, admin_email, action_type, target_table, target_id, notes)
VALUES
  ('c1111111-1111-1111-1111-111111111111',
   'dddd1111-0000-0000-0000-0000000000d1', 'cadmin@tradelynq.test',
   'record_invoice_payment', 'invoices', '91111111-1111-1111-1111-111111111111',
   'Bank transfer confirmed with the customer by phone.');

DO $$
DECLARE
  rejected BOOLEAN;
BEGIN
  -- One admin writing entries in another's name, in the one table whose entire
  -- value is that the name is right.
  rejected := FALSE;
  BEGIN
    INSERT INTO public.admin_audit_log
      (admin_id, admin_email, action_type, target_table)
    VALUES ('aaaa1111-0000-0000-0000-0000000000a1', 'cpro@tradelynq.test',
            'approve_review', 'reviews');
  EXCEPTION WHEN insufficient_privilege THEN rejected := TRUE; END;
  ASSERT rejected, 'an audit entry was written in another administrator''s name';

  RAISE NOTICE 'PASS 24 — audit entries can only be written in your own name';
END $$;

SET LOCAL ROLE postgres;
SET LOCAL request.jwt.claims TO '{}';

DO $$
DECLARE
  blocked BOOLEAN;
  msg TEXT;
BEGIN
  -- Absolute immutability, tested from the role that bypasses RLS.
  blocked := FALSE;
  BEGIN
    UPDATE public.admin_audit_log SET notes = 'Nothing to see here'
     WHERE id = 'c1111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'AUDIT REWRITE: the service role edited the admin audit log';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: a grant refused this, so the trigger is untested: ' || msg;
  ASSERT msg LIKE '%audit log is immutable%', 'wrong guard fired: ' || msg;

  blocked := FALSE;
  BEGIN
    DELETE FROM public.admin_audit_log
     WHERE id = 'c1111111-1111-1111-1111-111111111111';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'AUDIT ERASURE: the service role deleted an audit entry';
  ASSERT msg LIKE '%audit log is immutable%', 'wrong guard fired: ' || msg;

  -- The activity log too — no UPDATE grant exists for clients, so this is
  -- tested where the trigger actually fires.
  blocked := FALSE;
  BEGIN
    UPDATE public.user_activity_log SET event_type = 'rewritten'
     WHERE user_id = 'bbbb1111-0000-0000-0000-0000000000b1';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'the activity log was edited';
  ASSERT msg LIKE '%immutable%', 'wrong guard fired: ' || msg;

  RAISE NOTICE 'PASS 25 — the audit and activity logs are immutable for every role';
END $$;

-- ============================================================================
-- 15. store_orders
-- ============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"bbbb1111-0000-0000-0000-0000000000b1","role":"authenticated"}';

DO $$
DECLARE
  rejected BOOLEAN;
BEGIN
  INSERT INTO public.store_orders
    (id, user_id, email, full_name, phone, product_id, product_name,
     product_price_ttd, quantity, total_ttd, branding, size, payment_method)
  VALUES
    ('d1111111-1111-1111-1111-111111111111',
     'bbbb1111-0000-0000-0000-0000000000b1', 'anand@example.com', 'Anand Customer',
     '+1 868 761 4402', 'polo-navy', 'TradeLynq Polo — Navy',
     180, 2, 360, 'tradelynq', 'L', 'bank_transfer');

  -- The arithmetic closes, same rule as invoices.
  rejected := FALSE;
  BEGIN
    INSERT INTO public.store_orders
      (user_id, email, full_name, product_id, product_name,
       product_price_ttd, quantity, total_ttd)
    VALUES ('bbbb1111-0000-0000-0000-0000000000b1', 'anand@example.com', 'Anand Customer',
            'polo-navy', 'TradeLynq Polo — Navy', 180, 2, 100);
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'an order whose total disagreed with price x quantity was accepted';

  -- Cash on delivery is capped: above TTD $500 the courier carries too much cash.
  rejected := FALSE;
  BEGIN
    INSERT INTO public.store_orders
      (user_id, email, full_name, product_id, product_name,
       product_price_ttd, quantity, total_ttd, payment_method)
    VALUES ('bbbb1111-0000-0000-0000-0000000000b1', 'anand@example.com', 'Anand Customer',
            'polo-navy', 'TradeLynq Polo — Navy', 180, 4, 720, 'cash_on_delivery');
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'a cash-on-delivery order above TTD 500 was accepted';

  -- Ordering in someone else's name.
  rejected := FALSE;
  BEGIN
    INSERT INTO public.store_orders
      (user_id, email, full_name, product_id, product_name,
       product_price_ttd, quantity, total_ttd)
    VALUES ('aaaa1111-0000-0000-0000-0000000000a1', 'x@example.com', 'Not Me',
            'polo-navy', 'Polo', 180, 1, 180);
  EXCEPTION WHEN insufficient_privilege THEN rejected := TRUE; END;
  ASSERT rejected, 'an order was placed under another account';

  RAISE NOTICE 'PASS 26 — store order totals, the COD cap, and ownership all hold';
END $$;

DO $$
DECLARE
  affected INT;
BEGIN
  -- The buyer has no UPDATE policy: an order is amended by talking to someone.
  -- No policy means zero rows affected rather than an error, so the assertion
  -- is on the row count, not on a message.
  UPDATE public.store_orders SET status = 'completed', fulfilled_at = NOW()
   WHERE id = 'd1111111-1111-1111-1111-111111111111';
  GET DIAGNOSTICS affected = ROW_COUNT;
  ASSERT affected = 0, 'a buyer changed the status of their own order';

  RAISE NOTICE 'PASS 27 — buyers cannot drive their own order status';
END $$;

SET LOCAL request.jwt.claims TO
  '{"sub":"cccc1111-0000-0000-0000-0000000000c1","role":"authenticated"}';

DO $$
DECLARE
  n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.store_orders;
  ASSERT n = 0, format('LEAK: a stranger saw %s store orders', n);

  RAISE NOTICE 'PASS 28 — store orders are private to the buyer and admins';
END $$;

-- ============================================================================
-- 16. TRAP 5 — an administrator who has acted can still be deleted
-- ============================================================================
--
-- This shipped as a real bug once: an attribution CHECK required
-- `verified_by IS NOT NULL` on a column that is ON DELETE SET NULL, so deleting
-- that admin's account violated the constraint on every row they had touched.
-- The admin became permanently undeletable — which is also an erasure problem
-- under data protection.
--
-- The rule these tables follow: require the TIMESTAMP, never the person.
-- Durable attribution lives in admin_audit_log, which holds no foreign key at
-- all and therefore neither blocks the deletion nor loses the name.

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"dddd1111-0000-0000-0000-0000000000d1","role":"authenticated"}';

-- The admin acts: fulfils an order, attributing it to themselves.
UPDATE public.store_orders
   SET status = 'completed',
       fulfilled_at = NOW(),
       fulfilled_by = 'dddd1111-0000-0000-0000-0000000000d1',
       admin_notes = 'Collected in person at the Woodbrook office.'
 WHERE id = 'd1111111-1111-1111-1111-111111111111';

SET LOCAL ROLE postgres;
SET LOCAL request.jwt.claims TO '{}';

DO $$
DECLARE
  deleted_ok BOOLEAN := FALSE;
  err TEXT;
  o RECORD;
  audit_rows INT;
  audit_email TEXT;
BEGIN
  ASSERT (SELECT fulfilled_by FROM public.store_orders
           WHERE id = 'd1111111-1111-1111-1111-111111111111') IS NOT NULL,
    'fixture: the admin should have attributed the fulfilment to themselves';

  -- THE DELETION. This is the assertion the whole section exists for.
  BEGIN
    DELETE FROM auth.users WHERE id = 'dddd1111-0000-0000-0000-0000000000d1';
    deleted_ok := TRUE;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS err = MESSAGE_TEXT;
  END;

  ASSERT deleted_ok,
    'UNDELETABLE ADMIN: closing the account of an administrator who has acted '
    || 'failed. A CHECK constraint almost certainly requires an ON DELETE SET '
    || 'NULL attribution column. Require the timestamp only. Error was: '
    || COALESCE(err, '(none)');

  -- Attribution degrades to NULL; the record and its own invariant survive.
  SELECT status, fulfilled_at, fulfilled_by INTO o FROM public.store_orders
   WHERE id = 'd1111111-1111-1111-1111-111111111111';
  ASSERT o.fulfilled_by IS NULL, 'fulfilled_by should have degraded to NULL';
  ASSERT o.fulfilled_at IS NOT NULL AND o.status = 'completed',
    'the fulfilment record itself should survive the administrator leaving';

  -- And the durable answer to "who did this" is still there, with the name.
  SELECT COUNT(*) INTO audit_rows FROM public.admin_audit_log
   WHERE admin_id = 'dddd1111-0000-0000-0000-0000000000d1';
  ASSERT audit_rows = 1,
    format('the audit trail lost the departed administrator''s entries: %s rows', audit_rows);

  SELECT admin_email INTO audit_email FROM public.admin_audit_log
   WHERE admin_id = 'dddd1111-0000-0000-0000-0000000000d1';
  ASSERT audit_email = 'cadmin@tradelynq.test',
    'the audit entry lost the administrator''s identity';

  RAISE NOTICE 'PASS 29 — an administrator who has acted can still be deleted; the audit trail keeps the name';
END $$;

ROLLBACK;

-- ============================================================================
-- 17. CONCURRENT DEDUCTION CANNOT DOUBLE-SPEND
-- ============================================================================
--
-- Everything above runs in one session, which is exactly why it proves nothing
-- about concurrency. This section runs COMMITTED, so a genuinely separate
-- database session (opened with psql's \! below) can see the fixtures and race
-- against us for the same account row.
--
-- The dangerous sequence is not the arithmetic; it is the DECISION. Two
-- concurrent AI requests from an account with 5 credits both read `balance = 5`,
-- both conclude "sufficient", and both spend — and the second spend is a credit
-- nobody paid for. `SELECT … FOR UPDATE` makes the second caller BLOCK at the
-- read, so it cannot reach its sufficiency check until the first has committed.
--
-- Phase A: we hold the lock uncommitted. The rival session must block and time
--          out (SQLSTATE 55P03) rather than complete with a stale balance.
-- Phase B: we commit. The rival session now completes and is correctly REFUSED.
--
-- Everything is cleaned up at the end, and idempotently at the start, so a
-- failed run leaves nothing behind for the next one.

-- dblink opens a genuinely separate database session from inside SQL, which is
-- what makes a real race testable. Created in `extensions` rather than `public`
-- so the schema-invariant suite does not see its tables as application tables
-- missing RLS. Test-only: no migration installs it, so production never has it.
CREATE EXTENSION IF NOT EXISTS dblink SCHEMA extensions;

-- Builds the connection string for the rival session.
--
-- The host MUST NOT be 127.0.0.1. Supabase's pg_hba grants `trust` on loopback,
-- and dblink refuses a non-superuser connection whose password was never
-- actually used to authenticate ("password or GSSAPI delegated credentials
-- required"). `postgres` is not a superuser here (usesuper = f), so the
-- connection has to arrive on an address governed by a scram-sha-256 rule —
-- the container's own subnet address.
--
-- That address cannot be discovered from inside Postgres: `inet_server_addr()`
-- returns NULL when the client connects over a socket, which is how the test
-- runner connects. So `scripts/test-policies.mjs` resolves it with
-- `docker inspect` and passes it in as the psql variable `db_host`.
SELECT set_config('test.db_host', :'db_host', false);

CREATE OR REPLACE FUNCTION test_dblink_conninfo()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT format(
    'dbname=%s user=postgres password=postgres host=%s port=5432',
    current_database(),
    current_setting('test.db_host', true)
  );
$$;

DELETE FROM auth.users WHERE email = 'crace@tradelynq.test';
DELETE FROM public.user_activity_log WHERE event_type IN ('credit_race_a', 'credit_race_b');

INSERT INTO auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_user_meta_data, created_at, updated_at)
VALUES
  ('eeee1111-0000-0000-0000-0000000000e1',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'crace@tradelynq.test', 'x', NOW(), jsonb_build_object('full_name', 'Race Pro'), NOW(), NOW());

UPDATE public.profiles
   SET role = 'professional', professional_subtype = 'sole_trader', role_confirmed = TRUE
 WHERE id = 'eeee1111-0000-0000-0000-0000000000e1';

INSERT INTO public.professional_profiles
  (id, user_id, business_name, owner_name)
VALUES ('39999999-9999-9999-9999-999999999999',
        'eeee1111-0000-0000-0000-0000000000e1', 'Race Conditions Ltd', 'Race Pro');

INSERT INTO public.tool_credit_accounts (id, professional_id)
VALUES ('a9999999-9999-9999-9999-999999999999',
        '39999999-9999-9999-9999-999999999999');

-- Exactly 5 credits. Two concurrent 5-credit spends: at most one may succeed.
INSERT INTO public.tool_credit_ledger (account_id, delta, reason, balance_after)
VALUES ('a9999999-9999-9999-9999-999999999999', 5, 'monthly_grant', 5);

BEGIN;

-- We spend all 5. The FOR UPDATE lock inside the function is now held by this
-- open transaction and is not released until COMMIT.
SELECT public.deduct_tool_credits(
  '39999999-9999-9999-9999-999999999999', 5, 'race_tool_first') AS first_call;

-- ── Phase A: the rival session, while we hold the lock ──────────────────────
--
-- A genuinely separate psql process, with a short lock_timeout so a block
-- surfaces as an error rather than hanging the suite. The DO block records
-- EITHER the deduction's result OR the SQLSTATE that stopped it — so "no result
-- row, and SQLSTATE 55P03" is an unambiguous signature of "waited on the row
-- lock until it timed out".
--
-- The second session is opened with `dblink` rather than psql's `\!` shell
-- escape. An earlier version shelled out, which works on Linux and breaks on
-- Windows: psql hands the line to `sh`, and CRLF line endings arrive as a
-- trailing carriage return, so `sleep 2` becomes `sleep 2\r` — "invalid number".
-- dblink keeps the whole test inside the database, where line endings, shell
-- quoting, and background-job semantics cannot reach it.
SELECT dblink_connect('rival', test_dblink_conninfo());
SELECT dblink_exec('rival', 'SET lock_timeout = ''2s''');

DO $$
DECLARE
  outcome TEXT;
BEGIN
  BEGIN
    PERFORM dblink_exec(
      'rival',
      'SELECT public.deduct_tool_credits(''39999999-9999-9999-9999-999999999999'', 5, ''race_tool_rival'')'
    );
    outcome := 'completed';
  EXCEPTION WHEN OTHERS THEN
    -- dblink re-raises the remote error, so the remote SQLSTATE is preserved
    -- here — including 55P03 when the rival waited on our row lock and gave up.
    outcome := SQLSTATE;
  END;

  INSERT INTO public.user_activity_log (event_type, metadata)
  VALUES ('credit_race_a', jsonb_build_object('kind', 'sqlstate', 'code', outcome));
END $$;

SELECT dblink_disconnect('rival');

-- ── Phase B: the discriminating test ────────────────────────────────────────
--
-- Phase A alone is NOT enough, and this was confirmed by sabotage: with
-- `FOR UPDATE` deleted from the function, phase A still passes. The reason is
-- that the ledger's apply trigger issues an UPDATE, and an UPDATE takes its own
-- row lock — so a lock-less caller blocks slightly later and produces the same
-- 55P03. Phase A proves *something* serialises; it does not prove the
-- SUFFICIENCY CHECK does.
--
-- That distinction is the whole point. Without FOR UPDATE the rival reads a
-- stale `balance = 5`, DECIDES it can afford the spend, and only discovers
-- otherwise when the balance CHECK explodes underneath it. The money is still
-- safe — that CHECK is the second control, and it works — but the caller gets a
-- constraint violation instead of an answer, which is a 500 where the product
-- promises a purchase prompt.
--
-- So phase B runs the rival in the BACKGROUND with a long timeout, lets it
-- block, commits underneath it, and then looks at what it returned:
--
--   FOR UPDATE present → the SELECT unblocks, re-reads the committed balance of
--                        0, and returns a clean `insufficient_credits`.
--   FOR UPDATE absent  → the decision was already made on stale data; the
--                        trigger's UPDATE unblocks and violates
--                        credit_balance_non_negative (SQLSTATE 23514).
--
-- The 60s lock_timeout is a hang guard, not part of the mechanism.
--
-- `dblink_send_query` is asynchronous: it dispatches and returns immediately,
-- leaving the rival genuinely executing on its own connection. That is what
-- makes `dblink_is_busy` below a real observation of "still blocked" rather than
-- a sleep-and-hope.
SELECT dblink_connect('bg', test_dblink_conninfo());
SELECT dblink_exec('bg', 'SET lock_timeout = ''60s''');
SELECT dblink_send_query(
  'bg',
  'SELECT public.deduct_tool_credits(''39999999-9999-9999-9999-999999999999'', 5, ''race_tool_async'')'
);

-- It must still be waiting: our transaction is open and holds the row.
DO $$
DECLARE
  busy INT;
  attempts INT := 0;
BEGIN
  -- Give it a moment to reach the lock. pg_sleep is in-database, so no shell.
  PERFORM pg_sleep(0.5);

  busy := dblink_is_busy('bg');

  -- Poll briefly in case the dispatch itself has not landed yet; a rival that is
  -- genuinely blocked stays busy indefinitely, so this converges fast either way.
  WHILE busy = 0 AND attempts < 4 LOOP
    PERFORM pg_sleep(0.25);
    busy := dblink_is_busy('bg');
    attempts := attempts + 1;
  END LOOP;

  ASSERT busy = 1,
    'DOUBLE SPEND: the concurrent session finished while this transaction still '
    || 'held the account row locked. It read a stale balance, decided it could '
    || 'afford the spend, and completed — SELECT … FOR UPDATE is not doing its job.';
END $$;

COMMIT;

-- Now it can proceed. dblink_get_result BLOCKS until the rival finishes, so
-- there is no sleep-and-hope here either: control returns exactly when it is done.
DO $$
DECLARE
  result JSONB;
  outcome TEXT;
BEGIN
  BEGIN
    SELECT r.deduct INTO result
      FROM dblink_get_result('bg') AS r(deduct JSONB);
    outcome := 'completed';
  EXCEPTION WHEN OTHERS THEN
    outcome := SQLSTATE;
    result := NULL;
  END;

  IF outcome = 'completed' THEN
    INSERT INTO public.user_activity_log (event_type, metadata)
    VALUES ('credit_race_b', jsonb_build_object('kind', 'result', 'result', result));
  ELSE
    INSERT INTO public.user_activity_log (event_type, metadata)
    VALUES ('credit_race_b', jsonb_build_object('kind', 'sqlstate', 'code', outcome));
  END IF;
END $$;

-- Drain the trailing empty result set and close the connection.
DO $$
BEGIN
  PERFORM dblink_get_result('bg');
  PERFORM dblink_disconnect('bg');
EXCEPTION WHEN OTHERS THEN
  NULL;  -- Already drained or disconnected; nothing to clean up.
END $$;

-- Capture every outcome into a TEMP table BEFORE cleaning up, so the assertions
-- run against values rather than rows that no longer exist. A temp table rather
-- than psql variables because psql does not interpolate variables inside the
-- dollar-quoted body of a DO block; pg_temp is invisible to the schema
-- invariant suite and vanishes when this session ends.
CREATE TEMP TABLE race_outcome AS
SELECT
  COALESCE((SELECT COUNT(*) FROM public.user_activity_log
             WHERE event_type = 'credit_race_a' AND metadata->>'kind' = 'result'), 0)
    AS phase_a_results,
  COALESCE((SELECT metadata->>'code' FROM public.user_activity_log
             WHERE event_type = 'credit_race_a' AND metadata->>'kind' = 'sqlstate'
             ORDER BY created_at LIMIT 1), 'missing')
    AS phase_a_sqlstate,
  COALESCE((SELECT COUNT(*) FROM public.user_activity_log
             WHERE event_type = 'credit_race_b' AND metadata->>'kind' = 'result'), 0)
    AS phase_b_results,
  COALESCE((SELECT metadata->'result'->>'error' FROM public.user_activity_log
             WHERE event_type = 'credit_race_b' AND metadata->>'kind' = 'result'
             ORDER BY created_at LIMIT 1), 'missing')
    AS phase_b_error,
  COALESCE((SELECT metadata->>'code' FROM public.user_activity_log
             WHERE event_type = 'credit_race_b' AND metadata->>'kind' = 'sqlstate'
             ORDER BY created_at LIMIT 1), 'none')
    AS phase_b_sqlstate,
  (SELECT balance FROM public.tool_credit_accounts
    WHERE id = 'a9999999-9999-9999-9999-999999999999')
    AS final_balance,
  (SELECT COUNT(*) FROM public.tool_credit_ledger
    WHERE account_id = 'a9999999-9999-9999-9999-999999999999' AND reason = 'tool_use')
    AS spend_rows;

-- Cleanup runs before the assertions, so a failing assertion still leaves a
-- clean database behind. Deleting the user cascades to the professional
-- profile, the credit account, and the ledger.
DELETE FROM auth.users WHERE email = 'crace@tradelynq.test';
DELETE FROM public.user_activity_log WHERE event_type IN ('credit_race_a', 'credit_race_b');

DO $$
DECLARE
  o RECORD;
  phase_a_results INT;
  phase_a_sqlstate TEXT;
  phase_b_results INT;
  phase_b_error TEXT;
  phase_b_sqlstate TEXT;
  final_balance INT;
  spend_rows INT;
BEGIN
  SELECT * INTO o FROM race_outcome;
  phase_a_results  := o.phase_a_results;
  phase_a_sqlstate := o.phase_a_sqlstate;
  phase_b_results  := o.phase_b_results;
  phase_b_error    := o.phase_b_error;
  phase_b_sqlstate := o.phase_b_sqlstate;
  final_balance    := o.final_balance;
  spend_rows       := o.spend_rows;

  -- The rival session must not have completed while we held the lock. If
  -- FOR UPDATE were missing it would have read balance = 5, decided
  -- "sufficient", and written a second spend.
  ASSERT phase_a_results = 0,
    'DOUBLE SPEND: a concurrent session completed a deduction while the account '
    || 'row was locked. The SELECT … FOR UPDATE in deduct_tool_credits is not '
    || 'doing its job.';

  -- And it must have failed for the RIGHT reason: 55P03 is lock_not_available,
  -- i.e. it waited on our row lock until the timeout. Any other code means the
  -- test proved something else (trap 1, in a different shape).
  ASSERT phase_a_sqlstate = '55P03',
    format('the concurrent session did not block on the row lock — SQLSTATE was '
           || '%s, expected 55P03 (lock_not_available). The test may be passing '
           || 'for the wrong reason.', phase_a_sqlstate);

  -- THE DISCRIMINATING ASSERTION. The background rival blocked while we held
  -- the row, then completed once we committed. It must have RE-READ the
  -- balance we left behind and refused gracefully.
  --
  -- A SQLSTATE of 23514 here means the opposite: the rival made its decision on
  -- a stale balance and was only stopped by the credit_balance_non_negative
  -- CHECK. That is a lock-less deduction function — the money survives, the
  -- contract does not.
  ASSERT phase_b_sqlstate <> '23514',
    'LOST UPDATE: the concurrent session passed its sufficiency check against a '
    || 'stale balance and was only caught by the balance CHECK afterwards. The '
    || 'SELECT … FOR UPDATE in deduct_tool_credits is missing or ineffective — '
    || 'the decision is not serialised, only the arithmetic is.';
  ASSERT phase_b_results = 1,
    format('the concurrent session did not complete after the lock was released '
           || '(SQLSTATE %s)', phase_b_sqlstate);
  ASSERT phase_b_error = 'insufficient_credits',
    format('the second caller should have been refused for want of credits, got: %s',
           phase_b_error);

  -- The arithmetic, end to end: 5 credits, two 5-credit attempts, one spend.
  ASSERT final_balance = 0, format('final balance should be 0, was %s', final_balance);
  ASSERT spend_rows = 1,
    format('exactly one spend should have been ledgered, found %s', spend_rows);

  RAISE NOTICE 'PASS 30 — concurrent deduction blocks on the row lock and cannot double-spend';
END $$;

\echo ''
\echo '================================================'
\echo ' commerce policy: ALL CHECKS PASSED'
\echo '================================================'
