-- ============================================================================
-- The notification engine (playbook S042, spec details/backend-processes.md §4–§5)
--
-- One dispatcher, four channels (email, WhatsApp, push, webhook). Four tables:
--
--   notification_preferences  — what each person agreed to receive, per channel
--   notification_flags        — the kill switch, per event, without a deploy
--   notification_deliveries   — what was actually attempted, and what happened
--   scheduled_messages        — what is due to be sent later
--
-- The reason this is a table-driven engine rather than send() calls scattered
-- through the codebase: notifications are the platform's most reputation-
-- sensitive output. A bug that mails every customer twice at 3am cannot be
-- fixed by a deploy at 3am. `notification_flags` is how it gets stopped in
-- seconds, from a database row.
-- ============================================================================

-- ============================================================================
-- notification_flags — the kill switch
-- ============================================================================

CREATE TABLE public.notification_flags (
  event_type TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,

  -- Set when someone disables an event, so the next person knows whether this
  -- is a deliberate pause or a forgotten one.
  disabled_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT flag_disabled_has_reason CHECK (enabled OR disabled_reason IS NOT NULL)
);

COMMENT ON TABLE public.notification_flags IS
  'Per-event kill switch, checked before every dispatch. Stops a runaway send in seconds without a deploy.';

CREATE TRIGGER notification_flags_updated_at
  BEFORE UPDATE ON public.notification_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.notification_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_flags FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.notification_flags TO authenticated;

CREATE POLICY notification_flags_admin_all ON public.notification_flags
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- notification_preferences — per user, per event, per channel
-- ============================================================================
--
-- Absence means "use the default". Storing a row per user per event upfront
-- would mean a migration every time an event is added, and would make the
-- common case (everything default) the most expensive one.

CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL,
  channel notification_channel NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT notification_preference_unique UNIQUE (user_id, event_type, channel)
);

COMMENT ON TABLE public.notification_preferences IS
  'Opt-outs, not opt-ins. An absent row means the platform default applies.';

CREATE INDEX notification_preferences_user_idx ON public.notification_preferences (user_id);

CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;

CREATE POLICY notification_preferences_own ON public.notification_preferences
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY notification_preferences_admin_read ON public.notification_preferences
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- notification_deliveries — the delivery log
-- ============================================================================
--
-- Every attempt, per channel, with its outcome. Two jobs: the retry drain reads
-- failed rows, and support reads it to answer "did they actually get it?" —
-- a question that is otherwise unanswerable and comes up constantly.

CREATE TABLE public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nullable: some notifications go to an address with no account behind it
  -- (a quote sent to a customer who never signed up).
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  event_type TEXT NOT NULL,
  channel notification_channel NOT NULL,
  status notification_status NOT NULL DEFAULT 'queued',

  -- What it was about, for tracing without storing the payload.
  entity_type TEXT,
  entity_id UUID,

  -- Hashed, never plain. This table would otherwise become a queryable index of
  -- every email address and phone number on the platform — exactly the dataset
  -- a breach wants, held for a reason (retry) that does not need the value.
  recipient_hash TEXT,

  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_reason TEXT,

  -- Provider message id, for correlating a bounce webhook back to this row.
  provider_message_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT delivery_attempts_non_negative CHECK (attempts >= 0),
  CONSTRAINT delivery_delivered_has_timestamp CHECK (
    status <> 'delivered' OR delivered_at IS NOT NULL
  ),
  CONSTRAINT delivery_failed_has_reason CHECK (
    status <> 'failed' OR failed_reason IS NOT NULL
  )
);

COMMENT ON TABLE public.notification_deliveries IS
  'Per-channel delivery log. Recipients are hashed — retry does not need the address, and storing it would build the exact dataset a breach wants.';
COMMENT ON COLUMN public.notification_deliveries.recipient_hash IS
  'SHA-256 of the address. Never the address itself.';

