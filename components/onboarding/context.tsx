'use client'

/**
 * Onboarding state (playbook S107, spec `v2/05 §5.2`).
 *
 * One draft object, one setter, shared by five step components and the live
 * preview. Context rather than prop-drilling because the preview needs the same
 * state as the form and sits in a different subtree — threading it through
 * would make every step aware of a panel it does not own.
 *
 * ## The two-layer save
 *
 * localStorage writes on every change (synchronous, survives a crashed tab or a
 * closed laptop); the server save is debounced to 900ms (durable, cross-device,
 * and what the 24h abandonment nudge reads). The spec asks for localStorage; the
 * server row is what makes "start on the phone, finish on the laptop" work.
 *
 * Server saves are strictly ordered by a sequence number rather than by arrival:
 * a slow save must never land on top of a faster, newer one and resurrect text
 * the professional already deleted.
 */
import * as React from 'react'
import {
  ONBOARDING_STORAGE_KEY,
  emptyDraft,
  type OnboardingDraft,
} from '@/lib/professional/onboarding'
import type { CategoryOption } from '@/lib/professional/onboarding-server'
import { track } from '@/lib/analytics/events'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

type OnboardingValue = {
  draft: OnboardingDraft
  update: (patch: Partial<OnboardingDraft>) => void
  step: number
  setStep: (step: number) => void
  categories: CategoryOption[]
  subtype: 'student_entrepreneur' | 'sole_trader' | 'registered_business' | null
  userId: string
  saveState: SaveState
  /** Forces the pending save to land now. Awaited before publish. */
  flush: () => Promise<void>
  /** Set when a draft was restored from this browser, for the dated note. */
  restoredAt: string | null
  dismissRestoreNote: () => void
}

const OnboardingContext = React.createContext<OnboardingValue | null>(null)

export function useOnboarding(): OnboardingValue {
  const value = React.useContext(OnboardingContext)
  if (!value) throw new Error('useOnboarding must be used inside <OnboardingProvider>')
  return value
}

type StoredDraft = { savedAt: string; draft: OnboardingDraft }

function readStored(): StoredDraft | null {
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const candidate = parsed as StoredDraft
    if (!candidate.draft || typeof candidate.draft !== 'object') return null
    // Merged over a fresh empty draft, so a stored blob written by an older
    // build cannot leave a field undefined and crash a step on `.trim()`.
    return { savedAt: candidate.savedAt, draft: { ...emptyDraft(), ...candidate.draft } }
  } catch {
    return null
  }
}

/**
 * localStorage, read as an external store rather than in an effect.
 *
 * The server cannot see localStorage, so the first client render has to differ
 * from the server's — which is precisely what `useSyncExternalStore` exists to
 * reconcile. Doing it with `useEffect(() => setDraft(stored))` instead would
 * work, but it is a cascading render on every mount and React's lint rule flags
 * it correctly.
 *
 * The snapshot is cached because `useSyncExternalStore` compares by reference:
 * parsing JSON afresh on each call returns a new object every time and spins.
 * Caching also makes the restore a one-shot — later writes to localStorage are
 * ours, and re-reading them would fight the state they came from.
 */
let snapshotCache: StoredDraft | null | undefined
const EMPTY_SNAPSHOT = null

function getStoredSnapshot(): StoredDraft | null {
  if (snapshotCache === undefined) snapshotCache = readStored()
  return snapshotCache
}

/** Nothing else writes this key, so there is nothing to subscribe to. */
function subscribeToNothing(): () => void {
  return () => {}
}

