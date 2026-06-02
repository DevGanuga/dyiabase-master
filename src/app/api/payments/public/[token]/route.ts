import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/stripe'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const supabase = getSupabaseAdmin()

    const { data: payment, error } = await supabase
      .from('dyia_payments')
      .select('*')
      .eq('public_token', token)
      .single()

    if (error || !payment) {
      return NextResponse.json({ error: 'Payment link not found' }, { status: 404 })
    }

    const { data: settings } = await supabase
      .from('dyia_settings')
      .select('business_name, business_email, business_phone, business_address, business_logo')
      .eq('user_id', payment.user_id)
      .single()

    return NextResponse.json({
      id: payment.id,
      token: payment.public_token,
      status: payment.status,
      kind: payment.kind || 'payment_link',
      amountCents: payment.amount_cents,
      subtotalCents: payment.subtotal_cents,
      taxCents: payment.tax_cents,
      tipCents: payment.tip_cents ?? 0,
      allowTip: payment.allow_tip ?? false,
      currency: payment.currency,
      customerName: payment.customer_name,
      customerEmail: payment.customer_email,
      customerPhone: payment.customer_phone,
      customerAddress: payment.customer_address,
      description: payment.description,
      invoiceNumber: payment.invoice_number,
      dueDate: payment.due_date,
      lineItems: payment.line_items,
      paidAt: payment.paid_at,
      checkoutUrl: payment.checkout_url,
      businessName: settings?.business_name || 'Dyia Business',
      businessEmail: settings?.business_email || null,
      businessPhone: settings?.business_phone || null,
      businessAddress: settings?.business_address || null,
      businessLogo: settings?.business_logo || null,
    })
  } catch (error) {
    // Customer-facing page: keep the message generic, log the real cause.
    console.error('Public payment fetch error:', error)
    return NextResponse.json(
      { error: 'Could not load payment details. Please try again.' },
      { status: 500 }
    )
  }
}
