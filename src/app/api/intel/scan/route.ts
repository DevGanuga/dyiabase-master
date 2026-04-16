/**
 * POST /api/intel/scan
 * Public endpoint — kicks off a deep research scan.
 * Returns immediately with scanId. Frontend polls /api/intel/scan/status.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { startResearch } from '@/lib/intel/agent'
import { scanLocalMarket } from '@/lib/intel/places'
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
    const {
      businessName, websiteUrl, zipCode, city, state, industry, radiusMiles,
      email, fullName, phone, googleBusinessUrl, mainServices, yearsInBusiness, teamSize,
    } = body

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

    // Duplicate check
    const { data: existingScan } = await supabase
      .from('dyia_intel_scans')
      .select('id, scan_data, research_sources')
      .eq('email', email)
      .eq('business_name', businessName)
      .eq('source', 'public_page')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existingScan?.scan_data) {
      return NextResponse.json({
        scanId: existingScan.id,
        status: 'complete',
        scanData: existingScan.scan_data,
        researchSources: existingScan.research_sources || null,
      })
    }

    // Get verified business data from Google Places API
    let verifiedTarget = null
    let verifiedCompetitors: Awaited<ReturnType<typeof scanLocalMarket>>['competitors'] = []
    try {
      const locationLabel = [city, state].filter(Boolean).join(', ') || ''
      const placesResult = await scanLocalMarket(businessName, industry, locationLabel, zipCode)
      verifiedTarget = placesResult.target
      verifiedCompetitors = placesResult.competitors
    } catch (placesErr) {
      console.error('Places API lookup failed (continuing without verified data):', placesErr)
    }

    // Start the deep research with verified data as context
    const openaiResponseId = await startResearch({
      businessName,
      websiteUrl,
      zipCode,
      city,
      state,
      industry,
      radiusMiles: radius,
      phone,
      googleBusinessUrl,
      mainServices: Array.isArray(mainServices) ? mainServices : undefined,
      yearsInBusiness: yearsInBusiness || undefined,
      teamSize: teamSize || undefined,
      verifiedTarget,
      verifiedCompetitors,
    })

    // Reuse pending row or create new one
    let scanId: string
    if (existingScan && !existingScan.scan_data) {
      scanId = existingScan.id
      await supabase
        .from('dyia_intel_scans')
        .update({
          full_name: fullName || null,
          business_name: businessName,
          website_url: websiteUrl || null,
          zip_code: zipCode,
          city: city || null,
          state: state || null,
          phone: phone || null,
          google_business_url: googleBusinessUrl || null,
          main_services: Array.isArray(mainServices) && mainServices.length > 0 ? mainServices : null,
          years_in_business: yearsInBusiness || null,
          team_size: teamSize || null,
          industry,
          radius_miles: radius,
          openai_response_id: openaiResponseId,
        })
        .eq('id', scanId)
    } else {
      const { data: scan, error: insertError } = await supabase
        .from('dyia_intel_scans')
        .insert({
          email,
          full_name: fullName || null,
          business_name: businessName,
          website_url: websiteUrl || null,
          zip_code: zipCode,
          city: city || null,
          state: state || null,
          phone: phone || null,
          google_business_url: googleBusinessUrl || null,
          main_services: Array.isArray(mainServices) && mainServices.length > 0 ? mainServices : null,
          years_in_business: yearsInBusiness || null,
          team_size: teamSize || null,
          industry,
          radius_miles: radius,
          source: 'public_page',
          openai_response_id: openaiResponseId,
        })
        .select('id')
        .single()

      if (insertError || !scan) {
        console.error('Failed to create intel scan record:', insertError)
        return NextResponse.json({ error: 'Failed to create scan' }, { status: 500 })
      }
      scanId = scan.id
    }

    return NextResponse.json({ scanId, status: 'researching' })
  } catch (error) {
    console.error('Intel scan error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
