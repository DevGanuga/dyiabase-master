import Link from 'next/link'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { Icon, type IconName } from './icons'

/* ── Calls to action ─────────────────────────────────────────────── */

export function PrimaryCta({ children = 'Start free', href = '/sign-up?redirect_url=/app', className = '' }: { children?: ReactNode; href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold text-base shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 hover:-translate-y-0.5 transition-all ${className}`}
    >
      {children}
      <Icon name="arrowRight" className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
    </Link>
  )
}

export function SecondaryCta({ children, href, className = '' }: { children: ReactNode; href: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.08] hover:border-white/[0.15] rounded-xl font-semibold text-base transition-all ${className}`}
    >
      {children}
    </Link>
  )
}

/* ── Headings ────────────────────────────────────────────────────── */

export function Eyebrow({ children, color = 'orange' }: { children: ReactNode; color?: 'orange' | 'purple' }) {
  return (
    <p className={`text-sm font-medium uppercase tracking-wider mb-3 ${color === 'purple' ? 'text-purple-400' : 'text-orange-400'}`}>
      {children}
    </p>
  )
}

export function SectionHeading({ eyebrow, title, subtitle, align = 'center' }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; align?: 'center' | 'left' }) {
  return (
    <div className={`mb-12 sm:mb-16 ${align === 'center' ? 'text-center max-w-3xl mx-auto' : 'max-w-2xl'}`}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.1]">{title}</h2>
      {subtitle && <p className="text-lg sm:text-xl text-slate-400 mt-4 leading-relaxed">{subtitle}</p>}
    </div>
  )
}

/* ── Feature split (image + copy, alternating) ───────────────────── */

export function FeatureSplit({
  eyebrow,
  title,
  body,
  bullets,
  image,
  imageAlt,
  reverse = false,
}: {
  eyebrow?: string
  title: ReactNode
  body: ReactNode
  bullets?: { icon: IconName; text: string }[]
  image: string
  imageAlt: string
  reverse?: boolean
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
      <div className={reverse ? 'lg:order-2' : ''}>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-4">{title}</h3>
        <div className="text-slate-400 leading-relaxed text-base sm:text-lg">{body}</div>
        {bullets && (
          <ul className="mt-6 space-y-3">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
                  <Icon name={b.icon} className="w-4 h-4" />
                </span>
                <span className="text-slate-300 text-sm sm:text-base">{b.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={`relative ${reverse ? 'lg:order-1' : ''}`}>
        <div className="absolute -inset-3 bg-gradient-to-br from-orange-500/15 to-amber-500/5 rounded-[2rem] blur-2xl" />
        <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl shadow-black/40 aspect-[3/2]">
          <Image src={image} alt={imageAlt} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" />
        </div>
      </div>
    </div>
  )
}

/* ── Feature card grid item ──────────────────────────────────────── */

export function FeatureCard({ icon, title, desc, pro }: { icon: IconName; title: string; desc: string; pro?: boolean }) {
  return (
    <div className="relative bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:border-orange-500/25 transition-all">
      {pro && (
        <span className="absolute top-4 right-4 px-1.5 py-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded text-[9px] font-bold text-white tracking-wide">PRO</span>
      )}
      <div className="w-11 h-11 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center text-orange-400 mb-4">
        <Icon name={icon} className="w-5 h-5" />
      </div>
      <h3 className="font-semibold text-white mb-1.5">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
    </div>
  )
}

/* ── Beta credibility strip (no fake user counts) ────────────────── */

export function ProofStrip() {
  const items: { icon: IconName; label: string }[] = [
    { icon: 'security', label: 'Bank-level encryption' },
    { icon: 'payments', label: 'Payments secured by Stripe' },
    { icon: 'phone', label: 'Works on any device' },
    { icon: 'export', label: 'Export your data anytime' },
  ]
  return (
    <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2 text-sm text-slate-400">
          <Icon name={it.icon} className="w-4 h-4 text-orange-400/80" />
          {it.label}
        </div>
      ))}
    </div>
  )
}

/* ── CTA band ────────────────────────────────────────────────────── */

export function CtaBand({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <section className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="relative bg-gradient-to-b from-orange-500/10 via-orange-500/5 to-transparent border border-orange-500/20 rounded-3xl p-10 sm:p-14 text-center overflow-hidden">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-orange-500/30">
              <img src="/dyia-agent.png" alt="" className="w-10 h-10 object-contain" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">{title}</h2>
            {subtitle && <p className="text-lg text-slate-400 mb-10 max-w-lg mx-auto">{subtitle}</p>}
            <div className="flex flex-wrap justify-center gap-3">
              <PrimaryCta>Start your free trial</PrimaryCta>
              <SecondaryCta href="/#pricing">See pricing</SecondaryCta>
            </div>
            <p className="text-sm text-slate-500 mt-5">14 days free · Cancel anytime · No setup fees</p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Comparison table (reused on /vs/* pages) ────────────────────── */

export type CompareRow = { feature: string; us: string | boolean; them: string | boolean }

export function ComparisonTable({ competitor, rows }: { competitor: string; rows: CompareRow[] }) {
  const Cell = ({ value, highlight }: { value: string | boolean; highlight?: boolean }) => {
    if (typeof value === 'boolean') {
      return value ? (
        <span className={highlight ? 'text-orange-400 font-bold' : 'text-green-500'}>✓</span>
      ) : (
        <span className="text-slate-600">—</span>
      )
    }
    return <span className={highlight ? 'text-white font-medium' : 'text-slate-500'}>{value}</span>
  }
  return (
    <div className="bg-[#0f0f11] border border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left p-4 text-slate-400 font-medium min-w-[180px]">Feature</th>
              <th className="p-4 text-center text-slate-500 min-w-[120px]">{competitor}</th>
              <th className="p-4 text-center bg-orange-500/5 text-orange-400 font-bold min-w-[120px]">dyia</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-white/[0.03]">
                <td className="p-4 text-slate-300">{row.feature}</td>
                <td className="p-4 text-center"><Cell value={row.them} /></td>
                <td className="p-4 text-center bg-orange-500/5"><Cell value={row.us} highlight /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
