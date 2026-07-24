import { redirect } from 'next/navigation'

/**
 * /legal has a section layout but no landing of its own — it opens on the
 * Privacy Policy. This also gives Next's typed routes a concrete page at the
 * segment root so `/legal` is a valid destination rather than a 404.
 */
export default function LegalIndexPage() {
  redirect('/legal/privacy')
}
