/**
 * Demo-mode payment fixtures + a localStorage-backed "create" simulation.
 *
 * Demo mode has no Clerk session and no Supabase rows, so every real payments
 * API 401s. To let the business team (and QA) click through the ENTIRE flow —
 * hub stats, activity feed, create a pay link/invoice, then open the customer
 * pay page — we serve curated fixtures here and persist demo-created payments
 * to localStorage so a freshly-created link actually resolves on /pay/[token].
 *
 * Everything is keyed by a `demo-` token prefix. Real payment tokens are
 * `randomBytes(24).toString('base64url')` (32 chars, no `demo-` prefix), so the
 * public pay page can safely branch on the prefix with zero risk of collision.
 */

import type { AppPaymentRecord, PaymentLineItem, PaymentRequestKind } from '@/types/database'
import { calculatePlatformFeeCents } from '@/lib/payments'

export const DEMO_TOKEN_PREFIX = 'demo-'

export const DEMO_BUSINESS = {
  name: 'Hill Country Haul-Away',
  email: 'hello@hillcountryhaul.co',
  phone: '(512) 555-0199',
  address: '4100 Ranch Rd 620 S\nAustin, TX 78738',
  logo: null as string | null,
}

const DAY_MS = 86_400_000

interface MakeRecordInput {
  token: string
  kind: PaymentRequestKind
  status: AppPaymentRecord['status']
  amountCents: number
  tipCents?: number
  allowTip?: boolean
  customerName?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  customerAddress?: string | null
  description?: string | null
  invoiceNumber?: string | null
  dueDate?: string | null
  subtotalCents?: number | null
  taxCents?: number | null
  lineItems?: PaymentLineItem[] | null
  createdDaysAgo?: number
  paidDaysAgo?: number | null
}

let demoSeq = 0

function makeRecord(input: MakeRecordInput): AppPaymentRecord {
  const fee = calculatePlatformFeeCents(input.amountCents)
  const now = Date.now()
  const id = `demo-rec-${++demoSeq}`
  const createdAt = new Date(now - (input.createdDaysAgo ?? 0) * DAY_MS).toISOString()
  const paidAt = input.paidDaysAgo != null ? new Date(now - input.paidDaysAgo * DAY_MS).toISOString() : null
  return {
    id,
    quoteId: input.kind === 'quote_payment' ? `${id}-quote` : null,
    jobId: input.kind === 'job_payment' ? `${id}-job` : null,
    publicToken: input.token,
    status: input.status,
    kind: input.kind,
    amountCents: input.amountCents,
    subtotalCents: input.subtotalCents ?? null,
    taxCents: input.taxCents ?? null,
    tipCents: input.tipCents ?? 0,
    allowTip: input.allowTip ?? true,
    applicationFeeAmountCents: fee,
    destinationAmountCents: Math.max(0, input.amountCents - fee),
    currency: 'usd',
    customerName: input.customerName ?? null,
    customerEmail: input.customerEmail ?? null,
    customerPhone: input.customerPhone ?? null,
    customerAddress: input.customerAddress ?? null,
    description: input.description ?? null,
    invoiceNumber: input.invoiceNumber ?? null,
    dueDate: input.dueDate ?? null,
    lineItems: input.lineItems ?? null,
    checkoutUrl: null,
    paidAt,
    refundedAt: null,
    createdAt,
    updatedAt: createdAt,
  }
}

function isoDateInDays(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10)
}

/** Curated, realistic seed set used by the hub stats + activity feed in demo mode. */
export const DEMO_PAYMENTS: AppPaymentRecord[] = [
  makeRecord({
    token: 'demo-seed-paidlink',
    kind: 'payment_link',
    status: 'paid',
    amountCents: 45000,
    tipCents: 9000,
    customerName: 'Lisa Chen',
    customerEmail: 'lisa.chen@email.com',
    description: 'Garage cleanout — final payment',
    createdDaysAgo: 2,
    paidDaysAgo: 1,
  }),
  makeRecord({
    token: 'demo-seed-paidinvoice',
    kind: 'invoice',
    status: 'paid',
    amountCents: 25980,
    subtotalCents: 24000,
    taxCents: 1980,
    tipCents: 2000,
    invoiceNumber: 'INV-2026-009',
    customerName: 'Amanda Torres',
    customerEmail: 'amanda.t@email.com',
    customerAddress: '305 Pine Rd\nAustin, TX 78704',
    description: 'Thank you for your business!',
    lineItems: [{ description: 'Monthly yard debris haul-away', quantity: 4, unitAmountCents: 6000 }],
    createdDaysAgo: 3,
    paidDaysAgo: 1,
  }),
  makeRecord({
    token: 'demo-seed-paidquote',
    kind: 'quote_payment',
    status: 'paid',
    amountCents: 60000,
    customerName: 'Robert Hayes',
    customerEmail: 'rob.hayes@email.com',
    description: 'Payment for quote — hot tub removal & disposal',
    createdDaysAgo: 6,
    paidDaysAgo: 4,
  }),
  makeRecord({
    token: 'demo-seed-openinvoice',
    kind: 'invoice',
    status: 'pending',
    amountCents: 88224,
    subtotalCents: 81500,
    taxCents: 6724,
    invoiceNumber: 'INV-2026-014',
    customerName: 'Lisa Chen',
    customerEmail: 'lisa.chen@email.com',
    customerPhone: '(512) 555-0142',
    customerAddress: '892 Oak Ave\nAustin, TX 78704',
    description: 'Payment due within 14 days. Thanks for choosing us!',
    dueDate: isoDateInDays(14),
    lineItems: [
      { description: 'Full garage cleanout (2-car)', quantity: 1, unitAmountCents: 65000 },
      { description: 'Mattress disposal fee', quantity: 2, unitAmountCents: 4500 },
      { description: 'Same-day service surcharge', quantity: 1, unitAmountCents: 7500 },
    ],
    createdDaysAgo: 2,
  }),
  makeRecord({
    token: 'demo-seed-openlink',
    kind: 'payment_link',
    status: 'pending',
    amountCents: 27500,
    customerName: 'Sarah Miller',
    description: 'Basement cleanout deposit',
    createdDaysAgo: 1,
  }),
  makeRecord({
    token: 'demo-seed-overdue',
    kind: 'invoice',
    status: 'pending',
    amountCents: 32500,
    subtotalCents: 30000,
    taxCents: 2500,
    invoiceNumber: 'INV-2026-006',
    customerName: 'Marcus Webb',
    customerEmail: 'marcus.webb@email.com',
    customerAddress: '77 Cedar Ln\nAustin, TX 78745',
    description: 'Reminder: this invoice is past due.',
    dueDate: isoDateInDays(-5),
    lineItems: [{ description: 'Office furniture removal', quantity: 1, unitAmountCents: 30000 }],
    createdDaysAgo: 20,
  }),
  makeRecord({
    token: 'demo-seed-checkout',
    kind: 'job_payment',
    status: 'checkout_created',
    amountCents: 70000,
    customerName: 'Kevin Park',
    description: 'Payment for job — construction debris removal',
    createdDaysAgo: 1,
  }),
]

