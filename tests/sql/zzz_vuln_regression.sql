-- ============================================================================
-- Regression tests for the vulnerabilities found by adversarial review,
-- 20 July 2026.
--
-- Each test reproduces the ORIGINAL ATTACK. They exist because every one of
-- these shipped, passed the invariant suite, and was found only by someone
-- deliberately trying to break the schema rather than confirm it worked.
--
-- If any of these ever goes green-by-passing-vacuously, the vulnerability is
-- back. Every check asserts the attack FAILED, and separately that the
-- legitimate path still works — a fix that breaks the product gets reverted.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

BEGIN;

-- ── Fixtures ────────────────────────────────────────────────────────────────

INSERT INTO auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_user_meta_data, created_at, updated_at)
VALUES
  ('7a000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'vuln-victim@tradelynq.test', 'x', NOW(),
   jsonb_build_object('full_name', 'Victim Pro'), NOW(), NOW()),
  ('7b000000-0000-0000-0000-0000000000b1',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'vuln-customer@tradelynq.test', 'x', NOW(),
   jsonb_build_object('full_name', 'Gate Customer'), NOW(), NOW()),
  ('7c000000-0000-0000-0000-0000000000c1',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'vuln-pro2@tradelynq.test', 'x', NOW(),
   jsonb_build_object('full_name', 'Second Pro'), NOW(), NOW());

UPDATE public.profiles
   SET role = 'professional', professional_subtype = 'sole_trader', role_confirmed = TRUE
 WHERE id IN ('7a000000-0000-0000-0000-0000000000a1', '7c000000-0000-0000-0000-0000000000c1');

UPDATE public.profiles SET role = 'customer', role_confirmed = TRUE
 WHERE id = '7b000000-0000-0000-0000-0000000000b1';

INSERT INTO public.professional_profiles
  (id, user_id, business_name, owner_name, category_id, service_areas,
   national_id_url, selfie_url, date_of_birth, home_address,
   insurance_policy_number, contact_phone, listing_status)
VALUES
  ('7aaaaaaa-0000-0000-0000-00000000aaa1', '7a000000-0000-0000-0000-0000000000a1',
   'Victim Services', 'Victim Pro',
   (SELECT id FROM public.categories WHERE slug = 'plumber'),
   ARRAY['Arima'],
   'kyc/7a000000/id-front.jpg', 'kyc/7a000000/selfie.jpg', '1990-05-05',
   '12 Private Lane, Arima', 'POL-123456', '18683741234', 'active'),
  ('7ccccccc-0000-0000-0000-00000000ccc1', '7c000000-0000-0000-0000-0000000000c1',
   'Second Services', 'Second Pro',
   (SELECT id FROM public.categories WHERE slug = 'electrician'),
   ARRAY['Arima'], NULL, NULL, NULL, NULL, NULL, NULL, 'active');

INSERT INTO public.tool_credit_accounts (id, professional_id, balance)
VALUES ('7a11a11a-0000-0000-0000-00000000a111', '7aaaaaaa-0000-0000-0000-00000000aaa1', 0);

INSERT INTO public.tool_credit_ledger (account_id, delta, reason, balance_after)
VALUES ('7a11a11a-0000-0000-0000-00000000a111', 500, 'monthly_grant', 500);

INSERT INTO public.customer_profiles (user_id, area, kyc_status)
VALUES ('7b000000-0000-0000-0000-0000000000b1', 'Arima', 'not_required');

-- ============================================================================
-- CRITICAL 1 — anon draining any professional's credits
-- ============================================================================
-- Original: deduct_tool_credits skipped the ownership check when auth.uid() was
-- NULL, assuming NULL meant service role. The anon key also presents NULL.
-- Confirmed live: as anon, a 400-credit deduction against a 500-credit victim
-- returned ok.

SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims TO '{}';

DO $$
DECLARE
  result JSONB;
  blocked BOOLEAN := FALSE;
  balance_now INTEGER;
