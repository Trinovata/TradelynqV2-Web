-- ============================================================================
-- tool_credit_accounts, tool_credit_ledger, tool_credit_bundles (playbook S039)
--
-- Tool credits are money that has already been paid for. Every AI action on the
-- platform spends them, and a professional who could mint them gets the AI for
-- free while the provider bill arrives anyway.
--
-- ## The shape: the LEDGER is the truth, the balance is derived
--
-- `tool_credit_accounts.balance` is never written by hand — not by the app, not
-- by an admin, not by the deduction function directly. Every movement is a
-- ledger row, and an AFTER INSERT trigger on the ledger moves the balance. This
-- is the same pattern as `customer_profiles.connection_count` and
-- `professional_profiles.average_rating`, and it buys three things:
--
--   1. The balance is always explicable. "Why do I have 137?" is answered by a
--      list, not by a number nobody can account for.
--   2. The column guard can use the `pg_trigger_depth() > 1` bypass, so the
--      platform's own write passes while every client write is refused.
--   3. `SUM(delta)` is an independent recomputation, so drift is detectable.
--
-- ## What went wrong in V1, corrected here
--
--   * V1's Enterprise plan encoded "unlimited" as `tool_credits_monthly = -1`,
--     and `deduct_tool_credits` did plain arithmetic on it. A -1 allowance made
--     `available` negative, so **every Enterprise deduction failed with
--     insufficient_credits** — the top tier was the only one that could not use
--     the tools it paid most for. V2 has an explicit `unlimited` boolean and an
--     explicit branch.
--   * V1's function was SECURITY DEFINER with **no `SET search_path`** — a
--     privilege-escalation primitive, and something the invariant suite now
--     fails on.
--   * V1's function had **no ownership check**. Any authenticated caller could
--     pass another professional's user id and drain their credits.
--   * V1 stored bundle prices in cents in one migration and whole dollars in
--     another. V2 is whole TTD everywhere, with the unit in the column name.
-- ============================================================================

-- ============================================================================
-- tool_credit_bundles
-- ============================================================================

CREATE TABLE public.tool_credit_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stable machine key. The API pack names the bundles b100 / b300 / b1000, and
  -- a checkout link that referenced a UUID would break if the row were reseeded.
  code TEXT NOT NULL UNIQUE,

  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  -- Whole TTD. V1 had 15000-means-$150 in one migration and 150-means-$150 in
  -- another; the suffix makes the unit unmistakable.
  price_ttd INTEGER NOT NULL,

  stripe_price_id TEXT,
  wipay_product_ref TEXT,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 99,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A zero-credit or free bundle is a data-entry slip that gives away credits.
  CONSTRAINT bundle_credits_positive CHECK (credits > 0),
  CONSTRAINT bundle_price_positive CHECK (price_ttd > 0),
  CONSTRAINT bundle_code_shape CHECK (code ~ '^[a-z0-9_]+$')
);

COMMENT ON TABLE public.tool_credit_bundles IS
  'Purchasable credit packs, mirroring CREDIT_BUNDLES in lib/constants/pricing.ts. Prices are whole TTD.';
COMMENT ON COLUMN public.tool_credit_bundles.code IS
  'Stable key used in checkout links and the API. A UUID here would break every link on a reseed.';

CREATE INDEX tool_credit_bundles_order_idx ON public.tool_credit_bundles (display_order)
  WHERE is_active;

CREATE TRIGGER tool_credit_bundles_updated_at
  BEFORE UPDATE ON public.tool_credit_bundles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.tool_credit_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_credit_bundles FORCE ROW LEVEL SECURITY;

-- anon reads: the credits explainer is linked from public pricing copy.
GRANT SELECT ON public.tool_credit_bundles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tool_credit_bundles TO authenticated;

CREATE POLICY tool_credit_bundles_select_public ON public.tool_credit_bundles
  FOR SELECT TO anon, authenticated
  USING (is_active);

CREATE POLICY tool_credit_bundles_select_admin ON public.tool_credit_bundles
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY tool_credit_bundles_write_admin ON public.tool_credit_bundles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Seed: CREDIT_BUNDLES from pricing v3.1 ──────────────────────────────────
-- 100 credits / TTD $150 · 300 / $400 · 1,000 / $1,000. The unit cost falls as
-- the bundle grows (1.50 → 1.33 → 1.00), which is what `creditUnitCost` renders
-- as the "better value" hint.

