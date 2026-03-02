'use client'

import { useEffect, useState, useCallback } from 'react'

// ---------- Types ----------

interface AdminUser {
  id: string
  clerk_user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  subscription_status: string
  subscription_plan: string | null
  subscription_ends_at: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  ai_credits_balance: number
  ai_credits_used_lifetime: number
  is_admin: boolean
  role: string
  created_at: string
  updated_at: string
  jobCount: number
  quoteCount: number
  threadCount: number
  onboarded: boolean
  lifecycleStage: string
}

interface UserDetail {
  user: AdminUser
  settings: Record<string, unknown> | null
  stats: { jobCount: number; quoteCount: number; threadCount: number; totalRevenue: number }
}

interface AdminStats {
  overview: {
    totalUsers: number
    activeSubscriptions: number
    trialingUsers: number
    canceledUsers: number
    pastDueUsers: number
    inactiveUsers: number
    totalJobs: number
    totalQuotes: number
    totalCustomers: number
    platformGMV: number
    estimatedMRR: number
    signupsLast7Days: number
    signupsLast30Days: number
    conversionRate: number
  }
  ai: {
    totalThreads: number
    totalMessages: number
    totalTokensUsed: number
    totalCreditsPurchased: number
    totalCreditsUsed: number
    estimatedOpenAICost: number
    topUsers: Array<{
      userId: string
      email: string
      name: string | null
      messageCount: number
      creditsBalance: number
      creditsUsedLifetime: number
    }>
    recentTransactions: Array<{
      id: string
      user_id: string
      type: string
      amount: number
      balance_after: number
      description: string
      created_at: string
      userEmail: string
      userName: string | null
    }>
  }
  subscriptions: {
    monthlyActive: number
    annualActive: number
    monthlyTrialing: number
    annualTrialing: number
    statusCounts: Record<string, number>
  }
  system: {
    webhooksLast7Days: { success: number; error: number }
    recentErrors: Array<{
      id: string
      source: string
      eventType: string
      errorMessage: string | null
      createdAt: string
    }>
    emails: {
      total: number
      sent: number
      failed: number
      last7Days: number
      byType: Record<string, number>
      campaigns: number
    }
  }
  journey: {
    signedUp: number
    subscribed: number
    onboarded: number
    firstJob: number
    firstQuote: number
    usedAI: number
    engaged: number
  }
  users: AdminUser[]
  recentActivity: Array<{
    type: string
    description: string
    timestamp: string
    email?: string
    userId?: string
  }>
}

type AdminTab = 'overview' | 'users' | 'ai' | 'revenue' | 'system'

