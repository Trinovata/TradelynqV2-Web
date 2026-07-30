import type { Metadata } from 'next'
import { MERCH_CATEGORIES, MERCH_CATEGORY_LABELS, MERCH_PRODUCTS } from '@/lib/constants/merch'
import { formatTTD } from '@/lib/utils/format'
import { Badge } from '@/components/ui/Badge'
import { StoreOrderButton } from './StoreOrderModal'

/**
 * Merch store (playbook S091, spec v2/03 §3.11, deck §12.1). Demoted out of
 * primary nav by design — reached via footer and workspace. /store 301s here.
 * Product photos pend the branded-kit shoot (S162) — cards render name-first
 * on --card-subtle rather than with placeholder imagery (anti-slop).
 */
export const metadata: Metadata = {
  title: 'Merch store | TradeLynq',
  description:
    'Branded TradeLynq gear and professional branding kits — polos, caps, business cards, and more. Order and pay locally.',
}

export default function MerchPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-foreground font-display text-3xl tracking-tight">
          Merch &amp; branding
        </h1>
        <p className="text-body mt-1">
          Look the part. Branded gear and kits for TradeLynq professionals.
        </p>
      </header>

      <div className="flex flex-col gap-10">
        {MERCH_CATEGORIES.map((category) => {
          const products = MERCH_PRODUCTS.filter((p) => p.category === category)
          if (products.length === 0) return null
          return (
            <section key={category}>
              <h2 className="text-foreground font-medium">{MERCH_CATEGORY_LABELS[category]}</h2>
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <li
                    key={product.id}
                    className="border-border bg-card-subtle flex flex-col gap-2 rounded-[--radius-card] border p-5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-foreground text-sm font-medium">{product.name}</h3>
                      {product.popular && <Badge variant="neutral">Popular</Badge>}
                    </div>
                    <p className="text-body text-sm">{product.description}</p>
                    {product.note && <p className="text-muted text-xs">{product.note}</p>}
                    <p className="text-foreground mt-1 font-mono text-sm font-medium tabular-nums">
                      {formatTTD(product.price)}
                    </p>
                    <div className="mt-auto pt-2">
                      <StoreOrderButton product={product} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
