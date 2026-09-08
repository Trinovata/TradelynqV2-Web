'use client'

/**
 * Client-side upload handling for onboarding (playbook S107).
 *
 * Two destinations with opposite postures, matching the two buckets defined in
 * `20260719000018_storage.sql`:
 *
 *   `professional-assets`  PUBLIC. Profile photo and portfolio shots. These are
 *                          marketing and must render to a signed-out visitor.
 *
 *   `kyc-documents`        PRIVATE. Proof of enrolment, Certificate of
 *                          Incorporation. Never publicly readable.
 *
 * They are separate exported functions rather than one function with a folder
 * argument, because the previous single function sent credentials to the public
 * bucket and returned `getPublicUrl()` for them — putting a Certificate of
 * Incorporation at a world-readable URL. A shared enum made that a one-word
 * mistake; separate functions make the destination impossible to get wrong at
 * the call site.
 *
 * ## Why compression applies only to the public images
 *
 * The public bucket's ceiling is 8 MB and a modern phone camera clears that on a
 * single portrait. Downscaling to 1600px at quality 0.82 takes a 6 MB photo to
 * roughly 300 KB with no visible loss at storefront sizes. Re-encoding through a
 * canvas has a second effect worth naming: it strips EXIF, which is where the
 * GPS coordinates of a professional's home would otherwise be, on a photo they
 * are about to make public.
 *
 * Credential documents are deliberately NOT downscaled. The point of the file is
 * that a human can read a registration number off it, and 1600px of a dense A4
 * certificate is not reliably legible. The private bucket allows 10 MB, which
 * fits an uncompressed phone photo, and the EXIF argument does not apply the
 * same way: the file is visible only to the uploader and to an admin, never to
 * the public.
 */
import { createClient } from '@/lib/supabase/client'

const PUBLIC_BUCKET = 'professional-assets'
const PRIVATE_BUCKET = 'kyc-documents'
const MAX_EDGE = 1600
const QUALITY = 0.82

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

/**
 * What a credential document may be. PDF is first because a Certificate of
 * Incorporation almost always arrives as one — the image-only list this
 * replaced rejected the single most common case for the feature's own stated
 * purpose. Mirrors the bucket's `allowed_mime_types`.
 */
export const ACCEPTED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]

/** Pre-compression ceiling. The deck's message is "Photos must be under 10 MB." */
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024

export type UploadResult = { ok: true; url: string } | { ok: false; message: string }

/**
 * A credential upload returns a storage PATH, not a URL. The bucket is private,
 * so there is no public URL to return — a viewable link is a short-lived signed
 * URL minted later, by an admin's own client, at the moment of review.
 */
export type DocumentUploadResult =
  | { ok: true; path: string }
  | { ok: false; message: string }

/** Downscale + re-encode. Returns the original if the browser cannot decode it. */
async function compress(file: File): Promise<Blob> {
  // `createImageBitmap` decodes off the main thread, so a large photo does not
  // freeze the form while it is being read.
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    return file
  }
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY)
  )
  return blob ?? file
}

/** File extension for a document, from its declared type. */
function documentExtension(type: string): string {
  if (type === 'application/pdf') return 'pdf'
  if (type === 'image/png') return 'png'
  if (type === 'image/webp') return 'webp'
  return 'jpg'
}

/**
 * Uploads one public image and returns its public URL.
 *
 * The path's first segment is the uploader's own user id, which is what the
 * storage policy checks — `(storage.foldername(name))[1] = auth.uid()`. Passing
 * the id in rather than re-reading the session keeps this a pure function of
 * its arguments and makes the folder rule visible at the call site.
 */
export async function uploadProfessionalImage(
  file: File,
  userId: string,
  folder: 'profile' | 'portfolio'
): Promise<UploadResult> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, message: 'Use a JPG, PNG or WebP.' }
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return { ok: false, message: 'Photos must be under 10 MB.' }
  }

  const body = await compress(file)
  const supabase = createClient()
  // `crypto.randomUUID` rather than the filename: two photos called IMG_0001
  // from the same phone must not overwrite each other, and a user-supplied
  // filename is user-supplied input in a path.
  const path = `${userId}/${folder}/${crypto.randomUUID()}.jpg`

  const { error } = await supabase.storage.from(PUBLIC_BUCKET).upload(path, body, {
    contentType: body.type || 'image/jpeg',
    upsert: false,
  })

  if (error) {
    return { ok: false, message: 'That didn’t upload. Check your connection and try again.' }
  }

  const { data } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path)
  return { ok: true, url: data.publicUrl }
}

/**
 * Uploads one credential document to the private bucket and returns its path.
 *
 * Same `{userId}/…` path convention as the public bucket, checked by the same
 * kind of policy — `customers upload their own kyc documents`. Uploaded as-is:
 * no downscale, no re-encode, so what an admin reviews is the file the
 * professional actually submitted.
 */
export async function uploadCredentialDocument(
  file: File,
  userId: string
): Promise<DocumentUploadResult> {
  if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type)) {
    return { ok: false, message: 'Use a PDF, JPG, PNG or WebP.' }
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return { ok: false, message: 'Documents must be under 10 MB.' }
  }

  const supabase = createClient()
  const path = `${userId}/credentials/${crypto.randomUUID()}.${documentExtension(file.type)}`

  const { error } = await supabase.storage.from(PRIVATE_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })

  if (error) {
    return { ok: false, message: 'That didn’t upload. Check your connection and try again.' }
  }

  // Deliberately no `getPublicUrl` here. The bucket is private; that call would
  // return a URL shaped like a working one that resolves to a 400 — the exact
  // failure that hides a broken verification flow until an admin tries to open
  // a document.
  return { ok: true, path }
}
