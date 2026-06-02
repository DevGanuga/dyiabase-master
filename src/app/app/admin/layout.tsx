import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { isAdminByClerkId } from '@/lib/admin'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Use the same authorization check as the admin APIs (is_admin OR an
  // admin/super_admin role). Previously this layout only checked `is_admin`,
  // so a role-based admin could call every admin API but was bounced out of
  // the standalone /app/admin pages — an inconsistent, confusing gate.
  const admin = await isAdminByClerkId(userId)
  if (!admin) {
    redirect('/app')
  }

  return <>{children}</>
}
