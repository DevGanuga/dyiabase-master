/**
 * POST /api/intel/refresh
 * Manual trigger to refresh Intel scan for the logged-in CRM user.
 * Used for testing and on-demand refreshes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { startResearch, checkResearch } from '@/lib/intel/agent'
import { generateActionPlan } from '@/lib/intel/action-plan'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabase()

    // Get dyia user with settings
    const { data: dyiaUser } = await supabase
      .from('dyia_users')
      .select('id, subscription_status')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (!dyiaUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!['active', 'trialing'].includes(dyiaUser.subscription_status)) {
      return NextResponse.json({ error: 'Active subscription required' }, { status: 403 })
    }

    // Get user's business settings
    const { data: settings } = await supabase
      .from('dyia_settings')
      .select('business_name, business_address')
      .eq('user_id', dyiaUser.id)
      .single()

    if (!settings?.business_name) {
      return NextResponse.json(
        { error: 'Business name required. Set it in Settings first.' },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    let { industry, zipCode, city, state, radiusMiles, websiteUrl, googleBusinessUrl, mainServices } = body

    if (!industry || !zipCode) {
      const { data: prevScan } = await supabase
        .from('dyia_intel_scans')
        .select('industry, zip_code, city, state, radius_miles, website_url, google_business_url, main_services')
        .eq('user_id', dyiaUser.id)
        .eq('source', 'crm_monthly')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (prevScan) {
        industry = industry || prevScan.industry
        zipCode = zipCode || prevScan.zip_code
        city = city || prevScan.city
        state = state || prevScan.state
        radiusMiles = radiusMiles || prevScan.radius_miles
        websiteUrl = websiteUrl || prevScan.website_url
        googleBusinessUrl = googleBusinessUrl || prevScan.google_business_url
        mainServices = mainServices || prevScan.main_services
      }
    }

    if (!industry || !zipCode) {
      return NextResponse.json(
        { error: 'Industry and zip code required for first scan' },
        { status: 400 }
      )
    }

    const now = new Date()
    const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // Upsert monthly status to 'running'
    await supabase
      .from('dyia_intel_monthly_status')
      .upsert(
        {
          user_id: dyiaUser.id,
          month_year: monthYear,
          job_status: 'running',
          viewed_at: null,
        },
        { onConflict: 'user_id,month_year' }
      )

    // Start deep research (returns instantly)
    const openaiResponseId = await startResearch({
      businessName: settings.business_name,
      websiteUrl,
      zipCode,
      city,
      state,
      industry,
      radiusMiles: radiusMiles || 25,
      googleBusinessUrl,
      mainServices: Array.isArray(mainServices) ? mainServices : undefined,
    })

    // Store a pending scan row with the response ID
    const { data: scan, error: scanError } = await supabase
      .from('dyia_intel_scans')
      .insert({
        user_id: dyiaUser.id,
        business_name: settings.business_name,
        website_url: websiteUrl || null,
        zip_code: zipCode,
        city: city || null,
        state: state || null,
        google_business_url: googleBusinessUrl || null,
        main_services: Array.isArray(mainServices) && mainServices.length > 0 ? mainServices : null,
        industry,
        radius_miles: radiusMiles || 25,
        openai_response_id: openaiResponseId,
        source: 'crm_monthly',
      })
      .select('id')
      .single()

    if (scanError || !scan) {
      throw new Error('Failed to store scan record')
    }

    // Update monthly status
    await supabase
      .from('dyia_intel_monthly_status')
      .update({ scan_id: scan.id, job_status: 'running' })
      .eq('user_id', dyiaUser.id)
      .eq('month_year', monthYear)

    // Poll OpenAI in a tight loop (CRM refresh is user-initiated, shorter timeout is acceptable)
    const deadline = Date.now() + 600_000
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 3000))
      const status = await checkResearch(openaiResponseId)

      if (!status.done) continue

      if ('error' in status) {
        await supabase
          .from('dyia_intel_monthly_status')
          .update({ job_status: 'failed' })
          .eq('user_id', dyiaUser.id)
          .eq('month_year', monthYear)
        throw new Error(status.error)
      }

      const { scanData, researchSources } = status.result
      const actionPlan = await generateActionPlan(scanData, settings.business_name)

      await supabase
        .from('dyia_intel_scans')
        .update({ scan_data: scanData, research_sources: researchSources, action_plan: actionPlan })
        .eq('id', scan.id)

      await supabase
        .from('dyia_intel_monthly_status')
        .update({ job_status: 'complete' })
        .eq('user_id', dyiaUser.id)
        .eq('month_year', monthYear)

      return NextResponse.json({
        success: true,
        scanId: scan.id,
        scanData,
        researchSources,
        actionPlan,
      })
    }

    throw new Error('Research timed out')
  } catch (error) {
    console.error('Intel refresh error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to refresh Intel report' },
      { status: 500 }
    )
  }
}
