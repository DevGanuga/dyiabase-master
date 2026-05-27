'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '@/lib/utils'

interface LineItemDraft {
  id: string
  description: string
  quantity: string
  unitAmount: string
}

type ModalTab = 'link' | 'invoice'

interface CreatePaymentRequestModalProps {
  open: boolean
  onClose: () => void
  onCreated: (result: { shareUrl: string; customerName?: string | null; kind: 'payment_link' | 'invoice' }) => void
  defaultTaxPercentage?: number
  /** Whether the merchant has finished Stripe onboarding. Drives a CTA-blocking banner. */
  canAcceptPayments: boolean
  onOpenConnect?: () => void
}

const newLineItem = (): LineItemDraft => ({
  id: Math.random().toString(36).slice(2),
  description: '',
  quantity: '1',
  unitAmount: '',
})

function parseMoneyToCents(value: string): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

function parseQuantity(value: string): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return n
}

export function CreatePaymentRequestModal({
  open,
  onClose,
  onCreated,
  defaultTaxPercentage = 0,
  canAcceptPayments,
  onOpenConnect,
}: CreatePaymentRequestModalProps) {
  const [tab, setTab] = useState<ModalTab>('link')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Shared customer fields
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')

  // Pay link fields
  const [linkAmount, setLinkAmount] = useState('')
  const [linkDescription, setLinkDescription] = useState('')

  // Invoice fields
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [taxPercentage, setTaxPercentage] = useState<string>(
    defaultTaxPercentage > 0 ? String(defaultTaxPercentage) : ''
  )
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([newLineItem()])
  const [invoiceNotes, setInvoiceNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setError(null)
    setSubmitting(false)
  }, [open])

  useEffect(() => {
    if (open && defaultTaxPercentage > 0 && taxPercentage === '') {
      setTaxPercentage(String(defaultTaxPercentage))
    }
  }, [open, defaultTaxPercentage, taxPercentage])

  const invoiceTotals = useMemo(() => {
    let subtotalCents = 0
    for (const item of lineItems) {
      const qty = parseQuantity(item.quantity)
      const unitCents = parseMoneyToCents(item.unitAmount)
      if (!item.description.trim() || qty <= 0 || unitCents < 0) continue
      subtotalCents += qty * unitCents
    }
    const taxPct = Number(taxPercentage)
    const taxCents = Number.isFinite(taxPct) && taxPct > 0
      ? Math.round(subtotalCents * (taxPct / 100))
      : 0
    return {
      subtotalCents,
      taxCents,
      totalCents: subtotalCents + taxCents,
    }
  }, [lineItems, taxPercentage])

  const updateLineItem = (id: string, patch: Partial<LineItemDraft>) => {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const addLineItem = () => setLineItems((prev) => [...prev, newLineItem()])

  const removeLineItem = (id: string) =>
    setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item.id !== id)))

  const resetAndClose = () => {
    setCustomerName('')
    setCustomerEmail('')
    setCustomerPhone('')
    setCustomerAddress('')
    setLinkAmount('')
    setLinkDescription('')
    setInvoiceNumber('')
    setDueDate('')
    setTaxPercentage(defaultTaxPercentage > 0 ? String(defaultTaxPercentage) : '')
    setLineItems([newLineItem()])
    setInvoiceNotes('')
    setError(null)
    setTab('link')
    onClose()
  }

  const submit = async () => {
    setError(null)
    if (!canAcceptPayments) {
      setError('Finish Stripe onboarding first so payments can settle to your bank.')
      return
    }

    if (tab === 'link') {
      const amountCents = parseMoneyToCents(linkAmount)
      if (amountCents <= 0) {
        setError('Enter an amount greater than $0.')
        return
      }
    } else {
      const hasValidLine = lineItems.some(
        (item) => item.description.trim() && parseQuantity(item.quantity) > 0 && parseMoneyToCents(item.unitAmount) > 0
      )
      if (!hasValidLine) {
        setError('Add at least one line item with a quantity and price.')
        return
      }
    }

    setSubmitting(true)
    try {
      const body =
        tab === 'link'
          ? {
              kind: 'payment_link' as const,
              amountCents: parseMoneyToCents(linkAmount),
              description: linkDescription.trim() || undefined,
              customerName: customerName.trim() || undefined,
              customerEmail: customerEmail.trim() || undefined,
              customerPhone: customerPhone.trim() || undefined,
              customerAddress: customerAddress.trim() || undefined,
            }
          : {
              kind: 'invoice' as const,
              description: invoiceNotes.trim() || undefined,
              customerName: customerName.trim() || undefined,
              customerEmail: customerEmail.trim() || undefined,
              customerPhone: customerPhone.trim() || undefined,
              customerAddress: customerAddress.trim() || undefined,
              invoiceNumber: invoiceNumber.trim() || undefined,
              dueDate: dueDate || undefined,
              taxPercentage: Number(taxPercentage) || 0,
              lineItems: lineItems
                .filter(
                  (item) =>
                    item.description.trim() && parseQuantity(item.quantity) > 0 && parseMoneyToCents(item.unitAmount) >= 0
                )
                .map((item) => ({
                  description: item.description.trim(),
                  quantity: parseQuantity(item.quantity),
                  unitAmountCents: parseMoneyToCents(item.unitAmount),
                })),
            }

      const res = await fetch('/api/payments/request/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Could not create payment request')
      }

      onCreated({
        shareUrl: data.shareUrl,
        customerName: customerName.trim() || null,
        kind: tab === 'link' ? 'payment_link' : 'invoice',
      })
      resetAndClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  const previewTotal = tab === 'link' ? parseMoneyToCents(linkAmount) : invoiceTotals.totalCents

  return (
    <div className="fixed inset-0 z-[120] flex items-stretch sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full sm:max-w-2xl bg-[var(--color-bg-card)] sm:rounded-2xl border border-[var(--color-border)] shadow-2xl flex flex-col max-h-screen sm:max-h-[90vh]">
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-[var(--color-border)] flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Get paid</h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              Send a one-tap payment link or a full invoice. Funds land in your Stripe balance, then your bank.
            </p>
          </div>
          <button
            onClick={resetAndClose}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!canAcceptPayments && (
          <div className="mx-6 mt-4 rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm flex items-start gap-3">
            <span className="mt-0.5 text-amber-600 dark:text-amber-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </span>
            <div className="flex-1">
              <p className="font-medium text-amber-900 dark:text-amber-100">Finish Stripe setup to start collecting</p>
              <p className="text-amber-800/80 dark:text-amber-200/80 mt-0.5">
                You can build invoices and pay links now, but you need to connect Stripe before customers can pay.
              </p>
              {onOpenConnect && (
                <button
                  onClick={onOpenConnect}
                  className="mt-2 text-xs font-semibold text-amber-900 dark:text-amber-100 underline underline-offset-2"
                >
                  Open Stripe setup →
                </button>
              )}
            </div>
          </div>
        )}

        <div className="px-6 pt-4 flex-shrink-0">
          <div className="inline-flex p-1 bg-[var(--color-bg-subtle)] rounded-lg">
            <button
              onClick={() => setTab('link')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                tab === 'link'
                  ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Quick pay link
            </button>
            <button
              onClick={() => setTab('invoice')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                tab === 'invoice'
                  ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              Invoice
            </button>
          </div>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1">
          {tab === 'link' ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                  Amount
                </label>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={linkAmount}
                    onChange={(e) => setLinkAmount(e.target.value)}
                    className="app-input pl-7 text-xl font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                  What's this for
                </label>
                <input
                  type="text"
                  placeholder="Deposit, lawn service, etc."
                  value={linkDescription}
                  onChange={(e) => setLinkDescription(e.target.value)}
                  className="app-input mt-1.5"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                    Invoice #
                  </label>
                  <input
                    type="text"
                    placeholder="INV-1001"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="app-input mt-1.5"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                    Due date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="app-input mt-1.5"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                    Line items
                  </span>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline"
                  >
                    + Add item
                  </button>
                </div>
                <div className="space-y-2">
                  {lineItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-12 gap-2 items-start rounded-lg border border-[var(--color-border)] p-2 bg-[var(--color-bg-subtle)]/30"
                    >
                      <input
                        type="text"
                        placeholder={`Item ${idx + 1} description`}
                        value={item.description}
                        onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                        className="app-input col-span-12 sm:col-span-6 text-sm"
                      />
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="1"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(item.id, { quantity: e.target.value })}
                        className="app-input col-span-4 sm:col-span-2 text-sm"
                      />
                      <div className="relative col-span-7 sm:col-span-3">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-muted)]">$</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={item.unitAmount}
                          onChange={(e) => updateLineItem(item.id, { unitAmount: e.target.value })}
                          className="app-input pl-6 text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLineItem(item.id)}
                        disabled={lineItems.length <= 1}
                        className="col-span-1 h-9 flex items-center justify-center text-[var(--color-text-muted)] hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Remove line item"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                    Tax (%)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={taxPercentage}
                    onChange={(e) => setTaxPercentage(e.target.value)}
                    className="app-input mt-1.5"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                    Notes for customer (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Thank you for your business"
                    value={invoiceNotes}
                    onChange={(e) => setInvoiceNotes(e.target.value)}
                    className="app-input mt-1.5"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-[var(--color-bg-subtle)] p-3 text-sm space-y-1">
                <div className="flex justify-between text-[var(--color-text-muted)]">
                  <span>Subtotal</span>
                  <span>{formatCurrency(invoiceTotals.subtotalCents / 100)}</span>
                </div>
                <div className="flex justify-between text-[var(--color-text-muted)]">
                  <span>Tax</span>
                  <span>{formatCurrency(invoiceTotals.taxCents / 100)}</span>
                </div>
                <div className="flex justify-between font-semibold text-[var(--color-text-primary)] pt-1 border-t border-[var(--color-border)]">
                  <span>Total</span>
                  <span>{formatCurrency(invoiceTotals.totalCents / 100)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Customer block shared across both tabs */}
          <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
              Customer (optional but recommended)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="app-input"
              />
              <input
                type="email"
                placeholder="customer@email.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="app-input"
              />
              <input
                type="tel"
                placeholder="(555) 123-4567"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="app-input"
              />
              <input
                type="text"
                placeholder="Address (for invoice)"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                className="app-input"
              />
            </div>
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        <div className="border-t border-[var(--color-border)] px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0 bg-[var(--color-bg-card)]">
          <div className="text-sm">
            <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide">You'll get paid</p>
            <p className="font-semibold text-[var(--color-text-primary)]">
              {formatCurrency(Math.max(0, previewTotal - Math.round(previewTotal * 0.0075)) / 100)}
              <span className="ml-1 text-xs font-normal text-[var(--color-text-muted)]">
                after {formatCurrency(Math.round(previewTotal * 0.0075) / 100)} Dyia fee
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={resetAndClose}
              className="app-btn-secondary text-sm"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting || previewTotal <= 0}
              className="app-btn-primary text-sm"
            >
              {submitting ? 'Creating...' : tab === 'link' ? 'Create pay link' : 'Send invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
