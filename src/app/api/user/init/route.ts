import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendEmail, isResendConfigured } from '@/lib/resend/client'
import { welcomeEmail } from '@/lib/resend/templates'

function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

const ADMIN_EMAILS = [
  'devganuga@initdev.co',
  'ricardo.bezi@initdev.co',
  'marco.aayala97@yahoo.com',
]

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email } = await req.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('dyia_users')
      .select('*')
      .eq('clerk_user_id', userId)
      .single()

    if (existingUser) {
      // Auto-elevate known admin emails if their role was reset
      const shouldBeAdmin = ADMIN_EMAILS.includes(existingUser.email?.toLowerCase())
      if (shouldBeAdmin && (!existingUser.is_admin || existingUser.role !== 'super_admin')) {
        const { data: elevated } = await supabase
          .from('dyia_users')
          .update({ is_admin: true, role: 'super_admin', subscription_status: 'active' })
          .eq('id', existingUser.id)
          .select('*')
          .single()
        if (elevated) return NextResponse.json({ profile: elevated })
      }
      return NextResponse.json({ profile: existingUser })
    }

    // Create user profile — subscription stays inactive until Stripe checkout completes
    const { data: newProfile, error: createError } = await supabase
      .from('dyia_users')
      .insert({
        clerk_user_id: userId,
        email: email,
        subscription_status: 'inactive',
      })
      .select()
      .single()

    if (createError) {
      // Duplicate key = Clerk webhook already created the row (race condition).
      // Re-fetch and return it instead of 500-ing.
      if (createError.code === '23505') {
        const { data: raceProfile } = await supabase
          .from('dyia_users')
          .select('*')
          .eq('clerk_user_id', userId)
          .single()
        if (raceProfile) {
          return NextResponse.json({ profile: raceProfile })
        }
      }
      console.error('Error creating user profile:', createError.message, createError.details, createError.code)
      return NextResponse.json({ error: createError.message || 'Failed to create profile' }, { status: 500 })
    }

    // Create default settings
    if (newProfile) {
      await supabase
        .from('dyia_settings')
        .insert({ user_id: newProfile.id })

      // Send welcome email if Resend is configured (covers case when app loads before Clerk webhook)
      if (isResendConfigured() && newProfile.email) {
        try {
          await sendEmail(
            newProfile.email,
            'Welcome to Dyia! 🎉',
            welcomeEmail(newProfile.first_name || 'there'),
            'welcome',
            newProfile.id
          )
        } catch (emailErr) {
          console.error('Welcome email failed:', emailErr)
        }
      }
    }

    return NextResponse.json({ profile: newProfile })
  } catch (error) {
    console.error('User init error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
