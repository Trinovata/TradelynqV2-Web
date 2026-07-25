import { test, expect, type Page } from '@playwright/test'
import { setTheme, hideDevOverlay, type Theme } from './helpers'

/**
 * Visual baselines (playbook S073).
 *
 * Coverage: /dev/kit (one screenshot per <Section>), plus full-page shots of
 * the landing page, the seeded storefront, and /pricing — each on the
 * `chromium` (desktop) and `mobile-375` projects, in both themes: 4 variants
 * per surface.
 *
 * PRECONDITIONS: same as public-smoke.spec.ts — `npx supabase start` +
 * `npm run db:seed`. The landing page and storefront render seeded data.
 *
 * PLATFORM SCOPE: baselines are rasterisation-specific, so they live under
 * e2e/__screenshots__/{platform}/ (see snapshotPathTemplate). The committed
 * set is win32 (local dev). In CI (linux) this spec SKIPS until linux
 * baselines are generated in a CI run with UPDATE_SNAPSHOTS=1 and
 * `--update-snapshots`, then committed. A missing-baseline failure in CI
 * would be noise, not signal.
 *
 * STABILITY: every animated component honours prefers-reduced-motion, which
 * the Playwright context forces (playwright.config.ts). Time-dependent
 * regions — review dates and the BusinessHours open/closed state — are
 * masked because they drift with the clock, not with the code.
 */

const THEMES: Theme[] = ['light', 'dark']
const SCREENSHOT_OPTIONS = { animations: 'disabled' as const, maxDiffPixelRatio: 0.01 }

test.beforeEach(async ({ page }) => {
  test.skip(
    !!process.env.CI && !process.env.UPDATE_SNAPSHOTS,
    'Visual baselines are platform-specific; committed set is win32. Generate linux baselines in CI with UPDATE_SNAPSHOTS=1 --update-snapshots.'
  )
  await hideDevOverlay(page)
})

/** Settle web fonts and lazy images before any pixel comparison. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
}

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await setTheme(page, theme)
    })

    test(`component kit sections — ${theme}`, async ({ page }) => {
      await page.goto('/dev/kit')
      await settle(page)

      const sections = page.locator('main > section')
      const count = await sections.count()
      expect(count, 'the /dev/kit gallery should have its Section blocks').toBeGreaterThan(10)

      for (let index = 0; index < count; index++) {
        const section = sections.nth(index)
        const title = await section.locator('h2').first().innerText()
        const slug = title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')

        // Clipped page screenshot rather than an element screenshot: element
        // capture of a fractional bounding box proved unstable (the same
        // section captured 327px wide on one run and 328px on the next).
        // Flooring the box to integers makes the capture geometry
        // deterministic by construction.
        const box = await section.evaluate((el) => {
          const rect = el.getBoundingClientRect()
          return {
            x: rect.x + window.scrollX,
            y: rect.y + window.scrollY,
            width: rect.width,
            height: rect.height,
          }
        })

        // Index-prefixed: section titles are not unique (the gallery currently
        // carries two "Pricing" sections), and a name collision makes two
        // different sections fight over one baseline file.
        const ordinal = String(index + 1).padStart(2, '0')
        await expect(page).toHaveScreenshot(`kit-${ordinal}-${slug}-${theme}.png`, {
          ...SCREENSHOT_OPTIONS,
          fullPage: true,
          clip: {
            x: Math.floor(box.x),
            y: Math.floor(box.y),
            width: Math.floor(box.width),
            height: Math.floor(box.height),
          },
        })
      }
    })

    test(`landing page — ${theme}`, async ({ page }) => {
      await page.goto('/')
      await settle(page)
      await expect(page).toHaveScreenshot(`landing-${theme}.png`, {
        ...SCREENSHOT_OPTIONS,
        fullPage: true,
      })
    })

    test(`storefront — ${theme}`, async ({ page }) => {
      await page.goto('/professionals/anisa-nails-pos')
      await settle(page)
      await expect(page).toHaveScreenshot(`storefront-anisa-${theme}.png`, {
        ...SCREENSHOT_OPTIONS,
        fullPage: true,
        mask: [
          // Review dates render relative to the seed's now()-based intervals —
          // they drift daily. The date is the mono span in each card header.
          page.locator('article header span.font-mono'),
          // Open/closed state depends on the wall clock in Port of Spain.
          page.locator('section:has(> h2:text-is("Business hours"))'),
        ],
      })
    })

    test(`pricing — ${theme}`, async ({ page }) => {
      await page.goto('/pricing')
      await settle(page)
      await expect(page).toHaveScreenshot(`pricing-${theme}.png`, {
        ...SCREENSHOT_OPTIONS,
        fullPage: true,
      })
    })
  })
}
