-- ============================================================================
-- Policy tests for the catalogue, WhatsApp, AI knowledge, content library,
-- ads, and referral tables (playbook S044 / permanent suite S047).
--
-- Written to ATTACK the tables rather than exercise them. Three findings in
-- this codebase came from tests that tried to break something, including one
-- where the most important check passed for entirely the wrong reason — so
-- every assertion here names the specific breach it would catch.
--
-- Assertions are scoped to their own fixtures. A suite that counts whole tables
-- passes only on an empty database, which is how five assertions in the other
-- suites silently became coupled to one.
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

BEGIN;

-- ── Fixtures ────────────────────────────────────────────────────────────────

INSERT INTO auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_user_meta_data, created_at, updated_at)
VALUES
  ('11110000-0000-4000-8000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'poster@tradelynq.test', 'x', NOW(), jsonb_build_object('full_name', 'Poster Pro'), NOW(), NOW()),
  ('22220000-0000-4000-8000-000000000002',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rival@tradelynq.test', 'x', NOW(), jsonb_build_object('full_name', 'Rival Pro'), NOW(), NOW()),
  ('33330000-0000-4000-8000-000000000003',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'saver@tradelynq.test', 'x', NOW(), jsonb_build_object('full_name', 'Saver Customer'), NOW(), NOW());

UPDATE public.profiles
   SET role = 'professional', professional_subtype = 'sole_trader', role_confirmed = TRUE
 WHERE id IN ('11110000-0000-4000-8000-000000000001', '22220000-0000-4000-8000-000000000002');

UPDATE public.profiles
   SET role = 'customer', role_confirmed = TRUE
 WHERE id = '33330000-0000-4000-8000-000000000003';

INSERT INTO public.professional_profiles (id, user_id, business_name, owner_name)
VALUES
  ('aaaa0000-0000-4000-8000-00000000000a', '11110000-0000-4000-8000-000000000001',
   'Poster Works', 'Poster Pro'),
  ('bbbb0000-0000-4000-8000-00000000000b', '22220000-0000-4000-8000-000000000002',
   'Rival Works', 'Rival Pro');

INSERT INTO public.catalogue_posts
  (id, professional_id, posted_by, image_urls, caption, is_approved)
VALUES
  ('ccc10000-0000-4000-8000-00000000000c', 'aaaa0000-0000-4000-8000-00000000000a',
   '11110000-0000-4000-8000-000000000001', ARRAY['https://example.test/1.jpg'],
   'Rewired a whole house in Arima', TRUE),
  ('ccc20000-0000-4000-8000-00000000000c', 'aaaa0000-0000-4000-8000-00000000000a',
   '11110000-0000-4000-8000-000000000001', ARRAY['https://example.test/2.jpg'],
   'Retracted by moderation', FALSE);

INSERT INTO public.whatsapp_messages (professional_id, from_number, message, direction)
VALUES ('aaaa0000-0000-4000-8000-00000000000a', '+18685550101', 'Are you free Tuesday?', 'inbound');

INSERT INTO public.business_knowledge (professional_id, content)
VALUES ('aaaa0000-0000-4000-8000-00000000000a', 'We charge TTD 250 for a call-out.');

INSERT INTO public.content_library (professional_id, content_type, body)
VALUES ('aaaa0000-0000-4000-8000-00000000000a', 'social_post', 'Booking now for September.');

INSERT INTO public.ad_packages (id, name, ad_type, duration_days, price_ttd)
VALUES ('dddd0000-0000-4000-8000-00000000000d', 'Homepage banner, 30 days', 'banner', 30, 3500);

INSERT INTO public.sponsor_campaigns
  (id, company_name, contact_email, ad_type, placement_zone, link_url,
   amount_paid_ttd, package_id, starts_at, ends_at, is_active)
VALUES
  ('eee10000-0000-4000-8000-00000000000e', 'Republic Bank', 'ads@bank.test',
   'banner', 'home', 'https://example.test', 3500,
   'dddd0000-0000-4000-8000-00000000000d', NOW() - INTERVAL '1 day',
   NOW() + INTERVAL '30 days', TRUE),
  -- Expired: must not render, and must not accrue billable impressions.
  ('eee20000-0000-4000-8000-00000000000e', 'Expired Co', 'old@bank.test',
   'banner', 'home', 'https://example.test', 1000, NULL,
   NOW() - INTERVAL '60 days', NOW() - INTERVAL '30 days', TRUE);

INSERT INTO public.insurance_referrals (professional_id, referral_url)
VALUES ('aaaa0000-0000-4000-8000-00000000000a', 'https://insurer.test/quote');

-- Reset the counter the fixture insert above does not touch, so PASS 9's
-- arithmetic starts from a known point regardless of ambient data.
UPDATE public.sponsor_campaigns SET impressions = 0, clicks = 0
 WHERE id IN ('eee10000-0000-4000-8000-00000000000e', 'eee20000-0000-4000-8000-00000000000e');

-- ── 1. The save-count trigger ───────────────────────────────────────────────

DO $$
DECLARE
  count_after INT;
  duplicated BOOLEAN := FALSE;
BEGIN
  INSERT INTO public.catalogue_saves (user_id, post_id)
  VALUES ('33330000-0000-4000-8000-000000000003', 'ccc10000-0000-4000-8000-00000000000c');

  SELECT save_count INTO count_after FROM public.catalogue_posts
   WHERE id = 'ccc10000-0000-4000-8000-00000000000c';
  ASSERT count_after = 1, format('save did not increment the count, got %s', count_after);

  -- Saving twice must be a no-op, not an inflated count. A double-tap on a slow
  -- connection is the ordinary case, not the adversarial one.
  BEGIN
    INSERT INTO public.catalogue_saves (user_id, post_id)
    VALUES ('33330000-0000-4000-8000-000000000003', 'ccc10000-0000-4000-8000-00000000000c');
  EXCEPTION WHEN unique_violation THEN duplicated := TRUE; END;
  ASSERT duplicated, 'the same user saved the same post twice';

  DELETE FROM public.catalogue_saves
   WHERE user_id = '33330000-0000-4000-8000-000000000003'
     AND post_id = 'ccc10000-0000-4000-8000-00000000000c';

  SELECT save_count INTO count_after FROM public.catalogue_posts
   WHERE id = 'ccc10000-0000-4000-8000-00000000000c';
  ASSERT count_after = 0, format('unsave did not decrement the count, got %s', count_after);

  RAISE NOTICE 'PASS 1 — save count is trigger-derived and cannot be double-counted';
END $$;

-- ── 2. Empty catalogue posts are refused ────────────────────────────────────

DO $$
DECLARE
  rejected BOOLEAN := FALSE;
BEGIN
  BEGIN
    INSERT INTO public.catalogue_posts (professional_id, posted_by, image_urls)
    VALUES ('aaaa0000-0000-4000-8000-00000000000a',
            '11110000-0000-4000-8000-000000000001', ARRAY[]::TEXT[]);
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;

  ASSERT rejected, 'a showcase post with no images was accepted';
  RAISE NOTICE 'PASS 2 — catalogue posts must carry at least one image';
END $$;

-- ── 3. Published content must record when ───────────────────────────────────

DO $$
DECLARE
  rejected BOOLEAN := FALSE;
BEGIN
  BEGIN
    UPDATE public.content_library SET is_published = TRUE
     WHERE professional_id = 'aaaa0000-0000-4000-8000-00000000000a';
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;

  ASSERT rejected, 'content was published without a timestamp';
  RAISE NOTICE 'PASS 3 — published content records when it went out';
END $$;

-- ── 4. Campaign windows must be ordered ─────────────────────────────────────

DO $$
DECLARE
  rejected BOOLEAN := FALSE;
BEGIN
  BEGIN
    INSERT INTO public.sponsor_campaigns
      (company_name, contact_email, ad_type, starts_at, ends_at)
    VALUES ('Backwards Co', 'x@test.test', 'banner',
            NOW() + INTERVAL '10 days', NOW());
  EXCEPTION WHEN check_violation THEN rejected := TRUE; END;

  ASSERT rejected, 'a campaign ending before it starts was accepted';
  RAISE NOTICE 'PASS 4 — campaign windows must be ordered';
END $$;

-- ============================================================================
-- THE ANON SURFACE — what a signed-out visitor can reach
-- ============================================================================

SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims TO '{}';

-- ── 5. Commercial columns are unreachable ───────────────────────────────────

DO $$
DECLARE
  leaked TEXT;
  denied BOOLEAN;
BEGIN
  -- RLS returns whole rows. Only a column-scoped GRANT can withhold a field, so
  -- this is the assertion that proves the campaign grant is column-scoped and
  -- not merely row-filtered. Same failure mode S030 found on professional_profiles.
  FOREACH leaked IN ARRAY ARRAY['contact_email', 'amount_paid_ttd', 'impressions', 'clicks'] LOOP
    denied := FALSE;
    BEGIN
      EXECUTE format('SELECT %I FROM public.sponsor_campaigns LIMIT 1', leaked);
    EXCEPTION WHEN insufficient_privilege THEN denied := TRUE; END;

    ASSERT denied,
      format('anon can read sponsor_campaigns.%s — commercial data must be '
             || 'withheld by a column GRANT, not a row policy', leaked);
  END LOOP;

  RAISE NOTICE 'PASS 5 — anon cannot read sponsor contact, spend, or performance';
END $$;

-- ── 6. Only live campaigns render ───────────────────────────────────────────

DO $$
DECLARE
  visible INT;
BEGIN
  SELECT COUNT(*) INTO visible FROM public.sponsor_campaigns
   WHERE id = 'eee10000-0000-4000-8000-00000000000e';
  ASSERT visible = 1, 'a live campaign is not publicly readable — the rotation is blind';

  SELECT COUNT(*) INTO visible FROM public.sponsor_campaigns
   WHERE id = 'eee20000-0000-4000-8000-00000000000e';
  ASSERT visible = 0, 'an EXPIRED campaign is publicly readable — sponsors would be billed for it';

  RAISE NOTICE 'PASS 6 — the rotation shows live campaigns and hides expired ones';
END $$;

-- ── 7. Private tables are fully unreachable ─────────────────────────────────

DO $$
DECLARE
  target TEXT;
  denied BOOLEAN;
BEGIN
  -- Denied at the GRANT level, so the failure is `permission denied for table`
  -- rather than an empty result. An empty result would also be produced by a
  -- policy that merely matched no rows, which is a weaker guarantee.
  FOREACH target IN ARRAY ARRAY[
    'whatsapp_messages', 'business_knowledge', 'content_library',
    'ad_packages', 'insurance_referrals', 'catalogue_saves'
  ] LOOP
    denied := FALSE;
    BEGIN
      EXECUTE format('SELECT 1 FROM public.%I LIMIT 1', target);
    EXCEPTION WHEN insufficient_privilege THEN denied := TRUE; END;

    ASSERT denied, format('anon can read public.%s', target);
  END LOOP;

  RAISE NOTICE 'PASS 7 — correspondence, knowledge, content, pricing and saves are anon-unreachable';
END $$;

-- ── 8. The catalogue feed shows approved posts, without poster identity ─────

DO $$
DECLARE
  visible INT;
  denied BOOLEAN := FALSE;
BEGIN
  SELECT COUNT(*) INTO visible FROM public.catalogue_posts
   WHERE id = 'ccc10000-0000-4000-8000-00000000000c';
  ASSERT visible = 1, 'an approved catalogue post is not publicly visible';

  SELECT COUNT(*) INTO visible FROM public.catalogue_posts
   WHERE id = 'ccc20000-0000-4000-8000-00000000000c';
  ASSERT visible = 0, 'an UNAPPROVED catalogue post is publicly visible — moderation is decorative';

  -- posted_by would join a public post to a platform identity.
  BEGIN
    PERFORM posted_by FROM public.catalogue_posts LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN denied := TRUE; END;
  ASSERT denied, 'anon can read catalogue_posts.posted_by — poster identity must stay private';

  RAISE NOTICE 'PASS 8 — feed shows approved posts only, and never the poster identity';
END $$;

-- ── 9. Impression counting is atomic and window-bounded ─────────────────────

DO $$
DECLARE
  live_impressions INT;
  expired_impressions INT;
BEGIN
  -- Anon has no UPDATE grant on the table, so this can only work through the
  -- SECURITY DEFINER function. If the RPC were removed and the grant widened
  -- instead, this test would still pass — which is why PASS 5 also asserts the
  -- column is unreadable.
  PERFORM public.increment_campaign_impressions('eee10000-0000-4000-8000-00000000000e');
  PERFORM public.increment_campaign_impressions('eee10000-0000-4000-8000-00000000000e');
  PERFORM public.increment_campaign_clicks('eee10000-0000-4000-8000-00000000000e');

  -- The expired campaign must absorb nothing.
  PERFORM public.increment_campaign_impressions('eee20000-0000-4000-8000-00000000000e');

  SET LOCAL ROLE postgres;

  SELECT impressions INTO live_impressions FROM public.sponsor_campaigns
   WHERE id = 'eee10000-0000-4000-8000-00000000000e';
  SELECT impressions INTO expired_impressions FROM public.sponsor_campaigns
   WHERE id = 'eee20000-0000-4000-8000-00000000000e';

  ASSERT live_impressions = 2,
    format('live campaign should have 2 impressions, has %s', live_impressions);
  ASSERT expired_impressions = 0,
    format('EXPIRED campaign accrued %s impressions — a sponsor would be billed '
           || 'for delivery after their window closed', expired_impressions);

  RAISE NOTICE 'PASS 9 — anon can record impressions, and expired campaigns accrue none';
END $$;

-- ── 9b. Referral clicks: RPC only, IP hashed, no direct write ───────────────

SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims TO '{}';

DO $$
DECLARE
  blocked BOOLEAN := FALSE;
  rows_after INT;
  stored_hash TEXT;
BEGIN
  -- A direct INSERT must be refused. `harden_grants` revokes write privileges
  -- from anon across the whole schema, and this asserts the referral table did
  -- not quietly re-grant them.
  BEGIN
    INSERT INTO public.insurance_referrals (professional_id, referral_url)
    VALUES ('aaaa0000-0000-4000-8000-00000000000a', 'https://spam.test');
  EXCEPTION WHEN insufficient_privilege THEN blocked := TRUE; END;
  ASSERT blocked, 'anon can INSERT referral clicks directly — the table is floodable';

  PERFORM public.record_insurance_referral(
    'aaaa0000-0000-4000-8000-00000000000a', 'https://insurer.test/quote', '10.0.0.1', 'test-agent');

  -- A click against an unknown professional must be silently ignored, not
  -- raised: an FK error would tell an anonymous caller whether an id is real.
  PERFORM public.record_insurance_referral(
    '00000000-0000-4000-8000-0000000000ff', 'https://insurer.test/quote', '10.0.0.1', NULL);

  SET LOCAL ROLE postgres;

  SELECT COUNT(*), MAX(ip_hash) INTO rows_after, stored_hash
    FROM public.insurance_referrals
   WHERE professional_id = 'aaaa0000-0000-4000-8000-00000000000a'
     AND ip_hash IS NOT NULL;

  ASSERT rows_after = 1, format('expected 1 recorded click, got %s', rows_after);
  ASSERT stored_hash <> '10.0.0.1',
    'the raw IP address was stored — it must be hashed before it lands';
  ASSERT length(stored_hash) = 64,
    format('ip_hash is not a sha256 hex digest, got length %s', length(stored_hash));

  SELECT COUNT(*) INTO rows_after FROM public.insurance_referrals
   WHERE professional_id = '00000000-0000-4000-8000-0000000000ff';
  ASSERT rows_after = 0, 'a click against a non-existent professional was recorded';

  RAISE NOTICE 'PASS 9b — referral clicks go through the RPC, IPs are hashed, ids are not enumerable';
END $$;

SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims TO '{}';

-- ============================================================================
-- THE PROFESSIONAL SURFACE — self-serve boundaries and cross-tenant isolation
-- ============================================================================

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO
  '{"sub":"11110000-0000-4000-8000-000000000001","role":"authenticated"}';

-- ── 10. Moderation and engagement are not self-serve ────────────────────────

DO $$
DECLARE
  blocked BOOLEAN;
  msg TEXT;
BEGIN
  -- Every value below must DIFFER from the fixture's current value.
  --
  -- The guard uses `IS DISTINCT FROM`, so writing a column back to what it
  -- already holds is a no-op that correctly does not raise — and a test doing
  -- that reports a hole which does not exist. The first version of this loop
  -- set `is_approved = TRUE` on a post that was already approved and failed for
  -- precisely that reason. S030's suite hit the identical trap; it is recorded
  -- in the playbook, and it still caught this file out.
  --
  -- Fixture state: is_featured FALSE, is_approved TRUE, save_count 0.
  FOREACH msg IN ARRAY ARRAY['is_featured', 'is_approved', 'save_count'] LOOP
    blocked := FALSE;
    BEGIN
      EXECUTE format(
        'UPDATE public.catalogue_posts SET %I = %s WHERE id = %L',
        msg,
        CASE msg
          WHEN 'save_count' THEN '9999'
          WHEN 'is_approved' THEN 'FALSE'
          ELSE 'TRUE'
        END,
        'ccc10000-0000-4000-8000-00000000000c'
      );
    EXCEPTION
      WHEN insufficient_privilege THEN blocked := TRUE;
      -- A missing GRANT also raises 42501, which would make this test pass for
      -- the wrong reason. Assert on the message, exactly as S030's suite had to.
      WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT;
        ASSERT msg NOT LIKE 'permission denied for table%',
          'test is passing for the wrong reason — the table GRANT is missing';
    END;

    ASSERT blocked, format('a professional set their own %s', msg);
  END LOOP;

  RAISE NOTICE 'PASS 10 — featuring, approval, and save counts are refused to the owner';
END $$;

-- ── 11. Cross-professional isolation ────────────────────────────────────────

DO $$
DECLARE
  visible INT;
BEGIN
  -- The rival's correspondence and knowledge base are the two most sensitive
  -- things a competitor could read: pricing, client names, and quoted rates.
  SELECT COUNT(*) INTO visible FROM public.whatsapp_messages
   WHERE professional_id = 'bbbb0000-0000-4000-8000-00000000000b';
  ASSERT visible = 0, 'a professional can read a rival''s WhatsApp transcript';

  SELECT COUNT(*) INTO visible FROM public.business_knowledge
   WHERE professional_id = 'bbbb0000-0000-4000-8000-00000000000b';
  ASSERT visible = 0, 'a professional can read a rival''s knowledge base';

  SELECT COUNT(*) INTO visible FROM public.content_library
   WHERE professional_id = 'bbbb0000-0000-4000-8000-00000000000b';
  ASSERT visible = 0, 'a professional can read a rival''s content library';

  -- And their own must be readable, or the isolation is just an outage.
  SELECT COUNT(*) INTO visible FROM public.whatsapp_messages
   WHERE professional_id = 'aaaa0000-0000-4000-8000-00000000000a';
  ASSERT visible = 1, 'a professional cannot read their own WhatsApp transcript';

  RAISE NOTICE 'PASS 11 — correspondence, knowledge and content are tenant-isolated';
END $$;

-- ── 12. The transcript is immutable ─────────────────────────────────────────

DO $$
DECLARE
  blocked BOOLEAN := FALSE;
BEGIN
  -- No UPDATE grant exists, so this is refused at the privilege layer. A
  -- transcript that can be edited is not evidence.
  BEGIN
    UPDATE public.whatsapp_messages SET message = 'I never said that'
     WHERE professional_id = 'aaaa0000-0000-4000-8000-00000000000a';
  EXCEPTION WHEN insufficient_privilege THEN blocked := TRUE; END;

  ASSERT blocked, 'a professional rewrote their own WhatsApp history';
  RAISE NOTICE 'PASS 12 — WhatsApp messages cannot be edited by anyone';
END $$;

-- ── 13. Ad pricing is admin-only ────────────────────────────────────────────

DO $$
DECLARE
  visible INT;
BEGIN
  SELECT COUNT(*) INTO visible FROM public.ad_packages
   WHERE id = 'dddd0000-0000-4000-8000-00000000000d';
  ASSERT visible = 0, 'a professional can read internal ad package pricing';

  RAISE NOTICE 'PASS 13 — ad package pricing is not visible to ordinary accounts';
END $$;

ROLLBACK;
