-- ============================================================================
-- Core enum types (playbook S028)
--
-- Constrained values are enums, not free text: a typo becomes a write error
-- instead of a row nobody notices until a filter silently misses it.
--
-- ## What changed from V1, and why
--
-- 1. `trade_category` is GONE. It was deprecated in V1 in favour of the
--    `categories` FK, and this is a clean rebuild, so it is simply not created
--    rather than created-and-deprecated. Nothing can accidentally depend on it.
--
-- 2. `user_role` is `customer | professional | admin`, replacing V1's
--    `homeowner | worker | business | admin`.
--
--    Precedence note: details/analytics-events.md §1 specifies the envelope's
--    role as `customer|professional|admin|null`. Detail files outrank chapters,
--    and this is also what the product vocabulary requires — "homeowner"
--    misdescribes the majority of categories (beauty, creative, tech, events),
--    and V2 Phase 6 unifies worker and business into ONE professional surface.
--
--    The worker/business distinction does not disappear; it moves to
--    `professional_subtype`, which is first-class from day one rather than
--    backfilled. A registered business is a professional whose subtype says so.
--
-- 3. `subscription_tier` carries pricing v3.1's five tiers, replacing V1's
--    four-value `business_tier` (presence|growth|pro|managed). `studio` is new
--    and `managed` became `enterprise`.
--
-- 4. Vocabulary carried into value names where they were user-derived:
--    `worker_boost` → `professional_boost`, `business_owner` → `professional`,
--    catalogue poster `business` → `professional`, and the KYC enum is
--    `customer_kyc_status`.
-- ============================================================================

-- ── Identity ────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('customer', 'professional', 'admin');

-- Determines which professional profile table a user owns, which verification
-- track they follow, and which crossover billing path applies:
--   student_entrepreneur — manual-review-first, counsel-reviewed, reduced fee
--   sole_trader          — unregistered; tier for 6 paid months, then +TTD $150/mo
--   registered_business  — registered; tier + TTD $100/mo flat, forever
CREATE TYPE professional_subtype AS ENUM (
  'student_entrepreneur',
  'sole_trader',
  'registered_business'
);

CREATE TYPE account_status AS ENUM ('active', 'suspended', 'pending', 'deleted');

CREATE TYPE listing_status AS ENUM (
  'draft',
  'pending_review',
  'active',
  'suspended',
  'deleted'
);

-- How a professional presents: taking enquiries, publishing a catalogue, or both.
CREATE TYPE business_type AS ENUM ('service_provider', 'catalogue_business', 'hybrid');

-- ── Verification & trust ────────────────────────────────────────────────────

CREATE TYPE verification_status AS ENUM (
  'not_started',
  'pending_review',
  'id_verified',
  'fully_verified',
  'rejected'
);

-- Customers, not professionals. Gates the connection allowance: two free
-- contacts, then identity verification.
CREATE TYPE customer_kyc_status AS ENUM (
  'not_required',
  'pending',
  'submitted',
  'verified',
  'rejected'
);

-- ── Commerce ────────────────────────────────────────────────────────────────

-- Pricing v3.1. `lib/constants/pricing.ts` holds the money; this holds the shape.
CREATE TYPE subscription_tier AS ENUM (
  'presence',
  'growth',
  'studio',
  'pro',
  'enterprise'
);

CREATE TYPE subscription_status AS ENUM (
  'trialling',
  'active',
  'past_due',
  'cancelled',
  'paused'
);

CREATE TYPE billing_period AS ENUM ('monthly', 'quarterly', 'annual');

CREATE TYPE payment_status AS ENUM ('pending', 'successful', 'failed', 'refunded');

-- `stripe` and `wipay` are new: V1's enum predated both rails being live.
CREATE TYPE payment_method AS ENUM ('stripe', 'wipay', 'fac', 'credit', 'manual');

-- ── Marketplace ─────────────────────────────────────────────────────────────

CREATE TYPE enquiry_status AS ENUM (
  'pending',
  'accepted',
  'in_progress',
  'completed',
  'cancelled',
  'declined'
);

CREATE TYPE contact_preference AS ENUM ('whatsapp', 'call', 'email');

CREATE TYPE availability_type AS ENUM (
  'full_time',
  'part_time',
  'project_based',
  'by_appointment'
);

CREATE TYPE review_status AS ENUM ('pending', 'approved', 'featured', 'rejected');

-- ── Work & billing documents ────────────────────────────────────────────────

CREATE TYPE job_status AS ENUM (
  'enquiry',
  'accepted',
  'in_progress',
  'completed',
  'invoiced'
);

CREATE TYPE job_source AS ENUM (
  'platform',
  'whatsapp',
  'phone',
  'walk_in',
  'referral',
  'other'
);

CREATE TYPE job_log_event AS ENUM (
  'status_change',
  'note_added',
  'review_requested',
  'review_received',
  'invoice_created',
  'invoice_sent',
  'timer_started',
  'timer_expired',
  'customer_updated',
  'value_updated',
  'deleted',
  'restored'
);

-- `business_owner` in V1; the actor is a professional regardless of subtype.
CREATE TYPE job_log_actor AS ENUM ('professional', 'system', 'timer');

CREATE TYPE quote_status AS ENUM (
  'draft',
  'sent',
  'viewed',
  'accepted',
  'declined',
  'expired',
  'converted'
);

CREATE TYPE invoice_status AS ENUM (
  'draft',
  'sent',
  'viewed',
  'paid',
  'overdue',
  'cancelled'
);

CREATE TYPE invoice_frequency AS ENUM (
  'weekly',
  'fortnightly',
  'monthly',
  'quarterly',
  'annually'
);

-- ── Content & communications ────────────────────────────────────────────────

CREATE TYPE catalogue_poster_type AS ENUM ('professional', 'customer');

CREATE TYPE whatsapp_direction AS ENUM ('inbound', 'outbound');

CREATE TYPE content_type AS ENUM (
  'social_post',
  'caption',
  'bio',
  'service_description',
  'email',
  'ad_copy',
  'other'
);

CREATE TYPE ad_type AS ENUM ('banner', 'category_sponsor', 'professional_boost');

CREATE TYPE notification_channel AS ENUM ('email', 'whatsapp', 'push', 'webhook');

CREATE TYPE notification_status AS ENUM (
  'queued',
  'sent',
  'delivered',
  'failed',
  'suppressed'
);
