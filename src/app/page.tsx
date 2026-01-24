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
    <div className="mt-8 pt-6 border-t border-slate-200/50">
      {!showInput ? (
        <button 
          onClick={() => setShowInput(true)}
          className="text-slate-300 hover:text-slate-400 text-xs transition cursor-pointer"
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
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 w-36"
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
                : 'bg-slate-800 text-white hover:bg-slate-700'
            }`}
          >
            {status === 'loading' ? '...' : status === 'success' ? '✓' : status === 'error' ? '✗' : 'Go'}
          </button>
          <button
            type="button"
            onClick={() => { setShowInput(false); setPassword(''); setStatus('idle'); }}
            className="text-slate-400 hover:text-slate-600 text-xs"
          >
            ✕
          </button>
        </form>
      )}
    </div>
  )
}

export default function LandingPage() {
  const { isSignedIn } = useUser()
  const [loading, setLoading] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [couponInput, setCouponInput] = useState('')
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  useEffect(() => {
    setMounted(true)
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
      {/* Subtle Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-50 via-white to-white" />
      </div>

      {/* Announcement Banner */}
      <div className="bg-slate-900 text-white py-2.5 text-center text-sm">
        <span className="inline-flex items-center gap-2">
          <span>🎁</span>
          <span>Gumroad customers: Use code <code className="bg-white/10 px-2 py-0.5 rounded font-mono text-xs">GUMROAD20</code> for 20% off annual</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className={`sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 transition-all duration-500 ${mounted ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image 
              src="/dyia-logo.png" 
              alt="dyia" 
              width={32} 
              height={32}
              className="group-hover:scale-105 transition-transform"
            />
            <span className="text-xl font-bold text-slate-800">dyia</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <a href="#how-it-works" className="text-slate-600 hover:text-slate-900 text-sm font-medium transition">How it works</a>
            <a href="#pricing" className="text-slate-600 hover:text-slate-900 text-sm font-medium transition">Pricing</a>
            <a href="#faq" className="text-slate-600 hover:text-slate-900 text-sm font-medium transition">FAQ</a>
            <Link 
              href={isSignedIn ? "/app" : "/sign-in"} 
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-medium text-sm transition"
            >
              {isSignedIn ? 'Open App' : 'Sign In'}
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="pt-16 pb-20 px-6">
          <div className="max-w-4xl mx-auto">
            <div className={`transition-all duration-700 delay-100 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              <div className="flex items-center gap-2 mb-8">
                <span className="text-2xl">🚛</span>
                <span className="text-slate-600 font-medium">For junk haulers tired of guessing</span>
              </div>
            </div>
            
            <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.15] mb-6 transition-all duration-700 delay-200 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              <span className="text-slate-800">Stop wondering if you </span>
              <span className="text-slate-800">actually made money today.</span>
            </h1>
            
            <p className={`text-xl text-slate-600 max-w-2xl mb-10 leading-relaxed transition-all duration-700 delay-300 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              dyia shows you exactly what you pocket after gas, dump fees, labor, and taxes. 
              Log jobs in 30 seconds. Know your real profit instantly. It&apos;s that simple.
            </p>
            
            <div className={`flex flex-wrap gap-4 mb-16 transition-all duration-700 delay-400 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              <a 
                href="#pricing" 
                className="group px-8 py-4 bg-orange-500 hover:bg-orange-400 text-white rounded-full font-semibold text-lg shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all flex items-center gap-2"
              >
                Start tracking for $12.99/mo
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
              <a 
                href="#how-it-works" 
                className="px-8 py-4 text-slate-600 hover:text-slate-900 font-medium text-lg transition flex items-center gap-2"
              >
                See how it works
              </a>
            </div>

            {/* Real stats that matter */}
            <div className={`flex flex-wrap gap-8 text-sm transition-all duration-700 delay-500 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              <div className="flex items-center gap-2 text-slate-500">
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>No spreadsheets needed</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Works on your phone</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </section>

        {/* App Preview */}
        <section className="py-8 px-6">
          <div className="max-w-5xl mx-auto">
            <div className={`relative transition-all duration-1000 delay-600 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
              <div className="absolute inset-0 bg-gradient-to-b from-orange-100/50 to-transparent rounded-3xl blur-2xl" />
              <div className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-200/50 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-slate-200" />
                    <div className="w-3 h-3 rounded-full bg-slate-200" />
                    <div className="w-3 h-3 rounded-full bg-slate-200" />
                  </div>
                </div>
                <div className="p-6 bg-gradient-to-br from-slate-50 to-white">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                      { label: 'Jobs This Week', value: '12', trend: '+3 from last week' },
                      { label: 'Revenue', value: '$4,850', trend: '' },
                      { label: 'After Expenses', value: '$3,120', trend: '' },
                      { label: 'Set Aside for Tax', value: '$936', trend: '30%' },
                    ].map((stat, i) => (
                      <div key={i} className="bg-white rounded-xl p-4 border border-slate-100">
                        <p className="text-xs text-slate-500 mb-1">{stat.label}</p>
                        <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                        {stat.trend && <p className="text-xs text-slate-400 mt-1">{stat.trend}</p>}
                      </div>
                    ))}
                  </div>
                  <div className="bg-white rounded-xl p-4 border border-slate-100">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium text-slate-700">Monthly Goal: $8,000</span>
                      <span className="text-sm font-bold text-orange-600">61%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full w-[61%] bg-orange-500 rounded-full" />
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
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-12 text-center">
              Sound familiar?
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { emoji: '😰', pain: '"I had a $500 day but after gas, dump fees, and paying my helper... I don\'t even know what I actually made."' },
                { emoji: '📝', pain: '"I\'ve got receipts everywhere. When tax time comes, I\'m scrambling to figure out what I owe."' },
                { emoji: '🤷', pain: '"I quoted a job too low last week. Lost money but didn\'t realize until after."' },
                { emoji: '💸', pain: '"Jobber wants $349/month? I just need to track my jobs, not run a Fortune 500."' },
              ].map((item, i) => (
                <div 
                  key={i} 
                  className="bg-slate-50 rounded-2xl p-6 border border-slate-100"
                >
                  <span className="text-3xl mb-4 block">{item.emoji}</span>
                  <p className="text-slate-600 italic leading-relaxed">{item.pain}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <p className="text-xl text-slate-800 font-medium">
                dyia fixes all of this for <span className="text-orange-500">$12.99/month</span>.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-20 px-6 bg-slate-50">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">
                How it works
              </h2>
              <p className="text-slate-600 text-lg">
                Three taps. That&apos;s it. Do it from the truck.
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
                  <div className="bg-white rounded-2xl p-8 border border-slate-200 hover:border-orange-200 hover:shadow-lg transition-all h-full">
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-2xl mb-6">
                      {item.icon}
                    </div>
                    <div className="text-orange-500 text-sm font-bold mb-2">Step {item.step}</div>
                    <h3 className="text-xl font-semibold text-slate-800 mb-3">{item.title}</h3>
                    <p className="text-slate-600 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features - Keep it Simple */}
        <section className="py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">
                What you get
              </h2>
              <p className="text-slate-600 text-lg">
                Everything you need. Nothing you don&apos;t.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { icon: '📊', title: 'Job & profit tracking', desc: 'Log jobs fast. See revenue, expenses, and real profit per job. Track labor costs when you have help.' },
                { icon: '🧾', title: 'Tax set-aside calculator', desc: 'Set your tax rate (default 30%). We show you what to put away from each job so you\'re never surprised.' },
                { icon: '📋', title: 'Quote builder', desc: 'Create professional PDF quotes with your business info. Volume pricing, specialty items, the works.' },
                { icon: '📈', title: 'Monthly goals', desc: 'Set a revenue target. Watch your progress. Know exactly where you stand at any moment.' },
                { icon: '📣', title: 'Lead source tracking', desc: 'Tag where each customer came from—Google, Yelp, referral. See what\'s actually bringing in work.' },
                { icon: '📥', title: 'Export your data', desc: 'Download everything as CSV anytime. Your data is yours. Give it to your accountant, back it up, whatever.' },
              ].map((feature, i) => (
                <div 
                  key={i} 
                  className="flex gap-4 p-6 bg-white border border-slate-200 rounded-2xl hover:border-orange-200 hover:shadow-md transition-all"
                >
                  <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-1">{feature.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison - Why Not Jobber */}
        <section className="py-20 px-6 bg-slate-50">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">
              You don&apos;t need Jobber.
            </h2>
            <p className="text-slate-600 text-lg mb-12 max-w-2xl mx-auto">
              Enterprise software for enterprise problems. If you&apos;re a solo hauler or small crew, you need something simpler.
            </p>
            
            <div className="bg-white border border-slate-200 rounded-2xl p-8 md:p-12">
              <div className="grid md:grid-cols-3 gap-8 mb-8">
                <div className="text-center">
                  <div className="text-slate-400 text-sm mb-2">Jobber</div>
                  <div className="text-3xl font-bold text-slate-300 line-through">$349/mo</div>
                  <div className="text-xs text-slate-400 mt-2">CRM, scheduling, invoicing you won&apos;t use</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-400 text-sm mb-2">Housecall Pro</div>
                  <div className="text-3xl font-bold text-slate-300 line-through">$65/mo</div>
                  <div className="text-xs text-slate-400 mt-2">Still overkill</div>
                </div>
                <div className="text-center">
                  <div className="text-orange-500 text-sm font-medium mb-2">dyia</div>
                  <div className="text-3xl font-bold text-slate-800">$12.99/mo</div>
                  <div className="text-xs text-orange-600 mt-2">Just profit tracking. Done right.</div>
                </div>
              </div>
              
              <div className="border-t border-slate-100 pt-8">
                <p className="text-slate-500 text-sm">
                  Save <span className="font-bold text-slate-800">$4,032/year</span> vs Jobber. That&apos;s 310 gallons of gas.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">
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
                <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6">
                  <p className="text-slate-600 mb-6 leading-relaxed">&ldquo;{testimonial.text}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-lg">
                      {testimonial.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-slate-800">{testimonial.name}</div>
                      <div className="text-sm text-slate-500">{testimonial.business} • {testimonial.location}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 px-6 bg-slate-50">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-4">
                Simple pricing
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
                  placeholder="Coupon code"
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
                />
                {couponInput && (
                  <button 
                    onClick={() => setCouponInput('')}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition text-sm text-slate-600"
                  >
                    Clear
                  </button>
                )}
              </div>
              {couponInput && (
                <p className="text-orange-600 text-sm mt-2">✓ &ldquo;{couponInput}&rdquo; will be applied at checkout</p>
              )}
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {/* Monthly */}
              <div className="bg-white border border-slate-200 rounded-2xl p-8">
                <h3 className="text-xl font-bold text-slate-800 mb-1">Monthly</h3>
                <p className="text-slate-500 text-sm mb-6">Pay as you go</p>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-bold text-slate-800">$12.99</span>
                  <span className="text-slate-400">/mo</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {['Unlimited job tracking', 'Profit & expense dashboard', 'Tax set-aside calculator', 'Quote builder with PDF', 'Lead source tracking', 'CSV data export'].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={() => checkout('monthly')}
                  disabled={loading === 'monthly'}
                  className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition disabled:opacity-50"
                >
                  {loading === 'monthly' ? 'Redirecting...' : 'Start Monthly'}
                </button>
              </div>

              {/* Annual */}
              <div className="relative bg-white border-2 border-orange-400 rounded-2xl p-8">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                  SAVE $36/year
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-1">Annual</h3>
                <p className="text-slate-500 text-sm mb-6">2 months free</p>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold text-slate-800">$119</span>
                  <span className="text-slate-400">/year</span>
                </div>
                <p className="text-orange-600 text-sm mb-6">= $9.92/month</p>
                <ul className="space-y-3 mb-8">
                  {['Everything in Monthly', 'Priority email support', 'Early access to new features', 'Price locked forever'].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={() => checkout('annual')}
                  disabled={loading === 'annual'}
                  className="w-full py-4 bg-orange-500 hover:bg-orange-400 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/20 transition disabled:opacity-50"
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
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-800">Questions</h2>
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
                  className="border border-slate-200 rounded-xl overflow-hidden bg-white"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full px-6 py-4 text-left flex justify-between items-center hover:bg-slate-50 transition"
                  >
                    <span className="font-medium text-slate-800">{faq.q}</span>
                    <svg 
                      className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-4">
                      <p className="text-slate-600 text-sm leading-relaxed">{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 px-6 bg-slate-900">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Know your real numbers.
            </h2>
            <p className="text-slate-400 text-lg mb-10">
              Stop guessing. Start tracking. Takes 30 seconds to log a job.
            </p>
            <a 
              href="#pricing" 
              className="inline-flex items-center gap-2 px-8 py-4 bg-orange-500 hover:bg-orange-400 text-white rounded-full font-semibold text-lg transition"
            >
              Start for $12.99/month
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <Image 
                src="/dyia-logo.png" 
                alt="dyia" 
                width={24} 
                height={24}
              />
              <span className="font-medium text-slate-700">dyia</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <a href="mailto:support@dyia.co" className="text-slate-500 hover:text-slate-800 transition">support@dyia.co</a>
              <a href="#" className="text-slate-500 hover:text-slate-800 transition">Terms</a>
              <a href="#" className="text-slate-500 hover:text-slate-800 transition">Privacy</a>
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
