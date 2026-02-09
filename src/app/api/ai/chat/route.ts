import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getOpenAI, DYIA_INSTRUCTIONS, DYIA_MODEL } from '@/lib/openai/client'
import { DYIA_TOOLS, DyiaFunctionName } from '@/lib/openai/functions'
import { handleFunctionCall, HandlerResult } from '@/lib/openai/handlers'
import { getProMonthlyCreditsCap } from '@/lib/ai-credits'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Smart title generation ───
function generateSmartTitle(userMessage: string, toolResults: HandlerResult[]): string {
  for (const result of toolResults) {
    if (result.pendingAction) {
      const action = result.pendingAction
      if (action.type === 'create_job' && action.proposal) {
        const p = action.proposal as Record<string, unknown>
        return `Job: ${p.customerName || 'New Job'}`
      }
      if (action.type === 'generate_quote' && action.proposal) {
        const p = action.proposal as Record<string, unknown>
        return `Quote: ${p.customerName || 'New Quote'}`
      }
    }
    if (result.data?.period) return `Stats: ${result.data.period}`
    if (result.data?.followUps) return 'Follow-ups Review'
    if (result.data?.suggestedLow) return 'Price Suggestion'
    if (result.data?.topSources) return `Summary: ${result.data.period || 'Business Overview'}`
  }
  const lm = userMessage.toLowerCase()
  if (lm.includes('job') && (lm.includes('did') || lm.includes('completed') || lm.includes('finished'))) {
    const m = userMessage.match(/for\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i)
    return m ? `Job: ${m[1]}` : 'New Job'
  }
  if (lm.includes('quote') || lm.includes('estimate')) {
    const m = userMessage.match(/for\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i)
    return m ? `Quote: ${m[1]}` : 'New Quote'
  }
  if (lm.includes('how did') || lm.includes('stats') || lm.includes('performance')) return 'Performance Check'
  if (lm.includes('follow') || lm.includes('pending')) return 'Follow-ups'
  if (lm.includes('charge') || lm.includes('price')) return 'Pricing Help'
  if (lm.includes('summary') || lm.includes('overview')) return 'Business Summary'
  return userMessage.slice(0, 40) + (userMessage.length > 40 ? '...' : '')
}

