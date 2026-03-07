'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import BusinessTypes from '@/components/landing/BusinessTypes'

const STRIPE_PRICES = {
  basic: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID,
    annual: process.env.NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID,
  },
  pro: {
    monthly: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID,
    annual: process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID,
  },
}


// Dyia Avatar — brand gradient icon with fallback
function DyiaAvatar({ className = "w-10 h-10" }: { className?: string }) {
  const [imgError, setImgError] = useState(false)
  
  if (imgError) {
    return (
      <div className={`${className} rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-sm`}>
        <span className="text-white font-black" style={{ fontSize: 'calc(0.4 * 100%)' }}>d</span>
      </div>
    )
  }
  
  return (
    <img 
      src="/dyia-logo.png" 
      alt="dyia" 
      className={`${className} object-contain`}
      onError={() => setImgError(true)}
    />
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard
    setMounted(true)
    const cookies = document.cookie.split(';')
    setHasDemoCookie(cookies.some(c => c.trim().startsWith('dyia_demo_active=')))
    // Check for founders flag in both query string (?founders=1) and hash (#pricing?founders=1)
    const search = typeof window !== 'undefined' ? window.location.search : ''
    const hashQuery = typeof window !== 'undefined' && window.location.hash.includes('?')
      ? window.location.hash.split('?')[1] : ''
    const params = new URLSearchParams(search || hashQuery)
    if (params.get('founders') === '1') setUseFoundersCoupon(true)
  }, [])

  async function checkout(plan: 'monthly' | 'annual', tier: 'basic' | 'pro' = 'pro') {
    setLoading(`${tier}-${plan}`)
    if (!isSignedIn) {
      window.location.href = `/sign-up?redirect_url=${encodeURIComponent(`/app?plan=${plan}&tier=${tier}`)}`
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
          priceId: STRIPE_PRICES[tier][plan],
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

  const startFreeTrial = () => checkout(billingCycle, 'pro')

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
            <Link href="/" className="flex items-center">
              <img src="/dyia-logo-full.png" alt="dyia" className="h-8 object-contain brightness-0 invert" />
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link href="/pricing-calculator" className="text-sm text-slate-400 hover:text-white transition">Pricing Calculator</Link>
              <Link href="/profit-calculator" className="text-sm text-slate-400 hover:text-white transition">Free quiz</Link>
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
        <section className="pt-36 pb-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className={`transition-all duration-700 delay-100 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                <div className="flex flex-wrap items-center gap-2.5 mb-8">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-400 text-[13px] font-medium">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                    </span>
                    AI-powered business intelligence
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/[0.06] border border-white/[0.08] text-slate-400 uppercase tracking-wider">
                    New
                  </span>
                </div>
                
                <h1 className="text-5xl sm:text-6xl lg:text-[4.25rem] font-bold leading-[1.05] mb-6 tracking-tight">
                  Know your
                  <br />
                  <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-[gradientShift_6s_ease-in-out_infinite]">real profit.</span>
                </h1>
                
                <p className="text-lg sm:text-xl text-slate-400 mb-10 leading-relaxed max-w-xl">
                  The AI-powered business manager for service pros. Track jobs, build quotes, manage customers, and finally know what you actually take home.
                </p>

                <div className="flex flex-wrap gap-3 mb-10">
                  <button onClick={startFreeTrial} className="group px-7 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold text-base shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                    Start Free — 14 Day Trial
                    <svg className="w-4.5 h-4.5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </button>
                  <a href="#ai" className="px-7 py-3.5 bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.08] hover:border-white/[0.15] rounded-xl font-semibold text-base transition-all">
                    See how it works
                  </a>
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-slate-500">
                  {['14-day free trial', 'Cancel anytime', 'Works on any device'].map((item, i) => (
                    <span key={i} className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-green-500/70" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* App Preview — faithful miniature of the real dashboard */}
              <div className={`relative transition-all duration-1000 delay-300 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
                {/* Ambient glow */}
                <div className="absolute -inset-4 bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-orange-500/15 rounded-[2rem] blur-3xl animate-pulse-soft" />
                <div className="absolute -inset-1 bg-gradient-to-b from-orange-500/20 to-transparent rounded-[1.5rem] blur-xl" />
                
                {/* Browser Frame */}
                <div className="relative bg-[#0c0c0e] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
                  {/* Browser Chrome */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1e] border-b border-white/[0.06]">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                    </div>
                    <div className="flex-1 flex justify-center">
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-white/[0.06] rounded-md">
                        <svg className="w-2.5 h-2.5 text-green-500/80" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                        <span className="text-[10px] text-slate-500 font-medium">dyia.io</span>
                      </div>
                    </div>
                    <div className="w-12" />
                  </div>
                  
                  {/* App Layout — Sidebar + Dashboard */}
                  <div className="flex" style={{ height: '420px' }}>
                    {/* Mini Sidebar */}
                    <div className="w-11 bg-[#0f1117] border-r border-white/[0.06] flex flex-col items-center py-3 gap-1 shrink-0">
                      {/* Logo dot */}
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mb-3">
                        <img src="/dyia-agent.png" alt="" className="w-4 h-4 object-contain" />
                      </div>
                      {/* Nav icons */}
                      {[
                        { active: true, icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /> },
                        { active: false, icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /> },
                        { active: false, icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
                        { active: false, icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /> },
                        { active: false, icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /> },
                        { active: false, icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
                      ].map((nav, i) => (
                        <div key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center ${nav.active ? 'bg-orange-500/15' : 'hover:bg-white/5'}`}>
                          <svg className={`w-3.5 h-3.5 ${nav.active ? 'text-orange-400' : 'text-slate-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">{nav.icon}</svg>
                        </div>
                      ))}
                      {/* Dyia AI nav item */}
                      <div className="mt-auto w-7 h-7 rounded-lg flex items-center justify-center bg-orange-500/10">
                        <img src="/dyia-agent.png" alt="" className="w-3.5 h-3.5 object-contain" />
                      </div>
                    </div>
                    
                    {/* Main Dashboard Content */}
                    <div className="flex-1 overflow-hidden bg-[#fafafa] p-3 space-y-2.5">
                      {/* Greeting Banner */}
                      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg p-3 text-white relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-white/10" />
                        <div className="absolute -left-2 -bottom-2 w-10 h-10 rounded-full bg-white/5" />
                        <div className="relative flex items-center justify-between">
                          <div>
                            <p className="text-[11px] font-bold leading-tight">Good morning, Marcus</p>
                            <p className="text-[8px] text-white/80 mt-0.5">12 jobs this month, $8,640 revenue. 74% to goal.</p>
                          </div>
                          <div className="flex gap-1">
                            <div className="px-1.5 py-0.5 bg-white/20 rounded text-[7px] font-medium">+ Log Job</div>
                            <div className="px-1.5 py-0.5 bg-white/20 rounded text-[7px] font-medium">New Quote</div>
                          </div>
                        </div>
                      </div>

                      {/* Business Pipeline */}
                      <div>
                        <p className="text-[7px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Business Pipeline</p>
                        <div className="flex items-stretch gap-0">
                          {[
                            { label: 'Quotes', value: '5', sub: '$3,200', color: 'text-blue-600', bg: 'bg-blue-50', dot: 'bg-blue-100' },
                            { label: 'Follow-ups', value: '3', sub: 'Pending', color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-100' },
                            { label: 'Jobs', value: '12', sub: '$8,640', color: 'text-green-600', bg: 'bg-green-50', dot: 'bg-green-100' },
                            { label: 'Take Home', value: '$4,120', sub: 'After 30% tax', color: 'text-purple-600', bg: 'bg-purple-50', dot: 'bg-purple-100' },
                          ].map((stage, i) => (
                            <div key={i} className="flex items-stretch">
                              <div className={`bg-white border border-slate-200/80 ${i === 0 ? 'rounded-l-lg' : ''} ${i === 3 ? 'rounded-r-lg' : ''} p-2 min-w-[70px]`}>
                                <div className="flex items-center gap-1 mb-1">
                                  <div className={`w-3 h-3 rounded-full ${stage.dot} flex items-center justify-center`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${stage.bg}`} />
                                  </div>
                                  <span className={`text-[7px] font-semibold ${stage.color} uppercase`}>{stage.label}</span>
                                </div>
                                <p className="text-sm font-bold text-slate-900 leading-none">{stage.value}</p>
                                <p className="text-[7px] text-slate-400 mt-0.5">{stage.sub}</p>
                              </div>
                              {i < 3 && (
                                <div className="flex items-center -mx-0.5 z-10">
                                  <svg className="w-2.5 h-2.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Feed */}
                      <div className="space-y-1">
                        <p className="text-[7px] font-semibold text-slate-400 uppercase tracking-wider">Needs Your Attention</p>
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-white rounded-lg border border-slate-200/80 border-l-2 border-l-red-400">
                          <svg className="w-2.5 h-2.5 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-[8px] font-medium text-slate-800 truncate">3 follow-ups need attention</p>
                            <p className="text-[7px] text-slate-400 truncate">Following up within 48hrs has 3x conversion</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-white rounded-lg border border-slate-200/80 border-l-2 border-l-amber-400">
                          <svg className="w-2.5 h-2.5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-[8px] font-medium text-slate-800 truncate">5 pending quotes</p>
                            <p className="text-[7px] text-slate-400 truncate">$3,200 total value</p>
                          </div>
                        </div>
                      </div>

                      {/* Monthly Goal */}
                      <div className="bg-white rounded-lg border border-slate-200/80 p-2">
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <p className="text-[8px] font-semibold text-slate-800">Monthly Goal</p>
                            <p className="text-[7px] text-slate-400">$8,640 of $12,000</p>
                          </div>
                          <span className="text-[10px] font-bold text-slate-700">74%</span>
                        </div>
                        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full w-[74%] bg-gradient-to-r from-orange-500 to-amber-500 rounded-full" />
                        </div>
                      </div>

                      {/* Dyia AI Insight Strip */}
                      <div className="bg-white border border-orange-200/60 rounded-lg p-2 flex items-start gap-2">
                        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shrink-0">
                          <img src="/dyia-agent.png" alt="" className="w-3 h-3 object-contain" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[8px] text-slate-600 leading-relaxed">
                            Hot tub removals average <span className="text-orange-600 font-semibold">$485 profit</span> — 40% more than general hauling. Worth focusing your ads there.
                          </p>
                        </div>
                      </div>

                      {/* Recent Jobs */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[7px] font-semibold text-slate-400 uppercase tracking-wider">Recent Jobs</p>
                          <span className="text-[7px] text-orange-500 font-medium">View all</span>
                        </div>
                        <div className="bg-white rounded-lg border border-slate-200/80 divide-y divide-slate-100 overflow-hidden">
                          {[
                            { name: 'Mike R.', amount: '$520', profit: '68%', date: 'Today', color: 'text-green-600' },
                            { name: 'Sarah K.', amount: '$280', profit: '87%', date: 'Yesterday', color: 'text-green-600' },
                            { name: 'Tom L.', amount: '$1,200', profit: '54%', date: 'Feb 14', color: 'text-green-600' },
                          ].map((job, i) => (
                            <div key={i} className="flex items-center justify-between px-2 py-1.5">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-5 h-5 rounded-md bg-green-50 flex items-center justify-center`}>
                                  <span className="text-[7px] font-bold text-green-600">{job.profit}</span>
                                </div>
                                <div>
                                  <p className="text-[8px] font-medium text-slate-800">{job.name}</p>
                                  <p className="text-[7px] text-slate-400">{job.date}</p>
                                </div>
                              </div>
                              <span className="text-[9px] font-semibold text-green-600">{job.amount}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== SOCIAL PROOF STRIP ===== */}
        <section className="py-12 px-6 border-y border-white/[0.04]">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { value: '30 sec', label: 'Average time to log a job', detail: 'From your truck' },
                { value: '100%', label: 'Profit visibility', detail: 'Every dollar tracked' },
                { value: '2 min', label: 'Setup to first job', detail: 'No training needed' },
                { value: '$0', label: 'To start your trial', detail: '14 days free' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">{stat.value}</p>
                  <p className="text-sm text-slate-300 mt-1.5 font-medium">{stat.label}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{stat.detail}</p>
                </div>
              ))}
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
              <p className="text-lg text-slate-400 mb-6">
                dyia fixes all of this — for <span className="text-orange-400 font-semibold">less than a tank of gas</span>.
              </p>
              <button onClick={startFreeTrial} className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-orange-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all inline-flex items-center gap-2">
                See for yourself
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </button>
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
                  title: 'Grow smarter',
                  desc: 'Track customers, send quotes, follow up automatically. Dyia learns your business and helps you price, plan, and profit more.',
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

        {/* ===== FULL PLATFORM OVERVIEW ===== */}
        <section id="features" className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-950/5 to-transparent" />
          <div className="max-w-6xl mx-auto relative">
            <div className="text-center mb-16">
              <p className="text-orange-400 text-sm font-medium uppercase tracking-wider mb-3">The full platform</p>
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">Everything you need to run your business</h2>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto">Not just tracking — a complete business operating system built for one-truck operators and growing teams alike.</p>
            </div>

            {/* Highlighted features - larger cards */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {[
                {
                  icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
                  title: 'Job Tracking & Profit Calculator',
                  desc: 'Log every job in seconds with revenue, gas, dump fees, labor, materials, and dumpster costs. See your actual take-home pay instantly — not just gross revenue. Split expenses across multi-customer jobs automatically.',
                  highlights: ['Per-job profit breakdown', 'Multi-customer splitting', 'Lead source tracking'],
                },
                {
                  icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
                  title: 'Professional Quote Builder',
                  desc: 'Create branded PDF quotes with your logo, volume-based pricing, specialty surcharges, and photo attachments. Send to customers and track status through accepted, declined, or expired. Auto-creates follow-ups.',
                  highlights: ['Branded PDF export', 'Photo attachments', 'Auto follow-up creation'],
                },
                {
                  icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
                  title: 'Customer Database & CRM',
                  desc: 'Build a real customer database. Store contact info, notes, and tags. See each customer\'s lifetime value, job history, and quote history. Auto-fill customer details when creating jobs or quotes.',
                  highlights: ['Lifetime value tracking', 'Job & quote history', 'Smart autocomplete'],
                },
                {
                  icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
                  title: 'Follow-Up Pipeline',
                  desc: 'Never lose a lead. Quotes automatically create follow-ups with hot, warm, and cold priority scoring. Drag-and-drop Kanban board to track contacted, snoozed, converted, and lost. Convert directly to a job with one click.',
                  highlights: ['Auto-priority scoring', 'Kanban drag & drop', 'One-click conversion'],
                },
              ].map((f, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:border-orange-500/20 transition-all">
                  <div className="w-12 h-12 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center text-orange-400 mb-4">
                    {f.icon}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-4">{f.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {f.highlights.map((h, j) => (
                      <span key={j} className="text-xs px-2.5 py-1 bg-white/[0.04] border border-white/[0.06] rounded-full text-slate-400">{h}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Grid of smaller features */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: '🧾', title: 'Tax Set-Aside', desc: 'Adjustable percentage automatically calculated on every job. Know exactly what to save for April.' },
                { icon: '💳', title: 'Fixed Expenses', desc: 'Track monthly overhead — insurance, truck payment, tools, software. See true net profit.' },
                { icon: '🎯', title: 'Monthly Goals', desc: 'Set revenue targets. Visual progress tracking on your dashboard with weekly breakdowns.' },
                { icon: '📊', title: 'Reports & Analytics', desc: 'Revenue by source, expense breakdowns, monthly trends, and performance metrics.' },
                { icon: '📧', title: 'Email Blasts', desc: 'Send targeted emails to your customer list. Connect Gmail or Outlook. Track campaigns.', pro: true },
                { icon: '⭐', title: 'Review Requests', desc: 'Request Google, Yelp, or Facebook reviews after completed jobs with one-tap messages.' },
                { icon: '📈', title: 'Marketing ROI', desc: 'Log ad spend by channel. See which marketing actually brings profitable customers.', pro: true },
                { icon: '📥', title: 'Data Export', desc: 'Download all jobs, quotes, and customer data as CSV. Your data is always yours.' },
              ].map((f, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 hover:border-orange-500/20 transition-all relative">
                  {f.pro && <div className="absolute top-3 right-3 px-1.5 py-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded text-[9px] font-bold text-white">PRO</div>}
                  <span className="text-xl mb-2 block">{f.icon}</span>
                  <h3 className="font-semibold text-white text-sm mb-1">{f.title}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
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
                  <div className="flex justify-end">
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl rounded-br-sm px-4 py-3 max-w-[85%]">
                      <p className="text-sm text-slate-200">What should I charge for a hot tub removal?</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <DyiaAvatar className="w-7 h-7 shrink-0 mt-1" />
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

                  <div className="flex justify-end">
                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl rounded-br-sm px-4 py-3 max-w-[85%]">
                      <p className="text-sm text-slate-200">Log a job — Sarah, couch removal, $280, $35 dump fee</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <DyiaAvatar className="w-7 h-7 shrink-0 mt-1" />
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl rounded-bl-sm px-4 py-3">
                      <p className="text-sm text-slate-300 mb-3">&quot;Got it. Here&apos;s the breakdown:&quot;</p>
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

              {/* AI Features */}
              <div className="lg:col-span-2 space-y-3">
                {[
                  { icon: '💬', title: 'Natural language', desc: 'Just describe what happened. "Did a basement cleanout for Mike, $400, two dump runs." Dyia extracts every detail.' },
                  { icon: '💰', title: 'Smart pricing', desc: 'Ask what to charge. Dyia analyzes YOUR past jobs by type, size, and difficulty to suggest the right price.' },
                  { icon: '📊', title: 'Instant insights', desc: '"How am I doing this month?" — get real answers with revenue, profit margins, and comparisons to last month.' },
                  { icon: '📈', title: 'Revenue forecasting', desc: 'Predict what you\'ll make based on your booking patterns, seasonal trends, and historical data.' },
                  { icon: '🔔', title: 'Follow-up alerts', desc: 'Dyia monitors your quote pipeline and flags leads going cold before you lose them.' },
                  { icon: '📋', title: 'Quote generation', desc: 'Describe the job in a message and Dyia generates a professional quote you can send as PDF.' },
                ].map((f, i) => (
                  <div key={i} className="flex gap-3 p-4 bg-white/[0.02] border border-white/[0.04] rounded-xl hover:border-orange-500/20 transition-all">
                    <span className="text-xl shrink-0">{f.icon}</span>
                    <div>
                      <h4 className="font-medium text-white text-sm">{f.title}</h4>
                      <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
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
              <p className="text-xl text-slate-400">Enterprise software for enterprise problems. You need an American-built tool designed for how you actually work — billed in USD, no currency headaches.</p>
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
                      { feature: 'Starting price', jobber: '$349/mo', housecall: '$65/mo', dyia: '$19.99/mo' },
                      { feature: 'Job tracking', jobber: true, housecall: true, dyia: true },
                      { feature: 'Quote builder', jobber: true, housecall: true, dyia: true },
                      { feature: 'Customer CRM', jobber: true, housecall: true, dyia: true },
                      { feature: 'Tax set-aside', jobber: false, housecall: false, dyia: true },
                      { feature: 'AI assistant', jobber: false, housecall: false, dyia: true },
                      { feature: 'Smart pricing', jobber: false, housecall: false, dyia: true },
                      { feature: 'Revenue forecasting', jobber: false, housecall: false, dyia: true },
                      { feature: 'Email blasts', jobber: true, housecall: false, dyia: true },
                      { feature: 'Based in', jobber: 'Canada', housecall: 'USA', dyia: 'USA' },
                      { feature: 'Billing currency', jobber: 'CAD', housecall: 'USD', dyia: 'USD' },
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
            <div className="text-center mb-6">
              <p className="text-orange-400 text-sm font-medium uppercase tracking-wider mb-3">Simple, honest pricing</p>
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">Less than a tank of gas.</h2>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto">Every plan starts with a 14-day free Pro trial. No hidden fees, no contracts, cancel anytime.</p>
            </div>

            <p className="text-sm text-slate-500 text-center mb-10">American company · All prices in USD · Secure payments via Stripe</p>

            {/* Toggle */}
            <div className="flex justify-center mb-10">
              <div className="bg-white/5 border border-white/10 rounded-full p-1 inline-flex">
                <button onClick={() => setBillingCycle('monthly')} className={`px-6 py-2.5 rounded-full text-sm font-medium transition ${billingCycle === 'monthly' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-400 hover:text-white'}`}>
                  Monthly
                </button>
                <button onClick={() => setBillingCycle('annual')} className={`px-6 py-2.5 rounded-full text-sm font-medium transition flex items-center gap-2 ${billingCycle === 'annual' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-400 hover:text-white'}`}>
                  Annual <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold">Save 17%</span>
                </button>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Basic */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 flex flex-col">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-white mb-1">Basic</h3>
                  <p className="text-slate-400 text-sm">Everything you need for day-to-day operations</p>
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-5xl font-bold text-white">${billingCycle === 'monthly' ? '19.99' : '16.66'}</span>
                  <span className="text-slate-500">/mo</span>
                </div>
                {billingCycle === 'annual' && <p className="text-green-400 text-sm mb-4">$199.90 billed annually — save $40</p>}
                {billingCycle === 'monthly' && <p className="text-slate-600 text-sm mb-4">Billed monthly</p>}

                <div className="border-t border-white/[0.06] pt-6 mb-6">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Core features</p>
                  <ul className="space-y-3">
                    {[
                      { text: 'Unlimited job tracking', desc: 'Log every job with full expense breakdown' },
                      { text: 'Profit dashboard', desc: 'Real-time revenue, expenses, and take-home' },
                      { text: 'Quote builder + PDF export', desc: 'Branded quotes with your logo and photos' },
                      { text: 'Customer database & CRM', desc: 'Contact info, lifetime value, job history' },
                      { text: 'Follow-up pipeline', desc: 'Kanban board with hot/warm/cold scoring' },
                      { text: 'Tax set-aside calculator', desc: 'Auto-calculated on every job' },
                      { text: 'Fixed expense tracking', desc: 'Insurance, truck payment, overhead' },
                      { text: 'Review requests', desc: 'One-tap Google, Yelp, Facebook reviews' },
                      { text: 'Lead source analytics', desc: 'See which marketing channels work' },
                      { text: 'CSV data export', desc: 'Your data is always yours' },
                    ].map((f, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <svg className="w-4 h-4 text-green-500/70 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        <div>
                          <span className="text-sm text-slate-200">{f.text}</span>
                          <p className="text-xs text-slate-500 mt-0.5">{f.desc}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto">
                  <button onClick={() => checkout(billingCycle, 'basic')} disabled={!!loading || !checkoutReady} className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold transition border border-white/10">
                    {loading === `basic-${billingCycle}` ? 'Redirecting...' : !checkoutReady && isSignedIn ? 'Loading...' : 'Get Basic'}
                  </button>
                </div>
              </div>

              {/* Pro */}
              <div className="relative bg-gradient-to-b from-orange-500/10 to-transparent border-2 border-orange-500/50 rounded-2xl p-8 flex flex-col">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-5 py-1 rounded-full text-xs font-bold shadow-lg shadow-orange-500/20">
                  MOST POPULAR
                </div>
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <DyiaAvatar className="w-6 h-6" />
                    <h3 className="text-2xl font-bold text-white">Pro</h3>
                  </div>
                  <p className="text-slate-400 text-sm">Basic + AI assistant, email campaigns, and marketing tools</p>
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-5xl font-bold text-white">${billingCycle === 'monthly' ? '29.99' : '24.99'}</span>
                  <span className="text-slate-500">/mo</span>
                </div>
                {billingCycle === 'annual' && <p className="text-green-400 text-sm mb-4">$299.90 billed annually — save $60</p>}
                {billingCycle === 'monthly' && <p className="text-slate-600 text-sm mb-4">Billed monthly</p>}

                <div className="border-t border-orange-500/20 pt-6 mb-6">
                  <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-4">Everything in Basic, plus</p>
                  <ul className="space-y-3">
                    {[
                      { text: 'Dyia AI Assistant', desc: 'Your AI business partner — logs jobs, creates quotes, gives insights' },
                      { text: 'Natural language job logging', desc: '"$350 for Mike, $40 dump fee" — Dyia handles the rest' },
                      { text: 'AI-powered price suggestions', desc: 'Based on YOUR past jobs by type and difficulty' },
                      { text: 'Revenue forecasting', desc: 'Predict monthly revenue with confidence scoring' },
                      { text: 'Follow-up risk alerts', desc: 'Flags leads going cold before you lose them' },
                      { text: 'Mass email campaigns', desc: 'Send via Gmail or Outlook to your customer list' },
                      { text: 'Marketing ROI tracking', desc: 'See cost per lead by channel — Google, Yelp, Facebook' },
                      { text: 'Weekly AI business insights', desc: 'Performance emails with trends and recommendations' },
                      { text: 'Priority support', desc: 'Faster response times from our team' },
                    ].map((f, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <svg className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        <div>
                          <span className="text-sm text-orange-200">{f.text}</span>
                          <p className="text-xs text-slate-500 mt-0.5">{f.desc}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto">
                  <button onClick={() => checkout(billingCycle, 'pro')} disabled={!!loading || !checkoutReady} className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 hover:-translate-y-0.5 transition-all">
                    {loading === `pro-${billingCycle}` ? 'Redirecting...' : !checkoutReady && isSignedIn ? 'Loading...' : 'Start 14-Day Free Trial'}
                  </button>
                  <p className="text-xs text-slate-500 text-center mt-3">Card required · Cancel anytime during trial</p>
                </div>
              </div>
            </div>

            {/* Trust signals */}
            <div className="mt-12 flex flex-wrap justify-center gap-4">
              {[
                { icon: '🛡️', text: '14-day money-back guarantee' },
                { icon: '🔒', text: 'Secured by Stripe' },
                { icon: '📥', text: 'Export your data anytime' },
                { icon: '🚫', text: 'No contracts or lock-in' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2 bg-white/[0.02] border border-white/[0.06] rounded-full text-sm text-slate-400">
                  <span>{item.icon}</span>
                  {item.text}
                </div>
              ))}
            </div>

            {/* Coupon */}
            <div className="mt-8 max-w-xs mx-auto">
              <input type="text" value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Have a coupon code?" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-500 text-center text-sm" />
              {couponInput && <p className="text-green-400 text-xs mt-2 text-center">✓ Will be applied at checkout</p>}
            </div>
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section id="faq" className="py-24 px-6 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-950/5 to-transparent" />
          <div className="max-w-3xl mx-auto relative">
            <div className="text-center mb-12">
              <p className="text-orange-400 text-sm font-medium uppercase tracking-wider mb-3">FAQ</p>
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">Got questions?</h2>
              <p className="text-lg text-slate-400">Everything you need to know before getting started.</p>
            </div>

            <div className="space-y-3">
              {[
                { q: 'Is the free trial actually free?', a: '100%. You get 14 days of full Pro access — AI assistant, email blasts, marketing tools, everything. A card is required to start, but you won\'t be charged a cent until day 15. Cancel anytime before then from Settings. After the trial, choose Basic ($19.99/mo) or keep Pro ($29.99/mo).' },
                { q: 'What\'s the difference between Basic and Pro?', a: 'Basic gives you everything for day-to-day operations: unlimited job tracking, profit dashboard, quote builder with branded PDF export, customer CRM, follow-up pipeline with Kanban board, tax set-aside, review requests, fixed expenses, and CSV export. Pro adds the Dyia AI assistant (natural language job logging, smart pricing based on your history, revenue forecasting), mass email campaigns via Gmail/Outlook, marketing ROI tracking, follow-up risk alerts, weekly AI insights emails, and priority support.' },
                { q: 'Can I use dyia on my phone?', a: 'Yes. Dyia is a progressive web app that works in any browser — iPhone, Android, tablet, laptop. Log jobs from your truck, check numbers at the dump, send quotes from your couch. No app download needed. Add it to your home screen for an app-like experience.' },
                { q: 'How is this different from a spreadsheet?', a: 'A spreadsheet can\'t calculate profit per job after gas, dump fees, and labor automatically. It can\'t generate branded PDF quotes, track customer lifetime value, manage a follow-up pipeline with priority scoring, set aside taxes, forecast revenue, or let you log jobs by talking to an AI. Dyia does all of that in 30 seconds per job.' },
                { q: 'How is this different from Jobber or Housecall Pro?', a: 'Those tools are built for enterprise fleets — complex scheduling, route optimization, dispatch for teams of 20+. Dyia is built for service pros who work with 1-5 people and need to know their real profit. We cost a fraction of the price ($19.99 vs $349/mo), set up in 2 minutes instead of hours, and include AI features they don\'t have.' },
                { q: 'Can I manage my customers in dyia?', a: 'Yes. Dyia has a full customer database with contact info, notes, and tags. Every customer\'s lifetime value, job history, and quote history is tracked automatically. When you create a new job or quote, customer details auto-fill.' },
                { q: 'How do email campaigns work?', a: 'Connect your Gmail or Outlook account via secure OAuth (Pro feature). Compose emails, select recipients from your customer database, and send to up to 50 customers at once. Track delivery status and campaign history. Emails are sent from your actual email address.' },
                { q: 'What if I want to cancel?', a: 'Cancel anytime from Settings > Account. No phone calls, no retention team, no tricks. You keep access until your current billing period ends. We hold your data for 90 days if you decide to come back.' },
                { q: 'Is my data safe?', a: 'Yes. Encrypted in transit and at rest, backed up daily, stored on secure cloud servers (Supabase/AWS). We never sell your data. You can export everything as CSV anytime — your data is always yours.' },
                { q: 'Do you offer refunds?', a: '14-day money-back guarantee on all paid plans. Not happy? Email dyia.io.app@gmail.com and get a full refund. No questions asked.' },
              ].map((faq, i) => (
                <div key={i} className="border border-white/[0.06] rounded-xl overflow-hidden bg-white/[0.01]">
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full px-5 py-4 text-left flex justify-between items-center hover:bg-white/[0.02] transition">
                    <span className="font-medium text-white pr-4 text-sm">{faq.q}</span>
                    <svg className={`w-5 h-5 text-slate-500 transition-transform shrink-0 ${openFaq === i ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

            <div className="mt-8 text-center">
              <p className="text-sm text-slate-500">
                Still have questions?{' '}
                <Link href="/support" className="text-orange-400 hover:text-orange-300 underline underline-offset-2">Visit our Help Center</Link>
                {' '}or email{' '}
                <a href="mailto:dyia.io.app@gmail.com" className="text-orange-400 hover:text-orange-300 underline underline-offset-2">dyia.io.app@gmail.com</a>
              </p>
            </div>
          </div>
        </section>

        {/* ===== CTA ===== */}
        <section className="py-24 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="relative bg-gradient-to-b from-orange-500/10 via-orange-500/5 to-transparent border border-orange-500/20 rounded-3xl p-10 sm:p-14 text-center overflow-hidden">
              {/* Decorative glow */}
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
              
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-orange-500/30">
                  <img src="/dyia-agent.png" alt="" className="w-10 h-10 object-contain" />
                </div>
                <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
                  Stop guessing.<br />Start knowing.
                </h2>
                <p className="text-lg text-slate-400 mb-10 max-w-lg mx-auto">
                  Join service pros who finally know what they take home. 2 minutes to set up. 30 seconds to log your first job.
                </p>
                <button onClick={startFreeTrial} className="px-10 py-5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/35 hover:-translate-y-0.5 transition-all inline-flex items-center gap-2">
                  Start Free Trial
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-500 mt-6">
                  <span>14 days free</span>
                  <span>Cancel anytime</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/[0.04] py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center mb-4">
                <img src="/dyia-logo-full.png" alt="dyia" className="h-7 object-contain brightness-0 invert" />
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">Your day, decoded. The AI-powered business manager for service professionals.</p>
              <p className="text-xs text-slate-600 mt-2">Proudly American-based · All prices in USD</p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="#features" className="hover:text-orange-400 transition">Features</a></li>
                <li><a href="#ai" className="hover:text-orange-400 transition">Dyia AI</a></li>
                <li><a href="#pricing" className="hover:text-orange-400 transition">Pricing</a></li>
                <li><a href="#faq" className="hover:text-orange-400 transition">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><Link href="/support" className="hover:text-orange-400 transition">Support</Link></li>
                <li><Link href="/privacy" className="hover:text-orange-400 transition">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-orange-400 transition">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Get Started</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><Link href="/sign-up" className="hover:text-orange-400 transition">Create Account</Link></li>
                <li><Link href="/sign-in" className="hover:text-orange-400 transition">Sign In</Link></li>
                <li><Link href="/app" className="hover:text-orange-400 transition">Dashboard</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/[0.04] pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-600 text-sm">© 2026 dyia. All rights reserved.</p>
            <p className="text-slate-600 text-xs">Built with care for service businesses everywhere.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
