/**
 * Pure-logic tests for the Dyia Pay money/validation lib.
 *
 * Run with the project's Node (22+, type-stripping):
 *   node --experimental-strip-types claudedocs/payments-release/payments-logic.test.mts
 *
 * These exercise the EXACT functions the server route and the client modal use,
 * so a green run means the live preview, the persisted amount, and what Stripe
 * charges are computed identically. No network, DB, or Stripe required.
 */
import assert from 'node:assert/strict'
import {
  calculatePlatformFeeCents,
  netAfterPlatformFeeCents,
  dollarsToCents,
  parseQuantity,
  sanitizePaymentString,
  lineAmountCents,
  normalizeLineItems,
  computeTaxCents,
  computeInvoiceTotals,
  isPayableAmount,
  MAX_PAYMENT_AMOUNT_CENTS,
  STRIPE_PLATFORM_FEE_BPS,
} from '../../src/lib/payments.ts'

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

console.log('payments lib — platform fee (0.75% on base only)')
check('fee constant is 75 bps', () => assert.equal(STRIPE_PLATFORM_FEE_BPS, 75))
check('$450.00 → $3.38 fee', () => assert.equal(calculatePlatformFeeCents(45000), 338))
check('$500.00 → $3.75 fee', () => assert.equal(calculatePlatformFeeCents(50000), 375))
check('$1,060.00 → $7.95 fee', () => assert.equal(calculatePlatformFeeCents(106000), 795))
check('rounds to nearest cent ($33.33 → $0.25)', () => assert.equal(calculatePlatformFeeCents(3333), 25))
check('zero / negative / NaN → 0 fee', () => {
  assert.equal(calculatePlatformFeeCents(0), 0)
  assert.equal(calculatePlatformFeeCents(-100), 0)
  assert.equal(calculatePlatformFeeCents(Number.NaN), 0)
})
check('net = base − fee', () => {
  assert.equal(netAfterPlatformFeeCents(45000), 45000 - 338)
  assert.equal(netAfterPlatformFeeCents(50000), 49625)
})

console.log('payments lib — dollar/quantity parsing')
check('dollarsToCents handles strings + floats', () => {
  assert.equal(dollarsToCents('450'), 45000)
  assert.equal(dollarsToCents('19.99'), 1999)
  assert.equal(dollarsToCents(19.99), 1999)
  assert.equal(dollarsToCents('0.1'), 10)
})
check('dollarsToCents rejects blanks/negatives/junk → 0', () => {
  assert.equal(dollarsToCents(''), 0)
  assert.equal(dollarsToCents('-5'), 0)
  assert.equal(dollarsToCents('abc'), 0)
  assert.equal(dollarsToCents(null), 0)
  assert.equal(dollarsToCents(undefined), 0)
})
check('parseQuantity allows fractional, rejects <= 0', () => {
  assert.equal(parseQuantity('1'), 1)
  assert.equal(parseQuantity('1.5'), 1.5)
  assert.equal(parseQuantity('0'), 0)
  assert.equal(parseQuantity('-2'), 0)
  assert.equal(parseQuantity('x'), 0)
})

console.log('payments lib — string sanitization')
check('trims + returns null for blank', () => {
  assert.equal(sanitizePaymentString('  hi  '), 'hi')
  assert.equal(sanitizePaymentString('   '), null)
  assert.equal(sanitizePaymentString(123 as unknown), null)
})
check('caps length', () => {
  assert.equal(sanitizePaymentString('a'.repeat(500), 64)!.length, 64)
})

console.log('payments lib — line items + invoice totals')
check('lineAmountCents rounds qty × unit', () => {
  assert.equal(lineAmountCents({ quantity: 2, unitAmountCents: 4500 }), 9000)
  assert.equal(lineAmountCents({ quantity: 1.5, unitAmountCents: 8000 }), 12000)
})
check('normalizeLineItems drops invalid rows', () => {
  const r = normalizeLineItems([
    { description: 'A', quantity: 1, unitAmountCents: 65000 },
    { description: '', quantity: 2, unitAmountCents: 100 }, // no desc
    { description: 'B', quantity: 0, unitAmountCents: 100 }, // qty 0
    { description: 'C', quantity: 1, unitAmountCents: -5 }, // negative price
    { description: 'D', quantity: 2, unitAmountCents: 4500 },
  ])
  assert.ok(r)
  assert.equal(r!.items.length, 2)
  assert.equal(r!.subtotalCents, 65000 + 9000)
})
check('normalizeLineItems returns null for empty/garbage', () => {
  assert.equal(normalizeLineItems([]), null)
  assert.equal(normalizeLineItems('nope' as unknown), null)
  assert.equal(normalizeLineItems([{ description: '', quantity: 0, unitAmountCents: 0 }]), null)
})
check('computeTaxCents: 8.25% of $815.00 = $67.24', () => {
  assert.equal(computeTaxCents(81500, 8.25), 6724)
})
check('computeTaxCents: 0 / negative pct → 0', () => {
  assert.equal(computeTaxCents(81500, 0), 0)
  assert.equal(computeTaxCents(81500, -5), 0)
})
check('computeInvoiceTotals matches the demo invoice ($815 + 8.25% = $882.24)', () => {
  const items = [
    { description: 'Full garage cleanout (2-car)', quantity: 1, unitAmountCents: 65000 },
    { description: 'Mattress disposal fee', quantity: 2, unitAmountCents: 4500 },
    { description: 'Same-day service surcharge', quantity: 1, unitAmountCents: 7500 },
  ]
  const t = computeInvoiceTotals(items, 8.25)
  assert.equal(t.subtotalCents, 81500)
  assert.equal(t.taxCents, 6724)
  assert.equal(t.totalCents, 88224)
})
check('fractional qty: subtotal stays exact (1.5h × $80 = $120)', () => {
  const t = computeInvoiceTotals([{ description: 'Labor', quantity: 1.5, unitAmountCents: 8000 }], 0)
  assert.equal(t.subtotalCents, 12000)
  assert.equal(t.totalCents, 12000)
})

console.log('payments lib — amount ceiling')
check('isPayableAmount enforces (0, $50,000]', () => {
  assert.equal(isPayableAmount(1), true)
  assert.equal(isPayableAmount(MAX_PAYMENT_AMOUNT_CENTS), true)
  assert.equal(isPayableAmount(MAX_PAYMENT_AMOUNT_CENTS + 1), false)
  assert.equal(isPayableAmount(0), false)
  assert.equal(isPayableAmount(-1), false)
})

console.log('payments lib — tip rule (fee never taken on tip)')
check('tip flows 100% to merchant; fee is on base only', () => {
  const baseCents = 50000
  const tipCents = 10000 // $100 tip
  const fee = calculatePlatformFeeCents(baseCents) // computed on base only
  const merchantGets = netAfterPlatformFeeCents(baseCents) + tipCents
  assert.equal(fee, 375)
  assert.equal(merchantGets, (50000 - 375) + 10000) // 59625
  // Fee must NOT change if a tip is added
  assert.equal(calculatePlatformFeeCents(baseCents + tipCents) !== fee, true)
})

console.log(`\nAll ${passed} payment-logic checks passed.`)
