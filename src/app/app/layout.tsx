import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { validateEnv } from '@/lib/env'

// Validate environment variables on first server-side render
validateEnv()

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check for demo mode cookie
  const cookieStore = await cookies()
  const isDemoMode = !!cookieStore.get('dyia_demo_access')?.value

  // If not in demo mode, require Clerk authentication
  if (!isDemoMode) {
    const { userId } = await auth()

    if (!userId) {
      redirect('/')
    }
  }

  return <ErrorBoundary>{children}</ErrorBoundary>
}