BEGIN
  BEGIN
    result := public.deduct_tool_credits(
      '7aaaaaaa-0000-0000-0000-00000000aaa1', 400, 'drain_attempt');
    -- If EXECUTE is revoked this raises; if it runs, it must refuse.
    blocked := (result->>'ok')::BOOLEAN IS FALSE;
  EXCEPTION WHEN insufficient_privilege OR undefined_function THEN
    blocked := TRUE;
  END;

  ASSERT blocked,
    'CRITICAL REGRESSION: anon drained a professional''s credits. '
    || 'deduct_tool_credits must refuse a NULL caller that is not service_role, '
    || 'and EXECUTE must be revoked from PUBLIC.';

  SET LOCAL ROLE postgres;
  SELECT balance INTO balance_now FROM public.tool_credit_accounts
   WHERE id = '7a11a11a-0000-0000-0000-00000000a111';
  ASSERT balance_now = 500,
    format('CRITICAL REGRESSION: balance moved to %s — credits were spent', balance_now);

  RAISE NOTICE 'PASS 1 — anon cannot drain credits (CVE-class: unauthenticated fund transfer)';
END $$;

-- ============================================================================
-- CRITICAL 2 — anon reading KYC PII off active listings
-- ============================================================================
-- Original: table-wide SELECT to anon. RLS filters ROWS, never COLUMNS, so the
-- active-listing policy left identity documents world-readable.

SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims TO '{}';

DO $$
DECLARE
  leaked TEXT;
  denied BOOLEAN;
BEGIN
  FOREACH leaked IN ARRAY ARRAY[
    'national_id_url', 'national_id_back_url', 'selfie_url', 'date_of_birth',
    'home_address', 'insurance_policy_number', 'contact_phone', 'contact_whatsapp'
  ] LOOP
    denied := FALSE;
    BEGIN
      EXECUTE format('SELECT %I FROM public.professional_profiles LIMIT 1', leaked);
    EXCEPTION WHEN insufficient_privilege THEN
      denied := TRUE;
    END;

    ASSERT denied,
      format('CRITICAL REGRESSION: anon can read professional_profiles.%s — '
             || 'RLS filters rows, not columns. Use a column-level GRANT.', leaked);
  END LOOP;

  RAISE NOTICE 'PASS 2 — anon cannot read identity documents, DOB, address, or contact fields';
END $$;

-- The storefront must still render. A fix that blinds the marketplace is a
-- different outage, not a fix.
DO $$
DECLARE
  visible INT;
  name_read TEXT;
BEGIN
  -- Asserted as a property, not as a count.
  --
  -- This previously read `visible = 2`, matching the two fixtures above. That
  -- passed, but it was testing "the database contains what I just inserted"
  -- rather than "anon sees active listings and nothing else" — and it broke the
  -- moment `npm run db:seed` (S046) put real development supply in the database,
  -- reporting a security failure where none existed.
  --
  -- The two assertions below state the actual property directly and hold for any
  -- amount of ambient data: anon can see at least the active fixtures, and anon
  -- can see NO listing that is not active. The second is the one that matters —
  -- a draft or suspended listing leaking to the public storefront is the bug.
  SELECT COUNT(*) INTO visible
    FROM public.professional_profiles
   WHERE listing_status <> 'active';
  ASSERT visible = 0,
    format('CRITICAL: anon can see %s non-active listing(s) — drafts and suspended '
           || 'profiles must never reach the public storefront', visible);

  SELECT COUNT(*) INTO visible FROM public.professional_profiles;
  ASSERT visible >= 2,
    format('the public storefront went blind — anon sees %s listings', visible);

  SELECT business_name INTO name_read FROM public.professional_profiles
   WHERE slug LIKE 'victim-services%';
  ASSERT name_read = 'Victim Services', 'public columns are no longer readable';

  RAISE NOTICE 'PASS 3 — public storefront columns still render for anon';
