'use server'

/**
 * Catalogue pagination action (playbook S086). A thin server-action seam over
 * the read module so the client shell can cursor through the feed without a
 * bespoke API route — the same trust posture as an RSC render, since the
 * action runs the identical RLS-client read.
 */
import { getCataloguePage, type CataloguePage } from '@/lib/marketplace/catalogue'

export async function loadCataloguePage(options: {
  cursor?: string
  category?: string
}): Promise<CataloguePage> {
  return getCataloguePage(options)
}
