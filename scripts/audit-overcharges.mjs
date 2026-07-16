/**
 * READ-ONLY overcharge audit for the Basic-billed-as-Pro incident.
 *
 *   node scripts/audit-overcharges.mjs            # assumes Basic = $19.99
 *   node scripts/audit-overcharges.mjs 9.99       # assume a different Basic price
 *
 * For every user tagged `basic` in the app but billed the Pro price in Stripe,
 * it pulls their real paid charges, counts the $29.99 months, subtracts anything
 * already refunded, and reports the remaining refund owed. Writes nothing.
 *
 * Reads .env.local (auto). Needs a real STRIPE_SECRET_KEY (sk_/rk_).
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
try {
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch { /* rely on ambient env */ }

const PRO_CENTS = 2999
const basicDollars = Number(process.argv[2] || 19.99)
const BASIC_CENTS = Math.round(basicDollars * 100)
const PER_MONTH_OVERCHARGE = PRO_CENTS - BASIC_CENTS

const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  STRIPE_SECRET_KEY,
  NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID: BASIC_MONTHLY,
  NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID: BASIC_ANNUAL,
} = process.env

for (const [k, v] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY })) {
  if (!v) { console.error(`Missing required env: ${k}`); process.exit(1) }
}
if (!STRIPE_SECRET_KEY.startsWith('sk_') && !STRIPE_SECRET_KEY.startsWith('rk_')) {
  console.error(`STRIPE_SECRET_KEY is not an API key (starts with "${STRIPE_SECRET_KEY.slice(0, 6)}…"). Cannot audit.`)
  process.exit(1)
}

const stripe = new Stripe(STRIPE_SECRET_KEY)
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const basicIds = [BASIC_MONTHLY, BASIC_ANNUAL].filter(Boolean)
const usd = (c) => `$${(c / 100).toFixed(2)}`

async function main() {
  console.log(`\nAssuming intended Basic price = ${usd(BASIC_CENTS)}/mo → overcharge ${usd(PER_MONTH_OVERCHARGE)}/paid month.\n`)

  const { data: users, error } = await supabase
    .from('dyia_users')
    .select('id, email, subscription_tier, subscription_plan, stripe_subscription_id, stripe_customer_id')
    .eq('subscription_tier', 'basic')
    .not('stripe_customer_id', 'is', null)
  if (error) { console.error('Supabase query failed:', error.message); process.exit(1) }

  const rows = []
  const skipped = []
  let totalOwed = 0

  for (const u of users || []) {
    // Confirm this user is actually billed the Pro price (not a real Basic sub).
    let onProPrice = true
    try {
      if (u.stripe_subscription_id) {
        const sub = await stripe.subscriptions.retrieve(u.stripe_subscription_id)
        const priceId = sub.items?.data?.[0]?.price?.id
        onProPrice = !(priceId && basicIds.includes(priceId))
      }
    } catch { /* fall through; still audit charges */ }
    if (!onProPrice) continue

    // Pull real paid charges for this customer. Some `basic`-tagged rows carry a
    // customer id from the OTHER Stripe account (resource_missing here) — skip
    // those loudly instead of aborting the whole audit.
    let charges
    try {
      charges = await stripe.charges.list({ customer: u.stripe_customer_id, limit: 100 })
    } catch (e) {
      skipped.push({ email: u.email, customerId: u.stripe_customer_id, reason: e.code || e.message })
      continue
    }
    const proCharges = charges.data.filter((c) => c.paid && c.amount === PRO_CENTS)
    const monthsBilled = proCharges.length
    const alreadyRefunded = charges.data.reduce((sum, c) => sum + (c.amount_refunded || 0), 0)
    // Only customers who actually paid at least one $29.99 charge are overcharged.
    if (monthsBilled === 0 && alreadyRefunded === 0) continue
    const grossOvercharge = monthsBilled * PER_MONTH_OVERCHARGE
    const stillOwed = Math.max(0, grossOvercharge - alreadyRefunded)
    totalOwed += stillOwed

    rows.push({
      email: u.email,
      monthsBilledAt2999: monthsBilled,
      grossOvercharge: usd(grossOvercharge),
      alreadyRefunded: usd(alreadyRefunded),
      stillOwed: usd(stillOwed),
      customerId: u.stripe_customer_id,
      subId: u.stripe_subscription_id,
    })
  }

  rows.sort((a, b) => b.monthsBilledAt2999 - a.monthsBilledAt2999)
  console.log('=== OVERCHARGE AUDIT (Basic tier, Pro price) ===')
  for (const r of rows) {
    console.log(
      `${r.email}\n` +
      `   months billed @ $29.99: ${r.monthsBilledAt2999} | gross overcharge: ${r.grossOvercharge} | already refunded: ${r.alreadyRefunded} | STILL OWED: ${r.stillOwed}`
    )
  }
  console.log(`\nAffected customers: ${rows.length}`)
  console.log(`TOTAL still owed (at Basic ${usd(BASIC_CENTS)}): ${usd(totalOwed)}`)
  if (skipped.length) {
    console.log(`\n${skipped.length} basic-tagged user(s) SKIPPED (customer not in this Stripe account — verify by hand):`)
    console.log(JSON.stringify(skipped, null, 2))
  }
  console.log('\nJSON:\n' + JSON.stringify(rows, null, 2))
  console.log('\nNote: counts $29.99 paid charges only; verify annual/coupon/founders cases by hand.')
}

main().catch((e) => { console.error(e); process.exit(1) })
