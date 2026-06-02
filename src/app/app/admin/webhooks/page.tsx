'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface WebhookEvent {
  id: string
  source: string
  event_type: string
  event_id: string | null
  payload: Record<string, unknown>
  status: string
  // The logger writes `error_message`; older rows may carry the legacy `error`.
  error_message: string | null
  error: string | null
  created_at: string
}

export default function AdminWebhooksPage() {
  const [events, setEvents] = useState<WebhookEvent[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [sourceFilter, setSourceFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (sourceFilter) params.set('source', sourceFilter)
      params.set('page', String(page))

      const res = await fetch(`/api/admin/webhooks?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setEvents(data.events || [])
      setTotal(data.total || 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [sourceFilter, page])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

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
            <Link href="/app/admin/users" className="text-slate-400 hover:text-white transition-colors">Users</Link>
            <Link href="/app/admin/payments" className="text-slate-400 hover:text-white transition-colors">Payments</Link>
            <Link href="/app/admin/webhooks" className="text-orange-400 font-medium">Webhooks</Link>
            <Link href="/app" className="text-slate-500 hover:text-white transition-colors">Back to App</Link>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Webhook Events ({total})</h2>
          <div className="flex gap-2">
            <select
              value={sourceFilter}
              onChange={(e) => { setSourceFilter(e.target.value); setPage(1) }}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
            >
              <option value="">All sources</option>
              <option value="stripe">Stripe</option>
              <option value="clerk">Clerk</option>
            </select>
            <button
              onClick={loadEvents}
              className="px-3 py-2 bg-slate-800 text-slate-300 text-sm rounded-lg hover:bg-slate-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {events.length === 0 && !loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
            <p className="text-slate-500">No webhook events logged yet.</p>
            <p className="text-xs text-slate-600 mt-2">Events will appear here once Stripe or Clerk sends webhooks to your app.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-8 text-slate-500">Loading...</div>
            ) : events.map(event => (
              <div
                key={event.id}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                      event.source === 'stripe' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {event.source}
                    </span>
                    <span className="text-sm font-medium text-white">{event.event_type}</span>
                    {event.status === 'error' && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-500/20 text-red-400">ERROR</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                    <svg className={`w-4 h-4 text-slate-500 transition-transform ${expandedId === event.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {expandedId === event.id && (
                  <div className="px-4 pb-4 border-t border-slate-800">
                    {event.event_id && (
                      <p className="text-xs text-slate-600 mt-2">Event ID: {event.event_id}</p>
                    )}
                    {(event.error_message || event.error) && (
                      <div className="mt-2 p-2 bg-red-950/30 border border-red-900/50 rounded text-xs text-red-400">
                        {event.error_message || event.error}
                      </div>
                    )}
                    <pre className="mt-2 p-3 bg-slate-950 rounded-lg text-xs text-slate-400 overflow-auto max-h-60">
                      {JSON.stringify(event.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-sm text-slate-400 hover:text-white disabled:opacity-30"
            >
              Previous
            </button>
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-sm text-slate-400 hover:text-white disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
