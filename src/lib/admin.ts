import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type AdminRole = 'admin' | 'super_admin'

/**
 * Check if a Clerk user has admin privileges.
 * Returns the role if admin, null otherwise.
 */
export async function getAdminRole(clerkUserId: string): Promise<AdminRole | null> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('dyia_users')
    .select('role')
    .eq('clerk_user_id', clerkUserId)
    .single()

  if (data?.role === 'admin' || data?.role === 'super_admin') {
    return data.role as AdminRole
  }
  return null
}

/**
 * Require admin access. Returns the admin role or throws a response-ready object.
 */
export async function requireAdmin(clerkUserId: string): Promise<AdminRole> {
  const role = await getAdminRole(clerkUserId)
  if (!role) {
    throw new Error('Forbidden: admin access required')
  }
  return role
}

/**
 * Get the dyia user ID from a Clerk user ID.
 */
export async function getDyiaUserId(clerkUserId: string): Promise<string | null> {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('dyia_users')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .single()
  return data?.id ?? null
}

/**
 * Log a webhook event for debugging.
 */
export async function logWebhookEvent(
  source: 'stripe' | 'clerk',
  eventType: string,
  eventId: string | null,
  payload: unknown,
  status: 'processed' | 'error' = 'processed',
  error?: string
): Promise<void> {
  try {
    const supabase = getSupabase()
    await supabase.from('dyia_webhook_events').insert({
      source,
      event_type: eventType,
      event_id: eventId,
      payload: payload as Record<string, unknown>,
      status,
      error: error || null,
    })
  } catch (err) {
    console.error('[WebhookLog] Failed to log event:', err)
  }
}
