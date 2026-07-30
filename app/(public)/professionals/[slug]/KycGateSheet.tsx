'use client'

/**
 * KycGateSheet (playbook S083, flow v2/08 §8.1, copy copy-public.md §5.10).
 *
 * The connection gate's explanation: two free contacts are spent and the
 * account is not verified, so the sheet says why and offers the verify CTA. It
 * HANDS OFF, never collects — 8.1: "KYC sheet (why + verify CTA) → KYC flow
 * (§8.5)". The flow itself is S102.
 *
 * FLAG (pack delta): api-marketplace §3 gives `verify_url: "/settings/verify"`,
 * but `/settings` is the PROFESSIONAL namespace in the route contract
 * (lib/routes.ts) — middleware would bounce a customer straight off it. `/kyc`
 * is the customer-owned path, so the CTA points there. S102 builds the page;
 * it 404s until then, and the sheet ships anyway because it is the gate's
 * honest explanation.
 */
import Link from 'next/link'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { STOREFRONT_COPY } from '@/lib/copy/storefront'

const COPY = STOREFRONT_COPY.kycGate

export function KycGateSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={COPY.heading} description={COPY.body}>
      <div className="flex flex-col gap-3 pt-1">
        <Button asChild fullWidth>
          <Link href="/kyc">{COPY.primary}</Link>
        </Button>
        <Button variant="secondary" fullWidth onClick={() => onOpenChange(false)}>
          {COPY.secondary}
        </Button>
        <p className="text-muted text-center text-xs">{COPY.reassurance}</p>
      </div>
    </Sheet>
  )
}
