import type { Metadata } from 'next'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { Eyebrow, SectionHeading, FeatureCard, CtaBand, PrimaryCta, SecondaryCta, ComparisonTable, type CompareRow } from '@/components/marketing/sections'

export const metadata: Metadata = {
  title: 'dyia vs Housecall Pro — profit-first software for small crews',
  description:
    'Housecall Pro is built for growing home-service teams and starts around $59–79/mo. dyia is the lean, profit-first alternative for 1–5 person crews — real take-home profit, tax set-aside and AI from $19.99/mo.',
}

const rows: CompareRow[] = [
  { feature: 'Starting price', them: 'from ~$59/mo', us: 'from $19.99/mo' },
  { feature: 'Free trial', them: '14 days', us: '14 days, full Pro' },
  { feature: 'Built for', them: 'Growing home-service teams', us: '1–5 person crews' },
  { feature: 'Setup time', them: '~30 minutes', us: '~2 minutes' },
  { feature: 'Real take-home profit per job', them: 'Higher tiers', us: true },
  { feature: 'Automatic tax set-aside', them: false, us: true },
  { feature: 'Log jobs by voice / plain text (AI)', them: 'Partial', us: true },
  { feature: 'Pricing from your own job history', them: false, us: true },
  { feature: 'Branded quotes + PDF', them: true, us: true },
  { feature: 'Customer CRM', them: true, us: true },
  { feature: 'Card payments + tips', them: true, us: true },
  { feature: 'Free local competitor report', them: false, us: true },
]

export default function VsHousecallPage() {
  return (
    <MarketingShell activePage="/vs/housecall-pro">
      <section className="px-6 pb-12">
        <div className="max-w-4xl mx-auto text-center">
          <Eyebrow>dyia vs Housecall Pro</Eyebrow>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.05]">
            All the essentials.<br />None of the enterprise weight.
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 mt-6 max-w-2xl mx-auto leading-relaxed">
            Housecall Pro is a deep platform for teams scaling toward dispatch and call centers. If you&apos;re a small
            crew who wants to know your real profit, send quotes, and get paid without a 30-minute setup or a $59+ bill,
            dyia is the leaner, profit-first fit.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <PrimaryCta>Start free</PrimaryCta>
            <SecondaryCta href="/features">See all features</SecondaryCta>
          </div>
        </div>
      </section>

      <section className="px-6 py-10">
        <div className="max-w-3xl mx-auto">
          <ComparisonTable competitor="Housecall Pro" rows={rows} />
          <p className="text-xs text-slate-600 mt-4 text-center">
            Pricing and features reflect publicly available information as of 2026 and may change. Housecall Pro&trade; is
            a trademark of its owner; dyia is not affiliated with Housecall Pro.
          </p>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <SectionHeading eyebrow="Why crews switch" title="Where dyia fits better" />
          <div className="grid sm:grid-cols-3 gap-4">
            <FeatureCard icon="profit" title="Built around profit" desc="Take-home after every expense is the headline number, on every plan." />
            <FeatureCard icon="tax" title="Tax handled for you" desc="Automatic set-aside on every job means tax season is a non-event." />
            <FeatureCard icon="wallet" title="A price that fits a crew" desc="From $19.99/mo — keep more of what you earn each month." />
          </div>
        </div>
      </section>

      <CtaBand title={<>Lean, fast, and built for your margin.</>} subtitle="Start with 14 days of full Pro — no card reader, no onboarding call." />
    </MarketingShell>
  )
}
