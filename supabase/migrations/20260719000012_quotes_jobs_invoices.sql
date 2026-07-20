-- ============================================================================
-- quotes, jobs, job_logs, invoices, recurring_invoices (playbook S038)
--
-- The professional's working documents. Three rules run through all of them:
--
--   1. **Totals are recomputed, never trusted.** api-operations.md §2.1 makes
--      this the V2 rule ("client totals are previews only"). Here it is also a
--      CHECK: total = subtotal + VAT, refused at the database if the arithmetic
--      does not close. V1 accepted client-supplied totals on quotes.
--
--   2. **A sent document is frozen.** A quote or invoice the customer has seen
--      is evidence. Revising means a new draft that supersedes the old one, not
--      an edit to the link already sitting in someone's WhatsApp.
--
--   3. **The job state machine is enforced here, not only in the API.** The
--      legal moves are a property of the domain, so cron, the mobile API, and
--      an admin script all get the same answer as the web route.
--
-- ## Naming note
--
-- V1 scoped these to `business_profiles`, which meant a sole trader on the
-- worker role could not raise a quote at all (api-operations.md flags this as a
-- "high-impact gap"). V2 scopes them to `professional_profiles` — one table,
-- so the gap cannot exist.
--
-- ## Money units
--
-- Every amount here is INTEGER whole TTD, per the global convention. V1 mixed
-- whole dollars and cents in the same column family across migrations; that
-- ambiguity is a wrong invoice waiting to be sent, so V2 is integer TTD
-- everywhere, with column names carrying the `_ttd` suffix to say so.
-- ============================================================================

-- ── Public document tokens ──────────────────────────────────────────────────
--
-- Quotes and invoices are shared as unauthenticated links over WhatsApp, so the
-- token IS the credential. 32 bytes from `gen_random_bytes` (a CSPRNG) is 256
-- bits of entropy — not guessable, and not derived from the row id, which would
-- make one leaked link enumerate the rest.
--
-- The prefix (`qt_tok_` / `inv_tok_`) matches the API pack's examples and makes
-- a leaked token identifiable at a glance in a log or a bug report.

CREATE OR REPLACE FUNCTION public.generate_document_token(prefix TEXT)
RETURNS TEXT
LANGUAGE sql
VOLATILE
SET search_path = ''
AS $$
  -- Schema-qualified: gen_random_bytes is pgcrypto, which Supabase installs
  -- into `extensions`, and the pinned empty search_path would not find it.
  SELECT prefix || encode(extensions.gen_random_bytes(32), 'hex');
$$;

COMMENT ON FUNCTION public.generate_document_token(TEXT) IS
  'CSPRNG public-link token. 256 bits, independent of the row id — one leaked link must not enumerate others.';

-- ============================================================================
-- quotes
-- ============================================================================

CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,

  -- The enquiry this quote answers, when there is one. SET NULL: a quote
  -- outlives the enquiry, and the money record must not vanish with it.
  enquiry_id UUID REFERENCES public.job_enquiries(id) ON DELETE SET NULL,

  -- Revision chain. Sent quotes are immutable, so "revise" duplicates into a
  -- new draft and points it back here — the customer keeps the original link
  -- until the new one is sent (copy-professional.md §6).
  supersedes_quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,

  -- Denormalised customer identity, deliberately. The person quoted may have no
  -- platform account at all (a WhatsApp lead), and even when they do, a quote
  -- must render exactly as it was sent — later profile edits must not rewrite a
  -- document someone has already agreed to.
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,

  -- [{ description, quantity, unit_price, amount }]
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal_ttd INTEGER NOT NULL,
  vat_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  vat_amount_ttd INTEGER NOT NULL DEFAULT 0,
  total_ttd INTEGER NOT NULL,

  status quote_status NOT NULL DEFAULT 'draft',

  -- The customer-facing link. NOT NULL with a generated default so a quote can
  -- never exist without one — a NULL token is a document that cannot be sent.
  public_token TEXT NOT NULL UNIQUE DEFAULT public.generate_document_token('qt_tok_'),

  valid_until DATE,
  notes TEXT,

  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  response_note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT quote_amounts_non_negative CHECK (
    subtotal_ttd >= 0 AND vat_amount_ttd >= 0 AND total_ttd >= 0
  ),
  CONSTRAINT quote_vat_percent_range CHECK (vat_percent >= 0 AND vat_percent <= 100),
  -- The arithmetic must close. This is the database half of "the server
  -- recomputes totals": even a server bug cannot write a document whose total
  -- disagrees with its own lines.
  CONSTRAINT quote_total_is_consistent CHECK (total_ttd = subtotal_ttd + vat_amount_ttd),
  -- A quote past 'draft' has been sent; without a timestamp the validity
  -- window, the reminder schedule, and the audit trail all have no anchor.
  CONSTRAINT quote_sent_has_timestamp CHECK (
    status = 'draft' OR sent_at IS NOT NULL
  ),
  CONSTRAINT quote_response_has_timestamp CHECK (
    status NOT IN ('accepted', 'declined') OR responded_at IS NOT NULL
  ),
  CONSTRAINT quote_token_shape CHECK (public_token ~ '^qt_tok_[0-9a-f]{64}$'),
  -- Self-supersession is a cycle of one.
  CONSTRAINT quote_supersedes_is_another_quote CHECK (supersedes_quote_id <> id)
);

