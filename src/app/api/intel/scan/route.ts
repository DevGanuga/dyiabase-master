/**
 * POST /api/intel/scan
 * Public endpoint — runs competitive intelligence scan.
 * Requires email (gate). No auth required (public page).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runIntelAgent } from '@/lib/intel/agent'
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
    let researchSources = null
    try {
      const intelResult = await runIntelAgent({
        businessName,
        websiteUrl,
        zipCode,
        industry,
        radiusMiles: radius,
      }, { timeoutMs: 90_000 })
      scanData = intelResult.scanData
      researchSources = intelResult.researchSources
    } catch (agentError) {
      console.error('Intel agent failed:', agentError)
      return NextResponse.json(
        { error: 'Failed to generate competitive report. Please try again.' },
        { status: 502 }
      )
    }

    // Update the scan record with results
    const { error: updateError } = await supabase
      .from('dyia_intel_scans')
      .update({
        scan_data: scanData,
        research_sources: researchSources,
      })
      .eq('id', scan.id)

    if (updateError) {
      console.error('Failed to update scan with results:', updateError)
    }

    return NextResponse.json({
      scanId: scan.id,
      scanData,
      researchSources,
      actionPlanPreview: null,
    })
  } catch (error) {
    console.error('Intel scan error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
