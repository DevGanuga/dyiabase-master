import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, type EmailType, isResendConfigured } from '@/lib/resend/client'
import {
  welcomeEmail,
  trialEndingEmail,
  weeklyInsightsEmail,
  followUpReminderEmail,
  subscriptionConfirmedEmail,
  monthlyReportEmail,
  type WeeklyInsightsData,
  type FollowUpData,
  type MonthlyReportData,
} from '@/lib/resend/templates'

// Initialize Supabase client with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface SendNotificationRequest {
  type: EmailType
  userId?: string
  email?: string
  data?: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  try {
    // For internal/cron calls, check for secret
    const authHeader = req.headers.get('authorization')
    const isCronCall = authHeader === `Bearer ${process.env.CRON_SECRET}`

    // For user-initiated calls, check Clerk auth
    if (!isCronCall) {
      const { userId: clerkUserId } = await auth()
      if (!clerkUserId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    if (!isResendConfigured()) {
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 503 }
      )
    }

    const body: SendNotificationRequest = await req.json()
    const { type, userId, email, data } = body

    // Get user info if userId provided
    let userEmail = email
    let firstName = 'there'

    if (userId) {
      const { data: user } = await supabase
        .from('dyia_users')
        .select('email, first_name')
        .eq('id', userId)
        .single()

      if (user) {
        userEmail = user.email
        firstName = user.first_name || 'there'
      }
    }

    if (!userEmail) {
      return NextResponse.json({ error: 'No email address provided' }, { status: 400 })
    }

    // Generate email content based on type
    let subject: string
    let html: string

    switch (type) {
      case 'welcome':
        subject = 'Welcome to Dyia! 🎉'
        html = welcomeEmail(firstName)
        break

      case 'trial_ending':
        subject = `Your Pro trial ends in ${(data?.daysLeft as number) || 2} days`
        html = trialEndingEmail(firstName, (data?.daysLeft as number) || 2)
        break

      case 'trial_ended':
        subject = 'Your Pro trial has ended'
        html = trialEndingEmail(firstName, 0)
        break

      case 'weekly_insights':
        subject = 'Your Weekly Business Insights'
        html = weeklyInsightsEmail(firstName, data as unknown as WeeklyInsightsData)
        break

      case 'follow_up_reminder':
        const followUps = data?.followUps as FollowUpData[]
        subject = `You have ${followUps?.length || 1} quote${(followUps?.length || 1) > 1 ? 's' : ''} to follow up on`
        html = followUpReminderEmail(firstName, followUps || [])
        break

      case 'subscription_confirmed':
        subject = 'Welcome to Dyia Pro! 🚀'
        html = subscriptionConfirmedEmail(firstName, (data?.plan as 'monthly' | 'annual') || 'monthly')
        break

      case 'monthly_report':
        const reportData = data as unknown as MonthlyReportData
        subject = `${reportData?.month || 'Monthly'} Business Report`
        html = monthlyReportEmail(firstName, reportData)
        break

      default:
        return NextResponse.json({ error: `Unknown email type: ${type}` }, { status: 400 })
    }

    const result = await sendEmail(userEmail, subject, html, type, userId || null)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
    })
  } catch (error) {
    console.error('Send notification error:', error)
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    )
  }
}
