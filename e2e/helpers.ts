import type { Page } from '@playwright/test'

export type Theme = 'light' | 'dark'

/**
 * Force a theme BEFORE navigation. The app's theme is a `.dark` class applied
 * by ThemeScript from the `tradelynq-theme` localStorage key (see
 * components/layout/ThemeProvider.tsx) — `emulateMedia` alone cannot flip it
 * once a stored preference exists, so we write the preference the script reads.
 */
export async function setTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem('tradelynq-theme', value)
    } catch {
      // Storage unavailable — ThemeScript falls back to prefers-color-scheme.
    }
  }, theme)
}

/**
 * Hide the Next.js dev-tools indicator (<nextjs-portal>) so it never appears
 * in screenshots. No-op against a production server.
 */
export async function hideDevOverlay(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const style = document.createElement('style')
    style.textContent = 'nextjs-portal { display: none !important; }'
    document.addEventListener('DOMContentLoaded', () => {
      document.head.appendChild(style)
    })
  })
}
