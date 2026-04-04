import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

/**
 * Check if a user is an admin by their Supabase user ID.
 * Uses the service role key to bypass RLS.
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('dyia_users')
    .select('role')
    .eq('id', userId)
    .single()
  return data?.role === 'admin' || data?.role === 'super_admin'
}

/**
 * Check if a user is an admin by their Clerk user ID.
 */
export async function isAdminByClerkId(clerkUserId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('dyia_users')
    .select('role')
    .eq('clerk_user_id', clerkUserId)
    .single()
  return data?.role === 'admin' || data?.role === 'super_admin'
}

/**
 * Get admin metrics for the admin dashboard.
 */
export async function getAdminMetrics() {
  const supabase = getSupabaseAdmin()

  const [usersResult, activeResult, trialingResult, jobsResult, revenueResult] = await Promise.all([
    supabase.from('dyia_users').select('*', { count: 'exact', head: true }),
    supabase.from('dyia_users').select('*', { count: 'exact', head: true }).eq('subscription_status', 'active'),
    supabase.from('dyia_users').select('*', { count: 'exact', head: true }).eq('subscription_status', 'trialing'),
    supabase.from('dyia_jobs').select('*', { count: 'exact', head: true }),
    supabase.from('dyia_jobs').select('revenue'),
  ])

  const totalRevenue = (revenueResult.data || []).reduce((sum: number, j: { revenue: number }) => sum + (j.revenue || 0), 0)

  return {
    totalUsers: usersResult.count || 0,
    activeSubscriptions: activeResult.count || 0,
    trialingUsers: trialingResult.count || 0,
    totalJobs: jobsResult.count || 0,
    platformRevenue: totalRevenue,
  }
}

/**
 * List all users with their details (for admin panel).
 */
export async function listAllUsers() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('dyia_users')
    .select('id, clerk_user_id, email, first_name, last_name, subscription_status, subscription_plan, subscription_ends_at, is_admin, role, created_at')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

async function cancelStripeSubscriptionIfNeeded(subscriptionId: string | null | undefined) {
  if (!subscriptionId) return

  try {
    const stripe = getStripe()
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if (subscription.status !== 'canceled') {
      await stripe.subscriptions.cancel(subscriptionId)
    }
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null
    if (code !== 'resource_missing') {
      throw error
    }
  }
}

export async function grantAdminAccess(
  userId: string,
  role: 'admin' | 'super_admin' = 'admin'
) {
  const supabase = getSupabaseAdmin()
  const { data: user, error: userError } = await supabase
    .from('dyia_users')
    .select('stripe_subscription_id')
    .eq('id', userId)
    .single()

  if (userError) throw userError

  await cancelStripeSubscriptionIfNeeded(user?.stripe_subscription_id)

  const { error } = await supabase
    .from('dyia_users')
    .update({
      is_admin: true,
      role,
      subscription_status: 'active',
      subscription_plan: 'annual',
      subscription_ends_at: null,
      stripe_subscription_id: null,
    })
    .eq('id', userId)

  if (error) throw error
}

/**
 * Toggle admin status for a user.
 */
export async function toggleAdmin(userId: string, makeAdmin: boolean) {
  if (makeAdmin) {
    await grantAdminAccess(userId, 'admin')
    return
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('dyia_users')
    .update({
      is_admin: false,
      role: 'user',
    })
    .eq('id', userId)

  if (error) throw error
}

/**
 * Require admin access. Throws if the user is not an admin.
 * Used as a guard in admin API routes.
 */
export async function requireAdmin(clerkUserId: string): Promise<void> {
  const admin = await isAdminByClerkId(clerkUserId)
  if (!admin) {
    throw new Error('Forbidden: admin access required')
  }
}

/**
 * Log a webhook event to dyia_webhook_events (best-effort, never throws).
 */
export async function logWebhookEvent(
  source: string,
  eventType: string,
  eventId: string | null,
  payload: Record<string, unknown>,
  status: 'success' | 'error' = 'success',
  errorMessage?: string
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin()
    await supabase.from('dyia_webhook_events').insert({
      source,
      event_type: eventType,
      event_id: eventId,
      payload,
      status,
      error_message: errorMessage || null,
    })
  } catch {
    // Best-effort logging — don't let webhook logging failures break webhook handlers
    console.error(`Failed to log webhook event: ${source}/${eventType}`)
  }
}
