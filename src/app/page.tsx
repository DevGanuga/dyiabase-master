'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const STRIPE_PRICES = {
  monthly: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID,
  annual: process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID,
}

export default function LandingPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [couponInput, setCouponInput] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  async function checkout(plan: 'monthly' | 'annual') {
    setLoading(plan)
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      window.location.href = `/app?plan=${plan}`
      return
    }

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: STRIPE_PRICES[plan],
          userId: session.user.id,
          userEmail: session.user.email,
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
    <div className="min-h-screen bg-[#0a0f1a] text-slate-50 overflow-x-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1a] via-[#0d1424] to-[#0a0f1a]" />
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-500/8 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      {/* Announcement Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white py-2.5 text-center text-sm font-medium">
        <span className="inline-flex items-center gap-2">
          <span className="animate-bounce">🎉</span>
          <span>Gumroad customers: Use code <code className="bg-white/20 px-2 py-0.5 rounded font-mono text-xs">GUMROAD20</code> for 20% off annual!</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className={`fixed top-10 left-0 right-0 z-50 transition-all duration-500 ${mounted ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-4 flex justify-between items-center">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center text-lg shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-shadow">
                💼
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">JunkProfit</span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              <a href="#features" className="px-4 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all text-sm font-medium">Features</a>
              <a href="#pricing" className="px-4 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all text-sm font-medium">Pricing</a>
              <a href="#faq" className="px-4 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all text-sm font-medium">FAQ</a>
              <div className="w-px h-6 bg-white/10 mx-2" />
              <Link 
                href="/app" 
                className="px-5 py-2.5 bg-white/10 hover:bg-white/15 border border-white/10 hover:border-emerald-500/50 rounded-xl font-semibold text-sm transition-all"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="pt-40 pb-20 px-6">
          <div className="max-w-5xl mx-auto text-center">
            <div className={`transition-all duration-700 delay-100 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm mb-8">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span>Built for junk removal pros who want to stop guessing</span>
              </div>
            </div>
            
            <h1 className={`text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.1] mb-6 transition-all duration-700 delay-200 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              <span className="text-white">Know Your </span>
              <span className="bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">Real Profit</span>
              <br />
              <span className="text-slate-400">After Every Job</span>
            </h1>
            
            <p className={`text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed transition-all duration-700 delay-300 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              Track jobs, expenses, and profits in seconds. Generate professional quotes. 
              Finally understand where your money actually goes—without Jobber&apos;s price tag.
            </p>
            
            <div className={`flex flex-wrap justify-center gap-4 mb-16 transition-all duration-700 delay-400 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              <a 
                href="#pricing" 
                className="group px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-900 rounded-2xl font-bold text-lg shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-1 transition-all flex items-center gap-2"
              >
                Start Tracking Free
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
              <a 
                href="#features" 
                className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl font-semibold text-lg transition-all"
              >
                See How It Works
              </a>
            </div>

            {/* Social Proof Stats */}
            <div className={`grid grid-cols-3 gap-8 max-w-2xl mx-auto transition-all duration-700 delay-500 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-white mb-1">$12.99</div>
                <div className="text-sm text-slate-500">Per month</div>
              </div>
              <div className="text-center border-x border-white/10">
                <div className="text-3xl sm:text-4xl font-bold text-white mb-1">5 min</div>
                <div className="text-sm text-slate-500">Setup time</div>
              </div>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-white mb-1">24/7</div>
                <div className="text-sm text-slate-500">Access anywhere</div>
              </div>
            </div>
          </div>
        </section>

        {/* App Preview */}
        <section className="py-12 px-6">
          <div className="max-w-5xl mx-auto">
            <div className={`relative transition-all duration-1000 delay-600 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-3xl blur-3xl" />
              <div className="relative bg-gradient-to-b from-slate-800/50 to-slate-900/50 border border-white/10 rounded-3xl p-2 shadow-2xl">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-4 py-1 bg-white/5 rounded-lg text-xs text-slate-400">app.junkprofit.com/dashboard</div>
                  </div>
                </div>
                <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-b-2xl">
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    {[
                      { label: 'Jobs This Month', value: '23', icon: '📊', color: 'bg-blue-500' },
                      { label: 'Total Revenue', value: '$8,450', icon: '💵', color: 'bg-emerald-500' },
                      { label: 'Net Profit', value: '$5,230', icon: '📈', color: 'bg-purple-500' },
                      { label: 'Tax Set-Aside', value: '$1,569', icon: '🐷', color: 'bg-amber-500' },
                    ].map((stat, i) => (
                      <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                        <div className={`w-8 h-8 ${stat.color}/10 rounded-lg flex items-center justify-center text-lg mb-2`}>
                          {stat.icon}
                        </div>
                        <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                        <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">🎯 Monthly Goal Progress</span>
                      <span className="text-sm font-bold text-emerald-600">84%</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full w-[84%] bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full" />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">$1,550 to reach your $10,000 goal</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Badges */}
        <section className="py-12 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap justify-center items-center gap-8 text-slate-500 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>256-bit SSL encryption</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Cloud-synced backups</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Works on any device</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-4">
                Features
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
                Everything You Need.<br />
                <span className="text-slate-500">Nothing You Don&apos;t.</span>
              </h2>
              <p className="text-slate-400 text-lg max-w-xl mx-auto">
                Built specifically for junk removal businesses who want clarity, not complexity.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { icon: '📊', title: 'Job & Profit Tracking', desc: 'Log jobs in seconds. See revenue, expenses, and real profit instantly. Track multiple customers per trip with automatic expense splitting.', gradient: 'from-blue-500/20 to-blue-600/5' },
                { icon: '🐷', title: 'Tax Set-Aside Calculator', desc: 'Never get surprised by taxes again. Automatically calculate and track what you should set aside from each job. Adjustable percentage.', gradient: 'from-amber-500/20 to-amber-600/5' },
                { icon: '📋', title: 'Professional Quote Builder', desc: 'Create clean, branded PDF quotes with your logo. Volume-based pricing, specialty items, fees—all calculated with a live preview.', gradient: 'from-purple-500/20 to-purple-600/5' },
                { icon: '📣', title: 'Marketing Source Tracking', desc: 'Know exactly where your customers come from. Track Google, Facebook, referrals, and more to double down on what works.', gradient: 'from-pink-500/20 to-pink-600/5' },
                { icon: '🎯', title: 'Monthly Revenue Goals', desc: 'Set targets and watch your progress in real-time. Visual dashboard shows exactly how close you are to hitting your goals.', gradient: 'from-emerald-500/20 to-emerald-600/5' },
                { icon: '📥', title: 'Data Export & Backups', desc: 'Your data is yours. Export to CSV anytime for your accountant, taxes, or just peace of mind. 12 months of history retained.', gradient: 'from-cyan-500/20 to-cyan-600/5' },
              ].map((feature, i) => (
                <div 
                  key={i} 
                  className={`group relative bg-gradient-to-br ${feature.gradient} border border-white/5 rounded-2xl p-7 hover:border-emerald-500/30 transition-all duration-300 hover:-translate-y-1`}
                >
                  <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-emerald-400 transition-colors">{feature.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison Section */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-3xl blur-xl" />
              <div className="relative bg-white/5 border border-white/10 rounded-3xl p-8 md:p-12">
                <h3 className="text-3xl sm:text-4xl font-bold text-white text-center mb-3">
                  Why Pay <span className="line-through text-slate-500 decoration-red-500">$349/mo</span> for Jobber?
                </h3>
                <p className="text-slate-400 text-center mb-10">JunkProfit gives you what actually matters—at a fraction of the cost.</p>
                
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center p-6 rounded-2xl bg-white/5">
                    <div className="text-slate-500 text-sm mb-2">Jobber Basic</div>
                    <div className="text-3xl font-bold text-slate-500 line-through">$349/mo</div>
                    <div className="text-xs text-slate-600 mt-2">Overkill features you won&apos;t use</div>
                  </div>
                  <div className="text-center p-6 rounded-2xl bg-white/5">
                    <div className="text-slate-500 text-sm mb-2">Housecall Pro</div>
                    <div className="text-3xl font-bold text-slate-500 line-through">$65/mo</div>
                    <div className="text-xs text-slate-600 mt-2">Still too complex</div>
                  </div>
                  <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border-2 border-emerald-500/50 relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-900 px-3 py-0.5 rounded-full text-xs font-bold">
                      96% LESS
                    </div>
                    <div className="text-emerald-400 text-sm mb-2">JunkProfit Tracker</div>
                    <div className="text-3xl font-bold text-white">$12.99/mo</div>
                    <div className="text-xs text-emerald-400/70 mt-2">Everything you actually need</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-4">
                Real Users
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white">
                Trusted by Junk Haulers
              </h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { name: 'Mike R.', location: 'Houston, TX', text: 'Finally know exactly how much I make per job after gas and dump fees. Game changer for pricing.', avatar: '👷' },
                { name: 'Sarah K.', location: 'Phoenix, AZ', text: 'The quote builder alone is worth it. Looks professional and my close rate went up 20%.', avatar: '👩‍💼' },
                { name: 'James T.', location: 'Atlanta, GA', text: 'Switched from Jobber. This does everything I actually need for a fraction of the price.', avatar: '🧔' },
              ].map((testimonial, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-emerald-500/30 transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full flex items-center justify-center text-2xl">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{testimonial.name}</div>
                      <div className="text-sm text-slate-500">{testimonial.location}</div>
                    </div>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">&ldquo;{testimonial.text}&rdquo;</p>
                  <div className="flex gap-1 mt-4">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-4">
                Simple Pricing
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
                Start Growing Your Profits
              </h2>
              <p className="text-slate-400 text-lg">No hidden fees. No contracts. Cancel anytime.</p>
            </div>

            {/* Coupon Input */}
            <div className="max-w-md mx-auto mb-10">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Have a coupon code?"
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 transition"
                />
                {couponInput && (
                  <button 
                    onClick={() => setCouponInput('')}
                    className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition text-sm"
                  >
                    Clear
                  </button>
                )}
              </div>
              {couponInput && (
                <p className="text-emerald-400 text-sm mt-2">✓ Coupon &ldquo;{couponInput}&rdquo; will be applied at checkout</p>
              )}
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {/* Monthly */}
              <div className="relative bg-white/5 border border-white/10 rounded-3xl p-8 hover:border-white/20 transition-all">
                <h3 className="text-2xl font-bold text-white mb-1">Monthly</h3>
                <p className="text-slate-400 text-sm mb-6">Pay as you go, cancel anytime</p>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-5xl font-bold text-white">$12.99</span>
                  <span className="text-slate-500">/month</span>
                </div>
                <ul className="space-y-4 mb-8">
                  {['Unlimited job tracking', 'Quote builder with PDF export', 'Profit & expense dashboards', 'Marketing source tracking', '12 months data retention', 'CSV export anytime'].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                      <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={() => checkout('monthly')}
                  disabled={loading === 'monthly'}
                  className="w-full py-4 bg-white/10 hover:bg-white/15 border border-white/10 hover:border-white/20 rounded-2xl font-semibold transition-all disabled:opacity-50"
                >
                  {loading === 'monthly' ? 'Redirecting...' : 'Get Started'}
                </button>
              </div>

              {/* Annual */}
              <div className="relative bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-2 border-emerald-500/50 rounded-3xl p-8 shadow-xl shadow-emerald-500/10">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-900 px-4 py-1 rounded-full text-xs font-bold">
                  BEST VALUE — SAVE $36
                </div>
                <h3 className="text-2xl font-bold text-white mb-1">Annual</h3>
                <p className="text-slate-400 text-sm mb-6">Best value — 2 months free</p>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-5xl font-bold text-white">$119</span>
                  <span className="text-slate-500">/year</span>
                </div>
                <p className="text-emerald-400 text-sm mb-6">That&apos;s just $9.92/month</p>
                <ul className="space-y-4 mb-8">
                  {['Everything in Monthly', 'Priority support', 'Early access to new features', 'Locked-in pricing forever', '12 months data retention', 'Monthly email statements'].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                      <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={() => checkout('annual')}
                  disabled={loading === 'annual'}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-900 rounded-2xl font-bold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all disabled:opacity-50"
                >
                  {loading === 'annual' ? 'Redirecting...' : 'Get Started — Save $36'}
                </button>
              </div>
            </div>

            <p className="text-center text-slate-500 text-sm mt-8">
              14-day money-back guarantee. No questions asked.
            </p>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-4">
                FAQ
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold text-white">Common Questions</h2>
            </div>
            
            <div className="space-y-4">
              {[
                { q: 'How is my data stored?', a: 'Your data is securely stored in the cloud with Supabase (built on PostgreSQL). It\'s encrypted at rest and in transit, backed up daily, and accessible from any device. We retain 12 months of history.' },
                { q: 'Can I cancel anytime?', a: 'Yes! No contracts, no cancellation fees. Cancel from your account settings and you\'ll retain access until the end of your billing period. We\'ll even keep your data for 90 days in case you come back.' },
                { q: 'Do you offer refunds?', a: 'Absolutely. If you\'re not satisfied within the first 14 days, contact us and we\'ll refund your payment in full—no questions asked.' },
                { q: 'Can I use this on my phone?', a: 'Yes! JunkProfit works great on mobile browsers. Log jobs from the truck, create quotes on-site, and check your dashboard anywhere with an internet connection.' },
                { q: 'I already bought from Gumroad. Do I get a discount?', a: 'Yes! Use code GUMROAD20 at checkout for 20% off any annual plan. Thanks for being an early supporter—we appreciate you!' },
                { q: 'What if I need help?', a: 'Email us at support@junkprofit.app and we\'ll get back to you within 24 hours. Annual subscribers get priority support with faster response times.' },
              ].map((faq, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
                  <h4 className="text-lg font-semibold text-white mb-2">{faq.q}</h4>
                  <p className="text-slate-400 text-sm leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-3xl blur-2xl" />
              <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/10 rounded-3xl p-12 md:p-16 text-center">
                <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
                  Ready to Know Your Numbers?
                </h2>
                <p className="text-slate-400 text-lg mb-10 max-w-lg mx-auto">
                  Join junk removal pros who stopped guessing and started tracking their real profits.
                </p>
                <a 
                  href="#pricing" 
                  className="inline-flex items-center gap-2 px-10 py-5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-900 rounded-2xl font-bold text-lg shadow-xl shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-1 transition-all"
                >
                  Start Your Free Trial
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
      <footer className="border-t border-white/10 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center text-sm">
                💼
              </div>
              <span className="font-semibold text-slate-300">JunkProfit Tracker</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6">
              <a href="#" className="text-slate-500 hover:text-white text-sm transition">Terms</a>
              <a href="#" className="text-slate-500 hover:text-white text-sm transition">Privacy</a>
              <a href="mailto:support@junkprofit.app" className="text-slate-500 hover:text-white text-sm transition">Contact</a>
            </div>
            <div className="text-slate-500 text-sm">
              © 2026 JunkProfit. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
