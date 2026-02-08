import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, isResendConfigured } from '@/lib/resend/client'
import { quizReportEmail } from '@/lib/resend/templates'

function getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase environment variables not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export interface QuizAnswers {
  q1?: string
  q2?: string
  q3?: string
  q4?: string
  q5?: string
  q6?: string
  q7?: string
}

const VOLUME_MULTIPLIERS: Record<string, number> = {
  '1-20': 1.0,
  '21-50': 1.5,
  '51-100': 2.2,
  '100+': 3.0,
}

const LEAK_SCORES: Record<string, Record<string, number>> = {
  q2: { A: 45, B: 30, C: 15, D: 5 },
  q3: { A: 60, B: 45, C: 25, D: 5 },
  q4: { A: 50, B: 35, C: 20, D: 5 },
  q5: { A: 10, B: 25, C: 40, D: 60 },
  q6: { A: 50, B: 35, C: 20, D: 5 },
  q7: { A: 45, B: 35, C: 20, D: 5 },
}

function getLeakScore(questionKey: keyof typeof LEAK_SCORES, answer: string): number {
  const map = LEAK_SCORES[questionKey]
  if (!map) return 0
  return map[answer] ?? 0
}

function calculateProfitLeak(answers: QuizAnswers): { totalMonthlyLoss: number; annualLoss: number; breakdown: Record<string, number> } {
  const baseLeakPerCategory: Record<string, number> = {
    followup: 1680,
    expenses: 1245,
    pricing: 922,
    multitrip: 0,
    visibility: 0,
  }
  const volMult = VOLUME_MULTIPLIERS[answers.q1 || '1-20'] ?? 1.0
  const q3Score = getLeakScore('q3', answers.q3 || 'A')
  const q4Score = getLeakScore('q4', answers.q4 || 'A')
  const q5Score = getLeakScore('q5', answers.q5 || 'A')
  const q6Score = getLeakScore('q6', answers.q6 || 'A')
  const q7Score = getLeakScore('q7', answers.q7 || 'A')

  const leaks: Record<string, number> = {
    followup: Math.round(baseLeakPerCategory.followup * (q3Score / 60) * volMult),
    expenses: Math.round(baseLeakPerCategory.expenses * (q4Score / 50) * volMult),
    pricing: Math.round(baseLeakPerCategory.pricing * (q6Score / 50) * volMult),
    multitrip: Math.round((q5Score * 10) * volMult),
    visibility: Math.round((q7Score * 5) * volMult),
  }
  const totalMonthlyLoss = Math.round(
    leaks.followup + leaks.expenses + leaks.pricing + leaks.multitrip + leaks.visibility
  )
  return {
    totalMonthlyLoss,
    annualLoss: totalMonthlyLoss * 12,
    breakdown: leaks,
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { firstName, email, phone, answers = {}, utmSource, utmMedium, utmCampaign } = body
    if (!firstName?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'First name and email are required' }, { status: 400 })
    }
    const emailTrimmed = email.trim().toLowerCase()
    const { totalMonthlyLoss, annualLoss, breakdown } = calculateProfitLeak(answers)

    const supabase = getSupabase()
    const { data: row, error } = await supabase
      .from('dyia_quiz_submissions')
      .insert({
        first_name: firstName.trim(),
        email: emailTrimmed,
        phone: phone?.trim() || null,
        answers,
        calculated_loss: totalMonthlyLoss,
        breakdown,
        utm_source: utmSource || null,
        utm_medium: utmMedium || null,
        utm_campaign: utmCampaign || null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('Quiz submit error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
    const resultsUrl = `${baseUrl}/profit-calculator/results/${(row as { id: string }).id}`

    if (isResendConfigured()) {
      sendEmail(
        emailTrimmed,
        `Your Profit Leak Report – $${totalMonthlyLoss.toLocaleString()}/month identified`,
        quizReportEmail({
          firstName: firstName.trim(),
          totalMonthlyLoss,
          annualLoss,
          breakdown,
          resultsUrl,
          appUrl: baseUrl,
        }),
        'quiz_report'
      ).catch((err) => console.error('Quiz report email failed:', err))
    }

    return NextResponse.json({
      id: (row as { id: string }).id,
      calculatedLoss: totalMonthlyLoss,
      annualLoss,
      breakdown,
      resultsUrl,
    })
  } catch (e) {
    console.error('Quiz submit:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
