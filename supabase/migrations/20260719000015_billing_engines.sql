-- ============================================================================
-- Billing engine state (playbook S041, spec details/backend-processes.md §1–§2)
--
-- Three tables that exist for one reason between them: **money operations must
-- be safe to run twice.** Crons overlap, webhooks redeliver, and a deploy can
-- restart a job mid-sweep. Every table here is an idempotency ledger — the
-- record that says "this already happened", so the second attempt is a no-op
-- rather than a second charge.
-- ============================================================================

-- ============================================================================
-- stripe_events — webhook idempotency
-- ============================================================================
--
-- Stripe redelivers on any non-2xx, and at-least-once delivery is the contract.
-- Without this ledger a redelivered `invoice.paid` grants a second month, and a
-- redelivered `customer.subscription.deleted` suspends an account that has since
-- recovered.
--
-- The consumer's first action is INSERT … ON CONFLICT DO NOTHING. Zero rows
-- affected means "already processed" and it returns 200 immediately, without
-- touching a single business table.

CREATE TABLE public.stripe_events (
  -- Stripe's own event id (evt_…). The natural key: using our own id here would
  -- defeat the entire mechanism.
  id TEXT PRIMARY KEY,

  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  -- Set when handling raised. The row still exists, so the event is not retried
  -- blindly; an operator decides whether to replay it.
  error TEXT,

  -- The Stripe object id the event concerned, for tracing a subscription's
  -- history without replaying the payload.
  related_object_id TEXT
);

COMMENT ON TABLE public.stripe_events IS
  'Webhook idempotency ledger. Stripe delivers at-least-once; this is what makes a redelivery a no-op.';
COMMENT ON COLUMN public.stripe_events.id IS
  'Stripe event id (evt_...). Natural key — our own id would defeat the mechanism.';

CREATE INDEX stripe_events_received_idx ON public.stripe_events (received_at DESC);
CREATE INDEX stripe_events_unprocessed_idx ON public.stripe_events (received_at)
  WHERE processed_at IS NULL;
CREATE INDEX stripe_events_related_idx ON public.stripe_events (related_object_id)
  WHERE related_object_id IS NOT NULL;

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events FORCE ROW LEVEL SECURITY;

-- No client grants at all. This table is written by the webhook consumer with
-- the service role and read by admin diagnostics through the same path. There
-- is no user-facing view of it, so there is no user-facing grant.
CREATE POLICY stripe_events_admin_read ON public.stripe_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

GRANT SELECT ON public.stripe_events TO authenticated;

-- ============================================================================
-- billing_ladder_log — grace-ladder idempotency
-- ============================================================================
--
-- When a payment fails the account walks a fixed ladder of notices and
-- restrictions over 14 days. The idempotency key is
-- (subscription, period, step) — NOT a timestamp — because that is what makes
-- an overlapping cron run harmless: the second run tries to insert a row that
-- already exists and is rejected by the unique index.
--
-- Recovery short-circuits the rest: once `invoice.paid` moves the subscription
-- out of past_due, remaining steps for that period are simply never executed.

CREATE TABLE public.billing_ladder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,

  -- The billing period this ladder walk belongs to, e.g. '2026-07'. Scopes the
  -- idempotency so a failure next month starts a fresh ladder.
  period_key TEXT NOT NULL,

  -- Which rung: 1 = first notice, 2 = reminder, 3 = restriction, 4 = suspension.
  step INTEGER NOT NULL,

  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outcome TEXT,

  CONSTRAINT billing_ladder_step_range CHECK (step BETWEEN 1 AND 6)
);

COMMENT ON TABLE public.billing_ladder_log IS
  'Grace-ladder idempotency. Key is (subscription, period, step) so overlapping crons cannot double-fire.';

-- THE idempotency guarantee. Without this index the whole table is just history.
CREATE UNIQUE INDEX billing_ladder_once_per_step_idx
  ON public.billing_ladder_log (subscription_id, period_key, step);

CREATE INDEX billing_ladder_subscription_idx ON public.billing_ladder_log (subscription_id);
CREATE INDEX billing_ladder_executed_idx ON public.billing_ladder_log (executed_at DESC);

ALTER TABLE public.billing_ladder_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_ladder_log FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.billing_ladder_log TO authenticated;

