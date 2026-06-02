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
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  if (!key.startsWith('sk_') && !key.startsWith('rk_')) {
    throw new Error('STRIPE_SECRET_KEY is misconfigured: expected sk_… or rk_…, not whsec_….')
  }
  return new Stripe(key)
}

/**
 * Check if a user is an admin by their Supabase user ID.
 * Uses the service role key to bypass RLS.
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('dyia_users')
    .select('is_admin, role')
    .eq('id', userId)
    .single()
  return hasAdminAccess(data)
}

/**
 * Check if a user is an admin by their Clerk user ID.
 */
export async function isAdminByClerkId(clerkUserId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('dyia_users')
    .select('is_admin, role')
    .eq('clerk_user_id', clerkUserId)
    .single()
  return hasAdminAccess(data)
}

/**
 * A user has admin access when either the `is_admin` boolean is true OR their
 * role is an admin role. Checking both keeps the API guard in lock-step with
 * `computeSubscriptionState`, which already grants Pro access on `is_admin`;
 * previously a user with `is_admin = true, role = 'user'` got Pro in the UI but
 * was rejected by every admin API.
 */
function hasAdminAccess(data: { is_admin?: boolean | null; role?: string | null } | null): boolean {
  if (!data) return false
  return data.is_admin === true || data.role === 'admin' || data.role === 'super_admin'
}

// List-price estimates (USD/month) used for MRR. Stripe is the source of
// truth for actual billed revenue; these mirror the public pricing so the
// internal dashboard has a directional number without a Stripe round-trip.
const MONTHLY_PRICE: Record<string, Record<string, number>> = {
  pro: { monthly: 29.99, annual: 24.99 },
  basic: { monthly: 9.99, annual: 8.33 },
}

/**
 * Get admin metrics for the standalone /app/admin dashboard.
 *
 * Returns the full flat shape the dashboard renders (revenue, users, health,
 * signup trend, status breakdown, calculator funnel). Previously this returned
 * a minimal object that didn't match the dashboard's `Metrics` interface, so
 * the page crashed on `m.mrr.toLocaleString()`.
 */
export async function getAdminMetrics() {
  const supabase = getSupabaseAdmin()

  const [usersResult, jobsResult, quotesResult] = await Promise.all([
    supabase
      .from('dyia_users')
      .select('subscription_status, subscription_tier, subscription_plan, trial_consumed_at, created_at, updated_at'),
    supabase.from('dyia_jobs').select('*', { count: 'exact', head: true }),
    supabase.from('dyia_quotes').select('*', { count: 'exact', head: true }),
  ])

  const users = usersResult.data || []
  const now = Date.now()
  const WEEK_MS = 7 * 86_400_000
  const MONTH_MS = 30 * 86_400_000

  const statusBreakdown: Record<string, number> = {}
  let payingUsers = 0
  let trialingUsers = 0
  let canceledTotal = 0
  let canceledRecent = 0
  let newUsersThisWeek = 0
  let mrr = 0
  let trialConsumed = 0
  let trialConsumedConverted = 0

  // Signup trend for the last 7 days, keyed YYYY-MM-DD (oldest first).
  const signupsByDay: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000)
    signupsByDay[d.toISOString().slice(0, 10)] = 0
  }

  for (const u of users) {
    const status = u.subscription_status || 'inactive'
    statusBreakdown[status] = (statusBreakdown[status] || 0) + 1

    const createdMs = u.created_at ? new Date(u.created_at).getTime() : 0
    if (createdMs && now - createdMs <= WEEK_MS) newUsersThisWeek += 1
    const dayKey = u.created_at ? new Date(u.created_at).toISOString().slice(0, 10) : null
    if (dayKey && dayKey in signupsByDay) signupsByDay[dayKey] += 1

    if (status === 'active' || status === 'trialing' || status === 'past_due') {
      const tier = (u.subscription_tier as string) || 'pro'
      const plan = (u.subscription_plan as string) || 'monthly'
      mrr += MONTHLY_PRICE[tier]?.[plan] ?? MONTHLY_PRICE.pro.monthly
    }
    if (status === 'active') payingUsers += 1
    if (status === 'trialing') trialingUsers += 1
    if (status === 'canceled') {
      canceledTotal += 1
      const updatedMs = u.updated_at ? new Date(u.updated_at).getTime() : 0
      if (updatedMs && now - updatedMs <= MONTH_MS) canceledRecent += 1
    }
    if (u.trial_consumed_at) {
      trialConsumed += 1
      if (status === 'active') trialConsumedConverted += 1
    }
  }

  const totalUsers = users.length
  const arr = Math.round(mrr * 12)
  const arpu = payingUsers > 0 ? Math.round((mrr / payingUsers) * 100) / 100 : 0
  const conversionRate = trialConsumed > 0 ? Math.round((trialConsumedConverted / trialConsumed) * 100) : 0
  const churnBase = payingUsers + canceledRecent
  const churnRate = churnBase > 0 ? Math.round((canceledRecent / churnBase) * 100) : 0
  const ltv = churnRate > 0 ? Math.round(arpu / (churnRate / 100)) : 0

  // Profit-calculator funnel (optional table — never let it break the page).
  let quizSubmissions = 0
  let quizStartedTrial = 0
  try {
    const { count } = await supabase
      .from('dyia_quiz_submissions')
      .select('*', { count: 'exact', head: true })
    quizSubmissions = count || 0
    const { count: trialCount } = await supabase
      .from('dyia_quiz_submissions')
      .select('*', { count: 'exact', head: true })
      .not('email', 'is', null)
    quizStartedTrial = trialCount || 0
  } catch {
    // table may not exist in some environments — leave funnel at 0
  }

  return {
    totalUsers,
    activeSubscriptions: payingUsers,
    payingUsers,
    trialingUsers,
    newUsersThisWeek,
    mrr: Math.round(mrr),
    arr,
    arpu,
    ltv,
    conversionRate,
    churnRate,
    canceledRecent,
    canceledTotal,
    totalJobs: jobsResult.count || 0,
    totalQuotes: quotesResult.count || 0,
    statusBreakdown,
    signupsByDay,
    quizSubmissions,
    quizStartedTrial,
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