COMMENT ON TABLE public.quotes IS
  'Professional-issued quote. Scoped to professional_profiles, so sole traders can quote — V1 scoped quotes to businesses only.';
COMMENT ON COLUMN public.quotes.public_token IS
  'The credential for the unauthenticated /q/<token> page. 256 bits, CSPRNG, independent of the id.';
COMMENT ON COLUMN public.quotes.customer_name IS
  'Denormalised on purpose: the customer may have no account, and a sent document must never be rewritten by a later profile edit.';
COMMENT ON CONSTRAINT quote_total_is_consistent ON public.quotes IS
  'The database half of server-recomputed totals. V1 trusted client-supplied totals.';

CREATE INDEX quotes_professional_idx ON public.quotes (professional_id);
CREATE INDEX quotes_enquiry_idx ON public.quotes (enquiry_id);
CREATE INDEX quotes_supersedes_idx ON public.quotes (supersedes_quote_id)
  WHERE supersedes_quote_id IS NOT NULL;
-- The quotes list: mine, newest first.
CREATE INDEX quotes_professional_recent_idx
  ON public.quotes (professional_id, created_at DESC);
-- The expiry sweep reads outstanding quotes past their validity date.
CREATE INDEX quotes_expiry_idx ON public.quotes (valid_until)
  WHERE status IN ('sent', 'viewed');

CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- jobs
-- ============================================================================

CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,

  source job_source NOT NULL DEFAULT 'platform',

  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  customer_address TEXT,

  service_description TEXT NOT NULL,
  job_value_ttd INTEGER,

  status job_status NOT NULL DEFAULT 'enquiry',

  -- Lifecycle stamps, all set by the transition trigger rather than by callers.
  -- Five clients write to this table; a stamp set by four of them is a stamp
  -- missing from the fifth.
  accepted_at TIMESTAMPTZ,
  in_progress_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  invoiced_at TIMESTAMPTZ,

  -- The completion timer: a job that goes in_progress must be closed within
  -- this many hours or it surfaces on the dashboard action queue.
  completion_timer_hours INTEGER NOT NULL DEFAULT 72,
  completion_deadline TIMESTAMPTZ,

  enquiry_id UUID REFERENCES public.job_enquiries(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  review_id UUID REFERENCES public.reviews(id) ON DELETE SET NULL,
  -- invoice_id is added by ALTER at the foot of this file: invoices reference
  -- jobs and jobs reference invoices, so one direction must come second.

  review_requested BOOLEAN NOT NULL DEFAULT FALSE,
  review_requested_at TIMESTAMPTZ,

  -- Work that came from outside the platform. Counts towards the professional's
  -- own pipeline but never towards platform-attributed volume.
  is_external BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,

  -- Soft delete: the job vanishes from every list, its history survives.
  deleted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT job_value_non_negative CHECK (job_value_ttd IS NULL OR job_value_ttd >= 0),
  -- One hour to thirty days. Zero would expire the job the instant it started;
  -- an unbounded value makes the timer decorative.
  CONSTRAINT job_timer_range CHECK (completion_timer_hours BETWEEN 1 AND 720),
  CONSTRAINT job_description_present CHECK (char_length(btrim(service_description)) > 0),
  -- Every state at or past a transition carries its stamp. Written as
  -- "status implies stamp" so the machine below cannot leave a hole.
  CONSTRAINT job_accepted_has_timestamp CHECK (
    status = 'enquiry' OR accepted_at IS NOT NULL
  ),
  CONSTRAINT job_completed_has_timestamp CHECK (
    status NOT IN ('completed', 'invoiced') OR completed_at IS NOT NULL
  ),
  CONSTRAINT job_invoiced_has_timestamp CHECK (
    status <> 'invoiced' OR invoiced_at IS NOT NULL
  ),
  CONSTRAINT job_review_request_has_timestamp CHECK (
    NOT review_requested OR review_requested_at IS NOT NULL
  )
);