export async function POST(req: NextRequest) {
  // ── 1. Auth ──
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  // ── 2. User profile & subscription ──
  const { data: userProfile, error: userError } = await supabase
    .from('dyia_users')
    .select('id, subscription_status, ai_credits_balance, ai_credits_used_lifetime')
    .eq('clerk_user_id', clerkUserId)
    .single()

  if (userError || !userProfile) {
    return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
  }

  const isPro = ['active', 'trialing'].includes(userProfile.subscription_status)
  const hasCredits = (userProfile.ai_credits_balance || 0) > 0
  getProMonthlyCreditsCap() // read cap (future use)
  const canUseAI = isPro || hasCredits

  if (!canUseAI) {
    return new Response(JSON.stringify({ error: 'AI credits required. Purchase credits or upgrade to Pro.', needsCredits: true }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  }

  // ── 3. Parse request ──
  const { message, conversationId, previousResponseId, fileUrl, fileName, fileContent } = await req.json()
  if (!message || typeof message !== 'string') {
    return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  // Build the effective message — include extracted file content if available
  let effectiveMessage = message
  if (fileUrl || fileContent) {
    if (fileContent) {
      effectiveMessage = `${message}\n\n[User attached: ${fileName || 'file'}]\n\nFile contents:\n${fileContent}`
    } else {
      effectiveMessage = `${message}\n\n[User attached a file: ${fileName || 'file'} — stored at ${fileUrl}]`
    }
  }

  // ── 4. Streaming SSE response ──
  const encoder = new TextEncoder()
  const openai = getOpenAI()

  const readable = new ReadableStream({
    async start(controller) {
      // Helper: send an SSE event
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        let fullText = ''
        const toolResults: HandlerResult[] = []
        let lastResponseId: string | null = null
        let totalTokens = 0

        // Build initial request params
        const requestParams: Record<string, unknown> = {
          model: DYIA_MODEL,
          instructions: DYIA_INSTRUCTIONS,
          input: effectiveMessage,
          tools: DYIA_TOOLS,
          temperature: 0.7,
          max_output_tokens: 1024,
          store: true,
          stream: true,
        }
        if (previousResponseId) {
          requestParams.previous_response_id = previousResponseId
        }

        // Agentic loop: stream → handle tools → stream again
        let iterations = 0
        const maxIterations = 5
        let needsContinuation = true

        while (needsContinuation && iterations < maxIterations) {
          iterations++
          needsContinuation = false

          // Create streaming request
          const stream = await openai.responses.create(
            requestParams as Parameters<typeof openai.responses.create>[0]
          )

          // Collect function call data during stream
          const pendingCalls: Map<string, { name: string; arguments: string; call_id: string }> = new Map()
          let currentCallId: string | null = null
          let currentCallName: string | null = null
          let currentCallArgs = ''

          // Process stream events
          for await (const event of stream as AsyncIterable<{ type: string; [key: string]: unknown }>) {
            const eventType = event.type as string

            // Text deltas → send to client immediately
            if (eventType === 'response.output_text.delta') {
              const delta = (event as { delta?: string }).delta || ''
              fullText += delta
              send({ type: 'delta', text: delta })
            }

            // Function call argument deltas → accumulate
            if (eventType === 'response.function_call_arguments.delta') {
              const delta = (event as { delta?: string }).delta || ''
              currentCallArgs += delta
            }

            // Function call output item added → capture name and call_id
            if (eventType === 'response.output_item.added') {
              const item = (event as { item?: { type?: string; name?: string; call_id?: string } }).item
              if (item?.type === 'function_call' && item.name && item.call_id) {
                currentCallId = item.call_id
                currentCallName = item.name
                currentCallArgs = ''
              }
            }

            // Function call arguments complete
            if (eventType === 'response.function_call_arguments.done') {
              if (currentCallId && currentCallName) {
                pendingCalls.set(currentCallId, {
                  name: currentCallName,
                  arguments: currentCallArgs,
                  call_id: currentCallId,
                })
              }
              currentCallId = null
              currentCallName = null
              currentCallArgs = ''
            }

            // Response completed → capture ID and usage
            if (eventType === 'response.completed') {
              const resp = (event as { response?: { id?: string; usage?: { total_tokens?: number } } }).response
              if (resp?.id) lastResponseId = resp.id
              if (resp?.usage?.total_tokens) totalTokens += resp.usage.total_tokens
            }
          }

          // ── Handle tool calls if any ──
          if (pendingCalls.size > 0) {
            const toolOutputs: Array<{ type: 'function_call_output'; call_id: string; output: string }> = []

            for (const [, call] of pendingCalls) {
              const functionName = call.name as DyiaFunctionName
              let functionArgs: Record<string, unknown> = {}
              try { functionArgs = JSON.parse(call.arguments) } catch { /* empty args */ }

              console.log(`[AI Stream] Calling function: ${functionName}`, functionArgs)
              send({ type: 'tool_calling', function: functionName })

              const result = await handleFunctionCall(functionName, functionArgs, clerkUserId)
              toolResults.push(result)

              // Send tool result to client
              const processedResult: Record<string, unknown> = {
                success: result.success,
                message: result.message,
                data: result.data,
                error: result.error,
              }
              if (result.pendingAction) {
                processedResult.pendingAction = result.pendingAction
              }
              send({ type: 'tool_result', result: processedResult })

              toolOutputs.push({
                type: 'function_call_output',
                call_id: call.call_id,
                output: JSON.stringify(result),
              })
            }

            // Continue the conversation with tool outputs (stream the follow-up)
            requestParams.input = toolOutputs
            requestParams.previous_response_id = lastResponseId
            requestParams.stream = true
            needsContinuation = true

            // Reset text for the continuation (new assistant message segment)
            // Don't reset fullText — we accumulate across the whole turn
          }
        }

        // ── 5. Post-stream: save to DB, deduct credits ──

        // Credit cost
        const creditCost = isPro ? 0 : (totalTokens > 0 ? Math.max(1, Math.ceil(totalTokens / 500)) : 0)

        if (!isPro && creditCost > 0) {
          const currentBalance = userProfile.ai_credits_balance || 0
          const newBalance = Math.max(0, currentBalance - creditCost)
          await supabase.from('dyia_users').update({
            ai_credits_balance: newBalance,
            ai_credits_used_lifetime: (userProfile.ai_credits_used_lifetime || 0) + creditCost,
          }).eq('id', userProfile.id)
          await supabase.from('dyia_credit_transactions').insert({
            user_id: userProfile.id, type: 'usage', amount: -creditCost,
            balance_after: newBalance, description: `AI chat (${totalTokens} tokens)`,
            metadata: { tokens: totalTokens },
          })
        }

        // Thread persistence
        let threadId = conversationId
        if (!threadId) {
          const smartTitle = generateSmartTitle(message, toolResults)
          const { data: newThread } = await supabase
            .from('dyia_threads')
            .insert({ user_id: userProfile.id, openai_thread_id: lastResponseId || '', title: smartTitle.slice(0, 50), message_count: 2, last_message_at: new Date().toISOString() })
            .select('id').single()
          if (newThread) threadId = newThread.id
        } else {
          await supabase.from('dyia_threads').update({ last_message_at: new Date().toISOString() }).eq('id', threadId)
        }

        // Save messages
        const processedToolResults = toolResults.map(r => {
          const result: Record<string, unknown> = { success: r.success, message: r.message, data: r.data, error: r.error }
          if (r.pendingAction) result.pendingAction = r.pendingAction
          return result
        }).filter(r => r.success || r.error)

        if (threadId) {
          const enhancedToolResults = processedToolResults.length > 0
            ? processedToolResults.map(r => ({ ...r, status: r.pendingAction ? 'pending_confirmation' : 'completed' }))
            : null
          await supabase.from('dyia_messages').insert([
            { thread_id: threadId, role: 'user', content: message },
            { thread_id: threadId, role: 'assistant', content: fullText || 'I processed your request.', tool_results: enhancedToolResults, tokens_used: totalTokens || null, credit_cost: creditCost || null },
          ])
          const { data: threadData } = await supabase.from('dyia_threads').select('message_count').eq('id', threadId).single()
          if (threadData) {
            await supabase.from('dyia_threads').update({ message_count: (threadData.message_count || 0) + 2 }).eq('id', threadId)
          }
        }

        // ── 6. Send final "done" event ──
        const remainingCredits = isPro ? null : Math.max(0, (userProfile.ai_credits_balance || 0) - creditCost)
        send({
          type: 'done',
          threadId,
          responseId: lastResponseId,
          toolResults: processedToolResults,
          creditsUsed: creditCost,
          remainingCredits,
        })

        controller.close()
      } catch (error) {
        console.error('[AI Chat Stream Error]', error)
        const errMsg = error instanceof Error ? error.message : 'Unknown error'
        const errorData = errMsg.includes('rate limit')
          ? { type: 'error', error: 'Too many requests. Please wait a moment and try again.' }
          : errMsg.includes('context_length')
            ? { type: 'error', error: 'Conversation is too long. Please start a new chat.' }
            : { type: 'error', error: 'Failed to process message. Please try again.' }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
