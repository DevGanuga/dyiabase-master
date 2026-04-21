/**
 * Intel Research Agent — uses OpenAI deep research to produce a comprehensive
 * competitive intelligence report with narrative analysis + structured data.
 *
 * Architecture: the deep research model produces a FULL NARRATIVE REPORT
 * (like a research analyst would write) with a structured JSON block at the end.
 * We store both the narrative and the extracted data.
 */

import OpenAI from 'openai'
import type { IntelResearchSource, IntelScanData } from '@/types/database'
import type { PlaceBusiness } from '@/lib/intel/places'

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
  verifiedTarget?: PlaceBusiness | null
  verifiedCompetitors?: PlaceBusiness[]
}

export interface IntelAgentResult {
  scanData: IntelScanData
  researchReport: string
  researchSources: IntelResearchSource[]
  responseId: string
  model: string
}

const DEEP_RESEARCH_INSTRUCTIONS = `You are a competitive intelligence analyst producing a professional market research report for a local service business owner.

ACCURACY IS CRITICAL:
- You MUST search for every business by name and open their Google Business Profile or Google Maps page to verify their exact review count. Do NOT estimate or guess review counts.
- Every competitor name, review count, and data point must come from an actual web search result.
- If you cannot verify a number, say so explicitly rather than inventing one.

Your output must have TWO parts:

PART 1 — NARRATIVE RESEARCH REPORT (in markdown):
Write a comprehensive, analytical report that a business owner would find genuinely valuable. Include:

## Executive Summary
Write a compelling 3-4 paragraph executive summary that covers:
- **Current Market Position**: Where the business stands in the competitive landscape (rank, review count vs competitors)
- **Key Competitive Gaps**: The most critical areas where competitors are outperforming (reviews, keywords, ads, GBP)
- **Biggest Opportunity**: The single highest-impact action that could improve competitive position
- **Strategic Recommendation**: A clear, specific 30-day action plan

Use specific numbers and data points. Make it actionable and business-focused.

## Market Overview
- Total number of competitors found in the service area
- Market saturation assessment (undersaturated, competitive, or oversaturated)
- Key trends in this local market (growing demand, new entrants, pricing pressure, etc.)

## Competitor Deep Dive
For each of the top 5 competitors, include:
- Business name and verified Google review count (cite where you found it)
- Their apparent strengths (what they do well online)
- Their weaknesses (gaps you identified)
- Estimated monthly ad spend and whether they run Google Ads

## Review Analysis
- The target business's verified review count vs the market leader
- Review velocity comparison (if observable — are competitors getting reviews faster?)
- Review quality observations (average star rating if visible)
- Specific recommendations for closing the review gap

## Keyword & SEO Gap Analysis
- List specific keywords competitors rank for that the target business does not
- For each keyword, note which competitor(s) appear and where the target business is missing
- Local SEO observations (Maps pack positioning, organic ranking signals)

## Google Business Profile Audit
- Specific gaps in the target business's GBP vs the top competitor
- Each gap should be actionable (e.g., "Missing: business description with service keywords", "No Google Posts in the last 30 days")

## Advertising Landscape
- Which competitors are running Google Ads in this market
- Estimated monthly spend levels
- Ad copy patterns or positioning observations

## Market Positioning Analysis
- Where the target business sits in the market (challenger, established, new entrant, dominant, or niche)
- What positioning the top competitors use (price leader, premium, fastest response, most reviews, widest coverage)
- Gaps in the market that the target business could exploit
- Service area overlap with top competitors

## Pricing & Value Signals
- Any pricing information visible from competitor websites or ads
- How competitors position their pricing (free estimates, flat rate, hourly, by-the-load)
- Whether the target business's pricing positioning is competitive based on available evidence

## Opportunity Assessment
- Top 3 highest-impact actions the business should take immediately, ranked by effort vs. impact
- Expected timeline to see results for each action (e.g., "2-4 weeks for review velocity improvement")
- What the business is doing well that should be maintained and leveraged
- Specific competitive advantages the business has over at least one competitor

## Bottom Line
A direct, honest 2-3 sentence assessment: what is the single most important thing this business should do in the next 30 days to improve their competitive position, and why.

PART 2 — STRUCTURED DATA (as a JSON code block at the very end):
After the narrative report, include a JSON code block with this exact schema:

\`\`\`json
{
  "local_rank": <integer>,
  "total_competitors": <integer>,
  "review_count_mine": <integer — VERIFIED from Google>,
  "review_count_leader": <integer — VERIFIED from Google>,
  "review_gap": <integer>,
  "missing_keywords": [<up to 15 strings>],
  "missing_keywords_count": <integer>,
  "competitor_ad_spend_avg": <integer>,
  "top_competitors": [
    {"name": "<verified name>", "reviews": <verified integer>, "estimated_ad_spend": <integer>, "rank": <integer>}
  ],
  "gbp_gaps": [<specific actionable strings>],
  "gap_scores": {
    "reviews_pct": <0-100>,
    "keywords_pct": <0-100>,
    "ads_pct": <0-100>,
    "gbp_pct": <0-100>
  },
  "scan_date": "<today's date ISO>",
  "target_zip_codes": [<3 strings>]
}
\`\`\`

Include inline citations throughout the narrative using [source title](url) format.`

