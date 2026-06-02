'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'

interface UserDetail {
  id: string
  clerk_user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: string
  subscription_status: string
  subscription_plan: string | null
  subscription_tier: string | null
  subscription_ends_at: string | null
  cancel_at_period_end: boolean | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  ai_credits_balance: number
  ai_credits_used_lifetime: number
  created_at: string
  updated_at: string
}

interface UserStats {
  jobCount: number
  quoteCount: number
  threadCount: number
  totalRevenue: number
}

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [user, setUser] = useState<UserDetail | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then(async res => {
        if (!res.ok) throw new Error(res.status === 403 ? 'Access denied' : 'Failed to load user')
        return res.json()
      })
      .then(data => {
        setUser(data.user)
        setStats(data.stats)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const updateUser = async (updates: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update')
      const data = await res.json()
      setUser(data.user)
    } catch (err) {
      console.error(err)
      alert('Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  // Admin-driven plan swap. Hits Stripe directly so the webhook then syncs DB.
  // Used for support tickets like "switch me from Pro monthly to Basic monthly".
  const switchPlan = async (tier: 'basic' | 'pro', plan: 'monthly' | 'annual') => {
    if (!user?.stripe_subscription_id) {
      alert('User has no active Stripe subscription. Use Grant Pro / Grant Trial first.')
      return
    }
    const downgrading = user.subscription_tier === 'pro' && tier === 'basic'
    const confirmMsg = downgrading
      ? `Downgrade ${user.email} from Pro to Basic (${plan})?\n\nThis will issue a prorated credit for unused Pro time.`
      : `Switch ${user.email} to ${tier} (${plan})?`
    if (!confirm(confirmMsg)) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/switch-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: id, tier, plan, prorate: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to switch plan')
      alert(data.message || 'Plan switched.')
      const refreshed = await fetch(`/api/admin/users/${id}`).then(r => r.json())
      setUser(refreshed.user)
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Failed to switch plan')
    } finally {
      setSaving(false)
    }
  }

  // Cancel a live Stripe subscription — either scheduled (keeps access until the
  // period ends, the usual "downgrade me" support flow) or immediate.
  const cancelSubscription = async (immediate: boolean) => {
    const msg = immediate
      ? `Cancel ${user?.email}'s subscription IMMEDIATELY?\n\nThey lose Pro access right now with no proration.`
      : `Schedule ${user?.email}'s subscription to cancel at the end of the billing period?\n\nThey keep access until then, and you can undo it before the date.`
    if (!confirm(msg)) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: id, immediate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to cancel subscription')
      alert(data.message || 'Done.')
      const refreshed = await fetch(`/api/admin/users/${id}`).then(r => r.json())
      setUser(refreshed.user)
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : 'Failed to cancel subscription')
    } finally {
      setSaving(false)
    }
  }

  const sendBillingPortal = async () => {
    if (!user?.stripe_customer_id) {
      alert('User has no Stripe customer ID — they have not subscribed yet.')
      return
    }
    const portalUrl = `https://dashboard.stripe.com/customers/${user.stripe_customer_id}`
    window.open(portalUrl, '_blank')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        User not found
      </div>
    )
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'No name'

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/dyia-logo.png" alt="dyia" className="w-8 h-8 object-contain" />
            <h1 className="text-xl font-bold">dyia admin</h1>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/app/admin" className="text-slate-400 hover:text-white transition-colors">Dashboard</Link>
            <Link href="/app/admin/users" className="text-orange-400 font-medium">Users</Link>
            <Link href="/app/admin/payments" className="text-slate-400 hover:text-white transition-colors">Payments</Link>
            <Link href="/app/admin/webhooks" className="text-slate-400 hover:text-white transition-colors">Webhooks</Link>
            <Link href="/app" className="text-slate-500 hover:text-white transition-colors">Back to App</Link>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/app/admin/users" className="text-sm text-slate-500 hover:text-white mb-4 inline-block">&larr; Back to Users</Link>

        {/* Profile Header */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">{fullName}</h2>
              <p className="text-slate-400 mt-1">{user.email}</p>
              <p className="text-xs text-slate-600 mt-1">ID: {user.id}</p>
              <p className="text-xs text-slate-600">Clerk: {user.clerk_user_id}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Subscription */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Subscription</h3>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className="font-medium capitalize">{user.subscription_status || 'inactive'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tier</span>
                <span className="font-medium capitalize">{user.subscription_tier || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Billing</span>
                <span className="font-medium capitalize">{user.subscription_plan || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ends at</span>
                <span className="font-medium">{user.subscription_ends_at ? new Date(user.subscription_ends_at).toLocaleDateString() : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Role</span>
                <span className="font-medium capitalize">{user.role || 'user'}</span>
              </div>
              {user.stripe_customer_id && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Stripe</span>
                  <a href={`https://dashboard.stripe.com/customers/${user.stripe_customer_id}`} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 text-sm">
                    View in Stripe
                  </a>
                </div>
              )}
              {user.cancel_at_period_end && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    Scheduled to cancel{user.subscription_ends_at ? ` on ${new Date(user.subscription_ends_at).toLocaleDateString()}` : ' at period end'}.
                  </span>
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="space-y-2 pt-4 border-t border-slate-800">
              <h4 className="text-xs text-slate-500 mb-2">Quick Actions</h4>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => updateUser({ subscription_status: 'active', subscription_plan: 'monthly', subscription_tier: 'pro' })}
                  disabled={saving}
                  className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50"
                >
                  Grant Pro
                </button>
                <button
                  onClick={() => updateUser({ subscription_status: 'trialing', subscription_ends_at: new Date(Date.now() + 14 * 86400000).toISOString() })}
                  disabled={saving}
                  className="px-3 py-1.5 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-lg hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                >
                  Grant 14-Day Trial
                </button>
                <button
                  onClick={() => updateUser({ subscription_status: 'inactive' })}
                  disabled={saving}
                  className="px-3 py-1.5 bg-slate-700 text-slate-300 text-xs font-medium rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50"
                >
                  Revoke Access
                </button>
                <button
                  onClick={() => updateUser({ role: user.role === 'admin' ? 'user' : 'admin' })}
                  disabled={saving}
                  className="px-3 py-1.5 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-lg hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                >
                  {user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                </button>
              </div>
            </div>

            {/* Plan switch — for support cases like "downgrade me to Basic" */}
            {user.stripe_subscription_id && (
              <div className="space-y-2 pt-4 border-t border-slate-800 mt-4">
                <h4 className="text-xs text-slate-500 mb-2">Switch Plan (live Stripe swap, prorated)</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => switchPlan('basic', 'monthly')}
                    disabled={saving || (user.subscription_tier === 'basic' && user.subscription_plan === 'monthly')}
                    className="px-3 py-1.5 bg-blue-500/20 text-blue-400 text-xs font-medium rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-30"
                  >
                    Basic Monthly
                  </button>
                  <button
                    onClick={() => switchPlan('basic', 'annual')}
                    disabled={saving || (user.subscription_tier === 'basic' && user.subscription_plan === 'annual')}
                    className="px-3 py-1.5 bg-blue-500/20 text-blue-400 text-xs font-medium rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-30"
                  >
                    Basic Annual
                  </button>
                  <button
                    onClick={() => switchPlan('pro', 'monthly')}
                    disabled={saving || (user.subscription_tier === 'pro' && user.subscription_plan === 'monthly')}
                    className="px-3 py-1.5 bg-orange-500/20 text-orange-400 text-xs font-medium rounded-lg hover:bg-orange-500/30 transition-colors disabled:opacity-30"
                  >
                    Pro Monthly
                  </button>
                  <button
                    onClick={() => switchPlan('pro', 'annual')}
                    disabled={saving || (user.subscription_tier === 'pro' && user.subscription_plan === 'annual')}
                    className="px-3 py-1.5 bg-orange-500/20 text-orange-400 text-xs font-medium rounded-lg hover:bg-orange-500/30 transition-colors disabled:opacity-30"
                  >
                    Pro Annual
                  </button>
                </div>
                <p className="text-[11px] text-slate-600 mt-2">
                  Tells the customer to update their card via Settings &rarr; Manage Billing (Stripe portal). Admins cannot change cards directly &mdash;{' '}
                  <button onClick={sendBillingPortal} className="underline hover:text-orange-400">open in Stripe</button>{' '}to do it manually.
                </p>
              </div>
            )}

            {/* Cancel subscription — full lifecycle control alongside switch-plan */}
            {user.stripe_subscription_id && (
              <div className="space-y-2 pt-4 border-t border-slate-800 mt-4">
                <h4 className="text-xs text-slate-500 mb-2">Cancel Subscription</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => cancelSubscription(false)}
                    disabled={saving || !!user.cancel_at_period_end}
                    className="px-3 py-1.5 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-lg hover:bg-amber-500/30 transition-colors disabled:opacity-30"
                  >
                    {user.cancel_at_period_end ? 'Cancel Scheduled' : 'Cancel at Period End'}
                  </button>
                  <button
                    onClick={() => cancelSubscription(true)}
                    disabled={saving}
                    className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-30"
                  >
                    Cancel Immediately
                  </button>
                </div>
                <p className="text-[11px] text-slate-600 mt-2">
                  &ldquo;At period end&rdquo; keeps access until the billing date (the standard downgrade). &ldquo;Immediately&rdquo; ends access now with no proration.
                </p>
              </div>
            )}
          </div>

          {/* Usage Stats */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Usage</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Jobs Logged</span>
                <span className="font-medium">{stats?.jobCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quotes Created</span>
                <span className="font-medium">{stats?.quoteCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">AI Threads</span>
                <span className="font-medium">{stats?.threadCount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Revenue Tracked</span>
                <span className="font-medium text-green-400">${(stats?.totalRevenue || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">AI Credits Balance</span>
                <span className="font-medium">{user.ai_credits_balance || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">AI Credits Used (Lifetime)</span>
                <span className="font-medium">{user.ai_credits_used_lifetime || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Account Created</span>
                <span className="font-medium text-sm">{new Date(user.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
