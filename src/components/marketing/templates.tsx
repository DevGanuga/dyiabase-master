import type { ReactNode } from 'react'
import Image from 'next/image'
import { MarketingShell } from './MarketingShell'
import { Icon, type IconName } from './icons'
import {
  Eyebrow,
  SectionHeading,
  FeatureSplit,
  FeatureCard,
  CtaBand,
  PrimaryCta,
  SecondaryCta,
} from './sections'

type SplitProps = {
  eyebrow?: string
  title: ReactNode
  body: ReactNode
  bullets?: { icon: IconName; text: string }[]
  image: string
  imageAlt: string
}

type CardProps = { icon: IconName; title: string; desc: string; pro?: boolean }

/* ── Deep feature page ───────────────────────────────────────────── */

export function FeaturePageLayout({
  activePage,
  eyebrow,
  title,
  subtitle,
  heroImage,
  heroImageAlt,
  splits,
  cardsHeading,
  cards,
  ctaTitle,
  ctaSubtitle,
}: {
  activePage?: string
  eyebrow: string
  title: ReactNode
  subtitle: ReactNode
  heroImage: string
  heroImageAlt: string
  splits: SplitProps[]
  cardsHeading?: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode }
  cards?: CardProps[]
  ctaTitle: ReactNode
  ctaSubtitle?: ReactNode
}) {
  return (
    <MarketingShell activePage={activePage}>
      {/* Hero */}
      <section className="px-6 pb-16">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-white tracking-tight leading-[1.05]">{title}</h1>
            <p className="text-lg sm:text-xl text-slate-400 mt-5 leading-relaxed">{subtitle}</p>
            <div className="flex flex-wrap gap-3 mt-8">
              <PrimaryCta>Start free</PrimaryCta>
              <SecondaryCta href="/features">All features</SecondaryCta>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-orange-500/20 to-amber-500/5 rounded-[2rem] blur-3xl" />
            <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/50 aspect-[3/2]">
              <Image src={heroImage} alt={heroImageAlt} fill priority className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
            </div>
          </div>
        </div>
      </section>

      {/* Alternating detail splits */}
      <section className="px-6 py-12">
        <div className="max-w-6xl mx-auto space-y-20 sm:space-y-28">
          {splits.map((s, i) => (
            <FeatureSplit key={i} {...s} reverse={i % 2 === 1} />
          ))}
        </div>
      </section>

      {/* Supporting cards */}
      {cards && cards.length > 0 && (
        <section className="px-6 py-16">
          <div className="max-w-6xl mx-auto">
            {cardsHeading && <SectionHeading eyebrow={cardsHeading.eyebrow} title={cardsHeading.title} subtitle={cardsHeading.subtitle} />}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cards.map((c) => (
                <FeatureCard key={c.title} {...c} />
              ))}
            </div>
          </div>
        </section>
      )}

      <CtaBand title={ctaTitle} subtitle={ctaSubtitle} />
    </MarketingShell>
  )
}

/* ── Industry page ───────────────────────────────────────────────── */

export function IndustryPageLayout({
  activePage,
  trade,
  headline,
  subtitle,
  heroImage,
  heroImageAlt,
  painPoints,
  builtFor,
  cards,
  available = true,
}: {
  activePage?: string
  trade: string
  headline: ReactNode
  subtitle: ReactNode
  heroImage: string
  heroImageAlt: string
  painPoints: { title: string; text: string }[]
  builtFor: SplitProps
  cards: CardProps[]
  available?: boolean
}) {
  return (
    <MarketingShell activePage={activePage}>
      {/* Hero with real photo */}
      <section className="px-6 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/50">
            <Image src={heroImage} alt={heroImageAlt} width={1600} height={900} priority className="w-full h-[360px] sm:h-[460px] object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/70 to-transparent" />
            <div className="absolute inset-0 flex items-end">
              <div className="p-8 sm:p-12 max-w-2xl">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-semibold uppercase tracking-wider mb-4">
                  {available ? 'Live for ' : 'Coming soon · '}{trade}
                </span>
                <h1 className="text-3xl sm:text-5xl font-bold text-white tracking-tight leading-[1.05]">{headline}</h1>
                <p className="text-lg text-slate-300 mt-4 max-w-xl">{subtitle}</p>
                <div className="flex flex-wrap gap-3 mt-7">
                  <PrimaryCta>Start free</PrimaryCta>
                  <SecondaryCta href="/features">See everything it does</SecondaryCta>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain points */}
      <section className="px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <SectionHeading eyebrow="The daily grind" title={`What ${trade.toLowerCase()} pros tell us`} subtitle="The stuff that quietly eats your day — and your margin." />
          <div className="grid sm:grid-cols-2 gap-5">
            {painPoints.map((p) => (
              <div key={p.title} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-2">{p.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built for the trade */}
      <section className="px-6 py-12">
        <div className="max-w-6xl mx-auto">
          <FeatureSplit {...builtFor} />
        </div>
      </section>

      {/* Capabilities */}
      <section className="px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <SectionHeading eyebrow="Everything included" title={`Run your ${trade.toLowerCase()} business end to end`} />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((c) => (
              <FeatureCard key={c.title} {...c} />
            ))}
          </div>
        </div>
      </section>

      <CtaBand title={<>Ready to know your real profit?</>} subtitle={`Set up your ${trade.toLowerCase()} business in 2 minutes. Log your first job in 30 seconds.`} />
    </MarketingShell>
  )
}
