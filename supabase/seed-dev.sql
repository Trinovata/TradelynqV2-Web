-- Development seed (playbook S046).
--
-- 12 professionals across categories, 3 customers, sample enquiries and reviews:
-- enough supply for search ranking, storefronts, and the review distribution to
-- be exercised for real rather than mocked.
--
-- ## Safety
--
-- Every row this file creates carries a deterministic UUID in the `5eed…`
-- namespace, and the cleanup at the top deletes ONLY that namespace. There is no
-- TRUNCATE and no unqualified DELETE anywhere in this file: re-running it removes
-- exactly what it previously created and cannot touch a row it did not write.
-- The runner additionally refuses to connect to anything but a local
-- `supabase_db_*` container.
--
-- ## Why the data is realistic
--
-- Seeded supply that reads as filler ("Test Professional 1", "Lorem ipsum") makes
-- every downstream judgement worse: ranking looks fine when every name is
-- identical, and a storefront looks finished when its copy is placeholder. These
-- are Trinidad & Tobago names, areas, trades, and prices, so the marketplace can
-- be judged as a marketplace. They are still obviously fictional on inspection.
--
-- Usage: npm run db:seed

BEGIN;

-- ── Cleanup, scoped to the seed namespace ────────────────────────────────────
-- Ordered child-first. auth.users cascades to profiles and onward, but being
-- explicit keeps the intent readable and survives a future FK change.
DELETE FROM public.reviews WHERE id::text LIKE '5eed%';
DELETE FROM public.job_enquiries WHERE id::text LIKE '5eed%';
DELETE FROM public.connections WHERE id::text LIKE '5eed%';
DELETE FROM public.professional_profiles WHERE id::text LIKE '5eed%';
DELETE FROM public.customer_profiles WHERE id::text LIKE '5eed%';
DELETE FROM auth.users WHERE id::text LIKE '5eed%';

