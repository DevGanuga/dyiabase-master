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

const ACTION_PLAN_PROMPT = `You are a local business marketing strategist. Given competitive intelligence scan data for a local service business, generate exactly 6 actionable steps as a JSON array.

Each step must be a JSON object with these fields:
- step_number: integer 1-6
- category: one of "reviews", "keywords", "ads", "gbp"
- priority: one of "high", "medium", "quick_win", "ongoing"
- title: max 10 words, action-oriented
- description: exactly 2 sentences max. Must reference specific numbers from the scan data.
- include_in_free_preview: boolean — true for steps 1 and 2, false for steps 3-6

Prioritization rules:
- Step 1 should address the biggest gap (usually reviews if review_gap > 10)
- Step 2 should address the second biggest gap
- Steps 3-4 should be medium priority improvements
- Steps 5-6 should be ongoing maintenance or quick wins
- Spread categories across the 4 types (reviews, keywords, ads, gbp)

Return ONLY a JSON array of 6 step objects. No markdown, no explanation.`

export async function generateActionPlan(
  scanData: IntelScanData,
  businessName: string
): Promise<IntelActionStep[]> {
  const anthropic = getAnthropic()

  const userMessage = [
    `Generate a 6-step action plan for "${businessName}" based on this competitive scan data:`,
    ``,
    JSON.stringify(scanData, null, 2),
    ``,
    `Return only the JSON array of 6 step objects.`,
  ].join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [
      { role: 'user', content: ACTION_PLAN_PROMPT + '\n\n' + userMessage },
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