INSERT INTO public.tool_credit_bundles (code, name, credits, price_ttd, display_order)
VALUES
  ('b100',  '100 credits',   100,  150, 1),
  ('b300',  '300 credits',   300,  400, 2),
  ('b1000', '1,000 credits', 1000, 1000, 3);

-- ============================================================================
-- tool_credit_accounts
-- ============================================================================

CREATE TABLE public.tool_credit_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- UNIQUE: one account per professional. Two accounts is two balances, and
  -- the deduction function would lock and spend an arbitrary one of them.
  professional_id UUID NOT NULL UNIQUE
    REFERENCES public.professional_profiles(id) ON DELETE CASCADE,

  -- DERIVED. Maintained solely by the AFTER INSERT trigger on the ledger.
  -- The CHECK is the last line of defence: even if every other control failed,
  -- the database refuses to record a negative balance.
  balance INTEGER NOT NULL DEFAULT 0,

  -- The tier's monthly allowance, copied from subscription_plans at grant time
  -- so a mid-cycle tier change cannot retroactively alter the cycle in progress.
  monthly_allowance INTEGER NOT NULL DEFAULT 0,
  -- Spent since the cycle opened. Powers `allowance_used` in the balance API
  -- without an aggregate over the whole ledger on every request.
  spent_this_cycle INTEGER NOT NULL DEFAULT 0,
  cycle_reset_at TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', NOW()) + INTERVAL '1 month'),

  -- Enterprise. An explicit flag, NOT a sentinel allowance — V1 used -1 and
  -- the arithmetic silently blocked every Enterprise deduction.
  unlimited BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT credit_balance_non_negative CHECK (balance >= 0),
  CONSTRAINT credit_allowance_non_negative CHECK (monthly_allowance >= 0),
  CONSTRAINT credit_spent_non_negative CHECK (spent_this_cycle >= 0)
);

COMMENT ON TABLE public.tool_credit_accounts IS
  'One credit account per professional. `balance` is DERIVED from tool_credit_ledger by trigger and is unwritable by any client.';
COMMENT ON COLUMN public.tool_credit_accounts.balance IS
  'Trigger-maintained from the ledger. Reconcilable at any time as SUM(delta) over the account''s ledger rows.';
COMMENT ON COLUMN public.tool_credit_accounts.unlimited IS
  'Enterprise. An explicit branch, not a sentinel — V1 encoded unlimited as -1 and every Enterprise deduction failed.';
COMMENT ON CONSTRAINT credit_balance_non_negative ON public.tool_credit_accounts IS
  'Last line of defence. Credits cannot go negative even if the deduction function is bypassed entirely.';

CREATE INDEX tool_credit_accounts_professional_idx
  ON public.tool_credit_accounts (professional_id);
-- The monthly allowance-grant cron reads accounts whose cycle has rolled over.
CREATE INDEX tool_credit_accounts_cycle_idx ON public.tool_credit_accounts (cycle_reset_at);

CREATE TRIGGER tool_credit_accounts_updated_at
  BEFORE UPDATE ON public.tool_credit_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- tool_credit_ledger — append-only
-- ============================================================================

