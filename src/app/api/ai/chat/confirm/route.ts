import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { handleFunctionCall } from '@/lib/openai/handlers'
import type { DyiaFunctionName } from '@/lib/openai/functions'

// Initialize Supabase with service role for server operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get user profile
    const { data: userProfile, error: userError } = await supabase
      .from('dyia_users')
      .select('id, subscription_status')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (userError || !userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 3. Check AI access (Pro users OR users with credits — same as chat route)
    const isPro = ['active', 'trialing'].includes(userProfile.subscription_status)
    if (!isPro) {
      return NextResponse.json(
        { error: 'Dyia Pro subscription required. Upgrade to confirm AI actions.', needsUpgrade: true },
        { status: 403 }
      )
    }

    // 4. Parse request
    const { actionType, data, conversationId } = await req.json()

    if (!actionType || !data) {
      return NextResponse.json({ error: 'Action type and data are required' }, { status: 400 })
    }

    // 5. Validate action type
    const validActionTypes: DyiaFunctionName[] = ['create_job', 'generate_quote', 'log_expense']
    if (!validActionTypes.includes(actionType)) {
      return NextResponse.json({ error: 'Invalid action type' }, { status: 400 })
    }

    // 6. Execute the handler
    const result = await handleFunctionCall(actionType, data, clerkUserId)

    // 7. Generate appropriate success message. Include the resource UUID in a
    //    machine-parseable suffix so follow-up AI turns can reference it when
    //    calling update_job / convert_quote_to_job (BUG-011).
    let successMessage = result.message
    if (result.success) {
      if (actionType === 'create_job') {
        const profit = result.data?.profit as number || 0
        const customer = result.data?.customer || 'customer'
        const jobId = (result.data?.jobId as string) || ''
        successMessage = `Job saved for ${customer}! Your profit is $${profit.toLocaleString()}.${jobId ? ` (job_id: ${jobId})` : ''}`
      } else if (actionType === 'generate_quote') {
        const customer = result.data?.customer || 'customer'
        const estimate = result.data?.estimate || ''
        const quoteId = (result.data?.quoteId as string) || ''
        successMessage = `Quote created for ${customer} at ${estimate}. A follow-up has been scheduled.${quoteId ? ` (quote_id: ${quoteId})` : ''}`
      }
    }

    // 8. Update thread with confirmation message
    let threadId = conversationId

    if (threadId) {
      // Add confirmation message to thread
      await supabase.from('dyia_messages').insert({
        thread_id: threadId,
        role: 'assistant',
        content: successMessage,
        tool_results: [result]
      })

      // Update thread title if job was created
      if (result.success && actionType === 'create_job' && result.data) {
        const customer = result.data.customer as string || 'Job'
        const revenue = result.data.revenue as number || 0
        const newTitle = `Job: ${customer} - $${revenue.toLocaleString()}`
        
        await supabase
          .from('dyia_threads')
          .update({ 
            title: newTitle.slice(0, 50),
            last_message_at: new Date().toISOString()
          })
          .eq('id', threadId)
      } else if (result.success && actionType === 'generate_quote' && result.data) {
        const customer = result.data.customer as string || 'Quote'
        const description = result.data.description as string || ''
        const newTitle = `Quote: ${customer}${description ? ` - ${description.slice(0, 20)}` : ''}`
        
        await supabase
          .from('dyia_threads')
          .update({ 
            title: newTitle.slice(0, 50),
            last_message_at: new Date().toISOString()
          })
          .eq('id', threadId)
      }
    } else {
      // Create a new thread for the confirmation
      const title = actionType === 'create_job' 
        ? `Job: ${result.data?.customer || 'New Job'}`
        : `Quote: ${result.data?.customer || 'New Quote'}`

      const { data: newThread } = await supabase
        .from('dyia_threads')
        .insert({
          user_id: userProfile.id,
          openai_thread_id: `confirm-${Date.now()}`,
          title: title.slice(0, 50),
          message_count: 1,
          last_message_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (newThread) {
        threadId = newThread.id
        
        // Add the confirmation message
        await supabase.from('dyia_messages').insert({
          thread_id: threadId,
          role: 'assistant',
          content: successMessage,
          tool_results: [result]
        })
      }
    }

    // 9. Return response
    return NextResponse.json({
      success: result.success,
      threadId,
      message: successMessage,
      toolResults: [result],
      data: result.data
    })

  } catch (error) {
    console.error('[AI Confirm Error]', error)
    return NextResponse.json(
      { error: 'Failed to confirm action. Please try again.' },
      { status: 500 }
    )
  }
}