COMMENT ON TABLE public.jobs IS
  'The professional''s work pipeline. Status transitions are enforced by trigger so every client — web, mobile, cron, admin — obeys the same machine.';
COMMENT ON COLUMN public.jobs.deleted_at IS
  'Soft delete. The job leaves every list; job_logs keeps the history, which is the point of deleting softly.';
COMMENT ON COLUMN public.jobs.is_external IS
  'Work sourced off-platform. Counts in the professional''s pipeline, never in platform-attributed volume.';

CREATE INDEX jobs_professional_idx ON public.jobs (professional_id);
CREATE INDEX jobs_enquiry_idx ON public.jobs (enquiry_id);
CREATE INDEX jobs_quote_idx ON public.jobs (quote_id);
CREATE INDEX jobs_review_idx ON public.jobs (review_id);
-- The pipeline board: my live jobs, newest first. Partial on not-deleted
-- because every list view filters deleted rows out.
CREATE INDEX jobs_pipeline_idx ON public.jobs (professional_id, status, created_at DESC)
  WHERE deleted_at IS NULL;
-- The overdue-job queue reads exactly this.
CREATE INDEX jobs_deadline_idx ON public.jobs (completion_deadline)
  WHERE status = 'in_progress' AND deleted_at IS NULL;

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── The guarded status machine ──────────────────────────────────────────────
--
-- Legal moves (api-operations.md §1.3):
--
--     enquiry     → accepted
--     accepted    → in_progress | enquiry
--     in_progress → completed   | accepted
--     completed   → invoiced    | in_progress
--     invoiced    → (terminal)
--
-- Backward moves are permitted one step because real work goes backwards —
-- a job marked complete that turns out not to be. Skipping forward is not:
-- 'enquiry' → 'invoiced' would invoice work nobody recorded doing.
--
-- This is a DOMAIN rule, not a privilege rule, so unlike the column guards it
-- applies to the service role and to admins too. An admin who needs to correct
-- a status walks it back one step at a time, which leaves a legible trail.
--
-- ERRCODE is `check_violation` rather than `insufficient_privilege`: the caller
-- is allowed to act, the move is simply not one the machine has. The API maps
-- this to 409 CONFLICT_STATE.

CREATE OR REPLACE FUNCTION public.enforce_job_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  allowed public.job_status[];
BEGIN
  -- Foreign-key SET NULL (enquiry_id, quote_id, review_id, invoice_id) arrives
  -- as an UPDATE at depth > 1 and never changes status; let it through rather
  -- than risk blocking a cascade.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  allowed := CASE OLD.status
    WHEN 'enquiry'     THEN ARRAY['accepted']::public.job_status[]
    WHEN 'accepted'    THEN ARRAY['in_progress', 'enquiry']::public.job_status[]
    WHEN 'in_progress' THEN ARRAY['completed', 'accepted']::public.job_status[]
    WHEN 'completed'   THEN ARRAY['invoiced', 'in_progress']::public.job_status[]
    WHEN 'invoiced'    THEN ARRAY[]::public.job_status[]
  END;

  IF NOT (NEW.status = ANY (allowed)) THEN
    RAISE EXCEPTION 'A job in ''%'' cannot move to ''%''.', OLD.status, NEW.status
      USING ERRCODE = 'check_violation',
            DETAIL = format('allowed: %s', COALESCE(array_to_string(allowed, ', '), 'none'));
  END IF;

  -- Stamps. Set here rather than by the caller for the same reason updated_at
  -- is: five different clients write this table, and a stamp is either always
  -- right or eventually wrong.
  --
  -- COALESCE keeps the FIRST time a state was reached. A job that goes
  -- completed → in_progress → completed should report when it was first
  -- accepted, not have its history rewritten by the round trip.
  IF NEW.status = 'accepted' THEN
    NEW.accepted_at := COALESCE(OLD.accepted_at, NOW());
  ELSIF NEW.status = 'in_progress' THEN
    NEW.accepted_at := COALESCE(OLD.accepted_at, NOW());
    NEW.in_progress_at := COALESCE(OLD.in_progress_at, NOW());
    -- The deadline is re-armed on every entry to in_progress: resuming a job
    -- that came back from 'completed' restarts its clock, which is what the
    -- dashboard queue means by overdue.
    NEW.completion_deadline := NOW() + make_interval(hours => NEW.completion_timer_hours);
  ELSIF NEW.status = 'completed' THEN
    NEW.accepted_at := COALESCE(OLD.accepted_at, NOW());
    NEW.completed_at := COALESCE(OLD.completed_at, NOW());
  ELSIF NEW.status = 'invoiced' THEN
    NEW.accepted_at := COALESCE(OLD.accepted_at, NOW());
    NEW.completed_at := COALESCE(OLD.completed_at, NOW());
    NEW.invoiced_at := COALESCE(OLD.invoiced_at, NOW());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER jobs_enforce_status_transition
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_job_status_transition();

