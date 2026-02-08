'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const STORAGE_KEY = 'dyia_quiz_answers'

export default function EmailCapturePage() {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, string> | null>(null)
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>
        queueMicrotask(() => setAnswers(parsed))
      } else {
        router.replace('/profit-calculator/quiz')
      }
    } catch {
      router.replace('/profit-calculator/quiz')
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!firstName.trim() || !email.trim()) {
      setError('Please enter your first name and email.')
      return
    }
    setSubmitting(true)
    try {
      const params = new URLSearchParams(window.location.search)
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          answers: answers || {},
          utmSource: params.get('utm_source') || undefined,
          utmMedium: params.get('utm_medium') || undefined,
          utmCampaign: params.get('utm_campaign') || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        setSubmitting(false)
        return
      }
      try {
        window.sessionStorage.removeItem(STORAGE_KEY)
      } catch { /* ignore */ }
      router.push(`/profit-calculator/results/${data.id}`)
    } catch {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  if (answers === null) {
    return (
      <div className="max-w-lg mx-auto text-center text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">Your profit leak report is ready</h1>
      <p className="text-slate-400 mb-8">
        Enter your email to see your personalized results. We&apos;ll also send you a copy and a short breakdown.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-slate-300 mb-2">First name</label>
          <input
            id="firstName"
            type="text"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="Alex"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="you@company.com"
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-2">Phone (optional)</label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="(555) 123-4567"
          />
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold disabled:opacity-50 hover:shadow-lg hover:shadow-orange-500/20 transition"
        >
          {submitting ? 'Loading…' : 'Show my results →'}
        </button>
      </form>
    </div>
  )
}
