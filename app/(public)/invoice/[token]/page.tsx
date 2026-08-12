import { redirect } from 'next/navigation'

/**
 * /invoice/[token] — the long-form alias from printed documents and V1 links
 * (spec v2/03 §3.13 names both). One canonical renderer at /i/[token].
 */
export default async function InvoiceAliasPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  redirect(`/i/${encodeURIComponent(token)}`)
}
