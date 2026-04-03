/**
 * Intel Research Agent — uses OpenAI to generate competitive intelligence data.
 * Returns structured JSON with local ranking, review gaps, keyword gaps, etc.
 */

import OpenAI from 'openai'
import type { IntelScanData } from '@/types/database'

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export interface IntelAgentInput {
  businessName: string
  websiteUrl?: string
  zipCode: string
  industry: string
  radiusMiles: number
}

const SYSTEM_PROMPT = `You are a competitive intelligence research analyst for local service businesses. Your job is to analyze a business's competitive position in their local market.

Given a business name, location, and industry, you must research and return a detailed competitive analysis as a JSON object. Use your knowledge of local SEO, Google Business Profile optimization, and digital advertising to produce realistic and useful competitive intelligence.

You MUST return valid JSON matching this exact schema — no markdown, no explanation, just the JSON object:

{
  "local_rank": <integer, business's estimated rank among local competitors, 1-based>,
  "total_competitors": <integer, total competitors found in the search radius>,
  "review_count_mine": <integer, estimated number of Google reviews the business has>,
  "review_count_leader": <integer, estimated number of reviews the #1 ranked competitor has>,
  "review_gap": <integer, difference between leader and this business>,
  "missing_keywords": <array of up to 15 strings, keywords competitors rank for that this business likely does not>,
  "missing_keywords_count": <integer, count of missing keywords>,
  "competitor_ad_spend_avg": <integer, estimated average monthly ad spend in USD across top 3 competitors>,
  "top_competitors": <array of objects with: name (string), reviews (integer), estimated_ad_spend (integer), rank (integer)>,
  "gbp_gaps": <array of strings, specific Google Business Profile gaps vs the top competitor>,
  "gap_scores": {
    "reviews_pct": <integer 0-100, how much of the review gap is closed>,
    "keywords_pct": <integer 0-100, keyword coverage vs competitors>,
    "ads_pct": <integer 0-100, ad presence vs competitors>,
    "gbp_pct": <integer 0-100, GBP profile completeness vs leader>
  },
  "scan_date": <ISO date string of today>,
  "target_zip_codes": <array of 3 strings, top zip codes by search volume in the radius>
}

Guidelines:
- Base your analysis on realistic patterns for the given industry and location.
- The top_competitors array should have 5 entries.
- Missing keywords should be relevant, specific, long-tail search terms for the industry and location.
- GBP gaps should be actionable (e.g., "Missing business hours", "No posts in 30+ days", "Missing service area coverage").
- Gap scores should reflect realistic competitive positions — most small businesses score 30-70%.
- Competitor names should sound realistic for the given industry and area.
- Ad spend estimates should be reasonable for local service businesses ($200-$3000/month range).
- target_zip_codes should be real zip codes near the provided zip code.`

/**
 * Run the Intel research agent. Returns structured scan data.
 * Timeout: 90 seconds (spec requirement).
 */
export async function runIntelAgent(input: IntelAgentInput): Promise<IntelScanData> {
  const openai = getOpenAI()

  const userPrompt = [
    `Analyze the competitive position of this local service business:`,
    ``,
    `Business Name: ${input.businessName}`,
    input.websiteUrl ? `Website: ${input.websiteUrl}` : `Website: Not provided`,
    `Zip Code: ${input.zipCode}`,
    `Industry: ${input.industry}`,
    `Search Radius: ${input.radiusMiles} miles`,
    ``,
    `Return only the JSON object with the competitive analysis. No markdown formatting, no explanation.`,
  ].join('\n')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90_000)

  try {
    const response = await openai.chat.completions.create(
      {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal }
    )

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Empty response from OpenAI agent')
    }

    const parsed = JSON.parse(content) as IntelScanData

    if (
      typeof parsed.local_rank !== 'number' ||
      !Array.isArray(parsed.top_competitors) ||
      !parsed.gap_scores
    ) {
      throw new Error('Invalid scan data structure from agent')
    }

    if (!parsed.scan_date) {
      parsed.scan_date = new Date().toISOString().slice(0, 10)
    }

    return parsed
  } finally {
    clearTimeout(timeout)
  }
}
