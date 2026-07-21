/**
 * Public site footer (playbook S076, spec v2/03 §3.1, copy copy-public.md §footer).
 *
 * Server component — pure links, no interactivity. The legal column is
 * load-bearing: the four documents must always be one click away.
 */
import Link from 'next/link'

const COLUMNS = [
  {
    heading: 'Marketplace',
    links: [
      { href: '/search', label: 'Browse professionals' },
      { href: '/catalogue', label: 'Catalogue' },
      { href: '/categories', label: 'Categories' },
    ],
  },
  {
    heading: 'Professionals',
    links: [
      { href: '/for-professionals', label: 'For professionals' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/trust', label: 'Trust & safety' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { href: '/faq', label: 'FAQ' },
      { href: '/support', label: 'Support' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/legal/privacy', label: 'Privacy policy' },
      { href: '/legal/terms', label: 'Terms of service' },
      { href: '/legal/eula', label: 'User agreement' },
      { href: '/legal/reviews', label: 'Reviews policy' },
    ],
  },
] as const

export function Footer() {
  return (
    <footer className="border-border bg-card-subtle mt-auto border-t">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        {COLUMNS.map((column) => (
          <div key={column.heading} className="flex flex-col gap-3">
            <h2 className="text-muted text-xs font-medium tracking-wide uppercase">
              {column.heading}
            </h2>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-body hover:text-foreground text-sm transition-[color] duration-150"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-border border-t">
        <div className="text-muted mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© 2026 Trinovata Ltd. TradeLynq is a trade mark of Trinovata Ltd.</p>
          <p>Built in Trinidad &amp; Tobago.</p>
        </div>
      </div>
    </footer>
  )
}
