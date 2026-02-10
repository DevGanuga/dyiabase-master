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
}

interface AdminMetrics {
  totalUsers: number
  activeSubscriptions: number
  trialingUsers: number
  totalJobs: number
  platformRevenue: number
}

export function AdminPanel() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

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

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggleAdmin = async (userId: string, makeAdmin: boolean) => {
    setToggling(userId)
    try {
      const res = await fetch('/api/admin/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, makeAdmin }),
      })
      if (!res.ok) throw new Error('Failed to toggle admin')
      // Reload data
      await loadData()
    } catch (err) {
      console.error('Toggle admin error:', err)
    } finally {
      setToggling(null)
    }
  }

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.first_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.last_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Admin Panel</h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">Platform overview and user management</p>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <MetricCard label="Total Users" value={metrics.totalUsers} />
          <MetricCard label="Active Subs" value={metrics.activeSubscriptions} accent />
          <MetricCard label="Trialing" value={metrics.trialingUsers} />
          <MetricCard label="Total Jobs" value={metrics.totalJobs} />
          <MetricCard label="Platform GMV" value={`$${metrics.platformRevenue.toLocaleString()}`} accent />
        </div>
      )}

      {/* Users Table */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)] flex flex-col sm:flex-row justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Users ({users.length})</h2>
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-orange-500/30 w-full sm:w-64"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg)]">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-[var(--color-text)]">
                        {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'No name'}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)]">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={user.subscription_status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {user.subscription_plan || '--'}
                  </td>
                  <td className="px-4 py-3">
                    {user.is_admin ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400">
                        {user.role.toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-[var(--color-text-secondary)]">user</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleAdmin(user.id, !user.is_admin)}
                      disabled={toggling === user.id}
                      className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                        user.is_admin
                          ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                          : 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'
                      } disabled:opacity-50`}
                    >
                      {toggling === user.id ? '...' : user.is_admin ? 'Remove Admin' : 'Make Admin'}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                    {searchQuery ? 'No users match your search.' : 'No users found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
      <div className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-bold ${accent ? 'text-orange-500' : 'text-[var(--color-text)]'}`}>
        {value}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-500/15 text-green-400',
    trialing: 'bg-amber-500/15 text-amber-400',
    inactive: 'bg-slate-500/15 text-slate-400',
    canceled: 'bg-red-500/15 text-red-400',
    past_due: 'bg-red-500/15 text-red-400',
  }

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.inactive}`}>
      {status}
    </span>
  )
}
