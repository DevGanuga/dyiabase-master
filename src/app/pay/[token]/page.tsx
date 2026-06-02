'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { formatCents } from '@/lib/payments'
import { getDemoPublicPayment, isDemoToken } from '@/lib/demo-payments'

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
  tipCents?: number | null
  allowTip?: boolean | null
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
  businessAddress?: string | null
  businessLogo?: string | null
}

type TipPreset = 'none' | '15' | '18' | '20' | 'custom'

export default function PublicPaymentPage() {
  const params = useParams<{ token: string }>()
  const searchParams = useSearchParams()
  const [payment, setPayment] = useState<PublicPaymentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [tipPreset, setTipPreset] = useState<TipPreset>('none')
  const [customTip, setCustomTip] = useState('')
  const [isDemo, setIsDemo] = useState(false)
  const [demoMsg, setDemoMsg] = useState<string | null>(null)

  const baseCents = payment?.amountCents || 0

  const tipCents = useMemo(() => {
    if (!payment?.allowTip) return 0
    if (tipPreset === 'none') return 0
    if (tipPreset === 'custom') {
      const dollars = Number(customTip)
      if (!Number.isFinite(dollars) || dollars <= 0) return 0
      return Math.round(dollars * 100)
    }
    const pct = Number(tipPreset)
    return Math.round(baseCents * (pct / 100))
  }, [payment?.allowTip, tipPreset, customTip, baseCents])

  const totalCents = baseCents + tipCents
  const formattedAmount = useMemo(() => formatCents(baseCents), [baseCents])
  const formattedTotal = useMemo(() => formatCents(totalCents), [totalCents])

  useEffect(() => {
    // Demo tokens (prefix `demo-`) resolve from local fixtures, never the API.
    // Real tokens are 32-char base64url and can't collide with this prefix.
    if (isDemoToken(params.token)) {
      const demo = getDemoPublicPayment(params.token)
      if (demo) {
        setPayment(demo)
        setIsDemo(true)
      } else {
        setError('This demo payment link is no longer available. Create a new one from the Payments tab.')
      }
      setLoading(false)
      return
    }

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

  // BUG-031: defensive client-side reconciliation after Stripe redirects back.
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
        if (!cancelled) console.warn('Payment verification failed (non-fatal):', err)
      } finally {
        if (!cancelled) setVerifying(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [params.token, searchParams])

  const startCheckout = async () => {
    if (isDemo) {
      setDemoMsg(
        tipCents > 0
          ? `Demo preview — no real charge. In production this opens secure Stripe Checkout for ${formattedTotal} (incl. ${formatCents(tipCents)} tip).`
          : 'Demo preview — no real charge. In production this opens secure Stripe Checkout.'
      )
      return
    }
    setCheckoutLoading(true)
    try {
      const res = await fetch(`/api/payments/public/${params.token}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: payment?.customerEmail || undefined,
          tipCents: tipCents > 0 ? tipCents : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not start checkout')
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout')
      setCheckoutLoading(false)
    }
  }

  // ── Loading / error shells ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-page)]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
        </div>
      </div>
    )
  }

  if (error || !payment) {
    return (
      <PayShell isDemo={false} demoMsg={null}>
        <div className="px-6 py-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-500 flex items-center justify-center mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 9v3.75m0 3.75h.008M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Payment unavailable</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{error || 'This payment link could not be found.'}</p>
        </div>
      </PayShell>
    )
  }

  const alreadyPaid = payment.status === 'paid'
  const wasCancelled = searchParams.get('checkout') === 'cancelled'
  const isInvoice = payment.kind === 'invoice' || (Array.isArray(payment.lineItems) && payment.lineItems.length > 0)
  const lineItems = Array.isArray(payment.lineItems) ? payment.lineItems : []
  const subtotalCents = payment.subtotalCents ?? (isInvoice
    ? lineItems.reduce((sum, item) => sum + item.quantity * item.unitAmountCents, 0)
    : payment.amountCents)
  const taxCents = payment.taxCents ?? 0
  const dueDateLabel = payment.dueDate
    ? new Date(payment.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null
  const initials = payment.businessName.trim().slice(0, 1).toUpperCase()

  const payAction = alreadyPaid ? (
    <div className="rounded-2xl border border-green-200 dark:border-green-800/40 bg-green-50 dark:bg-green-950/20 p-4 text-center">
      <div className="mx-auto mb-1.5 w-9 h-9 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 flex items-center justify-center">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-green-700 dark:text-green-300">Payment received. Thank you!</p>
      {payment.paidAt && (
        <p className="mt-0.5 text-xs text-green-700/80 dark:text-green-300/80">
          Paid {new Date(payment.paidAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      )}
    </div>
  ) : verifying ? (
    <div className="rounded-2xl border border-orange-200 dark:border-orange-800/40 bg-orange-50 dark:bg-orange-950/20 p-4 text-center">
      <div className="inline-flex items-center gap-2 text-sm font-medium text-orange-700 dark:text-orange-300">
        <span className="w-4 h-4 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
        Confirming your payment…
      </div>
    </div>
  ) : (
    <>
      {wasCancelled && (
        <p className="mb-3 text-xs text-[var(--color-text-muted)] text-center">
          Checkout was cancelled — you have not been charged.
        </p>
      )}
      {payment.allowTip && (
        <TipSelector
          baseCents={baseCents}
          tipCents={tipCents}
          preset={tipPreset}
          customTip={customTip}
          onPreset={setTipPreset}
          onCustomTip={setCustomTip}
        />
      )}
      {/* Desktop / inline pay button (mobile uses the sticky bar below) */}
      <div className="hidden sm:block">
        <button onClick={startCheckout} disabled={checkoutLoading} className="ios-pay-btn">
          {checkoutLoading ? 'Redirecting…' : `Pay ${formattedTotal}`}
          {!checkoutLoading && (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 12h14m-7-7l7 7-7 7" />
            </svg>
          )}
        </button>
      </div>
    </>
  )

  return (
    <PayShell isDemo={isDemo} demoMsg={demoMsg}>
      <div className={isInvoice ? '' : 'pb-1'}>
        {/* Business identity header */}
        <div className="px-6 pt-6 pb-4 flex items-center gap-3.5">
          {payment.businessLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={payment.businessLogo} alt={payment.businessName} className="w-12 h-12 rounded-2xl object-cover shadow-sm" />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center text-lg font-bold shadow-sm">
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
              {isInvoice ? (payment.invoiceNumber ? `Invoice · ${payment.invoiceNumber}` : 'Invoice') : 'Payment request'}
            </p>
            <h1 className="text-lg font-bold text-[var(--color-text-primary)] truncate tracking-tight">{payment.businessName}</h1>
          </div>
          <StatusChip paid={alreadyPaid} />
        </div>

        {/* Amount spotlight */}
        <div className="px-6 pb-5 text-center border-b border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-muted)]">{alreadyPaid ? 'Amount paid' : 'Amount due'}</p>
          <p className="mt-1 text-[40px] leading-none font-bold tracking-tight text-[var(--color-text-primary)]">
            {formattedAmount}
          </p>
          {dueDateLabel && !alreadyPaid && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Due {dueDateLabel}
            </p>
          )}
          {!isInvoice && payment.description && (
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{payment.description}</p>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Bill to (invoice) */}
          {isInvoice && (payment.customerName || payment.customerEmail || payment.customerAddress) && (
            <InsetGroup label="Billed to">
              {payment.customerName && <p className="text-sm font-semibold text-[var(--color-text-primary)]">{payment.customerName}</p>}
              {payment.customerEmail && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{payment.customerEmail}</p>}
              {payment.customerPhone && <p className="text-xs text-[var(--color-text-muted)]">{payment.customerPhone}</p>}
              {payment.customerAddress && <p className="text-xs text-[var(--color-text-muted)] mt-0.5 whitespace-pre-line">{payment.customerAddress}</p>}
            </InsetGroup>
          )}

          {/* Line items (invoice) */}
          {isInvoice && lineItems.length > 0 && (
            <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden">
              <ul className="divide-y divide-[var(--color-border)]">
                {lineItems.map((item, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--color-text-primary)]">{item.description}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5 tabular-nums">
                        {item.quantity} × {formatCents(item.unitAmountCents)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] tabular-nums shrink-0">
                      {formatCents(item.quantity * item.unitAmountCents)}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="px-4 py-3 bg-[var(--color-bg-subtle)]/50 space-y-1.5">
                <Line label="Subtotal" value={formatCents(subtotalCents)} />
                {taxCents > 0 && <Line label="Tax" value={formatCents(taxCents)} />}
                {tipCents > 0 && <Line label="Tip" value={formatCents(tipCents)} accent />}
                <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">Total</span>
                  <span className="text-base font-bold text-[var(--color-text-primary)] tabular-nums">{formattedTotal}</span>
                </div>
              </div>
            </div>
          )}

          {/* Notes (invoice) */}
          {isInvoice && payment.description && (
            <InsetGroup label="Note">
              <p className="text-xs text-[var(--color-text-muted)] whitespace-pre-line">{payment.description}</p>
            </InsetGroup>
          )}

          {payAction}

          {error && <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>}
        </div>
      </div>

      {/* Sticky mobile pay bar (iOS-style) */}
      {!alreadyPaid && !verifying && (
        <div className="sm:hidden fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-border)] bg-[var(--color-bg-card)]/95 backdrop-blur px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <button onClick={startCheckout} disabled={checkoutLoading} className="ios-pay-btn">
            {checkoutLoading ? 'Redirecting…' : `Pay ${formattedTotal}`}
            {!checkoutLoading && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 12h14m-7-7l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
      )}
    </PayShell>
  )
}

// ── Premium shell: navy hero + white dyia logo, iOS card-over-hero ─────────
function PayShell({ children, isDemo, demoMsg }: { children: React.ReactNode; isDemo: boolean; demoMsg: string | null }) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-page)]">
      <div className="relative">
        {/* Branded hero band */}
        <div
          className="h-44 sm:h-48 w-full"
          style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #312e81 100%)' }}
        >
          <div className="max-w-xl mx-auto px-6 pt-8 flex flex-col items-center">
            {/* White dyia logo — inverted full logo for strong contrast on navy */}
            <Image
              src="/dyia-logo-full.png"
              alt="dyia"
              width={108}
              height={29}
              className="h-7 w-auto brightness-0 invert"
              priority
            />
            <p className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-white/70">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Secure checkout · powered by Stripe
            </p>
          </div>
        </div>

        {/* Card overlapping the hero */}
        <div className="max-w-xl mx-auto px-4 -mt-24 pb-28 sm:pb-12">
          {isDemo && (
            <div className="mb-3 rounded-2xl border border-white/15 bg-white/10 backdrop-blur px-4 py-2.5 text-center">
              <p className="text-xs font-semibold text-white">
                Demo preview — exactly what your customer sees. No real charge is made.
              </p>
              {demoMsg && <p className="mt-1 text-[11px] text-white/80">{demoMsg}</p>}
            </div>
          )}
          <div className="bg-[var(--color-bg-card)] rounded-3xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.35)] border border-[var(--color-border)] overflow-hidden">
            {children}
          </div>
          <p className="mt-4 text-center text-[11px] text-[var(--color-text-faint)]">
            Payments are processed securely by Stripe. dyia never stores your card details.
          </p>
        </div>
      </div>
    </div>
  )
}

function StatusChip({ paid }: { paid: boolean }) {
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
        paid
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${paid ? 'bg-green-500' : 'bg-amber-500'}`} />
      {paid ? 'Paid' : 'Due'}
    </span>
  )
}

function InsetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)] mb-1.5 px-1">{label}</p>
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)]/40 px-4 py-3">{children}</div>
    </div>
  )
}

