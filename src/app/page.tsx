'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import BusinessTypes from '@/components/landing/BusinessTypes'

const STRIPE_PRICES = {
  monthly: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID,
  annual: process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID,
}

// Hidden demo access
function DemoAccess() {
  const [showInput, setShowInput] = useState(false)
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/demo/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        setStatus('success')
        setTimeout(() => { window.location.href = '/app' }, 500)
      } else {
        setStatus('error')
        setTimeout(() => setStatus('idle'), 2000)
      }
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 2000)
    }
  }

  return (
    <div className="mt-8 pt-6 border-t border-white/5">
      {!showInput ? (
        <button onClick={() => setShowInput(true)} className="text-slate-600 hover:text-slate-500 text-xs">•••</button>
      ) : (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 justify-center">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Demo password" className="px-3 py-1.5 text-xs border border-white/10 rounded-lg bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 w-36" autoFocus />
          <button type="submit" disabled={status === 'loading'} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${status === 'success' ? 'bg-green-500 text-white' : status === 'error' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white hover:bg-orange-400'}`}>
            {status === 'loading' ? '...' : status === 'success' ? '✓' : status === 'error' ? '✗' : 'Go'}
          </button>
          <button type="button" onClick={() => { setShowInput(false); setPassword(''); setStatus('idle'); }} className="text-slate-500 hover:text-slate-400 text-xs">✕</button>
        </form>
      )}
    </div>
  )
}

// Dyia Avatar
function DyiaAvatar({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <div className={`${className} rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg ring-2 ring-orange-400/30`}>
      <svg className="w-1/2 h-1/2 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
        <path d="M12 2v4m0 12v4M2 12h4m12 0h4" strokeLinecap="round" />
        <path d="M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" strokeLinecap="round" opacity="0.6" />
      </svg>
    </div>
  )
}

