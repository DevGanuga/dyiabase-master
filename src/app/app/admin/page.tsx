'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Metrics {
  totalUsers: number
  activeSubscriptions: number
  trialingUsers: number
  newUsersThisWeek: number
  mrr: number
  arr: number
  arpu: number
  ltv: number
  conversionRate: number
  churnRate: number
  canceledRecent: number
  canceledTotal: number
  payingUsers: number
  totalJobs: number
  totalQuotes: number
  statusBreakdown: Record<string, number>
  signupsByDay: Record<string, number>
  quizSubmissions: number
  quizStartedTrial: number
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/metrics')
      .then(res => {
        if (!res.ok) throw new Error(res.status === 403 ? 'Access denied' : 'Failed to load')
        return res.json()
      })
      .then(data => {
        // The route returns { metrics, users }; the dashboard renders the flat
        // metrics object. Previously the whole payload was stored as `metrics`,
        // so every `m.mrr`/`m.totalUsers` read was undefined and crashed render.
        const next = data?.metrics ?? data
        if (!next || typeof next.totalUsers !== 'number') {
          throw new Error('Failed to load')
        }
        setMetrics(next)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-400">
        <p>{error}</p>
      </div>
    )
  }

  const m = metrics!

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <AdminHeader active="dashboard" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold mb-6">Platform Overview</h2>

        {/* Revenue Metrics */}
        <div className="mb-8">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Revenue</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="MRR" value={`$${m.mrr.toLocaleString()}`} accent="green" />
            <MetricCard label="ARR" value={`$${m.arr.toLocaleString()}`} accent="green" />
            <MetricCard label="ARPU" value={`$${m.arpu}`} />
            <MetricCard label="Est. LTV" value={m.ltv > 0 ? `$${m.ltv}` : 'N/A'} />
          </div>
        </div>

        {/* User Metrics */}
        <div className="mb-8">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Users</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <MetricCard label="Total Users" value={m.totalUsers} />
            <MetricCard label="Paying" value={m.payingUsers} accent="green" />
            <MetricCard label="Trialing" value={m.trialingUsers} accent="amber" />
            <MetricCard label="New This Week" value={m.newUsersThisWeek} />
            <MetricCard label="Trial Conv. Rate" value={`${m.conversionRate}%`} />
          </div>
        </div>

        {/* Health Metrics */}
        <div className="mb-8">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Health</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Monthly Churn" value={`${m.churnRate}%`} accent={m.churnRate > 10 ? 'red' : undefined} />
            <MetricCard label="Canceled (30d)" value={m.canceledRecent} accent={m.canceledRecent > 0 ? 'red' : undefined} />
            <MetricCard label="Total Jobs" value={m.totalJobs.toLocaleString()} />
            <MetricCard label="Total Quotes" value={m.totalQuotes.toLocaleString()} />
          </div>
        </div>

        {/* Signup Trend (Last 7 Days) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Signups (Last 7 Days)</h3>
          <div className="flex items-end gap-2 h-24">
            {Object.entries(m.signupsByDay).map(([day, count]) => {
              const maxCount = Math.max(...Object.values(m.signupsByDay), 1)
              const height = Math.max((count / maxCount) * 100, 4)
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-slate-400">{count}</span>
                  <div
                    className="w-full bg-orange-500/80 rounded-t-sm"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[9px] text-slate-600">{day.slice(5)}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Status Breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">User Status Breakdown</h3>
            <div className="space-y-2">
              {Object.entries(m.statusBreakdown).map(([status, count]) => {
                const pct = m.totalUsers > 0 ? Math.round((count / m.totalUsers) * 100) : 0
                return (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        status === 'active' ? 'bg-green-500' :
                        status === 'trialing' ? 'bg-amber-500' :
                        status === 'canceled' ? 'bg-red-500' :
                        'bg-slate-600'
                      }`} />
                      <span className="text-sm text-slate-400 capitalize">{status}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm font-medium text-white w-8 text-right">{count}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quiz Funnel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Profit Calculator Funnel</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500">Quiz Submissions</span>
                <span className="font-medium">{m.quizSubmissions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Started Trial</span>
                <span className="font-medium">{m.quizStartedTrial}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quiz-to-Trial Rate</span>
                <span className="font-medium">
                  {m.quizSubmissions > 0 ? `${Math.round((m.quizStartedTrial / m.quizSubmissions) * 100)}%` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
          <Link href="/app/admin/users" className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors group">
            <h3 className="font-semibold text-white group-hover:text-orange-400 transition-colors">Manage Users</h3>
            <p className="text-sm text-slate-500 mt-1">{m.totalUsers} total users</p>
          </Link>
          <Link href="/app/admin/payments" className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors group">
            <h3 className="font-semibold text-white group-hover:text-orange-400 transition-colors">Dyia Pay</h3>
            <p className="text-sm text-slate-500 mt-1">Transactions & fees</p>
          </Link>
          <Link href="/app/admin/webhooks" className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors group">
            <h3 className="font-semibold text-white group-hover:text-orange-400 transition-colors">Webhook Logs</h3>
            <p className="text-sm text-slate-500 mt-1">Stripe + Clerk events</p>
          </Link>
          <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors group">
            <h3 className="font-semibold text-white group-hover:text-orange-400 transition-colors">Stripe</h3>
            <p className="text-sm text-slate-500 mt-1">Payments & invoices</p>
          </a>
          <a href="https://dashboard.clerk.com" target="_blank" rel="noopener noreferrer" className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors group">
            <h3 className="font-semibold text-white group-hover:text-orange-400 transition-colors">Clerk</h3>
            <p className="text-sm text-slate-500 mt-1">Auth & user accounts</p>
          </a>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, accent }: { label: string; value: string | number; accent?: 'green' | 'amber' | 'red' }) {
  const colors = {
    green: 'text-green-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
  }
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent ? colors[accent] : 'text-white'}`}>{value}</p>
    </div>
  )
}

export function AdminHeader({ active }: { active: 'dashboard' | 'users' | 'payments' | 'webhooks' }) {
  return (
    <div className="border-b border-slate-800 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/dyia-logo.png" alt="dyia" className="w-8 h-8 object-contain" />
          <h1 className="text-xl font-bold">dyia admin</h1>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/app/admin" className={active === 'dashboard' ? 'text-orange-400 font-medium' : 'text-slate-400 hover:text-white transition-colors'}>Dashboard</Link>
          <Link href="/app/admin/users" className={active === 'users' ? 'text-orange-400 font-medium' : 'text-slate-400 hover:text-white transition-colors'}>Users</Link>
          <Link href="/app/admin/payments" className={active === 'payments' ? 'text-orange-400 font-medium' : 'text-slate-400 hover:text-white transition-colors'}>Payments</Link>
          <Link href="/app/admin/webhooks" className={active === 'webhooks' ? 'text-orange-400 font-medium' : 'text-slate-400 hover:text-white transition-colors'}>Webhooks</Link>
          <Link href="/app" className="text-slate-500 hover:text-white transition-colors">Back to App</Link>
        </nav>
      </div>
    </div>
  )
}
