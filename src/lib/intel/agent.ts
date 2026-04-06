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
  incomplete_details?: { reason?: string } | null
}

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const INTEL_MODEL = 'gpt-5.4'

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

function buildPrompt(input: IntelAgentInput): string {
  const location = [input.city, input.state].filter(Boolean).join(', ')
  const locationLabel = location || `zip code ${input.zipCode}`
  const servicesList = input.mainServices && input.mainServices.length > 0
    ? input.mainServices.join(', ')
    : input.industry

  const sections: string[] = []

  // --- CONTEXT ---
  sections.push(`# Competitive Intelligence Research Brief

You are conducting a competitive intelligence scan for a local service business. Your job is to produce a structured JSON report that a business owner will use to understand their competitive position in their local market.

## Target Business
- Business name: ${input.businessName}
- Industry: ${input.industry}
- Location: ${locationLabel} (zip: ${input.zipCode})
- Search radius: ${input.radiusMiles} miles
- Website: ${input.websiteUrl || 'Not provided'}`)

  if (input.googleBusinessUrl) {
    sections.push(`- Google Business Profile: ${input.googleBusinessUrl}`)
  }
  if (input.phone) {
    sections.push(`- Phone: ${input.phone}`)
  }
  if (input.mainServices && input.mainServices.length > 0) {
    sections.push(`- Services offered: ${servicesList}`)
  }
  if (input.yearsInBusiness) {
    sections.push(`- Years in business: ${input.yearsInBusiness}`)
  }
  if (input.teamSize) {
    sections.push(`- Team size: ${input.teamSize}`)
  }

  // --- RESEARCH METHODOLOGY ---
  sections.push(`

## Research Steps — Follow These In Order

### Step 1: Find the target business
Search for "${input.businessName}" in ${locationLabel}. Use the website, phone number, or Google Business Profile URL if provided to confirm you have the right business. Find their Google reviews count and note their Google Business Profile completeness (hours, photos, posts, service areas, Q&A, description).

### Step 2: Identify competitors
Search for "${input.industry} near ${input.zipCode}" and "${input.industry} in ${locationLabel}". Also search for "${servicesList} ${locationLabel}". Collect the top businesses that appear in Google Maps / local pack results and organic results within a ${input.radiusMiles}-mile radius. You need at least 5 competitors. For each one, find their name, Google review count, and note their online presence.

### Step 3: Rank the market
Based on Google Maps visibility, review counts, and organic search presence, rank all businesses you found (including the target). The business with the most reviews + highest Maps visibility = rank 1. Determine where the target business falls in this ranking. Count total competitors found.

### Step 4: Analyze the review gap
Compare the target business's Google review count to the #1 ranked competitor's review count. Calculate the gap. This is one of the most important metrics for the business owner.

### Step 5: Find keyword gaps
Search for commercial-intent keywords a potential customer would use to find this type of service in this area. Examples: "${input.industry} ${locationLabel}", "${input.industry} near me ${input.zipCode}", specific service keywords like "${servicesList} ${locationLabel}", "best ${input.industry} ${locationLabel}", "affordable ${input.industry} near ${input.zipCode}". Identify up to 15 keywords where competitors appear but the target business does not. These should be specific, local, commercially valuable search terms — not generic terms.

### Step 6: Analyze Google Business Profile gaps
Compare the target business's Google Business Profile to the #1 competitor's profile. Look for specific, actionable gaps: missing business hours, no recent Google posts, fewer photos, missing service area coverage, no Q&A section, missing business description, fewer categories selected, no products/services listed, missing attributes. Each gap should be something the business owner can fix.

### Step 7: Estimate competitor ad spend
Search for "${input.industry} ${locationLabel}" and note which competitors appear in Google Ads (sponsored results). For those running ads, estimate their monthly spend based on industry benchmarks for local service businesses ($200–$3,000/month range depending on market size and competition level). If no competitors are running ads, estimate $0. Calculate the average across the top 3 competitors.

### Step 8: Identify target zip codes
Determine the 3 zip codes within the ${input.radiusMiles}-mile radius that likely have the highest search volume for ${input.industry} services. These should be real zip codes near ${input.zipCode} — preferably more populated or commercially active areas.

### Step 9: Calculate gap scores
For each category, score how close the target business is to the market leader on a 0–100 scale:
- reviews_pct: (target reviews / leader reviews) × 100, capped at 100
- keywords_pct: rough estimate of what % of relevant local keywords the target ranks for vs the leader (based on your search findings)
- ads_pct: if the target runs ads, how does their presence compare to the top advertiser? (0 if no ads, 100 if matching)
- gbp_pct: how complete is the target's GBP vs the leader's? (based on gaps found in Step 6)

## Output Format

After completing all research steps, output a single JSON object with these exact fields. No markdown code fences. No prose before or after. Every field must be present with a real value — no nulls.

{
  "local_rank": <integer — target business rank from Step 3>,
  "total_competitors": <integer — total competitors found in Step 2>,
  "review_count_mine": <integer — target business Google review count>,
  "review_count_leader": <integer — #1 competitor Google review count>,
  "review_gap": <integer — leader reviews minus target reviews>,
  "missing_keywords": <array of up to 15 strings from Step 5>,
  "missing_keywords_count": <integer — length of missing_keywords array>,
  "competitor_ad_spend_avg": <integer — average monthly USD from Step 7>,
  "top_competitors": [
    { "name": "<real business name>", "reviews": <integer>, "estimated_ad_spend": <integer USD/month>, "rank": <integer> }
  ],
  "gbp_gaps": <array of specific actionable strings from Step 6>,
  "gap_scores": {
    "reviews_pct": <integer 0–100>,
    "keywords_pct": <integer 0–100>,
    "ads_pct": <integer 0–100>,
    "gbp_pct": <integer 0–100>
  },
  "scan_date": "${new Date().toISOString().slice(0, 10)}",
  "target_zip_codes": <array of exactly 3 zip code strings from Step 8>
}

top_competitors must have exactly 5 entries, sorted by rank (1 = best).
Every competitor name must be a real business you found during research — never invented.
Every number must be grounded in what you actually found — never fabricated.`)

  return sections.join('\n')
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

export async function runIntelAgent(
  input: IntelAgentInput,
  options: IntelAgentOptions = {}
): Promise<IntelAgentResult> {
  const openai = getOpenAI()
  const timeoutMs = options.timeoutMs ?? 90_000

  const initial = await openai.responses.create({
    model: INTEL_MODEL,
    input: buildPrompt(input),
    background: true,
    tools: [{ type: 'web_search' }],
    max_output_tokens: 5000,
  }) as unknown as ResponseLike

  let finalResponse = await pollUntilComplete(openai, initial.id, timeoutMs)

  // gpt-5.4 can occasionally end as incomplete after long web-search runs.
  // Give it one continuation turn instead of hard-failing immediately.
  if (finalResponse.status === 'incomplete') {
    finalResponse = await continueIncompleteResponse(openai, finalResponse.id, timeoutMs)
  }

  if (finalResponse.status && finalResponse.status !== 'completed') {
    throw new Error(
      finalResponse.error?.message ||
      finalResponse.incomplete_details?.reason ||
      `Intel research failed with status: ${finalResponse.status}`
    )
  }

  const responseText = extractResponseText(finalResponse)
  if (!responseText) {
    throw new Error('Intel research returned empty output')
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
