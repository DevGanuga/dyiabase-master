/**
 * POST /api/intel/test-email
 * Test endpoint to verify Intel email configuration
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { sendEmail, isResendConfigured } from '@/lib/resend/client'
import { intelFreeReportEmail } from '@/lib/resend/templates'
import { getBaseUrl } from '@/lib/env'
import { isAdminByClerkId } from '@/lib/admin'

export async function POST(request: NextRequest) {
  try {
    // Admin-only: this endpoint sends real email via Resend, so leaving it open
    // would let anyone trigger arbitrary sends (spam + cost abuse). Respond 404
    // for everyone else so its existence isn't advertised.
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId || !(await isAdminByClerkId(clerkUserId))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    if (!isResendConfigured()) {
      return NextResponse.json(
        { error: 'Resend not configured. Check RESEND_API_KEY in .env.local' },
        { status: 500 }
      )
    }

    const baseUrl = getBaseUrl()
    console.log(`[Test] Sending test Intel email to: ${email}`)
    console.log(`[Test] Base URL: ${baseUrl}`)

    const result = await sendEmail(
      email,
      'Test: Your Competitive Report — Dyia Intel',
      intelFreeReportEmail({
        businessName: 'Test Business',
        localRank: 3,
        totalCompetitors: 15,
        reviewGap: 42,
        missingKeywordsCount: 8,
        competitorAdSpendAvg: 250,
        reportUrl: `${baseUrl}/intel?scan_id=test-123`,
      }),
      'intel_free_report',
    )

    if (result.success) {
      console.log(`[Test] Email sent successfully, message ID: ${result.messageId}`)
      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        message: `Test email sent to ${email}`,
      })
    } else {
      console.error(`[Test] Email failed:`, result.error)
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Unknown error',
          message: 'Failed to send test email',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[Test] Error sending test email:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
