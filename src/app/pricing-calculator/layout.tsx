import { Suspense } from 'react'
import { PricingCalcShell } from './app-mode'

export const metadata = {
  title: 'Junk Removal Pricing Calculator | dyia',
  description: 'Free profit margin calculator for junk removal businesses. Analyze volume-based, specialty, and mixed jobs to maximize your margins.',
}

export default function PricingCalculatorLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden">
        <main className="pt-8 pb-4 px-4 sm:px-6">{children}</main>
      </div>
    }>
      <PricingCalcShell>{children}</PricingCalcShell>
    </Suspense>
  )
}
