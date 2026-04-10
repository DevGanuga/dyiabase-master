import { PublicHeader } from '@/components/PublicHeader'

export const metadata = {
  title: 'Junk Removal Pricing Calculator | dyia',
  description: 'Free profit margin calculator for junk removal businesses. Analyze volume-based, specialty, and mixed jobs to maximize your margins.',
}

export default function PricingCalculatorLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-900/20 via-[#09090b] to-[#09090b]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-orange-500/8 to-transparent rounded-full blur-3xl" />
      </div>

      <PublicHeader />

      <main className="pt-20 sm:pt-24 pb-4 sm:pb-16 px-4 sm:px-6">
        {children}
      </main>
    </div>
  )
}
