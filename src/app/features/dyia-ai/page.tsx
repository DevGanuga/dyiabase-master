import type { Metadata } from 'next'
import { FeaturePageLayout } from '@/components/marketing/templates'

export const metadata: Metadata = {
  title: 'Dyia AI — an assistant that does the work | dyia',
  description:
    'Log jobs and draft quotes in plain English, get pricing from your own job history, and ask your numbers anything. Dyia is an AI business partner that acts — not a chatbot.',
}

export default function DyiaAiPage() {
  return (
    <FeaturePageLayout
      activePage="/features"
      eyebrow="Dyia AI · Pro"
      title={<>An assistant that does the work, not just chats.</>}
      subtitle="Most “AI” bolts a chatbot onto a dashboard. Dyia actually logs the job, drafts the quote, prices the work, and reads your numbers back to you — in plain English."
      heroImage="/marketing/brand-ai-orb.png"
      heroImageAlt="The Dyia AI orb"
      splits={[
        {
          eyebrow: 'Just say it',
          title: 'Log a job by talking',
          body: (
            <>
              &ldquo;Did a basement cleanout for Mike, $400, two dump runs at $35.&rdquo; Dyia pulls out the customer,
              revenue and expenses, shows you the profit, and saves it when you confirm. No forms, no typing in the cab.
            </>
          ),
          bullets: [
            { icon: 'ai', text: 'Natural-language job and expense logging' },
            { icon: 'quote', text: 'Describe a job and get a ready-to-send quote' },
            { icon: 'check', text: 'You review and confirm — Dyia never guesses silently' },
          ],
          image: '/marketing/brand-ai-orb.png',
          imageAlt: 'Dyia AI assistant',
        },
        {
          eyebrow: 'Your data, your prices',
          title: 'Pricing from your own history',
          body: (
            <>
              Ask &ldquo;what should I charge for a hot tub removal?&rdquo; and Dyia looks at your past jobs by type,
              size and difficulty to suggest a real range — not a generic number off the internet. It learns your
              business the more you use it.
            </>
          ),
          bullets: [
            { icon: 'profit', text: 'Smart price suggestions from your jobs' },
            { icon: 'forecast', text: 'Revenue forecasts from your booking patterns' },
            { icon: 'followups', text: 'Flags leads going cold before you lose them' },
          ],
          image: '/marketing/use-onsite-phone.png',
          imageAlt: 'Asking Dyia for a price on the job site',
        },
      ]}
      cardsHeading={{ eyebrow: 'What Dyia can do', title: 'Your AI business partner' }}
      cards={[
        { icon: 'ai', title: 'Natural-language logging', desc: 'Talk or type; Dyia extracts every detail.', pro: true },
        { icon: 'profit', title: 'Smart pricing', desc: 'Suggested ranges from your own job history.', pro: true },
        { icon: 'forecast', title: 'Forecasting', desc: 'Predict the month from your patterns.', pro: true },
        { icon: 'followups', title: 'Risk alerts', desc: 'Catches quotes going cold automatically.', pro: true },
        { icon: 'quote', title: 'Quote drafting', desc: 'Describe a job, get a polished quote.', pro: true },
        { icon: 'intel', title: 'Weekly insights', desc: 'A plain-English read on how the week went.', pro: true },
      ]}
      ctaTitle={<>Put a business analyst in your pocket.</>}
      ctaSubtitle="Dyia AI is included with every Pro plan — and your 14-day trial is full Pro."
    />
  )
}
