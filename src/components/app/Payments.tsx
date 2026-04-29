'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import type { AppPaymentRecord, AppSettings, UserProfile } from '@/types/database'
import { PaymentLinkReadyModal } from './PaymentLinkReadyModal'

interface PaymentsProps {
  userProfile: UserProfile | null
  settings: AppSettings
  showSuccess: (message: string) => void
  onOpenSettings?: () => void
}

interface ConnectStatus {
  connected: boolean
  accountId: string | null
  onboardingComplete: boolean
  detailsSubmitted: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  checkout_created: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  expired: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  refunded: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
}

export function Payments({ userProfile, settings, showSuccess, onOpenSettings }: PaymentsProps) {
  const supabase = useMemo(() => createClient(), [])
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [status, setStatus] = useState<ConnectStatus>({
    connected: Boolean(userProfile?.stripe_connect_account_id),
    accountId: userProfile?.stripe_connect_account_id || null,
    onboardingComplete: Boolean(userProfile?.stripe_connect_onboarding_complete),
    detailsSubmitted: Boolean(userProfile?.stripe_connect_details_submitted),
    chargesEnabled: Boolean(userProfile?.stripe_connect_charges_enabled),
    payoutsEnabled: Boolean(userProfile?.stripe_connect_payouts_enabled),
  })
  const [payments, setPayments] = useState<AppPaymentRecord[]>([])
  const [actionLoading, setActionLoading] = useState<'onboarding' | 'dashboard' | 'refresh' | null>(null)
  // BUG-031 UX (round 2): replace `window.prompt` fallback with the same
  // dedicated modal used elsewhere — synchronous click → reliable copy.
  const [paymentLinkModal, setPaymentLinkModal] = useState<{ url: string; customerName?: string } | null>(null)

  const businessReady = Boolean(
    settings.businessInfo.name?.trim() &&
    settings.businessInfo.email?.trim() &&
    settings.businessInfo.phone?.trim()
  )

  const refreshStatus = useCallback(async () => {
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
    } finally {
      setLoadingStatus(false)
      setActionLoading(null)
    }
  }, [])

  const loadPayments = useCallback(async () => {
    const { data, error } = await supabase
      .from('dyia_payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Load payments error:', error)
      return
    }

    setPayments((data || []).map((payment) => ({
      id: payment.id,
      quoteId: payment.quote_id,
      jobId: payment.job_id,
      publicToken: payment.public_token,
      status: payment.status,
      amountCents: payment.amount_cents,
      applicationFeeAmountCents: payment.application_fee_amount_cents,
      destinationAmountCents: payment.destination_amount_cents,
      currency: payment.currency,
      customerName: payment.customer_name,
      customerEmail: payment.customer_email,
      description: payment.description,
      checkoutUrl: payment.checkout_url,
      paidAt: payment.paid_at,
      refundedAt: payment.refunded_at,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at,
    })))
  }, [supabase])

  useEffect(() => {
    refreshStatus()
    loadPayments()
  }, [refreshStatus, loadPayments])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connectParam = params.get('connect')
    if (connectParam === 'return') {
      showSuccess('Stripe setup updated.')
      refreshStatus()
      loadPayments()
    }
  }, [loadPayments, refreshStatus, showSuccess])

  const startOnboarding = async () => {
    setActionLoading('onboarding')
    try {
      const res = await fetch('/api/stripe/connect/onboarding', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not start Stripe setup')
      if (data.url) window.location.href = data.url
    } catch (error) {
      console.error('Connect onboarding error:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const openDashboard = async () => {
    setActionLoading('dashboard')
    try {
      const res = await fetch('/api/stripe/connect/dashboard', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not open Stripe dashboard')
      if (data.url) window.location.href = data.url
    } catch (error) {
      console.error('Connect dashboard error:', error)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">Set up Stripe Connect and manage customer payments in Dyia.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="app-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Stripe Connect setup</h3>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  Connect your Stripe Express account so customers can pay your quotes and jobs online.
                </p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                status.chargesEnabled
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              }`}>
                {status.chargesEnabled ? 'Ready to accept payments' : 'Setup needed'}
              </span>
            </div>

            {!businessReady && (
              <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 p-4">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Add your business name, phone, and email before sending payment links.
                </p>
                {onOpenSettings && (
                  <button onClick={onOpenSettings} className="mt-3 app-btn-secondary text-sm">
                    Open business settings
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div className="rounded-xl border border-[var(--color-border)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Connected account</p>
                <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
                  {status.accountId || 'Not created yet'}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-faint)]">Payouts</p>
                <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
                  {status.payoutsEnabled ? 'Enabled' : 'Pending Stripe verification'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {[
                { label: 'Details submitted', done: status.detailsSubmitted },
                { label: 'Card payments enabled', done: status.chargesEnabled },
                { label: 'Payouts enabled', done: status.payoutsEnabled },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-[var(--color-bg-subtle)] p-3">
                  <p className="text-xs text-[var(--color-text-faint)]">{item.label}</p>
                  <p className={`mt-1 text-sm font-semibold ${item.done ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {item.done ? 'Complete' : 'Needs action'}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 mt-5">
              <button
                onClick={startOnboarding}
                disabled={actionLoading !== null || !businessReady}
                className="app-btn-primary text-sm"
              >
                {actionLoading === 'onboarding'
                  ? 'Opening Stripe...'
                  : status.connected
                    ? 'Resume Stripe setup'
                    : 'Connect Stripe'}
              </button>
              {status.connected && (
                <button
                  onClick={openDashboard}
                  disabled={actionLoading !== null}
                  className="app-btn-secondary text-sm"
                >
                  {actionLoading === 'dashboard' ? 'Opening...' : 'Open Stripe dashboard'}
                </button>
              )}
              <button
                onClick={refreshStatus}
                disabled={actionLoading !== null}
                className="app-btn-secondary text-sm"
              >
                {actionLoading === 'refresh' ? 'Refreshing...' : 'Refresh status'}
              </button>
            </div>
          </div>

          <div className="app-card">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Recent payment requests</h3>
                <p className="text-sm text-[var(--color-text-muted)]">Share these links from Quotes or Jobs to collect payment.</p>
              </div>
            </div>

            {payments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center">
                <p className="text-sm text-[var(--color-text-muted)]">
                  No payment requests yet. Create one from a quote or a job after Stripe is connected.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div key={payment.id} className="rounded-xl border border-[var(--color-border)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {payment.customerName || payment.description || 'Payment request'}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          {payment.description || 'Hosted payment link'}
                        </p>
                        <p className="text-xs text-[var(--color-text-faint)] mt-1">
                          Created {new Date(payment.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[payment.status] || STATUS_STYLES.pending}`}>
                        {payment.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                      <div>
                        <p className="text-lg font-bold text-[var(--color-text-primary)]">
                          {formatCurrency(payment.amountCents / 100)}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Dyia fee {formatCurrency(payment.applicationFeeAmountCents / 100)} · Net payout {formatCurrency(payment.destinationAmountCents / 100)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/pay/${payment.publicToken}`
                            setPaymentLinkModal({ url, customerName: payment.customerName || undefined })
                          }}
                          className="app-btn-secondary text-sm"
                        >
                          Copy link
                        </button>
                        <a
                          href={`/pay/${payment.publicToken}`}
                          target="_blank"
                          rel="noreferrer"
                          className="app-btn-secondary text-sm"
                        >
                          Open link
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="app-card">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">How it works</h3>
            <div className="mt-4 space-y-3">
              {[
                'Connect your Stripe Express account.',
                'Create a payment request from a quote or a job.',
                'Send the hosted payment link to your customer.',
                'Customer pays online and Dyia records the status automatically.',
              ].map((step, index) => (
                <div key={step} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center text-xs font-bold shrink-0">
                    {index + 1}
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)]">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="app-card">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Platform fee</h3>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Dyia takes 0.75% on each successful payment. Stripe processing fees still apply separately.
            </p>
            <div className="mt-4 rounded-xl bg-[var(--color-bg-subtle)] p-4">
              <p className="text-xs text-[var(--color-text-faint)]">Example on a $500 payment</p>
              <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
                Dyia fee {formatCurrency(500 * 0.0075)} · before Stripe processing
              </p>
            </div>
          </div>

          <div className="app-card">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Setup status</h3>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              {loadingStatus
                ? 'Checking Stripe setup...'
                : status.chargesEnabled
                  ? 'You can start requesting payments from Quotes and Jobs.'
                  : 'Finish Stripe onboarding to start accepting payments.'}
            </p>
          </div>
        </div>
      </div>

      {/* Payment link ready modal — explicit copy UX (BUG-031 round 2) */}
      <PaymentLinkReadyModal
        open={!!paymentLinkModal}
        url={paymentLinkModal?.url || null}
        title="Payment link"
        description={paymentLinkModal?.customerName ? `Send this link to ${paymentLinkModal.customerName} to collect payment.` : 'Share this link with your customer to collect payment.'}
        onClose={() => setPaymentLinkModal(null)}
      />
    </div>
  )
}
