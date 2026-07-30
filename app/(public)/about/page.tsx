import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

/**
 * About — TradeLynq's story, team, parent company, and future (Gregg
 * directive 25 Jul 2026). Content grounded in master/02 (mission, vision) and
 * the team record; INTERIM-AUTHORED prose flagged for the deck to adopt.
 * People are named with their consent implied by the public team record —
 * roles only, no personal contact.
 */
export const metadata: Metadata = {
  title: 'About TradeLynq — the story, the team, the future | TradeLynq',
  description:
    'TradeLynq is built in Trinidad & Tobago by Trinovata — a small team making hiring a professional as trustworthy as a personal recommendation.',
}

const TEAM: { name: string; role: string }[] = [
  { name: 'Gregg Mannette', role: 'Founder & CEO — product and strategy' },
  { name: 'Zack Narine', role: 'Web engineering lead' },
  { name: 'Yash Ramlakhansingh', role: 'Web engineering' },
  { name: 'Zyden Warris', role: 'Mobile engineering lead' },
  { name: 'Javed Ishmael', role: 'Mobile engineering' },
  { name: 'Jordan Hamlett', role: 'Digital media' },
  { name: 'Sameer Enightoola', role: 'Strategic marketing' },
  { name: 'Jermaine Moore', role: 'Finance & operations' },
]

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-foreground font-display text-3xl tracking-tight text-balance sm:text-4xl">
        Trust, built in Trinidad &amp; Tobago
      </h1>

      <section className="mt-8">
        <h2 className="text-foreground font-medium">The story</h2>
        <p className="text-body mt-2 text-sm leading-relaxed">
          TradeLynq started with a question every household in T&amp;T asks: &ldquo;who do you know
          that does…?&rdquo; The answer has always lived in personal recommendations — trustworthy,
          but small. Meanwhile thousands of skilled professionals, from a student doing nails after
          class to a registered contracting firm, run real businesses with no storefront, no reviews
          anyone can read, and no tools beyond a phone.
        </p>
        <p className="text-body mt-3 text-sm leading-relaxed">
          TradeLynq makes that recommendation network public and verifiable: every professional is
          checked, every review is moderated, and every contact happens the way this country
          actually communicates — on WhatsApp.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-foreground font-medium">What we believe</h2>
        <p className="text-body mt-2 text-sm leading-relaxed">
          Trust is the product. Ranking is earned through verified reviews — never bought. We take
          no commission on anyone&rsquo;s work: professionals subscribe, keep 100% of what they
          earn, and the platform succeeds only when they do.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-foreground font-medium">The team</h2>
        <p className="text-body mt-2 text-sm leading-relaxed">
          We&rsquo;re a small T&amp;T team building alongside day jobs and degrees — which is
          exactly why the platform is honest about what it is at every stage.
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TEAM.map((person) => (
            <li
              key={person.name}
              className="border-border bg-card rounded-[--radius-card] border p-4"
            >
              <p className="text-foreground text-sm font-medium">{person.name}</p>
              <p className="text-muted mt-0.5 text-xs">{person.role}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-foreground font-medium">Trinovata</h2>
        <p className="text-body mt-2 text-sm leading-relaxed">
          TradeLynq is built and operated by <strong>Trinovata</strong>, its parent company —
          founded to build technology for the realities of Trinidad &amp; Tobago rather than
          imported assumptions. TradeLynq is Trinovata&rsquo;s first product.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-foreground font-medium">The future</h2>
        <p className="text-body mt-2 text-sm leading-relaxed">
          The ambition is for TradeLynq to become the default answer to &ldquo;who do you know that
          does…?&rdquo; across T&amp;T — and the operating system its professionals run their
          businesses on: enquiries in, quotes out, jobs tracked, invoices paid, repeat clients
          remembered. Beyond that sits the bigger project: a formalisation engine, where the Student
          Entrepreneur → Small Business → Registered Business ladder actively moves informal work
          into the formal economy. The wider Caribbean comes later — depth at home first.
        </p>
      </section>

      <div className="border-border bg-card mt-12 rounded-[--radius-card] border p-6 text-center">
        <p className="text-foreground font-display text-lg">Be part of it.</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="/for-professionals">List your business</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/search">Find a professional</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
