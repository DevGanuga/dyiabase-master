import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

interface Recipient {
  email: string
  name: string
}

// Refresh Gmail access token if needed
async function refreshGmailToken(connection: {
  refresh_token: string
  access_token: string
  token_expires_at: string | null
  id: string
}, supabase: ReturnType<typeof getSupabase>): Promise<string> {
  // Check if token is expired (or will expire in next 5 minutes)
  if (connection.token_expires_at) {
    const expiresAt = new Date(connection.token_expires_at)
    const now = new Date()
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)
    
    if (expiresAt > fiveMinutesFromNow) {
      return connection.access_token // Token is still valid
    }
  }

  // Refresh the token
  if (!connection.refresh_token) {
    throw new Error('No refresh token available')
  }

  if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    throw new Error('Gmail OAuth not configured: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET are required')
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to refresh Gmail token')
  }

  const tokens = await response.json()
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  // Update token in database
  await supabase
    .from('dyia_email_connections')
    .update({
      access_token: tokens.access_token,
      token_expires_at: newExpiresAt,
    })
    .eq('id', connection.id)

  return tokens.access_token
}

// Refresh Outlook access token if needed
async function refreshOutlookToken(connection: {
  refresh_token: string
  access_token: string
  token_expires_at: string | null
  id: string
}, supabase: ReturnType<typeof getSupabase>): Promise<string> {
  if (connection.token_expires_at) {
    const expiresAt = new Date(connection.token_expires_at)
    const now = new Date()
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)
    
    if (expiresAt > fiveMinutesFromNow) {
      return connection.access_token
    }
  }

  if (!connection.refresh_token) {
    throw new Error('No refresh token available')
  }

  if (!process.env.OUTLOOK_CLIENT_ID || !process.env.OUTLOOK_CLIENT_SECRET) {
    throw new Error('Outlook OAuth not configured: OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET are required')
  }

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.OUTLOOK_CLIENT_ID,
      client_secret: process.env.OUTLOOK_CLIENT_SECRET,
      refresh_token: connection.refresh_token,
      grant_type: 'refresh_token',
      scope: 'openid email offline_access https://graph.microsoft.com/Mail.Send',
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to refresh Outlook token')
  }

  const tokens = await response.json()
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  await supabase
    .from('dyia_email_connections')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || connection.refresh_token,
      token_expires_at: newExpiresAt,
    })
    .eq('id', connection.id)

  return tokens.access_token
}