CREATE TABLE public.tool_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  account_id UUID NOT NULL
    REFERENCES public.tool_credit_accounts(id) ON DELETE CASCADE,

  -- Signed. Negative spends, positive grants and purchases.
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,

  -- What was spent on, for the history view. Free text rather than an enum: the
  -- tool roster changes faster than a migration cadence should.
  tool_name TEXT,
  bundle_id UUID REFERENCES public.tool_credit_bundles(id) ON DELETE SET NULL,
  -- The entity the spend related to (an enquiry being replied to, an invoice).
  reference_id UUID,

  -- The balance immediately after this row was applied, captured under the row
  -- lock the deduction function holds. Makes the history renderable without
  -- replaying the whole ledger, and makes drift detectable by comparison.
  balance_after INTEGER NOT NULL,

  note TEXT,

  -- No updated_at: there are no updates.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ledger_reason_known CHECK (
    reason IN ('monthly_grant', 'bundle_purchase', 'tool_use',
               'refund', 'admin_adjust', 'cycle_expiry')
  ),
  -- Sign discipline. A 'tool_use' with a positive delta is a spend that pays
  -- you, and a 'bundle_purchase' with a negative one is a purchase that costs
  -- you credits. Both are typos that no amount of code review reliably catches.
  -- 'admin_adjust' is the one reason permitted either sign — it exists to
  -- correct mistakes in both directions.
  CONSTRAINT ledger_delta_sign_matches_reason CHECK (
    CASE reason
      WHEN 'monthly_grant'   THEN delta >= 0
      WHEN 'bundle_purchase' THEN delta > 0
      WHEN 'refund'          THEN delta > 0
      WHEN 'tool_use'        THEN delta <= 0
      WHEN 'cycle_expiry'    THEN delta <= 0
      ELSE TRUE
    END
  ),
  CONSTRAINT ledger_balance_after_non_negative CHECK (balance_after >= 0),
  CONSTRAINT ledger_purchase_names_bundle CHECK (
    reason <> 'bundle_purchase' OR bundle_id IS NOT NULL
  ),
  CONSTRAINT ledger_tool_use_names_tool CHECK (
    reason <> 'tool_use' OR tool_name IS NOT NULL
  )
);

COMMENT ON TABLE public.tool_credit_ledger IS
  'Append-only record of every credit movement. The source of truth; tool_credit_accounts.balance is derived from it.';
COMMENT ON COLUMN public.tool_credit_ledger.balance_after IS
  'Captured under the deduction function''s row lock. Lets the history render without replaying the ledger, and makes drift visible.';

CREATE INDEX tool_credit_ledger_account_idx
  ON public.tool_credit_ledger (account_id, created_at DESC);
CREATE INDEX tool_credit_ledger_bundle_idx ON public.tool_credit_ledger (bundle_id)
  WHERE bundle_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reject_credit_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Cascades (a deleted account, a removed bundle) arrive at depth > 1.
  -- Refusing them would make the account undeletable.
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  RAISE EXCEPTION 'The credit ledger is append-only. Record a correcting entry instead.'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER tool_credit_ledger_reject_update
  BEFORE UPDATE ON public.tool_credit_ledger
  FOR EACH ROW EXECUTE FUNCTION public.reject_credit_ledger_mutation();

CREATE TRIGGER tool_credit_ledger_reject_delete
  BEFORE DELETE ON public.tool_credit_ledger
  FOR EACH ROW EXECUTE FUNCTION public.reject_credit_ledger_mutation();

COMMENT ON FUNCTION public.reject_credit_ledger_mutation() IS
  'Hard-stops direct UPDATE and DELETE on the ledger for every role including service-role. Cascades (depth > 1) pass.';

-- ── The balance, applied ────────────────────────────────────────────────────
--
-- `balance = balance + NEW.delta` inside an UPDATE is atomic under read
-- committed: the row is locked and re-read for the arithmetic, so two
-- concurrent ledger inserts cannot both apply to the same stale value. The
-- deduction function additionally holds the row lock from its own SELECT … FOR
-- UPDATE, which is what makes the *decision* to spend (not just the arithmetic)
-- serialised.
--
-- `spent_this_cycle` moves only on negative deltas — a refund should restore
-- the balance without pretending the spend never happened in the allowance
-- accounting.

CREATE OR REPLACE FUNCTION public.apply_credit_ledger_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.tool_credit_accounts
     SET balance = balance + NEW.delta,
         spent_this_cycle = spent_this_cycle
           + CASE WHEN NEW.delta < 0 THEN -NEW.delta ELSE 0 END
   WHERE id = NEW.account_id;

  RETURN NULL;  -- AFTER trigger
END;
$$;

CREATE TRIGGER tool_credit_ledger_apply
  AFTER INSERT ON public.tool_credit_ledger
  FOR EACH ROW EXECUTE FUNCTION public.apply_credit_ledger_entry();

COMMENT ON FUNCTION public.apply_credit_ledger_entry() IS
  'The only writer of tool_credit_accounts.balance. Runs at trigger depth > 1, which is how it passes the account column guard.';

