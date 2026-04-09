/**
 * Intel Research Agent — uses OpenAI Responses API with o4-mini-deep-research.
 *
 * Deep research runs can take several minutes. This module is designed for
 * serverless: startResearch() kicks off the job and returns instantly,
 * checkResearch() polls OpenAI once per call and returns the current status.
 * The frontend polls /api/intel/scan/status until the job completes.
 */

import OpenAI from 'openai'
import type { IntelResearchSource, IntelScanData } from '@/types/database'

const INTEL_MODEL = 'o4-mini-deep-research'

type OutputTextContent = {
  type?: string
  text?: string
  annotations?: Array<{ type?: string; url?: string; title?: string }>
}
type ResponseOutputItem = { type?: string; role?: string; content?: OutputTextContent[] }
type ResponseLike = {
  id: string
  status?: string
  output?: ResponseOutputItem[]
  output_text?: string
  error?: { message?: string } | null
  incomplete_details?: { reason?: string } | null
}

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set')
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

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
- top_competitors must contain exactly 5 real businesses sorted by rank. Include the target business itself in this list at its correct rank position.
- review_count_leader must be >= all competitor review counts in the list.
- missing_keywords must contain up to 15 local commercial-intent keywords.
- gbp_gaps must be actionable and specific.
- All output must be a single JSON object only.`

function buildResearchInput(input: IntelAgentInput): string {
  const location = [input.city, input.state].filter(Boolean).join(', ')
  const locationLabel = location || `zip code ${input.zipCode}`
  const servicesList = input.mainServices?.length ? input.mainServices.join(', ') : input.industry

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

// ── Public API ──────────────────────────────────────────────────────

/**
 * Kick off a deep research job. Returns the OpenAI response ID immediately.
 * The caller stores this ID and the frontend polls checkResearch().
 */
export async function startResearch(input: IntelAgentInput): Promise<string> {
  const openai = getOpenAI()

  const response = await (openai.responses.create as (...args: unknown[]) => Promise<unknown>)({
    model: INTEL_MODEL,
    instructions: DEEP_RESEARCH_INSTRUCTIONS,
    input: buildResearchInput(input),
    background: true,
    tools: [{
      type: 'web_search_preview' as const,
      user_location: {
        type: 'approximate' as const,
        country: 'US',
        city: input.city || undefined,
        region: input.state || undefined,
      },
    }],
    max_tool_calls: 15,
  }) as ResponseLike

  return response.id
}

export type ResearchStatus =
  | { done: false; status: string }
  | { done: true; result: IntelAgentResult }
  | { done: true; error: string }

/**
 * Check the status of a running deep research job. Each call is a single
 * OpenAI retrieve — no polling loop, no long-lived function.
 */
export async function checkResearch(responseId: string): Promise<ResearchStatus> {
  const openai = getOpenAI()
  const response = await openai.responses.retrieve(responseId) as unknown as ResponseLike

  if (response.status === 'queued' || response.status === 'in_progress') {
    return { done: false, status: response.status }
  }

  if (response.status === 'failed') {
    return { done: true, error: response.error?.message || 'Research failed' }
  }

  if (response.status === 'incomplete') {
    const text = extractResponseText(response)
    if (text) {
      try {
        return { done: true, result: buildResult(response) }
      } catch {
        // Output exists but wasn't parseable — still not done, treat as in-progress
        // so the caller can retry or the user sees a meaningful error
      }
    }
    return { done: true, error: `Research ended early (${response.incomplete_details?.reason || 'unknown reason'}). Please try again.` }
  }

  // status === 'completed'
  const text = extractResponseText(response)
  if (!text) {
    return { done: true, error: 'Research completed but returned empty output' }
  }

  try {
    return { done: true, result: buildResult(response) }
  } catch (err) {
    return { done: true, error: err instanceof Error ? err.message : 'Failed to parse research output' }
  }
}

// ── Internal helpers ────────────────────────────────────────────────

function buildResult(response: ResponseLike): IntelAgentResult {
  const responseText = extractResponseText(response)
  const parsedJson = parseJsonObject(responseText)
  const researchSources = extractSources(response)

  return {
    scanData: normalizeScanData(parsedJson),
    researchSources,
    responseId: response.id,
    model: INTEL_MODEL,
  }
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
    const first = cleaned.indexOf('{')
    const last = cleaned.lastIndexOf('}')
    if (first === -1 || last === -1 || last <= first) {
      throw new Error('Intel research did not return parseable JSON')
    }
    return JSON.parse(cleaned.slice(first, last + 1))
  }
}

function extractResponseText(response: ResponseLike): string {
  if (response.output_text) return response.output_text
  let output = ''
  for (const item of response.output || []) {
    if (item.type !== 'message' || item.role !== 'assistant') continue
    for (const part of item.content || []) {
      if (part.type === 'output_text' && part.text) output += part.text
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
      for (const ann of part.annotations || []) {
        if (ann.type !== 'url_citation' || !ann.url || seen.has(ann.url)) continue
        seen.add(ann.url)
        sources.push({ url: ann.url, title: ann.title || ann.url })
      }
    }
  }
  return sources
}

function toInt(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : fallback
}

function clampPct(v: unknown): number {
  return Math.max(0, Math.min(100, toInt(v)))
}

function normalizeScanData(raw: unknown): IntelScanData {
  const p = raw as Record<string, unknown>
  const topCompetitors = Array.isArray(p.top_competitors)
    ? (p.top_competitors as Record<string, unknown>[]).slice(0, 5).map((c, i) => ({
        name: typeof c.name === 'string' && c.name.trim() ? c.name.trim() : `Competitor ${i + 1}`,
        reviews: toInt(c.reviews),
        estimated_ad_spend: toInt(c.estimated_ad_spend),
        rank: toInt(c.rank, i + 1),
      }))
    : []
  const missingKw = Array.isArray(p.missing_keywords)
    ? (p.missing_keywords as unknown[]).filter((v): v is string => typeof v === 'string' && v.trim().length > 0).slice(0, 15)
    : []
  const gbpGaps = Array.isArray(p.gbp_gaps)
    ? (p.gbp_gaps as unknown[]).filter((v): v is string => typeof v === 'string' && v.trim().length > 0).slice(0, 10)
    : []
  const zips = Array.isArray(p.target_zip_codes)
    ? (p.target_zip_codes as unknown[]).filter((v): v is string => typeof v === 'string' && v.trim().length > 0).slice(0, 3)
    : []

  if (topCompetitors.length === 0) throw new Error('Intel agent returned no competitors')

  const gs = (p.gap_scores || {}) as Record<string, unknown>
  return {
    local_rank: Math.max(1, toInt(p.local_rank, 1)),
    total_competitors: Math.max(topCompetitors.length, toInt(p.total_competitors, topCompetitors.length)),
    review_count_mine: Math.max(0, toInt(p.review_count_mine)),
    review_count_leader: Math.max(topCompetitors.length > 0 ? Math.max(...topCompetitors.map(c => c.reviews)) : 0, toInt(p.review_count_leader)),
    review_gap: Math.max(0, toInt(p.review_gap)),
    missing_keywords: missingKw,
    missing_keywords_count: Math.max(missingKw.length, toInt(p.missing_keywords_count, missingKw.length)),
    competitor_ad_spend_avg: Math.max(0, toInt(p.competitor_ad_spend_avg)),
    top_competitors: topCompetitors,
    gbp_gaps: gbpGaps,
    gap_scores: { reviews_pct: clampPct(gs.reviews_pct), keywords_pct: clampPct(gs.keywords_pct), ads_pct: clampPct(gs.ads_pct), gbp_pct: clampPct(gs.gbp_pct) },
    scan_date: typeof p.scan_date === 'string' && p.scan_date ? p.scan_date : new Date().toISOString(),
    target_zip_codes: zips,
  }
}


