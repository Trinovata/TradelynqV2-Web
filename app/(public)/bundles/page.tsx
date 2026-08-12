import type { Metadata } from 'next'
import { MERCH_PRODUCTS } from '@/lib/constants/merch'
import { formatTTD } from '@/lib/utils/format'
import { Badge } from '@/components/ui/Badge'
import { StoreOrderButton } from '../merch/StoreOrderModal'

/**
 * Bundles (playbook S091, deck §12.3): the Launch Bundle + branding kits,
 * same order modal as /merch. The register-your-business page's "See the
 * bundle" CTA lands here.
 */
export const metadata: Metadata = {
  title: 'Launch Bundle & branding kits | TradeLynq',
  description:
    'Everything you need to start, in one package — done-for-you registration, branding kit, and a Growth-tier period.',
}

export default function BundlesPage() {
  const bundles = MERCH_PRODUCTS.filter((p) => p.category === 'bundles')

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-foreground font-display text-3xl tracking-tight">Launch bundles</h1>
        <p className="text-body mt-1">Everything you need to start, in one package.</p>
      </header>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bundles.map((bundle) => (
          <li
            key={bundle.id}
            className="border-border bg-card-subtle flex flex-col gap-2 rounded-[--radius-card] border p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-foreground text-sm font-medium">{bundle.name}</h2>
              {bundle.popular && <Badge variant="neutral">Popular</Badge>}
            </div>
            <p className="text-body text-sm">{bundle.description}</p>
            {bundle.note && <p className="text-muted text-xs">{bundle.note}</p>}
            <p className="text-foreground mt-1 font-mono text-sm font-medium tabular-nums">
              {formatTTD(bundle.price)}
            </p>
            <div className="mt-auto pt-2">
              <StoreOrderButton product={bundle} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
