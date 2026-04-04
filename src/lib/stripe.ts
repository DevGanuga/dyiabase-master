import { randomBytes } from 'crypto'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getBaseUrl } from '@/lib/env'

export const STRIPE_PLATFORM_FEE_BPS = 75

export type ResourcePaymentStatus =
  | 'not_requested'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'refunded'

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }

  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

export function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not set')
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export function getConnectCountry() {
  return process.env.STRIPE_CONNECT_COUNTRY || 'US'
}

export function calculateApplicationFee(amountCents: number) {
  return Math.max(0, Math.round(amountCents * (STRIPE_PLATFORM_FEE_BPS / 10_000)))
}

export function generatePublicPaymentToken() {
  return randomBytes(24).toString('base64url')
}

export function getPaymentsAppUrl() {
  return `${getBaseUrl()}/app?view=payments`
}

export async function syncConnectAccountState(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  account: Stripe.Account
) {
  const detailsSubmitted = Boolean(account.details_submitted)
  const chargesEnabled = Boolean(account.charges_enabled)
  const payoutsEnabled = Boolean(account.payouts_enabled)
  const onboardingComplete = detailsSubmitted && chargesEnabled

  await supabase
    .from('dyia_users')
    .update({
      stripe_connect_account_id: account.id,
      stripe_connect_onboarding_complete: onboardingComplete,
      stripe_connect_details_submitted: detailsSubmitted,
      stripe_connect_charges_enabled: chargesEnabled,
      stripe_connect_payouts_enabled: payoutsEnabled,
      stripe_connect_country: account.country || null,
      stripe_connect_default_currency: account.default_currency || null,
    })
    .eq('id', userId)

  return {
    stripeConnectAccountId: account.id,
    onboardingComplete,
    detailsSubmitted,
    chargesEnabled,
    payoutsEnabled,
    country: account.country || null,
    defaultCurrency: account.default_currency || null,
  }
}

export async function updateResourcePaymentStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  payment: {
    id: string
    quote_id?: string | null
    job_id?: string | null
    amount_cents: number
  },
  status: ResourcePaymentStatus,
  paidAt?: string | null
) {
  const update = {
    payment_status: status,
    payment_amount_cents: payment.amount_cents,
    payment_last_request_id: payment.id,
    payment_paid_at: paidAt ?? null,
  }

  if (payment.quote_id) {
    await supabase
      .from('dyia_quotes')
      .update(update)
      .eq('id', payment.quote_id)
  }

  if (payment.job_id) {
    await supabase
      .from('dyia_jobs')
      .update(update)
      .eq('id', payment.job_id)
  }
}
