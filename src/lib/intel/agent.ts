/**
 * Intel Research Agent — uses OpenAI Responses API + web search to generate
 * real competitive intelligence data backed by live web results.
 */

import OpenAI from 'openai'
import type { IntelResearchSource, IntelScanData } from '@/types/database'

const POLL_INTERVAL_MS = 2500

type OutputTextContent = {
  type?: string
  text?: string
  annotations?: Array<{
    type?: string
    url?: string
    title?: string
  }>
}

type ResponseOutputItem = {
  type?: string
  role?: string
  content?: OutputTextContent[]
}

type ResponseLike = {
  id: string
  status?: string
  output?: ResponseOutputItem[]
  output_text?: string
  error?: { message?: string } | null
}

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

function getCandidateModels(): string[] {
  if (process.env.OPENAI_INTEL_MODEL) {
    return [process.env.OPENAI_INTEL_MODEL]
  }

  return [
    'o4-mini-deep-research',
    'gpt-4.1',
    'gpt-4o',
  ]
}

export interface IntelAgentInput {
  businessName: string
  websiteUrl?: string
  zipCode: string
  industry: string
  radiusMiles: number
}

export interface IntelAgentOptions {
  timeoutMs?: number
}

export interface IntelAgentResult {
  scanData: IntelScanData
  researchSources: IntelResearchSource[]
  responseId: string
  model: string
}

const SYSTEM_PROMPT = `You are a competitive intelligence research analyst for local service businesses.

You MUST use live web research via the web_search tool. Do not rely on prior knowledge alone.
Do not invent competitors, review counts, or ranking positions. Every named competitor must be supported by web results.
When an exact value cannot be directly confirmed from search results, produce the most conservative evidence-based estimate you can and keep it realistic.

Return ONLY a JSON object matching this schema:
{
  "local_rank": <integer>,
  "total_competitors": <integer>,
  "review_count_mine": <integer>,
  "review_count_leader": <integer>,
  "review_gap": <integer>,
  "missing_keywords": <string[] up to 15>,
  "missing_keywords_count": <integer>,
  "competitor_ad_spend_avg": <integer>,
  "top_competitors": [
    { "name": <string>, "reviews": <integer>, "estimated_ad_spend": <integer>, "rank": <integer> }
  ],
  "gbp_gaps": <string[]>,
  "gap_scores": {
    "reviews_pct": <integer 0-100>,
    "keywords_pct": <integer 0-100>,
    "ads_pct": <integer 0-100>,
    "gbp_pct": <integer 0-100>
  },
  "scan_date": <ISO date string>,
  "target_zip_codes": <string[] exactly 3>
}

Rules:
- Use the business website if provided to identify the business accurately.
- Competitors must be within the target market implied by the provided zip code and radius.
- top_competitors must contain 5 entries sorted by rank.
- missing_keywords must be relevant local commercial-intent phrases for the business niche.
- gbp_gaps must be specific and actionable.
- competitor_ad_spend_avg is allowed to be estimated, but only from evidence-based reasoning.
- Do not use null values. Return integers or arrays for every field.
- Output JSON only. No markdown. No prose before or after the JSON.`

function buildPrompt(input: IntelAgentInput): string {
  return [
    'Research this local service business and produce the required competitive intelligence JSON.',
    '',
    `Business name: ${input.businessName}`,
    `Website: ${input.websiteUrl || 'Not provided'}`,
    `Primary zip code: ${input.zipCode}`,
    `Industry: ${input.industry}`,
    `Search radius: ${input.radiusMiles} miles`,
    '',
    'Research checklist:',
    '- Identify the actual business if possible.',
    '- Identify the top local competitors in the same service category.',
    '- Ground review counts and rankings in live search findings.',
    '- Infer keyword gaps and GBP gaps from competitor positioning and available business profiles/pages.',
    '- Use only evidence-backed competitor names.',
    '',
    'Return only the JSON object.',
  ].join('\n')
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim()
  if (!trimmed.startsWith('```')) return trimmed
  return trimmed.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim()
}

function parseJsonObject(text: string): unknown {
  const cleaned = stripCodeFences(text)

  try {
    return JSON.parse(cleaned)
  } catch {
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('Intel research did not return parseable JSON')
    }
    return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1))
  }
}

function parseJsonArray(text: string): unknown[] {
  const cleaned = stripCodeFences(text)

  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) return parsed
  } catch {
    const firstBracket = cleaned.indexOf('[')
    const lastBracket = cleaned.lastIndexOf(']')
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const parsed = JSON.parse(cleaned.slice(firstBracket, lastBracket + 1))
      if (Array.isArray(parsed)) return parsed
    }
  }

  return []
}

function extractResponseText(response: ResponseLike): string {
  if (response.output_text) return response.output_text

  let output = ''
  for (const item of response.output || []) {
    if (item.type !== 'message' || item.role !== 'assistant') continue
    for (const part of item.content || []) {
      if (part.type === 'output_text' && part.text) {
        output += part.text
      }
    }
  }
  return output
}

function extractSources(response: ResponseLike): IntelResearchSource[] {
  const seen = new Set<string>()
  const sources: IntelResearchSource[] = []

  for (const item of response.output || []) {
    if (item.type !== 'message' || item.role !== 'assistant') continue
    for (const part of item.content || []) {
      for (const annotation of part.annotations || []) {
        if (annotation.type !== 'url_citation' || !annotation.url) continue
        if (seen.has(annotation.url)) continue
        seen.add(annotation.url)
        sources.push({
          url: annotation.url,
          title: annotation.title || annotation.url,
        })
      }
    }
  }

  return sources
}

