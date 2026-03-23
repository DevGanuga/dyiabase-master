'use client'

import { useState } from 'react'
import Link from 'next/link'

const FEATURE_OPTIONS = [
  { value: 'gmail_beta', label: 'Gmail email blast beta' },
  { value: 'outlook_beta', label: 'Outlook email blast beta' },
  { value: 'email_blast_beta', label: 'General email blast beta' },
]

export default function BetaAccessPage() {
  const [form, setForm] = useState({
    name: '',
    signupEmail: '',
    googleEmail: '',
    businessName: '',
    requestedFeature: 'gmail_beta',
    notes: '',
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setError('')

    try {
      const res = await fetch('/api/beta-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit request')

      setStatus('success')
      setForm({
        name: '',
        signupEmail: '',
        googleEmail: '',
        businessName: '',
        requestedFeature: 'gmail_beta',
        notes: '',
      })
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-900/20 via-[#09090b] to-[#09090b]" />
      </div>

      <nav className="border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img src="/dyia-logo-full.png" alt="dyia" className="h-8 object-contain brightness-0 invert" />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-slate-400 hover:text-white transition">Home</Link>
            <Link href="/support" className="text-sm text-slate-400 hover:text-white transition">Support</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-400 text-[13px] font-medium mb-5">
            Beta Access
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Request email beta access</h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            If you want to test Gmail or Outlook sending while our OAuth app is still in testing mode,
            submit the Google account you plan to connect. We&apos;ll review it and add approved testers manually.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          {[
            { title: '1. Request access', text: 'Tell us which Google account you plan to connect.' },
            { title: '2. We approve', text: 'We review the request from the admin panel.' },
            { title: '3. Test safely', text: 'Once added, you can connect without the unverified warning blocker.' },
          ].map((item) => (
            <div key={item.title} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <p className="text-sm font-semibold text-white mb-1">{item.title}</p>
              <p className="text-sm text-slate-400">{item.text}</p>
            </div>
          ))}
        </div>

        {status === 'success' ? (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-10 text-center">
            <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-green-400 mb-2">Request submitted</h2>
            <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
              We&apos;ll review your request and add the submitted Google account to the beta tester list if approved.
            </p>
            <button
              onClick={() => setStatus('idle')}
              className="text-sm text-orange-400 hover:text-orange-300 underline underline-offset-2"
            >
              Submit another request
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 p-6 sm:p-8 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1.5">Name</label>
                <input
                  id="name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label htmlFor="businessName" className="block text-sm font-medium text-slate-300 mb-1.5">Business name</label>
                <input
                  id="businessName"
                  type="text"
                  value={form.businessName}
                  onChange={(e) => setForm((prev) => ({ ...prev, businessName: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition"
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="signupEmail" className="block text-sm font-medium text-slate-300 mb-1.5">dyia sign-up email</label>
                <input
                  id="signupEmail"
                  type="email"
                  required
                  value={form.signupEmail}
                  onChange={(e) => setForm((prev) => ({ ...prev, signupEmail: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition"
                  placeholder="you@business.com"
                />
              </div>
              <div>
                <label htmlFor="googleEmail" className="block text-sm font-medium text-slate-300 mb-1.5">Google account to whitelist</label>
                <input
                  id="googleEmail"
                  type="email"
                  required
                  value={form.googleEmail}
                  onChange={(e) => setForm((prev) => ({ ...prev, googleEmail: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition"
                  placeholder="gmail-account@gmail.com"
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  This can be different from your dyia sign-up email.
                </p>
              </div>
            </div>

            <div>
              <label htmlFor="requestedFeature" className="block text-sm font-medium text-slate-300 mb-1.5">Requested beta feature</label>
              <select
                id="requestedFeature"
                value={form.requestedFeature}
                onChange={(e) => setForm((prev) => ({ ...prev, requestedFeature: e.target.value }))}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition"
              >
                {FEATURE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-slate-900 text-white">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-slate-300 mb-1.5">Notes</label>
              <textarea
                id="notes"
                rows={5}
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition resize-none"
                placeholder="Anything useful for approval, like what you want to test or when you plan to use it."
              />
            </div>

            {status === 'error' && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white rounded-xl font-semibold text-sm shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? 'Submitting...' : 'Request beta access'}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