COMMENT ON FUNCTION public.enforce_job_status_transition() IS
  'The job state machine. A domain rule, so it binds admins and the service role too. Also stamps lifecycle timestamps, first-entry-wins.';

-- ============================================================================
-- job_logs — append-only
-- ============================================================================
--
-- The job's history. Same reasoning as case_notes: a log that can be edited
-- after the fact is worth nothing as a record of what happened, which is the
-- only reason to keep one. It is also what makes soft delete honest — the job
-- disappears, the trail does not.

CREATE TABLE public.job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,

  event_type job_log_event NOT NULL,
  old_value TEXT,
  new_value TEXT,
  performed_by job_log_actor NOT NULL DEFAULT 'professional',
  note TEXT,

  -- No updated_at: there are no updates.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.job_logs IS
  'Append-only job history. No UPDATE or DELETE path for any role including service-role — enforced by trigger, not only by policy.';

CREATE INDEX job_logs_job_idx ON public.job_logs (job_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.reject_job_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- The ON DELETE CASCADE from a hard-deleted job arrives here as a DELETE at
  -- depth > 1. Refusing it would make the job undeletable; refusing a direct
  -- statement (depth 1) is the rule that matters.
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  RAISE EXCEPTION 'Job logs are append-only. Add a correcting entry instead.'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER job_logs_reject_update
  BEFORE UPDATE ON public.job_logs
  FOR EACH ROW EXECUTE FUNCTION public.reject_job_log_mutation();

CREATE TRIGGER job_logs_reject_delete
  BEFORE DELETE ON public.job_logs
  FOR EACH ROW EXECUTE FUNCTION public.reject_job_log_mutation();

COMMENT ON FUNCTION public.reject_job_log_mutation() IS
  'Hard-stops direct UPDATE and DELETE on job_logs for every role. Cascades from a deleted job (depth > 1) pass.';

-- ============================================================================
-- invoices
-- ============================================================================

-- Invoice numbering. A sequence, not a `MAX(...) + 1` scan: two invoices
-- created in the same second must not race to the same number, and a unique
-- index that merely *rejects* the collision means one professional's invoice
-- fails at the moment they press send.
--
-- The sequence does NOT reset annually — INV-2027-0100 may follow INV-2026-0099.
-- That is deliberate. A per-year reset needs either a counter table (another
-- lock on the hot path) or a scan (the race above), and a globally increasing
-- number is worth more than tidy per-year numbering: it makes gaps meaningful.
CREATE SEQUENCE public.invoice_number_seq START 1;

COMMENT ON SEQUENCE public.invoice_number_seq IS
  'Global invoice counter. Deliberately does not reset per year — uniqueness under concurrency beats tidy numbering.';

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,

  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  -- recurring_invoice_id is added by ALTER at the foot of this file.

  -- Generated by trigger, never by the caller. NOT NULL and UNIQUE: an invoice
  -- without a number cannot be referenced in a payment conversation, and two
  -- invoices sharing one is an accounting problem.
  invoice_number TEXT NOT NULL UNIQUE,

  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,

  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal_ttd INTEGER NOT NULL,
  vat_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  vat_amount_ttd INTEGER NOT NULL DEFAULT 0,
  total_ttd INTEGER NOT NULL,

  status invoice_status NOT NULL DEFAULT 'draft',

  public_token TEXT NOT NULL UNIQUE DEFAULT public.generate_document_token('inv_tok_'),

  due_date DATE,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  -- ── Reminder state (backend-processes §5) ─────────────────────────────────
  -- Platform-maintained. A professional who could set `reminder_count = 0`
  -- would loop the reminder schedule on their own customer.
  reminder_count INTEGER NOT NULL DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  next_reminder_at TIMESTAMPTZ,

  pdf_url TEXT,
  notes TEXT,
  -- Which document template rendered it. TEXT, matching profile_templates(id).
  template_id TEXT REFERENCES public.profile_templates(id) ON DELETE SET NULL,

  generated_by TEXT NOT NULL DEFAULT 'manual',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT invoice_amounts_non_negative CHECK (
    subtotal_ttd >= 0 AND vat_amount_ttd >= 0 AND total_ttd >= 0
  ),
  CONSTRAINT invoice_vat_percent_range CHECK (vat_percent >= 0 AND vat_percent <= 100),
  CONSTRAINT invoice_total_is_consistent CHECK (total_ttd = subtotal_ttd + vat_amount_ttd),
  CONSTRAINT invoice_generated_by_known CHECK (generated_by IN ('manual', 'recurring')),
  CONSTRAINT invoice_reminder_count_non_negative CHECK (reminder_count >= 0),
  -- A reminder count with no timestamp cannot be scheduled against.
  CONSTRAINT invoice_reminders_have_timestamp CHECK (
    reminder_count = 0 OR last_reminder_at IS NOT NULL
  ),
  -- 'paid' is the state money depends on; without a timestamp neither the
  -- professional nor reconciliation can say when it settled.
  CONSTRAINT invoice_paid_has_timestamp CHECK (
    status <> 'paid' OR paid_at IS NOT NULL
  ),
  CONSTRAINT invoice_sent_has_timestamp CHECK (
    status IN ('draft', 'cancelled') OR sent_at IS NOT NULL
  ),
  CONSTRAINT invoice_token_shape CHECK (public_token ~ '^inv_tok_[0-9a-f]{64}$')
);

