'use client'

import { useState } from 'react'
import Link from 'next/link'

const SUBJECT_OPTIONS = [
  { value: 'bug', label: 'Bug Report', icon: '🐛', desc: 'Something isn\'t working right' },
  { value: 'feature', label: 'Feature Request', icon: '💡', desc: 'Suggest an improvement' },
  { value: 'billing', label: 'Billing & Account', icon: '💳', desc: 'Subscription, payments, or account' },
  { value: 'general', label: 'General Question', icon: '💬', desc: 'Anything else' },
]

const FAQ_CATEGORIES = [
  {
    title: 'Getting Started',
    icon: '🚀',
    items: [
      {
        q: 'How do I get started?',
        a: 'Sign up for a free 14-day Pro trial. You\'ll be guided through onboarding where you set your business name, tax percentage, and monthly goal. Then log your first job — it takes about 30 seconds.',
      },
      {
        q: 'What do I need to set up?',
        a: 'Just your business name and a rough tax percentage — that\'s enough to start. You can add your logo, fixed expenses, pricing templates, and review links later from Settings.',
      },
      {
        q: 'Can I use this on my phone?',
        a: 'Yes. Dyia is a progressive web app that works in any browser — iPhone, Android, tablet, laptop. Log jobs from your truck, check numbers at the dump, send quotes from your couch. No app download needed.',
      },
      {
        q: 'Is there a mobile app?',
        a: 'Dyia works as a web app in your browser. You can add it to your home screen on iPhone or Android for an app-like experience. We\'re exploring a native app for the future.',
      },
    ],
  },
  {
    title: 'Features & Usage',
    icon: '⚡',
    items: [
      {
        q: 'How does job tracking work?',
        a: 'Log each job with customer name, revenue, and expenses (gas, dump fee, labor, materials, dumpster rental). Dyia calculates your real profit instantly, including tax set-aside and fixed overhead.',
      },
      {
        q: 'How do quotes and follow-ups work?',
        a: 'Build professional PDF quotes with your logo, send them to customers, and Dyia automatically creates a follow-up in your pipeline. Follow-ups are scored as Hot, Warm, or Cold based on how long ago you quoted. When they convert, one click turns it into a job.',
      },
      {
        q: 'What can the AI assistant do?',
        a: 'Dyia AI (Pro) lets you log jobs, create quotes, track expenses, get pricing suggestions, forecast revenue, and analyze your business — all through natural conversation. Say "Log a job for Sarah, $350, $40 dump fee" and Dyia handles the rest.',
      },
      {
        q: 'How does the customer database work?',
        a: 'Every customer you add to a job or quote is automatically saved. You can see their lifetime value, job history, quote history, and contact info. When you start a new job, their details auto-fill.',
      },
      {
        q: 'Can I send emails to my customers?',
        a: 'Yes. With Pro, connect your Gmail or Outlook account and send targeted emails to your customer list directly from Dyia. Track campaign history and delivery status.',
      },
      {
        q: 'Can I export my data?',
        a: 'Yes. Go to Settings > Account and click "Export Data" to download a CSV of all your jobs, quotes, customers, and expenses. Your data is always yours.',
      },
    ],
  },
  {
    title: 'Billing & Plans',
    icon: '💰',
    items: [
      {
        q: 'How does the free trial work?',
        a: 'You get 14 days of full Pro access including AI assistant, email blasts, and marketing tools. A card is required to start, but you won\'t be charged until the trial ends. Cancel anytime before then and you\'ll never be charged.',
      },
      {
        q: 'What\'s the difference between Basic and Pro?',
        a: 'Basic ($19.99/mo) gives you unlimited job tracking, profit dashboard, quote builder with PDF export, customer CRM, follow-up pipeline, tax set-aside, review requests, and CSV export. Pro ($29.99/mo) adds Dyia AI assistant, smart pricing, revenue forecasting, follow-up risk alerts, email campaigns, marketing ROI tracking, and priority support.',
      },
      {
        q: 'Can I switch plans?',
        a: 'Yes. You can upgrade or downgrade anytime from Settings > Account. If you upgrade, you get immediate access to Pro features. If you downgrade, you keep Pro until your current billing period ends.',
      },
      {
        q: 'How do I cancel?',
        a: 'Cancel anytime from Settings > Account. No phone calls, no retention team, no tricks. You keep access until your billing period ends. We hold your data for 90 days if you want to come back.',
      },
      {
        q: 'Do you offer refunds?',
        a: '14-day money-back guarantee on all paid plans. Not happy? Email dyia.io.app@gmail.com for a full refund. No questions asked.',
      },
      {
        q: 'Do you offer annual billing?',
        a: 'Yes. Annual billing saves you 2 months compared to monthly — $199.90/year for Basic ($16.66/mo) and $299.90/year for Pro ($24.99/mo).',
      },
    ],
  },
  {
    title: 'Security & Privacy',
    icon: '🔒',
    items: [
      {
        q: 'Is my data secure?',
        a: 'Yes. We use industry-standard encryption in transit (TLS) and at rest. Authentication is handled by Clerk, database by Supabase (PostgreSQL on AWS), and payments by Stripe. Daily automated backups protect against data loss.',
      },
      {
        q: 'Do you sell my data?',
        a: 'Never. Your business data belongs to you. We don\'t sell, share, or use your data for advertising. Read our full Privacy Policy for details.',
      },
      {
        q: 'What happens to my data if I cancel?',
        a: 'We hold your data for 90 days after cancellation in case you want to come back. After that, it\'s permanently deleted. You can export everything as CSV before canceling.',
      },
    ],
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
  const [openFaq, setOpenFaq] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState(0)

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

  const faqKey = (catIdx: number, itemIdx: number) => `${catIdx}-${itemIdx}`

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-900/20 via-[#09090b] to-[#09090b]" />
      </div>

      {/* Nav */}
      <nav className="border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img src="/dyia-logo-full.png" alt="dyia" className="h-8 object-contain brightness-0 invert" />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-slate-400 hover:text-white transition">Home</Link>
            <Link href="/app" className="text-sm text-slate-400 hover:text-white transition">Dashboard</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-400 text-[13px] font-medium mb-6">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Help Center
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">How can we help?</h1>
          <p className="text-lg text-slate-400 max-w-xl mx-auto">
            Find answers below or send us a message. We typically respond within a few hours during business days.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mb-16 max-w-2xl mx-auto">
          {[
            { value: '< 4 hrs', label: 'Avg response time', icon: '⚡' },
            { value: '24/7', label: 'Email support', icon: '📧' },
            { value: 'USA', label: 'Based & built', icon: '🏠' },
          ].map((stat, i) => (
            <div key={i} className="text-center p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <span className="text-lg mb-1 block">{stat.icon}</span>
              <p className="text-lg font-bold text-white">{stat.value}</p>
              <p className="text-xs text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* ===== FAQ Section ===== */}
        <div className="mb-20">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Frequently Asked Questions</h2>

          {/* Category tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {FAQ_CATEGORIES.map((cat, i) => (
              <button
                key={i}
                onClick={() => setActiveCategory(i)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeCategory === i
                    ? 'bg-orange-500/15 border border-orange-500/30 text-orange-400'
                    : 'bg-white/[0.02] border border-white/[0.06] text-slate-400 hover:text-white hover:border-white/[0.12]'
                }`}
              >
                <span>{cat.icon}</span>
                {cat.title}
              </button>
            ))}
          </div>

          {/* FAQ items for active category */}
          <div className="max-w-3xl mx-auto space-y-3">
            {FAQ_CATEGORIES[activeCategory].items.map((item, i) => {
              const key = faqKey(activeCategory, i)
              return (
                <div key={key} className="border border-white/[0.06] rounded-xl overflow-hidden bg-white/[0.01]">
                  <button
                    onClick={() => setOpenFaq(openFaq === key ? null : key)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02] transition"
                  >
                    <span className="font-medium text-white pr-4 text-sm">{item.q}</span>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${openFaq === key ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {openFaq === key && (
                    <div className="px-5 pb-4">
                      <p className="text-slate-400 text-sm leading-relaxed">{item.a}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ===== Contact Section ===== */}
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-white mb-3">Still need help?</h2>
            <p className="text-slate-400">Pick a category and describe your issue. We&apos;ll get back to you quickly.</p>
          </div>

          {status === 'success' ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-10 text-center">
              <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
                <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-green-400 mb-2">Message Sent!</h3>
              <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
                We&apos;ve received your message and sent a confirmation to your email. Expect a reply within a few hours during business days.
              </p>
              <button
                onClick={() => setStatus('idle')}
                className="text-sm text-orange-400 hover:text-orange-300 underline underline-offset-2"
              >
                Send another message
              </button>
            </div>
          ) : (
            <div>
              {/* Subject selection as cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                {SUBJECT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setForm(f => ({ ...f, subject: opt.value }))}
                    className={`p-4 rounded-xl text-left transition-all ${
                      form.subject === opt.value
                        ? 'bg-orange-500/15 border-2 border-orange-500/40'
                        : 'bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12]'
                    }`}
                  >
                    <span className="text-xl mb-2 block">{opt.icon}</span>
                    <p className="text-sm font-medium text-white">{opt.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1.5">Name</label>
                    <input
                      id="name"
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition"
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
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-slate-300 mb-1.5">Message</label>
                  <textarea
                    id="message"
                    required
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition resize-none"
                    placeholder="Describe your question or issue in detail..."
                  />
                </div>

                {status === 'error' && (
                  <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white rounded-xl font-semibold text-sm shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'loading' ? 'Sending...' : 'Send Message'}
                </button>
              </form>

              {/* Direct contact fallback */}
              <div className="mt-8 p-5 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-200">Prefer email?</p>
                  <p className="text-xs text-slate-500 mt-0.5">Reach us directly anytime</p>
                </div>
                <a
                  href="mailto:dyia.io.app@gmail.com"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-orange-400 hover:text-orange-300 hover:border-orange-500/20 font-medium transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  dyia.io.app@gmail.com
                </a>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] mt-20">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
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
