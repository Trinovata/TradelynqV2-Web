/**
 * Client CRM reads (playbook S112, Studio+ feature). RLS-scoped
 * (client_contacts_select_own); never cached. Contacts auto-sync from
 * enquiries via a DB trigger, so this is a read over live data — the
 * professional's own book of clients.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type ClientRow = {
  id: string
  displayName: string
  whatsapp: string | null
  phone: string | null
  area: string | null
  enquiryCount: number
  lifetimeValueTtd: number
  lastActivityAt: string | null
  tags: string[]
}

export async function getClients(supabase: SupabaseClient<Database>): Promise<ClientRow[]> {
  const { data, error } = await supabase
    .from('client_contacts')
    .select(
      'id, display_name, whatsapp, phone, area, enquiry_count, lifetime_value_ttd, last_activity_at, tags, is_archived'
    )
    .eq('is_archived', false)
    .order('last_activity_at', { ascending: false, nullsFirst: false })
    .limit(500)

  if (error || !data) return []
  return data.map((c) => ({
    id: c.id,
    displayName: c.display_name,
    whatsapp: c.whatsapp,
    phone: c.phone,
    area: c.area,
    enquiryCount: c.enquiry_count ?? 0,
    lifetimeValueTtd: c.lifetime_value_ttd ?? 0,
    lastActivityAt: c.last_activity_at,
    tags: c.tags ?? [],
  }))
}
