import { NextResponse } from 'next/server'
import { sendEmail, isResendConfigured } from '@/lib/resend/client'
import { supportTicketEmail, supportConfirmationEmail } from '@/lib/resend/templates'

// Simple in-memory rate limit (per-deployment, resets on redeploy)
const rateLimitMap = new Map<string, number>()
const RATE_LIMIT_MS = 60_000 // 1 minute between submissions

export async function POST(req: Request) {
  try {
    const { name, email, subject, message } = await req.json()

    // Validate
    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    if (typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    if (message.length > 5000) {
      return NextResponse.json({ error: 'Message too long (max 5000 characters)' }, { status: 400 })
    }

    // Rate limit by email
    const lastSubmission = rateLimitMap.get(email)
    if (lastSubmission && Date.now() - lastSubmission < RATE_LIMIT_MS) {
      return NextResponse.json(
        { error: 'Please wait a moment before submitting again' },
        { status: 429 }
      )
    }
    rateLimitMap.set(email, Date.now())

    const subjectLabels: Record<string, string> = {
      bug: 'Bug Report',
      feature: 'Feature Request',
      billing: 'Billing Question',
      general: 'General Question',
    }

    const subjectLabel = subjectLabels[subject] || 'Support Request'

    if (isResendConfigured()) {
      // Send internal notification to support team
      await sendEmail(
        'support@dyia.io',
        `[${subjectLabel}] Support request from ${name}`,
        supportTicketEmail(name, email, subjectLabel, message),
        'welcome' // reusing email type for tracking
      )

      // Send confirmation to user
      await sendEmail(
        email,
        'We received your message — dyia Support',
        supportConfirmationEmail(name, subjectLabel),
        'welcome' // reusing email type for tracking
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Support contact error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send message' },
      { status: 500 }
    )
  }
}