COMMENT ON TABLE public.invoices IS
  'Professional-issued invoice. invoice_number and totals are database-guaranteed; the professional cannot mark one paid.';
COMMENT ON COLUMN public.invoices.reminder_count IS
  'Platform-maintained by the reminder sweep. Guarded — resetting it would re-run the schedule against a real customer.';
COMMENT ON COLUMN public.invoices.acknowledged_at IS
  'Set by the unauthenticated /i/<token> page. Idempotent: a second acknowledgement is a no-op, because double-taps from WhatsApp are normal.';

CREATE INDEX invoices_professional_idx ON public.invoices (professional_id);
CREATE INDEX invoices_job_idx ON public.invoices (job_id);
CREATE INDEX invoices_quote_idx ON public.invoices (quote_id);
CREATE INDEX invoices_template_idx ON public.invoices (template_id)
  WHERE template_id IS NOT NULL;
CREATE INDEX invoices_professional_recent_idx
  ON public.invoices (professional_id, created_at DESC);
-- The reminder sweep and the overdue chip both read unsettled invoices by date.
CREATE INDEX invoices_outstanding_idx ON public.invoices (due_date)
  WHERE status IN ('sent', 'viewed', 'overdue');
CREATE INDEX invoices_reminder_due_idx ON public.invoices (next_reminder_at)
  WHERE next_reminder_at IS NOT NULL AND status IN ('sent', 'viewed', 'overdue');
