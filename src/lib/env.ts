/**
 * Environment variable validation.
 * Import this in server-side code to fail fast if required vars are missing.
 */

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
] as const

const OPTIONAL_ENV_VARS = [
  'CLERK_WEBHOOK_SECRET',
  'OPENAI_API_KEY',
  'RESEND_API_KEY',
  'DEMO_PASSWORD',
  'CRON_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID',
  'NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID',
  'NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID',
  'NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID',
  'NEXT_PUBLIC_SENTRY_DSN',
] as const

let validated = false

export function validateEnv(): void {
  if (validated) return
  validated = true

  const missing: string[] = []
  const warnings: string[] = []

  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  for (const key of OPTIONAL_ENV_VARS) {
    if (!process.env[key]) {
      warnings.push(key)
    }
  }

  if (missing.length > 0) {
    console.error(
      `\n[ENV] MISSING REQUIRED ENVIRONMENT VARIABLES:\n` +
      missing.map(k => `  - ${k}`).join('\n') +
      `\n\nAdd these to .env.local and restart the server.\n`
    )
    // In production, throw to prevent startup with missing vars
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
    }
  }

  if (warnings.length > 0) {
    console.warn(
      `[ENV] Optional environment variables not set: ${warnings.join(', ')}`
    )
  }

  // Stripe mode detection
  if (process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
    console.log('[ENV] Stripe is running in TEST mode')
  } else if (process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')) {
    console.log('[ENV] Stripe is running in LIVE mode')
  }
}
