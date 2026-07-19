-- ============================================================================
-- subscription_plans, subscriptions, payments (playbook S037)
--
-- This is where the money lives, and money code has one governing rule here:
-- **a professional may not write their own billing state.** Every column that
-- decides what someone owes, whether they are paid up, or how long they have
-- been paying is written by the billing engine (service role) or an
-- administrator. The professional's own writes are confined to intent —
-- "I would like to cancel" — never to outcome.
--
-- ## Why the crossover columns are native
--
-- `paid_months`, `crossover_applied_at`, and `suspension_reason` are specified
-- in details/backend-processes.md §1.3 and §2 as NEW schema. They are created
-- here, in the same statement as the table, rather than added by a later
-- migration. The reason is not tidiness: `paid_months` is the input to a price
-- change (D49 — sole traders pay +TTD $150/mo after six PAID months). A column
-- added later starts at its default for every existing row, which would mean
-- every professional on the platform silently reverting to month zero on the
-- day the crossover engine ships. Counting from day one is the only way the
-- number is ever true.
--
-- ## What is deliberately NOT here
--
-- `stripe_events`, `billing_ladder_log`, and `pioneer_cohort_counters` are
-- playbook S041, not S037. This file provides the columns they key against
-- (`last_billing_period_key`, `billing_failure_count`, `pioneer`) so S041 is
-- additive.
-- ============================================================================

-- Why a listing went dark. `nonpayment` is the only reason reactivation may
-- auto-lift (backend-processes §1.3): a professional suspended for policy who
-- then pays an invoice must NOT reappear in search. Without this column the
-- reactivation path cannot tell the two apart and would resurface them.
CREATE TYPE suspension_reason AS ENUM ('nonpayment', 'policy', 'admin');

-- ============================================================================
-- subscription_plans — seeded from pricing v3.1
-- ============================================================================
--
-- `lib/constants/pricing.ts` is the single source of truth for money; this table
-- is its database mirror, and the commerce test suite asserts the two agree to
-- the dollar. The mirror exists because `subscriptions.plan_id` must reference
-- something, and because reporting queries need the price without a round trip
-- through application code.
--
-- One row per tier, keyed by the `subscription_tier` enum rather than V1's free
-- text `name`. V1 allowed 'standard' / 'priority' / 'sponsored' / 'organisation'
-- — names that had already stopped matching the tiers being sold.

CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- UNIQUE, not just NOT NULL: two rows claiming to be Growth is two prices for
  -- Growth, and nothing in the system could say which one is real.
  tier subscription_tier NOT NULL UNIQUE,

  name TEXT NOT NULL,
  summary TEXT NOT NULL,

  -- Whole TTD per month. INTEGER, not NUMERIC: every price in pricing v3.1 is a
  -- whole dollar, and integer money cannot accumulate a floating-point cent.
  monthly_price_ttd INTEGER NOT NULL,

  -- Enterprise is quoted from a floor (`isPriceFrom` in pricing.ts), so the
  -- pricing page renders "from TTD $3,500". Every other tier is exact.
  is_price_from BOOLEAN NOT NULL DEFAULT FALSE,

  -- ── Tier features, mirroring `TierFeatures` ───────────────────────────────
  -- Columns rather than a JSONB blob: `requireTierFeature()` gates on these and
  -- a typo in a JSONB key is a silent FALSE that opens a paid feature to
  -- everyone. A missing column is a query error.
  includes_crm BOOLEAN NOT NULL DEFAULT FALSE,
  includes_webhooks BOOLEAN NOT NULL DEFAULT FALSE,
  includes_n8n BOOLEAN NOT NULL DEFAULT FALSE,

  -- Monthly tool-credit allowance. NULL means UNLIMITED, which is how
  -- Enterprise's `Number.POSITIVE_INFINITY` from pricing.ts lands in SQL —
  -- there is no integer infinity, and a sentinel like -1 or 999999999 would be
  -- arithmetic waiting to be done by accident.
  monthly_tool_credits INTEGER,

  display_order INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT plan_price_non_negative CHECK (monthly_price_ttd >= 0),
  CONSTRAINT plan_credits_non_negative CHECK (
    monthly_tool_credits IS NULL OR monthly_tool_credits >= 0
  ),
  -- Unlimited credits are an Enterprise property. If any other tier ever gets a
  -- NULL here it is a data-entry slip that hands away every AI tool for free.
  CONSTRAINT plan_unlimited_credits_is_enterprise CHECK (
    monthly_tool_credits IS NOT NULL OR tier = 'enterprise'
  )
);

