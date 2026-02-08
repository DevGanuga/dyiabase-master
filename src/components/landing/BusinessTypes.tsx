'use client'

import { useState } from 'react'

const businessTypes = [
  { emoji: '🚛', name: 'Junk Removal', available: true },
  { emoji: '🌿', name: 'Lawn Care', available: false },
  { emoji: '🏠', name: 'Cleaning', available: false },
  { emoji: '📦', name: 'Moving', available: false },
  { emoji: '🔧', name: 'Handyman', available: false },
  { emoji: '🧹', name: 'Pressure Wash', available: false },
]

const comingSoonTypes = businessTypes.filter((t) => !t.available)

export default function BusinessTypes() {
  const [selectedType, setSelectedType] = useState<string>(comingSoonTypes[0]?.name ?? '')
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

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong')
      }

      setStatus('success')
      setEmail('')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Built for your business
          </h2>
          <p className="text-xl text-slate-400">
            Starting with junk removal. More industries coming soon.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {businessTypes.map((item) => {
            const isSelected = selectedType === item.name
            const isComingSoon = !item.available

            return (
              <button
                key={item.name}
                type="button"
                onClick={() => {
                  if (isComingSoon) {
                    setSelectedType(item.name)
                    setStatus('idle')
                    setErrorMessage('')
                  }
                }}
                className={`
                  relative rounded-xl p-4 text-center transition-all border
                  ${item.available
                    ? 'bg-orange-500/10 border-orange-500/30 ring-1 ring-orange-500/20 cursor-default'
                    : isSelected
                      ? 'bg-white/[0.04] border-orange-500/40 ring-1 ring-orange-500/20 cursor-pointer'
                      : 'bg-white/[0.02] border-white/[0.04] hover:border-white/[0.1] cursor-pointer'
                  }
                `}
              >
                {item.available && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wider bg-orange-500 text-white px-2 py-0.5 rounded-full">
                    Live
                  </span>
                )}
                {isComingSoon && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wider bg-white/10 text-slate-400 px-2 py-0.5 rounded-full whitespace-nowrap">
                    Coming soon
                  </span>
                )}
                <span className={`text-3xl block mb-2 ${isComingSoon ? 'opacity-50 grayscale' : ''}`}>
                  {item.emoji}
                </span>
                <h3 className={`font-medium text-sm ${item.available ? 'text-orange-400' : 'text-white/60'}`}>
                  {item.name}
                </h3>
              </button>
            )
          })}
        </div>

        {/* Waitlist signup form - always visible for coming-soon types */}
        <div className="mt-10">
          <div className="max-w-md mx-auto">
            {status === 'success' ? (
              <div className="text-center bg-green-500/10 border border-green-500/20 rounded-xl p-6">
                <div className="text-2xl mb-2">🎉</div>
                <p className="text-green-400 font-medium">You&apos;re on the list!</p>
                <p className="text-slate-400 text-sm mt-1">
                  We&apos;ll notify you when dyia supports {selectedType}.
                </p>
                <button
                  type="button"
                  onClick={() => setStatus('idle')}
                  className="text-sm text-slate-500 hover:text-slate-300 mt-3 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="text-center">
                <p className="text-slate-300 mb-4">
                  Want dyia for <span className="text-orange-400 font-medium">{selectedType}</span>?
                  Join the waitlist.
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
                {status === 'error' && (
                  <p className="text-red-400 text-sm mt-2">{errorMessage}</p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
