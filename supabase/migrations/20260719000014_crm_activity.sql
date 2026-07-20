-- ============================================================================
-- client_contacts, user_activity_log, admin_audit_log, store_orders
-- (playbook S040)
--
-- The record-keeping layer: who a professional has worked with, what users did,
-- what administrators decided, and what was ordered from the shop.
--
-- One theme runs through it — **a log that can be edited is not a log.**
-- `admin_audit_log` in particular is the platform's answer to "who did this",
-- and the answer has to survive the person leaving.
-- ============================================================================

-- ============================================================================
-- client_contacts — the CRM (Studio and above)
-- ============================================================================
--
-- A professional's own address book. Rows arrive two ways: typed in by hand, or
-- synthesised by the trigger below the first time a customer enquires. The
-- second is what makes the CRM useful on day one instead of on day ninety.

CREATE TABLE public.client_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  professional_id UUID NOT NULL
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,

  -- The platform account behind this contact, when there is one. NULL for a
  -- manually added contact (a walk-in, a WhatsApp lead, a customer from before
  -- the platform). SET NULL on delete, not CASCADE: a customer closing their
  -- account must not delete the professional's record of the work they did.
  customer_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  display_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  area TEXT,

  -- How the row got here. Auto-synced rows are read-only on identity fields
  -- API-side (api-operations.md §4.2) because their identity belongs to the
  -- linked account, not to the professional's notes about them.
  origin TEXT NOT NULL DEFAULT 'manual',
  source_ref_id UUID,

  tags TEXT[] NOT NULL DEFAULT '{}',
  internal_notes TEXT,

  -- ── Derived, platform-maintained ──────────────────────────────────────────
  first_contact_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enquiry_count INTEGER NOT NULL DEFAULT 0,
  -- Whole TTD, summed from settled invoices by the CRM. A professional-editable
  -- lifetime value would make the CRM's only quantitative column a guess.
  lifetime_value_ttd INTEGER NOT NULL DEFAULT 0,

  is_archived BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT contact_origin_known CHECK (
    origin IN ('enquiry_sync', 'job', 'manual', 'import')
  ),
  CONSTRAINT contact_display_name_present CHECK (char_length(btrim(display_name)) > 0),
  CONSTRAINT contact_counters_non_negative CHECK (
    enquiry_count >= 0 AND lifetime_value_ttd >= 0
  ),
  -- A synced row exists because something created it; without the reference the
  -- link back to the enquiry is lost and the timeline cannot be assembled.
  CONSTRAINT contact_synced_names_source CHECK (
    origin <> 'enquiry_sync' OR source_ref_id IS NOT NULL
  )
);

COMMENT ON TABLE public.client_contacts IS
  'A professional''s address book. Auto-populated from enquiries by trigger, so the CRM is useful from the first enquiry rather than after months of manual entry.';
COMMENT ON COLUMN public.client_contacts.lifetime_value_ttd IS
  'Whole TTD, summed from settled invoices. Guarded — a self-editable lifetime value makes the CRM''s only number meaningless.';

-- One contact per (professional, linked account). PARTIAL, on
-- `customer_user_id IS NOT NULL` — V1 used a plain UNIQUE, which does not
-- constrain NULLs at all, so manually added contacts could duplicate without
-- limit AND the ON CONFLICT target silently never matched for them. Stating the
-- predicate makes the index mean what its name says.
CREATE UNIQUE INDEX client_contacts_one_per_linked_customer_idx
  ON public.client_contacts (professional_id, customer_user_id)
  WHERE customer_user_id IS NOT NULL;

COMMENT ON INDEX public.client_contacts_one_per_linked_customer_idx IS
  'Partial: NULL customer_user_id (manual contacts) is deliberately unconstrained — two walk-ins may share a name.';

CREATE INDEX client_contacts_professional_idx ON public.client_contacts (professional_id);
CREATE INDEX client_contacts_customer_idx ON public.client_contacts (customer_user_id)
  WHERE customer_user_id IS NOT NULL;
CREATE INDEX client_contacts_tags_idx ON public.client_contacts USING GIN (tags);
-- The CRM list: mine, most recently active first, unarchived.
CREATE INDEX client_contacts_recent_idx
  ON public.client_contacts (professional_id, last_activity_at DESC)
  WHERE NOT is_archived;