COMMENT ON TABLE public.subscription_plans IS
  'Database mirror of pricing v3.1 (lib/constants/pricing.ts). The commerce test suite asserts they agree to the dollar.';
COMMENT ON COLUMN public.subscription_plans.monthly_tool_credits IS
  'NULL means unlimited (Enterprise). No sentinel integer — a sentinel eventually gets added to something.';
COMMENT ON COLUMN public.subscription_plans.is_price_from IS
  'Enterprise is a floor, not a fixed price. Drives the "from" prefix on the pricing page.';

CREATE INDEX subscription_plans_order_idx ON public.subscription_plans (display_order)
  WHERE is_active;

CREATE TRIGGER subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans FORCE ROW LEVEL SECURITY;

-- anon reads: the pricing page is public and pre-auth.
GRANT SELECT ON public.subscription_plans TO anon, authenticated;
-- Admins edit prices. Without these grants the admin policies below are dead
-- code and the table becomes read-only to everyone including the owner.
GRANT INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;

CREATE POLICY subscription_plans_select_public ON public.subscription_plans
  FOR SELECT TO anon, authenticated
  USING (is_active);

CREATE POLICY subscription_plans_select_admin ON public.subscription_plans
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY subscription_plans_write_admin ON public.subscription_plans
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Seed: pricing v3.1, to the dollar ───────────────────────────────────────
-- presence 200 · growth 700 · studio 1300 · pro 2100 · enterprise 3500.
-- Summaries and credit allowances are copied verbatim from pricing.ts. If you
-- change one, change both — the test suite fails otherwise, which is the point.

INSERT INTO public.subscription_plans
  (tier, name, summary, monthly_price_ttd, is_price_from,
   includes_crm, includes_webhooks, includes_n8n, monthly_tool_credits, display_order)
VALUES
  ('presence', 'Presence',
   'A verified storefront customers can find and contact.',
   200, FALSE, FALSE, FALSE, FALSE, 0, 1),

  ('growth', 'Growth',
   'Quote, invoice, and keep the work moving.',
   700, FALSE, FALSE, FALSE, FALSE, 50, 2),

  ('studio', 'Studio',
   'Keep track of clients, not just jobs.',
   1300, FALSE, TRUE, FALSE, FALSE, 200, 3),

  ('pro', 'Pro',
   'The full workspace, with the assistant.',
   2100, FALSE, TRUE, FALSE, FALSE, 500, 4),

  -- NULL credits = unlimited. Enterprise is the only tier permitted that.
  ('enterprise', 'Enterprise',
   'Integrate TradeLynq with the systems you already run.',
   3500, TRUE, TRUE, TRUE, TRUE, NULL, 5);

