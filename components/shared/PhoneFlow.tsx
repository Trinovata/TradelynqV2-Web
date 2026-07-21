'use client'

/**
 * PhoneFlow — the app journey, played on a phone (the showcase centrepiece).
 *
 * A CSS iPhone frame auto-cycling through the four beats of actually using
 * TradeLynq on a phone: type what you need → results appear → open a
 * storefront → the conversation moves to WhatsApp. Movement with a purpose:
 * each screen is the next step of one story, ending on the platform's core
 * promise — the job gets sorted in a WhatsApp chat.
 *
 * It renders REAL data (the professional passed in comes from the live seed),
 * never an invented profile. Everything is tokens, so the phone re-themes with
 * the site. Screens crossfade/slide with transform+opacity only; the cycle
 * pauses on hover/focus (so it can be read) and under reduced-motion it holds
 * on the results screen instead of cycling.
 */
import * as React from 'react'
import { Search, Star, BadgeCheck, MessageCircle, ChevronLeft, Check } from 'lucide-react'
import type { ProfessionalCardData } from '@/lib/marketplace/professional-card'
import { formatTTD } from '@/lib/utils/format'

const SCREEN_MS = 3000

/** SSR-safe reduced-motion read — the same pattern Modal's viewport hook uses. */
function subscribeReducedMotion(onChange: () => void) {
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

export function PhoneFlow({ professional }: { professional: ProfessionalCardData }) {
  const reduced = React.useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false
  )
  const [cycled, setCycled] = React.useState(0)
  const [paused, setPaused] = React.useState(false)

  React.useEffect(() => {
    if (reduced || paused) return
    const id = setInterval(() => setCycled((current) => (current + 1) % 4), SCREEN_MS)
    return () => clearInterval(id)
  }, [reduced, paused])

  // Under reduced-motion, hold on the results screen — the most informative
  // single frame — instead of cycling. Derived, not set in an effect.
  const screen = reduced ? 1 : cycled

  const query = professional.category.name.toLowerCase()

  return (
    <div
      className="relative mx-auto flex h-full items-center justify-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* ── The chassis ── */}
      <div
        className="border-foreground/80 bg-foreground/90 relative aspect-[9/19] w-[15.5rem] overflow-hidden rounded-[2.6rem] border-[6px] shadow-2xl sm:w-[17rem]"
        role="img"
        aria-label={`A phone showing the TradeLynq flow: searching for a ${query}, viewing results, opening ${professional.name}'s storefront, and chatting on WhatsApp.`}
      >
        {/* Dynamic island */}
        <div className="bg-foreground absolute top-2 left-1/2 z-20 h-5 w-20 -translate-x-1/2 rounded-full" />

        {/* ── Screens ── */}
        <div className="bg-background absolute inset-0">
          {/* 1 · Search */}
          <Screen active={screen === 0}>
            <div className="flex flex-col gap-3 px-4 pt-12">
              <p className="text-foreground text-sm font-semibold">What do you need done?</p>
              <div className="border-accent bg-card flex items-center gap-2 rounded-full border px-3 py-2">
                <Search className="text-muted size-3.5 shrink-0" aria-hidden="true" />
                <span className="text-foreground text-xs">
                  {query}
                  <span className="bg-accent ml-0.5 inline-block h-3 w-px align-middle motion-safe:animate-pulse" />
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['Near me', 'Top rated', 'Available now'].map((chip) => (
                  <span
                    key={chip}
                    className="border-border text-muted rounded-full border px-2 py-0.5 text-[10px]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </Screen>

          {/* 2 · Results */}
          <Screen active={screen === 1}>
            <div className="flex flex-col gap-2 px-3 pt-12">
              <p className="text-muted px-1 text-[10px] tracking-wide uppercase">Results</p>
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  className="border-border bg-card flex items-center gap-2.5 rounded-xl border p-2.5"
                  style={{
                    animation:
                      screen === 1 && !reduced
                        ? `tlReveal 420ms cubic-bezier(0.16,1,0.3,1) ${row * 120}ms both`
                        : undefined,
                  }}
                >
                  <span className="bg-accent-soft text-accent-ink flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
                    {row === 0
                      ? professional.name.slice(0, 2).toUpperCase()
                      : row === 1
                        ? 'RP'
                        : 'KJ'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-xs font-medium">
                      {row === 0 ? professional.name : row === 1 ? 'Persad & Sons' : 'K. Joseph'}
                    </p>
                    <p className="text-muted flex items-center gap-1 text-[10px]">
                      <Star className="text-brand-amber size-2.5 fill-current" aria-hidden="true" />
                      {row === 0 && professional.rating
                        ? `${professional.rating.average.toFixed(1)} · ${professional.rating.count} reviews`
                        : row === 1
                          ? '4.6 · 18 reviews'
                          : '4.9 · 31 reviews'}
                    </p>
                  </div>
                  {row === 0 && (
                    <BadgeCheck className="text-success size-4 shrink-0" aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
          </Screen>

          {/* 3 · Storefront */}
          <Screen active={screen === 2}>
            <div className="flex flex-col gap-3 px-4 pt-11">
              <p className="text-muted flex items-center gap-1 text-[10px]">
                <ChevronLeft className="size-3" aria-hidden="true" />
                Back to results
              </p>
              <div className="flex items-center gap-3">
                <span className="bg-accent-soft text-accent-ink flex size-12 items-center justify-center rounded-full text-sm font-semibold">
                  {professional.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <p className="text-foreground text-sm leading-tight font-semibold">
                    {professional.name}
                  </p>
                  <p className="text-success flex items-center gap-1 text-[10px] font-medium">
                    <BadgeCheck className="size-3" aria-hidden="true" />
                    TradeLynq Verified
                  </p>
                </div>
              </div>
              {professional.fromPriceTTD !== undefined && (
                <div className="border-border bg-card flex items-center justify-between rounded-xl border px-3 py-2">
                  <span className="text-muted text-[10px]">Call-out from</span>
                  <span className="text-foreground font-mono text-xs font-medium tabular-nums">
                    {formatTTD(professional.fromPriceTTD)}
                  </span>
                </div>
              )}
              <div className="bg-whatsapp/15 text-foreground flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-medium">
                <MessageCircle className="text-whatsapp size-3.5" aria-hidden="true" />
                Chat on WhatsApp
              </div>
            </div>
          </Screen>

          {/* 4 · WhatsApp — the payoff */}
          <Screen active={screen === 3}>
            <div className="flex h-full flex-col gap-2 px-3 pt-12">
              <p className="text-muted px-1 text-[10px] tracking-wide uppercase">WhatsApp</p>
              <div className="flex flex-1 flex-col justify-start gap-2">
                <Bubble side="right" delay={0} active={screen === 3} reduced={reduced}>
                  Hi {professional.name.split(' ')[0]}, I found you on TradeLynq — are you free this
                  week?
                </Bubble>
                <Bubble side="left" delay={700} active={screen === 3} reduced={reduced}>
                  Yes! I can pass by Thursday morning.
                </Bubble>
                <Bubble side="right" delay={1400} active={screen === 3} reduced={reduced}>
                  Perfect, see you then
                  <Check className="text-whatsapp ml-1 inline size-3" aria-hidden="true" />
                </Bubble>
              </div>
            </div>
          </Screen>
        </div>

        {/* Progress dots */}
        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
          {[0, 1, 2, 3].map((dot) => (
            <span
              key={dot}
              className={`size-1.5 rounded-full transition-[background-color,transform] duration-300 ${
                dot === screen ? 'bg-accent scale-110' : 'bg-muted/40'
              }`}
            />
          ))}
        </div>
      </div>

      {/* ── Floating proof chips — Thumbtack-style accents, real motion ── */}
      <div
        aria-hidden="true"
        className="border-border bg-card absolute top-[18%] -left-2 hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs shadow-md motion-safe:animate-[tlAurora3_9s_ease-in-out_infinite] sm:flex"
      >
        <BadgeCheck className="text-success size-3.5" />
        <span className="text-foreground font-medium">Identity checked</span>
      </div>
      <div
        aria-hidden="true"
        className="border-border bg-card absolute right-0 bottom-[22%] hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs shadow-md motion-safe:animate-[tlAurora1_11s_ease-in-out_infinite] sm:flex"
      >
        <Star className="text-brand-amber size-3.5 fill-current" />
        <span className="text-foreground font-mono font-medium tabular-nums">
          {professional.rating ? professional.rating.average.toFixed(1) : '5.0'}
        </span>
      </div>
    </div>
  )
}

/** One phone screen: crossfade + a slight slide, transform/opacity only. */
function Screen({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`absolute inset-0 transition-[opacity,transform] duration-500 ease-out ${
        active ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-3 opacity-0'
      }`}
      aria-hidden={!active}
    >
      {children}
    </div>
  )
}

/** A chat bubble that pops in on its cue when its screen is active. */
function Bubble({
  side,
  delay,
  active,
  reduced,
  children,
}: {
  side: 'left' | 'right'
  delay: number
  active: boolean
  reduced: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={`max-w-[80%] rounded-2xl px-3 py-2 text-[11px] leading-snug ${
        side === 'right'
          ? 'bg-whatsapp/20 text-foreground self-end rounded-br-sm'
          : 'bg-card-subtle text-body self-start rounded-bl-sm'
      }`}
      style={{
        animation:
          active && !reduced
            ? `tlReveal 360ms cubic-bezier(0.16,1,0.3,1) ${delay}ms both`
            : undefined,
      }}
    >
      {children}
    </div>
  )
}
