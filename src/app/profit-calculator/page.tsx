'use client'

import Link from 'next/link'

export default function ProfitCalculatorLanding() {
  return (
    <div className="max-w-4xl mx-auto text-center">
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 tracking-tight">
        How much profit are you throwing in the dumpster every month?
      </h1>
      <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
        Most junk removal owners lose $2,000–$5,000/month without realizing it. Take this 2-minute quiz to find out where your money&apos;s going.
      </p>
      <Link
        href="/profit-calculator/quiz"
        className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30 hover:-translate-y-0.5 transition-all"
      >
        Calculate my profit leaks (free)
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
      </Link>
      <ul className="flex flex-wrap justify-center gap-x-8 gap-y-2 mt-8 text-sm text-slate-500">
        <li className="flex items-center gap-2">✓ Takes 2 minutes</li>
        <li className="flex items-center gap-2">✓ No email to start</li>
        <li className="flex items-center gap-2">✓ See results instantly</li>
      </ul>
      <p className="mt-6 text-slate-500 text-sm">Join hundreds of junk haulers who found their leaks.</p>
    </div>
  )
}
