/**
 * GET /api/intel/report?session_id=xxx OR ?scan_id=xxx
 * Returns the full report + action plan after Stripe payment is verified,
 * or a scan by ID for CRM users.
 */

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { generateActionPlan } from '@/lib/intel/action-plan'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  const scanId = searchParams.get('scan_id')

  const supabase = getSupabase()

  try {
    if (sessionId) {
      // Payment flow — verify Stripe session and return full report
      const stripe = getStripe()
      const session = await stripe.checkout.sessions.retrieve(sessionId)

      if (session.payment_status !== 'paid') {
        return NextResponse.json({ error: 'Payment not completed' }, { status: 402 })
      }

      const metaScanId = session.metadata?.scan_id
      if (!metaScanId) {
        return NextResponse.json({ error: 'Invalid session metadata' }, { status: 400 })
      }

      // Mark as purchased
      await supabase
        .from('dyia_intel_scans')
        .update({
          stripe_session_id: sessionId,
          action_plan_purchased: true,
        })
        .eq('id', metaScanId)

      // Fetch the scan
      const { data: scan, error } = await supabase
        .from('dyia_intel_scans')
        .select('*')
        .eq('id', metaScanId)
        .single()

      if (error || !scan) {
        return NextResponse.json({ error: 'Scan not found' }, { status: 404 })
      }

      // Generate action plan if missing — this is a paid customer, so failure is critical
      if (!scan.action_plan && scan.scan_data) {
        try {
          const actionPlan = await generateActionPlan(scan.scan_data, scan.business_name)
          await supabase
            .from('dyia_intel_scans')
            .update({ action_plan: actionPlan })
            .eq('id', metaScanId)
          scan.action_plan = actionPlan
        } catch (err) {
          console.error('Failed to generate action plan post-purchase:', err)
          return NextResponse.json(
            { error: 'Your action plan is still being generated. Please refresh in a moment.' },
            { status: 503 }
          )
        }
      }

      return NextResponse.json({
        scan: {
          id: scan.id,
          businessName: scan.business_name,
          zipCode: scan.zip_code,
          industry: scan.industry,
          radiusMiles: scan.radius_miles,
          scanData: scan.scan_data,
          researchSources: scan.research_sources,
          researchReport: scan.research_report || null,
          actionPlan: scan.action_plan,
          createdAt: scan.created_at,
        },
      })
    }

    if (scanId) {
      // Direct scan lookup (for CRM users or returning visitors)
      const { data: scan, error } = await supabase
        .from('dyia_intel_scans')
        .select('*')
        .eq('id', scanId)
        .single()

      if (error || !scan) {
        return NextResponse.json({ error: 'Scan not found' }, { status: 404 })
      }

      const includeActionPlan = scan.action_plan_purchased || scan.source === 'crm_monthly'

      return NextResponse.json({
        scan: {
          id: scan.id,
          businessName: scan.business_name,
          zipCode: scan.zip_code,
          industry: scan.industry,
          radiusMiles: scan.radius_miles,
          scanData: scan.scan_data,
          researchSources: scan.research_sources,
          researchReport: scan.research_report || null,
          actionPlan: includeActionPlan ? scan.action_plan : null,
          actionPlanPreview: !includeActionPlan
            ? scan.action_plan?.filter((s: { include_in_free_preview: boolean }) => s.include_in_free_preview)
            : null,
          actionPlanPurchased: scan.action_plan_purchased,
          createdAt: scan.created_at,
        },
      })
    }

    return NextResponse.json({ error: 'Provide session_id or scan_id' }, { status: 400 })
  } catch (error) {
    console.error('Intel report error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