// ── localStorage-backed demo-created payments ────────────────────────────
// v2: created records now use a token-based id (not the seed sequence) to
// avoid React key collisions with the curated seeds on reload.
const LS_KEY = 'dyia_demo_payments_v2'

function loadCreated(): AppPaymentRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveCreated(list: AppPaymentRecord[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(list))
  } catch {
    /* private mode / quota — non-fatal for a demo */
  }
}

/** Activity feed in demo mode: anything the user just created, then the seeds. */
export function getDemoFeed(): AppPaymentRecord[] {
  const combined = [...loadCreated(), ...DEMO_PAYMENTS]
  // Defensive dedupe by id so a stale persisted row can never collide with a seed.
  const seen = new Set<string>()
  return combined.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
}

export interface DemoCreateInput {
  kind: PaymentRequestKind
  amountCents: number
  description?: string
  allowTip?: boolean
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  customerAddress?: string
  invoiceNumber?: string
  dueDate?: string
  subtotalCents?: number
  taxCents?: number
  lineItems?: PaymentLineItem[]
}

/** Simulate creating a payment in demo mode; persists so /pay/[token] resolves. */
export function createDemoPaymentRecord(input: DemoCreateInput): { record: AppPaymentRecord; shareUrl: string } {
  const token = `${DEMO_TOKEN_PREFIX}${Math.random().toString(36).slice(2, 10)}`
  const isInvoice = input.kind === 'invoice'
  const built = makeRecord({
    token,
    kind: input.kind,
    status: 'pending',
    amountCents: input.amountCents,
    allowTip: input.allowTip ?? true,
    customerName: input.customerName ?? null,
    customerEmail: input.customerEmail ?? null,
    customerPhone: input.customerPhone ?? null,
    customerAddress: input.customerAddress ?? null,
    description: input.description ?? null,
    invoiceNumber: isInvoice ? input.invoiceNumber ?? null : null,
    dueDate: isInvoice ? input.dueDate ?? null : null,
    subtotalCents: isInvoice ? input.subtotalCents ?? null : null,
    taxCents: isInvoice ? input.taxCents ?? null : null,
    lineItems: isInvoice ? input.lineItems ?? null : null,
    createdDaysAgo: 0,
  })
  // Token-based id guarantees uniqueness across reloads (the seed sequence
  // resets each module load and would otherwise collide → duplicate React keys).
  const record: AppPaymentRecord = { ...built, id: `demo-created-${token}` }
  const created = loadCreated()
  created.unshift(record)
  saveCreated(created)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return { record, shareUrl: `${origin}/pay/${token}` }
}

export interface DemoPublicPayment {
  id: string
  token: string
  status: string
  kind: PaymentRequestKind
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
  lineItems?: PaymentLineItem[] | null
  paidAt?: string | null
  businessName: string
  businessEmail?: string | null
  businessPhone?: string | null
  businessAddress?: string | null
  businessLogo?: string | null
  isDemo: true
}

function toPublic(record: AppPaymentRecord): DemoPublicPayment {
  return {
    id: record.id,
    token: record.publicToken,
    status: record.status,
    kind: record.kind,
    amountCents: record.amountCents,
    subtotalCents: record.subtotalCents,
    taxCents: record.taxCents,
    tipCents: record.tipCents,
    allowTip: record.allowTip,
    currency: record.currency,
    customerName: record.customerName,
    customerEmail: record.customerEmail,
    customerPhone: record.customerPhone,
    customerAddress: record.customerAddress,
    description: record.description,
    invoiceNumber: record.invoiceNumber,
    dueDate: record.dueDate,
    lineItems: record.lineItems,
    paidAt: record.paidAt,
    businessName: DEMO_BUSINESS.name,
    businessEmail: DEMO_BUSINESS.email,
    businessPhone: DEMO_BUSINESS.phone,
    businessAddress: DEMO_BUSINESS.address,
    businessLogo: DEMO_BUSINESS.logo,
    isDemo: true,
  }
}

export function isDemoToken(token: string): boolean {
  return typeof token === 'string' && token.startsWith(DEMO_TOKEN_PREFIX)
}

/** Resolve a demo token (seed or just-created) to a public pay-page payload. */
export function getDemoPublicPayment(token: string): DemoPublicPayment | null {
  const record = getDemoFeed().find((p) => p.publicToken === token)
  return record ? toPublic(record) : null
}