// ---------- Component ----------

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Users tab state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats')
      if (!res.ok) {
        if (res.status === 403) { setError('You do not have admin access.'); return }
        throw new Error('Failed to load admin data')
      }
      setStats(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const loadUserDetail = useCallback(async (userId: string) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`)
      if (res.ok) setUserDetail(await res.json())
    } catch (err) {
      console.error('User detail error:', err)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const handleExpandUser = (userId: string) => {
    if (expandedUser === userId) { setExpandedUser(null); setUserDetail(null); return }
    setExpandedUser(userId)
    loadUserDetail(userId)
  }

  const handleToggleAdmin = async (userId: string, makeAdmin: boolean) => {
    setToggling(userId)
    try {
      const res = await fetch('/api/admin/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, makeAdmin }),
      })
      if (res.ok) await loadStats()
    } catch (err) { console.error('Toggle admin error:', err) }
    finally { setToggling(null) }
  }

  const handleUpdateUser = async (userId: string, updates: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        await loadStats()
        if (expandedUser === userId) loadUserDetail(userId)
      }
    } catch (err) { console.error('Update user error:', err) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading admin data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="text-red-400 text-lg font-medium mb-2">Access Denied</div>
        <p className="text-[var(--color-text-secondary)]">{error}</p>
      </div>
    )
  }

  if (!stats) return null

  const { overview, ai, subscriptions, system, journey, users } = stats

  // Filtered users for Users tab
  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchQuery ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.first_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.last_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = !statusFilter || u.subscription_status === statusFilter
    return matchesSearch && matchesStatus
  })

  const tabs: { id: AdminTab; label: string; badge?: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Users', badge: String(overview.totalUsers) },
    { id: 'ai', label: 'AI & Credits' },
    { id: 'revenue', label: 'Revenue' },
    { id: 'system', label: 'System' },
  ]

  const webhookHealthPct = (system.webhooksLast7Days.success + system.webhooksLast7Days.error) > 0
    ? Math.round((system.webhooksLast7Days.success / (system.webhooksLast7Days.success + system.webhooksLast7Days.error)) * 100)
    : 100

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Admin Panel</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Platform management and analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <QuickLink href="https://dashboard.stripe.com" label="Stripe" color="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800" />
          <QuickLink href="https://dashboard.clerk.com" label="Clerk" color="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800" />
          <QuickLink href="https://supabase.com/dashboard" label="Supabase" color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" />
          <button onClick={() => { setLoading(true); loadStats() }} className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-subtle)] transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)] -mx-1 px-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-slate-300'
            }`}
          >
            {tab.label}
            {tab.badge && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW TAB ===== */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* KPI Row 1 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard label="Total Users" value={overview.totalUsers} subtext={`+${overview.signupsLast7Days} this week`} />
            <MetricCard label="Active Subs" value={overview.activeSubscriptions} subtext={`${overview.conversionRate}% conversion`} accent />
            <MetricCard label="Trialing" value={overview.trialingUsers} subtext={`${overview.canceledUsers} canceled`} />
            <MetricCard label="Est. MRR" value={`$${overview.estimatedMRR.toLocaleString()}`} subtext="Active subscriptions" accent />
            <MetricCard label="Platform GMV" value={`$${Math.round(overview.platformGMV).toLocaleString()}`} subtext={`${overview.totalJobs.toLocaleString()} jobs`} />
            <MetricCard label="Webhook Health" value={`${webhookHealthPct}%`} subtext={`${system.webhooksLast7Days.error} errors (7d)`} warn={webhookHealthPct < 95} />
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <Card title="Recent Activity" action={{ label: 'View all users', onClick: () => setActiveTab('users') }}>
              <div className="divide-y divide-[var(--color-border)]">
                {stats.recentActivity.slice(0, 8).map((a, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${a.type === 'signup' ? 'bg-green-500' : a.type === 'webhook_error' ? 'bg-red-500' : 'bg-blue-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--color-text-primary)] truncate">{a.description}</p>
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)] shrink-0">{timeAgo(a.timestamp)}</span>
                  </div>
                ))}
                {stats.recentActivity.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">No recent activity</div>
                )}
              </div>
            </Card>

            {/* Subscription Breakdown */}
            <Card title="Subscription Breakdown">
              <div className="p-4 space-y-3">
                <BreakdownRow label="Active (Paid)" count={overview.activeSubscriptions} total={overview.totalUsers} color="bg-green-500" />
                <BreakdownRow label="Trialing" count={overview.trialingUsers} total={overview.totalUsers} color="bg-amber-500" />
                <BreakdownRow label="Canceled" count={overview.canceledUsers} total={overview.totalUsers} color="bg-red-400" />
                <BreakdownRow label="Past Due" count={overview.pastDueUsers} total={overview.totalUsers} color="bg-orange-500" />
                <BreakdownRow label="Free / Inactive" count={overview.inactiveUsers} total={overview.totalUsers} color="bg-slate-400" />
                <div className="pt-3 mt-3 border-t border-[var(--color-border)] grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-[var(--color-text-primary)]">{overview.totalJobs.toLocaleString()}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Jobs Logged</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[var(--color-text-primary)]">{overview.totalQuotes.toLocaleString()}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Quotes Sent</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[var(--color-text-primary)]">{overview.totalCustomers.toLocaleString()}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Customers</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Customer Journey Funnel */}
          <Card title="Customer Journey" action={{ label: 'View users', onClick: () => setActiveTab('users') }}>
            <div className="p-4">
              <div className="space-y-2">
                {[
                  { label: 'Signed Up', count: journey.signedUp, color: 'bg-slate-400' },
                  { label: 'Subscribed (Trial/Paid)', count: journey.subscribed, color: 'bg-blue-500' },
                  { label: 'Completed Onboarding', count: journey.onboarded, color: 'bg-amber-500' },
                  { label: 'Logged First Job', count: journey.firstJob, color: 'bg-orange-500' },
                  { label: 'Created First Quote', count: journey.firstQuote, color: 'bg-green-500' },
                  { label: 'Engaged (Multi-feature)', count: journey.engaged, color: 'bg-emerald-500' },
                ].map((step, i) => {
                  const pct = journey.signedUp > 0 ? Math.round((step.count / journey.signedUp) * 100) : 0
                  const dropoff = i > 0 && journey.signedUp > 0
                    ? Math.round(((([journey.signedUp, journey.subscribed, journey.onboarded, journey.firstJob, journey.firstQuote, journey.engaged][i - 1]) - step.count) / journey.signedUp) * 100)
                    : 0
                  return (
                    <div key={step.label}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-[var(--color-text-secondary)]">{step.label}</span>
                        <div className="flex items-center gap-2">
                          {dropoff > 0 && <span className="text-[10px] text-red-400">-{dropoff}%</span>}
                          <span className="font-semibold text-[var(--color-text-primary)]">{step.count} <span className="text-[var(--color-text-faint)] font-normal">({pct}%)</span></span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${step.color} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ===== USERS TAB ===== */}
      {activeTab === 'users' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-2 text-sm bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-orange-500/30 flex-1"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="inactive">Inactive</option>
              <option value="canceled">Canceled</option>
              <option value="past_due">Past Due</option>
            </select>
            <span className="text-sm text-[var(--color-text-muted)] self-center whitespace-nowrap">
              {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid gap-2">
            {filteredUsers.map((user) => (
              <div key={user.id}>
                {/* User Row */}
                <button
                  onClick={() => handleExpandUser(user.id)}
                  className={`w-full text-left bg-[var(--color-bg-card)] border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:shadow-sm transition-all ${
                    expandedUser === user.id ? 'border-orange-500/50 rounded-b-none' : 'border-[var(--color-border)]'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-white">{(user.first_name || user.email).charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                          {user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.email}
                        </p>
                        {user.is_admin && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 uppercase">{user.role}</span>}
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-center shrink-0">
                    <LifecycleBadge stage={user.lifecycleStage} />
                    <StatusBadge status={user.subscription_status} />
                    <StatPill label="jobs" value={user.jobCount} />
                    <StatPill label="quotes" value={user.quoteCount} />
                    <StatPill label="AI" value={user.threadCount} />
                    <span className="text-xs text-[var(--color-text-muted)] hidden sm:block">{new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                    <svg className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${expandedUser === user.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded User Detail */}
                {expandedUser === user.id && (
                  <div className="bg-[var(--color-bg-card)] border border-t-0 border-orange-500/50 rounded-b-xl p-5">
                    {detailLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : userDetail ? (
                      <div className="space-y-5">
                        {/* Profile Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <DetailField label="User ID" value={user.id} mono />
                          <DetailField label="Clerk ID" value={user.clerk_user_id} mono />
                          <DetailField label="Stripe Customer" value={user.stripe_customer_id || '—'} mono />
                          <DetailField label="Stripe Subscription" value={user.stripe_subscription_id || '—'} mono />
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <MiniStat label="Jobs" value={String(userDetail.stats.jobCount)} />
                          <MiniStat label="Quotes" value={String(userDetail.stats.quoteCount)} />
                          <MiniStat label="AI Threads" value={String(userDetail.stats.threadCount)} />
                          <MiniStat label="Revenue Tracked" value={`$${Math.round(userDetail.stats.totalRevenue).toLocaleString()}`} />
                          <MiniStat label="Credits Used (Lifetime)" value={String(user.ai_credits_used_lifetime)} />
                        </div>

                        {/* Journey & Subscription */}
                        <div className="p-3 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)] space-y-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                <LifecycleBadge stage={user.lifecycleStage} /> <StatusBadge status={user.subscription_status} /> {user.subscription_plan && <span className="capitalize text-[var(--color-text-muted)]">({user.subscription_plan})</span>}
                              </p>
                              {user.subscription_ends_at && (
                                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                  {user.subscription_status === 'trialing' ? 'Trial ends' : 'Renews'}: {new Date(user.subscription_ends_at).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              Joined {new Date(user.created_at).toLocaleDateString()} ({timeAgo(user.created_at)})
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {[
                              { label: 'Signed Up', done: true },
                              { label: 'Subscribed', done: ['subscribed', 'onboarded', 'activated', 'engaged'].includes(user.lifecycleStage) },
                              { label: 'Onboarded', done: user.onboarded },
                              { label: '1st Job', done: user.jobCount > 0 },
                              { label: '1st Quote', done: user.quoteCount > 0 },
                              { label: 'AI Used', done: user.threadCount > 0 },
                            ].map((step, i) => (
                              <div key={i} className="flex items-center gap-1 flex-1">
                                <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${step.done ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                  {step.done && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                </div>
                                <span className={`text-[10px] ${step.done ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-faint)]'}`}>{step.label}</span>
                                {i < 5 && <div className={`flex-1 h-px ${step.done ? 'bg-green-500/30' : 'bg-slate-200 dark:bg-slate-700'}`} />}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-border)]">
                          <button
                            onClick={() => handleToggleAdmin(user.id, !user.is_admin)}
                            disabled={toggling === user.id}
                            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${user.is_admin ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'} disabled:opacity-50`}
                          >
                            {toggling === user.id ? '...' : user.is_admin ? 'Remove Admin' : 'Make Admin'}
                          </button>
                          {user.subscription_status === 'inactive' && (
                            <button
                              onClick={() => handleUpdateUser(user.id, { subscription_status: 'trialing', subscription_plan: 'monthly', subscription_ends_at: new Date(Date.now() + 14 * 86400000).toISOString() })}
                              className="px-3 py-1.5 text-xs rounded-lg font-medium bg-green-500/10 text-green-500 hover:bg-green-500/20 transition"
                            >
                              Grant 14-Day Trial
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const credits = prompt('Credits to add:')
                              if (credits && !isNaN(Number(credits))) {
                                handleUpdateUser(user.id, { ai_credits_balance: user.ai_credits_balance + Number(credits) })
                              }
                            }}
                            className="px-3 py-1.5 text-xs rounded-lg font-medium bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition"
                          >
                            Adjust Credits ({user.ai_credits_balance})
                          </button>
                          {user.stripe_customer_id && (
                            <a
                              href={`https://dashboard.stripe.com/customers/${user.stripe_customer_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 text-xs rounded-lg font-medium bg-violet-500/10 text-violet-500 hover:bg-violet-500/20 transition inline-flex items-center gap-1"
                            >
                              View in Stripe
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--color-text-muted)] text-center py-4">Failed to load user details.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-[var(--color-text-muted)]">
                {searchQuery || statusFilter ? 'No users match your filters.' : 'No users found.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== AI & CREDITS TAB ===== */}
      {activeTab === 'ai' && (
        <div className="space-y-6 animate-fade-in">
          {/* KPI */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard label="AI Threads" value={ai.totalThreads.toLocaleString()} subtext="Total conversations" />
            <MetricCard label="Messages" value={ai.totalMessages.toLocaleString()} subtext="All AI messages" />
            <MetricCard label="Tokens Used" value={formatNumber(ai.totalTokensUsed)} subtext="Total consumption" />
            <MetricCard label="Est. OpenAI Cost" value={`$${ai.estimatedOpenAICost.toFixed(2)}`} subtext="~$0.015/1k tokens" accent />
            <MetricCard label="Credits Purchased" value={ai.totalCreditsPurchased.toLocaleString()} subtext="All time" />
            <MetricCard label="Credits Used" value={ai.totalCreditsUsed.toLocaleString()} subtext={`${ai.totalCreditsPurchased - ai.totalCreditsUsed} remaining`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top AI Users */}
            <Card title="Top AI Users">
              <div className="divide-y divide-[var(--color-border)]">
                {ai.topUsers.length > 0 ? ai.topUsers.map((u, i) => (
                  <div key={u.userId} className="px-4 py-3 flex items-center gap-3">
                    <span className="w-5 text-xs font-bold text-[var(--color-text-faint)] text-right">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{u.name || u.email}</p>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">{u.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{u.messageCount.toLocaleString()} msgs</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{u.creditsUsedLifetime} credits used</p>
                    </div>
                  </div>
                )) : (
                  <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">No AI usage yet</div>
                )}
              </div>
            </Card>

            {/* Recent Credit Transactions */}
            <Card title="Recent Credit Transactions">
              <div className="divide-y divide-[var(--color-border)]">
                {ai.recentTransactions.length > 0 ? ai.recentTransactions.slice(0, 10).map(tx => (
                  <div key={tx.id} className="px-4 py-3 flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${tx.type === 'purchase' ? 'bg-green-500' : tx.type === 'usage' ? 'bg-orange-500' : tx.type === 'grant' ? 'bg-blue-500' : 'bg-slate-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--color-text-primary)] truncate">{tx.description}</p>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">{tx.userName || tx.userEmail}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${tx.amount > 0 ? 'text-green-500' : 'text-[var(--color-text-primary)]'}`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">{timeAgo(tx.created_at)}</p>
                    </div>
                  </div>
                )) : (
                  <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">No credit transactions yet</div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ===== REVENUE TAB ===== */}
      {activeTab === 'revenue' && (
        <div className="space-y-6 animate-fade-in">
          {/* KPI */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <MetricCard label="Est. MRR" value={`$${overview.estimatedMRR.toLocaleString()}`} subtext="Monthly recurring" accent />
            <MetricCard label="Est. ARR" value={`$${Math.round(overview.estimatedMRR * 12).toLocaleString()}`} subtext="Annual projection" />
            <MetricCard label="Paying Users" value={overview.activeSubscriptions} subtext={`of ${overview.totalUsers} total`} />
            <MetricCard label="Conversion" value={`${overview.conversionRate}%`} subtext="Free → Paid" />
            <MetricCard label="Platform GMV" value={`$${Math.round(overview.platformGMV).toLocaleString()}`} subtext="Total revenue tracked" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Subscription Plans */}
            <Card title="Active Subscriptions by Plan">
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-center">
                    <p className="text-2xl font-bold text-[var(--color-text-primary)]">{subscriptions.monthlyActive}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">Monthly Active</p>
                    <p className="text-xs text-[var(--color-text-faint)]">${(subscriptions.monthlyActive * 29.99).toFixed(0)}/mo</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)] text-center">
                    <p className="text-2xl font-bold text-[var(--color-text-primary)]">{subscriptions.annualActive}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">Annual Active</p>
                    <p className="text-xs text-[var(--color-text-faint)]">${(subscriptions.annualActive * 24.99).toFixed(0)}/mo</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-center">
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{subscriptions.monthlyTrialing}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Monthly Trials</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-center">
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{subscriptions.annualTrialing}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Annual Trials</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Status Funnel */}
            <Card title="User Funnel">
              <div className="p-5 space-y-3">
                {[
                  { label: 'Total Signups', count: overview.totalUsers, color: 'bg-blue-500' },
                  { label: 'Started Trial', count: overview.trialingUsers + overview.activeSubscriptions + overview.canceledUsers, color: 'bg-amber-500' },
                  { label: 'Active (Paid)', count: overview.activeSubscriptions, color: 'bg-green-500' },
                  { label: 'Canceled', count: overview.canceledUsers, color: 'bg-red-400' },
                ].map((step, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-[var(--color-text-secondary)]">{step.label}</span>
                      <span className="font-semibold text-[var(--color-text-primary)]">
                        {step.count}
                        {overview.totalUsers > 0 && <span className="text-[var(--color-text-faint)] font-normal ml-1">({Math.round((step.count / overview.totalUsers) * 100)}%)</span>}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${step.color} transition-all`} style={{ width: `${overview.totalUsers > 0 ? (step.count / overview.totalUsers) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}

                <div className="pt-3 mt-2 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Trial-to-paid conversion: <span className="font-semibold text-[var(--color-text-primary)]">
                      {(overview.trialingUsers + overview.activeSubscriptions + overview.canceledUsers) > 0
                        ? Math.round((overview.activeSubscriptions / (overview.trialingUsers + overview.activeSubscriptions + overview.canceledUsers)) * 100)
                        : 0}%
                    </span>
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ===== SYSTEM TAB ===== */}
      {activeTab === 'system' && (
        <div className="space-y-6 animate-fade-in">
          {/* Health KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard
              label="Webhook Success (7d)"
              value={system.webhooksLast7Days.success}
              subtext={`${webhookHealthPct}% success rate`}
              warn={webhookHealthPct < 95}
            />
            <MetricCard
              label="Webhook Errors (7d)"
              value={system.webhooksLast7Days.error}
              subtext={system.webhooksLast7Days.error > 0 ? 'Needs attention' : 'All clear'}
              warn={system.webhooksLast7Days.error > 0}
            />
            <MetricCard label="Emails Sent" value={system.emails.sent} subtext={`${system.emails.last7Days} last 7 days`} />
            <MetricCard label="Emails Failed" value={system.emails.failed} subtext={system.emails.failed > 0 ? 'Check delivery' : 'All delivered'} warn={system.emails.failed > 0} />
            <MetricCard label="Mass Campaigns" value={system.emails.campaigns} subtext="Email blasts" />
            <MetricCard label="Signups (30d)" value={overview.signupsLast30Days} subtext={`${overview.signupsLast7Days} this week`} />
          </div>

          {/* Webhook Health Banner */}
          {system.webhooksLast7Days.error > 0 && (
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Webhook failures detected</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {system.webhooksLast7Days.error} webhook{system.webhooksLast7Days.error !== 1 ? 's' : ''} failed in the last 7 days.
                  Check Stripe Dashboard for 307 redirect issues (domain mismatch between non-www and www).
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Webhook Errors */}
            <Card title="Recent Webhook Errors">
              <div className="divide-y divide-[var(--color-border)]">
                {system.recentErrors.length > 0 ? system.recentErrors.map(e => (
                  <div key={e.id} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${e.source === 'stripe' ? 'bg-violet-500/15 text-violet-500' : 'bg-blue-500/15 text-blue-500'}`}>
                        {e.source}
                      </span>
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{e.eventType}</span>
                      <span className="text-xs text-[var(--color-text-muted)] ml-auto">{timeAgo(e.createdAt)}</span>
                    </div>
                    {e.errorMessage && <p className="text-xs text-red-400 truncate">{e.errorMessage}</p>}
                  </div>
                )) : (
                  <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">No recent errors</div>
                )}
              </div>
            </Card>

            {/* Email Delivery by Type */}
            <Card title="Email Delivery by Type">
              <div className="divide-y divide-[var(--color-border)]">
                {Object.keys(system.emails.byType).length > 0 ? (
                  Object.entries(system.emails.byType)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <div key={type} className="px-4 py-2.5 flex items-center justify-between">
                        <span className="text-sm text-[var(--color-text-secondary)] capitalize">{type.replace(/_/g, ' ')}</span>
                        <span className="text-sm font-semibold text-[var(--color-text-primary)]">{count}</span>
                      </div>
                    ))
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">No emails sent yet</div>
                )}
              </div>
            </Card>

            {/* Webhook & Cron Health */}
            <Card title="Health & Scheduled Tasks">
              <div className="p-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">Webhook Delivery (7d)</span>
                    <span className={`text-sm font-bold ${webhookHealthPct >= 95 ? 'text-green-500' : webhookHealthPct >= 80 ? 'text-amber-500' : 'text-red-500'}`}>{webhookHealthPct}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${webhookHealthPct >= 95 ? 'bg-green-500' : webhookHealthPct >= 80 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${webhookHealthPct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
                    <span>{system.webhooksLast7Days.success} delivered</span>
                    <span>{system.webhooksLast7Days.error} failed</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--color-border)]">
                  <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Scheduled Tasks</p>
                  <div className="space-y-1.5">
                    {[
                      { name: 'Trial Reminders', schedule: 'Daily 9am UTC' },
                      { name: 'Follow-up Reminders', schedule: 'Daily 8am UTC' },
                      { name: 'Weekly Insights', schedule: 'Mondays 9am UTC' },
                    ].map(cron => (
                      <div key={cron.name} className="flex items-center justify-between text-xs">
                        <span className="text-[var(--color-text-secondary)]">{cron.name}</span>
                        <span className="text-[var(--color-text-muted)] font-mono">{cron.schedule}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Helper Components ----------

function QuickLink({ href, label, color }: { href: string; label: string; color: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:shadow-sm ${color}`}>
      {label}
      <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
    </a>
  )
}

function MetricCard({ label, value, subtext, accent, warn }: {
  label: string; value: string | number; subtext?: string; accent?: boolean; warn?: boolean
}) {
  return (
    <div className={`bg-[var(--color-bg-card)] border rounded-xl p-4 ${warn ? 'border-red-500/30' : 'border-[var(--color-border)]'}`}>
      <div className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1 truncate">{label}</div>
      <div className={`text-xl font-bold truncate ${warn ? 'text-red-500' : accent ? 'text-orange-500' : 'text-[var(--color-text-primary)]'}`}>{value}</div>
      {subtext && <p className="text-[11px] text-[var(--color-text-faint)] mt-1 truncate">{subtext}</p>}
    </div>
  )
}

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
        {action && <button onClick={action.onClick} className="text-xs text-orange-500 hover:underline font-medium">{action.label}</button>}
      </div>
      {children}
    </div>
  )
}

function BreakdownRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-[var(--color-text-secondary)]">{label}</span>
        <span className="font-semibold text-[var(--color-text-primary)]">{count} <span className="text-[var(--color-text-faint)] font-normal">({pct}%)</span></span>
      </div>
      <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function LifecycleBadge({ stage }: { stage: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    signed_up: { label: 'New', cls: 'bg-slate-500/15 text-slate-500' },
    subscribed: { label: 'Subscribed', cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
    onboarded: { label: 'Onboarded', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
    activated: { label: 'Activated', cls: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
    engaged: { label: 'Engaged', cls: 'bg-green-500/15 text-green-600 dark:text-green-400' },
    churned: { label: 'Churned', cls: 'bg-red-500/15 text-red-500' },
  }
  const c = config[stage] || config.signed_up
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${c.cls}`}>{c.label}</span>
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-500/15 text-green-600 dark:text-green-400',
    trialing: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    inactive: 'bg-slate-500/15 text-slate-500',
    canceled: 'bg-red-500/15 text-red-500',
    past_due: 'bg-red-500/15 text-red-500',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.inactive}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2 py-1 bg-[var(--color-bg-subtle)] rounded-md text-center">
      <p className="text-xs font-bold text-[var(--color-text-primary)]">{value}</p>
      <p className="text-[9px] text-[var(--color-text-faint)]">{label}</p>
    </div>
  )
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center p-3 rounded-lg bg-[var(--color-bg-subtle)] border border-[var(--color-border)]">
      <p className={`text-lg font-bold ${accent ? 'text-orange-500' : 'text-[var(--color-text-primary)]'}`}>{value}</p>
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
    </div>
  )
}

function DetailField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-[var(--color-text-faint)] uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-xs text-[var(--color-text-secondary)] truncate ${mono ? 'font-mono' : ''}`} title={value}>{value}</p>
    </div>
  )
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
