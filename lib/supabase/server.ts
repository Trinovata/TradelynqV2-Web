/**
 * Server Supabase client — anon key, RLS enforced, bound to the request's cookies.
 *
 * Context: Server Components, route handlers, server actions. Created per request —
 * never cached in a module-level variable, because that would leak one user's session
 * into another user's request.
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { publicEnv } from '@/lib/env'
import type { Database } from '@/types/database'

export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies()

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components cannot set cookies. Safe to ignore: middleware
          // refreshes the session on every request, so the refreshed token is
          // written there instead. This catch is load-bearing, not defensive —
          // removing it breaks every RSC that reads auth state.
        }
      },
    },
  })
}