CREATE INDEX notification_deliveries_user_idx ON public.notification_deliveries (user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX notification_deliveries_entity_idx
  ON public.notification_deliveries (entity_type, entity_id);
-- The retry drain's exact query: failed, under the attempt cap, and due.
CREATE INDEX notification_deliveries_retry_idx
  ON public.notification_deliveries (next_attempt_at)
  WHERE status = 'failed' AND attempts < 3;
CREATE INDEX notification_deliveries_provider_idx
  ON public.notification_deliveries (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE TRIGGER notification_deliveries_updated_at
  BEFORE UPDATE ON public.notification_deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.notification_deliveries TO authenticated;

-- A user may see what was sent TO them. Being able to check whether a reminder
-- was actually sent is the difference between trusting the platform and not.
CREATE POLICY notification_deliveries_select_own ON public.notification_deliveries
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY notification_deliveries_select_admin ON public.notification_deliveries
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- scheduled_messages — the lifecycle engine's state
-- ============================================================================
--
-- Nudges, expiry warnings, review prompts, crossover notices. Rows are written
-- when a trigger condition first occurs and swept every 15 minutes.
--
-- The critical behaviour is CANCELLATION. A scheduled "you haven't finished
-- onboarding" nudge must not send to someone who finished twenty minutes ago.
-- So the sweep RE-VALIDATES the condition at send time rather than trusting the
-- row, and completing the action cancels the row outright.

CREATE TABLE public.scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- What kind of nudge, e.g. 'onboarding_incomplete', 'insurance_expiring'.
  trigger_type TEXT NOT NULL,

  entity_type TEXT,
  entity_id UUID,

  due_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_reason TEXT,

  payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Terminal in one direction only: a message cannot be both sent and cancelled.
  CONSTRAINT scheduled_message_single_outcome CHECK (
    sent_at IS NULL OR cancelled_at IS NULL
  ),
  CONSTRAINT scheduled_message_cancel_has_reason CHECK (
    cancelled_at IS NULL OR cancelled_reason IS NOT NULL
  )
);

COMMENT ON TABLE public.scheduled_messages IS
  'Lifecycle nudges. The sweep re-validates the condition at send time — a row is an intention, not a promise.';

-- Deduplication: one live nudge of a kind per user per entity. Without this, a
-- trigger firing twice queues two identical nudges and the user gets nagged
-- twice for the same thing.
CREATE UNIQUE INDEX scheduled_messages_dedupe_idx
  ON public.scheduled_messages (user_id, trigger_type, COALESCE(entity_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE sent_at IS NULL AND cancelled_at IS NULL;

-- The sweep's exact query: due, not yet sent, not cancelled.
CREATE INDEX scheduled_messages_due_idx ON public.scheduled_messages (due_at)
  WHERE sent_at IS NULL AND cancelled_at IS NULL;
CREATE INDEX scheduled_messages_user_idx ON public.scheduled_messages (user_id);

ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_messages FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.scheduled_messages TO authenticated;

CREATE POLICY scheduled_messages_select_own ON public.scheduled_messages
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY scheduled_messages_select_admin ON public.scheduled_messages
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- device_push_tokens — mobile push targets
-- ============================================================================

CREATE TABLE public.device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,

  -- Which app the token belongs to. The two apps have separate deep-link
  -- schemes, so a payload built for one is not deliverable to the other.
  app TEXT NOT NULL,

  device_name TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Set when the provider reports the token dead. Kept rather than deleted so
  -- the same device re-registering is recognisable.
  revoked_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT push_platform_valid CHECK (platform IN ('ios', 'android', 'web')),
  CONSTRAINT push_app_valid CHECK (app IN ('customer', 'business'))
);

COMMENT ON TABLE public.device_push_tokens IS
  'Push targets per device per app. Revoked tokens are kept so a re-registering device is recognisable.';

CREATE INDEX device_push_tokens_user_idx ON public.device_push_tokens (user_id)
  WHERE revoked_at IS NULL;
CREATE INDEX device_push_tokens_stale_idx ON public.device_push_tokens (last_seen_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_push_tokens FORCE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_push_tokens TO authenticated;

CREATE POLICY device_push_tokens_own ON public.device_push_tokens
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
