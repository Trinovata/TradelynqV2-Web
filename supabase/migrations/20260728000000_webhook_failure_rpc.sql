-- ============================================================================
-- Atomic webhook failure accounting (playbook S116, security audit 28 Jul 2026)
-- ============================================================================
--
-- The dispatcher previously advanced consecutive_failures with an application-
-- side read-modify-write: it read the count in the initial SELECT and wrote
-- count+1 in a later UPDATE. Every event dispatches independently via after(),
-- so deliveries to the same endpoint run concurrently — and that pattern both
-- loses increments (two failures each read N, both write N+1) and, worse, lets a
-- stale failure write land after a concurrent SUCCESS reset the streak to 0,
-- tripping the auto-disable on a healthy endpoint and silently stopping delivery.
--
-- This moves the increment into a single atomic statement evaluated under the row
-- lock — the same discipline as deduct_tool_credits. The success path stays a
-- plain absolute write (0 + timestamp): Postgres serialises row updates, so a
-- success and an atomic increment interleave correctly in either order.

CREATE OR REPLACE FUNCTION public.bump_webhook_failure(
  p_config_id UUID,
  p_threshold INTEGER DEFAULT 5
)
RETURNS INTEGER
LANGUAGE sql
SET search_path = ''
AS $$
  UPDATE public.webhook_configs
     SET consecutive_failures = consecutive_failures + 1,
         -- Auto-disable when the NEW streak reaches the threshold, and only if not
         -- already disabled (so the reason is stamped once). All RHS references to
         -- consecutive_failures read the OLD row value, so "+ 1" is the new count.
         disabled_at = CASE
           WHEN disabled_at IS NULL AND consecutive_failures + 1 >= p_threshold
           THEN NOW() ELSE disabled_at END,
         disabled_reason = CASE
           WHEN disabled_at IS NULL AND consecutive_failures + 1 >= p_threshold
           THEN 'Auto-disabled after ' || (consecutive_failures + 1)::text
                || ' consecutive delivery failures.'
           ELSE disabled_reason END
   WHERE id = p_config_id
  RETURNING consecutive_failures;
$$;

COMMENT ON FUNCTION public.bump_webhook_failure(UUID, INTEGER) IS
  'Atomically increments a webhook endpoint failure streak and auto-disables it at the threshold, under the row lock. Called by the dispatcher (service role) — replaces an app-side read-modify-write that lost updates and false-disabled healthy endpoints.';

-- Dispatcher-only. An owner must never advance or reset their own streak (the
-- guard trigger already blocks direct column writes; this keeps the RPC off the
-- authenticated role too). The dispatcher runs as service_role.
REVOKE ALL ON FUNCTION public.bump_webhook_failure(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_webhook_failure(UUID, INTEGER) TO service_role;
