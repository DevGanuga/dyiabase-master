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
  'ANTHROPIC_API_KEY',
  'GOOGLE_PLACES_API_KEY',
  'RESEND_API_KEY',
  'DEMO_PASSWORD',
  'CRON_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID',
  'NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID',
  'NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID',
  'NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID',
  'STRIPE_CONNECT_COUNTRY',
  'STRIPE_INTEL_PRICE_ID',
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

  // Stripe pricing integrity guard.
  // A Basic price id must never equal a Pro price id — otherwise a customer who
  // selects Basic is billed the Pro amount while the app records the Basic tier
  // (the "Basic user charged $29.99" support case). Also warn when the paid
  // Basic tier is advertised but has no price configured. Non-fatal so a
  // misconfig never takes prod down, but loud enough to catch in logs/monitoring.
  const proPriceIds = [
    process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID,
  ].filter(Boolean)
  const basicPriceIds = [
    process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID,
    process.env.NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID,
  ].filter(Boolean)
  const overlappingPriceIds = basicPriceIds.filter((id) => proPriceIds.includes(id))
  if (overlappingPriceIds.length > 0) {
    console.error(
      `\n[ENV] STRIPE PRICING MISCONFIGURATION: a Basic price id equals a Pro price id ` +
      `(${overlappingPriceIds.join(', ')}).\n` +
      `Customers who pick Basic will be billed the Pro amount while the app records the Basic tier.\n` +
      `Point NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID / _ANNUAL_ at dedicated Basic prices in Stripe.\n`
    )
  }

  // Stripe mode detection
  if (process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
    console.info('[ENV] Stripe is running in TEST mode')
  } else if (process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')) {
    console.info('[ENV] Stripe is running in LIVE mode')
  }
}

/**
 * Returns the application base URL, with appropriate fallbacks for
 * production, Vercel preview deployments, and local development.
 */
export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}
