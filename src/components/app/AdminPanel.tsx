'use client'

import { useEffect, useState, useCallback } from 'react'

interface AdminUser {
  id: string
  clerk_user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  subscription_status: string
  subscription_plan: string | null
  subscription_ends_at: string | null
  is_admin: boolean
  role: string
  created_at: string
  ai_credits_balance?: number
  jobCount?: number
}

interface AdminMetrics {
  totalUsers: number
  activeSubscriptions: number
  trialingUsers: number
  totalJobs: number
  platformRevenue: number
}

interface WebhookEvent {
  id: string
  source: string
  event_type: string
  event_id: string | null
  status: string
  error_message: string | null
  created_at: string
  payload?: Record<string, unknown>
}

type AdminTab = 'overview' | 'users' | 'webhooks'

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([])
  const [webhookTotal, setWebhookTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [webhooksLoading, setWebhooksLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [webhookSource, setWebhookSource] = useState('')

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/metrics')
      if (!res.ok) {
        if (res.status === 403) {
          setError('You do not have admin access.')
          return
        }
        throw new Error('Failed to load admin data')
      }
      const data = await res.json()
      setMetrics(data.metrics)
      setUsers(data.users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadWebhooks = useCallback(async () => {
    setWebhooksLoading(true)
    try {
      const params = new URLSearchParams()
      if (webhookSource) params.set('source', webhookSource)
      const res = await fetch(`/api/admin/webhooks?${params}`)
      if (!res.ok) throw new Error('Failed to load webhooks')
      const data = await res.json()
      setWebhookEvents(data.events || [])
      setWebhookTotal(data.total || 0)
    } catch (err) {
      console.error('Webhook load error:', err)
    } finally {
      setWebhooksLoading(false)
    }
  }, [webhookSource])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (activeTab === 'webhooks') {
      loadWebhooks()
    }
  }, [activeTab, loadWebhooks])

  const handleToggleAdmin = async (userId: string, makeAdmin: boolean) => {
    setToggling(userId)
    try {
      const res = await fetch('/api/admin/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, makeAdmin }),
      })
      if (!res.ok) throw new Error('Failed to toggle admin')
      await loadData()
    } catch (err) {
      console.error('Toggle admin error:', err)
    } finally {
      setToggling(null)
    }
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchQuery || 
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.first_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.last_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = !statusFilter || u.subscription_status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Computed stats
  const recentUsers = users.filter(u => {
    const created = new Date(u.created_at)
    const weekAgo = new Date(Date.now() - 7 * 86400000)
    return created >= weekAgo
  })
  const freeUsers = users.filter(u => !['active', 'trialing'].includes(u.subscription_status))
  const conversionRate = users.length > 0
    ? Math.round(((metrics?.activeSubscriptions || 0) / users.length) * 100)
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
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

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      id: 'users',
      label: `Users (${users.length})`,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      id: 'webhooks',
      label: 'Webhooks',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Admin Panel</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Platform overview and management</p>
        </div>
        {/* Quick links */}
        <div className="flex items-center gap-2">
          <QuickLink href="https://dashboard.stripe.com" label="Stripe" color="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800" />
          <QuickLink href="https://dashboard.clerk.com" label="Clerk" color="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800" />
          <QuickLink href="https://supabase.com/dashboard" label="Supabase" color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-slate-300'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== OVERVIEW TAB ===== */}
      {activeTab === 'overview' && metrics && (
        <div className="space-y-6 animate-fade-in">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <MetricCard
              label="Total Users"
              value={metrics.totalUsers}
              subtext={`+${recentUsers.length} this week`}
              trend={recentUsers.length > 0 ? 'up' : 'neutral'}
            />
            <MetricCard
              label="Active Subs"
              value={metrics.activeSubscriptions}
              subtext={`${conversionRate}% conversion`}
              trend="up"
              accent
            />
            <MetricCard
              label="Trialing"
              value={metrics.trialingUsers}
              subtext={`${freeUsers.length} free tier`}
              trend="neutral"
            />
            <MetricCard
              label="Total Jobs"
              value={metrics.totalJobs.toLocaleString()}
              subtext="All time"
              trend="up"
            />
            <MetricCard
              label="Platform GMV"
              value={`$${metrics.platformRevenue.toLocaleString()}`}
              subtext="Total revenue tracked"
              trend="up"
              accent
            />
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Signups */}
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Recent Signups</h3>
                <button
                  onClick={() => setActiveTab('users')}
                  className="text-xs text-orange-500 hover:underline font-medium"
                >
                  View all
                </button>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {users.slice(0, 5).map(user => (
                  <div key={user.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-white">
                        {(user.first_name || user.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user.email}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">
                        {timeAgo(user.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={user.subscription_status} />
                  </div>
                ))}
                {users.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">No users yet</div>
                )}
              </div>
            </div>

            {/* Subscription Breakdown */}
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--color-border)]">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Subscription Breakdown</h3>
              </div>
              <div className="p-4 space-y-3">
                <BreakdownRow
                  label="Active (Paid)"
                  count={metrics.activeSubscriptions}
                  total={metrics.totalUsers}
                  color="bg-green-500"
                />
                <BreakdownRow
                  label="Trialing"
                  count={metrics.trialingUsers}
                  total={metrics.totalUsers}
                  color="bg-amber-500"
                />
                <BreakdownRow
                  label="Free / Inactive"
                  count={freeUsers.length}
                  total={metrics.totalUsers}
                  color="bg-slate-400"
                />

                <div className="pt-3 border-t border-[var(--color-border)]">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-muted)]">Conversion Rate</span>
                    <span className="font-bold text-[var(--color-text-primary)]">{conversionRate}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all"
                      style={{ width: `${conversionRate}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== USERS TAB ===== */}
      {activeTab === 'users' && (
        <div className="space-y-4 animate-fade-in">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search users..."
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
            </select>
          </div>

          {/* User Cards */}
          <div className="grid gap-3">
            {filteredUsers.map((user) => (
              <div key={user.id} className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-white">
                      {(user.first_name || user.email).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                        {user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'No name'}
                      </p>
                      {user.is_admin && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 uppercase">
                          {user.role}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">{user.email}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-center">
                  <div>
                    <StatusBadge status={user.subscription_status} />
                    {user.subscription_plan && (
                      <p className="text-[10px] text-[var(--color-text-faint)] mt-0.5 capitalize">{user.subscription_plan}</p>
                    )}
                  </div>
                  {user.jobCount !== undefined && (
                    <div className="px-3 py-1 bg-[var(--color-bg-subtle)] rounded-lg">
                      <p className="text-sm font-bold text-[var(--color-text-primary)]">{user.jobCount}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">jobs</p>
                    </div>
                  )}
                  <div className="px-3 py-1 bg-[var(--color-bg-subtle)] rounded-lg">
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-faint)]">joined</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleAdmin(user.id, !user.is_admin)}
                    disabled={toggling === user.id}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                      user.is_admin
                        ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                        : 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'
                    } disabled:opacity-50`}
                  >
                    {toggling === user.id ? '...' : user.is_admin ? 'Remove Admin' : 'Make Admin'}
                  </button>
                </div>
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

      {/* ===== WEBHOOKS TAB ===== */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4 animate-fade-in">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={webhookSource}
              onChange={(e) => setWebhookSource(e.target.value)}
              className="px-3 py-2 text-sm bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            >
              <option value="">All Sources</option>
              <option value="clerk">Clerk</option>
              <option value="stripe">Stripe</option>
            </select>
            <span className="text-sm text-[var(--color-text-muted)] self-center">
              {webhookTotal} total event{webhookTotal !== 1 ? 's' : ''}
            </span>
          </div>

          {webhooksLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
              <div className="divide-y divide-[var(--color-border)]">
                {webhookEvents.map(event => (
                  <div key={event.id} className="px-4 py-3 flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      event.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                          event.source === 'stripe'
                            ? 'bg-violet-500/15 text-violet-500'
                            : 'bg-blue-500/15 text-blue-500'
                        }`}>
                          {event.source}
                        </span>
                        <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                          {event.event_type}
                        </span>
                      </div>
                      {event.error_message && (
                        <p className="text-xs text-red-400 mt-0.5 truncate">{event.error_message}</p>
                      )}
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                      {timeAgo(event.created_at)}
                    </span>
                  </div>
                ))}
                {webhookEvents.length === 0 && (
                  <div className="px-4 py-12 text-center text-sm text-[var(--color-text-muted)]">
                    No webhook events recorded yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- Helper Components ---

function QuickLink({ href, label, color }: { href: string; label: string; color: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:shadow-sm ${color}`}
    >
      {label}
      <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  )
}

function MetricCard({ label, value, subtext, trend, accent }: {
  label: string
  value: string | number
  subtext?: string
  trend?: 'up' | 'down' | 'neutral'
  accent?: boolean
}) {
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
      <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">{label}</div>
      <div className="flex items-end gap-2">
        <span className={`text-2xl font-bold ${accent ? 'text-orange-500' : 'text-[var(--color-text-primary)]'}`}>
          {value}
        </span>
        {trend === 'up' && (
          <svg className="w-4 h-4 text-green-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        )}
      </div>
      {subtext && (
        <p className="text-xs text-[var(--color-text-faint)] mt-1">{subtext}</p>
      )}
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
      {status}
    </span>
  )
}

function timeAgo(dateString: string): string {
  const now = Date.now()
  const date = new Date(dateString).getTime()
  const seconds = Math.floor((now - date) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
