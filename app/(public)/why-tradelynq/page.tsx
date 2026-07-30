import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

/**
 * Why TradeLynq — the deeper dive: what it solves, why it helps (Gregg
 * directive 25 Jul 2026). Grounded in master/02 vision & strategy;
 * INTERIM-AUTHORED prose flagged for deck adoption.
 */
export const metadata: Metadata = {
  title: 'Why TradeLynq — what it solves and why it helps | TradeLynq',
  description:
    'The trust gap in hiring, the invisibility of skilled professionals, and how TradeLynq solves both — verification, moderated reviews, WhatsApp-first contact, and no commissions.',
}

const PROBLEMS = [
  {
    heading: 'Hiring is a gamble',
    body: 'Finding someone good depends on who you happen to know. No public track record, no way to compare, no recourse when it goes wrong — so good and bad professionals look identical until the work starts.',
  },
  {
    heading: 'Skilled people are invisible',
    body: 'Thousands of professionals do excellent work with no storefront, no reviews anyone can read, and no way for a stranger to find them. Their reputation lives and dies in one neighbourhood.',
  },
  {
    heading: 'Running the business eats the craft',
    body: 'Quotes on paper, invoices in chat threads, follow-ups forgotten. The admin around the work costs hours the work itself never gets back.',
  },
]

const ANSWERS = [
  {
    heading: 'Verification you can see',
    body: 'Identity checked, insurance checked where it applies, registration status shown. A green badge means we verified something real — the ladder is public on every storefront.',
    href: '/trust',
    link: 'How verification works',
  },
  {
    heading: 'Reviews worth reading',
    body: 'Every review is moderated before it shows, and reviews tied to completed jobs carry a Verified job label. Ranking is earned through them — never bought.',
    href: '/customer-guide',
    link: 'Using TradeLynq as a customer',
  },
  {
    heading: 'Contact the T&T way',
    body: 'One tap to WhatsApp. No new inbox to check, no apps to convince anyone to install — the conversation happens where it was always going to happen.',
    href: '/search',
    link: 'Find a professional',
  },
  {
    heading: 'Tools that pay for themselves',
    body: 'Storefront, enquiries, quotes, invoices, and repeat-client memory in one place — and no commission, ever. Professionals keep 100% of what they earn.',
    href: '/for-professionals',
    link: 'For professionals',
  },
]

export default function WhyTradeLynqPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-foreground font-display text-3xl tracking-tight text-balance sm:text-4xl">
        Why TradeLynq exists
      </h1>
      <p className="text-body mt-3 leading-relaxed text-pretty">
        Hiring a professional in Trinidad &amp; Tobago should be as trustworthy as a personal
        recommendation. It usually isn&rsquo;t — and that gap hurts both sides of every job.
      </p>

      <section className="mt-10">
        <h2 className="text-foreground font-medium">The problem</h2>
        <ul className="mt-4 flex flex-col gap-4">
          {PROBLEMS.map((item) => (
            <li key={item.heading}>
              <h3 className="text-foreground text-sm font-medium">{item.heading}</h3>
              <p className="text-body mt-1 text-sm leading-relaxed">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-foreground font-medium">What TradeLynq does about it</h2>
        <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ANSWERS.map((item) => (
            <li
              key={item.heading}
              className="border-border bg-card flex flex-col gap-1.5 rounded-[--radius-card] border p-5"
            >
              <h3 className="text-foreground text-sm font-medium">{item.heading}</h3>
              <p className="text-body text-sm leading-relaxed">{item.body}</p>
              <Link
                href={item.href}
                className="text-foreground mt-auto pt-2 text-sm font-medium underline underline-offset-4"
              >
                {item.link}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-foreground font-medium">And the bigger picture</h2>
        <p className="text-body mt-2 text-sm leading-relaxed">
          Every professional who joins, collects reviews, and eventually registers their business is
          a step in something larger: informal work becoming formal, visible, and bankable. The
          Student Entrepreneur → Small Business → Registered Business ladder isn&rsquo;t just
          pricing — it&rsquo;s the path, and the platform is built to walk people up it.
        </p>
      </section>

      <div className="border-border bg-card mt-12 rounded-[--radius-card] border p-6 text-center">
        <p className="text-foreground font-display text-lg">See it for yourself.</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Button asChild>
            <Link href="/search">Find a professional</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/about">Meet the team</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
