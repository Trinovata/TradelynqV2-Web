-- ============================================================================
-- Scope `authenticated`'s SELECT on professional_profiles to the public
-- column allow-list (playbook S080 close-out — connection-gate bypass fix).
--
-- ## The vulnerability this closes
--
-- 20260719000005 fixed the anon leak with a column allow-list, but left
-- `authenticated` holding table-wide SELECT (line 318), with the comment
-- deferring contact-field redaction for OTHER professionals' rows to "the
-- API's job (S080)". Combined with `professional_profiles_select_public`
-- (`TO anon, authenticated USING listing_status = 'active'`), any signed-in
-- JWT — the anon key ships in every client bundle, and a session is free to
-- mint — could PostgREST-select `contact_phone`, `contact_whatsapp`, and
-- `home_address` on EVERY active listing, bypassing the connection gate
-- entirely. The same table-wide grant also exposed `national_id_url`,
-- `national_id_back_url`, `selfie_url`, `date_of_birth`,
-- `insurance_policy_number`, `insurance_cert_url`, `google_place_id`,
-- `onboarding_step`, `search_vector`, and the verification audit trail.
--
-- RLS filters ROWS, never COLUMNS. The regression suite tested anon only;
-- this migration makes both client roles hold the IDENTICAL column
-- allow-list, so redaction is DB-enforced rather than an API convention.
--
-- ## The knock-on: owner self-read
--
-- Column grants are role-wide — `professional_profiles_select_own` cannot
-- restore the withheld columns per-row. A professional's OWN contact columns
-- therefore become server-side reads via `createAdminClient()`
-- (lib/supabase/admin.ts, server-only), always AFTER the caller's own
-- auth/gate passes. There is no client-side self-read in V2 web today; if
-- one appears later (e.g. the RN apps, which use supabase-js directly),
-- add a self-scoped SECURITY DEFINER RPC rather than widening this grant.
--
-- INSERT/UPDATE grants are unchanged — the owner still writes the contact
-- columns; supabase-js `.update()` without `.select()` returns minimal
-- representation, and the WHERE columns (id, user_id) remain readable.
-- ============================================================================

REVOKE SELECT ON public.professional_profiles FROM authenticated;

-- The identical column allow-list anon holds (20260719000005 lines 264–302).
-- RLS still governs rows; the grant now governs columns for BOTH client roles.
GRANT SELECT (
  id,
  user_id,
  slug,
  business_name,
  owner_name,
  tagline,
  bio,
  category_id,
  secondary_category_ids,
  availability,
  business_type,
  employee_range,
  profile_photo_url,
  cover_photo_url,
  portfolio_urls,
  website_url,
  instagram_handle,
  services,
  business_hours,
  certifications,
  service_areas,
  business_address,
  latitude,
  longitude,
  verification_status,
  national_id_verified,
  has_insurance,
  insurance_type,
  insurance_provider,
  insurance_expires_at,
  listing_status,
  is_organisation,
  tenure_started,
  average_rating,
  review_count,
  created_at,
  updated_at
) ON public.professional_profiles TO authenticated;

-- Deliberately NOT granted to authenticated (same set withheld from anon):
--   contact_phone, contact_whatsapp, home_address  — the connection gate's
--     entire subject matter; post-gate reads happen server-side via the
--     admin client (lib/marketplace/queries.ts, /api/connections,
--     /api/enquiries/create)
--   national_id_url, national_id_back_url, selfie_url, date_of_birth  —
--     identity documents and PII
--   insurance_policy_number, insurance_cert_url
--   google_place_id, search_vector, onboarding_step
--   national_id_verified_at/_by, insurance_verified_at/_by  — moderation trail
