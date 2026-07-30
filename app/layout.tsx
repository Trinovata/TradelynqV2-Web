import type { Metadata } from 'next'
import { JetBrains_Mono } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import { ThemeProvider, ThemeScript } from '@/components/layout/ThemeProvider'

/**
 * Root layout and typography (D67 — the V1 front end returns).
 *
 * Satoshi is back as the single brand face, exactly as V1 ran it — but
 * self-hosted from V1's own Fontshare kit via `next/font/local`, so the
 * zero-external-font-requests property holds. The variable file carries
 * weights 300–900; V1's 900-weight heroes are available again. JetBrains
 * Mono keeps the tabular numerals. The token layer reads `--font-satoshi`
 * and `--font-jetbrains-mono`.
 */
const satoshi = localFont({
  src: [
    { path: './fonts/satoshi/Satoshi-Variable.woff2', weight: '300 900', style: 'normal' },
    { path: './fonts/satoshi/Satoshi-VariableItalic.woff2', weight: '300 900', style: 'italic' },
  ],
  variable: '--font-satoshi',
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
      className={`h-full antialiased ${satoshi.variable} ${jetbrainsMono.variable}`}
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
