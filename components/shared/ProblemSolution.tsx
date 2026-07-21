import { ArrowRight, Check, X } from 'lucide-react'
import { Reveal } from '@/components/shared/Reveal'

/**
 * ProblemSolution — the landing's status-quo contrast block.
 *
 * The persuasion pattern the best marketing pages share: name the broken way,
 * then show the better one — told as a ledger of paired rows rather than
 * paragraphs, which suits the Ink & Paper direction (hairlines, restraint, the
 * type does the work). Each row is one honest contrast; there are no invented
 * numbers anywhere in it, because the argument is structural, not statistical.
 *
 * Left cell: the status quo, muted, marked with an X. Right cell: what happens
 * here, foreground weight, marked with a check in accent ink. On mobile the
 * pair stacks and the marks alone carry the contrast; from `sm` the columns
 * sit side by side under their labels with a quiet arrow between them.
 */

export type ProblemSolutionPair = {
  problem: string
  solution: string
}

export function ProblemSolution({
  pairs,
  problemLabel,
  solutionLabel,
}: {
  pairs: ProblemSolutionPair[]
  problemLabel: string
  solutionLabel: string
}) {
  return (
    <div>
      <div className="hidden pb-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:gap-8">
        <span className="text-muted text-xs font-medium tracking-wide uppercase">
          {problemLabel}
        </span>
        <span className="w-4" aria-hidden="true" />
        <span className="text-foreground text-xs font-medium tracking-wide uppercase">
          {solutionLabel}
        </span>
      </div>

      <div className="border-border divide-border divide-y border-y">
        {pairs.map((pair, index) => (
          <Reveal key={pair.problem} delay={index * 70}>
            <div className="grid gap-3 py-6 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-8 sm:py-7">
              <p className="text-muted flex items-start gap-3">
                <X className="mt-1 size-4 shrink-0" aria-hidden="true" />
                <span className="text-pretty">{pair.problem}</span>
              </p>
              <ArrowRight className="text-muted/50 hidden size-4 sm:block" aria-hidden="true" />
              <p className="text-foreground flex items-start gap-3 font-medium">
                <Check className="text-accent-ink mt-1 size-4 shrink-0" aria-hidden="true" />
                <span className="text-pretty">{pair.solution}</span>
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  )
}
