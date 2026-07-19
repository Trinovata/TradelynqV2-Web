/**
 * Browser Supabase client — anon key, RLS enforced.
 *
 * Context: client components only. Singleton, because each `createBrowserClient`
 * call registers its own auth listener and storage subscription; creating several
 * causes duplicate token refreshes and cross-instance session drift.
 */
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { publicEnv } from '@/lib/env'
import type { Database } from '@/types/database'

let client: SupabaseClient<Database> | undefined

export function createClient(): SupabaseClient<Database> {
  if (client) return client

  client = createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey)

  return client
}
