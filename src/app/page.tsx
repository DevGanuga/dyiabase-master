'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import Image from 'next/image'

const STRIPE_PRICES = {
  monthly: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID,
  annual: process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID,
}

// Hidden demo access component for admin/demo purposes
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
        setTimeout(() => {
          window.location.href = '/app'
        }, 500)
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
    <div className="mt-8 pt-6 border-t border-orange-200/30">
      {!showInput ? (
        <button 
          onClick={() => setShowInput(true)}
          className="text-orange-200 hover:text-orange-300 text-xs transition cursor-pointer"
        >
          •••
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 justify-center">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Demo password"
            className="px-3 py-1.5 text-xs border border-orange-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 w-36"
            autoFocus
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition ${
              status === 'success' 
                ? 'bg-green-500 text-white' 
                : status === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-orange-500 text-white hover:bg-orange-400'
            }`}
          >
            {status === 'loading' ? '...' : status === 'success' ? '✓' : status === 'error' ? '✗' : 'Go'}
          </button>
          <button
            type="button"
            onClick={() => { setShowInput(false); setPassword(''); setStatus('idle'); }}
            className="text-orange-300 hover:text-orange-500 text-xs"
          >
            ✕
          </button>
        </form>
      )}
    </div>
  )
}

export default function LandingPage() {
  const { isSignedIn, isLoaded } = useUser()
  
  const [loading, setLoading] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [couponInput, setCouponInput] = useState('')
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [hasDemoCookie, setHasDemoCookie] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Check for demo cookie
    const cookies = document.cookie.split(';')
    const hasDemo = cookies.some(c => c.trim().startsWith('dyia_demo_access='))
    setHasDemoCookie(hasDemo)
  }, [])

  async function checkout(plan: 'monthly' | 'annual') {
    setLoading(plan)

    if (!isSignedIn) {
      window.location.href = `/sign-up?redirect_url=/app?plan=${plan}`
      return
    }

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: STRIPE_PRICES[plan],
          couponCode: couponInput || undefined,
        }),
      })

      const data = await response.json()

      if (data.error) {
        alert('Error creating checkout: ' + data.error)
        setLoading(null)
        return
      }

      window.location.href = data.url
    } catch (error) {
      console.error('Checkout error:', error)
      alert('Error initiating checkout')
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      {/* Orange Gradient Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-50 via-white to-white" />
        <div className="absolute top-0 right-0 w-[800px] h-[600px] bg-gradient-to-bl from-orange-100/60 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-gradient-to-r from-amber-100/40 to-transparent rounded-full blur-3xl" />
      </div>

      {/* Announcement Banner - Orange */}
      <div className="bg-gradient-to-r from-orange-500 via-orange-400 to-amber-400 text-white py-2.5 text-center text-sm font-medium">
        <span className="inline-flex items-center gap-2">
          <span className="animate-bounce">🎉</span>
          <span>Gumroad customers: Use code <code className="bg-white/20 px-2 py-0.5 rounded font-mono text-xs">GUMROAD20</code> for 20% off annual!</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className={`sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-orange-100 transition-all duration-500 ${mounted ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image 
              src="/dyia-logo.png" 
              alt="dyia" 
              width={36} 
              height={36}
              className="group-hover:scale-110 transition-transform drop-shadow-md"
            />
            <span className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">dyia</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <a href="#how-it-works" className="text-slate-600 hover:text-orange-600 text-sm font-medium transition">How it works</a>
            <a href="#pricing" className="text-slate-600 hover:text-orange-600 text-sm font-medium transition">Pricing</a>
            <a href="#faq" className="text-slate-600 hover:text-orange-600 text-sm font-medium transition">FAQ</a>
            <Link 
              href={(isSignedIn || hasDemoCookie) ? "/app" : "/sign-in"} 
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white rounded-full font-semibold text-sm shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all"
            >
              {(isSignedIn || hasDemoCookie) ? 'Open App' : 'Sign In'}
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="pt-20 pb-16 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className={`transition-all duration-700 delay-100 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 border border-orange-200 rounded-full text-orange-700 text-sm font-medium mb-8">
                <span>🚛</span>
                <span>Built for junk haulers, by junk haulers</span>
              </div>
            </div>
            
            <h1 className={`text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] mb-6 transition-all duration-700 delay-200 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              <span className="bg-gradient-to-r from-orange-500 via-orange-400 to-amber-500 bg-clip-text text-transparent">Your Day,</span>
              <br />
              <span className="text-slate-800">Decoded.</span>
            </h1>
            
            <p className={`text-xl sm:text-2xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed transition-all duration-700 delay-300 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              Know exactly what you pocket after every job. 
              <span className="text-orange-600 font-medium"> No spreadsheets. No guessing.</span>
            </p>
            
            <div className={`flex flex-wrap justify-center gap-4 mb-12 transition-all duration-700 delay-400 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              <a 
                href="#pricing" 
                className="group px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white rounded-2xl font-bold text-lg shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-1 transition-all flex items-center gap-2"
              >
                Start Tracking — $12.99/mo
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
              <a 
                href="#how-it-works" 
                className="px-8 py-4 bg-white hover:bg-orange-50 text-slate-700 border-2 border-slate-200 hover:border-orange-300 rounded-2xl font-semibold text-lg transition-all"
              >
                See How It Works
              </a>
            </div>

            {/* Quick benefits */}
            <div className={`flex flex-wrap justify-center gap-8 text-sm transition-all duration-700 delay-500 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              {['Log jobs in 30 seconds', 'See real profit instantly', 'Works on any device'].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-600">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* App Preview */}
        <section className="py-8 px-6">
          <div className="max-w-5xl mx-auto">
            <div className={`relative transition-all duration-1000 delay-600 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
              <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-amber-400/20 rounded-3xl blur-3xl" />
              <div className="relative bg-white border border-orange-200/50 rounded-3xl shadow-2xl shadow-orange-500/10 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-orange-300" />
                    <div className="w-3 h-3 rounded-full bg-amber-300" />
                    <div className="w-3 h-3 rounded-full bg-yellow-300" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-4 py-1 bg-white/80 rounded-lg text-xs text-slate-500 border border-orange-100">app.dyia.co/dashboard</div>
                  </div>
                </div>
                <div className="p-6 bg-gradient-to-br from-orange-50/30 to-white">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                      { label: 'Jobs This Week', value: '12', icon: '📊', color: 'from-orange-500 to-orange-600' },
                      { label: 'Revenue', value: '$4,850', icon: '💵', color: 'from-amber-500 to-orange-500' },
                      { label: 'After Expenses', value: '$3,120', icon: '📈', color: 'from-orange-400 to-amber-500' },
                      { label: 'Tax Set-Aside', value: '$936', icon: '🐷', color: 'from-orange-500 to-red-500' },
                    ].map((stat, i) => (
                      <div key={i} className="bg-white rounded-xl p-4 border border-orange-100 shadow-sm">
                        <div className={`w-8 h-8 bg-gradient-to-br ${stat.color} rounded-lg flex items-center justify-center text-white text-sm mb-2 shadow-lg`}>
                          {stat.icon}
                        </div>
                        <p className="text-xs text-slate-500 mb-1">{stat.label}</p>
                        <p className="text-xl font-bold text-slate-800">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-orange-100 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium text-slate-700">🎯 Monthly Goal: $8,000</span>
                      <span className="text-sm font-bold text-orange-600">61%</span>
                    </div>
                    <div className="h-3 bg-orange-100 rounded-full overflow-hidden">
                      <div className="h-full w-[61%] bg-gradient-to-r from-orange-500 to-amber-500 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pain Points Section */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4 text-center">
              Sound familiar?
            </h2>
            <p className="text-slate-500 text-center mb-12">You&apos;re not alone. Every hauler deals with this.</p>
            
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { emoji: '😰', pain: '"I had a $500 day but after gas, dump fees, and paying my helper... I don\'t even know what I actually made."' },
                { emoji: '📝', pain: '"I\'ve got receipts everywhere. When tax time comes, I\'m scrambling to figure out what I owe."' },
                { emoji: '🤷', pain: '"I quoted a job too low last week. Lost money but didn\'t realize until after."' },
                { emoji: '💸', pain: '"Jobber wants $349/month? I just need to track my jobs, not run a Fortune 500."' },
              ].map((item, i) => (
                <div 
                  key={i} 
                  className="bg-gradient-to-br from-orange-50 to-amber-50/50 rounded-2xl p-6 border border-orange-100 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-500/5 transition-all"
                >
                  <span className="text-4xl mb-4 block">{item.emoji}</span>
                  <p className="text-slate-600 italic leading-relaxed">{item.pain}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <p className="text-xl text-slate-800 font-medium">
                dyia fixes all of this for <span className="text-orange-500 font-bold">$12.99/month</span>.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-20 px-6 bg-gradient-to-b from-orange-50 to-white">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 border border-orange-200 rounded-full text-orange-600 text-xs font-bold uppercase tracking-wider mb-4">
                How it works
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">
                Three taps. That&apos;s it.
              </h2>
              <p className="text-slate-600 text-lg">
                Do it from the truck between jobs.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { 
                  step: '1', 
                  title: 'Log the job', 
                  desc: 'Customer name, what you charged, and your expenses. Takes 30 seconds between stops.',
                  icon: '📱'
                },
                { 
                  step: '2', 
                  title: 'See real profit', 
                  desc: 'Instantly see what you actually pocketed. Revenue minus gas, dump fees, labor, everything.',
                  icon: '💰'
                },
                { 
                  step: '3', 
                  title: 'Track your taxes', 
                  desc: 'We calculate what to set aside so April doesn\'t hurt. Adjustable percentage, shown per job.',
                  icon: '🧾'
                },
              ].map((item, i) => (
                <div key={i} className="relative">
                  <div className="bg-white rounded-2xl p-8 border border-orange-200 hover:border-orange-300 hover:shadow-xl hover:shadow-orange-500/10 transition-all h-full">
                    <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-lg shadow-orange-500/30">
                      {item.icon}
                    </div>
                    <div className="inline-block px-3 py-1 bg-orange-100 rounded-full text-orange-600 text-xs font-bold mb-3">Step {item.step}</div>
                    <h3 className="text-xl font-bold text-slate-800 mb-3">{item.title}</h3>
                    <p className="text-slate-600 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 border border-orange-200 rounded-full text-orange-600 text-xs font-bold uppercase tracking-wider mb-4">
                Features
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">
                Everything you need. <span className="text-slate-400">Nothing you don&apos;t.</span>
              </h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-5">
              {[
                { icon: '📊', title: 'Job & profit tracking', desc: 'Log jobs fast. See revenue, expenses, and real profit per job. Track labor costs when you have help.', color: 'from-orange-500 to-orange-600' },
                { icon: '🧾', title: 'Tax set-aside calculator', desc: 'Set your tax rate (default 30%). We show you what to put away from each job so you\'re never surprised.', color: 'from-amber-500 to-orange-500' },
                { icon: '📋', title: 'Quote builder', desc: 'Create professional PDF quotes with your business info. Volume pricing, specialty items, the works.', color: 'from-orange-400 to-amber-500' },
                { icon: '📈', title: 'Monthly goals', desc: 'Set a revenue target. Watch your progress. Know exactly where you stand at any moment.', color: 'from-orange-500 to-red-500' },
                { icon: '📣', title: 'Lead source tracking', desc: 'Tag where each customer came from—Google, Yelp, referral. See what\'s actually bringing in work.', color: 'from-amber-500 to-yellow-500' },
                { icon: '📥', title: 'Export your data', desc: 'Download everything as CSV anytime. Your data is yours. Give it to your accountant, back it up, whatever.', color: 'from-orange-600 to-orange-500' },
              ].map((feature, i) => (
                <div 
                  key={i} 
                  className="flex gap-4 p-6 bg-white border border-orange-100 rounded-2xl hover:border-orange-200 hover:shadow-lg hover:shadow-orange-500/5 transition-all"
                >
                  <div className={`w-12 h-12 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-lg`}>
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">{feature.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="py-20 px-6 bg-gradient-to-b from-white to-orange-50">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">
              You don&apos;t need Jobber.
            </h2>
            <p className="text-slate-600 text-lg mb-12 max-w-2xl mx-auto">
              Enterprise software for enterprise problems. If you&apos;re a solo hauler or small crew, you need something simpler.
            </p>
            
            <div className="bg-white border border-orange-200 rounded-3xl p-8 md:p-12 shadow-xl shadow-orange-500/10">
              <div className="grid md:grid-cols-3 gap-8 mb-8">
                <div className="text-center p-6 rounded-2xl bg-slate-50">
                  <div className="text-slate-400 text-sm mb-2">Jobber</div>
                  <div className="text-3xl font-bold text-slate-300 line-through">$349/mo</div>
                  <div className="text-xs text-slate-400 mt-2">CRM, scheduling, invoicing you won&apos;t use</div>
                </div>
                <div className="text-center p-6 rounded-2xl bg-slate-50">
                  <div className="text-slate-400 text-sm mb-2">Housecall Pro</div>
                  <div className="text-3xl font-bold text-slate-300 line-through">$65/mo</div>
                  <div className="text-xs text-slate-400 mt-2">Still overkill</div>
                </div>
                <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-400 relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-3 py-0.5 rounded-full text-xs font-bold shadow-lg">
                    96% LESS
                  </div>
                  <div className="text-orange-600 text-sm font-medium mb-2">dyia</div>
                  <div className="text-3xl font-bold text-slate-800">$12.99/mo</div>
                  <div className="text-xs text-orange-600 mt-2 font-medium">Just profit tracking. Done right.</div>
                </div>
              </div>
              
              <div className="border-t border-orange-100 pt-8">
                <p className="text-slate-500 text-sm">
                  Save <span className="font-bold text-orange-600">$4,032/year</span> vs Jobber. That&apos;s 310 gallons of gas. ⛽
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 border border-orange-200 rounded-full text-orange-600 text-xs font-bold uppercase tracking-wider mb-4">
                Real users
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-800">
                From haulers like you
              </h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { 
                  name: 'Marcus T.', 
                  location: 'Dallas, TX', 
                  text: 'I was using a notes app. This actually shows me profit after expenses. Found out I was undercharging on estate cleanouts.',
                  business: 'Solo hauler, 2 years'
                },
                { 
                  name: 'Jake M.', 
                  location: 'Phoenix, AZ', 
                  text: 'Tax time used to take me a full weekend of digging through receipts. Now I just export and hand it to my accountant.',
                  business: '2-man crew'
                },
                { 
                  name: 'DeShawn R.', 
                  location: 'Atlanta, GA', 
                  text: 'The quote builder got me a $2,800 commercial job. Guy said it looked professional. Paid for a year of dyia on one quote.',
                  business: 'Clean Sweep Junk'
                },
              ].map((testimonial, i) => (
                <div key={i} className="bg-white border border-orange-100 rounded-2xl p-6 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-500/5 transition-all">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-5 h-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-slate-600 mb-6 leading-relaxed">&ldquo;{testimonial.text}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-amber-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                      {testimonial.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-800">{testimonial.name}</div>
                      <div className="text-sm text-slate-500">{testimonial.business} • {testimonial.location}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 px-6 bg-gradient-to-b from-orange-50 to-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 border border-orange-200 rounded-full text-orange-600 text-xs font-bold uppercase tracking-wider mb-4">
                Pricing
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">
                Simple pricing. No surprises.
              </h2>
              <p className="text-slate-600 text-lg">No hidden fees. Cancel anytime. 14-day money-back guarantee.</p>
            </div>

            {/* Coupon Input */}
            <div className="max-w-md mx-auto mb-10">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Have a coupon code?"
                  className="flex-1 px-4 py-3 bg-white border border-orange-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition"
                />
                {couponInput && (
                  <button 
                    onClick={() => setCouponInput('')}
                    className="px-4 py-3 bg-orange-100 hover:bg-orange-200 border border-orange-200 rounded-xl transition text-sm text-orange-700 font-medium"
                  >
                    Clear
                  </button>
                )}
              </div>
              {couponInput && (
                <p className="text-orange-600 text-sm mt-2 font-medium">✓ &ldquo;{couponInput}&rdquo; will be applied at checkout</p>
              )}
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {/* Monthly */}
              <div className="bg-white border border-orange-200 rounded-3xl p-8 hover:shadow-lg hover:shadow-orange-500/10 transition-all">
                <h3 className="text-2xl font-bold text-slate-800 mb-1">Monthly</h3>
                <p className="text-slate-500 text-sm mb-6">Pay as you go</p>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-5xl font-bold text-slate-800">$12.99</span>
                  <span className="text-slate-400">/mo</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {['Unlimited job tracking', 'Profit & expense dashboard', 'Tax set-aside calculator', 'Quote builder with PDF', 'Lead source tracking', 'CSV data export'].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={() => checkout('monthly')}
                  disabled={loading === 'monthly'}
                  className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-semibold transition disabled:opacity-50"
                >
                  {loading === 'monthly' ? 'Redirecting...' : 'Start Monthly'}
                </button>
              </div>

              {/* Annual */}
              <div className="relative bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-400 rounded-3xl p-8 shadow-xl shadow-orange-500/10">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg">
                  BEST VALUE — SAVE $36
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-1">Annual</h3>
                <p className="text-slate-500 text-sm mb-6">2 months free</p>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-5xl font-bold text-slate-800">$119</span>
                  <span className="text-slate-400">/year</span>
                </div>
                <p className="text-orange-600 text-sm font-medium mb-6">= $9.92/month</p>
                <ul className="space-y-3 mb-8">
                  {['Everything in Monthly', 'Priority email support', 'Early access to new features', 'Price locked forever'].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={() => checkout('annual')}
                  disabled={loading === 'annual'}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white rounded-2xl font-bold shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all disabled:opacity-50"
                >
                  {loading === 'annual' ? 'Redirecting...' : 'Start Annual — Save $36'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-20 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-100 border border-orange-200 rounded-full text-orange-600 text-xs font-bold uppercase tracking-wider mb-4">
                FAQ
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-800">Questions?</h2>
            </div>
            
            <div className="space-y-3">
              {[
                { q: 'Can I use this on my phone?', a: 'Yes. dyia works in any browser—iPhone, Android, tablet, laptop. Log jobs from the truck, check your numbers anywhere.' },
                { q: 'What if I cancel?', a: 'Cancel anytime from your account. You keep access until the end of your billing period. We hold your data for 90 days in case you come back.' },
                { q: 'Is my data safe?', a: 'Your data is encrypted and backed up daily on secure cloud servers. We don\'t sell your data or share it with anyone.' },
                { q: 'Do you offer refunds?', a: 'Yes. If you\'re not happy within 14 days, email us and we\'ll refund you. No questions.' },
                { q: 'I bought from Gumroad before. Do I get a discount?', a: 'Yes! Use code GUMROAD20 at checkout for 20% off annual. Thanks for being an early supporter.' },
                { q: 'What if I need help?', a: 'Email support@dyia.co. We respond within 24 hours (usually faster). Annual subscribers get priority.' },
              ].map((faq, i) => (
                <div 
                  key={i} 
                  className="border border-orange-100 rounded-2xl overflow-hidden bg-white hover:border-orange-200 transition-all"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-orange-50/50 transition"
                  >
                    <span className="font-semibold text-slate-800">{faq.q}</span>
                    <svg 
                      className={`w-5 h-5 text-orange-500 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-4">
                      <p className="text-slate-600 leading-relaxed">{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-3xl blur-2xl opacity-30" />
              <div className="relative bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl p-12 md:p-16 text-center shadow-2xl shadow-orange-500/30">
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                  Know your real numbers.
                </h2>
                <p className="text-orange-100 text-lg mb-10 max-w-lg mx-auto">
                  Stop guessing. Start tracking. Takes 30 seconds to log a job.
                </p>
                <a 
                  href="#pricing" 
                  className="inline-flex items-center gap-2 px-10 py-5 bg-white hover:bg-orange-50 text-orange-600 rounded-2xl font-bold text-lg shadow-xl hover:-translate-y-1 transition-all"
                >
                  Start for $12.99/month
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-orange-100 py-12 px-6 bg-gradient-to-b from-white to-orange-50/50">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <Image 
                src="/dyia-logo.png" 
                alt="dyia" 
                width={28} 
                height={28}
              />
              <span className="font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">dyia</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <a href="mailto:support@dyia.co" className="text-slate-500 hover:text-orange-600 transition">support@dyia.co</a>
              <a href="#" className="text-slate-500 hover:text-orange-600 transition">Terms</a>
              <a href="#" className="text-slate-500 hover:text-orange-600 transition">Privacy</a>
            </div>
            <div className="text-slate-400 text-sm">
              © 2026 dyia
            </div>
          </div>
          
          {/* Hidden Admin Demo Access */}
          <DemoAccess />
        </div>
      </footer>
    </div>
  )
}