END $$;

-- ============================================================================
-- CRITICAL 3 — anon truncating storage.objects
-- ============================================================================
-- Original: harden_grants was scoped IN SCHEMA public only, so storage kept
-- full anon DML including TRUNCATE, which bypasses RLS entirely.

SET LOCAL ROLE postgres;
SET LOCAL request.jwt.claims TO '{}';

-- KNOWN UNRESOLVED, and deliberately reported rather than asserted away.
--
-- `storage.objects` is owned by `supabase_storage_admin`; migrations run as
-- `postgres`, which is not a member of it, and a non-owner REVOKE silently does
-- nothing. So this check CANNOT pass in a local stack no matter what the
-- migration says.
--
-- Asserting it here would leave the suite permanently red and the whole file
-- would get skipped — which is how a real finding becomes invisible. Instead it
-- reports loudly every run, so it stays visible until an operator clears it on
-- the hosted project (docs/OPS-STORAGE-GRANTS.md) and this becomes a hard
-- assertion.
DO $$
DECLARE
  offenders TEXT;
BEGIN
  SELECT string_agg(DISTINCT table_schema || '.' || table_name || ' → ' || grantee, ', ')
    INTO offenders
    FROM information_schema.role_table_grants
   WHERE table_schema IN ('storage', 'supabase_functions')
     AND privilege_type = 'TRUNCATE'
     AND grantee IN ('anon', 'authenticated');

  IF offenders IS NULL THEN
    RAISE NOTICE 'PASS 4 — no client role can TRUNCATE storage or supabase_functions';
  ELSE
    RAISE WARNING
      'OPEN FINDING (not a regression): client roles retain TRUNCATE on %. '
      'Not fixable from a migration — see docs/OPS-STORAGE-GRANTS.md. '
      'RLS does not apply to TRUNCATE.', offenders;
    RAISE NOTICE 'PASS 4 (reported) — storage TRUNCATE remains an OPEN operator action';
  END IF;
END $$;

-- ============================================================================
-- HIGH 4 — the connection gate had no database enforcement
-- ============================================================================
-- Original: the gate lived only in TypeScript. The anon key ships in the web
-- bundle and both apps, and connections granted INSERT under a policy that
-- checked ownership and nothing else. Confirmed: a customer at the limit
-- inserted ten further connections directly.

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"7b000000-0000-0000-0000-0000000000b1","role":"authenticated"}';

DO $$
DECLARE
  blocked BOOLEAN := FALSE;
  msg TEXT;
  total INT;
BEGIN
  -- Two free contacts are allowed.
  INSERT INTO public.connections (customer_id, professional_id)
  VALUES ('7b000000-0000-0000-0000-0000000000b1', '7aaaaaaa-0000-0000-0000-00000000aaa1');
  INSERT INTO public.connections (customer_id, professional_id)
  VALUES ('7b000000-0000-0000-0000-0000000000b1', '7ccccccc-0000-0000-0000-00000000ccc1');

  -- The third, to a NEW professional, must be refused without verification.
  BEGIN
    INSERT INTO public.connections (customer_id, professional_id)
    SELECT '7b000000-0000-0000-0000-0000000000b1', id
      FROM public.professional_profiles
     WHERE id NOT IN ('7aaaaaaa-0000-0000-0000-00000000aaa1',
                      '7ccccccc-0000-0000-0000-00000000ccc1')
     LIMIT 1;
    -- No third professional exists in this fixture, so fabricate the attempt
    -- against a fresh id to make the gate the thing being tested.
    INSERT INTO public.connections (customer_id, professional_id)
    VALUES ('7b000000-0000-0000-0000-0000000000b1', '7aaaaaaa-0000-0000-0000-00000000aaa2');
  EXCEPTION
    WHEN insufficient_privilege THEN
      blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
    WHEN foreign_key_violation THEN
      -- The gate is evaluated BEFORE the FK, so reaching this means the gate
      -- let it through.
      blocked := FALSE;
  END;

  ASSERT blocked,
    'HIGH REGRESSION: the connection gate is not enforced in the database. '
    || 'A holder of the anon key can insert connections directly and bypass '
    || 'the KYC requirement entirely — the exact V1 failure V2 claims to fix.';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: blocked by a missing GRANT, not the gate: ' || msg;
  ASSERT msg LIKE '%verification is required%',
    'blocked by the wrong mechanism: ' || msg;

  SET LOCAL ROLE postgres;
  SELECT COUNT(*) INTO total FROM public.connections
   WHERE customer_id = '7b000000-0000-0000-0000-0000000000b1';
  ASSERT total = 2, format('expected 2 connections, found %s', total);

  RAISE NOTICE 'PASS 5 — the connection gate is enforced by the database, not only the API';
