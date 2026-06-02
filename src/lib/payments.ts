/**
 * Shared, pure payment math + validation for Dyia Pay.
 *
 * This module is intentionally ISOMORPHIC and dependency-free so it can be
 * imported by both the browser (CreatePaymentRequestModal, the public pay page)
 * and the server (api/payments/request/custom, checkout). Keeping the money
 * rules in one place means the live "you'll get paid" preview the merchant sees,
 * the amount persisted server-side, and what Stripe actually charges can never
 * silently drift apart.
 *
 * Money rules (single source of truth):
 *   - Platform fee is 0.75% (75 bps) of the BASE amount only.
 *   - Tips flow 100% to the merchant; the platform fee is never taken on a tip.
 *   - All amounts are integer cents. Per-line amounts are rounded so the sum of
 *     line items always equals the invoice subtotal AND what Stripe charges.
 */

export const STRIPE_PLATFORM_FEE_BPS = 75 // 0.75%

/** Single-payment ceiling. Guards against fat-finger entry and API abuse. */
export const MAX_PAYMENT_AMOUNT_CENTS = 5_000_000 // $50,000

export interface NormalizedLineItem {
  description: string
  quantity: number
  unitAmountCents: number
}

export interface InvoiceTotals {
  subtotalCents: number
  taxCents: number
  totalCents: number
}

/** Dyia's platform fee (application fee) in cents, charged on the base only. */
export function calculatePlatformFeeCents(amountCents: number): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0
  return Math.max(0, Math.round(amountCents * (STRIPE_PLATFORM_FEE_BPS / 10_000)))
}

/** What the merchant receives from the base amount (before Stripe processing). */
export function netAfterPlatformFeeCents(amountCents: number): number {
  if (!Number.isFinite(amountCents) || amountCents <= 0) return 0
  return Math.max(0, amountCents - calculatePlatformFeeCents(amountCents))
}

/**
 * Parse a user-entered dollar string/number into integer cents.
 * Returns 0 for blank, non-numeric, or negative input.
 */
export function dollarsToCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

/** Parse a positive quantity; returns 0 when invalid (so it can be filtered out). */
export function parseQuantity(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return n
}

/** Trim + cap a free-text field; returns null for blank/non-string. */
export function sanitizePaymentString(value: unknown, max = 240): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

/**
 * Per-line total in cents. Rounded so the sum across lines is exact and can be
 * handed to Stripe as quantity:1 / unit_amount:lineAmount without drift when a
 * quantity is fractional (e.g. 1.5 hours of labor).
 */
export function lineAmountCents(item: { quantity: number; unitAmountCents: number }): number {
  return Math.round(item.quantity * item.unitAmountCents)
}

interface RawLineItem {
  description?: unknown
  quantity?: unknown
  unitAmountCents?: unknown
}

/**
 * Validate + normalize a raw line-item array (from the client or API body).
 * Drops rows missing a description, with quantity <= 0, or a negative price.
 * Returns null when nothing usable remains. `subtotalCents` is the sum of the
 * ROUNDED per-line amounts so it always matches the itemized display + Stripe.
 */
export function normalizeLineItems(
  raw: unknown
): { items: NormalizedLineItem[]; subtotalCents: number } | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const items: NormalizedLineItem[] = []
  let subtotalCents = 0
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const cast = entry as RawLineItem
    const description = sanitizePaymentString(cast.description)
    const quantity = Number(cast.quantity)
    const unitAmountCents = Math.round(Number(cast.unitAmountCents))
    if (!description) continue
    if (!Number.isFinite(quantity) || quantity <= 0) continue
    if (!Number.isFinite(unitAmountCents) || unitAmountCents < 0) continue
    const item: NormalizedLineItem = { description, quantity, unitAmountCents }
    items.push(item)
    subtotalCents += lineAmountCents(item)
  }
  if (items.length === 0) return null
  return { items, subtotalCents }
}

/** Tax in cents from a subtotal + percentage (0 when pct invalid/<=0). */
export function computeTaxCents(subtotalCents: number, taxPercentage: number): number {
  if (!Number.isFinite(taxPercentage) || taxPercentage <= 0) return 0
  if (!Number.isFinite(subtotalCents) || subtotalCents <= 0) return 0
  return Math.round(subtotalCents * (taxPercentage / 100))
}

/** Subtotal + tax + total for a set of normalized line items. */
export function computeInvoiceTotals(
  items: NormalizedLineItem[],
  taxPercentage: number
): InvoiceTotals {
  const subtotalCents = items.reduce((sum, item) => sum + lineAmountCents(item), 0)
  const taxCents = computeTaxCents(subtotalCents, taxPercentage)
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents }
}

/** Whether an amount is within the allowed range for a single payment. */
export function isPayableAmount(amountCents: number): boolean {
  return Number.isFinite(amountCents) && amountCents > 0 && amountCents <= MAX_PAYMENT_AMOUNT_CENTS
}

/**
 * Format integer cents as currency with EXACT cents (always 2 decimals).
 * The app-wide formatCurrency() rounds to whole dollars, which is wrong for
 * payments where the customer must see (and pay) the precise amount, e.g.
 * $882.24 — never "$882". Use this for every payment/invoice money display.
 */
export function formatCents(cents: number, currency = 'usd'): string {
  const value = (Number.isFinite(cents) ? cents : 0) / 100
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `$${value.toFixed(2)}`
  }
}
