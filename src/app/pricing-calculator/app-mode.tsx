'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export function PricingCalcShell({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  const isApp = searchParams.has('app')

  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden">
      {!isApp && (
        <>
          <div className="fixed inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-900/20 via-[#09090b] to-[#09090b]" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-orange-500/8 to-transparent rounded-full blur-3xl" />
          </div>

          <nav className="fixed top-0 left-0 right-0 z-50">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 sm:py-4">
              <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] px-4 sm:px-6 py-3">
                <Link href="/" className="flex items-center gap-2">
                  <img src="/dyia-logo-full.png" alt="dyia" className="h-7 sm:h-8 object-contain brightness-0 invert" />
                </Link>
                <div className="hidden md:flex items-center gap-6">
                  <Link href="/pricing-calculator" className="text-sm text-orange-400 font-medium transition">Pricing Calculator</Link>
                  <Link href="/profit-calculator" className="text-sm text-slate-400 hover:text-white transition">Profit Quiz</Link>
                  <Link href="/#features" className="text-sm text-slate-400 hover:text-white transition">Features</Link>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <Link href="/sign-in?utm_source=pricing-calculator" className="text-sm text-slate-400 hover:text-white transition hidden sm:block">Sign in</Link>
                  <Link href="/sign-up?redirect_url=/app&utm_source=pricing-calculator" className="px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white rounded-xl font-semibold text-sm shadow-lg shadow-orange-500/20 transition-all">
                    Try free
                  </Link>
                </div>
              </div>
            </div>
          </nav>
        </>
      )}

      <main className={isApp ? 'pt-4 pb-4 px-4 sm:px-6' : 'pt-20 sm:pt-24 pb-4 sm:pb-16 px-4 sm:px-6'}>
        {children}
      </main>
    </div>
  )
}
