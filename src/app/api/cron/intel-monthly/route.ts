/**
 * GET /api/cron/intel-monthly
 * Monthly cron job — runs on the 1st of each month.
 * Generates fresh competitive intelligence scans for all active subscribers.
 * Authorization: Bearer CRON_SECRET
 *
 * Retry logic: if a user's scan fails, retries once after processing all others.
 * If retry also fails, logs error for owner alert.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { startResearch, checkResearch } from '@/lib/intel/agent'
import { generateActionPlan } from '@/lib/intel/action-plan'
import { sendEmail, isResendConfigured } from '@/lib/resend/client'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface UserToScan {
  userId: string
  businessName: string
  websiteUrl: string | null
  zipCode: string
  city: string | null
  state: string | null
  industry: string
  radiusMiles: number
  googleBusinessUrl: string | null
  mainServices: string[] | null
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const now = new Date()
  const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  try {
    // Get all active subscribers
    const { data: users, error: usersError } = await supabase
      .from('dyia_users')
      .select('id')
      .in('subscription_status', ['active', 'trialing'])

    if (usersError || !users) {
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // For each user, get their business info and most recent scan settings
    const usersToScan: UserToScan[] = []

    for (const u of users) {
      // Check if already scanned this month
      const { data: existing } = await supabase
        .from('dyia_intel_monthly_status')
        .select('id, job_status')
        .eq('user_id', u.id)
        .eq('month_year', monthYear)
        .single()

      if (existing?.job_status === 'complete') continue

      // Get business settings
      const { data: settings } = await supabase
        .from('dyia_settings')
        .select('business_name, business_address')
        .eq('user_id', u.id)
        .single()

      if (!settings?.business_name) continue

      // Get previous scan for industry/zip defaults
      const { data: prevScan } = await supabase
        .from('dyia_intel_scans')
        .select('industry, zip_code, city, state, radius_miles, website_url, google_business_url, main_services')
        .eq('user_id', u.id)
        .eq('source', 'crm_monthly')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!prevScan) continue

      usersToScan.push({
        userId: u.id,
        businessName: settings.business_name,
        websiteUrl: prevScan.website_url,
        zipCode: prevScan.zip_code,
        city: prevScan.city,
        state: prevScan.state,
        industry: prevScan.industry,
        radiusMiles: prevScan.radius_miles || 25,
        googleBusinessUrl: prevScan.google_business_url,
        mainServices: prevScan.main_services,
      })
    }

    const results = { total: usersToScan.length, success: 0, failed: 0, retried: 0 }

    // First pass: run scans for all users
    for (const userInfo of usersToScan) {
      const ok = await processSingleUser(supabase, userInfo, monthYear)
      if (ok) {
        results.success++
      } else {
        results.failed++
      }
    }

    // Retry pass: pick up any rows that failed >= 1 hour ago (from this or a prior run)
    const { data: failedRows } = await supabase
      .from('dyia_intel_monthly_status')
      .select('user_id')
      .eq('month_year', monthYear)
      .eq('job_status', 'failed')
      .lt('created_at', new Date(Date.now() - 3600_000).toISOString())

    for (const row of failedRows || []) {
      const retryUser = usersToScan.find(u => u.userId === row.user_id)
      if (!retryUser) continue

      const ok = await processSingleUser(supabase, retryUser, monthYear)
      if (ok) {
        results.retried++
      } else {
        console.error(
          `[INTEL CRON] FINAL FAILURE for user ${retryUser.userId} (${retryUser.businessName}).`
        )
        await alertOwnerOnFailure(retryUser.userId, retryUser.businessName)
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Intel monthly cron error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function processSingleUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userInfo: UserToScan,
  monthYear: string
): Promise<boolean> {
  try {
    // Upsert monthly status to 'running'
    await supabase
      .from('dyia_intel_monthly_status')
      .upsert(
        {
          user_id: userInfo.userId,
          month_year: monthYear,
          job_status: 'running',
          viewed_at: null,
        },
        { onConflict: 'user_id,month_year' }
      )

    const openaiResponseId = await startResearch({
      businessName: userInfo.businessName,
      websiteUrl: userInfo.websiteUrl || undefined,
      zipCode: userInfo.zipCode,
      city: userInfo.city || undefined,
      state: userInfo.state || undefined,
      industry: userInfo.industry,
      radiusMiles: userInfo.radiusMiles,
      googleBusinessUrl: userInfo.googleBusinessUrl || undefined,
      mainServices: userInfo.mainServices || undefined,
    })

    // Poll until done (cron functions have longer limits than edge)
    const deadline = Date.now() + 600_000
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 5000))
      const status = await checkResearch(openaiResponseId)
      if (!status.done) continue
      if ('error' in status) throw new Error(status.error)

      const { scanData, researchSources } = status.result
      const actionPlan = await generateActionPlan(scanData, userInfo.businessName)

      const { data: scan, error: scanError } = await supabase
        .from('dyia_intel_scans')
        .insert({
          user_id: userInfo.userId,
          business_name: userInfo.businessName,
          website_url: userInfo.websiteUrl,
          zip_code: userInfo.zipCode,
          city: userInfo.city,
          state: userInfo.state,
          google_business_url: userInfo.googleBusinessUrl,
          main_services: userInfo.mainServices,
          industry: userInfo.industry,
          radius_miles: userInfo.radiusMiles,
          scan_data: scanData,
          research_sources: researchSources,
          action_plan: actionPlan,
          openai_response_id: openaiResponseId,
          source: 'crm_monthly',
        })
        .select('id')
        .single()

      if (scanError || !scan) throw new Error(`Failed to store scan: ${scanError?.message}`)

      await supabase
        .from('dyia_intel_monthly_status')
        .update({ scan_id: scan.id, job_status: 'complete' })
        .eq('user_id', userInfo.userId)
        .eq('month_year', monthYear)

      return true
    }

    throw new Error('Research timed out after 10 minutes')
  } catch (error) {
    console.error(`[INTEL CRON] Failed for user ${userInfo.userId}:`, error)

    // Mark as failed
    await supabase
      .from('dyia_intel_monthly_status')
      .upsert(
        {
          user_id: userInfo.userId,
          month_year: monthYear,
          job_status: 'failed',
        },
        { onConflict: 'user_id,month_year' }
      )
      .catch(() => {})

    return false
  }
}

async function alertOwnerOnFailure(userId: string, businessName: string): Promise<void> {
  if (!isResendConfigured()) return
  const ownerEmail = process.env.SUPPORT_EMAIL || process.env.RESEND_FROM_EMAIL?.match(/<(.+)>/)?.[1]
  if (!ownerEmail) return

  try {
    await sendEmail(
      ownerEmail,
      `[Dyia Intel] Scan failed for ${businessName}`,
      `<h2>Intel Scan Failure</h2>
       <p>The monthly Intel scan for <strong>${businessName}</strong> (user ${userId}) failed after retry.</p>
       <p>Check server logs for details.</p>`,
      'monthly_report',
    )
  } catch {
    console.error(`[INTEL CRON] Failed to send owner alert email for user ${userId}`)
  }
}