-- ============================================================================
-- The column guard
-- ============================================================================
--
-- Blocks a professional writing their own balance. Note this guard fires for
-- ADMINS too on the derived columns — deliberately. An admin correcting someone
-- who was wrongly charged should insert an `admin_adjust` ledger row, which
-- leaves a record of the correction. An admin who edited the balance directly
-- would leave a number nobody can account for, which is the exact failure the
-- ledger exists to prevent.

CREATE OR REPLACE FUNCTION public.guard_credit_account_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- The ledger's apply trigger, and FK cascades. Client statements are depth 1.
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Derived. Nobody writes these directly, not even the service role or an
  -- admin — the ledger does, or nothing does.
  IF NEW.balance IS DISTINCT FROM OLD.balance
     OR NEW.spent_this_cycle IS DISTINCT FROM OLD.spent_this_cycle THEN
    RAISE EXCEPTION 'Credit balances are derived from the ledger. Record a ledger entry instead.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF (SELECT auth.uid()) IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Entitlement columns. `unlimited` is the Enterprise tier in one boolean;
  -- `monthly_allowance` is how many credits arrive each month for free.
  IF NEW.unlimited IS DISTINCT FROM OLD.unlimited
     OR NEW.monthly_allowance IS DISTINCT FROM OLD.monthly_allowance
     OR NEW.cycle_reset_at IS DISTINCT FROM OLD.cycle_reset_at
     OR NEW.professional_id IS DISTINCT FROM OLD.professional_id THEN
    RAISE EXCEPTION 'Credit entitlements follow your subscription tier.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tool_credit_accounts_guard_columns
  BEFORE UPDATE ON public.tool_credit_accounts
  FOR EACH ROW EXECUTE FUNCTION public.guard_credit_account_columns();

COMMENT ON FUNCTION public.guard_credit_account_columns() IS
  'balance and spent_this_cycle are unwritable by EVERY role including admin — corrections go through an admin_adjust ledger row. Tier entitlements are additionally admin-only.';

-- ============================================================================
-- deduct_tool_credits — the atomic spend
-- ============================================================================
--
-- ## Why SELECT … FOR UPDATE, and what it actually prevents
--
-- The dangerous sequence is not the arithmetic; it is the DECISION. Two
-- concurrent AI requests from the same professional with 1 credit left both
-- read `balance = 1`, both conclude "sufficient", and both spend. The second
-- deduction is a credit that was never paid for, and at scale it is the
-- provider bill growing faster than revenue.
--
-- `FOR UPDATE` takes an exclusive lock on the account row. The second
-- transaction blocks at the SELECT — not at the UPDATE — so it cannot reach its
-- sufficiency check until the first has committed, at which point it reads the
-- balance the first left behind and correctly refuses. The window between
-- "check" and "spend" is closed because the check itself is serialised.
--
-- The `balance >= 0` CHECK on the account is the independent second control: if
-- this function were bypassed entirely, the database still refuses to go
-- negative. Two controls, because one control on money is a single point of
-- failure.
--
-- ## Returns
--
--   { ok: true,  balance_after, unlimited }
--   { ok: false, error: 'no_account' | 'insufficient_credits' | 'invalid_amount'
--                | 'forbidden', balance }
--
-- A JSONB result rather than an exception for the ordinary "not enough credits"
-- case, because that is a 403 the API renders as a purchase prompt, not an
-- error anyone needs a stack trace for.