CREATE TRIGGER client_contacts_updated_at
  BEFORE UPDATE ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Enquiry → contact sync ──────────────────────────────────────────────────
--
-- Two V1 defects fixed here:
--
--   1. V1's INSERT was `SELECT … FROM profiles WHERE id = homeowner_id`. If the
--      profile row was missing, the SELECT returned zero rows and the enquiry
--      silently created no contact at all — a failure that looks exactly like
--      success. V2 selects from a one-row source and LEFT JOINs the profile, so
--      a row is always written and the name degrades to a sensible fallback.
--
--   2. V1's ON CONFLICT targeted a non-partial unique constraint over a
--      nullable column, which never fires for NULLs. V2 names the partial index
--      predicate explicitly.
--
-- The contact is created for the PROFESSIONAL who received the enquiry. It is
-- their address book; the customer gets no row anywhere from this.

CREATE OR REPLACE FUNCTION public.sync_enquiry_to_client_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.client_contacts
    (professional_id, customer_user_id, display_name, email, phone,
     origin, source_ref_id, first_contact_at, last_activity_at, enquiry_count)
  SELECT
    NEW.professional_id,
    NEW.customer_id,
    -- NULLIF on the trimmed name: a profile with full_name = '' is common after
    -- an OAuth signup that returned no name, and '' fails the display_name CHECK.
    COALESCE(NULLIF(btrim(p.full_name), ''), p.email, 'Customer'),
    p.email,
    p.phone_number,
    'enquiry_sync',
    NEW.id,
    NEW.created_at,
    NEW.created_at,
    1
  FROM (SELECT 1) AS always_one_row
  LEFT JOIN public.profiles p ON p.id = NEW.customer_id
  ON CONFLICT (professional_id, customer_user_id) WHERE customer_user_id IS NOT NULL
  DO UPDATE SET
    -- GREATEST, not assignment: enquiries can be backfilled out of order, and
    -- an older enquiry must not drag "last activity" backwards.
    last_activity_at = GREATEST(public.client_contacts.last_activity_at, EXCLUDED.last_activity_at),
    enquiry_count = public.client_contacts.enquiry_count + 1;

  RETURN NULL;  -- AFTER trigger
END;
$$;

CREATE TRIGGER job_enquiries_sync_client_contact
  AFTER INSERT ON public.job_enquiries
  FOR EACH ROW EXECUTE FUNCTION public.sync_enquiry_to_client_contact();

COMMENT ON FUNCTION public.sync_enquiry_to_client_contact() IS
  'Creates or touches the professional''s CRM contact on every enquiry. Always writes a row — V1 silently wrote none when the profile lookup missed.';

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts FORCE ROW LEVEL SECURITY;

-- No anon. DELETE is granted: unlike a document, a contact someone typed in by
-- mistake is theirs to remove, and nothing references it.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contacts TO authenticated;

CREATE POLICY client_contacts_select_own ON public.client_contacts
  FOR SELECT TO authenticated
  USING (public.owns_professional_profile(professional_id));

CREATE POLICY client_contacts_select_admin ON public.client_contacts
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY client_contacts_write_own ON public.client_contacts
  FOR ALL TO authenticated
  USING (public.owns_professional_profile(professional_id))
  WITH CHECK (public.owns_professional_profile(professional_id));

CREATE POLICY client_contacts_write_admin ON public.client_contacts
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.guard_client_contact_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- The sync trigger's ON CONFLICT DO UPDATE, and FK SET NULL, arrive here at
  -- depth > 1. Without this bypass the CRM would stop counting on the second
  -- enquiry from the same customer.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF (SELECT auth.uid()) IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.professional_id IS DISTINCT FROM OLD.professional_id THEN
    RAISE EXCEPTION 'A contact cannot be moved to another professional''s book.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Derived history. `lifetime_value_ttd` is the number the CRM sorts and
  -- filters on; an editable one is a number the professional chose.
  IF NEW.enquiry_count IS DISTINCT FROM OLD.enquiry_count
     OR NEW.lifetime_value_ttd IS DISTINCT FROM OLD.lifetime_value_ttd
     OR NEW.first_contact_at IS DISTINCT FROM OLD.first_contact_at THEN
    RAISE EXCEPTION 'Contact history is maintained by the platform.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Re-linking a contact to a different platform account would attach one
  -- customer's enquiry and invoice history to another person's name.
  IF NEW.customer_user_id IS DISTINCT FROM OLD.customer_user_id THEN
    RAISE EXCEPTION 'A contact''s linked account is set when the contact is created.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER client_contacts_guard_columns
  BEFORE UPDATE ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.guard_client_contact_columns();