-- The Growth monthly invoice cap (30) counts a professional's invoices this
-- month; this is the index that count reads.
CREATE INDEX invoices_monthly_cap_idx ON public.invoices (professional_id, created_at);

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION public.assign_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Ignores any caller-supplied value entirely. An invoice number a client can
  -- choose is an invoice number a client can duplicate.
  NEW.invoice_number := 'INV-'
    || to_char(NOW(), 'YYYY') || '-'
    || lpad(nextval('public.invoice_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER invoices_assign_number
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.assign_invoice_number();

COMMENT ON FUNCTION public.assign_invoice_number() IS
  'Server-assigned INV-YYYY-NNNN from a sequence. Overwrites whatever the caller sent.';

-- ============================================================================
-- recurring_invoices
-- ============================================================================
--
-- The template a scheduled invoice is generated from (Pro and above). Separate
-- from `invoices` rather than a flag on it, because a schedule is not a
-- document: it has no number, no token, no status, and generates many rows.

CREATE TABLE public.recurring_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,

  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,

  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal_ttd INTEGER NOT NULL,
  vat_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  vat_amount_ttd INTEGER NOT NULL DEFAULT 0,
  total_ttd INTEGER NOT NULL,

  frequency invoice_frequency NOT NULL DEFAULT 'monthly',
  next_send_date DATE NOT NULL,
  last_sent_at TIMESTAMPTZ,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  -- Platform-maintained by the generation cron. Guarded below: this number is
  -- how the schedule reports itself, and a professional editing it would make
  -- "how many have gone out" a fiction.
  invoices_generated INTEGER NOT NULL DEFAULT 0,

  notes TEXT,
  template_id TEXT REFERENCES public.profile_templates(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT recurring_amounts_non_negative CHECK (
    subtotal_ttd >= 0 AND vat_amount_ttd >= 0 AND total_ttd >= 0
  ),
  CONSTRAINT recurring_vat_percent_range CHECK (vat_percent >= 0 AND vat_percent <= 100),
  CONSTRAINT recurring_total_is_consistent CHECK (total_ttd = subtotal_ttd + vat_amount_ttd),
  CONSTRAINT recurring_generated_non_negative CHECK (invoices_generated >= 0)
);

COMMENT ON TABLE public.recurring_invoices IS
  'Invoice schedule (Pro and above). A schedule, not a document — no number, no token, no status.';

CREATE INDEX recurring_invoices_professional_idx
  ON public.recurring_invoices (professional_id);
CREATE INDEX recurring_invoices_template_idx ON public.recurring_invoices (template_id)
  WHERE template_id IS NOT NULL;
-- The generation cron reads exactly this: live schedules that are due.
CREATE INDEX recurring_invoices_due_idx ON public.recurring_invoices (next_send_date)
  WHERE is_active;

CREATE TRIGGER recurring_invoices_updated_at
  BEFORE UPDATE ON public.recurring_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── The circular references, resolved ───────────────────────────────────────

ALTER TABLE public.jobs
  ADD COLUMN invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;
CREATE INDEX jobs_invoice_idx ON public.jobs (invoice_id);

ALTER TABLE public.quotes
  ADD COLUMN converted_job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL;
CREATE INDEX quotes_converted_job_idx ON public.quotes (converted_job_id)
  WHERE converted_job_id IS NOT NULL;

ALTER TABLE public.invoices
  ADD COLUMN recurring_invoice_id UUID
    REFERENCES public.recurring_invoices(id) ON DELETE SET NULL;
CREATE INDEX invoices_recurring_idx ON public.invoices (recurring_invoice_id)
  WHERE recurring_invoice_id IS NOT NULL;

-- ============================================================================
-- RLS — quotes, jobs, job_logs, invoices, recurring_invoices
-- ============================================================================
--
-- All five are the professional's private working documents. No anon policy on
-- any of them: the public /q/ and /i/ token pages are served by an API route
-- holding the service key, which looks the token up and returns a redacted
-- payload. Exposing these tables to anon so a token page could read them
-- directly would mean anon could read every row and filter client-side.

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.job_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_invoices FORCE ROW LEVEL SECURITY;

-- No DELETE on quotes or invoices: a document that was sent is a record.
-- Jobs get DELETE at the policy level for admin cleanup only; the professional
-- soft-deletes via deleted_at.
GRANT SELECT, INSERT, UPDATE ON public.quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.jobs TO authenticated;
GRANT SELECT, INSERT ON public.job_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_invoices TO authenticated;

-- ── quotes ──────────────────────────────────────────────────────────────────

CREATE POLICY quotes_select_own ON public.quotes
  FOR SELECT TO authenticated
  USING (public.owns_professional_profile(professional_id));

CREATE POLICY quotes_select_admin ON public.quotes
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY quotes_insert_own ON public.quotes
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_professional_profile(professional_id));

CREATE POLICY quotes_update_own ON public.quotes
  FOR UPDATE TO authenticated
  USING (public.owns_professional_profile(professional_id))
  WITH CHECK (public.owns_professional_profile(professional_id));

CREATE POLICY quotes_update_admin ON public.quotes
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── jobs ────────────────────────────────────────────────────────────────────

CREATE POLICY jobs_select_own ON public.jobs
  FOR SELECT TO authenticated
  USING (public.owns_professional_profile(professional_id));

CREATE POLICY jobs_select_admin ON public.jobs
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY jobs_insert_own ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_professional_profile(professional_id));

CREATE POLICY jobs_update_own ON public.jobs
  FOR UPDATE TO authenticated
  USING (public.owns_professional_profile(professional_id))
  WITH CHECK (public.owns_professional_profile(professional_id));

CREATE POLICY jobs_update_admin ON public.jobs
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── job_logs ────────────────────────────────────────────────────────────────
-- Readable by the job's owner and admins; insertable by both. No UPDATE or
-- DELETE grant at all, and the trigger above catches the service role.

CREATE POLICY job_logs_select_own ON public.job_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.jobs j
     WHERE j.id = job_id AND public.owns_professional_profile(j.professional_id)
  ));

