-- ============================================================================
-- bookings, availability, blocked dates (playbook S034)
--
-- A booking is a confirmed appointment. It is the only place on the platform
-- where the product makes a promise about a specific hour, which is why the
-- reminder flags below are a column and not a queue: the cron must be able to
-- ask "which appointments still owe a reminder" with one indexed read, and must
-- never send the same reminder twice.
--
-- V1 keyed all three tables to `worker_profiles`. Here they key to
-- `professional_profiles`, so a registered business gets a booking calendar
-- without the parallel `/api/business/availability` route V1 needed.
-- ============================================================================

CREATE TYPE booking_status AS ENUM ('confirmed', 'completed', 'cancelled', 'no_show');

COMMENT ON TYPE booking_status IS
  'no_show is deliberately distinct from cancelled: one is a broken promise, the other is notice given. They must not aggregate together in reliability metrics.';

-- ============================================================================
-- booking_availability — the recurring weekly grid
-- ============================================================================

CREATE TABLE public.booking_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,

  -- 0 = Sunday, matching JavaScript's Date.getDay(). Every client that renders
  -- this grid is JS; converting at the boundary is a bug waiting for a Sunday.
  weekday SMALLINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,

  slot_duration_min INTEGER NOT NULL DEFAULT 60,
  max_bookings INTEGER NOT NULL DEFAULT 3,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One window per weekday. A split day ("mornings and evenings") is a real
  -- shape this cannot express; deliberately deferred rather than half-built,
  -- because two windows per day changes the slot generator, not just the table.
  CONSTRAINT booking_availability_one_window_per_day UNIQUE (professional_id, weekday),

  CONSTRAINT booking_availability_weekday_range CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT booking_availability_window_ordered CHECK (end_time > start_time),
  CONSTRAINT booking_availability_slot_positive CHECK (slot_duration_min > 0),
  CONSTRAINT booking_availability_max_bookings_positive CHECK (max_bookings > 0)
);

COMMENT ON TABLE public.booking_availability IS
  'Recurring weekly availability windows. One window per weekday; split days are a deliberate deferral, not an oversight.';
COMMENT ON COLUMN public.booking_availability.weekday IS
  '0 = Sunday, matching JavaScript Date.getDay(). Every consumer is JS.';

CREATE INDEX booking_availability_professional_idx
  ON public.booking_availability (professional_id);
-- The slot generator reads only live windows.
CREATE INDEX booking_availability_active_idx
  ON public.booking_availability (professional_id, weekday)
  WHERE is_active;

CREATE TRIGGER booking_availability_updated_at
  BEFORE UPDATE ON public.booking_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.booking_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_availability FORCE ROW LEVEL SECURITY;

-- anon reads: the public storefront's booking entry renders the slot grid
-- before sign-in. Nothing here is sensitive — it is opening hours.
GRANT SELECT ON public.booking_availability TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.booking_availability TO authenticated;

CREATE POLICY booking_availability_select_public ON public.booking_availability
  FOR SELECT TO anon, authenticated
  USING (
    is_active
    AND EXISTS (
      SELECT 1 FROM public.professional_profiles p
      WHERE p.id = booking_availability.professional_id
        AND p.listing_status = 'active'
    )
  );

CREATE POLICY booking_availability_select_own ON public.booking_availability
  FOR SELECT TO authenticated
  USING (public.owns_professional_profile(professional_id));

CREATE POLICY booking_availability_manage_own ON public.booking_availability
  FOR ALL TO authenticated
  USING (public.owns_professional_profile(professional_id))
  WITH CHECK (public.owns_professional_profile(professional_id));

CREATE POLICY booking_availability_admin ON public.booking_availability
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- booking_blocked_dates — exceptions to the grid
-- ============================================================================

CREATE TABLE public.booking_blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,

  blocked_date DATE NOT NULL,
  -- Shown only to the professional. Public callers see the date as unavailable
  -- and are told nothing about why — "at a funeral" is not storefront copy.
  reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT booking_blocked_dates_unique UNIQUE (professional_id, blocked_date)
);

