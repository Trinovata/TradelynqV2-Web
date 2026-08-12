import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { requireProfessional } from '@/lib/access/api'
import { loginRedirect } from '@/lib/routes'
import { getStorefrontEditModel } from '@/lib/professional/storefront'
import { BlurFade } from '@/components/ui/blur-fade'
import { StorefrontEditor } from './StorefrontEditor'

export const metadata: Metadata = { title: 'Storefront' }

// Editable, per-professional, must reflect the last save — never cache.
export const dynamic = 'force-dynamic'

export default async function StorefrontPage() {
  const access = await requireProfessional()
  if (!access.ok) redirect(loginRedirect('/storefront'))

  const model = await getStorefrontEditModel(access.supabase, access.professionalId)
  if (!model) redirect('/dashboard')

  const liveHref =
    model.slug && model.listingStatus === 'active' ? `/professionals/${model.slug}` : null

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <BlurFade delay={0} className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-foreground font-display text-2xl tracking-tight">Your storefront</h1>
          <p className="text-muted mt-1 text-sm">
            Customise what customers see. Each section saves on its own.
          </p>
        </div>
        {liveHref && (
          <a
            href={liveHref}
            target="_blank"
            rel="noreferrer"
            className="text-body hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
          >
            View live
            <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        )}
      </BlurFade>

      <BlurFade delay={0.08}>
        <StorefrontEditor initial={model} />
      </BlurFade>
    </div>
  )
}
