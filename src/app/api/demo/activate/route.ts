import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { rateLimiters } from '@/lib/rate-limit'

/**
 * Derive a demo token from the password.
 * The cookie stores this hash, NOT the raw password.
 */
function deriveToken(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

export async function POST(request: NextRequest) {
  // Rate limit: 5 attempts per 15 minutes per IP
  const rateLimited = await rateLimiters.demoActivate.checkAsync(request)
  if (rateLimited) return rateLimited

  const DEMO_PASSWORD = process.env.DEMO_PASSWORD
  if (!DEMO_PASSWORD) {
    return NextResponse.json(
      { error: 'Demo mode is not enabled' },
      { status: 403 }
    )
  }

  try {
    const { password } = await request.json()

    if (password !== DEMO_PASSWORD) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      )
    }

    const token = deriveToken(DEMO_PASSWORD)

    const response = NextResponse.json({ success: true, message: 'Demo mode activated' })

    // Auth cookie: httpOnly so JS can't read/steal it. Used by middleware & layout.
    response.cookies.set('dyia_demo_access', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    })

    // Indicator cookie: readable by client JS for UI (demo banner, demo data).
    // Contains no secret — just signals "demo mode is on".
    response.cookies.set('dyia_demo_active', '1', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    })

    return response
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Demo mode deactivated' })
  response.cookies.delete('dyia_demo_access')
  response.cookies.delete('dyia_demo_active')
  return response
}
