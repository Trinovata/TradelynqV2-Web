/**
 * Document branding by tier (playbook S074, spec `components-patterns.md` §9).
 *
 * Invoices and quotes carry different letterheads depending on the professional's
 * subscription tier — the branding IS part of what the higher tiers pay for. The
 * one rule that holds across every tier, including white-label: the compliance
 * footer always renders. A white-label document that drops the "issued via
 * TradeLynq" line would misrepresent who processed the transaction.
 *
 * Colours are named semantic tokens, never hex — a document rendered to PDF or
 * email still resolves them from the same token layer as the app.
 */
import type { TierId } from '@/lib/constants/pricing'

export type DocumentBranding = {
  /** How prominently TradeLynq appears on the letterhead. */
  letterhead: 'full' | 'co_brand' | 'white_label'
  /** Whether the professional's own accent colour is applied. */
  accent: boolean
  /** Whether the professional's logo replaces the TradeLynq mark. */
  professionalLogo: boolean
  /**
   * The footer compliance line. ALWAYS present — this is the invariant the spec
   * calls the "D-era rule": even a white-label document must disclose the
   * platform that issued it.
   */
  complianceFooter: string
}

const COMPLIANCE_LINE = 'Issued via TradeLynq · Trinovata Ltd · tradelynq.tech'

/**
 * Resolves branding for a tier.
 *
 * - Presence / Growth: fully TradeLynq-branded. The platform is the letterhead.
 * - Studio / Pro: co-branded with the professional's accent and logo alongside
 *   the TradeLynq mark.
 * - Enterprise: white-label — the professional's brand leads, the compliance
 *   footer remains.
 *
 * An unknown tier falls to the FULL TradeLynq branding, never white-label:
 * defaulting the other way would let a mislabelled tier silently strip the
 * platform's branding off a document.
 */
export function getDocumentBranding(tier: TierId | null): DocumentBranding {
  switch (tier) {
    case 'studio':
    case 'pro':
      return {
        letterhead: 'co_brand',
        accent: true,
        professionalLogo: true,
        complianceFooter: COMPLIANCE_LINE,
      }
    case 'enterprise':
      return {
        letterhead: 'white_label',
        accent: true,
        professionalLogo: true,
        complianceFooter: COMPLIANCE_LINE,
      }
    case 'presence':
    case 'growth':
    default:
      return {
        letterhead: 'full',
        accent: false,
        professionalLogo: false,
        complianceFooter: COMPLIANCE_LINE,
      }
  }
}
