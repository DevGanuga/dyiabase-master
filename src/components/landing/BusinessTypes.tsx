'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Icon, type IconName } from '@/components/marketing/icons'

type Trade = { name: string; icon: IconName; href?: string; available: boolean }

const trades: Trade[] = [
  { name: 'Junk Removal', icon: 'truck', href: '/for/junk-removal', available: true },
  { name: 'Lawn Care', icon: 'leaf', href: '/for/lawn-care', available: true },
  { name: 'Cleaning', icon: 'spray', href: '/for/cleaning', available: true },
  { name: 'Moving', icon: 'truck', available: false },
  { name: 'Handyman', icon: 'bolt', available: false },
  { name: 'Pressure Wash', icon: 'spray', available: false },
]

const comingSoon = trades.filter((t) => !t.available)

export default function BusinessTypes() {
  const [selectedType, setSelectedType] = useState<string>(comingSoon[0]?.name ?? '')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !selectedType) return
    setStatus('loading')
    setErrorMessage('')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, businessType: selectedType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setStatus('success')
      setEmail('')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <section id="industries" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-orange-400 text-sm font-medium uppercase tracking-wider mb-3">Who it&apos;s for</p>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">Built for the trades</h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            The same engine — real profit, quotes, payments — tuned to how your trade actually works.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {trades.map((item) => {
            const content = (
              <>
                <span
                  className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap ${
                    item.available ? 'bg-orange-500 text-white' : 'bg-white/10 text-slate-400'
                  }`}
                >
                  {item.available ? 'Live' : 'Coming soon'}
                </span>
                <span
                  className={`w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-2.5 ${
                    item.available ? 'bg-orange-500/10 border border-orange-500/20 text-orange-400' : 'bg-white/[0.04] text-slate-500'
                  }`}
                >
                  <Icon name={item.icon} className="w-5 h-5" />
                </span>
                <h3 className={`font-medium text-sm ${item.available ? 'text-white' : 'text-white/55'}`}>{item.name}</h3>
              </>
            )

            if (item.available && item.href) {
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="relative rounded-xl p-4 pt-5 text-center transition-all border bg-orange-500/[0.06] border-orange-500/25 hover:border-orange-500/50 hover:bg-orange-500/10"
                >
                  {content}
                </Link>
              )
            }

            const isSelected = selectedType === item.name
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => {
                  setSelectedType(item.name)
                  setStatus('idle')
                  setErrorMessage('')
                }}
                className={`relative rounded-xl p-4 pt-5 text-center transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-white/[0.04] border-orange-500/40 ring-1 ring-orange-500/20'
                    : 'bg-white/[0.02] border-white/[0.04] hover:border-white/[0.1]'
                }`}
              >
                {content}
              </button>
            )
          })}
        </div>

        {/* Waitlist for coming-soon trades */}
        <div className="mt-10 max-w-md mx-auto">
          {status === 'success' ? (
            <div className="text-center bg-green-500/10 border border-green-500/20 rounded-xl p-6">
              <p className="text-green-400 font-medium">You&apos;re on the list.</p>
              <p className="text-slate-400 text-sm mt-1">We&apos;ll email you the moment dyia tunes for {selectedType}.</p>
              <button type="button" onClick={() => setStatus('idle')} className="text-sm text-slate-500 hover:text-slate-300 mt-3 transition-colors">
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="text-center">
              <p className="text-slate-300 mb-4">
                Don&apos;t see your trade? Get <span className="text-orange-400 font-medium">{selectedType}</span> tuning first.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500/40 focus:ring-1 focus:ring-orange-500/20 transition-all text-sm"
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm whitespace-nowrap"
                >
                  {status === 'loading' ? 'Joining...' : 'Notify me'}
                </button>
              </div>
              {status === 'error' && <p className="text-red-400 text-sm mt-2">{errorMessage}</p>}
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