-- ============================================================================
-- subscriptions
-- ============================================================================

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,

  -- RESTRICT, not CASCADE or SET NULL: deleting a plan someone is subscribed to
  -- would either delete their subscription (and the revenue record with it) or
  -- leave a subscription with no price. Retire a plan with is_active = FALSE.
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,

  status subscription_status NOT NULL DEFAULT 'trialling',
  billing_period billing_period NOT NULL DEFAULT 'monthly',
  payment_method payment_method,

  -- ── Period tracking ───────────────────────────────────────────────────────
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,

  -- The professional's REQUEST to cancel, which is the one billing-adjacent
  -- column they may write themselves. Actual cancellation (status, cancelled_at)
  -- happens at period end via the gateway. Separating intent from outcome is
  -- what lets this table have an UPDATE path at all.
  cancellation_requested_at TIMESTAMPTZ,

  -- ── Gateway references ────────────────────────────────────────────────────
  -- UNIQUE on the gateway subscription id: two local rows pointing at one
  -- Stripe subscription means every webhook updates an arbitrary one of them.
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  fac_card_token TEXT,

  -- ── Billing idempotency (backend-processes §1) ────────────────────────────
  -- `last_billing_period_key` is the "have we already billed this period"
  -- marker; the grace ladder anchors its day count on `last_billing_attempt_at`
  -- at `billing_failure_count = 1`.
  last_billing_period_key TEXT,
  billing_failure_count INTEGER NOT NULL DEFAULT 0,
  last_billing_attempt_at TIMESTAMPTZ,

  -- ── Pioneer programme (D28/D48) ───────────────────────────────────────────
  -- The category is stamped because the cap is per CHILD category (3), not just
  -- global (180) — 180 plumbers is a directory with one useful page.
  pioneer BOOLEAN NOT NULL DEFAULT FALSE,
  pioneer_category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,

  -- ── Crossover engine (D49) — native from day one ──────────────────────────
  -- Completed PAID months. Free Pioneer months never increment it: no invoice,
  -- no increment, which falls out automatically because the increment happens
  -- inside `invoice.paid` handling. This is the input to a price change, so a
  -- wrong value here overcharges or undercharges a real person.
  paid_months INTEGER NOT NULL DEFAULT 0,
  -- Stamped when the +TTD $150 sole-trader item is added. Its presence is what
  -- makes the engine idempotent — it never adds the item twice.
  crossover_applied_at TIMESTAMPTZ,

  -- Why the listing is dark, so reactivation knows what it may lift.
  suspension_reason suspension_reason,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT subscription_period_is_forward CHECK (current_period_end > current_period_start),
  CONSTRAINT subscription_failure_count_non_negative CHECK (billing_failure_count >= 0),
  CONSTRAINT subscription_paid_months_non_negative CHECK (paid_months >= 0),

  -- A cancelled subscription with no cancellation date cannot be reported on,
  -- and tenure analytics (`subscription_cancelled{tenure_days}`) reads it.
  CONSTRAINT subscription_cancelled_has_timestamp CHECK (
    status <> 'cancelled' OR cancelled_at IS NOT NULL
  ),
  -- A trial with no end date never ends.
  CONSTRAINT subscription_trial_has_end CHECK (
    status <> 'trialling' OR trial_ends_at IS NOT NULL
  ),
  -- The crossover rate applies after six PAID months (CROSSOVER.gracePaidMonths).
  -- Stamping it earlier would mean charging the +$150 before it is owed.
  CONSTRAINT subscription_crossover_after_grace CHECK (
    crossover_applied_at IS NULL OR paid_months >= 6
  ),
  -- Pioneer enrolment stamps the category the cap was counted against. Without
  -- it, the per-category cap cannot be audited after the fact.
  CONSTRAINT subscription_pioneer_names_category CHECK (
    NOT pioneer OR pioneer_category_id IS NOT NULL
  )
);

COMMENT ON TABLE public.subscriptions IS
  'One live subscription per professional. Every billing-state column is written by the billing engine or an admin, never by the subscriber.';
COMMENT ON COLUMN public.subscriptions.paid_months IS
  'Completed PAID months — the crossover clock (D49). Free Pioneer months never increment it. Created day one because a column added later starts every professional back at zero.';
COMMENT ON COLUMN public.subscriptions.crossover_applied_at IS
  'Set when the +TTD $150 sole-trader item is added. Its presence is the engine''s idempotency key.';
