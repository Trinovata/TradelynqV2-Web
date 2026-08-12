-- ============================================================================
-- INSERT-side column guards (SECURITY — closes a whole class of RLS holes)
--
-- ## The problem
--
-- Every trust-bearing table (reviews, professional_profiles, catalogue_posts,
-- job_enquiries, quotes, jobs, invoices) relies on a BEFORE **UPDATE** trigger to
-- stop a caller writing privileged columns — self-moderating a review,
-- self-verifying a profile, self-featuring a post, self-completing an enquiry,
-- marking an invoice paid. Those guards compare NEW to OLD, so they cannot run on
-- INSERT (there is no OLD), and none of them were attached FOR INSERT.
--
-- But `authenticated` holds a table-wide GRANT INSERT and PostgREST exposes these
-- tables directly. The INSERT policies only check ownership of ONE key column
-- (customer_id / user_id / posted_by = auth.uid()); every other column is
-- unconstrained at insert time. So a caller could POST a row with
-- status='approved', is_seeded=true, verification_status='verified',
-- average_rating=5, is_featured=true, paid_at=now(), … and the UPDATE guard never
-- fired. Reviews and profiles were the two CRITICAL cases (review-bombing any
-- professional; self-verifying a 5-star listing into public search).
--
-- ## The fix
--
-- One BEFORE INSERT guard per table that, for an authenticated non-admin caller
-- at trigger depth 1, OVERWRITES the privileged columns back to their safe
-- initial values — regardless of what was submitted. The submitted row is not
-- rejected (legitimate creates still succeed); it is merely stripped of the
-- privileges it was never allowed to grant itself. The safe values mirror each
-- table's column DEFAULTs and the exact columns its UPDATE guard already
-- protects, so the two guards agree on what "privileged" means.
--
-- Service role (auth.uid() IS NULL — seeding, admin tooling) and admins bypass,
-- exactly as the UPDATE guards do. Platform triggers run at depth > 1 and bypass.
-- Each function is SECURITY DEFINER with a pinned empty search_path and PUBLIC
-- execute revoked, per the schema-invariant suite.
-- ============================================================================

-- ── reviews (CRITICAL: self-moderation / review-bombing) ─────────────────────
CREATE OR REPLACE FUNCTION public.guard_review_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR public.is_admin() OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  -- A submitted review is unmoderated by definition; moderation is admin-only.
  NEW.status := 'pending';
  NEW.is_seeded := FALSE;
  NEW.moderated_at := NULL;
  NEW.moderated_by := NULL;
  NEW.rejection_reason := NULL;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.guard_review_insert() IS
  'Forces a submitted review to unmoderated (status=pending, not seeded) so it cannot be self-published or self-vouched. Pairs with guard_review_columns (UPDATE).';
REVOKE ALL ON FUNCTION public.guard_review_insert() FROM PUBLIC;
CREATE TRIGGER reviews_guard_insert
  BEFORE INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.guard_review_insert();

-- ── professional_profiles (CRITICAL: self-verification / self-rating) ────────
CREATE OR REPLACE FUNCTION public.guard_professional_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR public.is_admin() OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  -- Trust is earned through the admin ladder, never self-asserted at creation.
  NEW.verification_status := 'not_started';
  NEW.national_id_verified := FALSE;
  NEW.national_id_verified_at := NULL;
  NEW.national_id_verified_by := NULL;
  NEW.insurance_verified_at := NULL;
  NEW.insurance_verified_by := NULL;
  -- Ratings are derived from moderated reviews.
  NEW.average_rating := NULL;
  NEW.review_count := 0;
  -- Publication is an admin decision; the profile starts as a draft.
  NEW.listing_status := 'draft';
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.guard_professional_insert() IS
  'Forces a new profile to unverified/unrated/draft so a professional cannot self-verify, self-rate, or self-publish into search. Pairs with guard_professional_privileged_columns (UPDATE).';
REVOKE ALL ON FUNCTION public.guard_professional_insert() FROM PUBLIC;
CREATE TRIGGER professional_profiles_guard_insert
  BEFORE INSERT ON public.professional_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_professional_insert();

