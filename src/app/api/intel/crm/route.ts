/**
 * GET /api/intel/crm
 * Returns Intel data for the logged-in CRM user.
 * Includes current scan, previous scan (for change indicators), and monthly status.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabase()

    // Get dyia user
    const { data: dyiaUser, error: userError } = await supabase
      .from('dyia_users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (userError || !dyiaUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get the two most recent CRM scans (current + previous for change indicators)
    const { data: scans } = await supabase
      .from('dyia_intel_scans')
      .select('*')
      .eq('user_id', dyiaUser.id)
      .eq('source', 'crm_monthly')
      .order('created_at', { ascending: false })
      .limit(2)

    const currentScan = scans?.[0] || null
    const previousScan = scans?.[1] || null

    // Get monthly status for current month
    const now = new Date()
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const { data: monthlyStatus } = await supabase
      .from('dyia_intel_monthly_status')
      .select('*')
      .eq('user_id', dyiaUser.id)
      .eq('month_year', monthYear)
      .single()

    // Mark as viewed if this is a fresh report
    if (monthlyStatus && !monthlyStatus.viewed_at) {
      await supabase
        .from('dyia_intel_monthly_status')
        .update({ viewed_at: new Date().toISOString() })
        .eq('id', monthlyStatus.id)
    }

    // Calculate days until next refresh
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const daysUntilRefresh = Math.ceil((nextMonth.getTime() - now.getTime()) / 86400000)

    // Compute change indicators
    let changes = null
    if (currentScan?.scan_data && previousScan?.scan_data) {
      const curr = currentScan.scan_data
      const prev = previousScan.scan_data
      changes = {
        localRank: prev.local_rank - curr.local_rank, // positive = improvement
        reviewCount: curr.review_count_mine - prev.review_count_mine,
        reviewGap: prev.review_gap - curr.review_gap, // positive = gap closing
        missingKeywords: prev.missing_keywords_count - curr.missing_keywords_count,
      }
    }

    return NextResponse.json({
      currentScan: currentScan
        ? {
            id: currentScan.id,
            businessName: currentScan.business_name,
            zipCode: currentScan.zip_code,
            industry: currentScan.industry,
            radiusMiles: currentScan.radius_miles,
            scanData: currentScan.scan_data,
            researchSources: currentScan.research_sources,
            actionPlan: currentScan.action_plan,
            createdAt: currentScan.created_at,
          }
        : null,
      changes,
      daysUntilRefresh,
      hasNewReport: monthlyStatus ? !monthlyStatus.viewed_at : false,
      monthlyStatus: monthlyStatus
        ? {
            jobStatus: monthlyStatus.job_status,
            monthYear: monthlyStatus.month_year,
          }
        : null,
    })
  } catch (error) {
    console.error('Intel CRM error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
