import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

/**
 * Check if a user is an admin by their Supabase user ID.
 * Uses the service role key to bypass RLS.
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('dyia_users')
    .select('is_admin')
    .eq('id', userId)
    .single()
  return data?.is_admin === true
}

/**
 * Check if a user is an admin by their Clerk user ID.
 */
export async function isAdminByClerkId(clerkUserId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('dyia_users')
    .select('is_admin')
    .eq('clerk_user_id', clerkUserId)
    .single()
  return data?.is_admin === true
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

/**
 * Toggle admin status for a user.
 */
export async function toggleAdmin(userId: string, makeAdmin: boolean) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('dyia_users')
    .update({
      is_admin: makeAdmin,
      role: makeAdmin ? 'admin' : 'user',
    })
    .eq('id', userId)

  if (error) throw error
}