COMMENT ON TABLE public.booking_blocked_dates IS
  'Date-level overrides on the weekly grid. `reason` is private to the professional — public callers see only that the date is unavailable.';
COMMENT ON COLUMN public.booking_blocked_dates.reason IS
  'PRIVATE. Public slot queries must select an explicit column list that omits it — RLS cannot filter columns.';

CREATE INDEX booking_blocked_dates_professional_idx
  ON public.booking_blocked_dates (professional_id, blocked_date);

ALTER TABLE public.booking_blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_blocked_dates FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.booking_blocked_dates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.booking_blocked_dates TO authenticated;

-- Public sees the row (so a date can be greyed out) but must not be shown
-- `reason`. Same column-redaction contract as professional_profiles contact
-- fields: the API selects (professional_id, blocked_date) and nothing else.
CREATE POLICY booking_blocked_dates_select_public ON public.booking_blocked_dates
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.professional_profiles p
      WHERE p.id = booking_blocked_dates.professional_id
        AND p.listing_status = 'active'
    )
  );

CREATE POLICY booking_blocked_dates_select_own ON public.booking_blocked_dates
  FOR SELECT TO authenticated
  USING (public.owns_professional_profile(professional_id));

CREATE POLICY booking_blocked_dates_manage_own ON public.booking_blocked_dates
  FOR ALL TO authenticated
  USING (public.owns_professional_profile(professional_id))
  WITH CHECK (public.owns_professional_profile(professional_id));

CREATE POLICY booking_blocked_dates_admin ON public.booking_blocked_dates
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- bookings
-- ============================================================================

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nullable: a professional may book a walk-in client directly, with no
  -- enquiry behind it. SET NULL rather than CASCADE — losing the enquiry must
  -- not silently delete a confirmed appointment out of someone's calendar.
  enquiry_id UUID REFERENCES public.job_enquiries(id) ON DELETE SET NULL,

  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,

  status booking_status NOT NULL DEFAULT 'confirmed',
  notes TEXT,

  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,

  -- ── Reminder flags — READ BY THE CRON ─────────────────────────────────────
  -- The scheduler's idempotency key. It selects confirmed bookings inside the
  -- window whose flag is false, sends, then sets the flag in the same
  -- transaction. Anything that changes when the appointment is must reset these
  -- (see the reschedule trigger) or the customer gets a reminder for a time
  -- that no longer exists — or, worse, none at all.
  reminder_24h_sent BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_1h_sent BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT booking_duration_positive CHECK (duration_minutes > 0),
  CONSTRAINT booking_duration_sane CHECK (duration_minutes <= 1440),
  -- A cancelled booking with no timestamp cannot be reasoned about in a dispute
  -- ("they cancelled an hour before") and cannot be excluded from metrics by date.
  CONSTRAINT booking_cancelled_has_timestamp CHECK (
    status <> 'cancelled' OR cancelled_at IS NOT NULL
  )
);

COMMENT ON TABLE public.bookings IS
  'Confirmed appointments. enquiry_id is nullable — walk-in and phone bookings have no enquiry behind them.';
COMMENT ON COLUMN public.bookings.reminder_24h_sent IS
  'Cron idempotency flag. Reset by the reschedule trigger whenever scheduled_at moves.';

CREATE INDEX bookings_professional_idx ON public.bookings (professional_id);
CREATE INDEX bookings_customer_idx ON public.bookings (customer_id);
CREATE INDEX bookings_enquiry_idx ON public.bookings (enquiry_id);
-- The calendar view: one professional, ordered by time.
CREATE INDEX bookings_professional_schedule_idx
  ON public.bookings (professional_id, scheduled_at);

-- The two cron reads, each a partial index over exactly the rows the scheduler
-- looks at. A full index on scheduled_at would make the cron scan every past
-- appointment for ever; these shrink to zero as reminders go out.
CREATE INDEX bookings_reminder_24h_due_idx ON public.bookings (scheduled_at)
  WHERE status = 'confirmed' AND NOT reminder_24h_sent;
