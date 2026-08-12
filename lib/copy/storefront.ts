/**
 * Storefront gate + enquiry copy, verbatim from `details/copy-public.md`
 * §5.9–§5.12 (playbook S083, S085 close-out).
 *
 * Strings live here rather than inline in components because the copy deck is
 * the source of truth, and a string typed into a component drifts from it
 * silently (precedent: `lib/copy/auth.ts`). Changing user-facing wording means
 * changing the deck and then this file — never a component.
 *
 * Error copy maps from the taxonomy CODE per deck §18, never from the server's
 * `error` string.
 */

export const STOREFRONT_COPY = {
  /** §5.9 — Action rail (sticky), contact states. */
  rail: {
    heading: (firstName: string) => `Contact ${firstName}`,
    reveal: 'Reveal contact info',
    /** Shown while both free reveals remain (connection count 0). */
    freeRevealsNote: '2 free reveals — no charge.',
    /** Shown at connection count 1. */
    lastFreeNote: '1 free reveal left.',
    whatsapp: 'Chat on WhatsApp',
    website: 'Visit website',
    instagram: 'View Instagram',
    requestQuote: 'Request a quote',
    saveAria: (name: string) => `Save ${name}`,
    share: 'Share',
    /** Mobile bottom bar primary, unrevealed state. */
    mobileReveal: 'Reveal contact',
  },

  /** §5.10 — Connection gate reached (KYC sheet). */
  kycGate: {
    heading: 'Verify your identity to keep contacting professionals',
    body: "You've used your 2 free contacts. A quick identity check keeps the marketplace safe for everyone and unlocks unlimited contact.",
    primary: 'Verify my identity',
    secondary: 'Maybe later',
    reassurance: 'Takes about 2 minutes. Your documents are private and encrypted.',
  },

  /** §5.11 — EnquiryModal / QuoteRequestModal (the conversion moment). */
  enquiry: {
    title: (firstName: string) => `Request a quote from ${firstName}`,
    descriptionLabel: 'What do you need?',
    descriptionPlaceholder:
      'Describe the job — what, where, and any timing. e.g. “Fix a leaking kitchen tap in Diego Martin, this week.”',
    descriptionError: (firstName: string) =>
      `Add a short description so ${firstName} can quote accurately.`,
    dateLabel: 'Preferred date (optional)',
    datePlaceholder: 'Any date',
    contactLabel: 'How should they reply?',
    /** Display labels; the API values stay `whatsapp | call | email`. */
    contactOptions: { whatsapp: 'WhatsApp', call: 'Phone', email: 'Email' } as const,
    submit: 'Send enquiry',
    submitLoading: 'Sending…',
    cancel: 'Cancel',
    successHeading: 'Enquiry sent',
    /**
     * FLAG (deck gap): §5.11 gives `{first name} usually replies within
     * {median}h. We'll notify you, and you can follow up any time on WhatsApp.`
     * The median-response metric does not exist pre-RP2, and the deck defines no
     * fallback — so the first sentence is dropped rather than a number invented.
     */
    successBody: "We'll notify you, and you can follow up any time on WhatsApp.",
    successWhatsapp: 'Chat on WhatsApp now',
    duplicate: (firstName: string) =>
      `You've already sent an enquiry to ${firstName}. Check WhatsApp or your enquiries for their reply.`,
  },

  /** §5.12 — Storefront states. */
  states: {
    revealToast: 'Contact details unlocked.',
    /** Save toast (on) — success, with the `View saved` action → /saved. */
    savedToast: 'Saved to your list.',
    savedToastAction: 'View saved',
    /** Save toast (off) — info. */
    removedToast: 'Removed from your list.',
    unavailableHeading: "This listing isn't available",
    unavailableBody:
      'It may have been removed or is no longer active. Search for another professional near you.',
    unavailableAction: 'Browse professionals',
  },

  /** §18 — Error taxonomy → UI copy map (codes the storefront can meet). */
  errors: {
    rateLimited: 'Too many attempts. Wait a moment and try again.',
    internal: 'Something went wrong on our end. Try again in a moment.',
  },
} as const