COMMENT ON COLUMN public.subscriptions.suspension_reason IS
  'Only ''nonpayment'' may be auto-lifted by reactivation. A policy-suspended professional who pays must not resurface in search.';
COMMENT ON COLUMN public.subscriptions.cancellation_requested_at IS
  'The subscriber''s intent. The outcome (status, cancelled_at) is billing''s — see guard_subscription_columns.';

-- ── The one-live-subscription rule ──────────────────────────────────────────
--
-- A partial unique index rather than an application check, because the failure
-- mode of getting this wrong is double-billing a real person. Two concurrent
-- checkout callbacks both seeing "no active subscription" is exactly the race a
-- unique index exists to lose safely.
--
-- 'paused' is included alongside active/trialling/past_due — V1's index covered
-- only the first three. A paused subscription still occupies the professional's
-- slot; letting a second one be created beside it means resuming produces two.
-- 'cancelled' is excluded so a professional may resubscribe after leaving, and
-- their cancelled history is kept.
CREATE UNIQUE INDEX subscriptions_one_live_per_professional_idx
  ON public.subscriptions (professional_id)
  WHERE status IN ('active', 'trialling', 'past_due', 'paused');

COMMENT ON INDEX public.subscriptions_one_live_per_professional_idx IS
  'At most one live subscription per professional. Includes ''paused'' — a paused subscription still occupies the slot.';

CREATE INDEX subscriptions_professional_idx ON public.subscriptions (professional_id);
CREATE INDEX subscriptions_plan_idx ON public.subscriptions (plan_id);
CREATE INDEX subscriptions_pioneer_category_idx ON public.subscriptions (pioneer_category_id)
  WHERE pioneer_category_id IS NOT NULL;
-- The grace-ladder sweep reads exactly this set, daily.
CREATE INDEX subscriptions_past_due_idx
  ON public.subscriptions (last_billing_attempt_at)
  WHERE status = 'past_due';
-- The Pioneer trial sweep reads trials by expiry.
CREATE INDEX subscriptions_trial_expiry_idx ON public.subscriptions (trial_ends_at)
  WHERE status = 'trialling';
-- The crossover engine sweeps sole traders approaching month 6. Partial on
-- "not yet crossed over" keeps it small for ever.
CREATE INDEX subscriptions_crossover_pending_idx ON public.subscriptions (paid_months)
  WHERE crossover_applied_at IS NULL;

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;

-- No anon: what someone pays is nobody else's business.
-- No INSERT for authenticated: subscriptions are created by the checkout
-- callback holding the service key, after money has actually moved. A
-- self-inserted 'active' Enterprise row would be a free upgrade.
-- No DELETE: a subscription is cancelled, never erased — it is a revenue record.
GRANT SELECT, UPDATE ON public.subscriptions TO authenticated;

CREATE POLICY subscriptions_select_own ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.owns_professional_profile(professional_id));

CREATE POLICY subscriptions_select_admin ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Deliberately generous at the row level and near-total at the column level:
-- the guard below is the real boundary. The only thing this policy usefully
-- permits a professional is requesting cancellation.
CREATE POLICY subscriptions_update_own ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (public.owns_professional_profile(professional_id))
  WITH CHECK (public.owns_professional_profile(professional_id));

CREATE POLICY subscriptions_update_admin ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Column guard ────────────────────────────────────────────────────────────
--
-- The single most valuable guard in the schema. Without it, a professional with
-- a Presence subscription issues one PATCH and holds Enterprise: unlimited AI
-- credits, webhooks, CRM, white-label documents, for TTD $200. RLS cannot
-- express "you may see this row and change one column of it".
--
-- Note `plan_id` is the tier. There is no separate `subscriptions.tier` column
-- — the plan row carries the tier, and duplicating it here would create two
-- answers to "what am I paying for" that could disagree. Blocking plan_id is
-- blocking the tier.

