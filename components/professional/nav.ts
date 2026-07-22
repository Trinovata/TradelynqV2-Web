/**
 * The professional workspace navigation map — the single source both the desktop
 * sidebar and the mobile tab bar read (playbook S105, spec v2/05 §5.0).
 *
 * Keeping the sections here (not inline in a component) is what makes "adding a
 * tool is one row" literally true: a new destination appears in the sidebar, the
 * more-sheet, and — if flagged `primary` — the mobile tab bar, from one edit.
 *
 * `requires` gates an item behind a tier feature; `primary` promotes it onto the
 * five-slot mobile tab bar. Everything else lives in the mobile "More" sheet.
 */
import {
  LayoutDashboard,
  Inbox,
  FileText,
  Briefcase,
  CalendarDays,
  Receipt,
  Users,
  Store,
  Images,
  Tag,
  Star,
  TrendingUp,
  ListChecks,
  Gift,
  CreditCard,
  Coins,
  Plug,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import type { FeatureKey } from '@/lib/constants/pricing'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** Gates the item behind a tier feature; absent = available on every tier. */
  requires?: FeatureKey
  /** Promotes the item onto the mobile tab bar's five slots. */
  primary?: boolean
}

export type NavSection = { heading: string; items: NavItem[] }

export const NAV_SECTIONS: NavSection[] = [
  {
    heading: 'Today',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, primary: true }],
  },
  {
    heading: 'Work',
    items: [
      { href: '/enquiries', label: 'Enquiries', icon: Inbox, primary: true },
      { href: '/quotes', label: 'Quotes', icon: FileText },
      { href: '/jobs', label: 'Jobs', icon: Briefcase, primary: true },
      { href: '/bookings', label: 'Bookings', icon: CalendarDays },
      { href: '/invoices', label: 'Invoices', icon: Receipt, primary: true },
    ],
  },
  {
    heading: 'Clients',
    items: [{ href: '/clients', label: 'CRM', icon: Users, requires: 'crm' }],
  },
  {
    heading: 'Storefront',
    items: [
      { href: '/storefront', label: 'Profile', icon: Store },
      { href: '/portfolio', label: 'Portfolio', icon: Images },
      { href: '/offerings', label: 'Offerings', icon: Tag },
      { href: '/reviews', label: 'Reviews', icon: Star },
    ],
  },
  {
    heading: 'Growth',
    items: [
      { href: '/analytics', label: 'Analytics', icon: TrendingUp },
      { href: '/readiness', label: 'Readiness', icon: ListChecks },
      { href: '/referrals', label: 'Referrals', icon: Gift },
    ],
  },
  {
    heading: 'Account',
    items: [
      { href: '/subscription', label: 'Subscription', icon: CreditCard },
      { href: '/credits', label: 'Credits', icon: Coins },
      { href: '/integrations', label: 'Integrations', icon: Plug, requires: 'webhooks' },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

/** The four destinations that earn a permanent mobile slot (the fifth is "More"). */
export const PRIMARY_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items).filter(
  (i) => i.primary
)

export const SUPPORT_WHATSAPP =
  'https://wa.me/18686270000?text=' + encodeURIComponent('Hi TradeLynq support,')
