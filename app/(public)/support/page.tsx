import type { Metadata } from 'next'
import Link from 'next/link'
import { MessageCircle, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { whatsappDigits } from '@/lib/whatsapp'
import { SUPPORT_PHONE } from '@/lib/constants/contact'

/**
 * Support (playbook S089, copy deck §11.4 — strings verbatim, including the
 * hours-honesty line: a small team that overpromises response times burns
 * trust twice).
 */
export const metadata: Metadata = {
  title: 'Contact support | TradeLynq',
  description:
    "Get help from the TradeLynq team. WhatsApp is fastest. We're a small team — here's when to expect a reply.",
}

export default function SupportPage() {
  const digits = whatsappDigits(SUPPORT_PHONE)
  const waHref = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent('Hi — I need some help with TradeLynq.')}`
    : '/feedback'

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-foreground font-display text-3xl tracking-tight">
        We&rsquo;re here to help
      </h1>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="border-border bg-card flex flex-col gap-2 rounded-[--radius-card] border p-6">
          <MessageCircle className="text-success size-6" aria-hidden="true" />
          <h2 className="text-foreground font-medium">Chat on WhatsApp</h2>
          <p className="text-body text-sm">
            The fastest way to reach us. Tap to start a conversation.
          </p>
          <div className="mt-auto pt-2">
            <Button asChild fullWidth>
              <a href={waHref}>Chat on WhatsApp</a>
            </Button>
          </div>
        </section>

        <section className="border-border bg-card flex flex-col gap-2 rounded-[--radius-card] border p-6">
          <PenLine className="text-muted size-6" aria-hidden="true" />
          <h2 className="text-foreground font-medium">Send feedback</h2>
          <p className="text-body text-sm">Found a bug or have an idea? Tell us.</p>
          <div className="mt-auto pt-2">
            <Button asChild variant="secondary" fullWidth>
              <Link href="/feedback">Send feedback</Link>
            </Button>
          </div>
        </section>
      </div>

      <p className="text-body mt-6 text-sm">
        Email: <span className="font-mono">support@tradelynq.tech</span>
      </p>
      <p className="text-muted mt-2 text-sm">
        We&rsquo;re a small, part-time team. We usually reply within one business day, and faster on
        WhatsApp.
      </p>
    </div>
  )
}
