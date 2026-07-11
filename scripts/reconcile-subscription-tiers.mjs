/**
 * READ-ONLY subscription tier reconciliation.
 *
 *   node scripts/reconcile-subscription-tiers.mjs
 *   node scripts/reconcile-subscription-tiers.mjs gp6981@yahoo.com   # focus one user
 *
 * Compares what the app THINKS a user is on (dyia_users.subscription_tier)
 * against what Stripe is ACTUALLY billing (the price on the live subscription
 * item). Flags every mismatch. Writes nothing — safe to run against production.
 *
 * Needs (from .env.local, auto-loaded): NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, and the four price-id vars.
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// --- minimal .env.local loader (scripts don't get Next's dotenv) -------------
const __dirname = dirname(fileURLToPath(import.meta.url))
try {
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {
  // no .env.local — rely on the ambient environment
}

const focusEmail = process.argv[2]?.toLowerCase() || null

const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  STRIPE_SECRET_KEY,
  NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID: PRO_MONTHLY,
  NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID: PRO_ANNUAL,
  NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID: BASIC_MONTHLY,
  NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID: BASIC_ANNUAL,
} = process.env

for (const [k, v] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY })) {
  if (!v) { console.error(`Missing required env: ${k}`); process.exit(1) }
}

// The app's getStripe() rejects anything that isn't an API key. Mirror that
// here so we fail loudly instead of silently reporting "0 mismatches" when the
// key is actually a webhook signing secret (whsec_…) or otherwise invalid.
if (!STRIPE_SECRET_KEY.startsWith('sk_') && !STRIPE_SECRET_KEY.startsWith('rk_')) {
  console.error(
    `\nSTRIPE_SECRET_KEY is not a usable API key (starts with "${STRIPE_SECRET_KEY.slice(0, 6)}…").\n` +
    `It must start with sk_live_ / sk_test_ (or rk_). A whsec_… value is the webhook signing secret, not the API key.\n` +
    `Fix .env.local (or export STRIPE_SECRET_KEY) and re-run — reconciliation cannot verify Stripe without it.\n`
  )
  process.exit(1)
}

const stripe = new Stripe(STRIPE_SECRET_KEY)
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const money = (cents, cur) => cents == null ? 'n/a' : `${(cents / 100).toFixed(2)} ${(cur || 'usd').toUpperCase()}`
// Mirrors src/app/api/stripe/webhook/route.ts determineTierFromPriceId
const basicIds = [BASIC_MONTHLY, BASIC_ANNUAL].filter(Boolean)
const tierFromPrice = (priceId) => (priceId && basicIds.includes(priceId) ? 'basic' : 'pro')

async function priceLabel(priceId) {
  if (!priceId) return '(none)'
  try {
    const p = await stripe.prices.retrieve(priceId)
    return `${priceId} → ${money(p.unit_amount, p.currency)} / ${p.recurring?.interval || 'one-time'}`
  } catch (e) {
    return `${priceId} → NOT FOUND IN THIS STRIPE MODE (${e.code || e.message})`
  }
}

async function main() {
  console.log('\n=== 1. PRICE CONFIG SANITY ===')
  console.log('PRO monthly  ', await priceLabel(PRO_MONTHLY))
  console.log('PRO annual   ', await priceLabel(PRO_ANNUAL))
  console.log('BASIC monthly', await priceLabel(BASIC_MONTHLY))
  console.log('BASIC annual ', await priceLabel(BASIC_ANNUAL))
  const overlap = [BASIC_MONTHLY, BASIC_ANNUAL].filter((id) => id && (id === PRO_MONTHLY || id === PRO_ANNUAL))
  if (overlap.length) console.log('!! SMOKING GUN: a BASIC price id equals a PRO price id →', overlap.join(', '))
  if (!basicIds.length) console.log('!! Basic price ids are NOT configured — no real Basic plan exists in this env.')

  console.log('\n=== 2. USER ↔ STRIPE RECONCILIATION ===')
  let q = supabase
    .from('dyia_users')
    .select('id, email, subscription_status, subscription_tier, subscription_plan, stripe_subscription_id, stripe_customer_id, updated_at')
    .not('stripe_subscription_id', 'is', null)
  if (focusEmail) q = q.ilike('email', focusEmail)
  else q = q.in('subscription_status', ['active', 'trialing', 'past_due'])

  const { data: users, error } = await q
  if (error) { console.error('Supabase query failed:', error.message); process.exit(1) }
  if (!users?.length) { console.log('No matching subscribed users found.'); return }

  const mismatches = []
  const unverified = []
  for (const u of users) {
    let sub
    try {
      sub = await stripe.subscriptions.retrieve(u.stripe_subscription_id)
    } catch (e) {
      console.log(`⚠️  ${u.email}: DB tier=${u.subscription_tier} | Stripe sub ${u.stripe_subscription_id} NOT retrievable (${e.code || e.message})`)
      unverified.push({ email: u.email, subId: u.stripe_subscription_id, reason: e.code || e.message })
      continue
    }
    const item = sub.items?.data?.[0]
    const priceId = item?.price?.id
    const amount = money(item?.price?.unit_amount, item?.price?.currency)
    const interval = item?.price?.recurring?.interval || '—'
    const expectedTier = tierFromPrice(priceId)
    const mismatch = (u.subscription_tier || 'pro') !== expectedTier
    const line = `${mismatch ? '❌' : '✅'} ${u.email} | app=${u.subscription_tier}/${u.subscription_plan} | stripe=${amount}/${interval} (${expectedTier}) | status=${sub.status}`
    console.log(line)
    if (mismatch) mismatches.push({ email: u.email, userId: u.id, appTier: u.subscription_tier, stripeAmount: amount, priceId, subId: sub.id, customerId: u.stripe_customer_id })
  }

  console.log('\n=== 3. SUMMARY ===')
  const verified = users.length - unverified.length
  console.log(`${users.length} subscription(s): ${verified} verified, ${unverified.length} UNVERIFIED, ${mismatches.length} mismatch(es).`)
  if (mismatches.length) { console.log('\nMismatches:'); console.log(JSON.stringify(mismatches, null, 2)) }
  if (unverified.length) {
    console.log('\nUnverified (could NOT confirm against Stripe — do not treat as clean):')
    console.log(JSON.stringify(unverified, null, 2))
  }
  if (!mismatches.length && !unverified.length) console.log('\n✅ All checked subscriptions match their billed price.')
}

main().catch((e) => { console.error(e); process.exit(1) })
