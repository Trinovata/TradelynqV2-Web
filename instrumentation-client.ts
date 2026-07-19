/**
 * Client instrumentation — Sentry (errors) and PostHog (product analytics).
 *
 * Both no-op without their keys, so local development and any environment before
 * playbook S004 runs clean rather than throwing or logging noise.
 */
import posthog from 'posthog-js'
import * as Sentry from '@sentry/nextjs'

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: process.env.VERCEL_ENV === 'production' ? 0.1 : 1.0,
    sendDefaultPii: false,

    // Session Replay is deliberately NOT enabled. This platform renders identity
    // documents, KYC selfies, and payment state; replaying those sessions would
    // create a copy of exactly the data we are obliged to protect. Revisit only with
    // strict masking and a privacy review.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  })
}

if (posthogKey) {
  posthog.init(posthogKey, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',

    // Page views are captured manually so App Router client-side navigations are
    // recorded correctly — automatic capture misses them, since there is no full
    // document load between routes.
    capture_pageview: false,
    capture_pageleave: true,

    // Masks all text and inputs in any recording. Belt and braces alongside the
    // Sentry replay decision above.
    session_recording: {
      maskAllInputs: true,
    },

    persistence: 'localStorage+cookie',
  })
}

/** Required by Next 16 to report client-side navigation timings. */
export const onRouterTransitionStart = sentryDsn ? Sentry.captureRouterTransitionStart : () => {}
