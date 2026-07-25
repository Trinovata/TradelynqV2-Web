import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

/**
 * For Professionals — hero stub (playbook S089; full §3.9 build follows).
 *
 * This page exists now because the category landing CTA band (S087, deck
 * §8.1) targets /for-professionals — an action must never land on a 404.
 * The full §3.9 surface (three-ways-to-list cards, product proof, earnings
 * strip, registration cross-sell, FAQ) lands with the S089 block; strings
 * here are deck-verbatim (copy-public.md §10.1–10.2).
 *
 * FLAG (deck V1-ism): §10.2 sends the CTA to /signup?role=worker — V1
 * vocabulary and a param V2's signup does not read. Role selection happens at
 * /auth/select-role after signup (S054), so the CTA goes to /signup plainly.
 */
export const metadata: Metadata = {
  title: 'For Professionals — Turn your reputation into a business | TradeLynq',
  description:
    'Create a verified storefront, collect real reviews, and receive enquiries from customers across Trinidad & Tobago. Three ways to list — from TTD $200/month.',
}

export default function ForProfessionalsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
      <h1 className="text-foreground font-display text-4xl tracking-tight text-balance sm:text-5xl">
        Turn your reputation into a business.
      </h1>
      <p className="text-body mx-auto mt-4 max-w-2xl text-lg text-pretty">
        Get a verified storefront, collect real reviews, and receive enquiries — all in one place,
        built for T&amp;T.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/signup">Create your storefront</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href="/pricing">See pricing</Link>
        </Button>
      </div>
    </div>
  )
}
