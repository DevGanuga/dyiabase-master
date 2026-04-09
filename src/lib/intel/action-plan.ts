/**
 * Intel Action Plan Generator — uses Claude API to generate
 * a personalized 6-step action plan from competitive scan data.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { IntelScanData, IntelActionStep } from '@/types/database'

function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

export async function generateActionPlan(
  scanData: IntelScanData,
  businessName: string
): Promise<IntelActionStep[]> {
  const anthropic = getAnthropic()

  const leader = scanData.top_competitors[0]
  const leaderName = leader?.name || 'the market leader'

  const prompt = `You are a local business marketing strategist who builds 90-day action plans for service business owners.

You have competitive intelligence scan data for "${businessName}". Your job is to turn this data into exactly 6 concrete, prioritized action steps that the owner can execute immediately.

## Scan Data
${JSON.stringify(scanData, null, 2)}

## Key Facts to Reference
- "${businessName}" is ranked #${scanData.local_rank} out of ${scanData.total_competitors} competitors
- They have ${scanData.review_count_mine} Google reviews; ${leaderName} leads with ${scanData.review_count_leader} reviews (gap: ${scanData.review_gap})
- ${scanData.missing_keywords_count} keywords their competitors rank for that they don't
- Competitors spend an average of $${scanData.competitor_ad_spend_avg}/month on ads
- Gap scores: Reviews ${scanData.gap_scores.reviews_pct}%, Keywords ${scanData.gap_scores.keywords_pct}%, Ads ${scanData.gap_scores.ads_pct}%, GBP ${scanData.gap_scores.gbp_pct}%
${scanData.gbp_gaps.length > 0 ? `- GBP gaps: ${scanData.gbp_gaps.join('; ')}` : ''}

## Prioritization Logic
1. Identify which gap is largest (lowest gap_score percentage). That becomes step 1 with priority "high".
2. The second largest gap becomes step 2 with priority "high".
3. Steps 3-4 should address medium-priority improvements in the remaining categories.
4. Steps 5-6 should be quick wins or ongoing actions.
5. Every category (reviews, keywords, ads, gbp) must appear at least once across the 6 steps.

## Description Rules
- Every description MUST cite specific numbers from the scan data (review counts, keyword counts, competitor names, gap percentages, ad spend figures).
- Example good description: "You're ${scanData.review_gap} reviews behind ${leaderName} who has ${scanData.review_count_leader}. Send review requests to your last 30 customers this week."
- Example bad description: "You should get more reviews to improve your ranking." (too generic, no numbers)
- Maximum 2 sentences per description. Be direct and specific.

## Title Rules
- Maximum 10 words
- Must be action-oriented (start with a verb)
- Example good: "Send review requests to your last 30 customers"
- Example bad: "Review strategy improvement plan" (not actionable)

## Output Format
Return ONLY a JSON array of exactly 6 objects. No markdown, no explanation, no code fences.

Each object:
{
  "step_number": <1-6>,
  "category": <"reviews" | "keywords" | "ads" | "gbp">,
  "priority": <"high" | "medium" | "quick_win" | "ongoing">,
  "title": "<max 10 words, verb-first>",
  "description": "<2 sentences max, must cite specific numbers from scan>",
  "include_in_free_preview": <true for steps 1-2, false for steps 3-6>
}`

  const userMessage = `Generate the 6-step action plan for "${businessName}" now. Return only the JSON array.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [
      { role: 'user', content: prompt + '\n\n' + userMessage },
    ],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude API')
  }

  let raw = textBlock.text.trim()

  // Strip markdown code fences if present
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  const steps = JSON.parse(raw) as IntelActionStep[]

  if (!Array.isArray(steps) || steps.length !== 6) {
    throw new Error(`Expected 6 action steps, got ${Array.isArray(steps) ? steps.length : 'non-array'}`)
  }

  for (const step of steps) {
    if (!step.step_number || !step.category || !step.priority || !step.title || !step.description) {
      throw new Error('Invalid action step structure')
    }
  }

  return steps
}

export async function generatePreviewSteps(
  scanData: IntelScanData,
  businessName: string
): Promise<IntelActionStep[]> {
  const anthropic = getAnthropic()

  const leader = scanData.top_competitors[0]
  const leaderName = leader?.name || 'the market leader'

  const prompt = `You are a local business marketing strategist. Generate exactly 2 high-priority action steps for "${businessName}" based on this competitive scan data. These are preview steps to convince the owner to buy the full action plan.

## Key Data
- Ranked #${scanData.local_rank} of ${scanData.total_competitors} competitors
- ${scanData.review_count_mine} Google reviews vs ${leaderName} with ${scanData.review_count_leader} (gap: ${scanData.review_gap})
- ${scanData.missing_keywords_count} missing keywords
- Competitors spend avg $${scanData.competitor_ad_spend_avg}/mo on ads
${scanData.gbp_gaps.length > 0 ? `- GBP gaps: ${scanData.gbp_gaps.slice(0, 3).join('; ')}` : ''}

## Rules
- Step 1: Address the biggest gap. Step 2: Address the second biggest.
- Each step must have different category (reviews, keywords, ads, or gbp).
- Descriptions MUST cite specific numbers from the data.
- Maximum 2 sentences per description. Be direct.
- Both steps have include_in_free_preview: true.

Return ONLY a JSON array of 2 objects: { step_number, category, priority, title (max 10 words, verb-first), description, include_in_free_preview: true }`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') return []

  let raw = textBlock.text.trim()
  if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')

  try {
    const steps = JSON.parse(raw) as IntelActionStep[]
    if (!Array.isArray(steps)) return []
    return steps.slice(0, 2).map(s => ({ ...s, include_in_free_preview: true }))
  } catch {
    return []
  }
}
