-- ============================================================================
-- Storage buckets and their policies (playbook S045)
--
-- Two buckets with opposite postures, and the difference is the whole design:
--
--   professional-assets  PUBLIC read.  Portfolio images, avatars, catalogue
--                        posts. These are marketing — they must render on a
--                        storefront to a signed-out visitor, or the marketplace
--                        has no shop window.
--
--   kyc-documents        PRIVATE, always. Identity documents, selfies, proof of
--                        address. No public read under any circumstance; access
--                        is by short-lived signed URL issued to an admin, and
--                        every issuance is audited.
--
-- Storage RLS works on storage.objects, where the path is the security boundary:
-- every object lives under `{userId}/…`, and policies compare the first path
-- segment to auth.uid(). Get that comparison wrong and every user can read every
-- other user's uploads.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'professional-assets',
    'professional-assets',
    TRUE,
    8388608,  -- 8 MB. Clients compress to ~1 MB before upload; this is the ceiling.
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  ),
  (
    'kyc-documents',
    'kyc-documents',
    FALSE,
    10485760,  -- 10 MB. Phone camera output, uncompressed.
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
ON CONFLICT (id) DO NOTHING;

-- MIME allow-lists are a first line, not the defence. A client sets the
-- Content-Type header, so it is a claim rather than a fact. Magic-byte sniffing
-- and re-encoding happen in the upload route (playbook S150).

-- ============================================================================
-- professional-assets — public read, owner write
-- ============================================================================

CREATE POLICY "professional assets are publicly readable"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'professional-assets');

-- The path's first segment must be the uploader's own id. `storage.foldername()`
-- returns the path split into segments; [1] is the first.
--
-- Without this check any authenticated user could write into another
-- professional's folder and replace their portfolio.
CREATE POLICY "professionals upload to their own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'professional-assets'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "professionals update their own assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'professional-assets'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "professionals delete their own assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'professional-assets'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- ============================================================================
-- kyc-documents — private, no public path at all
-- ============================================================================

-- A customer may upload their own documents, and read back what they uploaded
-- (so the UI can show "you submitted this" rather than an empty box).
CREATE POLICY "customers upload their own kyc documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "customers read their own kyc documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- Admins read everything in this bucket — reviewing the documents is the job.
CREATE POLICY "admins read all kyc documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'kyc-documents' AND public.is_admin());

-- Deliberately NO update or delete policy for customers on this bucket.
--
-- A submitted identity document is evidence in a verification decision. Letting
-- the subject replace it after submission would mean the document an admin
-- approved is not necessarily the document on file. Resubmission after rejection
-- writes a NEW path; it never overwrites.
--
-- Deliberately NO anon policy of any kind. There is no signed-out path to this
-- bucket, not even a failing one.

-- NOTE (deliberately a comment, not COMMENT ON): storage.objects is owned by
-- the storage system role, and `postgres` cannot comment on a table it does not
-- own — the statement fails the whole migration with "must be owner of table
-- objects". The same restriction is why these policies attach to the existing
-- table rather than altering it.
--
-- The rule worth remembering: in storage, THE PATH IS THE SECURITY BOUNDARY.
-- Objects live under `{userId}/…` and every policy compares
-- `(storage.foldername(name))[1]` to `auth.uid()`. Get that comparison wrong and
-- every user can read every other user's uploads.
