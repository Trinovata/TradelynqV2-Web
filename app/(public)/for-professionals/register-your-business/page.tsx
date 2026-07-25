import type { Metadata } from 'next'
import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { whatsappDigits } from '@/lib/whatsapp'
import { SUPPORT_PHONE } from '@/lib/constants/contact'

/**
 * Register your business (playbook S090, spec v2/15 §15.1 path 1, copy deck
 * §10.9 — strings verbatim).
 *
 * FLAGS (both playbook-sanctioned):
 * - The paid intake flow ("Start my registration") is BEHIND THE FLAG until
 *   QC3 partner terms are locked (S161) — the CTA hands off to WhatsApp with a
 *   pre-filled message instead of a half-real form.
 * - "See the bundle" targets /bundles, which does not exist yet (bundle spec:
 *   docs/plans/2026-06-12-business-registration-service.md) — same WhatsApp
 *   hand-off until the bundle page ships.
 * - The full DIY guide content (name search → BIR → NIS steps with fees and
 *   timelines) is summarised in Path 1's deck body; the long-form guide page
 *   lands with the guides block (S089 close-out).
 */
export const metadata: Metadata = {
  title: 'Register your business in Trinidad & Tobago | TradeLynq',
  description:
    'Two honest paths to a registered business: a free DIY guide, or a done-for-you service through our registration partner. Compare, then choose.',
}

const wa = (message: string) => {
  const digits = whatsappDigits(SUPPORT_PHONE)
  return digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : '/for-professionals'
}

const PATHS = [
  {
    heading: 'Do it yourself (free guide)',
    body: 'Name search, reservation, incorporation or registration, BIR, and NIS — with links, typical government fees, and realistic timelines (3–8 weeks on your own).',
    cta: 'Open the free guide',
    href: wa('I would like the free DIY business registration guide.'),
  },
  {
    heading: 'We do it for you',
    body: 'Submit your details once and our registration partner handles the filings. Certificate delivered, Registered account live — first month free. Typically 7–14 business days.',
    cta: 'Start my registration',
    href: wa('I want TradeLynq to handle my business registration.'),
  },
  {
    heading: 'The Launch Bundle',
    body: 'Done-for-you registration, a branding kit (polo, cap, 100 business cards), and a Growth-tier period — the full launch, packaged.',
    cta: 'See the bundle',
    href: wa('Tell me about the Launch Bundle.'),
  },
]

export default function RegisterYourBusinessPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6">
      <header className="text-center">
        <h1 className="text-foreground font-display text-3xl tracking-tight text-balance sm:text-4xl">
          Register your business — the honest way
        </h1>
      </header>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        {PATHS.map((path) => (
          <section
            key={path.heading}
            className="border-border bg-card flex flex-col gap-3 rounded-[--radius-card] border p-6"
          >
            <h2 className="text-foreground font-medium">{path.heading}</h2>
            <p className="text-body text-sm leading-relaxed">{path.body}</p>
            <div className="mt-auto pt-2">
              <Button asChild variant="secondary" fullWidth>
                <a href={path.href}>
                  <MessageCircle className="size-4" aria-hidden="true" />
                  {path.cta}
                </a>
              </Button>
            </div>
          </section>
        ))}
      </div>

      <p className="text-muted mt-8 text-center text-xs">
        TradeLynq is a facilitation service, not a law firm. Registration status is issued by the
        Registry, not warranted by TradeLynq.
      </p>
    </div>
  )
}
