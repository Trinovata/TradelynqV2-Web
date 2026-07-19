/**
 * The analytics event contract.
 *
 * Single source of event names and property types for all three clients (web, iOS,
 * Android) and for server emissions. UI and API code import ONLY from here — an event
 * that is not in this file cannot be emitted, and drift in an event's shape is a
 * compile error rather than a silently malformed row six weeks later.
 *
 * Source of truth: `TradeLynq-Docs/v2/details/analytics-events.md`. On any conflict
 * about an event, that file wins; adding an event is one PR touching both.
 *
 * ## PII discipline (spec §1 and §13 — read before adding a property)
 *
 * No property here may carry names, phone numbers, email addresses, physical
 * addresses, document URLs, or free-text user content. Every property is `none`
 * (safe aggregate) or `pseudo` (an id linkable only internally). Description
 * *lengths* are analytics; description *text* is personal data we have no business
 * copying into a third-party warehouse. Decline reasons travel as canned
 * `reason_code` keys, never the text behind them.
 *
 * The single deliberate exception is `search_performed.q` — see the note there.
 *
 * ## Envelope
 *
 * Envelope properties (platform, session, identity, tier, timestamp) are attached by
 * the transport, not by call sites, and are therefore never repeated in `EventProps`.
 */

import posthog from 'posthog-js'

import { logger } from '@/lib/utils/logger'

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

/** Surface the event was emitted from. Part of the envelope. */
export type Platform = 'web' | 'app_customer' | 'app_business' | 'admin'

/** Envelope role. `null` before authentication. */
export type EnvelopeRole = 'customer' | 'professional' | 'admin' | null

/** Professional account type. `null` for customers and admins. */
export type AccountSubtype = 'student' | 'sole_trader' | 'registered' | null

/** Subscription tiers, lowercase slugs (`lib/constants/pricing.ts` is the price truth). */
export type TierName = 'presence' | 'growth' | 'studio' | 'pro' | 'enterprise'

/** Account type chosen at checkout — the non-nullable form of {@link AccountSubtype}. */
export type AccountType = 'student' | 'sole_trader' | 'registered'

export type TrafficSource = 'organic' | 'direct' | 'social' | 'referral' | 'ad' | 'share'

export type SignupMethod = 'google' | 'email'

/** The role a user picks at signup. Admin is granted, never self-selected. */
export type SignupRole = 'customer' | 'professional'

export type SearchSort = 'recommended' | 'highest_rated' | 'most_reviewed'

/**
 * Availability filter values, as carried in the search URL params.
 *
 * These are the members of the `availability_type` Postgres enum, not a guess:
 * the analytics dictionary shows only `full_time` and no chapter enumerates the
 * rest, but V1's schema has carried the full set all along. Code is truth for
 * what exists; the enum was the answer.
 *
 * Must stay in lockstep with `availability_type` in the enums migration.
 */
export type Availability = 'full_time' | 'part_time' | 'project_based' | 'by_appointment'

export type SuggestionKind = 'professional' | 'category' | 'area' | 'recent'

/** `reg_guide` is the registration-funnel addendum kind (spec §11, Flags). */
export type CategoryViewKind = 'parent' | 'category_area' | 'reg_guide'

export type ProfileViewSource =
  | 'search'
  | 'landing'
  | 'category'
  | 'catalogue'
  | 'share'
  | 'direct'
  | 'saved'
  | 'recommendation'
  | 'ad'

export type CataloguePostSource = 'feed' | 'profile'

export type ShareEntity = 'profile' | 'post' | 'storefront_own'

export type ShareChannel = 'whatsapp' | 'facebook' | 'x' | 'linkedin' | 'copy' | 'native'

export type KycState = 'not_required' | 'required' | 'pending' | 'verified' | 'rejected'

export type KycOutcome = 'verified' | 'rejected'

export type ContactPref = 'whatsapp' | 'phone' | 'email'

