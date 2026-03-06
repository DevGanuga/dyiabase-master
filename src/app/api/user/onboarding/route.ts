import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function POST(req: Request) {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action } = body

    const supabase = getSupabaseAdmin()

    const { data: profile } = await supabase
      .from('dyia_users')
      .select('id')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const dyiaUserId = profile.id

    if (action === 'skip') {
      const { error } = await supabase
        .from('dyia_settings')
        .update({ onboarding_skipped: true })
        .eq('user_id', dyiaUserId)

      if (error) {
        console.error('Onboarding skip error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true })
    }

    // action === 'complete'
    const {
      firstName, lastName,
      businessName, businessPhone, businessEmail, businessAddress,
      logoUrl, taxPercentage, monthlyGoal, metadata,
      template,
    } = body

    // Update user name
    if (firstName !== undefined || lastName !== undefined) {
      await supabase
        .from('dyia_users')
        .update({ first_name: firstName || null, last_name: lastName || null })
        .eq('id', dyiaUserId)
    }

    // Update settings with full payload first, fallback to basic if metadata column is missing
    const settingsPayload = {
      business_name: businessName || null,
      business_phone: businessPhone || null,
      business_email: businessEmail || null,
      business_address: businessAddress || null,
      business_logo: logoUrl,
      tax_percentage: taxPercentage ?? 30,
      monthly_goal: monthlyGoal ?? 0,
      onboarding_completed: true,
      onboarding_skipped: false,
      onboarding_completed_at: new Date().toISOString(),
      metadata: metadata || {},
    }

    let { error: settingsError } = await supabase
      .from('dyia_settings')
      .update(settingsPayload)
      .eq('user_id', dyiaUserId)

    if (settingsError) {
      console.warn('Full settings update failed, trying without metadata:', settingsError.message)
      const { metadata: _m, ...basicPayload } = settingsPayload
      const { error: basicError } = await supabase
        .from('dyia_settings')
        .update(basicPayload)
        .eq('user_id', dyiaUserId)

      if (basicError) {
        console.error('Basic settings update also failed:', basicError)
        return NextResponse.json({ error: basicError.message }, { status: 500 })
      }
    }

    // Create price template if provided
    if (template?.name?.trim()) {
      const { error: templateError } = await supabase
        .from('dyia_price_templates')
        .insert({
          user_id: dyiaUserId,
          name: template.name.trim(),
          prices: template.prices,
          is_default: true,
        })

      if (templateError) {
        console.warn('Template creation failed:', templateError.message)
        // Non-fatal: user can create templates later in Settings
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Onboarding save error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
