import type { Metadata } from 'next'
import { LAUNCH_PRICING, PRICING_MODE, REGISTRATION_FEE } from '@/lib/constants/pricing'
import { formatTTD, formatDate } from '@/lib/utils/format'
import { FaqClient, type FaqGroup } from './FaqClient'

/**
 * Help centre (playbook S089, spec v2/03 §3.10, copy deck §11.3 — all 16
 * Q&As verbatim). Content lives here as data; the client handles filter and
 * accordion behaviour.
 *
 * Money answers are regime-dependent (D62): launch mode states the free window
 * and the flat rate from the constants; the deck's tiers-world answers return
 * verbatim when the flag flips.
 */
const LAUNCH = PRICING_MODE === 'launch'
const FREE_THROUGH = formatDate(LAUNCH_PRICING.freeUntil)
export const metadata: Metadata = {
  title: 'Help centre & FAQ | TradeLynq',
  description:
    'Answers to common questions about using TradeLynq — for customers and professionals. Search, or browse by topic.',
}

const GROUPS: FaqGroup[] = [
  {
    heading: 'For customers',
    entries: [
      {
        id: 'customers-free',
        q: 'Is TradeLynq free for customers?',
        a: 'Yes, completely. Search, compare, save, and contact professionals at no cost.',
      },
      {
        id: 'customers-contact',
        q: 'How do I contact a professional?',
        a: 'Open their storefront and tap Reveal contact info, then message them on WhatsApp or call directly. Your first two contacts are free; after that we ask for a quick identity check.',
      },
      {
        id: 'customers-verify',
        q: 'Why do I have to verify my identity?',
        a: 'After two free contacts, a short identity check keeps the marketplace safe and cuts down on spam. It takes about two minutes and your documents stay private.',
      },
      {
        id: 'customers-badges',
        q: 'What do the badges mean?',
        a: 'Green badges mean we verified something real — identity, insurance, or both. Registered Business means the company is legally registered.',
      },
      {
        id: 'customers-reviews',
        q: 'Can I trust the reviews?',
        a: 'Yes. Reviews come from real customers and our team approves each one before it shows. Reviews tied to a completed job carry a Verified job label.',
      },
    ],
  },
  {
    heading: 'For professionals',
    entries: [
      {
        id: 'pros-join',
        q: 'How do I join as a professional?',
        a: 'Tap List your business, choose your account type, and set up your storefront. You can be live the same day.',
      },
      {
        id: 'pros-commission',
        q: 'Do you take commission?',
        a: 'No. You keep 100% of what you earn. Your monthly plan is the only fee.',
      },
      {
        id: 'pros-enquiries',
        q: 'How do I get more enquiries?',
        a: 'Complete your storefront, collect verified reviews, and keep your details current. Better reviews lift your search ranking.',
      },
      {
        id: 'pros-pioneer',
        q: LAUNCH ? 'Is TradeLynq really free right now?' : 'What is the Pioneer Programme?',
        a: LAUNCH
          ? `Yes. Every professional who joins gets the full toolset with no subscription through ${FREE_THROUGH}. The one-time registration fee is the only cost until then.`
          : 'The first 180 professionals to join get three months free — full tools, no charge until month 3. Places are limited to three per category and close on 7 January 2027.',
      },
    ],
  },
  {
    heading: 'Payments & plans',
    entries: [
      {
        id: 'pay-cost',
        q: 'What does it cost?',
        a: LAUNCH
          ? `A one-time ${formatTTD(REGISTRATION_FEE.standard)} registration fee (${formatTTD(REGISTRATION_FEE.student)} for students). Your subscription is free through ${FREE_THROUGH} — then one flat ${formatTTD(LAUNCH_PRICING.baselineMonthly)}/month, everything included. Students pay ${formatTTD(LAUNCH_PRICING.studentMonthly)}/month, with scholarships available.`
          : 'A one-time TTD $200 registration fee (TTD $100 for students), then a plan from TTD $200/month. First three months are 50% off.',
      },
      {
        id: 'pay-registered-rate',
        q: LAUNCH ? 'Will pricing change later?' : "What's the Registered rate?",
        a: LAUNCH
          ? 'Optional plans with advanced tools, including AI assistance, arrive after launch — everything you get today stays in the flat rate, and any change comes with clear notice.'
          : 'Registered Businesses pay their plan plus TTD $100/month, permanently. Sole traders pay the plan alone for six months, then plus TTD $150/month.',
      },
      {
        id: 'pay-how',
        q: 'How do I pay?',
        a: LAUNCH
          ? 'The registration fee is payable by card or local options including WiPay. Subscription billing only begins after the free window.'
          : 'Card payment and local options including WiPay. You set this up when your plan starts.',
      },
      {
        id: 'pay-cancel',
        q: 'Can I cancel?',
        a: 'Any time, from your workspace. Your plan runs to the end of the current billing period.',
      },
    ],
  },
  {
    heading: 'Trust & safety',
    entries: [
      {
        id: 'trust-verified',
        q: 'How are professionals verified?',
        a: 'We confirm identity and, where applicable, insurance. Verified professionals carry a green badge.',
      },
      {
        id: 'trust-report',
        q: 'How do I report a problem?',
        a: 'Message us on WhatsApp or use Report a concern. We review every report against our policies.',
      },
      {
        id: 'trust-disputed',
        q: 'What happens to a disputed review?',
        a: "We contact the reviewer for substantiation. The review either stands or is removed — we don't quietly delete genuine feedback.",
      },
    ],
  },
]

export default function FaqPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-foreground font-display mb-8 text-3xl tracking-tight">Help centre</h1>
      <FaqClient groups={GROUPS} />
    </div>
  )
}
