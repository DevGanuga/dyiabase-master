'use client'

import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

function SignInContent() {
  const searchParams = useSearchParams()
  const fromCalculator = searchParams.get('utm_source') === 'pricing-calculator'
  const [demoPassword, setDemoPassword] = useState('')
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoError, setDemoError] = useState<string | null>(null)

  const activateDemo = async () => {
    setDemoLoading(true)
    setDemoError(null)
    try {
      const res = await fetch('/api/demo/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: demoPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDemoError(data.error || 'Could not activate demo mode.')
        return
      }
      window.location.href = '/app'
    } catch {
      setDemoError('Could not activate demo mode.')
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-amber-50/30 flex flex-col items-center justify-center p-4">
      {/* Background Elements */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-orange-100/40 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-0 w-[400px] h-[400px] bg-amber-100/30 rounded-full blur-[100px]" />
      </div>

      {/* Logo */}
      <Link href="/" className="mb-8 group">
        <img
          src="/dyia-logo-full.png"
          alt="dyia"
          className="h-10 object-contain group-hover:scale-105 transition-transform"
        />
      </Link>

      {/* Clerk Sign In */}
      <SignIn 
        appearance={{
          elements: {
            rootBox: 'w-full max-w-md',
            card: 'shadow-2xl border border-slate-200/80 rounded-3xl',
          }
        }}
        fallbackRedirectUrl="/app"
        signUpUrl="/sign-up"
      />

      <div className="mt-5 w-full max-w-md rounded-2xl border border-orange-200/70 bg-white/80 p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-800">Marketing demo</p>
        <p className="text-xs text-slate-500 mt-1">Use the demo password to open sample data without exposing real customer numbers.</p>
        <div className="mt-3 flex gap-2">
          <input
            type="password"
            value={demoPassword}
            onChange={(e) => setDemoPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && demoPassword && !demoLoading) activateDemo()
            }}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
            placeholder="Demo password"
          />
          <button
            type="button"
            onClick={activateDemo}
            disabled={!demoPassword || demoLoading}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
          >
            {demoLoading ? 'Opening...' : 'Open Demo'}
          </button>
        </div>
        {demoError && <p className="text-xs text-red-600 mt-2">{demoError}</p>}
      </div>

      {/* Navigation links */}
      <div className="mt-8 flex flex-col items-center gap-3">
        {fromCalculator && (
          <Link
            href="/pricing-calculator"
            className="flex items-center gap-2 text-orange-600 hover:text-orange-700 text-sm font-medium transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Pricing Calculator
          </Link>
        )}
        <Link 
          href="/" 
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to homepage
        </Link>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  )
}
