'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { formatCents } from '@/lib/payments'
import type { AppPaymentRecord, AppSettings, UserProfile } from '@/types/database'
import { createDemoPaymentRecord, getDemoFeed } from '@/lib/demo-payments'
import { PaymentLinkReadyModal } from './PaymentLinkReadyModal'
import { CreatePaymentRequestModal, type PaymentPrefill } from './CreatePaymentRequestModal'

interface PaymentsProps {
  userProfile: UserProfile | null
  settings: AppSettings
  showSuccess: (message: string) => void
  showError?: (message: string) => void
  onOpenSettings?: () => void
  onNavigateQuotes?: () => void
  /** Demo mode: show a live-looking, fully clickable payments hub with sample data. */
  isDemoMode?: boolean
}

interface ConnectStatus {
  connected: boolean
  accountId: string | null
  onboardingComplete: boolean
  detailsSubmitted: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
}

const STATUS_STYLES: Record<string, { label: string; cls: string; dot: string }> = {
  pending: {
    label: 'Awaiting payment',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  checkout_created: {
    label: 'Customer started checkout',
    cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  paid: {
    label: 'Paid',
    cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    dot: 'bg-green-500',
  },
  failed: {
    label: 'Failed',
    cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    dot: 'bg-red-500',
  },
  expired: {
    label: 'Expired',
    cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
  refunded: {
    label: 'Refunded',
    cls: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    dot: 'bg-purple-500',
  },
  partial_refund: {
    label: 'Partial refund',
    cls: 'bg-purple-100/70 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
    dot: 'bg-purple-400',
  },
}

const KIND_BADGES: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  payment_link: {
    label: 'Pay link',
    cls: 'text-orange-700 dark:text-orange-400',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
  },
  invoice: {
    label: 'Invoice',
    cls: 'text-sky-700 dark:text-sky-400',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  quote_payment: {
    label: 'From quote',
    cls: 'text-emerald-700 dark:text-emerald-400',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h4M7 21h10a2 2 0 002-2V7l-5-5H7a2 2 0 00-2 2v15a2 2 0 002 2z" />
      </svg>
    ),
  },
  job_payment: {
    label: 'From job',
    cls: 'text-indigo-700 dark:text-indigo-400',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
}

type ActivityFilter = 'all' | 'awaiting' | 'overdue' | 'paid'

const OPEN_STATUSES = new Set(['pending', 'checkout_created'])

function isOverdue(p: AppPaymentRecord): boolean {
  if (!OPEN_STATUSES.has(p.status) || !p.dueDate) return false
  const due = new Date(`${p.dueDate}T23:59:59`)
  return Number.isFinite(due.getTime()) && due.getTime() < Date.now()
}

/** Mutually-exclusive management category for an invoice/payment. */
function categoryOf(p: AppPaymentRecord): ActivityFilter {
  if (p.status === 'paid') return 'paid'
  if (isOverdue(p)) return 'overdue'
  if (OPEN_STATUSES.has(p.status)) return 'awaiting'
  return 'all'
}

export function Payments({ userProfile, settings, showSuccess, showError, onOpenSettings, onNavigateQuotes, isDemoMode = false }: PaymentsProps) {
  const [loadingStatus, setLoadingStatus] = useState(!isDemoMode)
  const [status, setStatus] = useState<ConnectStatus>(
    isDemoMode
      ? {
          connected: true,
          accountId: 'acct_demo_1Hill',
          onboardingComplete: true,
          detailsSubmitted: true,
          chargesEnabled: true,
          payoutsEnabled: true,
        }
      : {
          connected: Boolean(userProfile?.stripe_connect_account_id),
          accountId: userProfile?.stripe_connect_account_id || null,
          onboardingComplete: Boolean(userProfile?.stripe_connect_onboarding_complete),
          detailsSubmitted: Boolean(userProfile?.stripe_connect_details_submitted),
          chargesEnabled: Boolean(userProfile?.stripe_connect_charges_enabled),
          payoutsEnabled: Boolean(userProfile?.stripe_connect_payouts_enabled),
        }
  )
  const [payments, setPayments] = useState<AppPaymentRecord[]>([])
  const [actionLoading, setActionLoading] = useState<'onboarding' | 'dashboard' | 'refresh' | null>(null)
  const [paymentLinkModal, setPaymentLinkModal] = useState<{ url: string; customerName?: string; kind?: string } | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createTab, setCreateTab] = useState<'link' | 'invoice'>('link')
  const [createPrefill, setCreatePrefill] = useState<PaymentPrefill | null>(null)
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const openCreate = useCallback((tab: 'link' | 'invoice' = 'link', prefill: PaymentPrefill | null = null) => {
    setCreateTab(tab)
    setCreatePrefill(prefill)
    setCreateOpen(true)
  }, [])

  // Close the per-row actions menu on outside click / escape.
  useEffect(() => {
    if (!openMenuId) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenMenuId(null)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [openMenuId])

  const businessReady = Boolean(
    settings.businessInfo.name?.trim() &&
    settings.businessInfo.email?.trim() &&
    settings.businessInfo.phone?.trim()
  )

  const refreshStatus = useCallback(async () => {
    if (isDemoMode) {
      setLoadingStatus(false)
      return
    }
    setActionLoading('refresh')
    try {
      const res = await fetch('/api/stripe/connect/status')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load Stripe status')
      setStatus({
        connected: data.connected,
        accountId: data.accountId,
        onboardingComplete: Boolean(data.onboardingComplete),
        detailsSubmitted: Boolean(data.detailsSubmitted),
        chargesEnabled: Boolean(data.chargesEnabled),
        payoutsEnabled: Boolean(data.payoutsEnabled),
      })
    } catch (error) {
      console.error('Payments status error:', error)
      showError?.('Could not refresh your Stripe status. Check your connection and try again.')
    } finally {
      setLoadingStatus(false)
      setActionLoading(null)
    }
  }, [showError, isDemoMode])

  const loadPayments = useCallback(async () => {
    // Demo mode: no Clerk session, so the real feed 401s. Serve curated sample
    // payments (plus anything created during the demo) so the whole hub is live.
    if (isDemoMode) {
      setPayments(getDemoFeed())
      return
    }
    // Load through the server (service-role) so the feed + stat cards always
    // populate. Reading `dyia_payments` with the browser client is subject to
    // an RLS policy that compares the Clerk subject to a dyia_users UUID and
    // never matches, which left the activity feed empty even when payments
    // existed.
    try {
      const res = await fetch('/api/payments/list')
      if (!res.ok) {
        if (res.status !== 401) console.error('Load payments failed:', res.status)
        return
      }
      const data = await res.json()
      setPayments(Array.isArray(data.payments) ? data.payments : [])
    } catch (error) {
      console.error('Load payments error:', error)
    }
  }, [isDemoMode])

  useEffect(() => {
    refreshStatus()
    loadPayments()
  }, [refreshStatus, loadPayments])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connectParam = params.get('connect')
    // Stripe sends `return` when the merchant finishes (or exits) onboarding and
    // `refresh` when the account link expires and needs to be regenerated. Both
    // should re-pull the authoritative Connect status.
    if (connectParam === 'return') {
      showSuccess('Stripe setup updated.')
      refreshStatus()
      loadPayments()
    } else if (connectParam === 'refresh') {
      refreshStatus()
    }
  }, [loadPayments, refreshStatus, showSuccess])

  // Keep the activity feed live. When the merchant returns to this tab after a
  // customer paid in another window/device (or the webhook just landed), the
  // feed was stale until a full navigation away and back. Reconcile any stuck
  // rows against Stripe, then refetch the feed + Connect status. Throttled so
  // rapid focus/visibility toggles don't hammer the API.
  useEffect(() => {
    if (isDemoMode) return
    let lastRefreshAt = 0
    const MIN_REFETCH_INTERVAL_MS = 5_000
    const onMaybeRefresh = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastRefreshAt < MIN_REFETCH_INTERVAL_MS) return
      lastRefreshAt = now
      void (async () => {
        try {
          await fetch('/api/payments/sync-pending', { method: 'POST' })
        } catch {
          // best-effort; the refetch below still surfaces webhook updates
        }
        await loadPayments()
      })()
    }
    document.addEventListener('visibilitychange', onMaybeRefresh)
    window.addEventListener('focus', onMaybeRefresh)
    return () => {
      document.removeEventListener('visibilitychange', onMaybeRefresh)
      window.removeEventListener('focus', onMaybeRefresh)
    }
  }, [isDemoMode, loadPayments])

  const startOnboarding = async () => {
    if (isDemoMode) {
      showSuccess('Demo mode: Stripe is already connected. Try creating a pay link or invoice.')
      return
    }
    setActionLoading('onboarding')
    try {
      const res = await fetch('/api/stripe/connect/onboarding', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not start Stripe setup')
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('Stripe did not return a setup link. Please try again.')
      }
    } catch (error) {
      console.error('Connect onboarding error:', error)
      showError?.(error instanceof Error ? error.message : 'Could not start Stripe setup. Please try again.')
      setActionLoading(null)
    }
  }

  const openDashboard = async () => {
    if (isDemoMode) {
      showSuccess('Demo mode: this opens your live Stripe payouts dashboard once connected.')
      return
    }
    setActionLoading('dashboard')
    try {
      const res = await fetch('/api/stripe/connect/dashboard', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not open Stripe dashboard')
      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer')
      } else {
        throw new Error('Stripe did not return a dashboard link. Please try again.')
      }
    } catch (error) {
      console.error('Connect dashboard error:', error)
      showError?.(error instanceof Error ? error.message : 'Could not open your Stripe dashboard. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  // ── Derived stats for the hero ────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    let pendingCents = 0
    let pendingCount = 0
    let paidThisMonthCents = 0
    let netThisMonthCents = 0
    let feesThisMonthCents = 0
    let paidThisMonthCount = 0
    let lifetimePaidCents = 0

    for (const p of payments) {
      const created = new Date(p.createdAt)
      // Tips flow 100% to the merchant, so they count toward collected + net
      // but never toward Dyia fees (which are charged on the base only).
      const tip = p.tipCents || 0
      if (p.status === 'pending' || p.status === 'checkout_created') {
        pendingCents += p.amountCents
        pendingCount += 1
      }
      if (p.status === 'paid') {
        lifetimePaidCents += p.amountCents + tip
        if (created >= monthStart) {
          paidThisMonthCents += p.amountCents + tip
          netThisMonthCents += p.destinationAmountCents + tip
          feesThisMonthCents += p.applicationFeeAmountCents
          paidThisMonthCount += 1
        }
      }
    }

    return { pendingCents, pendingCount, paidThisMonthCents, netThisMonthCents, feesThisMonthCents, paidThisMonthCount, lifetimePaidCents }
  }, [payments])

  // Categorized management: counts per bucket (Overdue is open + past due).
  const categoryCounts = useMemo(() => {
    const counts = { all: payments.length, awaiting: 0, overdue: 0, paid: 0 }
    for (const p of payments) {
      const c = categoryOf(p)
      if (c === 'awaiting') counts.awaiting += 1
      else if (c === 'overdue') counts.overdue += 1
      else if (c === 'paid') counts.paid += 1
    }
    return counts
  }, [payments])

  const filteredPayments = useMemo(() => {
    if (filter === 'all') return payments
    return payments.filter((p) => categoryOf(p) === filter)
  }, [payments, filter])

  // Duplicate an existing request into the create modal (prefilled).
  const duplicatePayment = useCallback((p: AppPaymentRecord) => {
    setOpenMenuId(null)
    const isInvoice = p.kind === 'invoice' || (Array.isArray(p.lineItems) && p.lineItems.length > 0)
    openCreate(isInvoice ? 'invoice' : 'link', {
      kind: isInvoice ? 'invoice' : 'payment_link',
      amountCents: p.amountCents,
      description: p.description || undefined,
      customerName: p.customerName || undefined,
      customerEmail: p.customerEmail || undefined,
      customerPhone: p.customerPhone || undefined,
      customerAddress: p.customerAddress || undefined,
      taxPercentage:
        p.subtotalCents && p.subtotalCents > 0 && p.taxCents
          ? Math.round((p.taxCents / p.subtotalCents) * 10000) / 100
          : 0,
      lineItems: Array.isArray(p.lineItems) ? p.lineItems : undefined,
    })
  }, [openCreate])

  // Demo-only: flip a sample payment to paid to demonstrate the lifecycle.
  const markPaidDemo = useCallback((id: string) => {
    setOpenMenuId(null)
    setPayments((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'paid', paidAt: new Date().toISOString() } : p))
    )
    showSuccess('Marked as paid (demo).')
  }, [showSuccess])

  const canAcceptPayments = status.chargesEnabled
  const showConnectBanner = !status.connected || !status.chargesEnabled
  const monthLabel = new Date().toLocaleString('en-US', { month: 'long' })

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Get paid</h1>
          <p className="page-subtitle">
            Send invoices and payment links. Funds settle to your Stripe balance, then auto-payout to your bank.
          </p>
        </div>
        <div className="flex gap-2">
          {status.connected && (
            <button
              onClick={openDashboard}
              disabled={actionLoading !== null}
              className="app-btn-secondary text-sm"
            >
              {actionLoading === 'dashboard' ? 'Opening…' : 'Stripe dashboard'}
            </button>
          )}
          <button
            onClick={() => openCreate('link')}
            disabled={!businessReady}
            className="app-btn-primary text-sm"
            title={!businessReady ? 'Add business info in Settings first' : 'Create a new payment request'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Get paid
          </button>
        </div>
      </div>

      {/* ── Connect setup banner (collapses when complete) ─────────────── */}
      {showConnectBanner && (
        <div className="app-card border-orange-200 dark:border-orange-900/40 bg-gradient-to-br from-orange-50/80 to-amber-50/40 dark:from-orange-950/20 dark:to-amber-950/10">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex gap-3 flex-1">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  {status.connected ? 'Finish Stripe verification to accept payments' : 'Connect Stripe to start accepting payments'}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-2xl">
                  Stripe Connect handles the legal/banking side so you can focus on the work. We move money directly from your customer
                  to your bank — Dyia never holds your funds. Dyia keeps a 0.75% platform fee on each successful payment.
                </p>

                {/* Inline step pills */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <StatusPill done={businessReady} label="Business info" />
                  <StatusPill done={status.connected} label="Stripe account" />
                  <StatusPill done={status.detailsSubmitted} label="ID verified" />
                  <StatusPill done={status.chargesEnabled} label="Charges enabled" />
                  <StatusPill done={status.payoutsEnabled} label="Payouts enabled" />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:items-end shrink-0">
              {!businessReady && onOpenSettings && (
                <button onClick={onOpenSettings} className="app-btn-secondary text-sm">
                  Add business info
                </button>
              )}
              <button
                onClick={startOnboarding}
                disabled={actionLoading !== null || !businessReady}
                className="app-btn-primary text-sm"
              >
                {actionLoading === 'onboarding'
                  ? 'Opening Stripe…'
                  : status.connected
                    ? 'Resume Stripe setup'
                    : 'Connect Stripe'}
              </button>
              {status.connected && (
                <button
                  onClick={refreshStatus}
                  disabled={actionLoading !== null}
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] underline-offset-2 hover:underline"
                >
                  {actionLoading === 'refresh' ? 'Refreshing…' : 'I finished — refresh status'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Hero stats (only meaningful once Stripe is live) ──────────── */}
      {canAcceptPayments && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label={`Paid in ${monthLabel}`}
            value={formatCurrency(stats.paidThisMonthCents / 100)}
            sub={`${stats.paidThisMonthCount} payment${stats.paidThisMonthCount === 1 ? '' : 's'}`}
            tone="green"
          />
          <StatCard
            label="Awaiting payment"
            value={formatCurrency(stats.pendingCents / 100)}
            sub={`${stats.pendingCount} open request${stats.pendingCount === 1 ? '' : 's'}`}
            tone="amber"
          />
          <StatCard
            label={`Net to your bank · ${monthLabel}`}
            value={formatCurrency(stats.netThisMonthCents / 100)}
            sub="After Dyia fee"
            tone="orange"
          />
          <StatCard
            label="Dyia fees collected"
            value={formatCurrency(stats.feesThisMonthCents / 100)}
            sub={`${monthLabel} so far`}
            tone="slate"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* ── Primary actions ───────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ActionCard
              title="Quick pay link"
              description="Send a one-tap pay link for a fixed amount."
              accent="orange"
              disabled={!businessReady}
              onClick={() => openCreate('link')}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
              }
            />
            <ActionCard
              title="Send invoice"
              description="Itemized invoice with tax, due date, and total."
              accent="sky"
              disabled={!businessReady}
              onClick={() => openCreate('invoice')}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            />
            <ActionCard
              title="From a quote or job"
              description="Request payment for an existing quote or job."
              accent="emerald"
              disabled={!businessReady}
              onClick={onNavigateQuotes}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              }
            />
          </div>

          {/* ── Activity ─────────────────────────────────────────────── */}
          <div className="app-card">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Payment activity</h3>
              <p className="text-sm text-[var(--color-text-muted)]">Manage every invoice and pay link in one place.</p>
              {/* Categorized management — counts per bucket, Overdue surfaced */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {([
                  { id: 'all', label: 'All', count: categoryCounts.all },
                  { id: 'awaiting', label: 'Awaiting', count: categoryCounts.awaiting },
                  { id: 'overdue', label: 'Overdue', count: categoryCounts.overdue },
                  { id: 'paid', label: 'Paid', count: categoryCounts.paid },
                ] as { id: ActivityFilter; label: string; count: number }[]).map((c) => {
                  const active = filter === c.id
                  const isOverdueCat = c.id === 'overdue' && c.count > 0
                  return (
                    <button
                      key={c.id}
                      onClick={() => setFilter(c.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                        active
                          ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-card)]'
                          : isOverdueCat
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 hover:opacity-80'
                            : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                      }`}
                    >
                      {c.label}
                      <span className={`min-w-[1.25rem] text-center px-1 rounded-full text-[10px] ${
                        active ? 'bg-[var(--color-bg-card)]/20' : 'bg-[var(--color-bg-card)]'
                      }`}>
                        {c.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {payments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--color-border)] p-10 text-center">
                <div className="mx-auto w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">No payments yet</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-sm mx-auto">
                  Create your first pay link or invoice and the activity feed will show every request, status, and payout.
                </p>
                <button
                  onClick={() => openCreate('link')}
                  disabled={!businessReady}
                  className="app-btn-primary text-sm mt-4"
                >
                  Create your first payment
                </button>
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center">
                <p className="text-sm text-[var(--color-text-muted)]">
                  Nothing here for &quot;{filter}&quot;.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {filteredPayments.map((payment) => {
                  const overdue = isOverdue(payment)
                  const meta = overdue
                    ? { label: 'Overdue', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', dot: 'bg-red-500' }
                    : STATUS_STYLES[payment.status] || STATUS_STYLES.pending
                  const kind = KIND_BADGES[payment.kind] || KIND_BADGES.payment_link
                  const url = typeof window !== 'undefined' ? `${window.location.origin}/pay/${payment.publicToken}` : `/pay/${payment.publicToken}`
                  return (
                    <li key={payment.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${kind.cls}`}>
                              {kind.icon}
                              {kind.label}
                            </span>
                            {payment.invoiceNumber && (
                              <span className="text-xs font-mono text-[var(--color-text-muted)]">
                                #{payment.invoiceNumber}
                              </span>
                            )}
                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                              {meta.label}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-[var(--color-text-primary)] mt-1 truncate">
                            {payment.customerName || payment.description || 'Payment request'}
                          </p>
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            Created {new Date(payment.createdAt).toLocaleString()}
                            {payment.paidAt && ` · Paid ${new Date(payment.paidAt).toLocaleDateString()}`}
                            {payment.dueDate && ` · Due ${new Date(payment.dueDate).toLocaleDateString()}`}
                          </p>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-3">
                          {(() => {
                            const tip = payment.tipCents || 0
                            const isPaid = payment.status === 'paid'
                            const total = payment.amountCents + (isPaid ? tip : 0)
                            const youGet = payment.destinationAmountCents + (isPaid ? tip : 0)
                            return (
                              <div className="text-right">
                                <p className="text-base font-bold text-[var(--color-text-primary)]">
                                  {formatCents(total)}
                                </p>
                                {isPaid && tip > 0 && (
                                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                                    incl. {formatCents(tip)} tip
                                  </p>
                                )}
                                <p className="text-[11px] text-[var(--color-text-muted)]">
                                  You get {formatCents(youGet)}
                                </p>
                              </div>
                            )
                          })()}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setPaymentLinkModal({ url, customerName: payment.customerName || undefined, kind: payment.kind })}
                              className="px-3 py-1.5 text-xs font-semibold rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors active:scale-95"
                              title="Share payment link"
                            >
                              Send
                            </button>
                            <div className="relative">
                              <button
                                onClick={() => setOpenMenuId(openMenuId === payment.id ? null : payment.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] transition-colors"
                                aria-label="More actions"
                                aria-haspopup="true"
                                aria-expanded={openMenuId === payment.id}
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M6 10a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM11.5 10a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM17 10a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                                </svg>
                              </button>
                              {openMenuId === payment.id && (
                                <div
                                  ref={menuRef}
                                  className="absolute right-0 top-9 z-20 w-48 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
                                >
                                  <MenuItem
                                    label="Copy link"
                                    onClick={() => { setOpenMenuId(null); setPaymentLinkModal({ url, customerName: payment.customerName || undefined, kind: payment.kind }) }}
                                    icon="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                                  />
                                  <a
                                    href={`/pay/${payment.publicToken}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={() => setOpenMenuId(null)}
                                    className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-subtle)] transition-colors"
                                  >
                                    <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    Open preview
                                  </a>
                                  <MenuItem
                                    label="Duplicate"
                                    onClick={() => duplicatePayment(payment)}
                                    icon="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                                  />
                                  {isDemoMode && payment.status !== 'paid' && (
                                    <MenuItem
                                      label="Mark as paid"
                                      onClick={() => markPaidDemo(payment.id)}
                                      icon="M5 13l4 4L19 7"
                                      tone="green"
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* ── Funds flow card ──────────────────────────────────────── */}
          <div className="app-card">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Where the money goes</h3>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Stripe Connect routes funds directly to your bank — Dyia never touches the money.
            </p>
            <div className="mt-4 space-y-3">
              <FundsRow
                step={1}
                title="Customer pays"
                detail="Card payment on your branded /pay link"
                sample="$500.00"
              />
              <FundsRow
                step={2}
                title="Dyia platform fee"
                detail="0.75% kept by Dyia (deducted at charge time)"
                sample="–$3.75"
                negative
              />
              <FundsRow
                step={3}
                title="Lands in your Stripe balance"
                detail="Minus Stripe's processing fee (~2.9% + $0.30)"
                sample="≈ $481.75"
                emphasis
              />
              <FundsRow
                step={4}
                title="Auto-payout to your bank"
                detail="Daily rolling payout, 2 business days (US default)"
                sample="→ Your bank"
                final
              />
            </div>
            {status.connected && (
              <button
                onClick={openDashboard}
                disabled={actionLoading !== null}
                className="mt-4 w-full app-btn-secondary text-sm"
              >
                View payouts in Stripe →
              </button>
            )}
          </div>

          {/* ── Status panel (compact, always visible) ───────────────── */}
          <div className="app-card">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Stripe status</h3>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                status.chargesEnabled
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              }`}>
                {loadingStatus ? 'Checking…' : status.chargesEnabled ? 'Live' : 'Setup needed'}
              </span>
            </div>
            <dl className="mt-3 text-sm space-y-2">
              <Row label="Account" value={status.accountId ? truncateAccountId(status.accountId) : 'Not created'} mono={!!status.accountId} />
              <Row label="Charges" value={status.chargesEnabled ? 'Enabled' : 'Pending'} ok={status.chargesEnabled} />
              <Row label="Payouts" value={status.payoutsEnabled ? 'Enabled' : 'Pending'} ok={status.payoutsEnabled} />
              <Row label="ID verified" value={status.detailsSubmitted ? 'Yes' : 'Pending'} ok={status.detailsSubmitted} />
            </dl>
            <div className="flex gap-2 mt-4">
              {status.connected ? (
                <button
                  onClick={openDashboard}
                  disabled={actionLoading !== null}
                  className="flex-1 app-btn-secondary text-xs py-2"
                >
                  Stripe dashboard
                </button>
              ) : (
                <button
                  onClick={startOnboarding}
                  disabled={actionLoading !== null || !businessReady}
                  className="flex-1 app-btn-primary text-xs py-2"
                >
                  Connect Stripe
                </button>
              )}
              <button
                onClick={refreshStatus}
                disabled={actionLoading !== null}
                className="px-3 app-btn-secondary text-xs py-2"
                title="Refresh status"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreatePaymentRequestModal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setCreatePrefill(null) }}
        canAcceptPayments={canAcceptPayments}
        initialTab={createTab}
        prefill={createPrefill}
        // Don't pull from settings.taxPercentage — that's the user's INCOME
        // tax estimate (used by the profit calculator), not sales tax. Two
        // very different things. Invoice sales tax defaults to 0 and the
        // merchant types it in per invoice.
        defaultTaxPercentage={0}
        // Demo mode: simulate the create locally (persists to localStorage so
        // the generated /pay link actually resolves) instead of POSTing.
        onDemoCreate={isDemoMode ? (payload) => createDemoPaymentRecord(payload) : undefined}
        onOpenConnect={() => {
          setCreateOpen(false)
          startOnboarding()
        }}
        onCreated={(result) => {
          loadPayments()
          setPaymentLinkModal({ url: result.shareUrl, customerName: result.customerName || undefined, kind: result.kind })
          showSuccess(result.kind === 'invoice' ? 'Invoice created.' : 'Payment link ready to share.')
        }}
      />

      <PaymentLinkReadyModal
        open={!!paymentLinkModal}
        url={paymentLinkModal?.url || null}
        title={paymentLinkModal?.kind === 'invoice' ? 'Invoice ready to send' : 'Payment link ready'}
        description={paymentLinkModal?.customerName ? `Send this to ${paymentLinkModal.customerName} to collect payment.` : 'Share this link with your customer to collect payment.'}
        onClose={() => setPaymentLinkModal(null)}
      />
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────

function MenuItem({ label, onClick, icon, tone }: { label: string; onClick: () => void; icon: string; tone?: 'green' }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left hover:bg-[var(--color-bg-subtle)] transition-colors ${
        tone === 'green' ? 'text-green-600 dark:text-green-400' : 'text-[var(--color-text-primary)]'
      }`}
    >
      <svg className={`w-4 h-4 ${tone === 'green' ? '' : 'text-[var(--color-text-muted)]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={icon} />
      </svg>
      {label}
    </button>
  )
}

function StatusPill({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full ${
      done
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400'
    }`}>
      {done ? (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      ) : (
        <span className="w-3 h-3 rounded-full border border-current opacity-40" />
      )}
      {label}
    </span>
  )
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone: 'green' | 'amber' | 'orange' | 'slate'
}) {
  const toneStyles = {
    green: 'from-green-500/10 to-emerald-500/5 text-green-700 dark:text-green-400',
    amber: 'from-amber-500/10 to-yellow-500/5 text-amber-700 dark:text-amber-400',
    orange: 'from-orange-500/10 to-red-500/5 text-orange-700 dark:text-orange-400',
    slate: 'from-slate-500/10 to-slate-400/5 text-slate-700 dark:text-slate-300',
  } as const
  return (
    <div className={`app-card bg-gradient-to-br ${toneStyles[tone]} relative overflow-hidden`}>
      <p className="text-[11px] uppercase tracking-wider font-semibold opacity-80">{label}</p>
      <p className="mt-1 text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
      {sub && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{sub}</p>}
    </div>
  )
}

function ActionCard({
  title,
  description,
  icon,
  accent,
  disabled,
  onClick,
}: {
  title: string
  description: string
  icon: React.ReactNode
  accent: 'orange' | 'sky' | 'emerald'
  disabled?: boolean
  onClick?: () => void
}) {
  const accents = {
    orange: 'group-hover:border-orange-300 group-hover:bg-orange-50/40 dark:group-hover:bg-orange-950/20 text-orange-600 dark:text-orange-400 bg-orange-500/10',
    sky: 'group-hover:border-sky-300 group-hover:bg-sky-50/40 dark:group-hover:bg-sky-950/20 text-sky-600 dark:text-sky-400 bg-sky-500/10',
    emerald: 'group-hover:border-emerald-300 group-hover:bg-emerald-50/40 dark:group-hover:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
  } as const
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group app-card text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
        disabled ? '' : 'hover:shadow-md cursor-pointer'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${accents[accent].split(' ').slice(2).join(' ')}`}>
        {icon}
      </div>
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-1">{description}</p>
    </button>
  )
}

function FundsRow({
  step,
  title,
  detail,
  sample,
  emphasis,
  negative,
  final,
}: {
  step: number
  title: string
  detail: string
  sample: string
  emphasis?: boolean
  negative?: boolean
  final?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
        final
          ? 'bg-green-500 text-white'
          : emphasis
            ? 'bg-orange-500 text-white'
            : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]'
      }`}>
        {step}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{title}</p>
          <p className={`text-sm font-semibold tabular-nums ${
            negative
              ? 'text-red-600 dark:text-red-400'
              : final
                ? 'text-green-700 dark:text-green-400'
                : emphasis
                  ? 'text-orange-700 dark:text-orange-400'
                  : 'text-[var(--color-text-secondary)]'
          }`}>
            {sample}
          </p>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{detail}</p>
      </div>
    </div>
  )
}

function Row({ label, value, ok, mono }: { label: string; value: string; ok?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">{label}</dt>
      <dd className={`text-sm font-medium ${mono ? 'font-mono text-xs' : ''} ${
        ok === true ? 'text-green-600 dark:text-green-400'
          : ok === false ? 'text-amber-600 dark:text-amber-400'
          : 'text-[var(--color-text-primary)]'
      }`}>
        {value}
      </dd>
    </div>
  )
}

function truncateAccountId(id: string) {
  if (id.length <= 14) return id
  return `${id.slice(0, 6)}…${id.slice(-4)}`
}