CREATE POLICY job_logs_select_admin ON public.job_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY job_logs_insert_own ON public.job_logs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.jobs j
     WHERE j.id = job_id AND public.owns_professional_profile(j.professional_id)
  ));

CREATE POLICY job_logs_insert_admin ON public.job_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- ── invoices ────────────────────────────────────────────────────────────────

CREATE POLICY invoices_select_own ON public.invoices
  FOR SELECT TO authenticated
  USING (public.owns_professional_profile(professional_id));

CREATE POLICY invoices_select_admin ON public.invoices
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY invoices_insert_own ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_professional_profile(professional_id));

CREATE POLICY invoices_update_own ON public.invoices
  FOR UPDATE TO authenticated
  USING (public.owns_professional_profile(professional_id))
  WITH CHECK (public.owns_professional_profile(professional_id));

CREATE POLICY invoices_update_admin ON public.invoices
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── recurring_invoices ──────────────────────────────────────────────────────

CREATE POLICY recurring_invoices_select_own ON public.recurring_invoices
  FOR SELECT TO authenticated
  USING (public.owns_professional_profile(professional_id));

CREATE POLICY recurring_invoices_select_admin ON public.recurring_invoices
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY recurring_invoices_write_own ON public.recurring_invoices
  FOR ALL TO authenticated
  USING (public.owns_professional_profile(professional_id))
  WITH CHECK (public.owns_professional_profile(professional_id));

CREATE POLICY recurring_invoices_write_admin ON public.recurring_invoices
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- Column guards
-- ============================================================================

-- ── quotes ──────────────────────────────────────────────────────────────────
--
-- Two rules. A sent quote is frozen, and the customer's answer belongs to the
-- customer. The public token route runs with the service key (auth.uid() NULL)
-- and so passes straight through the bypass at the top — which is exactly the
-- boundary: acceptance arrives from the customer's side, never the seller's.

CREATE OR REPLACE FUNCTION public.guard_quote_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.professional_id IS DISTINCT FROM OLD.professional_id THEN
    RAISE EXCEPTION 'A quote cannot be reassigned to another professional.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Self-acceptance. A seller who could mark their own quote 'accepted' could
  -- manufacture a customer's agreement and convert it to an invoice.
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'draft' AND NEW.status = 'sent') THEN
    RAISE EXCEPTION 'A quote''s outcome is the customer''s to give. You may send a draft.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.viewed_at IS DISTINCT FROM OLD.viewed_at
     OR NEW.responded_at IS DISTINCT FROM OLD.responded_at
     OR NEW.response_note IS DISTINCT FROM OLD.response_note THEN
    RAISE EXCEPTION 'Quote response details are recorded from the customer''s link.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- The token is the credential. Rotating it silently breaks the link already
  -- sent; choosing it defeats the entropy.
  IF NEW.public_token IS DISTINCT FROM OLD.public_token THEN
    RAISE EXCEPTION 'A quote''s public link cannot be changed. Send a revised draft instead.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Frozen once sent. The customer is looking at a document; editing the price
  -- underneath them is the oldest trick there is.
  IF OLD.status <> 'draft'
     AND (NEW.line_items IS DISTINCT FROM OLD.line_items
          OR NEW.subtotal_ttd IS DISTINCT FROM OLD.subtotal_ttd
          OR NEW.vat_percent IS DISTINCT FROM OLD.vat_percent
          OR NEW.vat_amount_ttd IS DISTINCT FROM OLD.vat_amount_ttd
          OR NEW.total_ttd IS DISTINCT FROM OLD.total_ttd
          OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
          OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
          OR NEW.customer_email IS DISTINCT FROM OLD.customer_email
          OR NEW.customer_phone IS DISTINCT FROM OLD.customer_phone) THEN
    RAISE EXCEPTION 'A sent quote is fixed. Create a revised draft instead.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER quotes_guard_columns
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.guard_quote_columns();

COMMENT ON FUNCTION public.guard_quote_columns() IS
  'A seller may send a draft. Acceptance, view stamps, the token, and the contents of a sent quote are not theirs to write.';

