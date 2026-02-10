/**
 * Seed admin users script.
 *
 * Usage:
 *   node scripts/seed-admin-users.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * This script elevates the specified emails to superadmin with active subscriptions.
 * Safe to run multiple times (idempotent).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Load .env.local manually
const envFile = readFileSync('.env.local', 'utf-8')
const env = {}
for (const line of envFile.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1)
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const ADMIN_EMAILS = [
  'devganuga@initdev.co',
  'ricardo.bezi@initdev.co',
  'marco.aayala97@yahoo.com',
]

async function main() {
  console.log('Seeding admin users...\n')

  for (const email of ADMIN_EMAILS) {
    // Check if user exists
    const { data: existing } = await supabase
      .from('dyia_users')
      .select('id, email, is_admin, role, subscription_status')
      .eq('email', email)
      .single()

    if (existing) {
      // Update to admin
      const { error } = await supabase
        .from('dyia_users')
        .update({
          is_admin: true,
          role: 'superadmin',
          subscription_status: 'active',
        })
        .eq('email', email)

      if (error) {
        console.error(`  Failed to update ${email}:`, error.message)
      } else {
        console.log(`  Updated ${email} -> superadmin (active)`)
      }
    } else {
      console.log(`  ${email} not yet in database (will be created on first sign-up via Clerk webhook)`)
      console.log(`    -> Run this script again after they sign up, or the migration handles it automatically.`)
    }
  }

  console.log('\nDone.')
}

main().catch(console.error)
