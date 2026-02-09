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

async function generatePDF(data: ResultsData) {
  // Dynamically import jsPDF to keep bundle small
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF()
  const { results, user } = data
  const breakdown = results.breakdown || {}
  const entries = (Object.entries(breakdown) as [string, number][])
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])

  // Cover page
  doc.setFontSize(28)
  doc.setTextColor(249, 115, 22)
  doc.text('Profit Leak Report', 20, 40)
  doc.setFontSize(14)
  doc.setTextColor(100)
  doc.text(`Prepared for ${user.firstName}`, 20, 55)
  doc.text(`Generated ${new Date(data.createdAt).toLocaleDateString()}`, 20, 63)
  doc.setFontSize(48)
  doc.setTextColor(249, 115, 22)
  doc.text(`$${results.totalLoss.toLocaleString()}/mo`, 20, 100)
  doc.setFontSize(16)
  doc.setTextColor(80)
  doc.text(`$${results.annualLoss.toLocaleString()} per year in identified profit leaks`, 20, 115)

  // Breakdown page
  doc.addPage()
  doc.setFontSize(22)
  doc.setTextColor(30)
  doc.text('Where Your Profit Is Leaking', 20, 30)

  let y = 50
  for (const [key, amount] of entries) {
    const meta = LEAK_LABELS[key]
    if (!meta) continue

    doc.setFontSize(14)
    doc.setTextColor(249, 115, 22)
    doc.text(`${meta.icon} ${meta.title}: $${amount.toLocaleString()}/month`, 20, y)
    y += 8

    doc.setFontSize(10)
    doc.setTextColor(100)
    const explanationLines = doc.splitTextToSize(meta.explanation, 170)
    doc.text(explanationLines, 20, y)
    y += explanationLines.length * 5 + 4

    doc.setTextColor(60)
    const withDyiaLines = doc.splitTextToSize(`With Dyia: ${meta.withDyia}`, 170)
    doc.text(withDyiaLines, 20, y)
    y += withDyiaLines.length * 5 + 12

    if (y > 260) { doc.addPage(); y = 30 }
  }

  // CTA page
  doc.addPage()
  doc.setFontSize(22)
  doc.setTextColor(30)
  doc.text('Next Steps', 20, 40)

  doc.setFontSize(12)
  doc.setTextColor(80)
  doc.text('1. Start your 14-day free trial at dyia.io', 20, 60)
  doc.text('2. Log your first 5 jobs to see real profit margins', 20, 72)
  doc.text('3. Set up follow-up tracking to stop leaving money on the table', 20, 84)
  doc.text('4. Ask Dyia AI for pricing suggestions on your next quote', 20, 96)

  doc.setFontSize(14)
  doc.setTextColor(249, 115, 22)
  doc.text('Start free at dyia.io', 20, 120)

  const fileName = `dyia-profit-leak-report-${user.firstName.toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
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
        <p className="text-slate-300 text-sm mb-6">Start your 14-day free trial. Full access. Cancel anytime.</p>
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

      {/* PDF Download */}
      <div className="text-center mt-6">
        <button
          onClick={() => generatePDF(data)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 text-sm transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download PDF Report
        </button>
      </div>
    </div>
  )
}
