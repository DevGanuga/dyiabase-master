/**
 * POST /api/intel/scan
 * Public endpoint — runs competitive intelligence scan.
 * Requires email (gate). No auth required (public page).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runIntelAgent } from '@/lib/intel/agent'
import { generateActionPlan } from '@/lib/intel/action-plan'
import { INTEL_INDUSTRIES, INTEL_RADIUS_OPTIONS } from '@/types/database'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessName, websiteUrl, zipCode, industry, radiusMiles, email } = body

    if (!businessName || !zipCode || !industry || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: businessName, zipCode, industry, email' },
        { status: 400 }
      )
    }

    if (!/^\d{5}$/.test(zipCode)) {
      return NextResponse.json({ error: 'Invalid zip code' }, { status: 400 })
    }

    if (!INTEL_INDUSTRIES.includes(industry)) {
      return NextResponse.json({ error: 'Invalid industry' }, { status: 400 })
    }

    const radius = INTEL_RADIUS_OPTIONS.includes(radiusMiles) ? radiusMiles : 25

    const supabase = getSupabase()

    // Create the scan record first (pending state)
    const { data: scan, error: insertError } = await supabase
      .from('dyia_intel_scans')
      .insert({
        email,
        business_name: businessName,
        website_url: websiteUrl || null,
        zip_code: zipCode,
        industry,
        radius_miles: radius,
        source: 'public_page',
      })
      .select('id')
      .single()

    if (insertError || !scan) {
      console.error('Failed to create intel scan record:', insertError)
      return NextResponse.json({ error: 'Failed to create scan' }, { status: 500 })
    }

    // Run the AI agent
    let scanData
    try {
      scanData = await runIntelAgent({
        businessName,
        websiteUrl,
        zipCode,
        industry,
        radiusMiles: radius,
      })
    } catch (agentError) {
      console.error('Intel agent failed:', agentError)
      return NextResponse.json(
        { error: 'Failed to generate competitive report. Please try again.' },
        { status: 502 }
      )
    }

    // Generate action plan (for post-purchase delivery)
    let actionPlan = null
    try {
      actionPlan = await generateActionPlan(scanData, businessName)
    } catch (planError) {
      console.error('Action plan generation failed:', planError)
      // Non-fatal — scan data is still valuable without the action plan
    }

    // Update the scan record with results
    const { error: updateError } = await supabase
      .from('dyia_intel_scans')
      .update({
        scan_data: scanData,
        action_plan: actionPlan,
      })
      .eq('id', scan.id)

    if (updateError) {
      console.error('Failed to update scan with results:', updateError)
    }

    return NextResponse.json({
      scanId: scan.id,
      scanData,
      // Only include preview steps (first 2) for free users
      actionPlanPreview: actionPlan?.filter(s => s.include_in_free_preview) ?? null,
    })
  } catch (error) {
    console.error('Intel scan error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