export type EnquirySource = 'storefront' | 'post' | 'app'

export type EnquiryState =
  'pending' | 'accepted' | 'in_progress' | 'completed' | 'declined' | 'cancelled'

/** Who drove a state-machine transition. */
export type StateChangeActor = 'customer' | 'professional' | 'system'

export type WhatsAppContext =
  'storefront' | 'enquiry' | 'quote' | 'invoice' | 'support' | 'share_nudge'

export type QuoteOutcome = 'accepted' | 'declined'

export type JobState = 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

/** Where the job came from — the off-platform values are what make shadow-revenue visible. */
export type JobSource = 'platform' | 'whatsapp' | 'phone' | 'walk_in' | 'referral' | 'other'

export type AiTool = 'ai_reply' | 'bio_draft' | 'content'

export type CreditBundle = 'b100' | 'b300' | 'b1000'

export type SubscriptionEntry = 'pioneer' | 'intro' | 'standard'

export type PaymentMethod = 'stripe' | 'wipay' | 'manual'

export type TierChangeDirection = 'up' | 'down'

export type CancellationReason = 'nonpayment' | 'voluntary' | 'admin'

export type CrossoverNoticeType = 'T30' | 'T7'

/** Delivery channels the notification dispatcher supports. */
export type NotificationChannel = 'email' | 'whatsapp' | 'push' | 'webhook'

export type ReviewModerationOutcome = 'approved' | 'featured' | 'rejected'

export type DisputeKind = 'review' | 'general'

export type DisputeOutcome = 'stands' | 'removed' | 'revised' | 'resolved' | 'closed'

export type VerificationStep = 'id' | 'insurance' | 'phone' | 'fully_verified'

export type AdReviewOutcome = 'approved' | 'rejected'

export type PostEngagementKind = 'save' | 'share' | 'enquire'

export type ReportableEntity = 'post' | 'comment' | 'review' | 'profile'

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

/**
 * Attached to every event by the transport. Call sites never pass these, which is why
 * no key below may also appear in an `EventProps` entry.
 */
export interface EventEnvelope {
  platform: Platform
  /** Session uuid, rotated per session. */
  session_id: string
  /** `null` before authentication. Identity stitches anonymous → user on login. */
  user_id: string | null
  /** Device uuid, carried pre-auth so the funnel survives the signup boundary. */
  anonymous_id: string
  role: EnvelopeRole
  subtype: AccountSubtype
  /** Professional events only. */
  tier?: TierName
  /** ISO-8601, UTC. */
  ts: string
}

// ---------------------------------------------------------------------------
// Event names
// ---------------------------------------------------------------------------

/**
 * Every event on the platform, exactly once. The object exists so call sites can
 * reference `EVENTS.enquiry_created` instead of a bare string literal and get a
 * rename-safe reference.
 */
