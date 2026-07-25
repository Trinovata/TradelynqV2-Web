/**
 * Merch & branding catalogue (playbook S091, spec v2/03 §3.11, deck §12).
 * Ported from V1's proven lib/constants/merch.ts; V2 additions are the
 * per-category order-field map (the §12.2 modal renders fields by product
 * type) and the Launch Bundle from the registration-service plan.
 *
 * The catalogue is deliberately a CODE CONSTANT, not a table: it changes
 * with deploys, and store_orders snapshots name+price at order time so an
 * order renders at the price it was placed at (migration 20260719000014's
 * own design note). POST /api/store/order validates id + price against
 * THIS list — the client's price is display only.
 *
 * FLAG (S162): prices are V1 carry-overs; the Money Map marks SKU costs as
 * pending supplier quotes. Adjusting a price here is the whole change.
 */

export type MerchCategory =
  'bundles' | 'apparel' | 'headwear' | 'business-cards' | 'photography' | 'accessories'

export type MerchBranding = 'tradelynq' | 'custom'

export type MerchProduct = {
  id: string
  name: string
  description: string
  /** TTD. Always render via formatTTD(). */
  price: number
  category: MerchCategory
  branding: MerchBranding
  popular?: boolean
  note?: string
}

export const MERCH_PRODUCTS: MerchProduct[] = [
  {
    id: 'bundle-starter',
    name: 'Starter Bundle',
    description:
      '1 branded polo shirt, 1 branded cap, 100 business cards, and a professional owner photo for your profile. Ready in 5-7 working days.',
    price: 440,
    category: 'bundles',
    branding: 'tradelynq',
    popular: true,
    note: 'Best value for new professionals',
  },
  {
    id: 'bundle-premium',
    name: 'Premium Custom Bundle',
    description:
      '1 fully custom embroidered polo, 1 custom embroidered cap, 250 fully custom business cards.',
    price: 699,
    category: 'bundles',
    branding: 'custom',
    note: '10-14 working days for custom orders',
  },
  {
    id: 'bundle-launch',
    name: 'Business Launch Bundle',
    description:
      'Done-for-you registration, a branding kit (polo, cap, 100 business cards), and a Growth-tier period — the full launch, packaged.',
    price: 799,
    category: 'bundles',
    branding: 'custom',
    note: 'Registration service pends partner terms — we confirm details on WhatsApp',
  },
  {
    id: 'polo-tradelynq',
    name: 'Polo Shirt',
    description:
      'High-quality piqué polo with TradeLynq logo embroidered on chest. Available in Black, White, Navy.',
    price: 140,
    category: 'apparel',
    branding: 'tradelynq',
  },
  {
    id: 'polo-custom',
    name: 'Custom Embroidered Polo',
    description:
      'Your business name & logo embroidered on chest and/or sleeve. Full colour embroidery.',
    price: 220,
    category: 'apparel',
    branding: 'custom',
    note: 'Artwork file required (PNG/SVG)',
  },
  {
    id: 'tshirt-tradelynq',
    name: 'Work T-Shirt',
    description: 'Heavy-duty cotton work tee with TradeLynq chest print.',
    price: 95,
    category: 'apparel',
    branding: 'tradelynq',
  },
  {
    id: 'tshirt-custom',
    name: 'Custom Printed T-Shirt',
    description: 'Your design printed front and/or back. Minimum 5 shirts.',
    price: 145,
    category: 'apparel',
    branding: 'custom',
    note: 'Min. order 5 pieces',
  },
  {
    id: 'cap-tradelynq',
    name: 'Cap',
    description: 'Structured snapback cap with TradeLynq embroidered logo. One size.',
    price: 75,
    category: 'headwear',
    branding: 'tradelynq',
  },
  {
    id: 'cap-custom',
    name: 'Custom Embroidered Cap',
    description: 'Your logo or business name embroidered on front panel.',
    price: 130,
    category: 'headwear',
    branding: 'custom',
    note: 'Artwork file required',
  },
  {
    id: 'cards-100-tradelynq',
    name: '100 Business Cards',
    description:
      'Professional cards with your name, trade, phone and WhatsApp. TradeLynq template with your branding.',
    price: 85,
    category: 'business-cards',
    branding: 'tradelynq',
    popular: true,
  },
  {
    id: 'cards-100-custom',
    name: '100 Custom Business Cards',
    description:
      'Fully custom design — you supply artwork or we design for you (design fee applies).',
    price: 160,
    category: 'business-cards',
    branding: 'custom',
  },
  {
    id: 'cards-250-tradelynq',
    name: '250 Business Cards',
    description: 'Same as 100-card option, better value.',
    price: 165,
    category: 'business-cards',
    branding: 'tradelynq',
  },
  {
    id: 'cards-250-custom',
    name: '250 Custom Business Cards',
    description: 'Fully custom design, 250 cards.',
    price: 280,
    category: 'business-cards',
    branding: 'custom',
  },
  {
    id: 'photo-owner-portrait',
    name: 'Owner Portrait Session',
    description:
      'One-hour photo session for a polished owner profile photo. Includes 8 edited images.',
    price: 350,
    category: 'photography',
    branding: 'custom',
    popular: true,
  },
  {
    id: 'photo-business-showcase',
    name: 'Business Showcase Session',
    description:
      'On-location shoot of your workspace and service delivery. Includes 20 edited images.',
    price: 900,
    category: 'photography',
    branding: 'custom',
  },
  {
    id: 'photo-team-profile',
    name: 'Team Profile Session',
    description: 'Headshots for up to 6 team members with group photos for your business page.',
    price: 1250,
    category: 'photography',
    branding: 'custom',
  },
  {
    id: 'pens-branded',
    name: 'Branded Pen Set (10)',
    description:
      'Set of 10 click pens with your business name and phone printed. Leave them with clients.',
    price: 55,
    category: 'accessories',
    branding: 'tradelynq',
  },
  {
    id: 'notebook-branded',
    name: 'Branded Notebook',
    description: 'A5 soft-cover notebook with your business name on the cover.',
    price: 65,
    category: 'accessories',
    branding: 'tradelynq',
  },
  {
    id: 'tool-bag',
    name: 'Branded Tool Bag',
    description:
      'Heavy-duty canvas tool bag with printed logo and name. Multiple pockets, reinforced base.',
    price: 280,
    category: 'accessories',
    branding: 'tradelynq',
  },
  {
    id: 'vehicle-decal',
    name: 'Vehicle Decal',
    description:
      'Vinyl cut sticker for your vehicle — name, trade, phone. Turn your car into a moving ad.',
    price: 120,
    category: 'accessories',
    branding: 'tradelynq',
  },
  {
    id: 'id-lanyard',
    name: 'ID Lanyard & Card Holder',
    description: 'Professional lanyard with TradeLynq accent print and clear ID window.',
    price: 45,
    category: 'accessories',
    branding: 'tradelynq',
  },
]

