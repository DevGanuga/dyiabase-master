import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { isAdminByClerkId, getAdminMetrics, listAllUsers } from '@/lib/admin'

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await isAdminByClerkId(userId)
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [metrics, users] = await Promise.all([
      getAdminMetrics(),
      listAllUsers(),
    ])

    return NextResponse.json({ metrics, users })
  } catch (error) {
    console.error('Admin metrics error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
