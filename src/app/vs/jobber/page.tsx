import type { Metadata } from 'next'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { Eyebrow, SectionHeading, FeatureCard, CtaBand, PrimaryCta, SecondaryCta, ComparisonTable, type CompareRow } from '@/components/marketing/sections'

export const metadata: Metadata = {
  title: 'dyia vs Jobber — the simpler, profit-first alternative',
  description:
    'Jobber is built for growing fleets and starts around $49/mo. dyia is built for 1–5 person service crews who want real take-home profit, automatic tax set-aside and AI — from $19.99/mo.',
}

const rows: CompareRow[] = [
  { feature: 'Starting price', them: 'from ~$49/mo', us: 'from $19.99/mo' },
  { feature: 'Free trial', them: '14 days', us: '14 days, full Pro' },
  { feature: 'Built for', them: 'Growing teams & fleets', us: '1–5 person crews' },
  { feature: 'Setup time', them: 'Hours', us: '~2 minutes' },
  { feature: 'Real take-home profit per job', them: 'Higher tiers', us: true },
  { feature: 'Automatic tax set-aside', them: false, us: true },
  { feature: 'Log jobs by voice / plain text (AI)', them: false, us: true },
  { feature: 'Pricing from your own job history', them: false, us: true },
  { feature: 'Branded quotes + PDF', them: true, us: true },
  { feature: 'Customer CRM', them: true, us: true },
  { feature: 'Card payments', them: true, us: true },
  { feature: 'Free local competitor report', them: false, us: true },
]

export default function VsJobberPage() {
  return (
    <MarketingShell activePage="/vs/jobber">
      <section className="px-6 pb-12">
        <div className="max-w-4xl mx-auto text-center">
          <Eyebrow>dyia vs Jobber</Eyebrow>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.05]">
            Love the idea of Jobber.<br />Built for a smaller crew.
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 mt-6 max-w-2xl mx-auto leading-relaxed">
            Jobber is a great platform for growing fleets with dispatchers and route optimization. If you run a
            1–5 person operation and mostly need to know your real profit, get quotes out, and get paid — dyia does
            that for a third of the price, and adds AI and tax set-aside Jobber leaves out.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <PrimaryCta>Start free</PrimaryCta>
            <SecondaryCta href="/features">See all features</SecondaryCta>
          </div>
        </div>
      </section>

      <section className="px-6 py-10">
        <div className="max-w-3xl mx-auto">
          <ComparisonTable competitor="Jobber" rows={rows} />
          <p className="text-xs text-slate-600 mt-4 text-center">
            Pricing and features reflect publicly available information as of 2026 and may change. Jobber&trade; is a
            trademark of its owner; dyia is not affiliated with Jobber.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <SectionHeading eyebrow="Why crews switch" title="Where dyia fits better" />
          <div className="grid sm:grid-cols-3 gap-4">
            <FeatureCard icon="profit" title="Profit, not just revenue" desc="Every job shows take-home after gas, dump fees, labor and materials — on every plan." />
            <FeatureCard icon="ai" title="AI that does the work" desc="Log jobs by talking and price from your own history. Included with Pro." />
            <FeatureCard icon="bolt" title="Up and running in minutes" desc="No onboarding calls or dispatcher setup. Log your first job in 30 seconds." />
          </div>
        </div>
      </section>

      <CtaBand title={<>The right-sized tool for your crew.</>} subtitle="Try every Pro feature free for 14 days. Keep Basic for $19.99 or Pro for $29.99." />
    </MarketingShell>
  )
}
