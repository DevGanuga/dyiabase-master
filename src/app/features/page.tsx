import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { Icon, type IconName } from '@/components/marketing/icons'
import { Eyebrow, SectionHeading, FeatureCard, CtaBand, PrimaryCta, SecondaryCta, ProofStrip } from '@/components/marketing/sections'

export const metadata: Metadata = {
  title: 'Features — Everything to run your service business | dyia',
  description:
    'dyia is the AI business manager for service pros: real profit tracking, branded quotes & invoices, customer CRM, follow-ups, Dyia Pay, and an AI assistant that does the work. See every feature.',
}

const pillars: { eyebrow: string; icon: IconName; title: string; desc: string; href: string }[] = [
  {
    eyebrow: 'Track profit',
    icon: 'profit',
    title: 'Know what you actually take home',
    desc: 'Log a job in 30 seconds with revenue, gas, dump fees, labor and materials. See real profit per job, set aside taxes automatically, and watch your monthly goal.',
    href: '/features/profit-tracking',
  },
  {
    eyebrow: 'Win work',
    icon: 'quote',
    title: 'Quote and invoice like a pro',
    desc: 'Branded PDF quotes with photos and line items. Send, track, and convert to a job in a click. Every quote opens a follow-up so leads never go cold.',
    href: '/features/quotes',
  },
  {
    eyebrow: 'Get paid',
    icon: 'payments',
    title: 'Dyia Pay — collect on the spot',
    desc: 'Send a tap-to-pay link or a branded invoice and get paid by card. Tips go 100% to you. Funds land in your bank, status syncs back automatically.',
    href: '/features/payments',
  },
  {
    eyebrow: 'Grow with AI',
    icon: 'ai',
    title: 'Dyia does the busywork',
    desc: 'Log jobs and draft quotes in plain English, get pricing from your own history, and read your numbers back to you. An assistant that acts, not just chats.',
    href: '/features/dyia-ai',
  },
]

const everything: { icon: IconName; title: string; desc: string; pro?: boolean }[] = [
  { icon: 'profit', title: 'Per-job profit', desc: 'Revenue minus every expense — gas, dump fees, labor, materials — the second you log it.' },
  { icon: 'tax', title: 'Tax set-aside', desc: 'An adjustable percentage is reserved on every job so April never surprises you.' },
  { icon: 'quote', title: 'Quote builder', desc: 'Branded PDF estimates with photos, line items and an estimate range.' },
  { icon: 'customers', title: 'Customer CRM', desc: 'Contacts, notes, lifetime value, and full job + quote history per customer.' },
  { icon: 'followups', title: 'Follow-up pipeline', desc: 'Hot/warm/cold scoring on a Kanban board so no quote slips through.' },
  { icon: 'payments', title: 'Dyia Pay', desc: 'Card payments, tap-to-pay links, branded invoices, and tips — straight to your bank.' },
  { icon: 'ai', title: 'Dyia AI assistant', desc: 'Natural-language logging, smart pricing, and instant business answers.', pro: true },
  { icon: 'forecast', title: 'Revenue forecasting', desc: 'Project the month ahead from your booking patterns and history.', pro: true },
  { icon: 'wallet', title: 'Fixed expenses', desc: 'Track insurance, truck payments and overhead for true net profit.' },
  { icon: 'goal', title: 'Monthly goals', desc: 'Set a target and watch live progress on your dashboard.' },
  { icon: 'reviews', title: 'Review requests', desc: 'One-tap Google, Yelp and Facebook review asks after a job.' },
  { icon: 'email', title: 'Email campaigns', desc: 'Send from Gmail or Outlook to your customer list and track it.', pro: true },
  { icon: 'marketing', title: 'Marketing ROI', desc: 'Log ad spend by channel and see which actually brings profit.', pro: true },
  { icon: 'intel', title: 'Dyia Intel', desc: 'A free local competitive report — your rank, review gaps and keywords.' },
  { icon: 'export', title: 'Data export', desc: 'Download every job, quote and customer as CSV. Your data is yours.' },
  { icon: 'phone', title: 'Works anywhere', desc: 'A fast web app on any phone, tablet or laptop. Add it to your home screen.' },
]

export default function FeaturesPage() {
  return (
    <MarketingShell activePage="/features">
      {/* Hero */}
      <section className="px-6 pb-14">
        <div className="max-w-4xl mx-auto text-center">
          <Eyebrow>The full platform</Eyebrow>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.05]">
            One place to run the<br className="hidden sm:block" /> whole business.
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 mt-6 max-w-2xl mx-auto leading-relaxed">
            Not a pile of features — a connected system. Quotes become jobs, jobs become profit,
            customers become repeat work, and Dyia keeps the whole thing moving while you&apos;re on the truck.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            <PrimaryCta>Start free</PrimaryCta>
            <SecondaryCta href="/#pricing">See pricing</SecondaryCta>
          </div>
        </div>
      </section>

      {/* On-site hero image */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto relative">
          <div className="absolute -inset-4 bg-gradient-to-b from-orange-500/15 to-transparent rounded-[2rem] blur-3xl" />
          <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/50">
            <Image src="/marketing/use-onsite-phone.png" alt="A service pro checking dyia on a job site at golden hour" width={1600} height={900} priority className="w-full object-cover" />
          </div>
        </div>
      </section>

      {/* Four pillars */}
      <section className="px-6 py-8">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-5">
          {pillars.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="group bg-white/[0.02] border border-white/[0.06] rounded-2xl p-7 hover:border-orange-500/25 hover:bg-white/[0.03] transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="w-11 h-11 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center">
                  <Icon name={p.icon} className="w-5 h-5" />
                </span>
                <Eyebrow>{p.eyebrow}</Eyebrow>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{p.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">{p.desc}</p>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-400 group-hover:gap-2.5 transition-all">
                Explore <Icon name="arrowRight" className="w-4 h-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Everything grid */}
      <section className="px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <SectionHeading eyebrow="Every tool, included" title="Everything you get with dyia" subtitle="Basic covers day-to-day operations. Pro adds the AI assistant, email campaigns and marketing tools." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {everything.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
          <div className="mt-12"><ProofStrip /></div>
        </div>
      </section>

      <CtaBand title={<>Everything, for less than a tank of gas.</>} subtitle="Start with 14 days of full Pro — every feature, no limits. Cancel anytime." />
    </MarketingShell>
  )
}
