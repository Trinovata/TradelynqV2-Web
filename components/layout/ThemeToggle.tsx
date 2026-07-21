'use client'

/**
 * Light / dark toggle for the site chrome.
 *
 * A single tactile control rather than a three-way segmented switch: most people
 * want "the other one", and one tap gives it to them. It flips against the
 * *resolved* theme, so a visitor on System who is currently in dark simply gets
 * light on the next tap — no need to understand the System/Light/Dark model to
 * use it. The icon shows the theme you would switch TO, which is the convention
 * people already read from every other app.
 */
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/layout/ThemeProvider'

export function ThemeToggle() {
  const { resolved, setPreference } = useTheme()
  const next = resolved === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="text-muted hover:text-foreground hover:bg-card-subtle focus-visible:outline-ring flex size-10 items-center justify-center rounded-[--radius-control] transition-[color,background-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {resolved === 'dark' ? (
        <Sun className="size-5" aria-hidden="true" />
      ) : (
        <Moon className="size-5" aria-hidden="true" />
      )}
    </button>
  )
}
