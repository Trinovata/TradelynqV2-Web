-- ============================================================================
-- feedback_messages policy suite (playbook S089, migration 20260725000001).
--
-- The properties that matter: anon can SUBMIT through the RPC but can never
-- read the inbox (it holds reporters' emails), never write the table
-- directly, and the RPC refuses blank/oversized messages at the boundary —
-- the zod layer is friendliness, this is enforcement.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

BEGIN;

-- ── anon: RPC submit works ──────────────────────────────────────────────────
SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims TO '{}';

DO $$
BEGIN
  PERFORM public.submit_feedback('The search bar loses focus on mobile.', 'Test Reporter', 'reporter@example.test');
  RAISE NOTICE 'PASS 1 — anon submits feedback through the RPC';
END $$;

-- ── anon: direct table access refused, both directions ──────────────────────
DO $$
DECLARE
  blocked BOOLEAN := FALSE;
BEGIN
  BEGIN
    INSERT INTO public.feedback_messages (message) VALUES ('direct write');
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE;
  END;
  ASSERT blocked, 'REGRESSION: anon wrote feedback_messages directly — the harden_grants invariant is broken';

  blocked := FALSE;
  BEGIN
    PERFORM * FROM public.feedback_messages;
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE;
  END;
  ASSERT blocked, 'REGRESSION: anon read the feedback inbox — reporters'' emails are exposed';

  RAISE NOTICE 'PASS 2 — anon can neither write nor read the table directly';
END $$;

-- ── authenticated: same posture, and the row is attributed ───────────────────
SET LOCAL ROLE postgres;
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
VALUES ('feedbac0-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'feedback-user@tradelynq.test', 'x', NOW(),
        jsonb_build_object('full_name', 'Feedback User'), NOW(), NOW());

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"feedbac0-0000-0000-0000-0000000000f1","role":"authenticated"}';

DO $$
DECLARE
  blocked BOOLEAN := FALSE;
BEGIN
  PERFORM public.submit_feedback('Signed-in feedback.');

  BEGIN
    PERFORM * FROM public.feedback_messages;
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE;
  END;
  ASSERT blocked, 'REGRESSION: authenticated read the feedback inbox';

  RAISE NOTICE 'PASS 3 — authenticated submits via RPC, cannot read the inbox';
END $$;

-- ── attribution + boundary validation, checked from above ────────────────────
SET LOCAL ROLE postgres;

DO $$
DECLARE
  attributed UUID;
  n INT;
BEGIN
  SELECT user_id INTO attributed FROM public.feedback_messages
   WHERE message = 'Signed-in feedback.';
  ASSERT attributed = 'feedbac0-0000-0000-0000-0000000000f1',
    'REGRESSION: the signed-in submission was not attributed to auth.uid()';

  SELECT user_id INTO attributed FROM public.feedback_messages
   WHERE message = 'The search bar loses focus on mobile.';
  ASSERT attributed IS NULL,
    'REGRESSION: an anon submission carries a user id';

  SELECT COUNT(*) INTO n FROM public.feedback_messages;
  ASSERT n = 2, format('expected exactly the 2 fixture rows, found %s', n);

  RAISE NOTICE 'PASS 4 — attribution comes from the session, never the body';
END $$;

SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims TO '{}';

DO $$
DECLARE
  refused BOOLEAN := FALSE;
BEGIN
  BEGIN
    PERFORM public.submit_feedback('   ');
  EXCEPTION WHEN check_violation THEN
    refused := TRUE;
  END;
  ASSERT refused, 'REGRESSION: the RPC accepted a blank message';

  refused := FALSE;
  BEGIN
    PERFORM public.submit_feedback(repeat('x', 5001));
  EXCEPTION WHEN check_violation THEN
    refused := TRUE;
  END;
  ASSERT refused, 'REGRESSION: the RPC accepted an oversized message';

  RAISE NOTICE 'PASS 5 — the RPC enforces its own boundary, not just zod';
END $$;

ROLLBACK;

\echo ''
\echo '================================================'
\echo ' feedback policy suite: ALL PASSED'
\echo '================================================'
