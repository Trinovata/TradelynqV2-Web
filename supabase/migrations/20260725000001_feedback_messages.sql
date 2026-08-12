-- ============================================================================
-- feedback_messages — the /feedback form's destination (playbook S089,
-- deck §11.5).
--
-- Feedback is deliberately open to signed-out visitors, and harden_grants'
-- schema-wide invariant says anon NEVER writes tables directly — so the write
-- path is a SECURITY DEFINER RPC, the same shape S044 chose for referral
-- clicks. The RPC validates length server-side (the route's zod is the
-- friendly layer, this is the boundary), captures the caller's user id when
-- one exists, and returns nothing an attacker can enumerate.
--
-- Reads are admin-tooling-only until an admin surface exists (S127): no
-- SELECT for either client role — a feedback inbox readable by the public
-- would leak reporters' emails.
-- ============================================================================

CREATE TABLE public.feedback_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Optional self-identification (deck: both fields optional).
  name TEXT,
  email TEXT,
  message TEXT NOT NULL,

  -- The session, when there was one — never trusted from the body.
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT feedback_message_not_blank CHECK (length(trim(message)) > 0),
  CONSTRAINT feedback_message_bounded CHECK (length(message) <= 5000),
  CONSTRAINT feedback_name_bounded CHECK (name IS NULL OR length(name) <= 200),
  CONSTRAINT feedback_email_bounded CHECK (email IS NULL OR length(email) <= 320)
);

ALTER TABLE public.feedback_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_messages FORCE ROW LEVEL SECURITY;

CREATE INDEX feedback_messages_user_idx ON public.feedback_messages (user_id);
CREATE INDEX feedback_messages_created_idx ON public.feedback_messages (created_at DESC);

-- No table grants to either client role: writes go through the RPC below,
-- reads wait for the admin surface (service role bypasses RLS and grants).
REVOKE ALL ON public.feedback_messages FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_feedback(
  p_message TEXT,
  p_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_message IS NULL OR length(trim(p_message)) = 0 THEN
    RAISE EXCEPTION 'feedback message required' USING ERRCODE = 'check_violation';
  END IF;
  IF length(p_message) > 5000 THEN
    RAISE EXCEPTION 'feedback message too long' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.feedback_messages (message, name, email, user_id)
  VALUES (
    trim(p_message),
    NULLIF(trim(COALESCE(p_name, '')), ''),
    NULLIF(trim(COALESCE(p_email, '')), ''),
    auth.uid()
  );
END;
$$;

-- New functions are PUBLIC-executable by default; revoke first, then grant.
REVOKE ALL ON FUNCTION public.submit_feedback(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_feedback(TEXT, TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.submit_feedback(TEXT, TEXT, TEXT) IS
  'The /feedback form write path. SECURITY DEFINER because anon never writes tables directly (harden_grants invariant); rate-limited at the API route.';
