/**
 * The motion system (playbook S060, spec v2/02 §2.4).
 *
 * Every animation on the platform comes from here. The catalogue is CLOSED at
 * M1–M16 plus the Field — nothing else ships, and adding an entry requires a
 * decision record.
 *
 * Two rules the physics enforce:
 *
 *   1. **Only `transform` and `opacity` animate.** They are the two properties a
 *      browser can composite off the main thread. Animating width, height, top,
 *      or colour forces layout or paint on every frame, which is what "janky"
 *      actually means on a mid-range Android.
 *
 *   2. **Named properties, never `transition: all`.** `all` animates properties
 *      you never intended, including ones added later by an unrelated change,
 *      and defeats the rule above silently. CI greps for it.
 *
 * Durations are grouped by intent, not by feel: micro reads as instant, short
 * as responsive, medium as deliberate, long as a considered reveal.
 */

// ── Physics ──────────────────────────────────────────────────────────────────

export const DURATION = {
  /** 50–100ms — reads as instant. Presses, focus rings. */
  micro: 80,
  /** 150–250ms — reads as responsive. Hovers, dropdowns, tabs. */
  short: 150,
  /** 250–400ms — reads as deliberate. Modals, sheets, progress. */
  medium: 250,
  /** 400–700ms — a considered reveal. Count-ups, image settles. */
  long: 400,
} as const

export const EASING = {
  /** Entering the screen: fast out of the gate, settling gently. */
  enter: 'cubic-bezier(0, 0, 0.2, 1)',
  /** Leaving: slow to commit, then quick — exits should not linger. */
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  /** Moving between two on-screen positions. */
  move: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const

/** The only properties permitted in a transition. */
export const ANIMATABLE = ['transform', 'opacity'] as const

// ── The catalogue ────────────────────────────────────────────────────────────

export type MotionToken =
  | 'press'
  | 'hoverRaise'
  | 'focusRing'
  | 'fadeSlideIn'
  | 'modal'
  | 'sheet'
  | 'skeleton'
  | 'countUp'
  | 'statusMorph'
  | 'progressFill'
  | 'toast'
  | 'accordion'
  | 'checkPop'
  | 'tabSlide'
  | 'typeaheadReveal'
  | 'imageSettle'

type MotionSpec = {
  /** Catalogue number, for cross-referencing the spec and design review. */
  id: `M${number}`
  duration: number
  easing: string
  /** What triggers it. Kept here so a reviewer can check usage against intent. */
  trigger: string
  /** Tailwind classes implementing it, where it is expressible as utilities. */
  className?: string
}

export const MOTION: Record<MotionToken, MotionSpec> = {
  press: {
    id: 'M1',
    duration: DURATION.micro,
    easing: EASING.enter,
    trigger: 'any button or interactive card :active',
    className: 'transition-transform duration-75 ease-out active:scale-[0.98]',
  },
  hoverRaise: {
    id: 'M2',
    duration: DURATION.short,
    easing: EASING.move,
    trigger: 'interactive cards on hover',
    className:
      'transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-sm',
  },
  focusRing: {
    id: 'M3',
    duration: 100,
    easing: EASING.enter,
    trigger: ':focus-visible',
    // Implemented globally in globals.css so it can never be forgotten per-component.
    className: 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  },
  fadeSlideIn: {
    id: 'M4',
    duration: DURATION.short,
    easing: EASING.enter,
    trigger: 'dropdowns, popovers, tooltips',
    className: 'transition-[opacity,transform] duration-150 ease-out',
  },
  modal: {
    id: 'M5',
    duration: DURATION.medium,
    easing: EASING.enter,
    trigger: 'dialog open/close',
    className: 'transition-[opacity,transform] duration-250 ease-out',
  },
  sheet: {
    id: 'M6',
    duration: 300,
    easing: EASING.enter,
    trigger: 'mobile bottom sheet / drawer; drag-to-dismiss snaps at 30%',
    className: 'transition-transform duration-300 ease-out',
  },
  skeleton: {
    id: 'M7',
    duration: 1200,
    easing: EASING.move,
    // Must mirror the real content's geometry exactly, or the swap shifts layout.
    trigger: 'data loading — pulse in the content’s exact geometry',
    className: 'animate-pulse',
  },
  countUp: {
    id: 'M8',
    duration: DURATION.long,
    easing: EASING.enter,
    trigger: 'dashboard stat numbers, first view only, once per session',
  },
  statusMorph: {
    id: 'M9',
    duration: DURATION.short,
    easing: EASING.move,
    trigger: 'badge state change in place',
  },
  progressFill: {
    id: 'M10',
    duration: DURATION.long,
    easing: EASING.move,
    // scaleX, not width: width animates layout, scaleX composites.
    trigger: 'profile strength, credit usage',
    className: 'origin-left transition-transform duration-400 ease-in-out',
  },
  toast: {
    id: 'M11',
    duration: 200,
    easing: EASING.enter,
    trigger: 'notification enter/exit',
    className: 'transition-[opacity,transform] duration-200 ease-out',
  },
  accordion: {
    id: 'M12',
    duration: 200,
    easing: EASING.move,
    trigger: 'FAQ, filter groups — grid-rows technique',
    className: 'transition-[grid-template-rows] duration-200 ease-in-out',
  },
  checkPop: {
    id: 'M13',
    duration: 300,
    easing: EASING.enter,
    // The platform's one moment of delight. Reserved for genuine completion —
    // enquiry sent, quote accepted. Using it decoratively spends the effect.
    trigger: 'genuine completion moments ONLY',
  },
  tabSlide: {
    id: 'M14',
    duration: 200,
    easing: EASING.move,
    trigger: 'tab switches — indicator slides, panels crossfade',
    className: 'transition-transform duration-200 ease-in-out',
  },
  typeaheadReveal: {
    id: 'M15',
    duration: DURATION.short,
    easing: EASING.enter,
    trigger: 'search suggestions — items stagger 20ms, max 5 staggered',
  },
  imageSettle: {
    id: 'M16',
    duration: 300,
    easing: EASING.enter,
    // Aspect-ratio boxes must be pre-reserved or this causes the CLS it hides.
    trigger: 'portfolio/gallery image load — blur-up',
    className: 'transition-[filter,transform] duration-300 ease-out',
  },
} as const

/** Stagger step for M15. Beyond five items the cascade reads as slow, not lively. */
export const STAGGER_MS = 20
export const STAGGER_MAX_ITEMS = 5

/**
 * Returns the Tailwind classes for a motion token.
 *
 * Prefer this over hand-writing transition utilities: it keeps the catalogue
 * enforceable and makes the design review greppable.
 */
export function motion(token: MotionToken): string {
  return MOTION[token].className ?? ''
}

/**
 * Builds a CSS transition string from named properties only.
 *
 * Deliberately cannot express `all` — the parameter is typed to the two
 * compositable properties, so the banned pattern is unrepresentable rather than
 * merely discouraged.
 */
export function transition(
  properties: ReadonlyArray<(typeof ANIMATABLE)[number]>,
  duration: number = DURATION.short,
  easing: string = EASING.move
): string {
  return properties.map((property) => `${property} ${duration}ms ${easing}`).join(', ')
}