export const EVENTS = {
  // Acquisition & activation
  visit_landed: 'visit_landed',
  signup_started: 'signup_started',
  signup_completed: 'signup_completed',
  onboarding_step_completed: 'onboarding_step_completed',
  onboarding_abandoned: 'onboarding_abandoned',
  onboarding_completed: 'onboarding_completed',
  pioneer_enrolled: 'pioneer_enrolled',

  // Discovery
  search_performed: 'search_performed',
  search_zero_results: 'search_zero_results',
  suggestion_clicked: 'suggestion_clicked',
  category_viewed: 'category_viewed',
  profile_viewed: 'profile_viewed',
  catalogue_post_viewed: 'catalogue_post_viewed',
  share_clicked: 'share_clicked',
  save_toggled: 'save_toggled',

  // Connection & conversation
  reveal_clicked: 'reveal_clicked',
  reveal_completed: 'reveal_completed',
  kyc_prompted: 'kyc_prompted',
  kyc_submitted: 'kyc_submitted',
  kyc_decided: 'kyc_decided',
  enquiry_created: 'enquiry_created',
  enquiry_viewed_by_pro: 'enquiry_viewed_by_pro',
  enquiry_status_changed: 'enquiry_status_changed',
  whatsapp_clicked: 'whatsapp_clicked',

  // Commerce
  quote_sent: 'quote_sent',
  quote_viewed: 'quote_viewed',
  quote_responded: 'quote_responded',
  job_status_changed: 'job_status_changed',
  invoice_sent: 'invoice_sent',
  invoice_viewed: 'invoice_viewed',
  invoice_paid: 'invoice_paid',
  crm_contact_viewed: 'crm_contact_viewed',
  ai_tool_used: 'ai_tool_used',
  credits_purchased: 'credits_purchased',

  // Revenue & lifecycle
  checkout_started: 'checkout_started',
  subscription_started: 'subscription_started',
  subscription_tier_changed: 'subscription_tier_changed',
  payment_failed: 'payment_failed',
  payment_recovered: 'payment_recovered',
  subscription_cancelled: 'subscription_cancelled',
  pioneer_converted: 'pioneer_converted',
  crossover_notice_sent: 'crossover_notice_sent',
  crossover_rate_applied: 'crossover_rate_applied',
  registration_lead_from_crossover: 'registration_lead_from_crossover',
  lifecycle_message_sent: 'lifecycle_message_sent',
  lifecycle_message_clicked: 'lifecycle_message_clicked',

  // Reviews & trust
  review_submitted: 'review_submitted',
  review_moderated: 'review_moderated',
  review_disputed: 'review_disputed',
  dispute_resolved: 'dispute_resolved',
  verification_step_completed: 'verification_step_completed',

  // Ads
  ad_impression: 'ad_impression',
  ad_click: 'ad_click',
  ad_submitted: 'ad_submitted',
  ad_review_decided: 'ad_review_decided',

  // Community — reserved; do not emit before the chapter 16 go-gate
  post_created: 'post_created',
  post_viewed: 'post_viewed',
  post_engaged: 'post_engaged',
  follow_toggled: 'follow_toggled',
  comment_created: 'comment_created',
  content_reported: 'content_reported',

  // Admin & system
  admin_action: 'admin_action',
  cron_run: 'cron_run',
  notification_delivered: 'notification_delivered',
  webhook_delivery: 'webhook_delivery',
  rate_limit_hit: 'rate_limit_hit',
} as const

export type EventName = keyof typeof EVENTS

// ---------------------------------------------------------------------------
// Event properties
// ---------------------------------------------------------------------------

/**
 * One entry per event, matching the property tables in the spec. Optional keys are the
 * ones the spec leaves unticked in its `req` column; a property that is required but
 * may legitimately be absent (`reason_code` on an approval, `enquiry_id` on a
 * standalone quote) is required-and-nullable, so a missing value is a stated null
 * rather than a key someone forgot.
 */
export interface EventProps {
  // -- Acquisition & activation ---------------------------------------------

  visit_landed: {
    source: TrafficSource
    utm_source?: string | null
    utm_medium?: string | null
    utm_campaign?: string | null
    /** Path only — query strings can carry anything a user typed. */
    landing_path: string
  }

  signup_started: {
    method: SignupMethod
  }

  signup_completed: {
    method: SignupMethod
    role: SignupRole
    /** Required, `null` for customers. */
    subtype: AccountSubtype
  }

  onboarding_step_completed: {
    /** 1–5. */
    step: number
    ms_on_step: number
  }

  onboarding_abandoned: {
    last_step: number
    hours_since_start: number
  }

  onboarding_completed: {
    total_ms: number
    photos_added: number
    seeded_reviews: number
  }

  pioneer_enrolled: {
    /** Launch cohort is 1; reserved for future cohorts. */
    cohort: number
    /** Child-category slug — drives the 3-per-category fill board. */
    category: string
    /** Overall cohort position, 1–180. */
    position: number
  }

  // -- Discovery ------------------------------------------------------------

