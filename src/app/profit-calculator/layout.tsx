import Link from 'next/link'

export default function ProfitCalculatorLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-900/20 via-[#09090b] to-[#09090b]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-orange-500/8 to-transparent rounded-full blur-3xl" />
      </div>
      <nav className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] px-6 py-3">
            <Link href="/" className="flex items-center">
              <img src="/dyia-logo-full.png" alt="dyia" className="h-8 object-contain brightness-0 invert" />
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/profit-calculator" className="text-sm text-slate-400 hover:text-white transition">Calculator</Link>
              <Link href="/sign-in" className="text-sm text-slate-400 hover:text-white transition">Sign in</Link>
              <Link href="/sign-up?redirect_url=/app" className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white rounded-xl font-semibold text-sm shadow-lg shadow-orange-500/20 transition-all">
                Start free
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main className="pt-24 pb-16 px-6">
        {children}
      </main>
    </div>
  )
}
