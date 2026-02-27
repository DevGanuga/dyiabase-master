import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getOpenAI, DYIA_INSTRUCTIONS, DYIA_MODEL } from '@/lib/openai/client'
import { DYIA_TOOLS, DyiaFunctionName } from '@/lib/openai/functions'
import { handleFunctionCall, HandlerResult } from '@/lib/openai/handlers'
import { rateLimiters } from '@/lib/rate-limit'
import {
  checkDailyBudget,
  recordUsage,
  estimateCostUsd,
  MAX_OUTPUT_TOKENS_CHAT,
  MAX_TOOL_ITERATIONS,
} from '@/lib/openai/guardrails'

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
  usage?: {
    input_tokens?: number
    output_tokens?: number
    total_tokens?: number
  }
}

export async function POST(req: NextRequest) {
  // Rate limit: 30 requests per minute per IP
  const rateLimited = rateLimiters.aiChat.check(req)
  if (rateLimited) return rateLimited

  try {
    // 1. Auth check
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get user profile and check subscription
    const { data: userProfile, error: userError } = await supabase
      .from('dyia_users')
      .select('id, subscription_status, ai_credits_balance, ai_credits_used_lifetime')
      .eq('clerk_user_id', clerkUserId)
      .single()

    if (userError || !userProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 3. Check AI access (Pro users OR users with credits)
    const isPro = ['active', 'trialing'].includes(userProfile.subscription_status)
    const hasCredits = (userProfile.ai_credits_balance || 0) > 0
    // When Pro monthly cap is set: check Pro credits used this month (e.g. from dyia_credit_transactions type 'usage') and deny if over cap
    const canUseAI = isPro || hasCredits

    if (!canUseAI) {
      return NextResponse.json(
        { error: 'AI credits required. Purchase credits or upgrade to Pro.', needsCredits: true },
        { status: 403 }
      )
    }

    // 4. Parse request
    const { message, conversationId, previousResponseId, fileUrl, fileName } = await req.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Budget guardrail: reject if daily spend cap is exceeded
    const budgetResult = await checkDailyBudget(supabase)
    if (!budgetResult.allowed) {
      return NextResponse.json(
        { error: budgetResult.message ?? 'Daily AI budget exceeded. Try again tomorrow.' },
        { status: 429 }
      )
    }

    const effectiveMessage = fileUrl
      ? `${message}\n\n[User attached a file: ${fileName || 'file'} — ${fileUrl}]`
      : message

    // 5. Build request params - use Record type to allow dynamic properties
    const requestParams: Record<string, unknown> = {
      model: DYIA_MODEL,
      instructions: DYIA_INSTRUCTIONS,
      input: effectiveMessage,
      tools: DYIA_TOOLS,
      temperature: 0.7,
      max_output_tokens: MAX_OUTPUT_TOKENS_CHAT,
      store: true,
      stream: false,
    }

    // If continuing a conversation, pass the previous response ID
    if (previousResponseId) {
      requestParams.previous_response_id = previousResponseId
    }

    // Cast and call API
    const openai = getOpenAI()
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
        max_output_tokens: MAX_OUTPUT_TOKENS_CHAT,
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

    // 8. Calculate and deduct AI credits for non-pro users
    const usage = response.usage || { total_tokens: 0, input_tokens: 0, output_tokens: 0 }
    const totalTokens = usage.total_tokens || 0
    const inputTokens = usage.input_tokens ?? Math.floor(totalTokens / 2)
    const outputTokens = usage.output_tokens ?? Math.floor(totalTokens / 2)
    const costEstimateUsd = estimateCostUsd(inputTokens, outputTokens, 'chat')
    await recordUsage(supabase, {
      tokensInput: inputTokens,
      tokensOutput: outputTokens,
      costEstimateUsd,
      source: 'chat',
    })

    // Credit cost: 1 credit per 500 tokens (minimum 1 credit if tokens used)
    const creditCost = isPro ? 0 : (totalTokens > 0 ? Math.max(1, Math.ceil(totalTokens / 500)) : 0)

    // Deduct credits for non-pro users
    if (!isPro && creditCost > 0) {
      const currentBalance = userProfile.ai_credits_balance || 0
      const newBalance = Math.max(0, currentBalance - creditCost)

      // Update user credit balance
      await supabase
        .from('dyia_users')
        .update({
          ai_credits_balance: newBalance,
          ai_credits_used_lifetime: (userProfile.ai_credits_used_lifetime || 0) + creditCost
        })
        .eq('id', userProfile.id)

      // Log credit transaction
      await supabase
        .from('dyia_credit_transactions')
        .insert({
          user_id: userProfile.id,
          type: 'usage',
          amount: -creditCost,
          balance_after: newBalance,
          description: `AI chat (${totalTokens} tokens)`,
          metadata: { tokens: totalTokens }
        })
    }

    // 9. Generate smart thread title based on content
    const generateSmartTitle = (userMessage: string, toolResults: HandlerResult[]): string => {
      // Check if any tool results have relevant data for title
      for (const result of toolResults) {
        if (result.pendingAction) {
          const action = result.pendingAction
          if (action.type === 'create_job' && action.proposal) {
            const proposal = action.proposal as Record<string, unknown>
            return `Job: ${proposal.customerName || 'New Job'}`
          }
          if (action.type === 'generate_quote' && action.proposal) {
            const proposal = action.proposal as Record<string, unknown>
            return `Quote: ${proposal.customerName || 'New Quote'}`
          }
        }
        // Check for stats requests
        if (result.data?.period) {
          return `Stats: ${result.data.period}`
        }
        // Check for follow-ups
        if (result.data?.followUps) {
          return 'Follow-ups Review'
        }
        // Check for price suggestion
        if (result.data?.suggestedLow) {
          return 'Price Suggestion'
        }
        // Check for business summary
        if (result.data?.topSources) {
          return `Summary: ${result.data.period || 'Business Overview'}`
        }
      }
      
      // Analyze message content for common patterns
      const lowerMessage = userMessage.toLowerCase()
      
      if (lowerMessage.includes('job') && (lowerMessage.includes('did') || lowerMessage.includes('completed') || lowerMessage.includes('finished'))) {
        // Extract customer name if present
        const nameMatch = userMessage.match(/for\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i)
        if (nameMatch) return `Job: ${nameMatch[1]}`
        return 'New Job'
      }
      
      if (lowerMessage.includes('quote') || lowerMessage.includes('estimate')) {
        const nameMatch = userMessage.match(/for\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i)
        if (nameMatch) return `Quote: ${nameMatch[1]}`
        return 'New Quote'
      }
      
      if (lowerMessage.includes('how did') || lowerMessage.includes('stats') || lowerMessage.includes('performance')) {
        return 'Performance Check'
      }
      
      if (lowerMessage.includes('follow') || lowerMessage.includes('pending')) {
        return 'Follow-ups'
      }
      
      if (lowerMessage.includes('charge') || lowerMessage.includes('price') || lowerMessage.includes('pricing')) {
        return 'Pricing Help'
      }
      
      if (lowerMessage.includes('summary') || lowerMessage.includes('overview')) {
        return 'Business Summary'
      }
      
      // Default: first 40 chars of message
      return userMessage.slice(0, 40) + (userMessage.length > 40 ? '...' : '')
    }

    // Save to database for thread persistence
    let threadId = conversationId

    if (!threadId) {
      // Generate a smart title
      const smartTitle = generateSmartTitle(message, toolResults)
      
      // Create new thread
      const { data: newThread, error: threadError } = await supabase
        .from('dyia_threads')
        .insert({
          user_id: userProfile.id,
          openai_thread_id: response.id,
          title: smartTitle.slice(0, 50),
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

    // 9. Build tool results with pending action info preserved
    const processedToolResults = toolResults.map(r => {
      // Include pendingAction if present (from proposal handlers)
      const result: Record<string, unknown> = {
        success: r.success,
        message: r.message,
        data: r.data,
        error: r.error
      }
      if (r.pendingAction) {
        result.pendingAction = r.pendingAction
      }
      return result
    }).filter(r => r.success || r.error)

    // Save messages with rich context
    if (threadId) {
      // Build enhanced tool results with pending action flags
      const enhancedToolResults = processedToolResults.length > 0 
        ? processedToolResults.map(r => ({
            ...r,
            status: r.pendingAction ? 'pending_confirmation' : 'completed'
          }))
        : null

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
          tool_results: enhancedToolResults,
          tokens_used: totalTokens || null,
          credit_cost: creditCost || null
        }
      ])

      // Update thread message count (simple increment)
      const { data: threadData } = await supabase
        .from('dyia_threads')
        .select('message_count')
        .eq('id', threadId)
        .single()
      
      if (threadData) {
        await supabase
          .from('dyia_threads')
          .update({ message_count: (threadData.message_count || 0) + 2 })
          .eq('id', threadId)
      }
    }

    // 11. Return response with response ID for stateful continuation
    const remainingCredits = isPro ? null : Math.max(0, (userProfile.ai_credits_balance || 0) - creditCost)

    return NextResponse.json({
      success: true,
      threadId,
      message: responseText,
      toolResults: processedToolResults,
      responseId: response.id,
      creditsUsed: creditCost,
      remainingCredits
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
