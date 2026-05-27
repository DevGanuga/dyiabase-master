'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'

interface PublicPaymentLineItem {
  description: string
  quantity: number
  unitAmountCents: number
}

interface PublicPaymentData {
  id: string
  token: string
  status: string
  kind: 'payment_link' | 'invoice' | 'quote_payment' | 'job_payment'
  amountCents: number
  subtotalCents?: number | null
  taxCents?: number | null
  currency: string
  customerName?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  customerAddress?: string | null
  description?: string | null
  invoiceNumber?: string | null
  dueDate?: string | null
  lineItems?: PublicPaymentLineItem[] | null
  paidAt?: string | null
  businessName: string
  businessEmail?: string | null
  businessPhone?: string | null
}

export default function PublicPaymentPage() {
  const params = useParams<{ token: string }>()
  const searchParams = useSearchParams()
  const [payment, setPayment] = useState<PublicPaymentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const formattedAmount = useMemo(
    () => formatCurrency((payment?.amountCents || 0) / 100),
    [payment?.amountCents]
  )

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/payments/public/${params.token}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Payment link not found')
        setPayment(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load payment link')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [params.token, searchParams])

  // BUG-031 (round 2): defensive client-side reconciliation. After Stripe
  // redirects the customer back to ?checkout=success&session_id=..., poke
  // the verify endpoint so the merchant's quote/job updates immediately
  // even if the webhook is delayed or misconfigured. Re-fetches the
  // payment after a successful reconcile so this page also flips to the
  // "Paid" confirmation state.
  useEffect(() => {
    const checkout = searchParams.get('checkout')
    const sessionId = searchParams.get('session_id')
    if (checkout !== 'success' || !sessionId) return
    let cancelled = false
    setVerifying(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/payments/public/${params.token}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.ok && (data.status === 'paid' || data.alreadyReconciled)) {
          try {
            const refresh = await fetch(`/api/payments/public/${params.token}`)
            const refreshed = await refresh.json()
            if (!cancelled && refresh.ok) setPayment(refreshed)
          } catch {
            /* non-fatal — webhook will still flip the state on next reload */
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Payment verification failed (non-fatal):', err)
        }
      } finally {
        if (!cancelled) setVerifying(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [params.token, searchParams])

  const startCheckout = async () => {
    setCheckoutLoading(true)
    try {
      const res = await fetch(`/api/payments/public/${params.token}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerEmail: payment?.customerEmail || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not start checkout')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout')
      setCheckoutLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-page)]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading payment link...</p>
        </div>
      </div>
    )
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-page)] px-4">
        <div className="max-w-md w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-8 text-center">
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Payment unavailable</h1>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">{error || 'This payment link could not be found.'}</p>
        </div>
      </div>
    )
  }

  const alreadyPaid = payment.status === 'paid'
  const isInvoice = payment.kind === 'invoice' || (Array.isArray(payment.lineItems) && payment.lineItems.length > 0)
  const lineItems = Array.isArray(payment.lineItems) ? payment.lineItems : []
  const subtotalCents = payment.subtotalCents ?? (isInvoice
    ? lineItems.reduce((sum, item) => sum + (item.quantity * item.unitAmountCents), 0)
    : payment.amountCents)
  const taxCents = payment.taxCents ?? 0
  const dueDateLabel = payment.dueDate
    ? new Date(payment.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="min-h-screen bg-[var(--color-bg-page)] py-10 px-4">
      <div className={`mx-auto ${isInvoice ? 'max-w-2xl' : 'max-w-lg'}`}>
        <div className="text-center mb-6">
          <Image src="/dyia-logo-full.png" alt="dyia" width={120} height={32} className="h-7 w-auto mx-auto mb-3 opacity-80" />
          <p className="text-xs text-[var(--color-text-muted)]">Secure checkout powered by Stripe</p>
        </div>

        {isInvoice ? (
          // ── INVOICE LAYOUT ────────────────────────────────────────────
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl shadow-sm overflow-hidden">
            {/* Invoice header */}
            <div className="px-6 sm:px-8 py-6 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold tracking-[0.18em] text-orange-600 dark:text-orange-400 uppercase">
                  Invoice
                </p>
                <h1 className="mt-1 text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                  {payment.businessName}
                </h1>
                <div className="mt-1 text-xs text-[var(--color-text-muted)] space-y-0.5">
                  {payment.businessEmail && <p>{payment.businessEmail}</p>}
                  {payment.businessPhone && <p>{payment.businessPhone}</p>}
                </div>
              </div>
              <div className="sm:text-right">
                {payment.invoiceNumber && (
                  <p className="text-sm font-mono text-[var(--color-text-secondary)]">
                    #{payment.invoiceNumber}
                  </p>
                )}
                {dueDateLabel && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    Due {dueDateLabel}
                  </p>
                )}
                <span className={`mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full ${
                  alreadyPaid
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${alreadyPaid ? 'bg-green-500' : 'bg-amber-500'}`} />
                  {alreadyPaid ? 'Paid' : 'Awaiting payment'}
                </span>
              </div>
            </div>

            {/* Bill to */}
            {(payment.customerName || payment.customerEmail || payment.customerAddress) && (
              <div className="px-6 sm:px-8 py-4 bg-[var(--color-bg-subtle)]/40 border-b border-[var(--color-border)]">
                <p className="text-[10px] font-bold tracking-[0.15em] text-[var(--color-text-faint)] uppercase mb-1.5">
                  Bill to
                </p>
                {payment.customerName && (
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{payment.customerName}</p>
                )}
                {payment.customerEmail && (
                  <p className="text-xs text-[var(--color-text-muted)]">{payment.customerEmail}</p>
                )}
                {payment.customerPhone && (
                  <p className="text-xs text-[var(--color-text-muted)]">{payment.customerPhone}</p>
                )}
                {payment.customerAddress && (
                  <p className="text-xs text-[var(--color-text-muted)] whitespace-pre-line">{payment.customerAddress}</p>
                )}
              </div>
            )}

            {/* Line items */}
            <div className="px-6 sm:px-8 py-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-bold tracking-[0.15em] text-[var(--color-text-faint)] uppercase">
                    <th className="text-left pb-2">Description</th>
                    <th className="text-right pb-2 w-12">Qty</th>
                    <th className="text-right pb-2 w-20 sm:w-24">Rate</th>
                    <th className="text-right pb-2 w-20 sm:w-24">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {lineItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 text-[var(--color-text-primary)] pr-2">{item.description}</td>
                      <td className="py-2.5 text-right text-[var(--color-text-secondary)] tabular-nums">{item.quantity}</td>
                      <td className="py-2.5 text-right text-[var(--color-text-secondary)] tabular-nums">
                        {formatCurrency(item.unitAmountCents / 100)}
                      </td>
                      <td className="py-2.5 text-right text-[var(--color-text-primary)] font-medium tabular-nums">
                        {formatCurrency((item.quantity * item.unitAmountCents) / 100)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 pt-4 border-t-2 border-[var(--color-border)] flex justify-end">
                <div className="w-full sm:w-64 space-y-1.5 text-sm">
                  <div className="flex justify-between text-[var(--color-text-muted)]">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatCurrency(subtotalCents / 100)}</span>
                  </div>
                  {taxCents > 0 && (
                    <div className="flex justify-between text-[var(--color-text-muted)]">
                      <span>Tax</span>
                      <span className="tabular-nums">{formatCurrency(taxCents / 100)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-[var(--color-border)] font-bold text-[var(--color-text-primary)] text-base">
                    <span>Total due</span>
                    <span className="tabular-nums">{formattedAmount}</span>
                  </div>
                </div>
              </div>

              {payment.description && (
                <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
                  <p className="text-[10px] font-bold tracking-[0.15em] text-[var(--color-text-faint)] uppercase mb-1.5">
                    Notes
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] whitespace-pre-line">{payment.description}</p>
                </div>
              )}
            </div>

            {/* Pay action */}
            <div className="px-6 sm:px-8 py-5 bg-[var(--color-bg-subtle)]/30 border-t border-[var(--color-border)]">
              {alreadyPaid ? (
                <div className="rounded-xl border border-green-200 dark:border-green-800/40 bg-green-50 dark:bg-green-950/20 p-4 text-center">
                  <p className="text-sm font-semibold text-green-700 dark:text-green-300">Payment received. Thank you!</p>
                  {payment.paidAt && (
                    <p className="mt-1 text-xs text-green-700/80 dark:text-green-300/80">
                      Paid on {new Date(payment.paidAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : verifying ? (
                <div className="rounded-xl border border-orange-200 dark:border-orange-800/40 bg-orange-50 dark:bg-orange-950/20 p-4 text-center">
                  <div className="inline-flex items-center gap-2 text-sm font-medium text-orange-700 dark:text-orange-300">
                    <span className="w-4 h-4 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
                    Confirming your payment...
                  </div>
                </div>
              ) : (
                <button
                  onClick={startCheckout}
                  disabled={checkoutLoading}
                  className="app-btn-primary w-full text-sm py-3"
                >
                  {checkoutLoading ? 'Redirecting to Stripe…' : `Pay ${formattedAmount}`}
                </button>
              )}
              {error && (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
              )}
            </div>
          </div>
        ) : (
          // ── PAY-LINK LAYOUT (single amount) ───────────────────────────
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="text-center">
              <p className="text-sm text-[var(--color-text-muted)]">Paying</p>
              <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">{payment.businessName}</h1>
              <p className="mt-4 text-4xl font-bold text-orange-600 dark:text-orange-400">{formattedAmount}</p>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">{payment.description || 'Payment request'}</p>
            </div>

            {(payment.customerName || payment.businessEmail || payment.businessPhone) && (
              <div className="mt-6 rounded-xl bg-[var(--color-bg-subtle)] p-4 space-y-2">
                {payment.customerName && (
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-[var(--color-text-muted)]">Customer</span>
                    <span className="font-medium text-[var(--color-text-primary)] text-right">{payment.customerName}</span>
                  </div>
                )}
                {payment.businessEmail && (
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-[var(--color-text-muted)]">Business email</span>
                    <span className="font-medium text-[var(--color-text-primary)] text-right">{payment.businessEmail}</span>
                  </div>
                )}
                {payment.businessPhone && (
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-[var(--color-text-muted)]">Business phone</span>
                    <span className="font-medium text-[var(--color-text-primary)] text-right">{payment.businessPhone}</span>
                  </div>
                )}
              </div>
            )}

            {alreadyPaid ? (
              <div className="mt-6 rounded-xl border border-green-200 dark:border-green-800/40 bg-green-50 dark:bg-green-950/20 p-4 text-center">
                <p className="text-sm font-medium text-green-700 dark:text-green-300">This payment has been received. Thank you!</p>
                {payment.paidAt && (
                  <p className="mt-1 text-xs text-green-700/80 dark:text-green-300/80">
                    Paid on {new Date(payment.paidAt).toLocaleString()}
                  </p>
                )}
              </div>
            ) : verifying ? (
              <div className="mt-6 rounded-xl border border-orange-200 dark:border-orange-800/40 bg-orange-50 dark:bg-orange-950/20 p-4 text-center">
                <div className="inline-flex items-center gap-2 text-sm font-medium text-orange-700 dark:text-orange-300">
                  <span className="w-4 h-4 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
                  Confirming your payment...
                </div>
              </div>
            ) : (
              <button
                onClick={startCheckout}
                disabled={checkoutLoading}
                className="app-btn-primary w-full mt-6 text-sm py-3"
              >
                {checkoutLoading ? 'Redirecting to Stripe...' : `Pay ${formattedAmount}`}
              </button>
            )}

            {error && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