export const MERCH_CATEGORY_LABELS: Record<MerchCategory, string> = {
  bundles: 'Bundles',
  apparel: 'Polos & T-Shirts',
  headwear: 'Caps & Headwear',
  'business-cards': 'Business Cards',
  photography: 'Business Photography',
  accessories: 'Accessories',
}

export const MERCH_CATEGORIES: MerchCategory[] = [
  'bundles',
  'apparel',
  'headwear',
  'business-cards',
  'photography',
  'accessories',
]

/** Cash on delivery is available only under this total (§3.11). */
export const CASH_ON_DELIVERY_LIMIT_TTD = 500

export const PAYMENT_METHODS = [
  { id: 'bank_transfer', label: 'Bank transfer' },
  { id: 'wipay_link', label: 'WiPay link' },
  { id: 'cash_on_delivery', label: 'Cash on delivery' },
] as const

export type PaymentMethodId = (typeof PAYMENT_METHODS)[number]['id']

export function productById(id: string): MerchProduct | null {
  return MERCH_PRODUCTS.find((p) => p.id === id) ?? null
}

/**
 * Which extra order fields the §12.2 modal shows, by product category:
 * apparel/headwear → size+colour · cards/accessories → print notes ·
 * photography → date+location · bundles → notes.
 */
export function orderFieldsFor(category: MerchCategory): {
  size: boolean
  colour: boolean
  notes: boolean
  dateLocation: boolean
} {
  switch (category) {
    case 'apparel':
      return { size: true, colour: true, notes: true, dateLocation: false }
    case 'headwear':
      return { size: false, colour: true, notes: true, dateLocation: false }
    case 'photography':
      return { size: false, colour: false, notes: true, dateLocation: true }
    default:
      return { size: false, colour: false, notes: true, dateLocation: false }
  }
}