  search_performed: {
    /**
     * The ONLY free-text property in this dictionary. Queries are product content,
     * not personal data, and the zero-result board is worthless without them.
     * Lowercase, truncated to {@link SEARCH_QUERY_MAX_LEN} characters. Nothing else
     * anywhere may carry user text — if counsel objects to this one, drop to `q_len`
     * and this stays a one-line change.
     */
    q: string
    q_len: number
    category?: string | null
    parent?: string | null
    area?: string | null
    rating_min?: number | null
    availability?: Availability[]
    result_count: number
    sort: SearchSort
  }

  /** Companion to `search_performed` for the health board — same shape, no result count. */
  search_zero_results: Omit<EventProps['search_performed'], 'result_count'>

  suggestion_clicked: {
    kind: SuggestionKind
    /** 1-based within its group. */
    position: number
  }

  category_viewed: {
    slug: string
    kind: CategoryViewKind
  }

  profile_viewed: {
    professional_id: string
    source: ProfileViewSource
    /** Present when the view came from a ranked list. */
    position?: number | null
  }

  catalogue_post_viewed: {
    post_id: string
    source: CataloguePostSource
  }

  share_clicked: {
    entity: ShareEntity
    entity_id: string
    channel: ShareChannel
  }

  save_toggled: {
    professional_id: string
    on: boolean
  }

  // -- Connection & conversation --------------------------------------------

  reveal_clicked: {
    professional_id: string
  }

  reveal_completed: {
    professional_id: string
    /** Position on the gate ladder: 1, 2, 3… */
    connection_number: number
    /** State at the moment of reveal, not current state. */
    kyc_state: KycState
  }

  /** The gate returned KYC_REQUIRED. The spec gives this event no properties. */
  kyc_prompted: Record<string, never>

  kyc_submitted: {
    resubmission: boolean
  }

  kyc_decided: {
    outcome: KycOutcome
    hours_in_queue: number
    /** Canned-reason key only (e.g. `blurry_document`) — never the text behind it. */
    reason_code: string | null
  }

  enquiry_created: {
    enquiry_id: string
    professional_id: string
    category: string
    contact_pref: ContactPref
    /** Length only. Qualifies as an MQE at ≥20. */
    description_len: number
    source: EnquirySource
  }

  /** First open by the professional — the MQE qualifier. */
  enquiry_viewed_by_pro: {
    enquiry_id: string
    /** Qualifies under 48h. */
    ms_since_created: number
  }

  enquiry_status_changed: {
    enquiry_id: string
    from: EnquiryState
    to: EnquiryState
    by: StateChangeActor
    /** Canned decline key only. */
    reason_code?: string | null
  }

  whatsapp_clicked: {
    context: WhatsAppContext
    counterparty_id: string | null
  }

  // -- Commerce -------------------------------------------------------------

  quote_sent: {
    quote_id: string
    enquiry_id: string | null
    /** TTD. */
    total: number
    item_count: number
  }

  quote_viewed: {
    quote_id: string
    ms_since_sent: number
  }

  quote_responded: {
    quote_id: string
    outcome: QuoteOutcome
    ms_since_sent: number
    reason_code: string | null
  }

  job_status_changed: {
    job_id: string
    from: JobState
    to: JobState
    source: JobSource
    /** TTD, when the transition carries a value. */
    value: number | null
  }

  invoice_sent: {
    invoice_id: string
    job_id: string | null
    total: number
    item_count: number
    vat: boolean
  }

  invoice_viewed: {
    invoice_id: string
    ms_since_sent: number
  }

  invoice_paid: {
    invoice_id: string
    total: number
    ms_since_sent: number
    reminder_count: number
  }

  crm_contact_viewed: {
    contact_id: string
  }

  ai_tool_used: {
    tool: AiTool
    credits: number
    balance_after: number
  }

  credits_purchased: {
    bundle: CreditBundle
    ttd: number
  }

  // -- Revenue & lifecycle --------------------------------------------------

