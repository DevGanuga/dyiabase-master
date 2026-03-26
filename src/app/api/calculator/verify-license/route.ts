import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const LICENSE_KEY = process.env.CALCULATOR_LICENSE_KEY ?? ''
const COOKIE_NAME = 'dyia_calc_license'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 5 // 5 years

function normalize(key: string) {
  return key.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function sign(): string {
  return crypto
    .createHmac('sha256', LICENSE_KEY + '_dyia_salt')
    .update('calculator-licensed')
    .digest('hex')
}

/** POST — verify a license key and set an httpOnly cookie */
export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json()

    if (!LICENSE_KEY) {
      return NextResponse.json(
        { error: 'License verification is not configured' },
        { status: 500 },
      )
    }

    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: 'Key is required' }, { status: 400 })
    }

    if (normalize(key) !== normalize(LICENSE_KEY)) {
      return NextResponse.json(
        { error: 'Invalid license key. Check your purchase email and try again.' },
        { status: 401 },
      )
    }

    const token = sign()
    const res = NextResponse.json({ success: true })

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    })

    return res
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

/** GET — check whether the caller has a valid license cookie */
export async function GET(req: NextRequest) {
  if (!LICENSE_KEY) {
    return NextResponse.json({ licensed: false })
  }

  const cookie = req.cookies.get(COOKIE_NAME)
  if (!cookie) {
    return NextResponse.json({ licensed: false })
  }

  const licensed = cookie.value === sign()
  return NextResponse.json({ licensed })
}
