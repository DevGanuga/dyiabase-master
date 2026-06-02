import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getBaseUrl } from '@/lib/env'
import { getErrorMessage } from '@/lib/errors'
import {
  calculateApplicationFee,
  generatePublicPaymentToken,
  getSupabaseAdmin,
} from '@/lib/stripe'
import {
  MAX_PAYMENT_AMOUNT_CENTS,
  computeTaxCents,
  normalizeLineItems,
  sanitizePaymentString,
  type NormalizedLineItem,
} from '@/lib/payments'

interface LineItemInput {
  description?: unknown
  quantity?: unknown
  unitAmountCents?: unknown
}

interface CustomPaymentRequestBody {
  kind?: 'payment_link' | 'invoice'
  description?: string
  amountCents?: number
  allowTip?: boolean
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  customerAddress?: string
  invoiceNumber?: string
  dueDate?: string | null
  taxPercentage?: number
  lineItems?: LineItemInput[]
}

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()
    const body = (await request.json().catch(() => ({}))) as CustomPaymentRequestBody

    const kind: 'payment_link' | 'invoice' = body.kind === 'invoice' ? 'invoice' : 'payment_link'

    const { data: user, error: userError } = await supabase
      .from('dyia_users')
      .select('*')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.stripe_connect_account_id) {
      return NextResponse.json(
        { error: 'Stripe is not yet connected. Open Payments and click "Connect Stripe" to finish onboarding.' },
        { status: 400 }
      )
    }
    if (!user.stripe_connect_charges_enabled) {
      return NextResponse.json(
        { error: 'Stripe onboarding is incomplete — charges are not yet enabled. Finish required steps in your Stripe dashboard.' },
        { status: 400 }
      )
    }

    // ── Resolve amount ────────────────────────────────────────────────────
    // Invoices ALWAYS come from line items so the customer-facing invoice
    // mirrors the merchant's intent. Pay links accept a single amount. All
    // money math is delegated to the shared, unit-tested @/lib/payments helpers
    // so the server-stored amount can never drift from the client preview.
    let amountCents = 0
    let subtotalCents: number | null = null
    let taxCents: number | null = null
    let lineItems: NormalizedLineItem[] | null = null

    if (kind === 'invoice') {
      const normalized = normalizeLineItems(body.lineItems)
      if (!normalized) {
        return NextResponse.json({ error: 'Add at least one line item to send an invoice.' }, { status: 400 })
      }
      lineItems = normalized.items
      subtotalCents = normalized.subtotalCents
      taxCents = computeTaxCents(subtotalCents, Number(body.taxPercentage))
      amountCents = subtotalCents + taxCents
    } else {
      amountCents = Math.round(Number(body.amountCents))
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        return NextResponse.json({ error: 'Enter an amount greater than $0.' }, { status: 400 })
      }
    }

    if (amountCents <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than $0.' }, { status: 400 })
    }
    if (amountCents > MAX_PAYMENT_AMOUNT_CENTS) {
      return NextResponse.json(
        { error: 'Amount exceeds the $50,000 single-payment limit. Split into multiple invoices or contact support.' },
        { status: 400 }
      )
    }

    const applicationFeeAmountCents = calculateApplicationFee(amountCents)
    const destinationAmountCents = Math.max(0, amountCents - applicationFeeAmountCents)
    const currency = (user.stripe_connect_default_currency || 'usd').toLowerCase()
    const publicToken = generatePublicPaymentToken()

    const customerName = sanitizePaymentString(body.customerName)
    const customerEmail = sanitizePaymentString(body.customerEmail, 320)
    const customerPhone = sanitizePaymentString(body.customerPhone, 40)
    const customerAddress = sanitizePaymentString(body.customerAddress, 500)
    const invoiceNumber = sanitizePaymentString(body.invoiceNumber, 64)
    const dueDate = sanitizePaymentString(body.dueDate, 32)
    const fallbackDescription =
      kind === 'invoice'
        ? `Invoice${invoiceNumber ? ` #${invoiceNumber}` : ''}${customerName ? ` for ${customerName}` : ''}`
        : `Payment request${customerName ? ` for ${customerName}` : ''}`
    const description = sanitizePaymentString(body.description, 500) || fallbackDescription

    const { data: payment, error: paymentError } = await supabase
      .from('dyia_payments')
      .insert({
        user_id: user.id,
        public_token: publicToken,
        stripe_connected_account_id: user.stripe_connect_account_id,
        kind,
        status: 'pending',
        amount_cents: amountCents,
        subtotal_cents: subtotalCents,
        tax_cents: taxCents,
        allow_tip: body.allowTip !== false,
        application_fee_amount_cents: applicationFeeAmountCents,
        destination_amount_cents: destinationAmountCents,
        currency,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        invoice_number: invoiceNumber,
        due_date: dueDate,
        line_items: lineItems,
        description,
        metadata: {
          resource_type: kind,
          source: 'custom_request',
        },
      })
      .select('id, public_token')
      .single()

    if (paymentError || !payment) {
      // Surface invoice_number uniqueness violation cleanly.
      if (paymentError && /uq_dyia_payments_user_invoice_number/.test(paymentError.message || '')) {
        return NextResponse.json(
          { error: 'Invoice number is already in use. Pick a different number.' },
          { status: 409 }
        )
      }
      throw paymentError || new Error('Could not create payment request')
    }

    const shareUrl = `${getBaseUrl()}/pay/${publicToken}`
    return NextResponse.json({
      shareUrl,
      paymentId: payment.id,
      publicToken: payment.public_token,
      amountCents,
      kind,
    })
  } catch (error) {
    console.error('Custom payment request error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Could not create payment request') },
      { status: 500 }
    )
  }
}
