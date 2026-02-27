import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { validateEnv } from '@/lib/env'

// Validate environment variables on first server-side render
validateEnv()

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your dyia dashboard – jobs, quotes, and business at a glance.',
  robots: { index: false, follow: false },
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Auth is enforced by middleware (middleware.ts) via auth.protect() which properly
  // handles post-signup session establishment. No duplicate auth check here —
  // a second auth() call can race and redirect before the session is ready.

  // Demo mode is also handled by middleware, but we still read the cookie
  // so client components can detect demo state if needed.
  const cookieStore = await cookies()
  void cookieStore.get('dyia_demo_access')

  return <ErrorBoundary>{children}</ErrorBoundary>
}