CREATE OR REPLACE FUNCTION public.guard_subscription_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- auth.uid() IS NULL is the service role — the billing engine, which is the
  -- only thing that SHOULD be writing these columns.
  IF (SELECT auth.uid()) IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Foreign-key SET NULL (pioneer_category_id when a category is removed) and
  -- any future platform trigger arrive at depth > 1. Client statements are
  -- depth 1 and stay guarded. `authenticated` cannot forge this: it holds no
  -- TRIGGER privilege (20260719999999) and so cannot reach trigger depth.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Tier. The whole subscription business in one column.
  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id THEN
    RAISE EXCEPTION 'Your tier changes through billing, not directly. Use the upgrade flow.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Status. 'active' is the difference between a live listing and a dark one.
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
     OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason THEN
    RAISE EXCEPTION 'Subscription status is set by billing. Request cancellation instead.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- The crossover clock. `paid_months` decides whether someone owes +TTD $150 a
  -- month; a subscriber who could reset it to 0 would never cross over.
  IF NEW.paid_months IS DISTINCT FROM OLD.paid_months
     OR NEW.crossover_applied_at IS DISTINCT FROM OLD.crossover_applied_at THEN
    RAISE EXCEPTION 'The crossover clock is maintained by billing.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Period and trial windows. Extending `current_period_end` is free service;
  -- extending `trial_ends_at` is a free account.
  IF NEW.current_period_start IS DISTINCT FROM OLD.current_period_start
     OR NEW.current_period_end IS DISTINCT FROM OLD.current_period_end
     OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
     OR NEW.billing_period IS DISTINCT FROM OLD.billing_period THEN
    RAISE EXCEPTION 'Billing periods are set by billing.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Billing idempotency and the grace ladder's anchor. Clearing
  -- `billing_failure_count` would step out of the ladder mid-suspension.
  IF NEW.last_billing_period_key IS DISTINCT FROM OLD.last_billing_period_key
     OR NEW.billing_failure_count IS DISTINCT FROM OLD.billing_failure_count
     OR NEW.last_billing_attempt_at IS DISTINCT FROM OLD.last_billing_attempt_at THEN
    RAISE EXCEPTION 'Billing attempt state is maintained by the billing engine.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Pioneer enrolment is capped (180 total, 3 per child category) and checked
  -- under a row lock server-side. Self-enrolment would bypass both caps.
  IF NEW.pioneer IS DISTINCT FROM OLD.pioneer
     OR NEW.pioneer_category_id IS DISTINCT FROM OLD.pioneer_category_id THEN
    RAISE EXCEPTION 'Pioneer enrolment is granted at checkout, subject to the programme caps.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Gateway identifiers. Re-pointing at another customer's Stripe subscription
  -- is someone else paying your bill.
  IF NEW.professional_id IS DISTINCT FROM OLD.professional_id
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.fac_card_token IS DISTINCT FROM OLD.fac_card_token
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN
    RAISE EXCEPTION 'Payment instrument details are managed through the billing portal.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER subscriptions_guard_columns
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.guard_subscription_columns();

COMMENT ON FUNCTION public.guard_subscription_columns() IS
  'Leaves a subscriber exactly one writable column: cancellation_requested_at. Tier, status, the crossover clock, periods, ladder state, Pioneer flags, and gateway ids are billing''s.';