COMMENT ON FUNCTION public.guard_client_contact_columns() IS
  'Notes, tags, and contact details are the professional''s. Counters, first-contact date, and the linked account are the platform''s.';

-- ============================================================================
-- user_activity_log
-- ============================================================================
--
-- Product analytics: searches, profile views, enquiries, bookings. Append-only
-- like every other log here, and deliberately survivable — `user_id` is SET
-- NULL on account deletion rather than CASCADE, so closing an account
-- de-identifies the history instead of deleting it. That is both the analytics
-- answer and the data-protection one: the platform keeps aggregate behaviour,
-- the person stops being identifiable in it.

CREATE TABLE public.user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- TEXT, not INET: proxied client addresses are not always parseable, the same
  -- reasoning as legal_acceptances.
  ip_address TEXT,
  user_agent TEXT,

  -- No updated_at: an event is a fact about a moment.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT activity_event_type_present CHECK (char_length(btrim(event_type)) > 0)
);

COMMENT ON TABLE public.user_activity_log IS
  'Append-only product analytics. user_id is SET NULL on account deletion: the behaviour is kept, the person is not identifiable in it.';

CREATE INDEX user_activity_log_user_idx ON public.user_activity_log (user_id, created_at DESC);
-- The analytics reads are "this event type over this window".
CREATE INDEX user_activity_log_event_idx ON public.user_activity_log (event_type, created_at DESC);
CREATE INDEX user_activity_log_entity_idx ON public.user_activity_log (entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reject_activity_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- The ON DELETE SET NULL on user_id arrives as an UPDATE at depth > 1 when an
  -- account is closed. Blocking it would make accounts undeletable — the same
  -- bug, in a different table, as requiring an attribution column NOT NULL.
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  RAISE EXCEPTION 'Activity log entries are immutable.'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER user_activity_log_reject_update
  BEFORE UPDATE ON public.user_activity_log
  FOR EACH ROW EXECUTE FUNCTION public.reject_activity_log_mutation();

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_log FORCE ROW LEVEL SECURITY;

-- No anon: signed-out analytics goes through a server route. No UPDATE, no
-- DELETE for anyone.
GRANT SELECT, INSERT ON public.user_activity_log TO authenticated;

CREATE POLICY user_activity_log_select_own ON public.user_activity_log
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY user_activity_log_select_admin ON public.user_activity_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- A user may log their own activity and nobody else's. Without the WITH CHECK,
-- any authenticated caller could forge event history for another account.
CREATE POLICY user_activity_log_insert_own ON public.user_activity_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================================
-- admin_audit_log — immutable, and deliberately FK-free
-- ============================================================================
--
-- ## Why `admin_id` has no foreign key
--
-- This is the platform's durable answer to "who decided this". Every other
-- table attributes admin actions through an `ON DELETE SET NULL` reference
-- (reviews.moderated_by, disputes.resolved_by, store_orders.fulfilled_by) —
-- which means when an administrator's account is closed, those attributions
-- correctly degrade to NULL rather than blocking the deletion.
--
-- That degradation is only acceptable because THIS table does not degrade. It
-- holds no foreign key to `profiles`, so nothing cascades into it and nothing
-- nulls it. `admin_email` is captured at write time as a snapshot for the same
-- reason: an audit record that depends on the actor still existing is an audit
-- record that disappears exactly when someone wants it to.
--
-- Migration 20260719000010 states this contract in prose ("admin_audit_log,
-- which is append-only and does not reference profiles"). This is the table
-- keeping that promise.

CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Intentionally NOT a foreign key. See the note above.
  admin_id UUID NOT NULL,
  -- Snapshot, so the record reads correctly after the account is gone.
  admin_email TEXT NOT NULL,

  action_type TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id UUID,

  -- Before/after payloads for the action, where the action changed something.
  before_state JSONB,
  after_state JSONB,

  notes TEXT,
  ip_address TEXT,

  -- No updated_at: nothing here is ever updated.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT audit_action_type_present CHECK (char_length(btrim(action_type)) > 0),
  CONSTRAINT audit_target_table_present CHECK (char_length(btrim(target_table)) > 0)
);

COMMENT ON TABLE public.admin_audit_log IS
  'Immutable record of administrator actions. Holds NO foreign key to profiles by design — this is the attribution that must survive the administrator''s account being deleted.';
COMMENT ON COLUMN public.admin_audit_log.admin_id IS
  'Deliberately unreferenced. An FK here would either block deleting an admin or null the attribution — both defeat the purpose of the table.';
COMMENT ON COLUMN public.admin_audit_log.admin_email IS
  'Snapshot at write time. The record must read correctly after the account is gone.';

CREATE INDEX admin_audit_log_admin_idx ON public.admin_audit_log (admin_id, created_at DESC);
CREATE INDEX admin_audit_log_target_idx ON public.admin_audit_log (target_table, target_id);
CREATE INDEX admin_audit_log_recent_idx ON public.admin_audit_log (created_at DESC);

CREATE OR REPLACE FUNCTION public.reject_admin_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- No depth bypass, unlike every other append-only table here. This one holds
  -- no foreign key at all, so no cascade and no SET NULL can ever legitimately
  -- reach it — which means an UPDATE or DELETE arriving from any depth is
  -- something nobody should be doing.
  RAISE EXCEPTION 'The admin audit log is immutable. It cannot be edited or deleted by any role.'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER admin_audit_log_reject_update
  BEFORE UPDATE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.reject_admin_audit_mutation();

CREATE TRIGGER admin_audit_log_reject_delete
  BEFORE DELETE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.reject_admin_audit_mutation();

COMMENT ON FUNCTION public.reject_admin_audit_mutation() IS
  'Absolute. No trigger-depth bypass, because the table has no foreign keys and so has no legitimate cascade to admit.';

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log FORCE ROW LEVEL SECURITY;

-- Admin-only, both ways. No UPDATE or DELETE grant to compound the trigger.
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;

CREATE POLICY admin_audit_log_select_admin ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- `admin_id = auth.uid()` as well as `is_admin()`: an administrator may record
-- their own actions and nobody else's. Without it, one admin could write
-- entries in another's name — in the one table whose entire value is that the
-- name is right.
CREATE POLICY admin_audit_log_insert_admin ON public.admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND admin_id = (SELECT auth.uid()));

