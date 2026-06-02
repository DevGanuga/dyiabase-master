import type { Metadata } from 'next'
import { FeaturePageLayout } from '@/components/marketing/templates'

export const metadata: Metadata = {
  title: 'Quotes & invoices for service pros | dyia',
  description:
    'Build branded PDF quotes with photos and line items, send them in seconds, track status, and convert a won quote to a job in one click. Every quote opens a follow-up automatically.',
}

export default function QuotesPage() {
  return (
    <FeaturePageLayout
      activePage="/features"
      eyebrow="Quotes & invoices"
      title={<>Quotes that win the job.</>}
      subtitle="Look like the most professional outfit in town — branded estimates with your logo, photos and clear pricing, sent before your competitor calls back."
      heroImage="/marketing/use-cleaning.png"
      heroImageAlt="A cleaning business owner sending a quote from her phone"
      splits={[
        {
          eyebrow: 'Look the part',
          title: 'Branded PDFs in under a minute',
          body: (
            <>
              Add your logo, line items, an estimate range and job-site photos, and dyia generates a clean, branded PDF
              you can text or email on the spot. First impressions close deals — yours will look like a company twice
              your size.
            </>
          ),
          bullets: [
            { icon: 'quote', text: 'Logo, line items and estimate ranges' },
            { icon: 'phone', text: 'Attach job-site photos from your phone' },
            { icon: 'check', text: 'Send as a polished PDF in a tap' },
          ],
          image: '/marketing/brand-hero-profit.png',
          imageAlt: 'A branded dyia quote',
        },
        {
          eyebrow: 'Never lose a lead',
          title: 'Every quote opens a follow-up',
          body: (
            <>
              The money is in the follow-up. When you send a quote, dyia automatically creates a follow-up and scores it
              hot, warm or cold so you know who to chase first. Track everything on a simple Kanban board — contacted,
              snoozed, won, lost.
            </>
          ),
          bullets: [
            { icon: 'followups', text: 'Auto follow-ups with hot/warm/cold scoring' },
            { icon: 'calendar', text: 'Kanban board to track every open quote' },
            { icon: 'bolt', text: 'Convert a won quote to a job in one click' },
          ],
          image: '/marketing/use-onsite-phone.png',
          imageAlt: 'Following up on quotes from the field',
        },
      ]}
      cardsHeading={{ eyebrow: 'Quote to cash', title: 'The full quoting workflow' }}
      cards={[
        { icon: 'quote', title: 'Branded PDF quotes', desc: 'Your logo, photos, line items and ranges.' },
        { icon: 'followups', title: 'Auto follow-ups', desc: 'Hot/warm/cold scoring on a Kanban board.' },
        { icon: 'bolt', title: 'One-click convert', desc: 'Turn an accepted quote into a job instantly.' },
        { icon: 'payments', title: 'Quote → invoice → paid', desc: 'Attach Dyia Pay and collect by card.' },
        { icon: 'reviews', title: 'Review requests', desc: 'Ask for a review right after the job closes.' },
        { icon: 'ai', title: 'AI quote drafts', desc: 'Describe the job; Dyia drafts the quote.', pro: true },
      ]}
      ctaTitle={<>Send a quote that closes.</>}
      ctaSubtitle="Build your first branded quote free — no card to look around."
    />
  )
}
