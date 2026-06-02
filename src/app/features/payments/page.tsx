import type { Metadata } from 'next'
import { FeaturePageLayout } from '@/components/marketing/templates'

export const metadata: Metadata = {
  title: 'Dyia Pay — get paid on the spot | dyia',
  description:
    'Send a tap-to-pay link or branded invoice and collect by card. Customers can add a tip (100% yours), funds land in your bank via Stripe, and the job is marked paid automatically.',
}

export default function PaymentsPage() {
  return (
    <FeaturePageLayout
      activePage="/features"
      eyebrow="Dyia Pay"
      title={<>Get paid before you leave the driveway.</>}
      subtitle="Stop waiting on checks and chasing invoices. Send a tap-to-pay link or a branded invoice and collect by card on the spot — powered by Stripe."
      heroImage="/marketing/use-getting-paid.png"
      heroImageAlt="A homeowner paying a service pro by phone at the door"
      splits={[
        {
          eyebrow: 'On the spot',
          title: 'A pay link or invoice in seconds',
          body: (
            <>
              Finish the job, send a one-tap pay link or a clean branded invoice, and watch it get paid by card while
              you&apos;re still on site. No card reader, no app for the customer to download — just a link that works on
              any phone.
            </>
          ),
          bullets: [
            { icon: 'payments', text: 'Tap-to-pay links and branded invoices' },
            { icon: 'phone', text: 'No hardware — works on any phone' },
            { icon: 'check', text: 'Job auto-marks paid the moment it clears' },
          ],
          image: '/marketing/use-getting-paid.png',
          imageAlt: 'Customer tapping to pay at the door',
        },
        {
          eyebrow: 'Keep more',
          title: 'Tips go 100% to you',
          body: (
            <>
              Turn on tipping and customers can add 15/18/20% or a custom amount at checkout — and every cent of the tip
              goes straight to you. Our platform fee is a flat, transparent rate on the base only, far below what the
              big platforms bundle into their monthly bills.
            </>
          ),
          bullets: [
            { icon: 'tip', text: 'Optional tipping — 100% to the merchant' },
            { icon: 'security', text: 'Funds land in your bank via Stripe' },
            { icon: 'profit', text: 'Track collected, fees and net in one place' },
          ],
          image: '/marketing/brand-hero-profit.png',
          imageAlt: 'Dyia Pay activity and payout summary',
        },
      ]}
      cardsHeading={{ eyebrow: 'Built in', title: 'Payments that stay in sync' }}
      cards={[
        { icon: 'payments', title: 'Card payments', desc: 'Accept all major cards, powered by Stripe.' },
        { icon: 'bolt', title: 'Tap-to-pay links', desc: 'A one-tap link for a fixed amount, sent by text.' },
        { icon: 'quote', title: 'Branded invoices', desc: 'Itemized invoices with your logo and tax.' },
        { icon: 'tip', title: 'Tips', desc: 'Optional tipping that goes entirely to you.' },
        { icon: 'security', title: 'Stripe payouts', desc: 'Money moves straight to your bank account.' },
        { icon: 'check', title: 'Auto-reconciled', desc: 'Paid status syncs back to the job or quote.' },
      ]}
      ctaTitle={<>Turn finished jobs into money today.</>}
      ctaSubtitle="Connect Stripe in a couple of minutes and send your first pay link."
    />
  )
}
