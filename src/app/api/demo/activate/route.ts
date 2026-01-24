import { NextRequest, NextResponse } from 'next/server'

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'dyia-demo-2024'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    if (password !== DEMO_PASSWORD) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      )
    }

    // Set demo access cookie (expires in 24 hours)
    const response = NextResponse.json({ success: true, message: 'Demo mode activated' })
    response.cookies.set('dyia_demo_access', DEMO_PASSWORD, {
      httpOnly: true,
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
  // Clear demo access cookie
  const response = NextResponse.json({ success: true, message: 'Demo mode deactivated' })
  response.cookies.delete('dyia_demo_access')
  return response
}
