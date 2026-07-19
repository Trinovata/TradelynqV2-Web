'use client'

import * as React from 'react'

/**
 * Theme control (spec v2/02 §2.6).
 *
 * Three settings — System, Light, Dark — defaulting to System, persisted per
 * user. The `.dark` class on <html> is what the token layer keys off.
 *
 * ## Two problems this solves, both easy to get subtly wrong
 *
 * **Flash of wrong theme.** A React provider cannot set the theme early enough;
 * it runs after hydration, so a dark-mode user sees a white page for one frame
 * on every navigation. `ThemeScript` is a blocking inline script in <head> that
 * applies the class before first paint. It duplicates a few lines of logic on
 * purpose — that is the cost of correctness, and the two are kept adjacent so
 * they cannot drift unnoticed.
 *
 * **Reading browser state.** Both `localStorage` and `matchMedia` are external
 * mutable stores, so they are read through `useSyncExternalStore` rather than
 * an effect that calls `setState`. That is what the hook is for: it gives a
 * correct server snapshot, subscribes properly, and avoids the
 * derived-state-in-effect pattern React 19 rejects (and which renders twice and
 * shows a stale value for one frame).
 */

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'tradelynq-theme'

/** Fired on the window so every hook instance re-reads after a change. */
const CHANGE_EVENT = 'tradelynq:theme-change'

type ThemeContextValue = {
  /** What the user chose. */
  preference: ThemePreference
  /** What is actually rendered right now, after resolving 'system'. */
  resolved: 'light' | 'dark'
  setPreference: (preference: ThemePreference) => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

/**
 * Runs before first paint. Must stay in sync with the resolution logic below.
 *
 * Wrapped in try/catch because localStorage throws in Safari private browsing;
 * a theme preference is never worth breaking the page over.
 */
export function ThemeScript() {
  const script = `
(function() {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var isDark = stored === 'dark' ||
      ((!stored || stored === 'system') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  } catch (e) {}
})();`

  // SECURITY: `dangerouslySetInnerHTML` is correct and safe here, and security
  // scanners will flag it on sight — so the argument is written down rather than
  // re-litigated each time:
  //
  //   * The script is a module-level template literal. The ONLY interpolation is
  //     ${STORAGE_KEY}, a hardcoded constant defined above in this file.
  //   * No prop, no request data, no user input reaches this string. There is no
  //     path by which a caller can influence it — ThemeScript takes no arguments.
  //   * It cannot be an external file or a deferred script: it must execute
  //     synchronously in <head> before first paint, or dark-mode users get a
  //     white flash on every navigation.
  //
  // If this ever gains a parameter, that reasoning collapses and it needs
  // revisiting. Keep it argument-free.
  return <script dangerouslySetInnerHTML={{ __html: script }} />
}

// ── The preference store (localStorage) ──────────────────────────────────────

function subscribeToPreference(onChange: () => void): () => void {
  // `storage` fires for changes in OTHER tabs; the custom event covers this one.
  window.addEventListener('storage', onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

function readPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    // Private browsing. Fall through to the default.
  }
  return 'system'
}

/**
 * The server has no localStorage, so it always renders the default. `ThemeScript`
 * has already applied the correct CLASS by the time this matters, so the markup
 * mismatch is invisible — which is why <html> carries suppressHydrationWarning.
 */
function serverPreference(): ThemePreference {
  return 'system'
}

// ── The system-preference store (matchMedia) ─────────────────────────────────

function subscribeToSystem(onChange: () => void): () => void {
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function readSystemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function serverSystemDark(): boolean {
  return false
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = React.useSyncExternalStore(
    subscribeToPreference,
    readPreference,
    serverPreference
  )

  // Subscribed even when the preference is explicit, so someone on an automatic
  // day/night schedule who later switches back to System is already current.
  const systemDark = React.useSyncExternalStore(subscribeToSystem, readSystemDark, serverSystemDark)

  const resolved: 'light' | 'dark' =
    preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  // Writing to the DOM is a genuine external side effect of rendering, which is
  // what useEffect is actually for — unlike copying a prop into state.
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    // Tells the browser to render native controls (scrollbars, form widgets) to
    // match. Without it, a dark page keeps white scrollbars.
    document.documentElement.style.colorScheme = resolved
  }, [resolved])

  const setPreference = React.useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Preference is lost on reload, but the session still works.
    }
    // Notifies every subscriber in this tab; `storage` only fires in others.
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  const value = React.useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used inside a ThemeProvider.')
  }
  return context
}
