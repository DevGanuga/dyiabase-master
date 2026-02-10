'use client'

import { useState } from 'react'
import Link from 'next/link'

const SUBJECT_OPTIONS = [
  { value: 'bug', label: 'Bug Report' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'billing', label: 'Billing Question' },
  { value: 'general', label: 'General Question' },
]

const FAQ_ITEMS = [
  {
    q: 'How do I get started?',
    a: 'Sign up for a free 14-day trial. You\'ll be guided through onboarding where you can set up your business info, pricing templates, and start logging jobs right away.',
  },
  {
    q: 'How does billing work?',
    a: 'After your 14-day trial, you can choose a Basic or Pro plan billed monthly or annually. You can manage your subscription and view invoices from Settings > Account.',
  },
  {
    q: 'Can I export my data?',
    a: 'Yes! Go to Settings > Account and click "Export Data" to download a CSV of all your jobs, quotes, and expenses.',
  },
  {
    q: 'How does the AI assistant work?',
    a: 'The Dyia AI assistant (Pro feature) can help you log jobs, create quotes, track expenses, and get business insights — all through natural conversation.',
  },
  {
    q: 'Is my data secure?',
    a: 'Absolutely. We use Clerk for authentication, Supabase (PostgreSQL) for encrypted data storage, and Stripe for secure payment processing. We never share your data with third parties.',
  },
]

export default function SupportPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: 'general',
    message: '',
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/support/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send message')
      }

      setStatus('success')
      setForm({ name: '', email: '', subject: 'general', message: '' })
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-900/20 via-[#09090b] to-[#09090b]" />
      </div>

      {/* Nav */}
      <nav className="border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/dyia-logo.png" alt="dyia" className="w-8 h-8 object-contain" />
            <span className="text-xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">dyia</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-slate-400 hover:text-white transition">Home</Link>
            <Link href="/app" className="text-sm text-slate-400 hover:text-white transition">Dashboard</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">Help & Support</h1>
          <p className="text-slate-400 text-lg">
            We&apos;re here to help. Check the FAQ below or send us a message.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div>
            <h2 className="text-xl font-semibold mb-6">Contact Us</h2>

            {status === 'success' ? (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-8 text-center">
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-green-400 mb-2">Message Sent!</h3>
                <p className="text-slate-400 text-sm mb-4">
                  We&apos;ll get back to you as soon as possible. Check your email for a confirmation.
                </p>
                <button
                  onClick={() => setStatus('idle')}
                  className="text-sm text-orange-400 hover:text-orange-300 underline underline-offset-2"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1.5">Name</label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-slate-300 mb-1.5">Subject</label>
                  <select
                    id="subject"
                    value={form.subject}
                    onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition"
                  >
                    {SUBJECT_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-slate-300 mb-1.5">Message</label>
                  <textarea
                    id="message"
                    required
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition resize-none"
                    placeholder="Describe your question or issue..."
                  />
                </div>

                {status === 'error' && (
                  <div className="text-red-400 text-sm">{errorMsg}</div>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white rounded-xl font-semibold text-sm shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'loading' ? 'Sending...' : 'Send Message'}
                </button>

                <p className="text-xs text-slate-500 text-center">
                  Or email us directly at{' '}
                  <a href="mailto:support@dyia.io" className="text-orange-400 hover:text-orange-300">
                    support@dyia.io
                  </a>
                </p>
              </form>
            )}
          </div>

          {/* FAQ */}
          <div>
            <h2 className="text-xl font-semibold mb-6">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {FAQ_ITEMS.map((item, i) => (
                <div key={i} className="border border-white/[0.06] rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition"
                  >
                    <span className="text-sm font-medium text-slate-200">{item.q}</span>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-4 text-sm text-slate-400 leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Direct contact */}
            <div className="mt-8 p-6 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <h3 className="text-sm font-semibold text-slate-200 mb-2">Need urgent help?</h3>
              <p className="text-sm text-slate-400 mb-3">
                Email us directly and we&apos;ll respond within 24 hours.
              </p>
              <a
                href="mailto:support@dyia.io"
                className="inline-flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                support@dyia.io
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] mt-20">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-slate-600 text-sm">&copy; 2026 dyia. All rights reserved.</p>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/terms" className="hover:text-orange-400 transition">Terms</Link>
            <Link href="/privacy" className="hover:text-orange-400 transition">Privacy</Link>
            <Link href="/" className="hover:text-orange-400 transition">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
