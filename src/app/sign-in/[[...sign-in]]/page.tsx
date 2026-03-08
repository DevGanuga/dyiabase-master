'use client'

import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SignInContent() {
  const searchParams = useSearchParams()
  const fromCalculator = searchParams.get('utm_source') === 'pricing-calculator'

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
