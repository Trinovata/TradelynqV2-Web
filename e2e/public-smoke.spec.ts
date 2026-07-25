import { test, expect, request as playwrightRequest } from '@playwright/test'
import { hideDevOverlay } from './helpers'

/**
 * Public-surface smoke (playbook S073).
 *
 * PRECONDITIONS — the spec asserts against the deterministic dev seed:
 *   1. `npx supabase start`   (local Supabase stack in Docker)
 *   2. `npm run db:seed`      (idempotent — supabase/seed-dev.sql)
 *
 * The beforeAll guard below fails fast with a clear message when the seed is
 * absent, so a missing seed reads as one instruction, not four cryptic
 * assertion failures.
 *
 * Seeded fixtures relied on here (supabase/seed-dev.sql):
 *   - `persad-plumbing`  — Persad Plumbing Co., active plumber, must rank
 *     for "plumbing".
 *   - `anisa-nails-pos`  — Anisa Nails, fully verified, active.
 *   - `tricia-cleaning`  — Tricia Lewis Cleaning, DRAFT listing. The leak
 *     canary: it must NEVER surface in public search.
 */

test.beforeAll(async () => {
  const api = await playwrightRequest.newContext({ baseURL: 'http://localhost:3000' })
  try {
    const response = await api.get('/search?q=plumbing', { timeout: 60_000 })
    const html = await response.text()
    if (!html.includes('Persad Plumbing')) {
      throw new Error(
        'Seed data missing: /search?q=plumbing did not return "Persad Plumbing Co.". ' +
          'Run `npx supabase start` then `npm run db:seed` before `npm run e2e`.'
      )
    }
  } finally {
    await api.dispose()
  }
})

test.beforeEach(async ({ page }) => {
  await hideDevOverlay(page)
})

test('landing page renders hero and navbar', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { level: 1, name: /Whatever you need done/ })
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'TradeLynq home' })).toBeVisible()
})

test('search surfaces seeded professionals and never leaks drafts', async ({ page }) => {
  await page.goto('/search?q=plumbing')
  await expect(page.getByText('Persad Plumbing Co.').first()).toBeVisible()
  // The leak canary: draft listings must never appear in public search.
  await expect(page.getByText('Tricia Lewis Cleaning')).toHaveCount(0)
})

test('storefront renders heading and action rail', async ({ page }) => {
  await page.goto('/professionals/anisa-nails-pos')
  await expect(page.getByRole('heading', { level: 1, name: 'Anisa Nails' })).toBeVisible()
  // Desktop: sticky rail. Mobile 375px: fixed bottom bar. Both carry the
  // "Request a quote" action, so the same assertion holds on both projects.
  await expect(page.getByRole('button', { name: 'Request a quote' }).first()).toBeVisible()
})

test('invalid document token shows the one invalid state (deck §14.4)', async ({ page }) => {
  await page.goto('/q/not-a-real-token')
  // Copy asserted VERBATIM from copy-public.md §14.4 / components/shared/TokenInvalid.tsx.
  await expect(page.getByRole('heading', { level: 1, name: 'This link isn’t valid' })).toBeVisible()
  await expect(
    page.getByText(
      'It may have expired or been replaced. Contact the professional for an up-to-date link.'
    )
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Chat on WhatsApp' })).toBeVisible()
})
