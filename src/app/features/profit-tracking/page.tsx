import type { Metadata } from 'next'
import { FeaturePageLayout } from '@/components/marketing/templates'

export const metadata: Metadata = {
  title: 'Profit tracking for service businesses | dyia',
  description:
    'See your real take-home profit on every job after gas, dump fees, labor and materials. Automatic tax set-aside, fixed-expense tracking, and monthly goals — built for service pros.',
}

export default function ProfitTrackingPage() {
  return (
    <FeaturePageLayout
      activePage="/features"
      eyebrow="Profit tracking"
      title={<>Stop guessing what you made.</>}
      subtitle="Revenue is easy to see. Profit is the number that pays your mortgage — dyia shows it on every job, the moment you log it."
      heroImage="/marketing/brand-hero-profit.png"
      heroImageAlt="dyia profit dashboard with a rising profit line"
      splits={[
        {
          eyebrow: 'Real numbers',
          title: 'Profit per job, not just revenue',
          body: (
            <>
              Enter what you charged and what it cost — gas, dump fees, the helper, materials, dumpster rental — and
              dyia does the math instantly. No spreadsheet, no end-of-month guessing. You finish a job knowing exactly
              what hit your pocket.
            </>
          ),
          bullets: [
            { icon: 'profit', text: 'Revenue minus every expense, calculated live' },
            { icon: 'customers', text: 'Split one job across multiple customers automatically' },
            { icon: 'intel', text: 'Tag the lead source so you know what marketing pays off' },
          ],
          image: '/marketing/use-junk-removal.png',
          imageAlt: 'Junk removal owner checking his numbers by the truck',
        },
        {
          eyebrow: 'No April surprises',
          title: 'Taxes set aside on every job',
          body: (
            <>
              Pick your tax rate once and dyia reserves it on every job automatically. The take-home number you see is
              the money that&apos;s actually yours to keep — so tax season is a non-event instead of a lost weekend.
            </>
          ),
          bullets: [
            { icon: 'tax', text: 'Adjustable set-aside on every job' },
            { icon: 'wallet', text: 'Track fixed monthly overhead for true net profit' },
            { icon: 'export', text: 'Export everything to CSV for your accountant' },
          ],
          image: '/marketing/brand-chaos-to-clarity.png',
          imageAlt: 'Receipts and clutter transforming into a clean dashboard',
        },
        {
          eyebrow: 'Look ahead',
          title: 'Goals and forecasts that keep you on track',
          body: (
            <>
              Set a monthly revenue goal and watch live progress on your dashboard. With Pro, Dyia forecasts where
              you&apos;ll land based on your booking patterns — so you can push marketing on a slow week instead of
              finding out at the end of the month.
            </>
          ),
          bullets: [
            { icon: 'goal', text: 'Visual monthly goal tracking' },
            { icon: 'forecast', text: 'AI revenue forecasting (Pro)' },
            { icon: 'profit', text: 'Reports by source, expense type and trend' },
          ],
          image: '/marketing/brand-hero-profit.png',
          imageAlt: 'dyia revenue forecast and goal progress',
        },
      ]}
      cardsHeading={{ eyebrow: 'Also included', title: 'The whole money picture' }}
      cards={[
        { icon: 'tax', title: 'Tax set-aside', desc: 'Auto-reserved on every job at your rate.' },
        { icon: 'wallet', title: 'Fixed expenses', desc: 'Insurance, truck, tools, software — counted in net profit.' },
        { icon: 'goal', title: 'Monthly goals', desc: 'Live progress toward your revenue target.' },
        { icon: 'profit', title: 'Reports & analytics', desc: 'Revenue by source, expense breakdowns and trends.' },
        { icon: 'forecast', title: 'Forecasting', desc: 'Project the month ahead from your data.', pro: true },
        { icon: 'export', title: 'CSV export', desc: 'Hand clean data to your accountant anytime.' },
      ]}
      ctaTitle={<>See your real profit on the next job.</>}
      ctaSubtitle="Log a job in 30 seconds and watch the take-home number appear."
    />
  )
}
