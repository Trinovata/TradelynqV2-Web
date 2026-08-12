import { BadgeCheck, ShieldCheck, IdCard } from 'lucide-react'

/**
 * VerificationLadder — the read-only variant (playbook S074 remainder, first
 * consumed by /trust per deck §11.2).
 *
 * Three rungs, presented as a ladder rather than a list: each step includes
 * the one below it, and the visual order IS the meaning. The professional
 * account view (S115) extends this with per-step status ("you are here",
 * documents pending) — extend via props there, never fork the component.
 */
export type LadderStep = {
  title: string
  body: string
}

const ICONS = [IdCard, ShieldCheck, BadgeCheck] as const

export function VerificationLadder({ steps }: { steps: LadderStep[] }) {
  return (
    <ol className="flex flex-col gap-0">
      {steps.map((step, index) => {
        const Icon = ICONS[Math.min(index, ICONS.length - 1)] ?? BadgeCheck
        const last = index === steps.length - 1
        return (
          <li key={step.title} className="relative flex gap-4 pb-8 last:pb-0">
            {/* The rail — drawn per row so the ladder reads as one climb. */}
            {!last && (
              <span
                aria-hidden="true"
                className="border-border absolute top-10 left-5 h-[calc(100%-2.5rem)] border-l"
              />
            )}
            <span className="bg-card border-border text-success flex size-10 shrink-0 items-center justify-center rounded-full border">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="pt-1.5">
              <h3 className="text-foreground text-sm font-medium">{step.title}</h3>
              <p className="text-body mt-1 text-sm leading-relaxed">{step.body}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
