import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { openai, DYIA_INSTRUCTIONS, DYIA_MODEL, DYIA_MODEL_MINI } from '@/lib/openai/client'
import { DYIA_TOOLS, DyiaFunctionName } from '@/lib/openai/functions'
import { handleFunctionCall, HandlerResult } from '@/lib/openai/handlers'

// Initialize Supabase with service role for server operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Type for output items from the API
interface OutputItem {
  type: string
  name?: string
  arguments?: string
  call_id?: string
  role?: string
  content?: Array<{ type: string; text?: string }>
}

// Type for the response shape
interface ResponseData {
  id: string
  output: OutputItem[]
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get user profile and check subscription
    const { data: userProfile, error: userError } = await supabase
      .from('dyia_users')
      .select('id, subscription_status')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (userError || !userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 3. Check Pro access (allow trialing and active)
    const isPro = ['active', 'trialing'].includes(userProfile.subscription_status)
    if (!isPro) {
      return NextResponse.json(
        { error: 'Pro subscription required for AI Assistant' },
        { status: 403 }
      )
    }

    // 4. Parse request
    const { message, conversationId, previousResponseId } = await req.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // 5. Build request params - use Record type to allow dynamic properties
    const requestParams: Record<string, unknown> = {
      model: DYIA_MODEL,
      instructions: DYIA_INSTRUCTIONS,
      input: message,
      tools: DYIA_TOOLS,
      temperature: 0.7,
      max_output_tokens: 1024,
      store: true,
      stream: false,
    }

    // If continuing a conversation, pass the previous response ID
    if (previousResponseId) {
      requestParams.previous_response_id = previousResponseId
    }

    // Cast and call API
    let response = await openai.responses.create(
      requestParams as Parameters<typeof openai.responses.create>[0]
    ) as unknown as ResponseData

    // 6. Handle tool calls in an agentic loop
    const toolResults: HandlerResult[] = []
    let iterations = 0
    const maxIterations = 5

    // Check if the response requires action (has function_call items)
    const hasFunctionCalls = (output: OutputItem[]) => {
      return output.some(item => item.type === 'function_call')
    }

    while (hasFunctionCalls(response.output) && iterations < maxIterations) {
      iterations++

      // Get the tool calls from the response
      const toolCalls = response.output.filter(item => item.type === 'function_call')

      // Process each tool call
      const toolOutputs: Array<{ type: 'function_call_output'; call_id: string; output: string }> = []

      for (const toolCall of toolCalls) {
        if (toolCall.type !== 'function_call' || !toolCall.name || !toolCall.arguments || !toolCall.call_id) {
          continue
        }
        
        const functionName = toolCall.name as DyiaFunctionName
        const functionArgs = JSON.parse(toolCall.arguments)

        console.log(`[AI] Calling function: ${functionName}`, functionArgs)

        // Execute the function handler
        const result = await handleFunctionCall(functionName, functionArgs, clerkUserId)
        toolResults.push(result)

        // Add tool output
        toolOutputs.push({
          type: 'function_call_output',
          call_id: toolCall.call_id,
          output: JSON.stringify(result)
        })
      }

      // Continue the conversation with tool outputs
      const continueParams: Record<string, unknown> = {
        model: DYIA_MODEL,
        instructions: DYIA_INSTRUCTIONS,
        input: toolOutputs,
        tools: DYIA_TOOLS,
        temperature: 0.7,
        max_output_tokens: 1024,
        store: true,
        stream: false,
        previous_response_id: response.id,
      }

      response = await openai.responses.create(
        continueParams as Parameters<typeof openai.responses.create>[0]
      ) as unknown as ResponseData
    }

    // 7. Extract the assistant's text response
    let responseText = ''
    for (const item of response.output) {
      if (item.type === 'message' && item.role === 'assistant' && item.content) {
        for (const contentPart of item.content) {
          if (contentPart.type === 'output_text' && contentPart.text) {
            responseText += contentPart.text
          }
        }
      }
    }

    if (!responseText) {
      responseText = 'I processed your request.'
    }

    // 8. Save to database for thread persistence
    let threadId = conversationId

    if (!threadId) {
      // Create new thread
      const { data: newThread, error: threadError } = await supabase
        .from('dyia_threads')
        .insert({
          user_id: userProfile.id,
          openai_thread_id: response.id,
          title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
          message_count: 2,
          last_message_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (threadError) {
        console.error('Error creating thread:', threadError)
      } else {
        threadId = newThread.id
      }
    } else {
      // Update existing thread
      await supabase
        .from('dyia_threads')
        .update({
          last_message_at: new Date().toISOString()
        })
        .eq('id', threadId)
    }

    // Save messages
    if (threadId) {
      await supabase.from('dyia_messages').insert([
        {
          thread_id: threadId,
          role: 'user',
          content: message
        },
        {
          thread_id: threadId,
          role: 'assistant',
          content: responseText,
          tool_calls: toolResults.length > 0 ? response.output.filter(i => i.type === 'function_call') : null,
          tool_results: toolResults.length > 0 ? toolResults : null
        }
      ])
    }

    // 9. Return response with response ID for stateful continuation
    return NextResponse.json({
      success: true,
      threadId,
      message: responseText,
      toolResults: toolResults.filter(r => r.success || r.error),
      responseId: response.id
    })

  } catch (error) {
    console.error('[AI Chat Error]', error)
    
    // Handle specific OpenAI errors
    if (error instanceof Error) {
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Too many requests. Please wait a moment and try again.' },
          { status: 429 }
        )
      }
      if (error.message.includes('context_length')) {
        return NextResponse.json(
          { error: 'Conversation is too long. Please start a new chat.' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to process message. Please try again.' },
      { status: 500 }
    )
  }
}