-- A professional may see their own billing history: being told why an account
-- was restricted is the difference between a support ticket and a payment.
CREATE POLICY billing_ladder_select_own ON public.billing_ladder_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.subscriptions s
        JOIN public.professional_profiles p ON p.id = s.professional_id
       WHERE s.id = billing_ladder_log.subscription_id
         AND p.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY billing_ladder_select_admin ON public.billing_ladder_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- pioneer_cohort_counters — the two caps, enforced under a row lock
-- ============================================================================
--
-- The Pioneer programme gives the first 180 professionals three months free,
-- capped at 3 per child category. The per-category cap is the load-bearing one:
-- 180 professionals in a single category is a directory with one useful page,
-- so the free months are spent buying BREADTH of supply.
--
-- One row per child category. Enrolment takes `SELECT … FOR UPDATE` on the
-- category's row and checks both caps inside that lock — the same reasoning as
-- credit deduction, and the same failure mode without it: two simultaneous
-- signups both read "2 of 3 used", both decide there is room, and the category
-- ends up with four.

CREATE TABLE public.pioneer_cohort_counters (
  category_id UUID PRIMARY KEY REFERENCES public.categories(id) ON DELETE CASCADE,
  enrolled_count INTEGER NOT NULL DEFAULT 0,
  cap INTEGER NOT NULL DEFAULT 3,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT pioneer_count_non_negative CHECK (enrolled_count >= 0),
  -- The count may never exceed the cap. Belt and braces alongside the row lock:
  -- if the locking logic is ever wrong, this turns a silent over-enrolment into
  -- a loud constraint violation.
  CONSTRAINT pioneer_count_within_cap CHECK (enrolled_count <= cap)
);

COMMENT ON TABLE public.pioneer_cohort_counters IS
  'Per-category Pioneer caps. Enrolment locks the row and checks both caps inside it.';
COMMENT ON CONSTRAINT pioneer_count_within_cap ON public.pioneer_cohort_counters IS
  'Turns a locking bug into a loud failure instead of a silently over-filled category.';

CREATE TRIGGER pioneer_counters_updated_at
  BEFORE UPDATE ON public.pioneer_cohort_counters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pioneer_cohort_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pioneer_cohort_counters FORCE ROW LEVEL SECURITY;

-- Publicly readable: the pricing page shows remaining Pioneer places, and
-- scarcity that cannot be seen does not convert.
GRANT SELECT ON public.pioneer_cohort_counters TO anon, authenticated;

CREATE POLICY pioneer_counters_select_public ON public.pioneer_cohort_counters
  FOR SELECT TO anon, authenticated
  USING (TRUE);

CREATE POLICY pioneer_counters_write_admin ON public.pioneer_cohort_counters
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Seed one row per CHILD category. Parents are not selectable, so they take no
-- enrolments and need no counter.
INSERT INTO public.pioneer_cohort_counters (category_id, cap)
SELECT id, 3 FROM public.categories WHERE parent_slug IS NOT NULL;

-- ── The enrolment check ─────────────────────────────────────────────────────
--
-- Returns whether a professional may enrol, taking the row lock so the answer
-- is still true when acted upon. Mirrors deduct_tool_credits: the DECISION is
-- serialised, not merely the arithmetic.

CREATE OR REPLACE FUNCTION public.claim_pioneer_place(
  p_category_id UUID,
  p_total_cap INTEGER DEFAULT 180
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  counter public.pioneer_cohort_counters%ROWTYPE;
  total_enrolled INTEGER;
BEGIN
  -- Lock this category's counter first. Everything below is decided under it.
  SELECT * INTO counter
    FROM public.pioneer_cohort_counters
   WHERE category_id = p_category_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'error', 'category_not_eligible');
  END IF;

  IF counter.enrolled_count >= counter.cap THEN
    RETURN jsonb_build_object(
      'ok', FALSE, 'error', 'category_full',
      'cap', counter.cap, 'enrolled', counter.enrolled_count
    );
  END IF;

  SELECT COALESCE(SUM(enrolled_count), 0) INTO total_enrolled
    FROM public.pioneer_cohort_counters;

  IF total_enrolled >= p_total_cap THEN
    RETURN jsonb_build_object(
      'ok', FALSE, 'error', 'cohort_full',
      'cap', p_total_cap, 'enrolled', total_enrolled
    );
  END IF;

  UPDATE public.pioneer_cohort_counters
     SET enrolled_count = enrolled_count + 1
   WHERE category_id = p_category_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'position', total_enrolled + 1,
    'category_remaining', counter.cap - counter.enrolled_count - 1
  );