async function recoverSourcesFromFollowUp(
  openai: OpenAI,
  responseId: string,
  model: string
): Promise<IntelResearchSource[]> {
  const followUp = await openai.responses.create({
    model,
    previous_response_id: responseId,
    input: 'Return only a JSON array of the web sources you relied on in the previous answer. Each item must be {"title": string, "url": string}. No prose.',
    max_output_tokens: 1200,
  }) as unknown as ResponseLike

  const parsed = parseJsonArray(extractResponseText(followUp))
  const seen = new Set<string>()

  return parsed
    .filter((item): item is { title?: unknown; url?: unknown } => typeof item === 'object' && item !== null)
    .map(item => ({
      title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : '',
      url: typeof item.url === 'string' ? item.url.trim() : '',
    }))
    .filter(item => item.url.length > 0 && !seen.has(item.url) && (seen.add(item.url), true))
    .map(item => ({
      title: item.title || item.url,
      url: item.url,
    }))
}

function toInt(value: unknown, fallback = 0): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.round(n)
}

function clampPercent(value: unknown): number {
  return Math.max(0, Math.min(100, toInt(value)))
}

function normalizeScanData(raw: unknown): IntelScanData {
  const parsed = raw as Partial<IntelScanData> & {
    top_competitors?: Array<Record<string, unknown>>
    gap_scores?: Record<string, unknown>
  }

  const topCompetitors = Array.isArray(parsed.top_competitors)
    ? parsed.top_competitors.slice(0, 5).map((item, index) => ({
        name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : `Competitor ${index + 1}`,
        reviews: toInt(item.reviews),
        estimated_ad_spend: toInt(item.estimated_ad_spend),
        rank: toInt(item.rank, index + 1),
      }))
    : []

  const missingKeywords = Array.isArray(parsed.missing_keywords)
    ? parsed.missing_keywords
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .slice(0, 15)
    : []

  const gbpGaps = Array.isArray(parsed.gbp_gaps)
    ? parsed.gbp_gaps
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .slice(0, 10)
    : []

  const targetZipCodes = Array.isArray(parsed.target_zip_codes)
    ? parsed.target_zip_codes
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .slice(0, 3)
    : []

  if (topCompetitors.length === 0) {
    throw new Error('Intel agent returned no competitors')
  }

  return {
    local_rank: Math.max(1, toInt(parsed.local_rank, 1)),
    total_competitors: Math.max(topCompetitors.length, toInt(parsed.total_competitors, topCompetitors.length)),
    review_count_mine: Math.max(0, toInt(parsed.review_count_mine)),
    review_count_leader: Math.max(0, toInt(parsed.review_count_leader)),
    review_gap: Math.max(0, toInt(parsed.review_gap)),
    missing_keywords: missingKeywords,
    missing_keywords_count: Math.max(missingKeywords.length, toInt(parsed.missing_keywords_count, missingKeywords.length)),
    competitor_ad_spend_avg: Math.max(0, toInt(parsed.competitor_ad_spend_avg)),
    top_competitors: topCompetitors,
    gbp_gaps: gbpGaps,
    gap_scores: {
      reviews_pct: clampPercent(parsed.gap_scores?.reviews_pct),
      keywords_pct: clampPercent(parsed.gap_scores?.keywords_pct),
      ads_pct: clampPercent(parsed.gap_scores?.ads_pct),
      gbp_pct: clampPercent(parsed.gap_scores?.gbp_pct),
    },
    scan_date: typeof parsed.scan_date === 'string' && parsed.scan_date ? parsed.scan_date : new Date().toISOString(),
    target_zip_codes: targetZipCodes,
  }
}

async function pollUntilComplete(
  openai: OpenAI,
  responseId: string,
  timeoutMs: number
): Promise<ResponseLike> {
  const deadline = Date.now() + timeoutMs
  let response = await openai.responses.retrieve(responseId) as unknown as ResponseLike

  while (response.status === 'queued' || response.status === 'in_progress') {
    if (Date.now() >= deadline) {
      throw new Error('Intel research timed out before completion')
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
    response = await openai.responses.retrieve(responseId) as unknown as ResponseLike
  }

  return response
}

export async function runIntelAgent(
  input: IntelAgentInput,
  options: IntelAgentOptions = {}
): Promise<IntelAgentResult> {
  const openai = getOpenAI()
  const timeoutMs = options.timeoutMs ?? 90_000
  const candidateModels = getCandidateModels()
  let lastError: unknown = null

  for (const model of candidateModels) {
    try {
      const initial = await openai.responses.create({
        model,
        input: buildPrompt(input),
        background: true,
        tools: [{ type: 'web_search' }],
        max_output_tokens: 3000,
      }) as unknown as ResponseLike

      const finalResponse = await pollUntilComplete(openai, initial.id, timeoutMs)

      if (finalResponse.status && finalResponse.status !== 'completed') {
        throw new Error(finalResponse.error?.message || `Intel research failed with status: ${finalResponse.status}`)
      }

      const responseText = stripCodeFences(extractResponseText(finalResponse))
      if (!responseText) {
        throw new Error('Intel research returned empty output')
      }

      const parsedJson = parseJsonObject(responseText)

      let researchSources = extractSources(finalResponse)
      if (researchSources.length === 0) {
        researchSources = await recoverSourcesFromFollowUp(openai, finalResponse.id, model)
      }

      return {
        scanData: normalizeScanData(parsedJson),
        researchSources,
        responseId: finalResponse.id,
        model,
      }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Intel research failed on all configured OpenAI models')
}
