import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET
const GMAIL_REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/email/connect/gmail/callback`
  : 'http://localhost:3000/api/email/connect/gmail/callback'

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// GET - Handle Gmail OAuth callback
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state') // clerk_user_id
    const error = searchParams.get('error')

    if (error) {
      console.error('Gmail OAuth error:', error)
      return NextResponse.redirect(`${baseUrl}/app/email-blast?error=oauth_denied`)
    }

    if (!code || !state) {
      return NextResponse.redirect(`${baseUrl}/app/email-blast?error=missing_params`)
    }

    if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
      return NextResponse.redirect(`${baseUrl}/app/email-blast?error=not_configured`)
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: GMAIL_REDIRECT_URI,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Token exchange failed:', errorData)
      return NextResponse.redirect(`${baseUrl}/app/email-blast?error=token_exchange`)
    }

    const tokens = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokens

    // Get user email from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    })

    if (!userInfoResponse.ok) {
      console.error('Failed to get user info')
      return NextResponse.redirect(`${baseUrl}/app/email-blast?error=user_info`)
    }

    const userInfo = await userInfoResponse.json()
    const emailAddress = userInfo.email

    // Store connection in database
    const supabase = getSupabase()

    // Get dyia user from clerk_user_id (state)
    const { data: user, error: userError } = await supabase
      .from('dyia_users')
      .select('id')
      .eq('clerk_user_id', state)
      .single()

    if (userError || !user) {
      console.error('User not found:', state)
      return NextResponse.redirect(`${baseUrl}/app/email-blast?error=user_not_found`)
    }

    // Calculate token expiry
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString()

    // Upsert connection (replace existing Gmail connection)
    const { error: upsertError } = await supabase
      .from('dyia_email_connections')
      .upsert({
        user_id: user.id,
        provider: 'gmail',
        email_address: emailAddress,
        access_token,
        refresh_token: refresh_token || null,
        token_expires_at: tokenExpiresAt,
        is_active: true,
        connected_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider',
      })

    if (upsertError) {
      console.error('Failed to store connection:', upsertError)
      return NextResponse.redirect(`${baseUrl}/app/email-blast?error=storage`)
    }

    // Success - redirect back to email blast page
    return NextResponse.redirect(`${baseUrl}/app/email-blast?connected=gmail`)
  } catch (error) {
    console.error('Gmail callback error:', error)
    return NextResponse.redirect(`${baseUrl}/app/email-blast?error=unknown`)
  }
}
