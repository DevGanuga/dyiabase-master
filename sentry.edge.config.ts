import * as Sentry from '@sentry/nextjs'

// Only initialize Sentry in production when DSN is configured
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Performance Monitoring: capture 10% of transactions in production
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Don't send events in development
    enabled: process.env.NODE_ENV === 'production',
  })
}
