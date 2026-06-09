/**
 * Seed a batch of test jobs (with customers + coordinates) for Dyia Maps.
 *
 * Idempotent: clears any previously-seeded rows (matched by the distinctive
 * customer names below) for the target user before re-inserting, so you can
 * run it repeatedly. Scoped to a single user_id — touches nobody else's data.
 *
 *   node scripts/seed-maps-jobs.mjs [email]
 *
 * Reads Supabase creds from .env.local. Requires migration 043 (latitude/
 * longitude columns) to be applied to the target database.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// --- Load .env.local (no dotenv dependency) ---------------------------------
function loadEnv() {
  const env = {}
  try {
    const raw = readFileSync(join(ROOT, '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2]
    }
  } catch {
    // fall through to process.env
  }
  return { ...env, ...process.env }
}

const env = loadEnv()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const EMAIL = process.argv[2] || 'dev.ganuga@initdev.co'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

// --- Date helpers ------------------------------------------------------------
function dateInput(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// --- Seed data: clustered around Austin, TX so the map auto-fits nicely ------
// Mix of statuses/kinds/dates exercises every Maps feature.
const SEED = [
  // TODAY — scheduled jobs + estimates (these pulse on the map)
  { name: 'Whitaker Garage Co', phone: '(512) 555-0142', source: 'Google', status: 'scheduled', kind: 'job', window: '8:00-10:00am', revenue: 525, address: '1100 S Congress Ave, Austin, TX 78704', lat: 30.2515, lng: -97.7494, notes: 'Two-car garage cleanout, lots of furniture' },
  { name: 'Brookside Estate', phone: '(512) 555-0188', source: 'Referral', status: 'scheduled', kind: 'estimate', window: '10:30-11:30am', estLow: 600, estHigh: 850, address: '2200 Guadalupe St, Austin, TX 78705', lat: 30.2849, lng: -97.7414, notes: 'Estate cleanout estimate — walk the property' },
  { name: 'Nguyen Residence', phone: '(512) 555-0173', source: 'Yelp', status: 'scheduled', kind: 'job', window: '1:00-3:00pm', revenue: 380, address: '4500 Manor Rd, Austin, TX 78723', lat: 30.2906, lng: -97.6986, notes: 'Backyard shed demo + haul' },
  { name: 'Cedar Park Free Estimate', phone: '(512) 555-0120', source: 'Website', status: 'scheduled', kind: 'free_estimate', window: '4:00-5:00pm', estLow: 0, estHigh: 0, address: '600 W 6th St, Austin, TX 78701', lat: 30.2701, lng: -97.7503, notes: 'Free estimate — office furniture' },

  // LATER THIS WEEK — scheduled (Pro week range)
  { name: 'Lakeline Storage Units', phone: '(512) 555-0199', source: 'Google', status: 'scheduled', kind: 'job', window: '9:00-11:00am', revenue: 720, address: '11200 Lakeline Mall Dr, Austin, TX 78717', lat: 30.4699, lng: -97.8052, dayOffset: 2, notes: 'Abandoned unit cleanout x3' },
  { name: 'Riverside Apartments', phone: '(512) 555-0155', source: 'Repeat Customer', status: 'scheduled', kind: 'job', window: '12:00-2:00pm', revenue: 460, address: '1800 E Riverside Dr, Austin, TX 78741', lat: 30.2389, lng: -97.7269, dayOffset: 3, notes: 'Move-out debris, building C' },
  { name: 'Mueller District HOA', phone: '(512) 555-0166', source: 'Referral', status: 'scheduled', kind: 'estimate', window: '3:00-4:00pm', estLow: 1200, estHigh: 1600, address: '4550 Mueller Blvd, Austin, TX 78723', lat: 30.2986, lng: -97.7053, dayOffset: 4, notes: 'Community bulk pickup estimate' },

  // COMPLETED (green pins) — clustered downtown to show clustering
  { name: 'Downtown Loft 5B', phone: '(512) 555-0101', source: 'Website', status: 'completed', kind: 'job', revenue: 410, address: '400 Congress Ave, Austin, TX 78701', lat: 30.2669, lng: -97.7428, dayOffset: -2, labor: 90, gas: 25, dumpFee: 60, notes: 'Apartment cleanout' },
  { name: '2nd Street Bistro', phone: '(512) 555-0109', source: 'Referral', status: 'completed', kind: 'job', revenue: 980, address: '500 W 2nd St, Austin, TX 78701', lat: 30.2658, lng: -97.7490, dayOffset: -3, labor: 200, gas: 40, dumpFee: 150, dumpsterRental: 175, notes: 'Restaurant equipment removal' },
  { name: 'Warehouse 7 Logistics', phone: '(512) 555-0117', source: 'Google', status: 'completed', kind: 'job', revenue: 1350, address: '4400 S 1st St, Austin, TX 78745', lat: 30.2155, lng: -97.7700, dayOffset: -5, labor: 280, gas: 55, dumpFee: 220, dumpsterRental: 200, additional: 60, notes: 'Pallet + scrap clearout' },

  // CANCELLED (gray pin)
  { name: 'Hillside Cancelled Job', phone: '(512) 555-0133', source: 'Yelp', status: 'cancelled', kind: 'job', revenue: 0, address: '3800 N Lamar Blvd, Austin, TX 78756', lat: 30.3072, lng: -97.7390, dayOffset: -1, notes: 'Customer rescheduled to next month' },
]

const SEED_NAMES = SEED.map((s) => s.name)

async function main() {
  console.log(`\nSeeding Maps test data for ${EMAIL} ...`)

  // 1. Resolve the user. The same email can have multiple rows (one per Clerk
  // instance, e.g. prod + dev). Disambiguate via optional 2nd arg: a dyia user
  // id or clerk_user_id.
  const { data: users, error: userErr } = await supabase
    .from('dyia_users')
    .select('id, email, clerk_user_id')
    .eq('email', EMAIL)

  if (userErr) throw userErr
  if (!users || users.length === 0) {
    console.error(`\n✗ No dyia_users row for ${EMAIL}. Sign in to the app once (so the user is provisioned), then re-run.`)
    process.exit(1)
  }

  const selector = process.argv[3]
  let user
  if (users.length === 1) {
    user = users[0]
  } else if (selector) {
    user = users.find((u) => u.id === selector || u.clerk_user_id === selector)
    if (!user) {
      console.error(`\n✗ No row for ${EMAIL} matches "${selector}".`)
      process.exit(1)
    }
  } else {
    console.error(`\n✗ ${users.length} dyia_users rows share ${EMAIL} (one per Clerk instance). Re-run with the user id or clerk_user_id as a 2nd argument:`)
    for (const u of users) console.error(`    node scripts/seed-maps-jobs.mjs ${EMAIL} ${u.id}   # clerk: ${u.clerk_user_id}`)
    process.exit(1)
  }

  const userId = user.id
  console.log(`✓ Found user ${userId} (clerk: ${user.clerk_user_id})`)

  // 2. Verify migration 043 columns exist
  const probe = await supabase.from('dyia_jobs').select('latitude').limit(1)
  if (probe.error && /latitude/.test(probe.error.message)) {
    console.error('\n✗ The latitude/longitude columns are missing. Run claudedocs/maps-release/APPLY_maps_migration.sql in Supabase, then re-run this script.')
    process.exit(1)
  }

  // 3. Idempotent cleanup of prior seed rows
  await supabase.from('dyia_jobs').delete().eq('user_id', userId).in('customer_name', SEED_NAMES)
  await supabase.from('dyia_customers').delete().eq('user_id', userId).in('name', SEED_NAMES)
  console.log('✓ Cleared any previous seed rows')

  // 4. Insert customers (for phone lookup / "Call customer")
  const customerRows = SEED.map((s) => ({
    user_id: userId,
    name: s.name,
    phone: s.phone,
    address: s.address,
    tags: ['maps-test'],
  }))
  const { data: customers, error: custErr } = await supabase
    .from('dyia_customers')
    .insert(customerRows)
    .select('id, name')
  if (custErr) throw custErr
  const customerIdByName = new Map(customers.map((c) => [c.name, c.id]))
  console.log(`✓ Inserted ${customers.length} customers`)

  // 5. Insert jobs
  const jobRows = SEED.map((s) => ({
    user_id: userId,
    customer_id: customerIdByName.get(s.name) ?? null,
    date: dateInput(s.dayOffset ?? 0),
    customer_name: s.name,
    source: s.source ?? null,
    revenue: s.revenue ?? 0,
    estimate_low: s.estLow ?? null,
    estimate_high: s.estHigh ?? null,
    appointment_window_text: s.window ?? null,
    scheduled_kind: s.kind ?? 'job',
    status: s.status,
    labor: s.labor ?? 0,
    gas: s.gas ?? 0,
    dump_fee: s.dumpFee ?? 0,
    dumpster_rental: s.dumpsterRental ?? 0,
    additional_expense: s.additional ?? 0,
    num_workers: 2,
    cost_per_worker: 40,
    notes: s.notes ?? null,
    address: s.address,
    latitude: s.lat,
    longitude: s.lng,
  }))
  const { data: jobs, error: jobErr } = await supabase
    .from('dyia_jobs')
    .insert(jobRows)
    .select('id')
  if (jobErr) throw jobErr

  console.log(`✓ Inserted ${jobs.length} jobs`)
  console.log('\nDone. Open the app on your admin account → Maps tab.')
  console.log('Breakdown: 4 today (pulse), 3 later this week, 3 completed, 1 cancelled.\n')
}

main().catch((err) => {
  console.error('\n✗ Seed failed:', err.message || err)
  process.exit(1)
})
