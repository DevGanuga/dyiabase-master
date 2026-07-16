/**
 * READ-ONLY check of the "founders" discount against live Stripe.
 *   node scripts/check-founders-code.mjs
 * Verifies whether a `founders` promotion code exists/active, what discount it
 * carries, and whether STRIPE_FOUNDERS_COUPON_ID (auto-apply path) is configured.
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Stripe from 'stripe'

const __dirname = dirname(fileURLToPath(import.meta.url))
try {
  const raw = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {}

const key = process.env.STRIPE_SECRET_KEY
if (!key || (!key.startsWith('sk_') && !key.startsWith('rk_'))) {
  console.error('STRIPE_SECRET_KEY missing or not an API key.'); process.exit(1)
}
const stripe = new Stripe(key)
const fmt = (c) => !c ? '(no coupon)' : c.percent_off ? `${c.percent_off}% off` : c.amount_off ? `$${(c.amount_off / 100).toFixed(2)} off` : '?'

async function couponOf(p) {
  if (p.coupon && typeof p.coupon === 'object') return p.coupon
  try { return await stripe.coupons.retrieve(typeof p.coupon === 'string' ? p.coupon : p.id) } catch { return null }
}

async function main() {
  console.log(`Stripe account (key): ${key.slice(0, 14)}…\n`)

  console.log('=== Promotion code "founders" ===')
  const promos = await stripe.promotionCodes.list({ code: 'founders', limit: 10, expand: ['data.coupon'] })
  if (!promos.data.length) console.log('  none found with code "founders"')
  for (const p of promos.data) {
    const c = await couponOf(p)
    console.log(`  ${p.code} | active=${p.active} | ${fmt(c)} | duration=${c?.duration}${c?.duration_in_months ? ` (${c.duration_in_months}mo)` : ''} | coupon=${c?.id} | valid=${c?.valid}`)
  }

  console.log('\n=== STRIPE_FOUNDERS_COUPON_ID (auto ?founders=1 path) ===')
  const fid = process.env.STRIPE_FOUNDERS_COUPON_ID
  if (!fid) {
    console.log('  NOT SET → the ?founders=1 auto-apply path applies NO discount.')
  } else {
    try {
      const c = await stripe.coupons.retrieve(fid)
      console.log(`  ${c.id} | ${fmt(c)} | valid=${c.valid} | duration=${c.duration}`)
    } catch (e) {
      console.log(`  ${fid} → NOT FOUND in this account (${e.code || e.message})`)
    }
  }

  console.log('\n=== All active promotion codes (context) ===')
  const all = await stripe.promotionCodes.list({ active: true, limit: 20, expand: ['data.coupon'] })
  if (!all.data.length) console.log('  (none active)')
  for (const p of all.data) { const c = await couponOf(p); console.log(`  ${p.code} → ${fmt(c)} (coupon ${c?.id})`) }
}
main().catch((e) => { console.error(e); process.exit(1) })
