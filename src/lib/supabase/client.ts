import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Module-level token getter for Clerk JWT integration.
 * Set via initSupabaseAuth() once Clerk is ready.
 * The getter is called on every Supabase request to ensure
 * fresh tokens are always used (handles expiry automatically).
 */
let _getToken: (() => Promise<string | null>) | null = null

/**
 * Initialize Supabase authentication with Clerk JWT.
 * Call this once in your app root after Clerk is loaded.
 *
 * @param getToken - async function that returns a Clerk JWT for Supabase
 *                   (typically: () => getToken({ template: 'supabase' }))
 */
export function initSupabaseAuth(getToken: () => Promise<string | null>) {
  _getToken = getToken
}

/**
 * Create a Supabase browser client.
 *
 * When initSupabaseAuth() has been called (i.e., after Clerk loads),
 * every request made by this client will automatically include the
 * Clerk JWT as the Authorization header. This enables Supabase RLS
 * policies to identify the current user.
 *
 * When auth is not initialized (e.g., landing page, demo mode),
 * the client falls back to the anon key only.
 */
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
          const headers = new Headers(init?.headers)

          // Inject Clerk JWT if auth is initialized
          if (_getToken) {
            try {
              const token = await _getToken()
              if (token) {
                headers.set('Authorization', `Bearer ${token}`)
              }
            } catch {
              // If token fetch fails, fall back to anon key
              // (the anon key is included by Supabase client automatically)
            }
          }

          return fetch(input, { ...init, headers })
        },
      },
    }
  )
}