function Line({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={accent ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--color-text-muted)]'}>{label}</span>
      <span className={`tabular-nums ${accent ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-[var(--color-text-secondary)]'}`}>{value}</span>
    </div>
  )
}

function TipSelector({
  baseCents,
  tipCents,
  preset,
  customTip,
  onPreset,
  onCustomTip,
}: {
  baseCents: number
  tipCents: number
  preset: TipPreset
  customTip: string
  onPreset: (p: TipPreset) => void
  onCustomTip: (v: string) => void
}) {
  const options: { id: TipPreset; label: string }[] = [
    { id: 'none', label: 'None' },
    { id: '15', label: '15%' },
    { id: '18', label: '18%' },
    { id: '20', label: '20%' },
    { id: 'custom', label: 'Other' },
  ]
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)]/40 p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Add a tip</p>
        {tipCents > 0 && (
          <p className="text-xs text-[var(--color-text-muted)]">
            <span className="font-semibold text-[var(--color-text-primary)]">{formatCents(tipCents)}</span>
          </p>
        )}
      </div>
      {/* iOS segmented control */}
      <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-[var(--color-bg-subtle)]">
        {options.map((opt) => {
          const active = preset === opt.id
          const pctCents = opt.id === '15' || opt.id === '18' || opt.id === '20'
            ? Math.round(baseCents * (Number(opt.id) / 100))
            : 0
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onPreset(opt.id)}
              className={`flex flex-col items-center justify-center rounded-lg px-1 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                active
                  ? 'bg-[var(--color-bg-card)] text-orange-600 dark:text-orange-400 shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <span>{opt.label}</span>
              {pctCents > 0 && <span className="text-[9px] font-normal opacity-70">{formatCents(pctCents)}</span>}
            </button>
          )
        })}
      </div>
      {preset === 'custom' && (
        <div className="relative mt-2">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">$</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={customTip}
            onChange={(e) => onCustomTip(e.target.value)}
            className="app-input pl-7"
            autoFocus
          />
        </div>
      )}
    </div>
  )
}
