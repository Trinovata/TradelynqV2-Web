-- ============================================================================
-- Storage bucket policy tests (playbook S045/S047)
--
-- The property that matters: kyc-documents must be unreachable by anyone except
-- its owner and an admin. It holds identity documents, selfies, and dates of
-- birth — the single most sensitive data on the platform.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

BEGIN;

-- ── Fixtures ────────────────────────────────────────────────────────────────

INSERT INTO auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_user_meta_data, created_at, updated_at)
VALUES
  ('5a5a5a5a-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'storage-owner@tradelynq.test', 'x', NOW(),
   jsonb_build_object('full_name', 'Owner User'), NOW(), NOW()),
  ('5b5b5b5b-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'storage-rival@tradelynq.test', 'x', NOW(),
   jsonb_build_object('full_name', 'Rival User'), NOW(), NOW());

-- Objects owned by the first user, in both buckets.
INSERT INTO storage.objects (bucket_id, name, owner, metadata)
VALUES
  ('professional-assets',
   '5a5a5a5a-0000-0000-0000-00000000000a/portfolio/kitchen.jpg',
   '5a5a5a5a-0000-0000-0000-00000000000a', '{}'::jsonb),
  ('kyc-documents',
   '5a5a5a5a-0000-0000-0000-00000000000a/id-front.jpg',
   '5a5a5a5a-0000-0000-0000-00000000000a', '{}'::jsonb);

-- ── 1. Bucket posture ───────────────────────────────────────────────────────

DO $$
DECLARE
  assets_public BOOLEAN;
  kyc_public BOOLEAN;
BEGIN
  SELECT public INTO assets_public FROM storage.buckets WHERE id = 'professional-assets';
  SELECT public INTO kyc_public FROM storage.buckets WHERE id = 'kyc-documents';

  ASSERT assets_public,
    'professional-assets must be public — a storefront that cannot show images signed-out has no shop window';
  ASSERT NOT kyc_public,
    'CRITICAL: kyc-documents is a PUBLIC bucket. It holds identity documents.';

  RAISE NOTICE 'PASS 1 — bucket visibility is correct in both directions';
END $$;

-- ── 2. Anonymous visitors ───────────────────────────────────────────────────

SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims TO '{}';

DO $$
DECLARE
  visible_assets INT;
  visible_kyc INT;
BEGIN
  SELECT COUNT(*) INTO visible_assets
    FROM storage.objects WHERE bucket_id = 'professional-assets';
  SELECT COUNT(*) INTO visible_kyc
    FROM storage.objects WHERE bucket_id = 'kyc-documents';

  -- Portfolio images must render to a signed-out visitor.
  ASSERT visible_assets = 1,
    format('a signed-out visitor should see the portfolio image, saw %s', visible_assets);

  -- Identity documents must not.
  ASSERT visible_kyc = 0,
    format('PRIVACY BREACH: anon can see %s KYC objects', visible_kyc);

  RAISE NOTICE 'PASS 2 — anon reads portfolio images and NO kyc documents';
END $$;

-- ── 3. A signed-in stranger ─────────────────────────────────────────────────

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"5b5b5b5b-0000-0000-0000-00000000000b","role":"authenticated"}';

DO $$
DECLARE
  visible_kyc INT;
BEGIN
  SELECT COUNT(*) INTO visible_kyc
    FROM storage.objects WHERE bucket_id = 'kyc-documents';

  -- Being signed in grants nothing here. Only the owner and admins may read.
  ASSERT visible_kyc = 0,
    format('PRIVACY BREACH: another signed-in user can see %s KYC objects', visible_kyc);

  RAISE NOTICE 'PASS 3 — a signed-in stranger cannot read another user''s KYC documents';
END $$;

-- ── 4. Path traversal into another user's folder ────────────────────────────
-- The path IS the boundary, so this is the attack that matters.

DO $$
DECLARE
  blocked BOOLEAN := FALSE;
BEGIN
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES (
      'professional-assets',
      -- Writing into the OTHER user's folder to replace their portfolio.
      '5a5a5a5a-0000-0000-0000-00000000000a/portfolio/replaced.jpg',
      '5b5b5b5b-0000-0000-0000-00000000000b', '{}'::jsonb
    );
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    blocked := TRUE;
  END;

  ASSERT blocked,
    'SECURITY HOLE: a user wrote into another user''s asset folder. '
    || 'The foldername(name)[1] = auth.uid() check is not holding.';

  RAISE NOTICE 'PASS 4 — cannot write into another user''s folder';
END $$;

-- ── 5. The owner can reach their own objects ────────────────────────────────
-- A policy set that blocks the legitimate path gets loosened by the next person
-- to hit it, so prove the intended access works.

SET LOCAL request.jwt.claims TO
  '{"sub":"5a5a5a5a-0000-0000-0000-00000000000a","role":"authenticated"}';

DO $$
DECLARE
  own_kyc INT;
BEGIN
  SELECT COUNT(*) INTO own_kyc
    FROM storage.objects WHERE bucket_id = 'kyc-documents';

  ASSERT own_kyc = 1,
    format('the owner should see their own KYC upload, saw %s', own_kyc);

  RAISE NOTICE 'PASS 5 — the owner can read back their own documents';
END $$;

-- ── 6. KYC documents cannot be replaced after submission ────────────────────

DO $$
DECLARE
  affected INT;
BEGIN
  UPDATE storage.objects
     SET name = '5a5a5a5a-0000-0000-0000-00000000000a/id-front-swapped.jpg'
   WHERE bucket_id = 'kyc-documents';
  GET DIAGNOSTICS affected = ROW_COUNT;

  -- There is no UPDATE policy on this bucket, so the statement matches nothing.
  -- A submitted document is evidence in a verification decision: if the subject
  -- can replace it afterwards, the document an admin approved is not necessarily
  -- the document on file. Resubmission writes a NEW path.
  ASSERT affected = 0,
    'a submitted KYC document was modifiable — the approved document is then unprovable';

  RAISE NOTICE 'PASS 6 — submitted KYC documents are immutable';
END $$;

SET LOCAL ROLE postgres;
SET LOCAL request.jwt.claims TO '{}';

ROLLBACK;

\echo ''
\echo '================================================'
\echo ' storage policy suite: ALL CHECKS PASSED'
\echo '================================================'