-- ── invoices ────────────────────────────────────────────────────────────────
--
-- **A professional cannot mark their own invoice paid.** Settlement is recorded
-- by the payment rail, or by an administrator recording an off-platform
-- payment. The reason is that `paid_at` is not decoration: it settles the
-- customer's obligation, stops the reminder ladder, feeds the CRM's lifetime
-- value, and is what the reconciliation cron diffs against the gateway. A
-- seller-writable "paid" makes all four of those the seller's opinion.
--
-- FLAGGED — this is stricter than api-operations.md §2.4, which shows
-- `PATCH /api/invoices/{id} { "status": "paid" }` as a professional route. Both
-- can be true: the route stays, but it must run through a server-side client
-- that records the settlement (a `payments` row) rather than through the
-- caller's RLS session. The spec is ambiguous about which client that route
-- holds; the playbook's instruction to guard it is not. Guard implemented,
-- ambiguity recorded rather than resolved silently.

CREATE OR REPLACE FUNCTION public.guard_invoice_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.professional_id IS DISTINCT FROM OLD.professional_id THEN
    RAISE EXCEPTION 'An invoice cannot be reassigned to another professional.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.status = 'paid' AND OLD.status <> 'paid' THEN
    RAISE EXCEPTION 'An invoice is marked paid when payment is recorded, not by the issuer.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
    RAISE EXCEPTION 'An invoice is marked paid when payment is recorded, not by the issuer.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Everything else on the status axis a professional MAY do: send a draft,
  -- and cancel anything not yet paid. 'viewed' and 'overdue' are the platform's.
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'draft' AND NEW.status = 'sent')
     AND NOT (OLD.status <> 'paid' AND NEW.status = 'cancelled') THEN
    RAISE EXCEPTION 'That invoice status is set by the platform. You may send a draft or cancel an unpaid invoice.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.viewed_at IS DISTINCT FROM OLD.viewed_at
     OR NEW.acknowledged_at IS DISTINCT FROM OLD.acknowledged_at THEN
    RAISE EXCEPTION 'View and acknowledgement stamps are recorded from the customer''s link.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- The reminder ladder. Resetting the count re-runs the schedule at a real
  -- customer, which is how a billing tool becomes a nuisance.
  IF NEW.reminder_count IS DISTINCT FROM OLD.reminder_count
     OR NEW.last_reminder_at IS DISTINCT FROM OLD.last_reminder_at
     OR NEW.next_reminder_at IS DISTINCT FROM OLD.next_reminder_at THEN
    RAISE EXCEPTION 'Invoice reminders are scheduled by the platform.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
     OR NEW.public_token IS DISTINCT FROM OLD.public_token THEN
    RAISE EXCEPTION 'An invoice''s number and public link are fixed at creation.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Frozen once sent, same reasoning as quotes.
  IF OLD.status <> 'draft'
     AND (NEW.line_items IS DISTINCT FROM OLD.line_items
          OR NEW.subtotal_ttd IS DISTINCT FROM OLD.subtotal_ttd
          OR NEW.vat_percent IS DISTINCT FROM OLD.vat_percent
          OR NEW.vat_amount_ttd IS DISTINCT FROM OLD.vat_amount_ttd
          OR NEW.total_ttd IS DISTINCT FROM OLD.total_ttd
          OR NEW.customer_name IS DISTINCT FROM OLD.customer_name
          OR NEW.customer_email IS DISTINCT FROM OLD.customer_email
          OR NEW.customer_phone IS DISTINCT FROM OLD.customer_phone) THEN
    RAISE EXCEPTION 'A sent invoice is fixed. Cancel it and issue a new one instead.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER invoices_guard_columns
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_columns();

COMMENT ON FUNCTION public.guard_invoice_columns() IS
  'The issuer may send a draft and cancel an unpaid invoice. Paid state, view stamps, reminders, the number, the token, and a sent invoice''s contents are not theirs.';

-- ── recurring_invoices ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_recurring_invoice_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.professional_id IS DISTINCT FROM OLD.professional_id THEN
    RAISE EXCEPTION 'A schedule cannot be reassigned to another professional.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- The schedule's own report of itself. `last_sent_at` is also the cron's
  -- "did I already run this" marker, so a writable one means double-sending.
  IF NEW.invoices_generated IS DISTINCT FROM OLD.invoices_generated
     OR NEW.last_sent_at IS DISTINCT FROM OLD.last_sent_at THEN
    RAISE EXCEPTION 'Recurring invoice history is maintained by the platform.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER recurring_invoices_guard_columns
  BEFORE UPDATE ON public.recurring_invoices
  FOR EACH ROW EXECUTE FUNCTION public.guard_recurring_invoice_columns();

COMMENT ON FUNCTION public.guard_recurring_invoice_columns() IS
  'The schedule is the professional''s; its send history is the platform''s. last_sent_at doubles as the cron''s idempotency marker.';