CREATE OR REPLACE FUNCTION public.deduct_tool_credits(
  p_professional_id UUID,
  p_amount INTEGER,
  p_tool_name TEXT,
  p_reference_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
-- SECURITY DEFINER because the caller cannot write the ledger directly. That
-- makes the ownership check below mandatory rather than defensive: without it
-- this function is an API for draining a competitor's credits, which is exactly
-- what V1's version was.
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_account public.tool_credit_accounts%ROWTYPE;
  v_caller UUID := (SELECT auth.uid());
  v_balance_after INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_amount');
  END IF;

  -- Ownership. A NULL caller is the service role (cron, server route); an admin
  -- may spend on someone's behalf when supporting them. Everyone else may spend
  -- only their own credits.
  IF v_caller IS NOT NULL
     AND NOT public.is_admin()
     AND NOT public.owns_professional_profile(p_professional_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- THE LOCK. Everything below this line is serialised per account.
  SELECT * INTO v_account
    FROM public.tool_credit_accounts
   WHERE professional_id = p_professional_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_account');
  END IF;

  -- Enterprise. Still ledgered, at delta 0, so usage stays auditable and the
  -- history view is complete — "unlimited" must not mean "unrecorded".
  IF v_account.unlimited THEN
    INSERT INTO public.tool_credit_ledger
      (account_id, delta, reason, tool_name, reference_id, balance_after, note)
    VALUES
      (v_account.id, 0, 'tool_use', p_tool_name, p_reference_id, v_account.balance,
       format('unlimited tier — %s credits not charged', p_amount));

    RETURN jsonb_build_object(
      'ok', true, 'unlimited', true, 'balance_after', v_account.balance
    );
  END IF;

  IF v_account.balance < p_amount THEN
    RETURN jsonb_build_object(
      'ok', false, 'error', 'insufficient_credits',
      'balance', v_account.balance, 'required', p_amount
    );
  END IF;

  v_balance_after := v_account.balance - p_amount;

  -- The ledger row is the write. Its AFTER INSERT trigger moves the balance —
  -- this function never touches the balance column, which is what lets the
  -- account guard refuse every direct write without exception.
  INSERT INTO public.tool_credit_ledger
    (account_id, delta, reason, tool_name, reference_id, balance_after)
  VALUES
    (v_account.id, -p_amount, 'tool_use', p_tool_name, p_reference_id, v_balance_after);

  RETURN jsonb_build_object(
    'ok', true, 'unlimited', false, 'balance_after', v_balance_after
  );
END;
$$;

COMMENT ON FUNCTION public.deduct_tool_credits(UUID, INTEGER, TEXT, UUID) IS
  'Atomic credit spend. SELECT … FOR UPDATE serialises the sufficiency CHECK, not just the arithmetic — that is what stops two concurrent calls double-spending. Ownership-checked: V1''s version let anyone drain any account.';

-- Callable as an RPC by the app; the ownership check inside is what makes that
-- safe. anon is not granted: spending credits requires knowing whose they are.
GRANT EXECUTE ON FUNCTION public.deduct_tool_credits(UUID, INTEGER, TEXT, UUID)
  TO authenticated;

-- ============================================================================
-- RLS — accounts and ledger
-- ============================================================================

ALTER TABLE public.tool_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_credit_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tool_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_credit_ledger FORCE ROW LEVEL SECURITY;

-- No anon on either. No INSERT on accounts: an account is provisioned by the
-- subscription path, and a self-inserted one with a nonzero allowance is free
-- credits. UPDATE is granted so the guard is the thing that refuses a balance
-- write — a refusal that names the rule beats a silent "0 rows affected".
GRANT SELECT, UPDATE ON public.tool_credit_accounts TO authenticated;
-- SELECT only on the ledger. Every legitimate insert comes through
-- deduct_tool_credits or a server-side purchase/grant path.
GRANT SELECT ON public.tool_credit_ledger TO authenticated;

CREATE POLICY tool_credit_accounts_select_own ON public.tool_credit_accounts
  FOR SELECT TO authenticated
  USING (public.owns_professional_profile(professional_id));

CREATE POLICY tool_credit_accounts_select_admin ON public.tool_credit_accounts
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY tool_credit_accounts_update_own ON public.tool_credit_accounts
  FOR UPDATE TO authenticated
  USING (public.owns_professional_profile(professional_id))
  WITH CHECK (public.owns_professional_profile(professional_id));

CREATE POLICY tool_credit_accounts_update_admin ON public.tool_credit_accounts
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY tool_credit_ledger_select_own ON public.tool_credit_ledger
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tool_credit_accounts a
     WHERE a.id = account_id
       AND public.owns_professional_profile(a.professional_id)
  ));

CREATE POLICY tool_credit_ledger_select_admin ON public.tool_credit_ledger
  FOR SELECT TO authenticated
  USING (public.is_admin());
