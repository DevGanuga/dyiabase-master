import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { isAdminByClerkId, toggleAdmin } from '@/lib/admin'

export async function POST(req: Request) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await isAdminByClerkId(userId)
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { targetUserId, makeAdmin } = await req.json()

    if (!targetUserId || typeof makeAdmin !== 'boolean') {
      return NextResponse.json({ error: 'Missing targetUserId or makeAdmin' }, { status: 400 })
    }

    await toggleAdmin(targetUserId, makeAdmin)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin toggle error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
