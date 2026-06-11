/**
 * Reset QA accounts' billing state (QA Test Report Round 5).
 *
 * QA branch environments ran with test-mode Stripe keys while writing to the
 * shared database, leaving `stripe_customer_id`/`stripe_subscription_id`
 * pointers at test-mode objects that the live key can't see ("No such
 * customer … exists in test mode"). This resets the affected accounts to a
 * clean never-subscribed state so billing flows can be re-tested end to end.
 *
 *   node scripts/reset-qa-billing.mjs            # dry run (prints what would change)
 *   node scripts/reset-qa-billing.mjs --apply    # actually writes
 *
 * Scope is locked to emails starting with EMAIL_PREFIX below.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const EMAIL_PREFIX = 'maliarchuk.ann'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

function loadEnv() {
  const env = {}
  try {
    const raw = readFileSync(join(ROOT, '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2]
    }
  } catch { /* fall through to process.env */ }
  return { ...env, ...process.env }
}

const env = loadEnv()
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase env')
  process.exit(1)
}

const APPLY = process.argv.includes('--apply')
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const RESET = {
  stripe_customer_id: null,
  stripe_subscription_id: null,
  subscription_status: 'inactive',
  subscription_tier: null,
  subscription_plan: null,
  subscription_ends_at: null,
  cancel_at_period_end: false,
  payment_failed_at: null,
  trial_consumed_at: null, // allow QA to exercise the trial flow again
}

const { data: accounts, error } = await supabase
  .from('dyia_users')
  .select('id, email, stripe_customer_id, stripe_subscription_id, subscription_tier, subscription_status, subscription_plan')
  .ilike('email', `${EMAIL_PREFIX}%`)

if (error) {
  console.error('Query failed:', error.message)
  process.exit(1)
}
if (!accounts?.length) {
  console.log(`No accounts match ${EMAIL_PREFIX}%`)
  process.exit(0)
}

console.log(`${APPLY ? 'RESETTING' : 'DRY RUN —'} ${accounts.length} QA account(s):\n`)
for (const a of accounts) {
  console.log(`  ${a.email}`)
  console.log(`    customer: ${a.stripe_customer_id ?? '—'}  sub: ${a.stripe_subscription_id ?? '—'}  tier: ${a.subscription_tier ?? '—'}/${a.subscription_status ?? '—'}/${a.subscription_plan ?? '—'}`)
}

if (!APPLY) {
  console.log('\nDry run only. Re-run with --apply to reset these accounts.')
  process.exit(0)
}

const { error: updateErr } = await supabase
  .from('dyia_users')
  .update(RESET)
  .ilike('email', `${EMAIL_PREFIX}%`)

if (updateErr) {
  console.error('\nUpdate failed:', updateErr.message)
  process.exit(1)
}
console.log(`\n✓ Reset ${accounts.length} account(s) to a clean never-subscribed state.`)
