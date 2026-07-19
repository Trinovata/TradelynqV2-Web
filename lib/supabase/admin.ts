/**
 * Admin Supabase client — service-role key, **bypasses RLS entirely**.
 *
 * Context: server-only. Admin routes, cron jobs, webhook consumers, and background
 * reconciliation — code paths where there is no user session to scope the query to.
 *
 * The `server-only` import is the guard: importing this module from a client
 * component is a build error, not a runtime surprise. That is deliberate. This key
 * grants unrestricted read and write over every table in the database; shipping it
 * to a browser would be the single worst security failure available to this codebase.
 *
 * Every call site must scope its own queries. RLS is not doing it for you here.
 */
import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { publicEnv, serverEnv } from '@/lib/env'
import type { Database } from '@/types/database'

export function createAdminClient(): SupabaseClient<Database> {
  return createSupabaseClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: {
      // No session to persist or refresh — this client is not acting as a user.
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
