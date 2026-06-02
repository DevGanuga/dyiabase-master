import type { Metadata } from 'next'
import { IndustryPageLayout } from '@/components/marketing/templates'

export const metadata: Metadata = {
  title: 'House cleaning business software | dyia',
  description:
    'Software for cleaning businesses: track profit per clean after supplies and pay, send branded quotes, manage repeat clients, and collect card payments with tips. From $19.99/mo.',
}

export default function CleaningPage() {
  return (
    <IndustryPageLayout
      activePage="/for/cleaning"
      trade="Cleaning"
      headline={<>Spotless homes, and a spotless set of books.</>}
      subtitle="See your real profit per clean after supplies and pay, quote in seconds, keep your repeat clients organized, and take card payments with tips."
      heroImage="/marketing/use-cleaning.png"
      heroImageAlt="House cleaning business owner using dyia in a bright living room"
      painPoints={[
        { title: 'Per-clean profit is fuzzy', text: 'Between supplies, drive time and paying your cleaners, it’s hard to know which jobs are actually worth it.' },
        { title: 'Repeat clients, scattered notes', text: 'Weekly, bi-weekly and one-off cleans — keeping every client’s preferences and history straight is a headache.' },
        { title: 'Quoting new homes', text: 'You need a fast, professional quote for a deep clean before the lead cools off and calls someone else.' },
        { title: 'Awkward payment moments', text: 'Asking for a check at the door is uncomfortable — a clean tap-to-pay link (with a tip option) isn’t.' },
      ]}
      builtFor={{
        eyebrow: 'Made for the clean',
        title: 'Every client, every clean, organized',
        body: (
          <>
            dyia keeps your clients and their history in one place, shows profit per clean after supplies and pay, and
            lets you send a branded quote in under a minute. When the job’s done, send a tap-to-pay link — customers can
            add a tip, and every cent of it is yours.
          </>
        ),
        bullets: [
          { icon: 'customers', text: 'Client profiles with full job and quote history' },
          { icon: 'profit', text: 'Profit per clean after supplies and pay' },
          { icon: 'tip', text: 'Card payments with optional tips — 100% to you' },
        ],
        image: '/marketing/use-getting-paid.png',
        imageAlt: 'A client paying for a cleaning by phone at the door',
      }}
      cards={[
        { icon: 'profit', title: 'Profit per clean', desc: 'After supplies, drive time and pay.' },
        { icon: 'customers', title: 'Client CRM', desc: 'Preferences, notes and full history per home.' },
        { icon: 'quote', title: 'Fast quotes', desc: 'Branded estimates for deep cleans and move-outs.' },
        { icon: 'tip', title: 'Payments + tips', desc: 'Tap-to-pay links; tips go entirely to you.' },
        { icon: 'reviews', title: 'Review requests', desc: 'One-tap ask after a sparkling clean.' },
        { icon: 'ai', title: 'Dyia AI', desc: 'Log cleans and draft quotes by talking.', pro: true },
      ]}
    />
  )
}
