import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// Outlook/Microsoft OAuth configuration
const OUTLOOK_CLIENT_ID = process.env.OUTLOOK_CLIENT_ID
const OUTLOOK_REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/email/connect/outlook/callback`
  : 'http://localhost:3000/api/email/connect/outlook/callback'

// Scopes needed for sending email via Microsoft Graph
const SCOPES = [
  'openid',
  'email',
  'offline_access',
  'https://graph.microsoft.com/Mail.Send',
].join(' ')

// GET - Initiate Outlook OAuth flow
export async function GET() {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!OUTLOOK_CLIENT_ID) {
      return NextResponse.json(
        { error: 'Outlook OAuth not configured. Set OUTLOOK_CLIENT_ID in environment.' },
        { status: 503 }
      )
    }

    // Build OAuth URL (Microsoft identity platform v2.0)
    const params = new URLSearchParams({
      client_id: OUTLOOK_CLIENT_ID,
      redirect_uri: OUTLOOK_REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      response_mode: 'query',
      state: clerkUserId, // Pass user ID for callback
    })

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`

    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error('Outlook OAuth init error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
