import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimiters } from '@/lib/rate-limit'

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(request: NextRequest) {
  const rateLimited = await rateLimiters.general.checkAsync(request)
  if (rateLimited) return rateLimited

  try {
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const signupEmail = typeof body.signupEmail === 'string' ? body.signupEmail.trim().toLowerCase() : ''
    const googleEmail = typeof body.googleEmail === 'string' ? body.googleEmail.trim().toLowerCase() : ''
    const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : ''
    const requestedFeature = typeof body.requestedFeature === 'string' ? body.requestedFeature.trim() : 'gmail_beta'
    const notes = typeof body.notes === 'string' ? body.notes.trim() : ''

    if (!name || !signupEmail || !googleEmail) {
      return NextResponse.json({ error: 'Name, signup email, and Google email are required.' }, { status: 400 })
    }

    if (!isValidEmail(signupEmail) || !isValidEmail(googleEmail)) {
      return NextResponse.json({ error: 'Please enter valid email addresses.' }, { status: 400 })
    }

    if (requestedFeature.length > 100 || businessName.length > 160 || notes.length > 2000) {
      return NextResponse.json({ error: 'One or more fields are too long.' }, { status: 400 })
    }

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('dyia_beta_access_requests')
      .insert({
        name,
        signup_email: signupEmail,
        google_email: googleEmail,
        business_name: businessName || null,
        requested_feature: requestedFeature || 'gmail_beta',
        notes: notes || null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Beta access request insert error:', error)
      throw error
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (error) {
    console.error('Beta access request POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit request' },
      { status: 500 }
    )
  }
}
