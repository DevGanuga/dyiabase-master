import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendEmail, isResendConfigured } from '@/lib/resend/client'
import { welcomeEmail } from '@/lib/resend/templates'

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Missing CLERK_WEBHOOK_SECRET environment variable')
  }

  // Get the headers
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: 'Missing svix headers' },
      { status: 400 }
    )
  }

  // Get the body
  const payload = await req.json()
  const body = JSON.stringify(payload)

  // Create a new Svix instance with your secret
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: WebhookEvent

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Webhook verification failed:', err)
    return NextResponse.json(
      { error: 'Webhook verification failed' },
      { status: 400 }
    )
  }

  const supabase = getSupabase()
  const eventType = evt.type

  try {
    switch (eventType) {
      case 'user.created': {
        const { id, email_addresses, first_name, last_name } = evt.data
        const primaryEmail = email_addresses?.[0]?.email_address || ''

        // Calculate 14-day trial end date
        const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

        // Create user profile in Supabase with automatic 14-day trial
        const { data: newUser, error } = await supabase
          .from('dyia_users')
          .insert({
            clerk_user_id: id,
            email: primaryEmail,
            first_name: first_name || null,
            last_name: last_name || null,
            subscription_status: 'trialing',
            subscription_ends_at: trialEndsAt,
          })
          .select()
          .single()

        if (error) {
          // User might already exist (created on first app load)
          if (error.code !== '23505') { // Not a duplicate key error
            console.error('Error creating user:', error)
            throw error
          }
        } else if (newUser) {
          // Create default settings for the user
          await supabase
            .from('dyia_settings')
            .insert({ user_id: newUser.id })

          // Send welcome email if Resend is configured
          if (isResendConfigured() && primaryEmail) {
            try {
              await sendEmail(
                primaryEmail,
                'Welcome to Dyia! 🎉',
                welcomeEmail(first_name || 'there'),
                'welcome'
              )
            } catch (emailErr) {
              console.error('Welcome email failed:', emailErr)
            }
          }
        }

        console.log(`User created: ${id}`)
        break
      }

      case 'user.updated': {
        const { id, email_addresses, first_name, last_name } = evt.data
        const primaryEmail = email_addresses?.[0]?.email_address || ''

        const { error } = await supabase
          .from('dyia_users')
          .update({
            email: primaryEmail,
            first_name: first_name || null,
            last_name: last_name || null,
          })
          .eq('clerk_user_id', id)

        if (error) {
          console.error('Error updating user:', error)
          throw error
        }

        console.log(`User updated: ${id}`)
        break
      }

      case 'user.deleted': {
        const { id } = evt.data

        if (id) {
          // The CASCADE will handle deleting related settings, jobs, quotes
          const { error } = await supabase
            .from('dyia_users')
            .delete()
            .eq('clerk_user_id', id)

          if (error) {
            console.error('Error deleting user:', error)
            throw error
          }

          console.log(`User deleted: ${id}`)
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${eventType}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