export default function LandingPage() {
  const { isSignedIn, user, isLoaded } = useUser()
  const checkoutReady = !isSignedIn || (isLoaded && user)
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [couponInput, setCouponInput] = useState('')
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [hasDemoCookie, setHasDemoCookie] = useState(false)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  const [useFoundersCoupon, setUseFoundersCoupon] = useState(false)

  useEffect(() => {
    setMounted(true)
    const cookies = document.cookie.split(';')
    setHasDemoCookie(cookies.some(c => c.trim().startsWith('dyia_demo_access=')))
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    if (params.get('founders') === '1') setUseFoundersCoupon(true)
  }, [])

  async function checkout(plan: 'monthly' | 'annual', tier: 'basic' | 'pro' = 'pro') {
    setLoading(`${tier}-${plan}`)
    if (!isSignedIn) {
      window.location.href = `/sign-up?redirect_url=/app?plan=${plan}&tier=${tier}`
      return
    }
    if (!user) {
      setLoading(null)
      return
    }
    const userEmail = user.primaryEmailAddress?.emailAddress
    if (!userEmail) {
      alert('Please add an email to your account to checkout.')
      setLoading(null)
      return
    }
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: STRIPE_PRICES[plan],
          clerkUserId: user.id,
          userEmail,
          couponCode: couponInput || undefined,
          useFoundersCoupon: useFoundersCoupon || undefined,
          tier,
        }),
      })
      const data = await response.json()
      if (data.error) { alert('Error: ' + data.error); setLoading(null); return }
      if (data.url) window.location.href = data.url
      else setLoading(null)
    } catch { alert('Checkout error'); setLoading(null) }
  }

  const startFreeTrial = () => { window.location.href = '/sign-up?redirect_url=/app' }

  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-900/20 via-[#09090b] to-[#09090b]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-orange-500/8 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${mounted ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] px-6 py-3">
            <Link href="/" className="flex items-center gap-2">
              <DyiaAvatar className="w-8 h-8" />
              <span className="text-xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">dyia</span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-slate-400 hover:text-white transition">Features</a>
              <a href="#ai" className="text-sm text-slate-400 hover:text-white transition">Dyia AI</a>
              <a href="#pricing" className="text-sm text-slate-400 hover:text-white transition">Pricing</a>
              <a href="#faq" className="text-sm text-slate-400 hover:text-white transition">FAQ</a>
            </div>
            <div className="flex items-center gap-3">
              <Link href={(isSignedIn || hasDemoCookie) ? "/app" : "/sign-in"} className="text-sm text-slate-400 hover:text-white transition hidden sm:block">
                {(isSignedIn || hasDemoCookie) ? 'Dashboard' : 'Sign in'}
              </Link>
              <button onClick={startFreeTrial} className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white rounded-xl font-semibold text-sm shadow-lg shadow-orange-500/20 transition-all">
                Start Free
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main>
        {/* ===== HERO ===== */}
        <section className="pt-32 pb-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className={`transition-all duration-700 delay-100 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-400 text-sm font-medium mb-8">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                  </span>
                  Now with AI-powered business intelligence
                </div>
                
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] mb-6 tracking-tight">
                  Know your
                  <br />
                  <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">real profit.</span>
                </h1>
                
                <p className="text-xl text-slate-400 mb-10 leading-relaxed max-w-xl">
                  The AI-powered profit tracker for service businesses. Log jobs, track expenses, and finally know what you actually pocket — not what you think you made.
                </p>

                <div className="flex flex-wrap gap-4 mb-10">
                  <button onClick={startFreeTrial} className="group px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                    Start Free — 7 Day Trial
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </button>
                  <a href="#ai" className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-2xl font-semibold text-lg transition-all">
                    See how it works
                  </a>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
                  {['No credit card required', 'Cancel anytime', 'Works on any device'].map((item, i) => (
                    <span key={i} className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-500/70" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* App Preview */}
              <div className={`relative transition-all duration-700 delay-300 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-amber-500/10 rounded-3xl blur-3xl" />
                <div className="relative bg-[#0f0f11] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-black/40 border-b border-white/5">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-white/10" />
                      <div className="w-3 h-3 rounded-full bg-white/10" />
                      <div className="w-3 h-3 rounded-full bg-white/10" />
                    </div>
                    <div className="flex-1 flex justify-center">
                      <div className="px-3 py-1 bg-white/5 rounded text-xs text-slate-500">app.dyia.co</div>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {[
                        { label: 'This Week', value: '$2,840', sub: '8 jobs completed' },
                        { label: 'Net Profit', value: '$1,920', sub: '68% margin' },
                        { label: 'Tax Reserve', value: '$576', sub: '30% set aside' },
                        { label: 'Monthly Goal', value: '47%', sub: 'On track' },
                      ].map((stat, i) => (
                        <div key={i} className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                          <p className="text-[10px] text-slate-500 mb-0.5">{stat.label}</p>
                          <p className="text-lg font-bold text-white">{stat.value}</p>
                          <p className="text-[10px] text-slate-600">{stat.sub}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-gradient-to-r from-orange-500/5 to-amber-500/5 border border-orange-500/10 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DyiaAvatar className="w-6 h-6" />
                        <span className="text-xs font-medium text-white">Dyia</span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        Your hot tub removals are averaging <span className="text-orange-400">$485 profit</span> — 40% more than general hauling. Worth focusing your ads there.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== THE PROBLEM ===== */}
        <section className="py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-orange-400 text-sm font-medium uppercase tracking-wider mb-3">The problem</p>
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">Sound familiar?</h2>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto">Every service business owner has been here. You&apos;re not alone.</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-5">
              {[
                { 
                  emoji: '😰', 
                  title: '"Great day... I think?"',
                  text: 'Made $600 today. But after gas, dump fees, paying my helper — I genuinely don\'t know what I kept. The money just... disappears.'
                },
                { 
                  emoji: '📝', 
                  title: '"Tax time is chaos"',
                  text: 'Receipts in the glovebox, notes on my phone, random texts to myself. Every April I spend a weekend piecing together what I owe.'
                },
                { 
                  emoji: '🤷', 
                  title: '"Did I quote that right?"',
                  text: 'Quoted a job for $400. After expenses, I made $12/hour. I need to know BEFORE I quote, not three weeks later.'
                },
                { 
                  emoji: '💸', 
                  title: '"Software costs more than I make"',
                  text: 'Looked at Jobber — $349/month?! I just need to track jobs and know my profit. Not route optimization for a fleet I don\'t have.'
                },
              ].map((item, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:border-orange-500/20 transition-all">
                  <span className="text-3xl mb-4 block">{item.emoji}</span>
                  <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <p className="text-slate-500">
                dyia fixes all of this — for less than a tank of gas.
              </p>
            </div>
          </div>
        </section>

        {/* ===== HOW IT WORKS ===== */}
        <section className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-orange-950/5 via-transparent to-transparent" />
          <div className="max-w-5xl mx-auto relative">
            <div className="text-center mb-16">
              <p className="text-orange-400 text-sm font-medium uppercase tracking-wider mb-3">How it works</p>
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">Three taps. Real numbers.</h2>
              <p className="text-xl text-slate-400">Log jobs from your truck in 30 seconds.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  step: '01',
                  title: 'Log the job',
                  desc: 'Customer, revenue, expenses — or just tell Dyia in plain English. "Logged $350 for Mike, $40 dump fee." That\'s it.',
                  icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                },
                {
                  step: '02', 
                  title: 'See real profit',
                  desc: 'Revenue minus gas, dump fees, labor, materials — everything. Instantly know what actually hit your pocket.',
                  icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                },
                {
                  step: '03',
                  title: 'Get smarter',
                  desc: 'Dyia learns your business. Smart pricing suggestions, revenue forecasts, and insights you\'d never catch yourself.',
                  icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                },
              ].map((item, i) => (
                <div key={i} className="relative group">
                  <div className="bg-[#0f0f11] border border-white/[0.06] rounded-2xl p-8 h-full hover:border-orange-500/20 transition-all">
                    <span className="text-orange-500/20 text-5xl font-bold absolute top-6 right-6">{item.step}</span>
                    <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center text-white mb-6 shadow-lg shadow-orange-500/20">
                      {item.icon}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                    <p className="text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== MEET DYIA AI ===== */}
        <section id="ai" className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-400 text-xs font-bold uppercase tracking-wider mb-4">
                Pro Feature
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
                Meet <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">Dyia</span>
              </h2>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                Your AI business partner. Not a chatbot that answers questions — an assistant that actually does things.
              </p>
            </div>

            <div className="grid lg:grid-cols-5 gap-8">
              {/* Chat Demo */}
              <div className="lg:col-span-3 bg-[#0f0f11] border border-white/[0.06] rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 bg-black/30 border-b border-white/5">
                  <DyiaAvatar className="w-9 h-9" />
                  <div>
                    <h3 className="font-semibold text-white text-sm">Dyia</h3>
                    <p className="text-xs text-slate-500">Always ready to help</p>
                  </div>
                </div>
                
                <div className="p-5 space-y-4">
                  {/* User */}
                  <div className="flex justify-end">
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl rounded-br-sm px-4 py-3 max-w-[85%]">
                      <p className="text-sm text-slate-200">What should I charge for a hot tub removal?</p>
                    </div>
                  </div>
                  
                  {/* Dyia */}
                  <div className="flex gap-3">
                    <DyiaAvatar className="w-7 h-7 flex-shrink-0 mt-1" />
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl rounded-bl-sm px-4 py-3 max-w-[85%]">
                      <p className="text-sm text-slate-300 leading-relaxed">
                        Based on your last 6 hot tub jobs, you&apos;ve averaged <span className="text-green-400 font-medium">$485</span> with a 71% margin. The lowest was $380 (ground level), highest $650 (stairs + disconnect).
                      </p>
                      <div className="mt-3 p-3 bg-orange-500/5 border border-orange-500/10 rounded-lg">
                        <p className="text-xs text-slate-400 mb-1">Suggested range</p>
                        <p className="text-lg font-bold text-orange-400">$450 – $550</p>
                        <p className="text-xs text-slate-500 mt-1">Adjust up for stairs, electrical disconnect, or heavy models.</p>
                      </div>
                    </div>
                  </div>

                  {/* User */}
                  <div className="flex justify-end">
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl rounded-br-sm px-4 py-3 max-w-[85%]">
                      <p className="text-sm text-slate-200">Log a job — Sarah, couch removal, $280, $35 dump fee</p>
                    </div>
                  </div>

                  {/* Dyia */}
                  <div className="flex gap-3">
                    <DyiaAvatar className="w-7 h-7 flex-shrink-0 mt-1" />
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl rounded-bl-sm px-4 py-3">
                      <p className="text-sm text-slate-300 mb-3">Got it. Here&apos;s the breakdown:</p>
                      <div className="bg-green-500/5 border border-green-500/10 rounded-lg p-3 text-xs space-y-1">
                        <div className="flex justify-between"><span className="text-slate-400">Customer</span><span className="text-white">Sarah</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Revenue</span><span className="text-green-400 font-medium">$280</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">Expenses</span><span className="text-red-400">-$35</span></div>
                        <div className="flex justify-between border-t border-white/5 pt-1 mt-1"><span className="text-slate-400">Net Profit</span><span className="text-green-400 font-bold">$245</span></div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-lg border border-green-500/20">✓ Save</button>
                        <button className="px-3 py-1.5 bg-white/5 text-slate-400 text-xs font-medium rounded-lg border border-white/10">Edit</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="lg:col-span-2 space-y-3">
                {[
                  { icon: '💬', title: 'Natural language', desc: 'Just describe what happened. Dyia extracts the details.' },
                  { icon: '💰', title: 'Smart pricing', desc: 'Get suggestions based on YOUR actual job history.' },
                  { icon: '📊', title: 'Instant insights', desc: '"How\'s this month?" — real answers in seconds.' },
                  { icon: '📈', title: 'Revenue forecasting', desc: 'Predict what you\'ll make based on trends.' },
                  { icon: '🔔', title: 'Follow-up alerts', desc: 'Get notified when quotes are going cold.' },
                  { icon: '📋', title: 'Quote generation', desc: 'Create professional PDFs from conversation.' },
                ].map((f, i) => (
                  <div key={i} className="flex gap-3 p-4 bg-white/[0.02] border border-white/[0.04] rounded-xl hover:border-orange-500/20 transition-all">
                    <span className="text-xl">{f.icon}</span>
                    <div>
                      <h4 className="font-medium text-white text-sm">{f.title}</h4>
                      <p className="text-slate-500 text-xs">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ===== FEATURES ===== */}
        <section id="features" className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-950/5 to-transparent" />
          <div className="max-w-6xl mx-auto relative">
            <div className="text-center mb-16">
              <p className="text-orange-400 text-sm font-medium uppercase tracking-wider mb-3">Features</p>
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">Everything you need</h2>
              <p className="text-xl text-slate-400">Built by service business owners, for service business owners.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { icon: '📊', title: 'Job Tracking', desc: 'Log jobs in seconds. Customer, revenue, all expenses. See profit instantly.', pro: false },
                { icon: '💵', title: 'Expense Categories', desc: 'Gas, dump fees, labor, materials, dumpster rental — track it all.', pro: false },
                { icon: '🧾', title: 'Tax Set-Aside', desc: 'Automatic 30% (adjustable) set aside. Never scramble in April again.', pro: false },
                { icon: '📋', title: 'Quote Builder', desc: 'Professional PDF quotes with your logo and branding.', pro: false },
                { icon: '🔥', title: 'Follow-Up System', desc: 'Hot, warm, cold badges. Never forget to follow up on a quote.', pro: false },
                { icon: '📣', title: 'Lead Sources', desc: 'Track where customers come from. See what marketing works.', pro: false },
                { icon: '💳', title: 'Fixed Expenses', desc: 'Monthly overhead tracking. Insurance, truck payment, software.', pro: false },
                { icon: '🎯', title: 'Monthly Goals', desc: 'Set targets. Track progress. Visual motivation.', pro: false },
                { icon: '📥', title: 'Data Export', desc: 'Download everything as CSV. Your data, always.', pro: false },
                { icon: '🤖', title: 'Dyia AI', desc: 'Natural language logging. Smart pricing. Business insights.', pro: true },
                { icon: '📈', title: 'Forecasting', desc: 'Revenue predictions based on your patterns.', pro: true },
                { icon: '⚠️', title: 'Risk Alerts', desc: 'AI flags quotes going cold with conversion probability.', pro: true },
              ].map((f, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-5 hover:border-orange-500/20 transition-all relative group">
                  {f.pro && <div className="absolute top-4 right-4 px-2 py-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded text-[10px] font-bold text-white">PRO</div>}
                  <span className="text-2xl mb-3 block">{f.icon}</span>
                  <h3 className="font-semibold text-white mb-1">{f.title}</h3>
                  <p className="text-slate-500 text-sm">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== WHO IT'S FOR ===== */}
        <BusinessTypes />

        {/* ===== COMPARISON ===== */}
        <section className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-950/5 to-transparent" />
          <div className="max-w-4xl mx-auto relative">
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">You don&apos;t need Jobber.</h2>
              <p className="text-xl text-slate-400">Enterprise software for enterprise problems. You need something smarter.</p>
            </div>

            <div className="bg-[#0f0f11] border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left p-4 text-slate-400 font-medium">Feature</th>
                      <th className="p-4 text-center text-slate-500">Jobber</th>
                      <th className="p-4 text-center text-slate-500">Housecall</th>
                      <th className="p-4 text-center bg-orange-500/5 text-orange-400 font-bold">dyia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { feature: 'Starting price', jobber: '$349/mo', housecall: '$65/mo', dyia: '$14.99/mo' },
                      { feature: 'Job tracking', jobber: true, housecall: true, dyia: true },
                      { feature: 'Quote builder', jobber: true, housecall: true, dyia: true },
                      { feature: 'Tax set-aside', jobber: false, housecall: false, dyia: true },
                      { feature: 'AI assistant', jobber: false, housecall: false, dyia: true },
                      { feature: 'Smart pricing', jobber: false, housecall: false, dyia: true },
                      { feature: 'Revenue forecasting', jobber: false, housecall: false, dyia: true },
                      { feature: 'Setup time', jobber: 'Hours', housecall: '30 min', dyia: '2 min' },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-white/[0.03]">
                        <td className="p-4 text-slate-300">{row.feature}</td>
                        <td className="p-4 text-center">
                          {typeof row.jobber === 'boolean' ? (
                            row.jobber ? <span className="text-green-500">✓</span> : <span className="text-slate-600">—</span>
                          ) : <span className="text-slate-500">{row.jobber}</span>}
                        </td>
                        <td className="p-4 text-center">
                          {typeof row.housecall === 'boolean' ? (
                            row.housecall ? <span className="text-green-500">✓</span> : <span className="text-slate-600">—</span>
                          ) : <span className="text-slate-500">{row.housecall}</span>}
                        </td>
                        <td className="p-4 text-center bg-orange-500/5">
                          {typeof row.dyia === 'boolean' ? (
                            row.dyia ? <span className="text-green-400 font-bold">✓</span> : <span className="text-slate-600">—</span>
                          ) : <span className="text-white font-medium">{row.dyia}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* ===== PRICING ===== */}
        <section id="pricing" className="py-24 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-orange-400 text-sm font-medium uppercase tracking-wider mb-3">Pricing</p>
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">Start free. Upgrade when ready.</h2>
              <p className="text-xl text-slate-400">14-day Pro trial included. No credit card required.</p>
            </div>

            {/* Toggle */}
            <div className="flex justify-center mb-10">
              <div className="bg-white/5 border border-white/10 rounded-full p-1 inline-flex">
                <button onClick={() => setBillingCycle('monthly')} className={`px-6 py-2 rounded-full text-sm font-medium transition ${billingCycle === 'monthly' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                  Monthly
                </button>
                <button onClick={() => setBillingCycle('annual')} className={`px-6 py-2 rounded-full text-sm font-medium transition flex items-center gap-2 ${billingCycle === 'annual' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                  Annual <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Save 20%</span>
                </button>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Basic */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8">
                <h3 className="text-2xl font-bold text-white mb-1">Basic</h3>
                <p className="text-slate-500 text-sm mb-6">Essential profit tracking</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-5xl font-bold text-white">${billingCycle === 'monthly' ? '14.99' : '143'}</span>
                  <span className="text-slate-500">/{billingCycle === 'monthly' ? 'mo' : 'year'}</span>
                </div>
                {billingCycle === 'annual' && <p className="text-green-400 text-sm mb-6">$11.92/mo — save $36/year</p>}
                <ul className="space-y-3 mb-8">
                  {['Unlimited job tracking', 'Profit dashboard', 'Tax set-aside calculator', 'Quote builder + PDF', 'Follow-up tracking', 'Fixed expenses', 'Lead source analytics', 'CSV export'].map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                      <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => checkout(billingCycle, 'basic')} disabled={!!loading || !checkoutReady} className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold transition border border-white/10">
                  {loading === `basic-${billingCycle}` ? 'Redirecting...' : !checkoutReady && isSignedIn ? 'Loading...' : 'Get Basic'}
                </button>
              </div>

              {/* Pro */}
              <div className="relative bg-gradient-to-b from-orange-500/10 to-transparent border-2 border-orange-500/50 rounded-2xl p-8">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-1 rounded-full text-xs font-bold">
                  RECOMMENDED
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <DyiaAvatar className="w-6 h-6" />
                  <h3 className="text-2xl font-bold text-white">Pro</h3>
                </div>
                <p className="text-slate-500 text-sm mb-6">Everything + Dyia AI</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-5xl font-bold text-white">${billingCycle === 'monthly' ? '24.99' : '239'}</span>
                  <span className="text-slate-500">/{billingCycle === 'monthly' ? 'mo' : 'year'}</span>
                </div>
                {billingCycle === 'annual' && <p className="text-green-400 text-sm mb-6">$19.92/mo — save $60/year</p>}
                <ul className="space-y-3 mb-8">
                  {[
                    { text: 'Everything in Basic', highlight: false },
                    { text: 'Dyia AI Assistant', highlight: true },
                    { text: 'Natural language logging', highlight: true },
                    { text: 'Smart price suggestions', highlight: true },
                    { text: 'Revenue forecasting', highlight: true },
                    { text: 'Follow-up risk alerts', highlight: true },
                    { text: 'Priority support', highlight: false },
                  ].map((f, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                      <svg className={`w-4 h-4 ${f.highlight ? 'text-orange-400' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      <span className={f.highlight ? 'text-orange-300' : ''}>{f.text}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={startFreeTrial} className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 hover:-translate-y-0.5 transition-all">
                  Start 14-Day Free Trial
                </button>
                <p className="text-xs text-slate-500 text-center mt-3">No credit card required</p>
              </div>
            </div>

            {/* Guarantee + Coupon */}
            <div className="mt-12 text-center space-y-6">
              <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-white/[0.02] border border-white/[0.06] rounded-full text-sm">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-slate-400">14-day money-back guarantee</span>
              </div>
              
              <div className="max-w-xs mx-auto">
                <input type="text" value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Have a coupon?" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500 text-center text-sm" />
                {couponInput && <p className="text-green-400 text-xs mt-2">✓ Will be applied at checkout</p>}
              </div>
            </div>
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section id="faq" className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-950/5 to-transparent" />
          <div className="max-w-3xl mx-auto relative">
            <div className="text-center mb-12">
              <p className="text-orange-400 text-sm font-medium uppercase tracking-wider mb-3">FAQ</p>
              <h2 className="text-4xl sm:text-5xl font-bold text-white">Questions?</h2>
            </div>

            <div className="space-y-3">
              {[
                { q: 'Is the free trial actually free?', a: '100%. 14 days of full Pro access. No credit card required. After the trial, you can continue with Basic (still useful!) or upgrade to keep Pro features.' },
                { q: 'What\'s the difference between Basic and Pro?', a: 'Basic has everything for profit tracking: jobs, expenses, quotes, tax calculator, follow-ups. Pro adds Dyia AI — log jobs by chatting, get smart pricing suggestions, revenue forecasts, and AI-powered insights.' },
                { q: 'Can I use this on my phone?', a: 'Yes. dyia works in any browser — iPhone, Android, tablet, laptop. Log jobs from your truck, check numbers anywhere. No app download needed.' },
                { q: 'What if I want to cancel?', a: 'Cancel anytime in settings. No phone calls, no retention team. You keep access until your billing period ends. We hold your data for 90 days if you want to come back.' },
                { q: 'Is my data safe?', a: 'Yes. Encrypted, backed up daily, stored on secure cloud servers. We never sell your data. You can export everything as CSV anytime.' },
                { q: 'Do you offer refunds?', a: '14-day money-back guarantee. Not happy? Email support@dyia.co for a full refund. No questions asked.' },
              ].map((faq, i) => (
                <div key={i} className="border border-white/[0.06] rounded-xl overflow-hidden bg-white/[0.01]">
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full px-5 py-4 text-left flex justify-between items-center hover:bg-white/[0.02] transition">
                    <span className="font-medium text-white pr-4 text-sm">{faq.q}</span>
                    <svg className={`w-5 h-5 text-slate-500 transition-transform flex-shrink-0 ${openFaq === i ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-4">
                      <p className="text-slate-400 text-sm leading-relaxed">{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== CTA ===== */}
        <section className="py-24 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <DyiaAvatar className="w-16 h-16 mx-auto mb-8" />
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Ready to know your real numbers?
            </h2>
            <p className="text-xl text-slate-400 mb-10 max-w-xl mx-auto">
              Stop guessing. Start knowing. Takes 2 minutes to set up, 30 seconds to log your first job.
            </p>
            <button onClick={startFreeTrial} className="px-10 py-5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30 hover:-translate-y-0.5 transition-all inline-flex items-center gap-2">
              Start Free Trial
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
            <p className="text-slate-600 text-sm mt-6">14 days free • No credit card • Cancel anytime</p>
          </div>
        </section>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/[0.04] py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <DyiaAvatar className="w-7 h-7" />
              <span className="font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">dyia</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-500">
              <a href="mailto:support@dyia.co" className="hover:text-orange-400 transition">Support</a>
              <a href="#" className="hover:text-orange-400 transition">Privacy</a>
              <a href="#" className="hover:text-orange-400 transition">Terms</a>
            </div>
            <p className="text-slate-600 text-sm">© 2026 dyia</p>
          </div>
          <DemoAccess />
        </div>
      </footer>
    </div>
  )
}
