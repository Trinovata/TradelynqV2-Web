/**
 * CategoryShowcase — the browse grid, ported from V1's colourful category UI.
 *
 * V1 gave every category an icon and its own accent colour, and it worked — a
 * wall of tinted, iconned cards reads as "there's a lot here, and it's for you".
 * V2's version keeps that spirit inside the design system: the accent is carried
 * as an OPACITY tint over the card surface (`bg-{c}-500/12`) plus a mid-weight
 * icon colour, so each chip adapts to light and dark automatically — no
 * per-component `dark:` class, no fixed light chip glowing on a dark page.
 *
 * Colours avoid the two retired hues (violet/purple, D32) and the neutral
 * palette the lexicon reserves for tokens. Icons are real lucide marks mapped
 * from the category slug. Server-rendered; each card lifts on hover and reveals
 * on scroll.
 */
import Link from 'next/link'
import {
  House,
  Sparkles,
  Camera,
  Briefcase,
  Car,
  HeartPulse,
  PawPrint,
  PartyPopper,
  ChefHat,
  Baby,
  GraduationCap,
  Laptop,
  Layers,
  type LucideIcon,
} from 'lucide-react'
import { Reveal } from '@/components/shared/Reveal'
import { NumberTicker } from '@/components/shared/NumberTicker'
import type { CategoryTreeNode } from '@/lib/marketplace/queries'

type Accent = { Icon: LucideIcon; chip: string; icon: string }

/**
 * Per-category accent — icon + a self-adapting tint. The `/12` background is the
 * accent over whatever card surface sits beneath it, so it holds in both themes;
 * the icon colour is a mid step that stays legible on light and dark alike.
 */
const ACCENTS: Record<string, Accent> = {
  'home-property': { Icon: House, chip: 'bg-sky-500/12', icon: 'text-sky-500' },
  'beauty-wellness': { Icon: Sparkles, chip: 'bg-pink-500/12', icon: 'text-pink-500' },
  'creative-media': { Icon: Camera, chip: 'bg-fuchsia-500/12', icon: 'text-fuchsia-500' },
  'professional-services': { Icon: Briefcase, chip: 'bg-indigo-500/12', icon: 'text-indigo-500' },
  'automotive-transport': { Icon: Car, chip: 'bg-cyan-500/12', icon: 'text-cyan-500' },
  'health-fitness': { Icon: HeartPulse, chip: 'bg-rose-500/12', icon: 'text-rose-500' },
  pets: { Icon: PawPrint, chip: 'bg-emerald-500/12', icon: 'text-emerald-500' },
  'events-entertainment': { Icon: PartyPopper, chip: 'bg-amber-500/12', icon: 'text-amber-500' },
  'food-catering': { Icon: ChefHat, chip: 'bg-orange-500/12', icon: 'text-orange-500' },
  'childhood-family-care': { Icon: Baby, chip: 'bg-teal-500/12', icon: 'text-teal-500' },
  'education-tutoring': { Icon: GraduationCap, chip: 'bg-green-500/12', icon: 'text-green-500' },
  technology: { Icon: Laptop, chip: 'bg-blue-500/12', icon: 'text-blue-500' },
}

const FALLBACK: Accent = { Icon: Layers, chip: 'bg-accent-soft', icon: 'text-accent-ink' }

export function CategoryShowcase({ categories }: { categories: CategoryTreeNode[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {categories.map((node, index) => {
        const accent = ACCENTS[node.parent.slug] ?? FALLBACK
        const { Icon } = accent
        return (
          <Reveal key={node.parent.slug} delay={Math.min(index, 11) * 35}>
            <Link
              href={`/search?q=${encodeURIComponent(node.parent.name)}`}
              className="group border-border bg-card hover:border-accent/30 focus-visible:outline-ring flex h-full flex-col gap-3 rounded-[--radius-card] border p-4 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_8px_28px_-16px_rgb(16_22_31/0.25)] focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span
                className={`flex size-11 items-center justify-center rounded-[--radius-control] transition-transform duration-200 group-hover:scale-105 ${accent.chip}`}
              >
                <Icon className={`size-5.5 ${accent.icon}`} aria-hidden="true" />
              </span>
              <span className="text-foreground mt-1 leading-snug font-medium">
                {node.parent.name}
              </span>
              {node.children.length > 0 && (
                <span className="text-muted mt-auto text-xs">
                  <NumberTicker value={node.children.length} className="text-body" /> specialities
                </span>
              )}
            </Link>
          </Reveal>
        )
      })}
    </div>
  )
}