CREATE INDEX bookings_reminder_1h_due_idx ON public.bookings (scheduled_at)
  WHERE status = 'confirmed' AND NOT reminder_1h_sent;

-- ── Reschedule resets the reminders ─────────────────────────────────────────
-- Named to sort AFTER bookings_guard_columns so the guard compares the flags a
-- client actually submitted, not the ones this trigger just rewrote. Postgres
-- fires BEFORE row triggers in name order, so the ordering is 'g' then 'r'.

CREATE OR REPLACE FUNCTION public.booking_reset_reminders_on_reschedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    NEW.reminder_24h_sent := FALSE;
    NEW.reminder_1h_sent := FALSE;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.booking_reset_reminders_on_reschedule() IS
  'Moving an appointment invalidates any reminder already sent for it. Enforced here so no caller can reschedule and forget.';

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings FORCE ROW LEVEL SECURITY;

-- No anon: an appointment names two people, a time, and an address in `notes`.
-- No DELETE: cancellation is a status, and the history is evidence.
GRANT SELECT, INSERT, UPDATE ON public.bookings TO authenticated;

CREATE POLICY bookings_select_own_customer ON public.bookings
  FOR SELECT TO authenticated
  USING (customer_id = (SELECT auth.uid()));

CREATE POLICY bookings_select_own_professional ON public.bookings
  FOR SELECT TO authenticated
  USING (public.owns_professional_profile(professional_id));

CREATE POLICY bookings_select_admin ON public.bookings
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- The professional creates the booking — they are the one whose calendar it
-- consumes, and api-marketplace.md §5 has them calling /api/bookings/create.
CREATE POLICY bookings_insert_own_professional ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_professional_profile(professional_id));

CREATE POLICY bookings_update_parties ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    customer_id = (SELECT auth.uid())
    OR public.owns_professional_profile(professional_id)
  )
  WITH CHECK (
    customer_id = (SELECT auth.uid())
    OR public.owns_professional_profile(professional_id)
  );

CREATE POLICY bookings_update_admin ON public.bookings
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Column guard ────────────────────────────────────────────────────────────
--
--   Nobody but the platform touches the reminder flags. A professional who
--   could set reminder_24h_sent = true would silence the reminder; one who
--   could set it false would re-send it to the customer on every cron tick.
--
--   The customer may cancel and nothing else. Rescheduling belongs to the
--   professional, whose calendar and capacity rules the slot came from.

CREATE OR REPLACE FUNCTION public.guard_booking_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller UUID := (SELECT auth.uid());
BEGIN
  IF caller IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Foreign-key actions (enquiry_id ON DELETE SET NULL) arrive at depth > 1;
  -- client statements run at depth 1. Note bookings_reset_reminders is a BEFORE
  -- trigger on this same statement, so it does NOT raise the depth — the flag
  -- check below still sees exactly what the client submitted.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.reminder_24h_sent IS DISTINCT FROM OLD.reminder_24h_sent
     OR NEW.reminder_1h_sent IS DISTINCT FROM OLD.reminder_1h_sent THEN
    RAISE EXCEPTION 'Reminder flags are set by the scheduler.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.professional_id IS DISTINCT FROM OLD.professional_id THEN
    RAISE EXCEPTION 'Booking parties cannot be reassigned.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF caller = OLD.customer_id THEN
    IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at
       OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes THEN
      RAISE EXCEPTION 'Only the professional can reschedule a booking.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'cancelled' THEN
      RAISE EXCEPTION 'A customer may cancel a booking; other outcomes are the professional''s to record.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER bookings_guard_columns
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.guard_booking_columns();

CREATE TRIGGER bookings_reset_reminders
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.booking_reset_reminders_on_reschedule();

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON FUNCTION public.guard_booking_columns() IS
  'Reminder flags are scheduler-only; the customer may cancel but not reschedule. Trigger name sorts before bookings_reset_reminders on purpose.';
