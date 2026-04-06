/**
 * POST /api/intel/scan
 * Public endpoint — runs competitive intelligence scan.
 * Requires email (gate). No auth required (public page).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runIntelAgent } from '@/lib/intel/agent'
import { INTEL_INDUSTRIES, INTEL_RADIUS_OPTIONS } from '@/types/database'
import { sendEmail, isResendConfigured } from '@/lib/resend/client'
import { intelFreeReportEmail } from '@/lib/resend/templates'
import { getBaseUrl } from '@/lib/env'

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

    // Check for existing incomplete scan with same email to avoid duplicates (spec: Section 8)
    const { data: existingScan } = await supabase
      .from('dyia_intel_scans')
      .select('id, scan_data, research_sources')
      .eq('email', email)
      .eq('source', 'public_page')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // If a completed scan already exists for this email, return it directly
    if (existingScan?.scan_data) {
      return NextResponse.json({
        scanId: existingScan.id,
        scanData: existingScan.scan_data,
        researchSources: existingScan.research_sources || null,
        actionPlanPreview: null,
      })
    }

    // Reuse existing pending row or create new one
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
        })
        .select('id')
        .single()

      if (insertError || !scan) {
        console.error('Failed to create intel scan record:', insertError)
        return NextResponse.json({ error: 'Failed to create scan' }, { status: 500 })
      }
      scanId = scan.id
    }

    // Run the AI agent
    let scanData
    let researchSources = null
    try {
      const intelResult = await runIntelAgent({
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
      }, { timeoutMs: 90_000 })
      scanData = intelResult.scanData
      researchSources = intelResult.researchSources
    } catch (agentError) {
      console.error('Intel agent failed:', agentError)

      if (isResendConfigured()) {
        const ownerEmail = process.env.SUPPORT_EMAIL || process.env.RESEND_FROM_EMAIL?.match(/<(.+)>/)?.[1]
        if (ownerEmail) {
          sendEmail(
            ownerEmail,
            `[Dyia Intel] Public scan failed for ${businessName}`,
            `<h2>Intel Scan Failure</h2>
             <p>A public page scan failed for <strong>${businessName}</strong> (${industry}, ${zipCode}).</p>
             <p>Lead email: ${email}</p>
             <p>Error: ${agentError instanceof Error ? agentError.message : 'Unknown'}</p>`,
            'intel_free_report',
          ).catch(() => {})
        }
      }

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
      .eq('id', scanId)

    if (updateError) {
      console.error('Failed to update scan with results:', updateError)
    }

    // Email the free report to the lead (spec 3.1 step 3/7)
    if (isResendConfigured()) {
      const baseUrl = getBaseUrl()
      sendEmail(
        email,
        `Your ${businessName} Competitive Report — Dyia Intel`,
        intelFreeReportEmail({
          businessName,
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
      scanId,
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
