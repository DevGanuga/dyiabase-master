import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// Gmail OAuth configuration
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID
const GMAIL_REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/email/connect/gmail/callback`
  : 'http://localhost:3000/api/email/connect/gmail/callback'

// Scopes needed for sending email
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

// GET - Initiate Gmail OAuth flow
export async function GET() {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!GMAIL_CLIENT_ID) {
      return NextResponse.json(
        { error: 'Gmail OAuth not configured. Set GMAIL_CLIENT_ID in environment.' },
        { status: 503 }
      )
    }

    // Build OAuth URL
    const params = new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      redirect_uri: GMAIL_REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state: clerkUserId, // Pass user ID for callback
    })

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error('Gmail OAuth init error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