function buildResearchInput(input: IntelAgentInput): string {
  const location = [input.city, input.state].filter(Boolean).join(', ')
  const locationLabel = location || `zip code ${input.zipCode}`
  const servicesList = input.mainServices?.length ? input.mainServices.join(', ') : input.industry

  const lines: string[] = [
    `Produce a full competitive intelligence report for this local service business:`,
    ``,
    `Business: ${input.businessName}`,
    `Industry: ${input.industry}`,
    `Location: ${locationLabel} (zip: ${input.zipCode})`,
    `Search radius: ${input.radiusMiles} miles`,
    `Website: ${input.websiteUrl || 'Not provided'}`,
  ]

  if (input.googleBusinessUrl) lines.push(`Google Business Profile: ${input.googleBusinessUrl}`)
  if (input.phone) lines.push(`Phone: ${input.phone}`)
  if (input.mainServices?.length) lines.push(`Services: ${servicesList}`)
  if (input.yearsInBusiness) lines.push(`Years in business: ${input.yearsInBusiness}`)
  if (input.teamSize) lines.push(`Team size: ${input.teamSize}`)

  lines.push(
    ``,
    `Research requirements:`,
    `1. Search for "${input.businessName}" in ${locationLabel} and VERIFY their exact Google review count from their actual listing.`,
    `2. Search "${input.industry} ${locationLabel}" and "${input.industry} near ${input.zipCode}" to find competitors.`,
    `3. For each competitor, verify their review count from their actual Google listing.`,
    `4. Search commercial keywords like "${input.industry} ${locationLabel}", "best ${input.industry} ${locationLabel}", "${servicesList} near ${input.zipCode}" and note which businesses appear.`,
    `5. Check for Google Ads in "${input.industry} ${locationLabel}" results.`,
    `6. Produce the full narrative report + JSON data block as specified in the instructions.`,
    ``,
    `Today's date for scan_date: ${new Date().toISOString().slice(0, 10)}`,
  )

  return lines.join('\n')
}

// ── Public API ──────────────────────────────────────────────────────

export async function startResearch(input: IntelAgentInput): Promise<string> {
  const openai = getOpenAI()

  const response = await (openai.responses.create as (...args: unknown[]) => Promise<unknown>)({
    model: INTEL_MODEL,
    instructions: DEEP_RESEARCH_INSTRUCTIONS,
    input: buildResearchInput(input),
    background: true,
    tools: [
      { type: 'web_search_preview' },
      { type: 'code_interpreter', container: { type: 'auto' } },
    ],
    max_tool_calls: 25,
  }) as ResponseLike

  return response.id
}

export type ResearchStatus =
  | { done: false; status: string }
  | { done: true; result: IntelAgentResult }
  | { done: true; error: string }

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
      try { return { done: true, result: buildResult(response) } }
      catch { /* fall through */ }
    }
    return { done: true, error: `Research ended early (${response.incomplete_details?.reason || 'unknown'}). Please try again.` }
  }

  const text = extractResponseText(response)
  if (!text) return { done: true, error: 'Research completed but returned empty output' }

  try { return { done: true, result: buildResult(response) } }
  catch (err) { return { done: true, error: err instanceof Error ? err.message : 'Failed to parse research output' } }
}

// ── Internal helpers ────────────────────────────────────────────────

function buildResult(response: ResponseLike): IntelAgentResult {
  const fullText = extractResponseText(response)
  const { narrative, jsonBlock } = splitReportAndJson(fullText)
  const parsedJson = parseJsonObject(jsonBlock)
  const researchSources = extractSources(response)

  return {
    scanData: normalizeScanData(parsedJson),
    researchReport: narrative,
    researchSources,
    responseId: response.id,
    model: INTEL_MODEL,
  }
}

function splitReportAndJson(text: string): { narrative: string; jsonBlock: string } {
  // Look for the last JSON code block in the output
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```\s*$/)
  if (jsonMatch) {
    const jsonBlock = jsonMatch[1].trim()
    const narrative = text.slice(0, jsonMatch.index).trim()
    return { narrative, jsonBlock }
  }

  // Fallback: find the last { ... } block
  const lastBrace = text.lastIndexOf('}')
  if (lastBrace === -1) return { narrative: text, jsonBlock: '{}' }

  let depth = 0
  let start = lastBrace
  for (let i = lastBrace; i >= 0; i--) {
    if (text[i] === '}') depth++
    if (text[i] === '{') depth--
    if (depth === 0) { start = i; break }
  }

  return {
    narrative: text.slice(0, start).trim(),
    jsonBlock: text.slice(start, lastBrace + 1),
  }
}

function parseJsonObject(text: string): unknown {
  const cleaned = text.trim()
  try { return JSON.parse(cleaned) }
  catch {
    const first = cleaned.indexOf('{')
    const last = cleaned.lastIndexOf('}')
    if (first === -1 || last === -1 || last <= first) throw new Error('No parseable JSON found in research output')
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