-- ============================================================================
-- payments
-- ============================================================================
--
-- The revenue record. Append-mostly: rows are written by the payment rails and
-- read by the professional, the admin console, and the nightly reconciliation
-- cron. Nothing a client can reach may write here at all — a self-inserted
-- 'successful' payment is a forged receipt.

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- SET NULL, not CASCADE: a payment that actually happened must survive the
  -- subscription it paid for. Reconciliation reads these rows against the
  -- gateway long after a subscription is gone.
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,

  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,

  -- What the money was for. Registration fee, tier subscription, the crossover
  -- account surcharge, and credit bundles all land in this one table so that
  -- "what has this professional paid us" is one query rather than four.
  kind TEXT NOT NULL DEFAULT 'subscription',

  -- Whole TTD. Integer money, per the global convention in backend-processes:
  -- "money amounts are integer TTD".
  amount_ttd INTEGER NOT NULL,
  amount_refunded_ttd INTEGER NOT NULL DEFAULT 0,

  payment_method payment_method NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',

  -- The gateway's own reference (Stripe charge/invoice id, WiPay order id).
  transaction_reference TEXT,

  -- Idempotency. The Stripe consumer keys on the event id; a UNIQUE index means
  -- a replayed webhook cannot write a second payment row even if the ledger
  -- check in S041 is bypassed or races. Belt and braces, because the failure
  -- mode is charging someone twice in the books.
  provider_event_id TEXT UNIQUE,

  -- Which billing period this settles. Paired with subscription_id below as the
  -- second idempotency key: one successful payment per subscription per period.
  billing_period_key TEXT,

  invoice_number TEXT UNIQUE,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT payment_kind_known CHECK (
    kind IN ('subscription', 'registration_fee', 'account_surcharge',
             'credit_bundle', 'store_order', 'other')
  ),
  CONSTRAINT payment_amount_non_negative CHECK (amount_ttd >= 0),
  -- Refunding more than was paid is arithmetic nobody meant to do.
  CONSTRAINT payment_refund_within_amount CHECK (
    amount_refunded_ttd >= 0 AND amount_refunded_ttd <= amount_ttd
  ),
  -- A successful payment with no timestamp cannot be reconciled against a
  -- gateway statement, which is the entire job of the nightly cron.
  CONSTRAINT payment_successful_has_timestamp CHECK (
    status <> 'successful' OR paid_at IS NOT NULL
  ),
  CONSTRAINT payment_refunded_has_timestamp CHECK (
    status <> 'refunded' OR refunded_at IS NOT NULL
  )
);

COMMENT ON TABLE public.payments IS
  'Every TTD that has moved: subscriptions, registration fees, crossover surcharges, credit bundles. Written only by the payment rails; no client role can write here.';
COMMENT ON COLUMN public.payments.provider_event_id IS
  'Gateway event id, UNIQUE. A replayed webhook cannot produce a second payment row.';
COMMENT ON COLUMN public.payments.amount_ttd IS
  'Whole TTD. Integer money — no float ever touches a balance on this platform.';

-- One SUCCESSFUL payment per subscription per billing period. Partial on
-- status so a failed attempt followed by a successful retry for the same period
-- is fine — which is the normal recovery path, not an error.
CREATE UNIQUE INDEX payments_one_success_per_period_idx
  ON public.payments (subscription_id, billing_period_key)
  WHERE status = 'successful' AND subscription_id IS NOT NULL
    AND billing_period_key IS NOT NULL;

CREATE INDEX payments_subscription_idx ON public.payments (subscription_id);
CREATE INDEX payments_professional_idx ON public.payments (professional_id);
-- The professional's billing history, and the admin revenue view.
CREATE INDEX payments_professional_recent_idx
  ON public.payments (professional_id, created_at DESC);
-- The reconciliation cron reads the last 48h of settled money.
CREATE INDEX payments_settled_idx ON public.payments (paid_at DESC)
  WHERE status = 'successful';

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;

-- SELECT only, and only for authenticated. There is no INSERT, UPDATE, or
-- DELETE grant for any client role: every write comes from a payment rail
-- holding the service key. This is stronger than a guard trigger — the
-- statement is refused before a row is ever considered.
GRANT SELECT ON public.payments TO authenticated;

CREATE POLICY payments_select_own ON public.payments
  FOR SELECT TO authenticated
  USING (public.owns_professional_profile(professional_id));

CREATE POLICY payments_select_admin ON public.payments
  FOR SELECT TO authenticated
  USING (public.is_admin());