// Send email via Gmail API
async function sendViaGmail(
  accessToken: string,
  fromEmail: string,
  recipient: Recipient,
  subject: string,
  body: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Build RFC 2822 formatted email
  const emailLines = [
    `From: ${fromEmail}`,
    `To: ${recipient.name ? `"${recipient.name}" <${recipient.email}>` : recipient.email}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ]
  
  const rawMessage = emailLines.join('\r\n')
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encodedMessage }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Gmail send error:', error)
    return { success: false, error: `Gmail API error: ${response.status}` }
  }

  const result = await response.json()
  return { success: true, messageId: result.id }
}

// Send email via Microsoft Graph API
async function sendViaOutlook(
  accessToken: string,
  recipient: Recipient,
  subject: string,
  body: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const message = {
    message: {
      subject,
      body: {
        contentType: 'Text',
        content: body,
      },
      toRecipients: [
        {
          emailAddress: {
            address: recipient.email,
            name: recipient.name || undefined,
          },
        },
      ],
    },
    saveToSentItems: true,
  }

  const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Outlook send error:', error)
    return { success: false, error: `Microsoft Graph API error: ${response.status}` }
  }

  // Microsoft Graph doesn't return message ID on sendMail
  return { success: true, messageId: `outlook-${Date.now()}` }
}

// POST - Send emails to recipients
export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { connectionId, recipients, subject, body } = await request.json() as {
      connectionId: string
      recipients: Recipient[]
      subject: string
      body: string
    }

    if (!connectionId || !recipients?.length || !subject || !body) {
      return NextResponse.json(
        { error: 'Missing required fields: connectionId, recipients, subject, body' },
        { status: 400 }
      )
    }

    if (recipients.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 recipients per batch' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    // Get dyia user
    const { data: user, error: userError } = await supabase
      .from('dyia_users')
      .select('id, subscription_status')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Pro feature check
    if (user.subscription_status !== 'active' && user.subscription_status !== 'trialing') {
      return NextResponse.json({ error: 'Pro subscription required' }, { status: 403 })
    }

    // Get connection
    const { data: connection, error: connError } = await supabase
      .from('dyia_email_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (connError || !connection) {
      return NextResponse.json({ error: 'Email connection not found' }, { status: 404 })
    }

    // Create campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('dyia_email_campaigns')
      .insert({
        user_id: user.id,
        subject,
        body,
        recipient_count: recipients.length,
        status: 'sending',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (campaignError || !campaign) {
      console.error('Failed to create campaign:', campaignError)
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
    }

    // Refresh token if needed
    let accessToken: string
    try {
      if (connection.provider === 'gmail') {
        accessToken = await refreshGmailToken(connection, supabase)
      } else {
        accessToken = await refreshOutlookToken(connection, supabase)
      }
    } catch (tokenError) {
      console.error('Token refresh failed:', tokenError)
      return NextResponse.json(
        { error: 'Email connection expired. Please reconnect your account.' },
        { status: 401 }
      )
    }

    // Send emails and track results
    const results: Array<{ email: string; success: boolean; error?: string }> = []
    let sentCount = 0
    let failedCount = 0

    for (const recipient of recipients) {
      let sendResult: { success: boolean; messageId?: string; error?: string }

      try {
        if (connection.provider === 'gmail') {
          sendResult = await sendViaGmail(accessToken, connection.email_address, recipient, subject, body)
        } else {
          sendResult = await sendViaOutlook(accessToken, recipient, subject, body)
        }
      } catch (err) {
        sendResult = { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
      }

      // Record send attempt
      await supabase.from('dyia_email_sends').insert({
        user_id: user.id,
        connection_id: connection.id,
        campaign_id: campaign.id,
        recipient_email: recipient.email,
        recipient_name: recipient.name || null,
        subject,
        body_preview: body.substring(0, 200),
        status: sendResult.success ? 'sent' : 'failed',
        error_message: sendResult.error || null,
        provider_message_id: sendResult.messageId || null,
        sent_at: sendResult.success ? new Date().toISOString() : null,
      })

      results.push({
        email: recipient.email,
        success: sendResult.success,
        error: sendResult.error,
      })

      if (sendResult.success) {
        sentCount++
      } else {
        failedCount++
      }

      // Small delay between sends to avoid rate limits
      if (recipients.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    // Update campaign status
    await supabase
      .from('dyia_email_campaigns')
      .update({
        sent_count: sentCount,
        failed_count: failedCount,
        status: failedCount === recipients.length ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', campaign.id)

    // Update connection last_used_at
    await supabase
      .from('dyia_email_connections')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', connection.id)

    return NextResponse.json({
      campaignId: campaign.id,
      total: recipients.length,
      sent: sentCount,
      failed: failedCount,
      results,
    })
  } catch (error) {
    console.error('Email send error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET - Get send history
export async function GET(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')

    const supabase = getSupabase()

    const { data: user } = await supabase
      .from('dyia_users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get recent campaigns with send counts
    const { data: campaigns, error } = await supabase
      .from('dyia_email_campaigns')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching campaigns:', error)
      return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
    }

    return NextResponse.json({
      campaigns: campaigns.map(c => ({
        id: c.id,
        name: c.name,
        subject: c.subject,
        recipientCount: c.recipient_count,
        sentCount: c.sent_count,
        failedCount: c.failed_count,
        status: c.status,
        startedAt: c.started_at,
        completedAt: c.completed_at,
        createdAt: c.created_at,
      }))
    })
  } catch (error) {
    console.error('History error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