-- ============================================================================
-- store_orders — the merch shop
-- ============================================================================

CREATE TABLE public.store_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- NULL for a guest order. SET NULL, not CASCADE: an order that was placed and
  -- paid for is a commercial record that outlives the account.
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Required regardless of account, because the order has to be deliverable and
  -- the receipt has to go somewhere.
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,

  -- Product snapshot. Denormalised deliberately: the catalogue is a code
  -- constant that changes with deploys, and an order must render at the price
  -- and name it was placed at, not at today's.
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_price_ttd INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_ttd INTEGER NOT NULL,

  -- `sponsor` is the subsidised partner co-brand. The V1 CHECK allowed only
  -- tradelynq|custom and needed widening in a later migration; V2 has all three
  -- from the start.
  branding TEXT NOT NULL DEFAULT 'tradelynq',

  size TEXT,
  color_preference TEXT,
  notes TEXT,

  -- Payment is off-app (bank transfer, WiPay link, cash on delivery under
  -- TTD $500) and recorded by an admin at confirmation.
  payment_method TEXT,

  status TEXT NOT NULL DEFAULT 'pending',

  -- ADMIN-ONLY. RLS cannot hide a column from a row the owner may read, so this
  -- must be omitted server-side by explicit column list — the same treatment as
  -- professional_profiles.contact_phone. V1 shipped this leak: any admin note
  -- on a user-owned order was readable by that user.
  admin_notes TEXT,

  fulfilled_at TIMESTAMPTZ,
  fulfilled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT store_order_price_positive CHECK (product_price_ttd > 0),
  -- 1–20 per api-commerce-public.md §2.1. V1 allowed 100, which for a
  -- hand-fulfilled merch line is an order nobody can service.
  CONSTRAINT store_order_quantity_range CHECK (quantity BETWEEN 1 AND 20),
  -- The arithmetic closes, same rule as invoices.
  CONSTRAINT store_order_total_is_consistent CHECK (
    total_ttd = product_price_ttd * quantity
  ),
  CONSTRAINT store_order_branding_known CHECK (
    branding IN ('tradelynq', 'sponsor', 'custom')
  ),
  CONSTRAINT store_order_payment_method_known CHECK (
    payment_method IS NULL
    OR payment_method IN ('bank_transfer', 'wipay_link', 'cash_on_delivery')
  ),
  CONSTRAINT store_order_status_known CHECK (
    status IN ('pending', 'confirmed', 'in_progress', 'shipped', 'completed', 'cancelled')
  ),
  CONSTRAINT store_order_notes_length CHECK (
    notes IS NULL OR char_length(notes) <= 1000
  ),
  -- Cash on delivery is capped at TTD $500 (Master §9.5) — above that the
  -- courier is carrying too much cash to be reasonable.
  CONSTRAINT store_order_cod_limit CHECK (
    payment_method <> 'cash_on_delivery' OR total_ttd < 500
  ),
  -- THE TIMESTAMP ONLY, NEVER `fulfilled_by`.
  --
  -- `fulfilled_by` is ON DELETE SET NULL. Requiring it here would mean that
  -- closing a former admin's account violates this constraint on every order
  -- they ever fulfilled — the deletion fails outright, the admin becomes
  -- permanently undeletable, and the platform cannot honour an erasure request.
  -- This exact bug has shipped on this project once already. Durable
  -- attribution lives in admin_audit_log, which holds no foreign key at all.
  CONSTRAINT store_order_completed_has_timestamp CHECK (
    status <> 'completed' OR fulfilled_at IS NOT NULL
  )
);

