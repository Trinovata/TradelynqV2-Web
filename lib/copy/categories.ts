/**
 * SEO landing page copy (playbook S087) — verbatim from copy-public.md §8.
 * Intros are the deck's §8.3 hand-written twelve, keyed by parent slug.
 *
 * FLAG (deck gap, not invented here): §8.1 calls for 3 category-specific FAQ
 * Q&As per parent with FAQPage schema, but the deck writes none. The FAQ block
 * is omitted until the deck carries them — a builder never invents a sentence
 * the deck should own.
 */

export const CATEGORY_COPY = {
  title: (category: string) => `${category} in Trinidad & Tobago | TradeLynq`,
  metaDescription: (category: string) =>
    `Find and compare verified ${category} professionals across Trinidad & Tobago. Real reviews, portfolios, and prices on TradeLynq.`,
  h1: (category: string) => `${category} professionals in Trinidad & Tobago`,
  childChipsHeading: (category: string) => `Browse ${category} services`,
  topProsHeading: (category: string) => `Top-rated ${category} professionals`,
  ctaHeading: (category: string) => `Are you a ${category} professional?`,
  ctaButton: 'List your business',
} as const

export const AREA_COPY = {
  title: (category: string, area: string) => `${category} in ${area} | TradeLynq`,
  metaDescription: (category: string, area: string) =>
    `Looking for a ${category.toLowerCase()} in ${area}? Compare verified professionals with real reviews on TradeLynq.`,
  h1: (category: string, area: string) => `${category} in ${area}`,
  countLine: (n: number, area: string) => `${n} professionals in ${area}`,
  nearbyHeading: 'Nearby areas',
  crossLinksHeading: 'Related services',
  emptyHeading: (category: string, area: string) =>
    `No ${category.toLowerCase()} professionals in ${area} yet`,
  emptyBody: 'Be the first — or search a nearby area.',
  emptyAction: 'Search nearby',
} as const

/** The 12 parent-category intro paragraphs (§8.3, paste-ready). */
export const CATEGORY_INTROS: Record<string, string> = {
  'home-property': `From a dripping tap to a full renovation, your home deserves people who show up and do it right. Browse verified plumbers, electricians, painters, masons, AC technicians, and more across Trinidad & Tobago — with real reviews so you know what you're getting before you call.`,
  'beauty-wellness': `Find the hairstylist, nail tech, makeup artist, or barber who fits your look and your schedule. Every professional here is on TradeLynq with real reviews and a portfolio, so you can book with confidence — for the everyday and the big occasions.`,
  'creative-media': `Photographers, videographers, designers, and content creators who can tell your story. Compare portfolios and reviews from creative professionals across T&T, then reach out directly to the one whose work speaks to you.`,
  'professional-services': `Accountants, attorneys, consultants, and agents you can actually vet before you commit. Browse qualified professional-services providers across Trinidad & Tobago, read genuine client reviews, and make contact on your terms.`,
  'automotive-transport': `Keep moving with mechanics, auto detailers, tow services, and drivers you can trust. See reviews and service areas for automotive professionals across T&T before you hand over your keys.`,
  'health-fitness': `Personal trainers, nutritionists, physiotherapists, and coaches to help you feel your best. Find health and fitness professionals across Trinidad & Tobago with real reviews and clear pricing.`,
  pets: `Your animals are family. Find groomers, sitters, dog walkers, and trainers across T&T who treat them that way — with reviews from other pet owners to back it up.`,
  'events-entertainment': `Planning something? Event planners, decorators, DJs, MCs, and bartenders to make the day run right. Browse T&T's event professionals, compare portfolios, and lock in the right team early.`,
  'food-catering': `Caterers, private chefs, and meal-prep services for every table — from a family lime to a full function. Compare menus, reviews, and pricing from food professionals across Trinidad & Tobago.`,
  'childhood-family-care': `Trusted care for the people who matter most. Find babysitters, nannies, daycare assistants, and elderly caregivers across T&T, with reviews from families who've hired them before.`,
  'education-tutoring': `Tutors, music teachers, driving instructors, and language coaches to help you or your child get ahead. Browse education professionals across Trinidad & Tobago with real reviews and clear rates.`,
  technology: `IT support, web and mobile developers, data analysts, and cybersecurity specialists for your business or your home office. Find tech professionals across T&T you can vet before you hire.`,
}