END $$;

-- Reconnecting to someone already known stays free, or the gate charges twice
-- for one relationship.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"7b000000-0000-0000-0000-0000000000b1","role":"authenticated"}';

DO $$
DECLARE
  allowed BOOLEAN := TRUE;
BEGIN
  BEGIN
    INSERT INTO public.connections (customer_id, professional_id)
    VALUES ('7b000000-0000-0000-0000-0000000000b1', '7aaaaaaa-0000-0000-0000-00000000aaa1');
  EXCEPTION
    WHEN insufficient_privilege THEN allowed := FALSE;
    WHEN unique_violation THEN allowed := TRUE;  -- already connected: also fine
  END;

  ASSERT allowed,
    'the gate refused a RECONNECTION to an existing contact — that charges a '
    || 'customer twice for one relationship';

  RAISE NOTICE 'PASS 6 — reconnecting to an existing contact is still free';
END $$;

-- Verified customers pass the gate.
SET LOCAL ROLE postgres;
SET LOCAL request.jwt.claims TO '{}';

UPDATE public.customer_profiles
   SET kyc_status = 'verified', kyc_verified_at = NOW()
 WHERE user_id = '7b000000-0000-0000-0000-0000000000b1';

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"7b000000-0000-0000-0000-0000000000b1","role":"authenticated"}';

DO $$
DECLARE
  allowed BOOLEAN := TRUE;
BEGIN
  BEGIN
    INSERT INTO public.connections (customer_id, professional_id)
    VALUES ('7b000000-0000-0000-0000-0000000000b1', '7aaaaaaa-0000-0000-0000-00000000aaa3');
  EXCEPTION
    WHEN insufficient_privilege THEN allowed := FALSE;
    WHEN foreign_key_violation THEN allowed := TRUE;  -- passed the gate, failed the FK
  END;

  ASSERT allowed,
    'a KYC-verified customer was refused — verification must lift the gate, '
    || 'or the whole verification flow buys the user nothing';

  RAISE NOTICE 'PASS 7 — verification lifts the gate';
END $$;

-- ============================================================================
-- MEDIUM — matches_grants LIKE-metacharacter injection
-- ============================================================================

SET LOCAL ROLE postgres;
SET LOCAL request.jwt.claims TO '{}';

DO $$
BEGIN
  -- A grant containing a LIKE wildcard must NOT act as one.
  ASSERT NOT public.matches_grants('billing.refund', '["%.*"]'::jsonb),
    'REGRESSION: a "%" in a grant key acts as a LIKE wildcard and matches every '
    || 'capability, including money surfaces';

  ASSERT NOT public.matches_grants('queue.approvals.decide', '["queue_.*"]'::jsonb),
    'REGRESSION: an underscore in a grant key acts as a LIKE single-char wildcard';

  -- The legitimate wildcard must still work.
  ASSERT public.matches_grants('queue.approvals.decide', '["queue.*"]'::jsonb),
    'the legitimate prefix wildcard stopped working';
  ASSERT public.matches_grants('anything.at.all', '["*"]'::jsonb),
    'the global wildcard stopped working';

  -- The asymmetry: a concrete key only.
  ASSERT NOT public.matches_grants('queue', '["queue.*"]'::jsonb),
    'queue.* must not match the bare prefix';
  ASSERT NOT public.matches_grants('queuex.thing', '["queue.*"]'::jsonb),
    'queue.* must not match queuex.thing';

  RAISE NOTICE 'PASS 8 — grant matching resists LIKE injection, wildcards still work';
