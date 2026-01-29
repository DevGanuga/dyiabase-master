import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check for demo mode cookie
  const cookieStore = await cookies()
  const isDemoMode = cookieStore.get('dyia_demo_access')?.value === 'true'

  // If not in demo mode, require Clerk authentication
  if (!isDemoMode) {
    const { userId } = await auth()

    if (!userId) {
      redirect('/')
    }
  }

  return <>{children}</>
}
