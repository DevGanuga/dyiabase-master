/**
 * GET /api/intel/scan/status?scanId=xxx
 * Polls OpenAI once per call — no long-lived function.
 * When done, stores results in DB and sends email.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkResearch } from '@/lib/intel/agent'
import { sendEmail, isResendConfigured } from '@/lib/resend/client'
import { intelFreeReportEmail } from '@/lib/resend/templates'
import { getBaseUrl } from '@/lib/env'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  const scanId = new URL(request.url).searchParams.get('scanId')
  if (!scanId) {
    return NextResponse.json({ error: 'scanId required' }, { status: 400 })
  }

  const supabase = getSupabase()

  const { data: scan } = await supabase
    .from('dyia_intel_scans')
    .select('id, openai_response_id, scan_data, email, business_name')
    .eq('id', scanId)
    .single()

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 })
  }

  // Already done from a previous poll
  if (scan.scan_data) {
    return NextResponse.json({
      status: 'complete',
      scanData: scan.scan_data,
    })
  }

  if (!scan.openai_response_id) {
    return NextResponse.json({ error: 'No research job found for this scan' }, { status: 400 })
  }

  // Single retrieve call — no polling loop
  const result = await checkResearch(scan.openai_response_id)

  if (!result.done) {
    return NextResponse.json({ status: result.status })
  }

  if ('error' in result) {
    // Alert owner on failure
    if (isResendConfigured()) {
      const ownerEmail = process.env.SUPPORT_EMAIL || process.env.RESEND_FROM_EMAIL?.match(/<(.+)>/)?.[1]
      if (ownerEmail) {
        sendEmail(
          ownerEmail,
          `[Dyia Intel] Scan failed for ${scan.business_name}`,
          `<h2>Intel Scan Failure</h2>
           <p>Deep research failed for <strong>${scan.business_name}</strong>.</p>
           <p>Lead email: ${scan.email}</p>
           <p>Error: ${result.error}</p>`,
          'intel_free_report',
        ).catch(() => {})
      }
    }

    return NextResponse.json({ status: 'failed', error: result.error })
  }

  // Store results
  const { scanData, researchSources } = result.result
  await supabase
    .from('dyia_intel_scans')
    .update({
      scan_data: scanData,
      research_sources: researchSources,
    })
    .eq('id', scanId)

  // Send free report email
  if (scan.email && isResendConfigured()) {
    const baseUrl = getBaseUrl()
    sendEmail(
      scan.email,
      `Your ${scan.business_name} Competitive Report — Dyia Intel`,
      intelFreeReportEmail({
        businessName: scan.business_name,
        localRank: scanData.local_rank,
        totalCompetitors: scanData.total_competitors,
        reviewGap: scanData.review_gap,
        missingKeywordsCount: scanData.missing_keywords_count,
        competitorAdSpendAvg: scanData.competitor_ad_spend_avg,
        reportUrl: `${baseUrl}/intel?scan_id=${scanId}`,
      }),
      'intel_free_report',
    ).catch(err => console.error('Failed to send free Intel report email:', err))
  }

  return NextResponse.json({
    status: 'complete',
    scanData,
    researchSources,
  })
}
