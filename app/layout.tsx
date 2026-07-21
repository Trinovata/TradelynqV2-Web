import type { Metadata } from 'next'
import { Bricolage_Grotesque, Hanken_Grotesk, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { ThemeProvider, ThemeScript } from '@/components/layout/ThemeProvider'

/**
 * Root layout and typography.
 *
 * The Caribbean Vivid palette ships with real faces, self-hosted at build by
 * `next/font/google` — so there are ZERO external font requests at runtime, the
 * property the old Satoshi plan wanted. Bricolage Grotesque carries the display
 * voice (warm, humanist, a little alive); Hanken Grotesk is the body; JetBrains
 * Mono holds the tabular numerals the design law requires. Each exposes a CSS
 * variable the token layer reads (`--font-bricolage`, `--font-hanken`,
 * `--font-jetbrains-mono`).
 */
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

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
    <html
      lang="en-TT"
      className={`h-full antialiased ${bricolage.variable} ${hanken.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body className="bg-background text-body flex min-h-full flex-col font-sans">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