  checkout_started: {
    tier: TierName
    account_type: AccountType
    pioneer: boolean
  }

  subscription_started: {
    tier: TierName
    entry: SubscriptionEntry
    payment: PaymentMethod
  }

  subscription_tier_changed: {
    from: TierName
    to: TierName
    direction: TierChangeDirection
  }

  payment_failed: {
    method: PaymentMethod
    /** Provider failure code, e.g. `card_declined`. */
    code: string
    failure_count: number
  }

  payment_recovered: {
    /** Grace-ladder day the recovery landed on. */
    day: number
  }

  subscription_cancelled: {
    tier: TierName
    tenure_days: number
    reason: CancellationReason
  }

  pioneer_converted: {
    category: string
    months_to_convert: number
  }

  crossover_notice_sent: {
    type: CrossoverNoticeType
    paid_months: number
  }

  crossover_rate_applied: {
    tier: TierName
  }

  registration_lead_from_crossover: {
    notice_type: CrossoverNoticeType
  }

  lifecycle_message_sent: {
    /** Lifecycle matrix trigger key. */
    trigger: string
    channel: NotificationChannel
  }

  lifecycle_message_clicked: {
    trigger: string
    channel: NotificationChannel
  }

  // -- Reviews & trust ------------------------------------------------------

  review_submitted: {
    review_id: string
    professional_id: string
    /** 1–5. */
    stars: number
    linked_job: boolean
    has_photo: boolean
  }

  review_moderated: {
    review_id: string
    outcome: ReviewModerationOutcome
    hours_in_queue: number
    seeded: boolean
  }

  review_disputed: {
    review_id: string
    stars: number
  }

  dispute_resolved: {
    dispute_id: string
    kind: DisputeKind
    outcome: DisputeOutcome
    days: number
  }

  verification_step_completed: {
    step: VerificationStep
  }

  // -- Ads ------------------------------------------------------------------

  /** Counted on the 50%-visible-for-1s rule. Targeting context only — never user-level. */
  ad_impression: {
    campaign_id: string
    zone: string
    category: string | null
    area: string | null
  }

  ad_click: {
    campaign_id: string
    zone: string
  }

  ad_submitted: {
    campaign_id: string
    advertiser_business_id: string
    zone: string
    package_id: string
  }

  ad_review_decided: {
    campaign_id: string
    outcome: AdReviewOutcome
    reason_code: string | null
  }

  // -- Community (reserved) -------------------------------------------------

  post_created: {
    post_id: string
    image_count: number
    tags_count: number
  }

  post_viewed: {
    post_id: string
    ms_visible: number
    source: CataloguePostSource
  }

  post_engaged: {
    post_id: string
    kind: PostEngagementKind
  }

  follow_toggled: {
    professional_id: string
    on: boolean
  }

  comment_created: {
    post_id: string
  }

  content_reported: {
    entity: ReportableEntity
    entity_id: string
    reason_code: string
  }

  // -- Admin & system -------------------------------------------------------

  /** One event per audited mutation. `action_type` uses the audit-log vocabulary. */
  admin_action: {
    action_type: string
    target_table: string
    target_id: string
    queue: string | null
    ms_in_queue: number | null
    capability_key: string
  }

  cron_run: {
    job: string
    ok: boolean
    duration_ms: number
    items_processed: number
  }

  notification_delivered: {
    /** The lifecycle/transactional event that triggered the notification. */
    event: string
    channel: NotificationChannel
    ok: boolean
    provider_code: string | null
  }

  webhook_delivery: {
    config_id: string
    event: string
    attempt: number
    ok: boolean
    status_code: number | null
  }

  /** Sampled 1:10 — individually uninteresting, collectively an abuse signal. */
  rate_limit_hit: {
    route_class: string
    closed: boolean
  }
}

/** Truncation cap for the one free-text property on the platform. */
export const SEARCH_QUERY_MAX_LEN = 60

