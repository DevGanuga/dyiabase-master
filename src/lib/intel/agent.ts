/**
 * Intel Research Agent — uses OpenAI Responses API + web search to generate
 * real competitive intelligence data backed by live web results.
 */

import OpenAI from 'openai'
import type { IntelResearchSource, IntelScanData } from '@/types/database'

const POLL_INTERVAL_MS = 2500
const MAX_CONTINUATIONS = 3

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
  incomplete_details?: { reason?: string } | null
}

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const INTEL_MODEL = 'o4-mini-deep-research'

export interface IntelAgentInput {
  businessName: string
  websiteUrl?: string
  zipCode: string
  city?: string
  state?: string
  industry: string
  radiusMiles: number
  phone?: string
  googleBusinessUrl?: string
  mainServices?: string[]
  yearsInBusiness?: number
  teamSize?: number
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

const DEEP_RESEARCH_INSTRUCTIONS = `You are a competitive intelligence researcher for local service businesses.

Use the web_search tool to do a real market scan. Do not rely on prior knowledge alone.
Do not invent competitors, rankings, review counts, ad-spend signals, or GBP gaps.
If a value cannot be directly observed, infer it conservatively from evidence gathered during research.

Research workflow:
1. Identify the target business using website, phone, name, and Google Business Profile URL if provided.
2. Find local competitors in the provided service area.
3. Compare Google review counts, Maps/local-pack visibility, organic visibility, and GBP completeness.
4. Identify keyword gaps using commercial-intent local searches.
5. Estimate competitor ad presence/spend conservatively from search evidence.
6. Return only the final JSON object, with no prose or markdown.

Output rules:
- Every field in the schema must be present.
- No null values.
- top_competitors must contain exactly 5 real businesses sorted by rank.
- missing_keywords must contain up to 15 local commercial-intent keywords.
- gbp_gaps must be actionable.
- All output must be a single JSON object only.`

function buildResearchInput(input: IntelAgentInput): string {
  const location = [input.city, input.state].filter(Boolean).join(', ')
  const locationLabel = location || `zip code ${input.zipCode}`
  const servicesList = input.mainServices && input.mainServices.length > 0
    ? input.mainServices.join(', ')
    : input.industry

  const lines: string[] = [
    '# Competitive Intelligence Research Brief',
    '',
    '## Target Business',
    `- Business name: ${input.businessName}`,
    `- Industry: ${input.industry}`,
    `- Location: ${locationLabel} (zip: ${input.zipCode})`,
    `- Search radius: ${input.radiusMiles} miles`,
    `- Website: ${input.websiteUrl || 'Not provided'}`,
  ]

  if (input.googleBusinessUrl) lines.push(`- Google Business Profile: ${input.googleBusinessUrl}`)
  if (input.phone) lines.push(`- Phone: ${input.phone}`)
  if (input.mainServices?.length) lines.push(`- Services offered: ${servicesList}`)
  if (input.yearsInBusiness) lines.push(`- Years in business: ${input.yearsInBusiness}`)
  if (input.teamSize) lines.push(`- Team size: ${input.teamSize}`)

  lines.push(
    '',
    '## Required Research Tasks',
    `1. Find the exact target business in ${locationLabel} using the name, website, phone, and GBP URL if available.`,
    `2. Search for ${input.industry} and ${servicesList} providers within ${input.radiusMiles} miles of ${input.zipCode}.`,
    '3. Build a ranked list of the top 5 real competitors based on local-pack/Maps presence, review strength, and organic visibility.',
    '4. Find the target business review count and the leader review count.',
    '5. Identify up to 15 commercial-intent local keywords competitors rank for but the target business does not.',
    '6. Identify actionable GBP gaps by comparing the target business vs the top competitor.',
    '7. Estimate average monthly competitor ad spend from live search evidence.',
    '8. Identify the top 3 nearby zip codes with likely highest search demand.',
    '9. Compute gap scores for reviews, keywords, ads, and GBP completeness.',
    '',
    '## JSON Schema',
    '{',
    '  "local_rank": <integer>,',
    '  "total_competitors": <integer>,',
    '  "review_count_mine": <integer>,',
    '  "review_count_leader": <integer>,',
    '  "review_gap": <integer>,',
    '  "missing_keywords": <string[] up to 15>,',
    '  "missing_keywords_count": <integer>,',
    '  "competitor_ad_spend_avg": <integer>,',
    '  "top_competitors": [',
    '    { "name": "<real business name>", "reviews": <integer>, "estimated_ad_spend": <integer>, "rank": <integer> }',
    '  ],',
    '  "gbp_gaps": <string[]>,',
    '  "gap_scores": {',
    '    "reviews_pct": <integer 0-100>,',
    '    "keywords_pct": <integer 0-100>,',
    '    "ads_pct": <integer 0-100>,',
    '    "gbp_pct": <integer 0-100>',
    '  },',
    `  "scan_date": "${new Date().toISOString().slice(0, 10)}",`,
    '  "target_zip_codes": <string[] exactly 3>',
    '}',
    '',
    'Return only the JSON object. No prose. No markdown. No code fences.',
  )

  return lines.join('\n')
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

async function continueIncompleteResponse(
  openai: OpenAI,
  responseId: string,
  timeoutMs: number
): Promise<ResponseLike> {
  const continuation = await openai.responses.create({
    model: INTEL_MODEL,
    previous_response_id: responseId,
    input: 'Continue the previous competitive intelligence research and output only the final JSON object now. No prose. No markdown.',
    background: true,
    tools: [{ type: 'web_search' }],
    max_output_tokens: 5000,
  }) as unknown as ResponseLike

  return await pollUntilComplete(openai, continuation.id, timeoutMs)
}

function hasUsableOutput(response: ResponseLike): boolean {
  return extractResponseText(response).trim().length > 0
}

export async function runIntelAgent(
  input: IntelAgentInput,
  options: IntelAgentOptions = {}
): Promise<IntelAgentResult> {
  const openai = getOpenAI()
  const timeoutMs = options.timeoutMs ?? 90_000

  const initial = await openai.responses.create({
    model: INTEL_MODEL,
    instructions: DEEP_RESEARCH_INSTRUCTIONS,
    input: buildResearchInput(input),
    background: true,
    tools: [{ type: 'web_search' }],
    max_output_tokens: 5000,
  }) as unknown as ResponseLike

  let finalResponse = await pollUntilComplete(openai, initial.id, timeoutMs)

  // gpt-5.4 can occasionally end as incomplete after long web-search runs.
  // Continue up to MAX_CONTINUATIONS times before failing.
  let continuations = 0
  while (
    (finalResponse.status === 'incomplete' || !hasUsableOutput(finalResponse)) &&
    continuations < MAX_CONTINUATIONS
  ) {
    continuations++
    finalResponse = await continueIncompleteResponse(openai, finalResponse.id, timeoutMs)
  }

  if (finalResponse.status && finalResponse.status !== 'completed') {
    throw new Error(
      finalResponse.error?.message ||
      finalResponse.incomplete_details?.reason ||
      `Intel research failed with status: ${finalResponse.status} after ${continuations} continuation attempts`
    )
  }

  const responseText = extractResponseText(finalResponse)
  if (!responseText) {
    throw new Error(`Intel research returned empty output after ${continuations} continuation attempts`)
  }

  const parsedJson = parseJsonObject(responseText)

  let researchSources = extractSources(finalResponse)
  if (researchSources.length === 0) {
    researchSources = await recoverSourcesFromFollowUp(openai, finalResponse.id, INTEL_MODEL)
  }

  return {
    scanData: normalizeScanData(parsedJson),
    researchSources,
    responseId: finalResponse.id,
    model: INTEL_MODEL,
  }
}
