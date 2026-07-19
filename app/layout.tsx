import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider, ThemeScript } from '@/components/layout/ThemeProvider'

/**
 * Root layout.
 *
 * Typography is deliberately unstyled here. DESIGN.md mandates Satoshi (display
 * and body) and JetBrains Mono (all numerals), both self-hosted via
 * `next/font/local` with zero external font requests. That lands at playbook
 * S059 together with the type scale. Until then this uses the system stack
 * rather than shipping the scaffold's Geist, which is not the brand face and
 * would have to be torn out again.
 */
export const metadata: Metadata = {
  title: {
    default: 'TradeLynq — Find trusted professionals in Trinidad & Tobago',
    template: '%s · TradeLynq',
  },
  description:
    'Browse verified professionals across beauty, trades, creative, health, events, education, and tech. Free for customers.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: ThemeScript mutates the class list before React
    // hydrates, so server and client markup differ here by design. Scoped to
    // <html> only — it does not suppress warnings anywhere else in the tree.
    <html lang="en-TT" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
