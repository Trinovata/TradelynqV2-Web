import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { publicEnv } from '@/lib/env'
import type { Database } from '@/types/database'

/**
 * An RLS-scoped client bound to a caller-supplied bearer token.
 *
 * The fourth client, and the one the mobile apps depend on. The other three are
 * bound to cookies (browser, server) or to the service role (admin); none of
 * them can represent "this specific JWT".
 *
 * ## Why this must exist
 *
 * The access layer previously validated a bearer token and then returned the
 * cookie-bound server client. For a mobile request — which carries no cookies —
 * that client was anonymous. `auth.uid()` was NULL inside every RLS policy, so
 * the identity the route believed in and the identity the database enforced were
 * different. Every ownership policy silently evaluated against nobody.
 *
 * Passing the token in the `Authorization` header makes PostgREST resolve
 * `auth.uid()` from it, so RLS enforces exactly the user the route validated.
 *
 * ## Why the anon key, not the service key
 *
 * The anon key is what activates RLS. Using the service key here would produce a
 * client that ignores every policy — the failure this function exists to fix,
 * inverted and far worse.
 *
 * Never cached: each instance is scoped to one caller's token for one request.
 */
export function createBearerClient(accessToken: string): SupabaseClient<Database> {
  return createSupabaseClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      // There is no session to persist or refresh — the caller owns the token's
      // lifecycle, and this client exists only for the duration of one request.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
