import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/stripe'
import { getErrorMessage } from '@/lib/errors'
import type { AppPaymentRecord, PaymentLineItem } from '@/types/database'

/**
 * Merchant payments feed (service-role, server-side).
 *
 * The Payments hub previously read `dyia_payments` directly with the browser
 * Supabase client, which is subject to the table's RLS policy. That policy
 * compares `auth.uid()` (the Clerk subject) to `user_id` (a dyia_users UUID),
 * so it never matches and the activity feed + stat cards rendered EMPTY even
 * when payments existed. We load the feed here with the service-role key,
 * scoped explicitly to the authenticated merchant, so the hub always reflects
 * reality. Returns AppPaymentRecord-shaped rows the client can use directly.
 */
export async function GET() {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()

    const { data: user, error: userErr } = await supabase
      .from('dyia_users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (userErr || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('dyia_payments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('payments/list: query failed', error)
      return NextResponse.json({ error: 'Could not load payments' }, { status: 500 })
    }

    const payments: AppPaymentRecord[] = (data || []).map((payment) => ({
      id: payment.id,
      quoteId: payment.quote_id,
      jobId: payment.job_id,
      publicToken: payment.public_token,
      status: payment.status,
      kind: payment.kind || (payment.quote_id ? 'quote_payment' : payment.job_id ? 'job_payment' : 'payment_link'),
      amountCents: payment.amount_cents,
      subtotalCents: payment.subtotal_cents,
      taxCents: payment.tax_cents,
      tipCents: payment.tip_cents ?? 0,
      allowTip: payment.allow_tip ?? false,
      applicationFeeAmountCents: payment.application_fee_amount_cents,
      destinationAmountCents: payment.destination_amount_cents,
      currency: payment.currency,
      customerName: payment.customer_name,
      customerEmail: payment.customer_email,
      customerPhone: payment.customer_phone,
      customerAddress: payment.customer_address,
      description: payment.description,
      invoiceNumber: payment.invoice_number,
      dueDate: payment.due_date,
      lineItems: payment.line_items as PaymentLineItem[] | null,
      checkoutUrl: payment.checkout_url,
      paidAt: payment.paid_at,
      refundedAt: payment.refunded_at,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at,
    }))

    return NextResponse.json({ payments })
  } catch (error) {
    console.error('payments/list error:', error)
    return NextResponse.json(
      { error: getErrorMessage(error, 'Could not load payments') },
      { status: 500 }
    )
  }
}
