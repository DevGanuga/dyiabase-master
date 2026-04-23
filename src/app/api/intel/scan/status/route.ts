/**
 * GET /api/intel/scan/status?scanId=xxx
 * Polls OpenAI once per call — no long-lived function.
 * When done, stores results in DB and sends email.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkResearch } from '@/lib/intel/agent'
import { generatePreviewSteps } from '@/lib/intel/action-plan'
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
    .select('id, openai_response_id, scan_data, research_sources, research_report, action_plan, verified_data, email, business_name')
    .eq('id', scanId)
    .single()

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found' }, { status: 404 })
  }

  // Already done from a previous poll
  if (scan.scan_data) {
    const previewSteps = Array.isArray(scan.action_plan)
      ? scan.action_plan.filter((s: { include_in_free_preview?: boolean }) => s.include_in_free_preview)
      : null
    return NextResponse.json({
      status: 'complete',
      scanData: scan.scan_data,
      researchSources: scan.research_sources || null,
      researchReport: scan.research_report || null,
      actionPlanPreview: previewSteps && previewSteps.length > 0 ? previewSteps : null,
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

  // Overwrite model's numbers with Places API verified data
  const { scanData, researchSources, researchReport } = result.result
  if (scan.verified_data) {
    const vd = scan.verified_data as { target?: { reviewCount?: number; rating?: number; name?: string }; competitors?: Array<{ name: string; reviewCount: number; rating: number; address?: string }> }
    if (vd.target && typeof vd.target.reviewCount === 'number') {
      scanData.review_count_mine = vd.target.reviewCount
    }
    if (vd.competitors && vd.competitors.length > 0) {
      const sorted = [...vd.competitors].sort((a, b) => b.reviewCount - a.reviewCount)
      scanData.review_count_leader = sorted[0].reviewCount
      scanData.review_gap = Math.max(0, scanData.review_count_leader - scanData.review_count_mine)
      scanData.top_competitors = sorted.slice(0, 5).map((comp, i) => ({
        name: comp.name,
        reviews: comp.reviewCount,
        estimated_ad_spend: scanData.top_competitors[i]?.estimated_ad_spend || 0,
        rank: i + 1,
      }))
      scanData.total_competitors = Math.max(scanData.total_competitors, sorted.length)
      scanData.gap_scores.reviews_pct = scanData.review_count_leader > 0
        ? Math.min(100, Math.round((scanData.review_count_mine / scanData.review_count_leader) * 100))
        : 100
    }
  }
  await supabase
    .from('dyia_intel_scans')
    .update({
      scan_data: scanData,
      research_sources: researchSources,
      research_report: researchReport || null,
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

  // Generate 2 preview steps and persist them as the action_plan for this scan
  let actionPlanPreview = null
  try {
    actionPlanPreview = await generatePreviewSteps(scanData, scan.business_name)
    if (actionPlanPreview && actionPlanPreview.length > 0) {
      await supabase
        .from('dyia_intel_scans')
        .update({ action_plan: actionPlanPreview })
        .eq('id', scanId)
    }
  } catch (err) {
    console.error('Failed to generate preview steps:', err)
  }

  return NextResponse.json({
    status: 'complete',
    scanData,
    researchSources,
    researchReport: researchReport || null,
    actionPlanPreview,
  })
}
