'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface AdminUser {
  id: string
  clerk_user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: string
  subscription_status: string
  subscription_plan: string | null
  subscription_ends_at: string | null
  ai_credits_balance: number
  created_at: string
  jobCount: number
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  trialing: 'bg-amber-500/20 text-amber-400',
  inactive: 'bg-slate-700 text-slate-400',
  canceled: 'bg-red-500/20 text-red-400',
  past_due: 'bg-red-500/20 text-red-400',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      params.set('page', String(page))

      const res = await fetch(`/api/admin/users?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setUsers(data.users || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, page])

  useEffect(() => {
    const timer = setTimeout(loadUsers, 300)
    return () => clearTimeout(timer)
  }, [loadUsers])

  const totalPages = Math.ceil(total / 50)

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
            <Link href="/app/admin/webhooks" className="text-slate-400 hover:text-white transition-colors">Webhooks</Link>
            <Link href="/app" className="text-slate-500 hover:text-white transition-colors">Back to App</Link>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold">Users ({total})</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 w-64 focus:border-orange-500 focus:outline-none"
            />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="inactive">Inactive</option>
              <option value="canceled">Canceled</option>
              <option value="past_due">Past Due</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500">
                  <th className="text-left p-3 font-medium">User</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Plan</th>
                  <th className="text-right p-3 font-medium">Jobs</th>
                  <th className="text-right p-3 font-medium">Credits</th>
                  <th className="text-left p-3 font-medium">Joined</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-500">Loading...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-500">No users found</td></tr>
                ) : users.map(user => (
                  <tr key={user.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="p-3">
                      <div>
                        <p className="font-medium text-white">
                          {[user.first_name, user.last_name].filter(Boolean).join(' ') || 'No name'}
                        </p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[user.subscription_status] || STATUS_COLORS.inactive}`}>
                        {user.subscription_status || 'inactive'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">
                      {user.subscription_plan || '—'}
                    </td>
                    <td className="p-3 text-right text-slate-400">{user.jobCount}</td>
                    <td className="p-3 text-right text-slate-400">{user.ai_credits_balance || 0}</td>
                    <td className="p-3 text-slate-500 text-xs">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        href={`/app/admin/users/${user.id}`}
                        className="text-xs text-orange-400 hover:text-orange-300 font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-xs text-slate-400 hover:text-white disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="text-xs text-slate-400 hover:text-white disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
