/**
 * OpenAI usage guardrails: token limits, budget thresholds, and cost estimates.
 * Keeps expected costs low (~$0.01–0.02 per chat turn, &lt;$0.01 per insight) and
 * enables optional budget threshold alerts via env (OPENAI_DAILY_BUDGET_USD, etc.).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>

/** Max output tokens per chat response (keeps responses concise and costs predictable) */
export const MAX_OUTPUT_TOKENS_CHAT = 1024

/** Max completion tokens for insight generation */
export const MAX_OUTPUT_TOKENS_INSIGHT = 500

/** Max tool-call iterations per chat request (prevents runaway agent loops) */
export const MAX_TOOL_ITERATIONS = 5

/** Max tokens for a single suggest_quote_price / lightweight completion */
export const MAX_OUTPUT_TOKENS_LIGHT = 512

/**
 * Rough cost per 1K tokens (USD) for cost estimation and alerts.
 * Update when switching models. Values are approximate (as of 2025).
 */
const COST_PER_1K = {
  /** gpt-4o-class: ~$2.50/1M input, ~$10/1M output → ~$0.0125 output per 1K */
  chat: { input: 0.0025, output: 0.01 },
  /** gpt-4o-mini-class: cheaper */
  mini: { input: 0.00015, output: 0.0006 },
} as const

export function estimateCostUsd(
  inputTokens: number,
  outputTokens: number,
  modelType: 'chat' | 'mini' = 'chat'
): number {
  const c = COST_PER_1K[modelType]
  return (inputTokens / 1000) * c.input + (outputTokens / 1000) * c.output
}

/** Optional daily budget cap (USD). When set, requests are rejected if daily usage exceeds this. */
export function getDailyBudgetUsd(): number | null {
  const raw = process.env.OPENAI_DAILY_BUDGET_USD
  if (raw === undefined || raw === '') return null
  const n = parseFloat(raw)
  return Number.isNaN(n) || n <= 0 ? null : n
}

/** Optional alert threshold (USD). When daily usage exceeds this, a warning is logged. */
export function getAlertThresholdUsd(): number | null {
  const raw = process.env.OPENAI_ALERT_THRESHOLD_USD
  if (raw === undefined || raw === '') return null
  const n = parseFloat(raw)
  return Number.isNaN(n) || n <= 0 ? null : n
}

/** Optional: alert when a single request exceeds this many tokens (log only). */
export function getAlertTokensPerRequest(): number | null {
  const raw = process.env.OPENAI_ALERT_TOKENS_PER_REQUEST
  if (raw === undefined || raw === '') return null
  const n = parseInt(raw, 10)
  return Number.isNaN(n) || n <= 0 ? null : n
}

export interface BudgetCheckResult {
  allowed: boolean
  dailyTotalUsd: number
  message?: string
}

/**
 * Check if we're within daily budget. Uses dyia_openai_usage when OPENAI_DAILY_BUDGET_USD is set.
 * If table is missing or budget not configured, returns allowed.
 */
export async function checkDailyBudget(supabase: AnySupabaseClient): Promise<BudgetCheckResult> {
  const budget = getDailyBudgetUsd()
  if (budget == null) {
    return { allowed: true, dailyTotalUsd: 0 }
  }

  try {
    const today = new Date().toISOString().slice(0, 10)
    const { data: rows, error } = await supabase
      .from('dyia_openai_usage')
      .select('cost_estimate_usd')
      .gte('created_at', `${today}T00:00:00Z`)

    if (error) {
      console.warn('[OpenAI guardrails] checkDailyBudget query error:', error.message)
      return { allowed: true, dailyTotalUsd: 0 }
    }

    const list = Array.isArray(rows) ? rows : []
    const dailyTotalUsd = list.reduce(
      (sum, r) => sum + (Number(r?.cost_estimate_usd) || 0),
      0
    )

    const allowed = dailyTotalUsd < budget
    const alertThreshold = getAlertThresholdUsd()
    if (alertThreshold != null && dailyTotalUsd >= alertThreshold) {
      console.warn(
        `[OpenAI guardrails] Daily usage ($${dailyTotalUsd.toFixed(4)}) has reached or exceeded alert threshold ($${alertThreshold})`
      )
    }
    return {
      allowed,
      dailyTotalUsd,
      message: allowed ? undefined : `Daily OpenAI budget ($${budget}) exceeded. Try again tomorrow.`,
    }
  } catch (err) {
    console.error('[OpenAI guardrails] checkDailyBudget error:', err)
    return { allowed: true, dailyTotalUsd: 0 }
  }
}

/**
 * Record usage for budget tracking and alerting. Call after each OpenAI request.
 */
export async function recordUsage(
  supabase: AnySupabaseClient,
  params: {
    tokensInput: number
    tokensOutput: number
    costEstimateUsd: number
    source: string
  }
): Promise<void> {
  try {
    const { error } = await supabase.from('dyia_openai_usage').insert({
      tokens_input: params.tokensInput,
      tokens_output: params.tokensOutput,
      cost_estimate_usd: params.costEstimateUsd,
      source: params.source,
    })
    if (error) console.warn('[OpenAI guardrails] recordUsage insert error:', error.message)
  } catch (err) {
    console.error('[OpenAI guardrails] recordUsage error:', err)
  }

  const alertTokens = getAlertTokensPerRequest()
  const totalTokens = params.tokensInput + params.tokensOutput
  if (alertTokens != null && totalTokens >= alertTokens) {
    console.warn(
      `[OpenAI guardrails] Single-request token usage (${totalTokens}) exceeded alert threshold (${alertTokens})`
    )
  }
}