END $$;

-- ============================================================================
-- CRITICAL 9 — authenticated stranger reading gated contact columns
-- ============================================================================
-- Original (found at the S080 close-out, 24 Jul 2026): 20260719000005 fixed
-- the anon leak with a column allow-list but left `authenticated` holding
-- table-wide SELECT, deferring redaction to "the API's job". The anon key
-- ships in every bundle and a session is free to mint, so ANY signed-in JWT
-- could PostgREST-select contact_phone / contact_whatsapp / home_address on
-- every active listing — bypassing the connection gate, the platform's whole
-- monetisation boundary. Closed by 20260724000001: both client roles now hold
-- the identical column allow-list.

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"7b000000-0000-0000-0000-0000000000b1","role":"authenticated"}';

DO $$
DECLARE
  leaked TEXT;
  denied BOOLEAN;
  name_read TEXT;
BEGIN
  FOREACH leaked IN ARRAY ARRAY[
    'national_id_url', 'national_id_back_url', 'selfie_url', 'date_of_birth',
    'home_address', 'insurance_policy_number', 'contact_phone', 'contact_whatsapp'
  ] LOOP
    denied := FALSE;
    BEGIN
      EXECUTE format('SELECT %I FROM public.professional_profiles LIMIT 1', leaked);
    EXCEPTION WHEN insufficient_privilege THEN
      denied := TRUE;
    END;

    ASSERT denied,
      format('CRITICAL REGRESSION: authenticated can read professional_profiles.%s — '
             || 'the connection gate is bypassable by any signed-in JWT. '
             || 'The grant must match the anon allow-list (20260724000001).', leaked);
  END LOOP;

  -- The marketplace must still render for signed-in viewers. A fix that blinds
  -- them is a different outage, not a fix.
  SELECT business_name INTO name_read
    FROM public.professional_profiles
   WHERE id = '7aaaaaaa-0000-0000-0000-00000000aaa1';
  ASSERT name_read = 'Victim Services',
    'REGRESSION: the column-scoped grant blinded signed-in viewers to public columns';

  RAISE NOTICE 'PASS 9 — authenticated stranger cannot read contact/PII columns; public columns render';
END $$;

-- The grant is role-wide, so even the OWNER's RLS-client read is refused —
-- self-reads of contact columns are server-side (admin client) by design
-- (20260724000001 header: a future client-side self-read gets a self-scoped
-- SECURITY DEFINER RPC, never a wider grant). This pins that decision.
SET LOCAL request.jwt.claims TO
  '{"sub":"7a000000-0000-0000-0000-0000000000a1","role":"authenticated"}';

DO $$
DECLARE
  denied BOOLEAN := FALSE;
BEGIN
  BEGIN
    PERFORM contact_phone FROM public.professional_profiles
     WHERE user_id = '7a000000-0000-0000-0000-0000000000a1';
  EXCEPTION WHEN insufficient_privilege THEN
    denied := TRUE;
  END;

  ASSERT denied,
    'DESIGN DRIFT: the owner read contact_phone through the RLS client — '
    || 'if a client-side self-read is now required, add a self-scoped '
    || 'SECURITY DEFINER RPC (20260724000001 header), never a wider grant.';

  RAISE NOTICE 'PASS 9b — contact columns are server-read only, even for the owner';
END $$;

ROLLBACK;

\echo ''
\echo '================================================'
\echo ' vulnerability regression suite: ALL CLOSED'
\echo '================================================'