// ---------------------------------------------------------------------------
// Emission layer
// ---------------------------------------------------------------------------

export type EmissionLayer = 'client' | 'server'

/**
 * Which layer owns each event.
 *
 * `server` events are the only source of truth for money, moderation, and state-machine
 * facts, and per spec §1 must never be trusted from a client — a browser can claim
 * anything, so an `invoice_paid` arriving from one would corrupt revenue reporting with
 * no way to tell the forged rows from the real ones. `track()` refuses them at runtime.
 *
 * Typed as a total record, so a new event name fails to compile until its layer is stated.
 */
export const EMISSION_LAYER: Record<EventName, EmissionLayer> = {
  visit_landed: 'client',
  signup_started: 'client',
  signup_completed: 'server',
  onboarding_step_completed: 'client',
  onboarding_abandoned: 'server',
  onboarding_completed: 'server',
  pioneer_enrolled: 'server',

  search_performed: 'client',
  search_zero_results: 'client',
  suggestion_clicked: 'client',
  category_viewed: 'client',
  profile_viewed: 'client',
  catalogue_post_viewed: 'client',
  share_clicked: 'client',
  save_toggled: 'client',

  reveal_clicked: 'client',
  reveal_completed: 'server',
  kyc_prompted: 'server',
  kyc_submitted: 'server',
  kyc_decided: 'server',
  enquiry_created: 'server',
  enquiry_viewed_by_pro: 'server',
  enquiry_status_changed: 'server',
  whatsapp_clicked: 'client',

  quote_sent: 'server',
  quote_viewed: 'server',
  quote_responded: 'server',
  job_status_changed: 'server',
  invoice_sent: 'server',
  invoice_viewed: 'server',
  invoice_paid: 'server',
  crm_contact_viewed: 'client',
  ai_tool_used: 'server',
  credits_purchased: 'server',

  checkout_started: 'server',
  subscription_started: 'server',
  subscription_tier_changed: 'server',
  payment_failed: 'server',
  payment_recovered: 'server',
  subscription_cancelled: 'server',
  pioneer_converted: 'server',
  crossover_notice_sent: 'server',
  crossover_rate_applied: 'server',
  registration_lead_from_crossover: 'server',
  lifecycle_message_sent: 'server',
  lifecycle_message_clicked: 'server',

  review_submitted: 'server',
  review_moderated: 'server',
  review_disputed: 'server',
  dispute_resolved: 'server',
  verification_step_completed: 'server',

  ad_impression: 'client',
  ad_click: 'client',
  ad_submitted: 'server',
  ad_review_decided: 'server',

  // Views and engagement are rendering facts the client owns; creating a post, a
  // follow, a comment, or a report is a write, and writes are server truth.
  post_created: 'server',
  post_viewed: 'client',
  post_engaged: 'client',
  follow_toggled: 'server',
  comment_created: 'server',
  content_reported: 'server',

  admin_action: 'server',
  cron_run: 'server',
  notification_delivered: 'server',
  webhook_delivery: 'server',
  rate_limit_hit: 'server',
}

// ---------------------------------------------------------------------------
// track()
// ---------------------------------------------------------------------------

/**
 * Emits a client-side event to PostHog.
 *
 * No-ops without a PostHog key, so local development and preview environments stay
 * quiet rather than throwing. Refuses server-layer events: a client cannot be a source
 * of truth for them, and emitting one anyway would put untrustworthy rows next to
 * trustworthy ones under the same name.
 *
 * `track('bogus', {})` and `track('save_toggled', { on: 'yes' })` are compile errors.
 */
export function track<E extends EventName>(event: E, props: EventProps[E]): void {
  if (EMISSION_LAYER[event] === 'server') {
    logger.error('analytics_client_emission_refused', { analytics_event: event })
    return
  }

  // The module is imported by server code for its types and the EVENTS map; only the
  // browser has a PostHog instance to capture into.
  if (typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return

  posthog.capture(event, props)
}
