/**
 * Platform contact points. ONE place — a support number typed into components
 * drifts the moment the real WhatsApp Business number lands (playbook S158).
 *
 * The number is V1's live TRADELYNQ_WHATSAPP (lib/constants/merch.ts in the
 * V1 repo) — the line orders and support actually run on today. It replaced
 * the +1868627xxxx placeholder SearchClient briefly shipped with. If S158
 * provisions a new WhatsApp Business number, swap it here and every surface
 * follows.
 */
export const SUPPORT_PHONE = '+18687089214'
