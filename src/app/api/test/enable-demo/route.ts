import { NextResponse } from 'next/server'
import { createHash } from 'crypto'

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const password = process.env.DEMO_PASSWORD
  if (!password) {
    return NextResponse.json({ error: 'DEMO_PASSWORD not set' }, { status: 500 })
  }

  const token = createHash('sha256').update(password).digest('hex')

  const response = NextResponse.json({ success: true })

  response.cookies.set('dyia_demo_access', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  })

  response.cookies.set('dyia_demo_active', '1', {
    httpOnly: false,
    secure: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  })

  return response
}
