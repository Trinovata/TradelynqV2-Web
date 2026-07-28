/**
 * The professional's own editable storefront values (playbook S113).
 * RLS-scoped self-read; never cached — a professional must see exactly what
 * they last saved.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type StorefrontService = {
  name: string
  price_ttd?: number
  description?: string
}

export type StorefrontEditModel = {
  businessName: string
  tagline: string
  bio: string
  websiteUrl: string
  instagramHandle: string
  contactWhatsapp: string
  serviceAreas: string[]
  services: StorefrontService[]
  businessHours: Record<string, string>
  slug: string | null
  listingStatus: string
}

function parseServices(value: unknown): StorefrontService[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    if (typeof row.name !== 'string') return []
    return [
      {
        name: row.name,
        price_ttd: typeof row.price_ttd === 'number' ? row.price_ttd : undefined,
        description: typeof row.description === 'string' ? row.description : undefined,
      },
    ]
  })
}

function parseHours(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (pair): pair is [string, string] => typeof pair[1] === 'string'
    )
  )
}

export async function getStorefrontEditModel(
  supabase: SupabaseClient<Database>,
  professionalId: string
): Promise<StorefrontEditModel | null> {
  const { data, error } = await supabase
    .from('professional_profiles')
    .select(
      'business_name, tagline, bio, website_url, instagram_handle, contact_whatsapp, service_areas, services, business_hours, slug, listing_status'
    )
    .eq('id', professionalId)
    .maybeSingle()

  if (error || !data) return null
  return {
    businessName: data.business_name,
    tagline: data.tagline ?? '',
    bio: data.bio ?? '',
    websiteUrl: data.website_url ?? '',
    instagramHandle: data.instagram_handle ?? '',
    contactWhatsapp: data.contact_whatsapp ?? '',
    serviceAreas: data.service_areas ?? [],
    services: parseServices(data.services),
    businessHours: parseHours(data.business_hours),
    slug: data.slug,
    listingStatus: data.listing_status,
  }
}