export function OnboardingProvider({
  initialDraft,
  initialStep,
  categories,
  subtype,
  userId,
  hasServerDraft,
  children,
}: {
  initialDraft: OnboardingDraft
  initialStep: number
  categories: CategoryOption[]
  subtype: 'student_entrepreneur' | 'sole_trader' | 'registered_business' | null
  userId: string
  /** True when a draft row already exists — the server copy then wins on load. */
  hasServerDraft: boolean
  children: React.ReactNode
}) {
  // The server row is authoritative when it exists: it is the copy that
  // survived a device change, and the browser copy may belong to a different
  // session on a shared machine. Only a professional with no row yet gets the
  // localStorage restore.
  const stored = React.useSyncExternalStore(
    subscribeToNothing,
    getStoredSnapshot,
    () => EMPTY_SNAPSHOT
  )
  const restored = hasServerDraft ? null : stored

  // The starting point: server row, restored browser draft, or empty. Stable
  // across renders so `edits` can spread it without re-seeding.
  const seed = React.useMemo(() => restored?.draft ?? initialDraft, [restored, initialDraft])

  const [edits, setEdits] = React.useState<OnboardingDraft | null>(null)
  const [step, setStepState] = React.useState(initialStep)
  const [saveState, setSaveState] = React.useState<SaveState>('idle')
  const [noteDismissed, setNoteDismissed] = React.useState(false)

  const draft = edits ?? seed
  const restoredAt = restored && !noteDismissed ? restored.savedAt : null

  const sequence = React.useRef(0)
  const lastLanded = React.useRef(0)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = React.useRef<OnboardingDraft | null>(null)
  // Stamped after mount rather than at render: `Date.now()` in a render body is
  // impure, and the value is only ever read from an event handler anyway.
  const stepEnteredAt = React.useRef<number | null>(null)
  React.useEffect(() => {
    stepEnteredAt.current ??= Date.now()
  }, [])

  /**
   * Step changes go through here so the drop-off telemetry the spec asks for
   * (`onboarding_step_completed{step, ms}`) is emitted from one place. Only
   * FORWARD moves count as completing a step — going back to fix a typo is not
   * a second completion, and counting it would inflate every funnel stage.
   */
  const setStep = React.useCallback(
    (next: number) => {
      if (next > step) {
        const enteredAt = stepEnteredAt.current
        track('onboarding_step_completed', {
          step,
          ms_on_step: enteredAt === null ? 0 : Date.now() - enteredAt,
        })
      }
      stepEnteredAt.current = Date.now()
      setStepState(next)
    },
    [step]
  )

  const save = React.useCallback(async (next: OnboardingDraft, atStep: number) => {
    const ticket = ++sequence.current
    setSaveState('saving')
    try {
      const response = await fetch('/api/professional/onboarding', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          step: atStep,
          businessName: next.businessName,
          ownerName: next.ownerName,
          categoryId: next.categoryId,
          serviceAreas: next.serviceAreas,
          yearsExperience: next.yearsExperience,
          subtypeDocPath: next.subtypeDocPath,
          birNumber: next.birNumber,
          profilePhotoUrl: next.profilePhotoUrl,
          bio: next.bio,
          services: next.services,
          portfolioUrls: next.portfolioUrls,
          contactWhatsapp: next.contactWhatsapp,
        }),
      })

      // A stale response must not overwrite the state a newer save already
      // reported. Out-of-order network responses are the normal case on mobile.
      if (ticket < lastLanded.current) return
      lastLanded.current = ticket

      if (!response.ok) {
        setSaveState('error')
        return
      }
      setSaveState('saved')
    } catch {
      if (ticket >= lastLanded.current) setSaveState('error')
    }
  }, [])

  const update = React.useCallback(
    (patch: Partial<OnboardingDraft>) => {
      setEdits((previous) => {
        const next = { ...(previous ?? seed), ...patch }
        pending.current = next

        try {
          window.localStorage.setItem(
            ONBOARDING_STORAGE_KEY,
            JSON.stringify({ savedAt: new Date().toISOString(), draft: next } satisfies StoredDraft)
          )
        } catch {
          // A full or disabled localStorage is not a reason to stop working —
          // the server save below is the durable copy either way.
        }

        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => {
          timer.current = null
          pending.current = null
          void save(next, step)
        }, 900)

        return next
      })
    },
    [save, step, seed]
  )

  /** Commit anything still in the debounce window. Called before Continue and
   *  before Publish, so the server never lags the screen at a decision point. */
  const flush = React.useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const next = pending.current
    pending.current = null
    if (next) await save(next, step)
  }, [save, step])

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  // "Saved" is a confirmation, not a status — it fades so the form does not
  // carry a permanent green tick nobody reads after the second time.
  React.useEffect(() => {
    if (saveState !== 'saved') return
    const id = setTimeout(() => setSaveState('idle'), 2200)
    return () => clearTimeout(id)
  }, [saveState])

  const value = React.useMemo<OnboardingValue>(
    () => ({
      draft,
      update,
      step,
      setStep,
      categories,
      subtype,
      userId,
      saveState,
      flush,
      restoredAt,
      dismissRestoreNote: () => setNoteDismissed(true),
    }),
    [draft, update, step, setStep, categories, subtype, userId, saveState, flush, restoredAt]
  )

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}
