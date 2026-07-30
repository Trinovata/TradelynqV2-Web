import Link from 'next/link'
import { LinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { whatsappDigits } from '@/lib/whatsapp'
import { SUPPORT_PHONE } from '@/lib/constants/contact'

/**
 * The one invalid-token state (deck §14.4) — unknown, expired-and-replaced,
 * and revoked links all land here indistinguishably, which is the point: a
 * token page must never confirm whether a document exists.
 */
export function TokenInvalid() {
  const digits = whatsappDigits(SUPPORT_PHONE)
  const waHref = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent('Hi, I need a new document link on TradeLynq.')}`
    : undefined

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <div className="bg-card text-muted flex size-12 items-center justify-center rounded-full">
        <LinkIcon className="size-6" aria-hidden="true" />
      </div>
      <h1 className="text-foreground font-display mt-4 text-2xl tracking-tight">
        This link isn&rsquo;t valid
      </h1>
      <p className="text-body mt-2 text-sm">
        It may have expired or been replaced. Contact the professional for an up-to-date link.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3">
        {waHref && (
          <Button asChild>
            <a href={waHref}>Chat on WhatsApp</a>
          </Button>
        )}
        <Link href="/" className="text-body hover:text-foreground text-sm transition-colors">
          Back to TradeLynq
        </Link>
      </div>
    </div>
  )
}
