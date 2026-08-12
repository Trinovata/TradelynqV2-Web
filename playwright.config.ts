import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright rig (playbook S073).
 *
 * Preconditions for a local run:
 *   1. `npx supabase start`  — local stack up (Docker)
 *   2. `npm run db:seed`     — deterministic dev seed (idempotent)
 *   3. `npm run e2e`         — starts `npm run dev` itself if :3000 is free
 *
 * CI (`.github/workflows/ci.yml` e2e job) runs `npm run e2e` and uploads
 * `playwright-report/` — the HTML reporter below must keep that output folder.
 *
 * Visual baselines are platform-specific (font rasterisation differs between
 * win32 and linux), so `snapshotPathTemplate` includes `{platform}` and the
 * visual spec skips itself in CI until linux baselines are generated there
 * with UPDATE_SNAPSHOTS=1 — see e2e/visual-baseline.spec.ts.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}',

  // Dev-mode first compiles of a route can take tens of seconds; these budgets
  // absorb that without masking a genuinely hung page.
  timeout: 90_000,
  expect: { timeout: 20_000 },

  use: {
    baseURL: 'http://localhost:3000',
    // Every animated component in the codebase respects prefers-reduced-motion
    // (motion-safe: variants and matchMedia checks), so this is the single
    // switch that holds the page still for screenshots.
    contextOptions: { reducedMotion: 'reduce' },
    navigationTimeout: 60_000,
    trace: 'on-first-retry',
  },

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // The 375px covenant viewport — every public surface must hold here.
      name: 'mobile-375',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 812 },
        // dpr 1, not a phone-realistic 2: element screenshots at dpr 2 hit a
        // half-pixel scaling artefact (327 vs 328px captures of the same
        // section) that made baselines unstable. Layout regressions — the
        // thing this project guards — are dpr-independent.
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
})
