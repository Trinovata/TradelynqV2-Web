-- ============================================================================
-- Policy and constraint tests for categories, professional_profiles,
-- and customer_profiles (playbook S047).
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

BEGIN;

-- ── Fixtures ────────────────────────────────────────────────────────────────

INSERT INTO auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_user_meta_data, created_at, updated_at)
VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pro@tradelynq.test', 'x', NOW(), jsonb_build_object('full_name', 'Ravi Pro'), NOW(), NOW()),
  ('bbbbbbbb-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'cust@tradelynq.test', 'x', NOW(), jsonb_build_object('full_name', 'Nia Customer'), NOW(), NOW()),
  ('cccccccc-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rival@tradelynq.test', 'x', NOW(), jsonb_build_object('full_name', 'Rival Pro'), NOW(), NOW());

UPDATE public.profiles
   SET role = 'professional', professional_subtype = 'sole_trader', role_confirmed = TRUE
 WHERE id IN ('aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003');

UPDATE public.profiles
   SET role = 'customer', role_confirmed = TRUE
 WHERE id = 'bbbbbbbb-0000-0000-0000-000000000002';

-- ── 1. Category seed ────────────────────────────────────────────────────────

DO $$
DECLARE
  parents INT;
  children INT;
  orphans INT;
BEGIN
  SELECT COUNT(*) INTO parents FROM public.categories WHERE parent_slug IS NULL;
  SELECT COUNT(*) INTO children FROM public.categories WHERE parent_slug IS NOT NULL;

  ASSERT parents = 12, format('expected 12 parent categories, got %s', parents);
  ASSERT children >= 60, format('expected 60+ child categories, got %s', children);

  -- Every child must point at a real parent, and that parent must be top-level:
  -- a three-level tree would break the navigation and SEO route shape.
  SELECT COUNT(*) INTO orphans
    FROM public.categories c
    LEFT JOIN public.categories p ON p.slug = c.parent_slug
   WHERE c.parent_slug IS NOT NULL AND (p.slug IS NULL OR p.parent_slug IS NOT NULL);
  ASSERT orphans = 0, format('%s categories have a missing or non-top-level parent', orphans);

  RAISE NOTICE 'PASS 1 — category taxonomy seeded (% parents, % children)', parents, children;
END $$;

-- ── 2. Category constraints ─────────────────────────────────────────────────

DO $$
DECLARE
  rejected BOOLEAN;
BEGIN
  rejected := FALSE;
  BEGIN
    INSERT INTO public.categories (slug, name) VALUES ('Not Kebab Case', 'Bad');
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'a non-kebab slug was accepted';

  -- DESIGN.md bans literal hex; the taxonomy is no exception.
  rejected := FALSE;
  BEGIN
    INSERT INTO public.categories (slug, name, color) VALUES ('hex-test', 'Hex', '#FF0000');
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;
  ASSERT rejected, 'a literal hex colour was accepted into categories';

  RAISE NOTICE 'PASS 2 — category constraints hold';
END $$;

-- ── 3. Professional profile: slug generation and collision handling ─────────

DO $$
DECLARE
  slug_a TEXT;
  slug_b TEXT;
BEGIN
  INSERT INTO public.professional_profiles (user_id, business_name, owner_name)
  VALUES ('aaaaaaaa-0000-0000-0000-000000000001', 'Ravi''s Plumbing', 'Ravi Pro');

  INSERT INTO public.professional_profiles (user_id, business_name, owner_name)
  VALUES ('cccccccc-0000-0000-0000-000000000003', 'Ravi''s Plumbing', 'Rival Pro');

  SELECT slug INTO slug_a FROM public.professional_profiles
   WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  SELECT slug INTO slug_b FROM public.professional_profiles
   WHERE user_id = 'cccccccc-0000-0000-0000-000000000003';

  ASSERT slug_a = 'ravi-s-plumbing', format('unexpected first slug: %s', slug_a);
  -- Two professionals may legitimately share a trading name. The second must
  -- get a distinct URL, not an error and not the first one's storefront.
  ASSERT slug_b = 'ravi-s-plumbing-2', format('collision not handled: %s', slug_b);

  RAISE NOTICE 'PASS 3 — slugs generate and de-collide (%, %)', slug_a, slug_b;
END $$;

-- ── 4. Search vector is populated and weighted ──────────────────────────────

DO $$
DECLARE
  vec TSVECTOR;
  hits INT;
BEGIN
  UPDATE public.professional_profiles
     SET tagline = 'Emergency callouts across the East', bio = 'Twenty years of pipework.',
         service_areas = ARRAY['Arima', 'Sangre Grande']
   WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

  SELECT search_vector INTO vec FROM public.professional_profiles
   WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  ASSERT vec IS NOT NULL, 'search_vector was not populated';

  -- Scoped to the fixture row. A bare `COUNT(*) … = 1` asserted that exactly one
  -- professional in the entire database serves Arima, which is a fact about the
  -- data rather than about the search vector — and it broke as soon as
  -- `npm run db:seed` (S046) added development supply that also serves Arima.
  -- The property under test is "this row's service_areas reached its
  -- search_vector", so the query now names the row.
  SELECT COUNT(*) INTO hits FROM public.professional_profiles
   WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001'
     AND search_vector @@ to_tsquery('english', 'arima');
  ASSERT hits = 1, 'service area not searchable via search_vector';

  SELECT COUNT(*) INTO hits FROM public.professional_profiles
   WHERE search_vector @@ to_tsquery('english', 'pipework');
  ASSERT hits = 1, 'bio not searchable via search_vector';

  RAISE NOTICE 'PASS 4 — search vector populated and queryable';
END $$;

-- ── 5. Incomplete listings cannot go active ─────────────────────────────────

DO $$
DECLARE
  rejected BOOLEAN := FALSE;
BEGIN
  -- No category and no service areas: the storefront would render an empty shell.
  BEGIN
    UPDATE public.professional_profiles SET listing_status = 'active'
     WHERE user_id = 'cccccccc-0000-0000-0000-000000000003';
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;

  ASSERT rejected, 'an incomplete listing was allowed to go active';
  RAISE NOTICE 'PASS 5 — incomplete listings cannot be published';
END $$;

-- ── 6. Coordinate pairing ───────────────────────────────────────────────────

DO $$
DECLARE
  rejected BOOLEAN := FALSE;
BEGIN
  BEGIN
    UPDATE public.professional_profiles SET latitude = 10.65
     WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;

  -- Half a coordinate pair silently maps to the Gulf of Guinea.
  ASSERT rejected, 'a half coordinate pair was accepted';
  RAISE NOTICE 'PASS 6 — coordinates must be paired';
END $$;

-- ── 7. THE PROFESSIONAL COLUMN GUARD ────────────────────────────────────────

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

DO $$
DECLARE
  blocked BOOLEAN;
  msg TEXT;
BEGIN
  -- Self-verification would make the entire trust ladder decorative.
  blocked := FALSE;
  BEGIN
    UPDATE public.professional_profiles SET verification_status = 'fully_verified'
     WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'SECURITY HOLE: a professional verified themselves';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: blocked by a missing GRANT, not the guard: ' || msg;
  ASSERT msg LIKE '%administrators only%', 'wrong guard fired: ' || msg;

  -- Self-rating would make every rating on the platform meaningless.
  blocked := FALSE;
  BEGIN
    UPDATE public.professional_profiles SET average_rating = 5.00, review_count = 99
     WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'SECURITY HOLE: a professional set their own rating';
  ASSERT msg LIKE '%derived from reviews%', 'wrong guard fired: ' || msg;

  -- Self-publication would bypass moderation entirely.
  blocked := FALSE;
  BEGIN
    UPDATE public.professional_profiles SET listing_status = 'active'
     WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'SECURITY HOLE: a professional published their own listing';

  RAISE NOTICE 'PASS 7 — professionals cannot self-verify, self-rate, or self-publish';
END $$;

-- ── 8. Submitting for review IS allowed ─────────────────────────────────────
-- A guard that blocks the legitimate path gets removed.

DO $$
DECLARE
  status_after listing_status;
BEGIN
  UPDATE public.professional_profiles SET listing_status = 'pending_review'
   WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

  SELECT listing_status INTO status_after FROM public.professional_profiles
   WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001';

  ASSERT status_after = 'pending_review', 'a professional could not submit for review';
  RAISE NOTICE 'PASS 8 — draft to pending_review is permitted';
END $$;

-- ── 9. Cross-professional isolation ─────────────────────────────────────────

DO $$
DECLARE
  affected INT;
  visible INT;
BEGIN
  UPDATE public.professional_profiles SET bio = 'Sabotage'
   WHERE user_id = 'cccccccc-0000-0000-0000-000000000003';
  GET DIAGNOSTICS affected = ROW_COUNT;
  ASSERT affected = 0, 'RLS leak: one professional edited another''s listing';

  -- Stated as two properties rather than one count.
  --
  -- This read `COUNT(*) = 1`, resting on the assumption that no listing anywhere
  -- was active, so Ravi's own row was the only thing visible. Development supply
  -- from `npm run db:seed` (S046) includes active listings — which Ravi is
  -- *supposed* to see, since they are public — so the count became 11 and the
  -- suite reported an RLS leak that did not exist.
  --
  -- What actually must hold is: Ravi sees his own row, and Ravi sees no other
  -- professional's unpublished row. Active listings being visible is the
  -- marketplace working, not a leak.
  SELECT COUNT(*) INTO visible FROM public.professional_profiles
   WHERE user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  ASSERT visible = 1,
    format('RLS leak: a professional cannot see their own listing, saw %s', visible);

  SELECT COUNT(*) INTO visible FROM public.professional_profiles
   WHERE listing_status <> 'active'
     AND user_id <> 'aaaaaaaa-0000-0000-0000-000000000001';
  ASSERT visible = 0,
    format('RLS leak: professional can see %s other unpublished listing(s)', visible);

  RAISE NOTICE 'PASS 9 — professionals are isolated from each other';
END $$;

-- ── 10. Customer profile guards ─────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO public.customer_profiles (user_id, area, connection_count)
VALUES ('bbbbbbbb-0000-0000-0000-000000000002', 'Port of Spain', 2);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';

DO $$
DECLARE
  blocked BOOLEAN;
  msg TEXT;
BEGIN
  -- The entire connection gate rests on this counter.
  blocked := FALSE;
  BEGIN
    UPDATE public.customer_profiles SET connection_count = 0
     WHERE user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'SECURITY HOLE: a customer reset their own connection count';
  ASSERT msg NOT LIKE '%permission denied for table%',
    'FALSE POSITIVE: missing GRANT, not the guard: ' || msg;

  -- Self-approving KYC defeats the whole verification step.
  blocked := FALSE;
  BEGIN
    UPDATE public.customer_profiles SET kyc_status = 'verified'
     WHERE user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  EXCEPTION WHEN insufficient_privilege THEN
    blocked := TRUE; GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
  END;
  ASSERT blocked, 'SECURITY HOLE: a customer verified their own KYC';

  -- But uploading documents and submitting must work.
  UPDATE public.customer_profiles SET kyc_status = 'submitted', kyc_submitted_at = NOW()
   WHERE user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

  RAISE NOTICE 'PASS 10 — customer gate and KYC guards hold, submission still works';
END $$;

-- ── 11. KYC attribution constraint ──────────────────────────────────────────

-- Switching the database role is NOT enough to leave the user's identity behind:
-- SET LOCAL request.jwt.claims persists for the transaction, and the guards key
-- off auth.uid() (which reads the claims), not off the database role. That is
-- correct — the service role's JWT carries no `sub`, so auth.uid() is NULL and
-- the guard bypasses. The claims must be cleared to simulate that.
SET LOCAL ROLE postgres;
SET LOCAL request.jwt.claims TO '{}';

DO $$
DECLARE
  rejected BOOLEAN := FALSE;
BEGIN
  -- "Verified" with no verifier and no timestamp is unfalsifiable.
  BEGIN
    UPDATE public.customer_profiles
       SET kyc_status = 'verified', kyc_verified_at = NULL, kyc_verified_by = NULL
     WHERE user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;

  ASSERT rejected, 'a KYC record was marked verified with no attribution';
  RAISE NOTICE 'PASS 11 — verified KYC must record who and when';
END $$;

-- ── 12. Customer profiles are never publicly readable ───────────────────────

SET LOCAL ROLE anon;

DO $$
DECLARE
  visible INT;
  denied BOOLEAN := FALSE;
BEGIN
  -- These rows carry identity documents, date of birth, and address, so anon is
  -- denied at BOTH layers: no GRANT at all, and no policy that would match.
  -- The GRANT denial fires first and is the stronger guarantee — the query never
  -- reaches the policy evaluator. Either outcome is acceptable; a readable row
  -- is not.
  BEGIN
    SELECT COUNT(*) INTO visible FROM public.customer_profiles;
  EXCEPTION WHEN insufficient_privilege THEN
    denied := TRUE;
  END;

  IF NOT denied THEN
    ASSERT visible = 0, format('PRIVACY LEAK: anon can see %s customer profiles', visible);
    RAISE NOTICE 'PASS 12 — customer profiles return zero rows to anonymous callers';
  ELSE
    RAISE NOTICE 'PASS 12 — customer profiles unreachable by anon (denied at GRANT level)';
  END IF;
END $$;

-- The professional storefront, by contrast, MUST be publicly readable — a
-- marketplace nobody can browse signed-out has no acquisition funnel. Proving
-- the two tables differ deliberately, rather than one being locked by accident.

DO $$
DECLARE
  visible INT;
BEGIN
  -- The read itself must succeed, proving the public path exists at all — an
  -- exception here would mean the marketplace is unbrowsable signed-out.
  --
  -- The assertion is scoped to non-active rows. It previously read `visible = 0`
  -- across the whole table, which was only true because neither fixture was
  -- active; once `npm run db:seed` (S046) added published supply, anon correctly
  -- saw 10 active listings and the suite called it a leak. Active listings being
  -- publicly readable is the entire point of the table.
  SELECT COUNT(*) INTO visible FROM public.professional_profiles
   WHERE listing_status <> 'active';
  ASSERT visible = 0,
    format('anon saw %s non-active listings; only active ones may be public', visible);

  RAISE NOTICE 'PASS 13 — professional listings are publicly readable, active-only';
END $$;

SET LOCAL ROLE postgres;

ROLLBACK;

\echo ''
\echo '================================================'
\echo ' domain policy suite: ALL CHECKS PASSED'
\echo '================================================'