-- ── job_enquiries (customer must not write the professional's case log) ──────
CREATE OR REPLACE FUNCTION public.guard_job_enquiry_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR public.is_admin() OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  -- The customer opens an enquiry; the outcome and the private case log belong
  -- to the professional and are set later, through the guarded UPDATE path.
  NEW.status := 'pending';
  NEW.accepted_at := NULL;
  NEW.completed_at := NULL;
  NEW.declined_reason := NULL;
  NEW.agreed_price_ttd := NULL;
  NEW.agreed_timeline := NULL;
  NEW.scope_note := NULL;
  NEW.professional_notes := NULL;
  NEW.conversation_outcome := NULL;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.guard_job_enquiry_insert() IS
  'Forces a new enquiry to pending with an empty case log so a customer cannot self-accept/complete or write the professional-private notes at creation. Pairs with guard_job_enquiry_columns (UPDATE).';
REVOKE ALL ON FUNCTION public.guard_job_enquiry_insert() FROM PUBLIC;
CREATE TRIGGER job_enquiries_guard_insert
  BEFORE INSERT ON public.job_enquiries
  FOR EACH ROW EXECUTE FUNCTION public.guard_job_enquiry_insert();

-- ── catalogue_posts (no self-featuring / faked popularity) ───────────────────
CREATE OR REPLACE FUNCTION public.guard_catalogue_post_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR public.is_admin() OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  -- Featuring and popularity are platform-assigned; a poster starts at zero.
  -- (is_approved keeps its auto-approve default; attribution is enforced by the
  -- write policy below, so a poster can only post to a profile they own or are
  -- connected to.)
  NEW.is_featured := FALSE;
  NEW.view_count := 0;
  NEW.save_count := 0;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.guard_catalogue_post_insert() IS
  'Zeroes featuring and popularity counters on a new post. Pairs with the write policy that enforces professional_id attribution.';
REVOKE ALL ON FUNCTION public.guard_catalogue_post_insert() FROM PUBLIC;
CREATE TRIGGER catalogue_posts_guard_insert
  BEFORE INSERT ON public.catalogue_posts
  FOR EACH ROW EXECUTE FUNCTION public.guard_catalogue_post_insert();

-- catalogue attribution: the FOR ALL write policy only checked posted_by, so a
-- caller could attribute a post to ANY professional_id. Require that the poster
-- either owns that professional profile or has a real connection to it.
DROP POLICY IF EXISTS catalogue_posts_write_own ON public.catalogue_posts;
CREATE POLICY catalogue_posts_write_own ON public.catalogue_posts
  FOR ALL TO authenticated
  USING (posted_by = (SELECT auth.uid()))
  WITH CHECK (
    posted_by = (SELECT auth.uid())
    AND (
      public.owns_professional_profile(professional_id)
      OR EXISTS (
        SELECT 1 FROM public.connections c
        WHERE c.customer_id = (SELECT auth.uid())
          AND c.professional_id = catalogue_posts.professional_id
      )
    )
  );

-- ── quotes (start as draft; response stamps are the customer's) ──────────────
CREATE OR REPLACE FUNCTION public.guard_quote_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR public.is_admin() OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  NEW.status := 'draft';
  NEW.sent_at := NULL;
  NEW.viewed_at := NULL;
  NEW.responded_at := NULL;
  NEW.response_note := NULL;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.guard_quote_insert() IS
  'Forces a new quote to draft with no send/response stamps. Pairs with guard_quote_columns (UPDATE).';
REVOKE ALL ON FUNCTION public.guard_quote_insert() FROM PUBLIC;
CREATE TRIGGER quotes_guard_insert
  BEFORE INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.guard_quote_insert();

-- ── jobs (start in 'enquiry'; lifecycle stamps set by transitions) ───────────
CREATE OR REPLACE FUNCTION public.guard_job_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR public.is_admin() OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  NEW.status := 'enquiry';
  NEW.accepted_at := NULL;
  NEW.in_progress_at := NULL;
  NEW.completed_at := NULL;
  NEW.invoiced_at := NULL;
  NEW.review_requested_at := NULL;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.guard_job_insert() IS
  'Forces a new job to the enquiry state with no lifecycle stamps. Pairs with jobs_enforce_status_transition (UPDATE).';
REVOKE ALL ON FUNCTION public.guard_job_insert() FROM PUBLIC;
CREATE TRIGGER jobs_guard_insert
  BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.guard_job_insert();

-- ── invoices (start as draft; never self-mark paid) ──────────────────────────
CREATE OR REPLACE FUNCTION public.guard_invoice_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR public.is_admin() OR pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  NEW.status := 'draft';
  NEW.sent_at := NULL;
  NEW.paid_at := NULL;
  NEW.viewed_at := NULL;
  NEW.acknowledged_at := NULL;
  NEW.reminder_count := 0;
  NEW.last_reminder_at := NULL;
  NEW.next_reminder_at := NULL;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.guard_invoice_insert() IS
  'Forces a new invoice to draft and unpaid with no reminder/response state so it cannot be self-marked paid at creation. Pairs with guard_invoice_columns (UPDATE). Does not touch invoice_number (assigned by invoices_assign_number).';
REVOKE ALL ON FUNCTION public.guard_invoice_insert() FROM PUBLIC;
CREATE TRIGGER invoices_guard_insert
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_insert();
