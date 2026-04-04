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
      .select('business_name, business_email, business_phone')
      .eq('user_id', payment.user_id)
      .single()

    return NextResponse.json({
      id: payment.id,
      token: payment.public_token,
      status: payment.status,
      amountCents: payment.amount_cents,
      currency: payment.currency,
      customerName: payment.customer_name,
      customerEmail: payment.customer_email,
      description: payment.description,
      paidAt: payment.paid_at,
      checkoutUrl: payment.checkout_url,
      businessName: settings?.business_name || 'Dyia Business',
      businessEmail: settings?.business_email || null,
      businessPhone: settings?.business_phone || null,
    })
  } catch (error) {
    console.error('Public payment fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