END;
$$;

COMMENT ON FUNCTION public.claim_pioneer_place(UUID, INTEGER) IS
  'Claims a Pioneer place under a row lock. Checks BOTH caps inside the lock — without it two signups both see room and the category overfills.';

REVOKE EXECUTE ON FUNCTION public.claim_pioneer_place(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pioneer_place(UUID, INTEGER) TO service_role;

-- ============================================================================
-- cron_heartbeats — knowing a job stopped
-- ============================================================================
--
-- A cron that silently stops is worse than one that errors: nothing alerts, and
-- the failure is discovered by a customer who never got their reminder. V1 had
-- exactly this exposure — the crons were verified as firing only by reading
-- production logs by hand.
--
-- Every engine ends its run by upserting here. `/api/health` reports a job as
-- stale when `now - last_ok_at > 1.5 × its schedule`.

CREATE TABLE public.cron_heartbeats (
  job TEXT PRIMARY KEY,

  last_run_at TIMESTAMPTZ,
  -- Deliberately separate from last_run_at: a job that runs and fails every
  -- time would look healthy if only the attempt were recorded.
  last_ok_at TIMESTAMPTZ,
  last_duration_ms INTEGER,
  last_error TEXT,

  -- Expected cadence, so staleness is computed rather than hardcoded per job.
  schedule_seconds INTEGER NOT NULL DEFAULT 3600,

  consecutive_failures INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT heartbeat_failures_non_negative CHECK (consecutive_failures >= 0)
);

COMMENT ON TABLE public.cron_heartbeats IS
  'Liveness per scheduled job. last_ok_at is separate from last_run_at so a job that always fails cannot look healthy.';

ALTER TABLE public.cron_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_heartbeats FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.cron_heartbeats TO authenticated;

CREATE POLICY cron_heartbeats_admin_read ON public.cron_heartbeats
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- Seed the known jobs so a job that has NEVER run is visibly stale rather than
-- simply absent. An absent row reads as "no such job"; a row with a null
-- last_ok_at reads as "this job has never succeeded", which is the truth.
INSERT INTO public.cron_heartbeats (job, schedule_seconds) VALUES
  ('booking-reminders', 3600),
  ('invoice-reminders', 86400),
  ('job-completion', 3600),
  ('grace-ladder', 86400),
  ('pioneer-sweep', 86400),
  ('crossover-sweep', 86400),
  ('lifecycle-scheduler', 900),
  ('notification-drain', 300),
  ('reconciliation', 86400);

-- ============================================================================
-- reconciliation_findings — revenue truth is checked, not assumed
-- ============================================================================

CREATE TABLE public.reconciliation_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  found_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Which side disagreed, and about what.
  source TEXT NOT NULL,
  finding_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',

  external_reference TEXT,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,

  detail JSONB NOT NULL DEFAULT '{}'::jsonb,

  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,

  CONSTRAINT reconciliation_severity_valid CHECK (severity IN ('info', 'warning', 'critical')),
  -- Attribution is by timestamp only. `resolved_by` would be ON DELETE SET NULL,
  -- and requiring it would make a departing admin undeletable — the exact bug
  -- already fixed once on customer_profiles.
  CONSTRAINT reconciliation_resolution_has_note CHECK (
    resolved_at IS NULL OR resolution_note IS NOT NULL
  )
);

COMMENT ON TABLE public.reconciliation_findings IS
  'Nightly Stripe/WiPay vs payments comparison. A zero-findings night is the assertion that revenue is what we think it is.';

CREATE INDEX reconciliation_open_idx ON public.reconciliation_findings (found_at DESC)
  WHERE resolved_at IS NULL;
CREATE INDEX reconciliation_payment_idx ON public.reconciliation_findings (payment_id)
  WHERE payment_id IS NOT NULL;
CREATE INDEX reconciliation_subscription_idx ON public.reconciliation_findings (subscription_id)
  WHERE subscription_id IS NOT NULL;

ALTER TABLE public.reconciliation_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_findings FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.reconciliation_findings TO authenticated;

CREATE POLICY reconciliation_admin_read ON public.reconciliation_findings
  FOR SELECT TO authenticated
  USING (public.is_admin());
