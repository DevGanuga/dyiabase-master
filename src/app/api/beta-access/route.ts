import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
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
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const googleEmail = typeof body.googleEmail === 'string' ? body.googleEmail.trim().toLowerCase() : ''
    const requestedFeature = typeof body.requestedFeature === 'string' ? body.requestedFeature.trim() : 'gmail_beta'
    const notes = typeof body.notes === 'string' ? body.notes.trim() : ''

    if (!googleEmail) {
      return NextResponse.json({ error: 'Google email is required.' }, { status: 400 })
    }

    if (!isValidEmail(googleEmail)) {
      return NextResponse.json({ error: 'Please enter a valid Google email address.' }, { status: 400 })
    }

    if (requestedFeature.length > 100 || notes.length > 2000) {
      return NextResponse.json({ error: 'One or more fields are too long.' }, { status: 400 })
    }

    const supabase = getSupabase()
    const { data: user, error: userError } = await supabase
      .from('dyia_users')
      .select('id, email, first_name, last_name')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found. Please sign in again.' }, { status: 404 })
    }

    const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.email
    const signupEmail = user.email?.trim().toLowerCase()

    const { data: existing } = await supabase
      .from('dyia_beta_access_requests')
      .select('id, status')
      .eq('signup_email', signupEmail)
      .eq('google_email', googleEmail)
      .eq('requested_feature', requestedFeature || 'gmail_beta')
      .in('status', ['pending', 'approved', 'google_added', 'invited'])
      .order('created_at', { ascending: false })
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({
        success: true,
        id: existing[0].id,
        alreadyExists: true,
        status: existing[0].status,
      })
    }

    const { data, error } = await supabase
      .from('dyia_beta_access_requests')
      .insert({
        name,
        signup_email: signupEmail,
        google_email: googleEmail,
        business_name: null,
        requested_feature: requestedFeature || 'gmail_beta',
        notes: notes || null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Beta access request insert error:', error)
      throw error
    }

    return NextResponse.json({ success: true, id: data.id, alreadyExists: false })
  } catch (error) {
    console.error('Beta access request POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit request' },
      { status: 500 }
    )
  }
}