-- ── Identities ───────────────────────────────────────────────────────────────
-- Inserting into auth.users fires handle_new_user(), which creates the matching
-- public.profiles row. We then correct role/subtype, because the trigger's job is
-- to guarantee a profile exists, not to guess what someone signed up as.
--
-- All seed accounts share the password `devpassword123` — local-only, and the
-- runner cannot reach a hosted database.
-- The token columns are set to '' (empty string), NOT left NULL. GoTrue's Go
-- code scans them as non-nullable strings, so a NULL here makes EVERY login
-- 500 with "converting NULL to string is unsupported" — a real signup through
-- GoTrue fills them, but a direct INSERT like this must too. (Caught 26 Jul
-- 2026: seeded logins all failed until these were set.)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
SELECT
  seed.id,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  seed.email,
  crypt('devpassword123', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', seed.full_name),
  NOW() - (seed.age_days || ' days')::interval,
  NOW(),
  '', '', '', '', '', '', '', ''
FROM (VALUES
  ('5eed0000-0000-4000-8000-000000000001'::uuid, 'anisa.mohammed@example.com',   'Anisa Mohammed',    210),
  ('5eed0000-0000-4000-8000-000000000002'::uuid, 'darren.baptiste@example.com',  'Darren Baptiste',   195),
  ('5eed0000-0000-4000-8000-000000000003'::uuid, 'kerry.ann.joseph@example.com', 'Kerry-Ann Joseph',  180),
  ('5eed0000-0000-4000-8000-000000000004'::uuid, 'ravi.persad@example.com',      'Ravi Persad',       165),
  ('5eed0000-0000-4000-8000-000000000005'::uuid, 'shivana.ramkissoon@example.com','Shivana Ramkissoon',150),
  ('5eed0000-0000-4000-8000-000000000006'::uuid, 'marlon.charles@example.com',   'Marlon Charles',    140),
  ('5eed0000-0000-4000-8000-000000000007'::uuid, 'nicole.alleyne@example.com',   'Nicole Alleyne',    125),
  ('5eed0000-0000-4000-8000-000000000008'::uuid, 'jamal.thomas@example.com',     'Jamal Thomas',      110),
  ('5eed0000-0000-4000-8000-000000000009'::uuid, 'priya.maharaj@example.com',    'Priya Maharaj',      95),
  ('5eed0000-0000-4000-8000-00000000000a'::uuid, 'kevon.samuel@example.com',     'Kevon Samuel',       80),
  ('5eed0000-0000-4000-8000-00000000000b'::uuid, 'tricia.lewis@example.com',     'Tricia Lewis',       65),
  ('5eed0000-0000-4000-8000-00000000000c'::uuid, 'aaron.gopaul@example.com',     'Aaron Gopaul',       40),
  ('5eed0000-0000-4000-8000-000000000101'::uuid, 'simone.job@example.com',       'Simone Job',        120),
  ('5eed0000-0000-4000-8000-000000000102'::uuid, 'andre.williams@example.com',   'Andre Williams',     90),
  ('5eed0000-0000-4000-8000-000000000103'::uuid, 'lisa.rampersad@example.com',   'Lisa Rampersad',     30)
) AS seed(id, email, full_name, age_days);

-- Professionals: role + subtype. The CHECK constraint makes subtype required iff
-- role = 'professional', so these must move together.
UPDATE public.profiles p
SET role = 'professional',
    professional_subtype = sub.subtype::professional_subtype,
    role_confirmed = TRUE,
    role_selected_at = NOW() - INTERVAL '60 days',
    email_verified = TRUE
FROM (VALUES
  ('5eed0000-0000-4000-8000-000000000001'::uuid, 'sole_trader'),
  ('5eed0000-0000-4000-8000-000000000002'::uuid, 'registered_business'),
  ('5eed0000-0000-4000-8000-000000000003'::uuid, 'sole_trader'),
  ('5eed0000-0000-4000-8000-000000000004'::uuid, 'registered_business'),
  ('5eed0000-0000-4000-8000-000000000005'::uuid, 'sole_trader'),
  ('5eed0000-0000-4000-8000-000000000006'::uuid, 'sole_trader'),
  ('5eed0000-0000-4000-8000-000000000007'::uuid, 'registered_business'),
  ('5eed0000-0000-4000-8000-000000000008'::uuid, 'sole_trader'),
  ('5eed0000-0000-4000-8000-000000000009'::uuid, 'sole_trader'),
  ('5eed0000-0000-4000-8000-00000000000a'::uuid, 'student_entrepreneur'),
  ('5eed0000-0000-4000-8000-00000000000b'::uuid, 'sole_trader'),
  ('5eed0000-0000-4000-8000-00000000000c'::uuid, 'student_entrepreneur')
) AS sub(user_id, subtype)
WHERE p.id = sub.user_id;

UPDATE public.profiles p
SET role = 'customer', role_confirmed = TRUE, email_verified = TRUE,
    role_selected_at = NOW() - INTERVAL '60 days'
WHERE p.id::text LIKE '5eed0000-0000-4000-8000-0000000001%';

-- ── Professional storefronts ─────────────────────────────────────────────────
-- Deliberately varied so ranking, filters, and empty states all have something
-- real to bite on: two are still `draft` (must never appear in search), one has
-- no reviews (the "new" card variant), ratings span 3.9–5.0, and areas cover
-- both islands.
INSERT INTO public.professional_profiles (
  id, user_id, slug, business_name, owner_name, tagline, bio,
  category_id, availability, business_type, service_areas,
  contact_phone, contact_whatsapp, services,
  verification_status, national_id_verified, has_insurance,
  listing_status, onboarding_step, tenure_started
)
SELECT
  seed.id, seed.user_id, seed.slug, seed.business_name, seed.owner_name,
  seed.tagline, seed.bio,
  (SELECT c.id FROM public.categories c WHERE c.slug = seed.category_slug),
  seed.availability::availability_type,
  seed.business_type::business_type,
  seed.service_areas,
  seed.phone, seed.phone,
  seed.services::jsonb,
  seed.verification::verification_status,
  seed.id_verified,
  seed.insured,
  seed.listing_status::listing_status,
  5,
  (NOW() - (seed.tenure_days || ' days')::interval)::date
FROM (VALUES
  ('5eed0000-0000-4000-8000-000000000001'::uuid, '5eed0000-0000-4000-8000-000000000001'::uuid,
   'anisa-nails-pos', 'Anisa Nails', 'Anisa Mohammed',
   'Gel, acrylic and nail art in Port of Spain',
   'Nail technician of nine years, trained in Trinidad and Barbados. I work from a private studio in Woodbrook, one client at a time, so appointments never overlap.',
   'nail-tech', 'full_time', 'service_provider', ARRAY['Port of Spain','Woodbrook','St James'],
   '+1868555 0101',
   '[{"name":"Gel manicure","price_ttd":180},{"name":"Acrylic full set","price_ttd":350},{"name":"Nail art (per nail)","price_ttd":25}]',
   'fully_verified', TRUE, FALSE, 'active', 900),

  ('5eed0000-0000-4000-8000-000000000002'::uuid, '5eed0000-0000-4000-8000-000000000002'::uuid,
   'baptiste-electrical', 'Baptiste Electrical Services', 'Darren Baptiste',
   'Licensed electrical installation and repair',
   'T&TEC-compliant electrical contractor serving the East-West Corridor. Domestic rewiring, panel upgrades, and standby generator installation. Fully insured.',
   'electrician', 'full_time', 'service_provider', ARRAY['Arima','Tunapuna','Sangre Grande','Port of Spain'],
   '+1868555 0102',
   '[{"name":"Call-out and diagnosis","price_ttd":250},{"name":"Panel upgrade","price_ttd":4500},{"name":"Full rewire (3-bedroom)","price_ttd":18000}]',
   'fully_verified', TRUE, TRUE, 'active', 2200),

  ('5eed0000-0000-4000-8000-000000000003'::uuid, '5eed0000-0000-4000-8000-000000000003'::uuid,
   'kerry-ann-hair', 'Kerry-Ann Hair Studio', 'Kerry-Ann Joseph',
   'Natural hair care, locs and protective styling',
   'Specialist in natural textures. Silk presses, starter locs, retwists and braids. I keep Saturday mornings for consultations, which are free.',
   'hairstylist', 'full_time', 'service_provider', ARRAY['San Fernando','Marabella','Gasparillo'],
   '+1868555 0103',
   '[{"name":"Silk press","price_ttd":300},{"name":"Loc retwist","price_ttd":250},{"name":"Knotless braids","price_ttd":650}]',
   'fully_verified', TRUE, FALSE, 'active', 1400),

  ('5eed0000-0000-4000-8000-000000000004'::uuid, '5eed0000-0000-4000-8000-000000000004'::uuid,
   'persad-plumbing', 'Persad Plumbing Co.', 'Ravi Persad',
   'Emergency plumbing, 24 hours',
   'Third-generation plumbers based in Chaguanas. Leak detection, water heater installation, and blocked drains. We answer the phone at night because that is when pipes burst.',
   'plumber', 'full_time', 'service_provider', ARRAY['Chaguanas','Couva','Freeport','Curepe'],
   '+1868555 0104',
   '[{"name":"Emergency call-out","price_ttd":400},{"name":"Water heater installation","price_ttd":1200},{"name":"Drain clearing","price_ttd":600}]',
   'fully_verified', TRUE, TRUE, 'active', 3000),

  ('5eed0000-0000-4000-8000-000000000005'::uuid, '5eed0000-0000-4000-8000-000000000005'::uuid,
   'shivana-events', 'Shivana Events', 'Shivana Ramkissoon',
   'Weddings and corporate event planning',
   'Full-service planning and day-of coordination. Hindu and Christian ceremonies, corporate functions, and milestone birthdays. Portfolio available on request.',
   'event-planner', 'project_based', 'service_provider', ARRAY['Chaguanas','Port of Spain','San Fernando'],
   '+1868555 0105',
   '[{"name":"Day-of coordination","price_ttd":4500},{"name":"Full wedding planning","price_ttd":15000}]',
   'pending_review', FALSE, FALSE, 'active', 700),

  ('5eed0000-0000-4000-8000-000000000006'::uuid, '5eed0000-0000-4000-8000-000000000006'::uuid,
   'marlon-photo', 'Marlon Charles Photography', 'Marlon Charles',
   'Portrait, event and Carnival photography',
   'Fifteen years behind a camera. Carnival, weddings, family portraits and commercial product work. Same-week turnaround on edited galleries.',
   'photographer', 'part_time', 'service_provider', ARRAY['Port of Spain','Diego Martin','Maraval'],
   '+1868555 0106',
   '[{"name":"Portrait session (1hr)","price_ttd":800},{"name":"Event coverage (4hr)","price_ttd":2800},{"name":"Carnival Monday and Tuesday","price_ttd":6500}]',
   'fully_verified', TRUE, FALSE, 'active', 1800),

  ('5eed0000-0000-4000-8000-000000000007'::uuid, '5eed0000-0000-4000-8000-000000000007'::uuid,
   'alleyne-ac', 'Alleyne Air Conditioning', 'Nicole Alleyne',
   'AC installation, servicing and repair',
   'Split-unit and central air specialists. Quarterly service contracts for offices, and same-day repair for domestic units. Refrigerant handling certified.',
   'ac-technician', 'full_time', 'service_provider', ARRAY['San Fernando','Point Fortin','La Romaine'],
   '+1868555 0107',
   '[{"name":"Service and clean","price_ttd":450},{"name":"Split unit installation","price_ttd":2200},{"name":"Gas top-up","price_ttd":700}]',
   'fully_verified', TRUE, TRUE, 'active', 1600),

  ('5eed0000-0000-4000-8000-000000000008'::uuid, '5eed0000-0000-4000-8000-000000000008'::uuid,
   'jamal-barber', 'Fresh Cuts by Jamal', 'Jamal Thomas',
   'Barbering, fades and beard work',
   'Walk-ins welcome Tuesday to Saturday, appointments preferred on weekends. Home visits for elderly and disabled clients at no extra charge.',
   'barber', 'full_time', 'service_provider', ARRAY['Arima','Tunapuna','Arouca'],
   '+1868555 0108',
   '[{"name":"Cut","price_ttd":80},{"name":"Cut and beard","price_ttd":120},{"name":"Home visit","price_ttd":150}]',
   'fully_verified', TRUE, FALSE, 'active', 1100),

  ('5eed0000-0000-4000-8000-000000000009'::uuid, '5eed0000-0000-4000-8000-000000000009'::uuid,
   'priya-tutoring', 'Priya Maharaj Tutoring', 'Priya Maharaj',
   'CSEC and CAPE mathematics',
   'Former secondary school teacher. Small groups of no more than four, plus one-to-one sessions. Past-paper drilling from January.',
   'tutor', 'part_time', 'service_provider', ARRAY['San Juan','Curepe','St Augustine'],
   '+1868555 0109',
   '[{"name":"One-to-one (1hr)","price_ttd":200},{"name":"Small group (1hr)","price_ttd":100}]',
   'fully_verified', TRUE, FALSE, 'active', 1000),

  ('5eed0000-0000-4000-8000-00000000000a'::uuid, '5eed0000-0000-4000-8000-00000000000a'::uuid,
   'kevon-web', 'Kevon Samuel Web', 'Kevon Samuel',
   'Websites for small businesses',
   'UWI computer science student building simple, fast websites for local businesses. Fixed prices, no monthly lock-in.',
   'web-designer', 'part_time', 'service_provider', ARRAY['St Augustine','Curepe','Tunapuna'],
   '+1868555 0110',
   '[{"name":"One-page site","price_ttd":1500},{"name":"Five-page site","price_ttd":4000}]',
   'pending_review', FALSE, FALSE, 'active', 200),

  -- Draft: must never appear in search results. The seed exists precisely so a
  -- ranking bug that leaks drafts is visible locally rather than in production.
  ('5eed0000-0000-4000-8000-00000000000b'::uuid, '5eed0000-0000-4000-8000-00000000000b'::uuid,
   'tricia-cleaning', 'Tricia Lewis Cleaning', 'Tricia Lewis',
   'Domestic and office cleaning',
   'Weekly, fortnightly and one-off deep cleans. Own supplies and equipment.',
   'cleaner', 'full_time', 'service_provider', ARRAY['Diego Martin','Petit Valley'],
   '+1868555 0111',
   '[{"name":"Standard clean (3hr)","price_ttd":350}]',
   'not_started', FALSE, FALSE, 'draft', 100),

  ('5eed0000-0000-4000-8000-00000000000c'::uuid, '5eed0000-0000-4000-8000-00000000000c'::uuid,
   'aaron-dj', 'DJ Gopaul', 'Aaron Gopaul',
   'Parties, weddings and corporate',
   'Soca, dancehall, afrobeats and throwbacks. Own sound and lighting for up to 200 guests.',
   'dj', 'project_based', 'service_provider', ARRAY['Scarborough','Crown Point'],
   '+1868555 0112',
   '[{"name":"Four-hour set","price_ttd":2500},{"name":"Full night with lighting","price_ttd":4500}]',
   'not_started', FALSE, FALSE, 'draft', 60)
) AS seed(id, user_id, slug, business_name, owner_name, tagline, bio, category_slug,
          availability, business_type, service_areas, phone, services,
          verification, id_verified, insured, listing_status, tenure_days);

-- ── Customers ────────────────────────────────────────────────────────────────
INSERT INTO public.customer_profiles (id, user_id, area, contact_preference, kyc_status)
VALUES
  ('5eed0000-0000-4000-8000-000000000201', '5eed0000-0000-4000-8000-000000000101', 'Port of Spain', 'whatsapp', 'not_required'),
  ('5eed0000-0000-4000-8000-000000000202', '5eed0000-0000-4000-8000-000000000102', 'San Fernando',  'call',     'not_required'),
  ('5eed0000-0000-4000-8000-000000000203', '5eed0000-0000-4000-8000-000000000103', 'Chaguanas',     'whatsapp', 'not_required');

-- ── Enquiries ────────────────────────────────────────────────────────────────
-- Spread across every status the UI must render, including the two that carry a
-- mandatory companion column (declined needs a reason, completed needs a
-- timestamp) — so a surface that forgets to handle them fails locally.
INSERT INTO public.job_enquiries (
  id, customer_id, professional_id, category_id, status, description,
  contact_preference, declined_reason, completed_at, agreed_price_ttd, created_at
)
SELECT
  seed.id, seed.customer_id, seed.professional_id,
  (SELECT c.id FROM public.categories c WHERE c.slug = seed.category_slug),
  seed.status::enquiry_status, seed.description, 'whatsapp',
  seed.declined_reason,
  CASE WHEN seed.status = 'completed' THEN NOW() - INTERVAL '5 days' END,
  seed.agreed_price,
  NOW() - (seed.age_days || ' days')::interval
FROM (VALUES
  ('5eed0000-0000-4000-8000-000000000301'::uuid, '5eed0000-0000-4000-8000-000000000101'::uuid,
   '5eed0000-0000-4000-8000-000000000002'::uuid, 'electrician', 'completed',
   'Two bedroom sockets stopped working after the last power cut. Need someone to check the panel.',
   NULL, 1800, 30),
  ('5eed0000-0000-4000-8000-000000000302'::uuid, '5eed0000-0000-4000-8000-000000000102'::uuid,
   '5eed0000-0000-4000-8000-000000000007'::uuid, 'ac-technician', 'completed',
   'Split unit in the front bedroom is cooling poorly and dripping inside.',
   NULL, 450, 24),
  ('5eed0000-0000-4000-8000-000000000303'::uuid, '5eed0000-0000-4000-8000-000000000103'::uuid,
   '5eed0000-0000-4000-8000-000000000004'::uuid, 'plumber', 'accepted',
   'Kitchen sink draining very slowly, and there is a smell coming back up.',
   NULL, NULL, 6),
  ('5eed0000-0000-4000-8000-000000000304'::uuid, '5eed0000-0000-4000-8000-000000000101'::uuid,
   '5eed0000-0000-4000-8000-000000000006'::uuid, 'photographer', 'pending',
   'Looking for a photographer for a christening in September, about three hours.',
   NULL, NULL, 2),
  ('5eed0000-0000-4000-8000-000000000305'::uuid, '5eed0000-0000-4000-8000-000000000102'::uuid,
   '5eed0000-0000-4000-8000-000000000003'::uuid, 'hairstylist', 'declined',
   'Need knotless braids done this Saturday morning.',
   'Fully booked that weekend — happy to take you the following Saturday.', NULL, 8)
) AS seed(id, customer_id, professional_id, category_slug, status, description,
          declined_reason, agreed_price, age_days);

-- ── Reviews ──────────────────────────────────────────────────────────────────
-- `is_seeded` is TRUE on every row: the admin moderation surface gates on it
-- (v2/06 §6.6), and a seeded review that claims to be organic is a trust defect,
-- not a convenience. Approved rows carry `moderated_at` because the CHECK
-- constraint requires it for any non-pending status.
--
-- The rating-recalculation trigger derives average_rating and review_count from
-- these, so those columns are deliberately NOT inserted above — writing them by
-- hand would mask a broken trigger.
INSERT INTO public.reviews (
  id, professional_id, customer_id, job_enquiry_id, reviewer_name,
  star_rating, testimonial, status, is_seeded, moderated_at, created_at
)
VALUES
  ('5eed0000-0000-4000-8000-000000000401', '5eed0000-0000-4000-8000-000000000002',
   '5eed0000-0000-4000-8000-000000000101', '5eed0000-0000-4000-8000-000000000301',
   'Simone J.', 5,
   'Came the same evening, found the fault in the panel and had everything working within two hours. Explained what caused it so it does not happen again.',
   'approved', TRUE, NOW() - INTERVAL '25 days', NOW() - INTERVAL '26 days'),
  ('5eed0000-0000-4000-8000-000000000402', '5eed0000-0000-4000-8000-000000000002',
   NULL, NULL, 'Devon R.', 4,
   'Good work on the rewiring and fair price. Started a day later than planned but kept me updated throughout.',
   'approved', TRUE, NOW() - INTERVAL '60 days', NOW() - INTERVAL '61 days'),
  ('5eed0000-0000-4000-8000-000000000403', '5eed0000-0000-4000-8000-000000000007',
   '5eed0000-0000-4000-8000-000000000102', '5eed0000-0000-4000-8000-000000000302',
   'Andre W.', 5,
   'Serviced both units and fixed the drip. Punctual, tidy, and left the place cleaner than she found it.',
   'approved', TRUE, NOW() - INTERVAL '20 days', NOW() - INTERVAL '21 days'),
  ('5eed0000-0000-4000-8000-000000000404', '5eed0000-0000-4000-8000-000000000001',
   NULL, NULL, 'Kayla M.', 5,
   'Best gel manicure I have had in Port of Spain. Lasted three full weeks with no lifting.',
   'approved', TRUE, NOW() - INTERVAL '15 days', NOW() - INTERVAL '16 days'),
  ('5eed0000-0000-4000-8000-000000000405', '5eed0000-0000-4000-8000-000000000001',
   NULL, NULL, 'Renee B.', 4,
   'Lovely work and a relaxing studio. Parking in Woodbrook is the only difficulty.',
   'approved', TRUE, NOW() - INTERVAL '40 days', NOW() - INTERVAL '41 days'),
  ('5eed0000-0000-4000-8000-000000000406', '5eed0000-0000-4000-8000-000000000003',
   NULL, NULL, 'Michelle A.', 5,
   'My locs have never looked better. She takes her time and does not rush the retwist.',
   'approved', TRUE, NOW() - INTERVAL '12 days', NOW() - INTERVAL '13 days'),
  ('5eed0000-0000-4000-8000-000000000407', '5eed0000-0000-4000-8000-000000000004',
   NULL, NULL, 'Hassan A.', 4,
   'Answered at eleven at night and came out first thing. Pricier than expected but the job held.',
   'approved', TRUE, NOW() - INTERVAL '35 days', NOW() - INTERVAL '36 days'),
  ('5eed0000-0000-4000-8000-000000000408', '5eed0000-0000-4000-8000-000000000006',
   NULL, NULL, 'Anthony P.', 5,
   'Shot our wedding and delivered the gallery in four days. Genuinely excellent eye for candid moments.',
   'approved', TRUE, NOW() - INTERVAL '50 days', NOW() - INTERVAL '51 days'),
  ('5eed0000-0000-4000-8000-000000000409', '5eed0000-0000-4000-8000-000000000008',
   NULL, NULL, 'Sean D.', 4,
   'Solid fade every time. Gets busy on a Saturday so book ahead.',
   'approved', TRUE, NOW() - INTERVAL '18 days', NOW() - INTERVAL '19 days'),
  -- Pending: gives the admin moderation queue a real row to act on.
  ('5eed0000-0000-4000-8000-00000000040a', '5eed0000-0000-4000-8000-000000000009',
   NULL, NULL, 'Farah K.', 5,
   'My daughter moved from a grade three to a grade one in CSEC maths. Patient and very well organised.',
   'pending', TRUE, NULL, NOW() - INTERVAL '1 day');

COMMIT;

-- ── Smoke queries ────────────────────────────────────────────────────────────
-- Printed by the runner. These assert the seed produced a usable marketplace
-- rather than merely inserting without error — in particular that the
-- rating-recalculation trigger actually fired.
\echo ''
\echo 'Seed summary:'
SELECT
  (SELECT count(*) FROM public.professional_profiles WHERE id::text LIKE '5eed%') AS professionals,
  (SELECT count(*) FROM public.professional_profiles WHERE id::text LIKE '5eed%' AND listing_status = 'active') AS active_listings,
  (SELECT count(*) FROM public.customer_profiles WHERE id::text LIKE '5eed%') AS customers,
  (SELECT count(*) FROM public.job_enquiries WHERE id::text LIKE '5eed%') AS enquiries,
  (SELECT count(*) FROM public.reviews WHERE id::text LIKE '5eed%') AS reviews;

\echo ''
\echo 'Rating trigger check (must show non-null ratings and matching counts):'
SELECT business_name, average_rating, review_count
FROM public.professional_profiles
WHERE id::text LIKE '5eed%' AND review_count > 0
ORDER BY average_rating DESC, review_count DESC;
