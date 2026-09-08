'use client'

/**
 * Client-side image handling for onboarding uploads (playbook S107).
 *
 * Two jobs, in order: shrink the file, then put it in the professional's own
 * folder in the `professional-assets` bucket.
 *
 * ## Why compression is not optional
 *
 * The bucket's ceiling is 8 MB and a modern phone camera clears that on a
 * single portrait. Uploading raw would fail for exactly the professional the
 * spec cares most about — the one setting up one-handed on a phone, on mobile
 * data. Downscaling to 1600px and re-encoding at quality 0.82 takes a 6 MB
 * photo to roughly 300 KB with no visible loss at storefront sizes.
 *
 * Re-encoding through a canvas has a second effect worth naming: it strips EXIF,
 * which is where the GPS coordinates of a professional's home would otherwise
 * be, on a photo they are about to make public.
 */
import { createClient } from '@/lib/supabase/client'

const BUCKET = 'professional-assets'
const MAX_EDGE = 1600
const QUALITY = 0.82

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
/** Pre-compression ceiling. The deck's message is "Photos must be under 10 MB." */
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024

export type UploadResult = { ok: true; url: string } | { ok: false; message: string }

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

/**
 * Uploads one image and returns its public URL.
 *
 * The path's first segment is the uploader's own user id, which is what the
 * storage policy checks — `(storage.foldername(name))[1] = auth.uid()`. Passing
 * the id in rather than re-reading the session keeps this a pure function of
 * its arguments and makes the folder rule visible at the call site.
 */
export async function uploadProfessionalImage(
  file: File,
  userId: string,
  folder: 'profile' | 'portfolio' | 'credentials'
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

  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: body.type || 'image/jpeg',
    upsert: false,
  })

  if (error) {
    return { ok: false, message: 'That didn’t upload. Check your connection and try again.' }
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { ok: true, url: data.publicUrl }
}
