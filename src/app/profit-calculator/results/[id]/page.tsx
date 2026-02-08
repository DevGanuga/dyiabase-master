'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface ResultsData {
  id: string
  user: { firstName: string; email: string }
  results: { totalLoss: number; annualLoss: number; breakdown: Record<string, number> }
  createdAt: string
  viewedResults: boolean
}

const LEAK_LABELS: Record<string, { title: string; icon: string; explanation: string; withDyia: string }> = {
  followup: {
    title: 'Missed follow-ups',
    icon: '📋',
    explanation: "Based on your follow-up process, you're likely losing 40–60% of quotes that would convert with proper follow-up.",
    withDyia: 'Automatic Hot/Warm/Cold prioritization and one-tap messages mean you never miss a follow-up. Our users see higher conversion rates.',
  },
  expenses: {
    title: 'Untracked expenses',
    icon: '💰',
    explanation: "Without per-job expense tracking, you don't know which jobs are actually profitable.",
    withDyia: 'Every expense tied to every job. See your real profit per customer in real time.',
  },
  pricing: {
    title: 'Guesswork pricing',
    icon: '📊',
    explanation: 'Pricing without data means you\'re either undercharging or overcharging.',
    withDyia: 'AI pricing suggestions based on your actual historical costs and profit margins.',
  },
  multitrip: {
    title: 'Multi-trip economics',
    icon: '🚛',
    explanation: 'When you do multiple jobs in one trip, shared costs often get assigned to one job—hiding true margins.',
    withDyia: 'Split shared trip costs across jobs so you see real profit per job.',
  },
  visibility: {
    title: 'Revenue visibility',
    icon: '👁️',
    explanation: "You can't improve what you don't measure. Delayed or missing numbers hide leaks.",
    withDyia: 'Real-time dashboard so you know your profit and margins as you go.',
  },
}

function AnimatedCounter({ value, duration = 2000 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const startTime = Date.now()
    const step = () => {
      const elapsed = Date.now() - startTime
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - (1 - t) * (1 - t)
      setDisplay(Math.round(value * eased))
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value, duration])
  return <span>${display.toLocaleString()}</span>
}

export default function ResultsPage() {
  const params = useParams()
  const id = params?.id as string
  const [data, setData] = useState<ResultsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    fetch(`/api/quiz/results/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found')
        return res.json()
      })
      .then((d) => {
        setData(d)
        fetch(`/api/quiz/results/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ viewedResults: true }),
        }).catch(() => {})
      })
      .catch(() => setError('Results not found'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto text-center text-slate-400">
        Loading your results…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto text-center">
        <p className="text-slate-400 mb-4">{error || 'Something went wrong.'}</p>
        <Link href="/profit-calculator" className="text-orange-400 hover:text-orange-300">Back to calculator</Link>
      </div>
    )
  }

  const { results } = data
  const totalLoss = results.totalLoss
  const annualLoss = results.annualLoss
  const breakdown = results.breakdown || {}
  const entries = (Object.entries(breakdown) as [keyof typeof LEAK_LABELS, number][])
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])

  const appUrl = typeof window !== 'undefined' ? `${window.location.origin}` : ''
  const signUpUrl = `${appUrl}/sign-up?redirect_url=${encodeURIComponent(appUrl + '/app')}&utm_source=profit_calculator`

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-4">
          Here&apos;s what we found
        </h1>
        <p className="text-5xl sm:text-6xl font-bold text-orange-400 mb-2">
          <AnimatedCounter value={totalLoss} />
          <span className="text-2xl sm:text-3xl font-semibold text-slate-400">/month</span>
        </p>
        <p className="text-slate-400">
          That&apos;s <span className="text-white font-semibold">${annualLoss.toLocaleString()}</span> per year being left on the table.
        </p>
      </div>

      <h2 className="text-xl font-semibold text-white mb-4">Where your profit is leaking</h2>
      <div className="space-y-4 mb-12">
        {entries.map(([key, amount]) => {
          const meta = LEAK_LABELS[key]
          if (!meta) return null
          return (
            <div
              key={key}
              className="rounded-xl bg-white/[0.04] border border-white/10 p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{meta.icon}</span>
                <h3 className="font-semibold text-white">{meta.title}: ${amount.toLocaleString()}/month</h3>
              </div>
              <p className="text-slate-400 text-sm mb-2">{meta.explanation}</p>
              <p className="text-slate-300 text-sm"><strong className="text-orange-400/90">With Dyia:</strong> {meta.withDyia}</p>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-6 text-center">
        <h2 className="text-xl font-semibold text-white mb-2">Want to plug these leaks?</h2>
        <p className="text-slate-300 text-sm mb-6">Start your 14-day free trial. No credit card required. Full access. Cancel anytime.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href={signUpUrl}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30 transition"
          >
            Start your 14-day free trial
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-4 rounded-xl border border-white/20 text-slate-300 hover:bg-white/5 transition"
          >
            See how Dyia works
          </Link>
        </div>
      </div>
    </div>
  )
}
