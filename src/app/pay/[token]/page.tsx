'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'

interface PublicPaymentData {
  id: string
  token: string
  status: string
  amountCents: number
  currency: string
  customerName?: string | null
  customerEmail?: string | null
  description?: string | null
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

  return (
    <div className="min-h-screen bg-[var(--color-bg-page)] py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <Image src="/dyia-logo-full.png" alt="dyia" width={120} height={32} className="h-8 w-auto mx-auto mb-4" />
          <p className="text-sm text-[var(--color-text-muted)]">Secure checkout powered by Stripe</p>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="text-center">
            <p className="text-sm text-[var(--color-text-muted)]">Paying</p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">{payment.businessName}</h1>
            <p className="mt-4 text-4xl font-bold text-orange-600 dark:text-orange-400">{formattedAmount}</p>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{payment.description || 'Payment request'}</p>
          </div>

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

          {alreadyPaid ? (
            <div className="mt-6 rounded-xl border border-green-200 dark:border-green-800/40 bg-green-50 dark:bg-green-950/20 p-4 text-center">
              <p className="text-sm font-medium text-green-700 dark:text-green-300">This payment has already been completed.</p>
              {payment.paidAt && (
                <p className="mt-1 text-xs text-green-700/80 dark:text-green-300/80">
                  Paid on {new Date(payment.paidAt).toLocaleString()}
                </p>
              )}
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
      </div>
    </div>
  )
}
