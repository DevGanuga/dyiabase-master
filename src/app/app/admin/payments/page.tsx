'use client'

import { useState, useEffect, useCallback } from 'react'
import { AdminHeader } from '../page'

interface AdminPayment {
  id: string
  status: string
  kind: string
  amountCents: number
  tipCents: number
  feeCents: number
  customerName: string | null
  description: string | null
  invoiceNumber: string | null
  publicToken: string
  canRefund: boolean
  merchantEmail: string | null
  merchantName: string
  paidAt: string | null
  createdAt: string
}

interface Totals {
  lifetimeCollectedCents: number
  lifetimeFeesCents: number
  monthCollectedCents: number
  monthFeesCents: number
  paidCount: number
}

const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const STATUS_STYLE: Record<string, string> = {
  paid: 'bg-green-500/20 text-green-400',
  pending: 'bg-amber-500/20 text-amber-400',
  checkout_created: 'bg-blue-500/20 text-blue-400',
  refunded: 'bg-purple-500/20 text-purple-400',
  partial_refund: 'bg-purple-500/20 text-purple-300',
  failed: 'bg-red-500/20 text-red-400',
  expired: 'bg-slate-700 text-slate-400',
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<AdminPayment[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refundingId, setRefundingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/payments')
      if (!res.ok) throw new Error(res.status === 403 ? 'Access denied' : 'Failed to load')
      const data = await res.json()
      setPayments(data.payments || [])
      setTotals(data.totals || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const refund = async (id: string) => {
    if (!confirm('Refund this payment in full? The customer is refunded and the transfer + Dyia fee are reversed. This cannot be undone.')) return
    setRefundingId(id)
    try {
      const res = await fetch('/api/admin/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Refund failed')
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Refund failed')
    } finally {
      setRefundingId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <AdminHeader active="payments" />
        <div className="max-w-7xl mx-auto px-6 py-8 text-red-400">{error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <AdminHeader active="payments" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold mb-6">Dyia Pay</h2>

        {/* Totals */}
        {totals && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Dyia fees (this month)</p>
              <p className="text-2xl font-bold mt-1 text-orange-400">{money(totals.monthFeesCents)}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Dyia fees (lifetime)</p>
              <p className="text-2xl font-bold mt-1 text-orange-400">{money(totals.lifetimeFeesCents)}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Collected (this month)</p>
              <p className="text-2xl font-bold mt-1 text-green-400">{money(totals.monthCollectedCents)}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Paid transactions</p>
              <p className="text-2xl font-bold mt-1">{totals.paidCount.toLocaleString()}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Recent payments</h3>
          <button onClick={load} className="px-3 py-1.5 bg-slate-800 text-slate-300 text-sm rounded-lg hover:bg-slate-700 transition-colors">Refresh</button>
        </div>

        {payments.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
            No payments yet. They&apos;ll appear here once merchants start collecting through Dyia Pay.
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                    <th className="px-4 py-3">Merchant</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Tip</th>
                    <th className="px-4 py-3 text-right">Dyia fee</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{p.merchantName}</div>
                        {p.merchantEmail && <div className="text-xs text-slate-500">{p.merchantEmail}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{p.customerName || p.description || p.invoiceNumber || '—'}</td>
                      <td className="px-4 py-3 text-slate-400 capitalize">{p.kind.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(p.amountCents)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-400">{p.tipCents > 0 ? money(p.tipCents) : '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-orange-400">{money(p.feeCents)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${STATUS_STYLE[p.status] || 'bg-slate-700 text-slate-300'}`}>
                          {p.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{new Date(p.paidAt || p.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        {p.canRefund ? (
                          <button
                            onClick={() => refund(p.id)}
                            disabled={refundingId === p.id}
                            className="px-2.5 py-1 bg-red-500/20 text-red-400 text-xs font-medium rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50"
                          >
                            {refundingId === p.id ? 'Refunding…' : 'Refund'}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
