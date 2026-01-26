'use client'

import { SignUp } from '@clerk/nextjs'
import Link from 'next/link'
import Image from 'next/image'

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/50 via-white to-amber-50/30 flex flex-col items-center justify-center p-4">
      {/* Background Elements */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-orange-100/40 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-0 w-[400px] h-[400px] bg-amber-100/30 rounded-full blur-[100px]" />
      </div>

      {/* Logo */}
      <Link href="/" className="mb-8 group">
        <Image 
          src="/dyia-logo-full.png" 
          alt="dyia logo" 
          width={120} 
          height={40}
          className="group-hover:scale-105 transition-transform"
        />
      </Link>

      {/* Clerk Sign Up */}
      <SignUp 
        appearance={{
          elements: {
            rootBox: 'w-full max-w-md',
            card: 'shadow-2xl border border-slate-200/80 rounded-3xl',
          }
        }}
        fallbackRedirectUrl="/app"
        signInUrl="/sign-in"
      />

      {/* Back to home */}
      <Link 
        href="/" 
        className="mt-8 flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to homepage
      </Link>
    </div>
  )
}