COMMENT ON TABLE public.store_orders IS
  'Merch orders. Payment is recorded off-app by an admin at confirmation; nothing here charges a card.';
COMMENT ON COLUMN public.store_orders.admin_notes IS
  'ADMIN-ONLY. Must be omitted by explicit column list on any customer-facing read — RLS cannot filter columns. V1 leaked this to order owners.';
COMMENT ON CONSTRAINT store_order_completed_has_timestamp ON public.store_orders IS
  'Requires the timestamp and NEVER fulfilled_by: a SET NULL column inside a CHECK makes the referenced admin undeletable.';

CREATE INDEX store_orders_user_idx ON public.store_orders (user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX store_orders_fulfilled_by_idx ON public.store_orders (fulfilled_by)
  WHERE fulfilled_by IS NOT NULL;
-- The admin fulfilment queue: undispatched orders, oldest first.
CREATE INDEX store_orders_queue_idx ON public.store_orders (created_at)
  WHERE status IN ('pending', 'confirmed', 'in_progress');
CREATE INDEX store_orders_recent_idx ON public.store_orders (created_at DESC);

CREATE TRIGGER store_orders_updated_at
  BEFORE UPDATE ON public.store_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_orders FORCE ROW LEVEL SECURITY;

-- No anon grant, and no `user_id IS NULL` insert policy. V1 allowed anon-shaped
-- inserts with `user_id IS NULL`, which its SELECT policy (`user_id =
-- auth.uid()`) could never match — guests could create orders they could never
-- see. V2 routes every guest order through the server-side client instead, so
-- the guest path is deliberate rather than an accident of two mismatched
-- policies. No UPDATE for the buyer: an order is amended by talking to someone.
GRANT SELECT, INSERT ON public.store_orders TO authenticated;
GRANT UPDATE ON public.store_orders TO authenticated;

CREATE POLICY store_orders_select_own ON public.store_orders
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY store_orders_select_admin ON public.store_orders
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY store_orders_insert_own ON public.store_orders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- UPDATE is admin-only: the fulfilment workflow. The grant above exists so this
-- policy is reachable; the buyer has no UPDATE policy at all.
CREATE POLICY store_orders_update_admin ON public.store_orders
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
