import type { Metadata } from 'next'
import { IndustryPageLayout } from '@/components/marketing/templates'

export const metadata: Metadata = {
  title: 'Lawn care & landscaping business software | dyia',
  description:
    'Software for lawn care and landscaping pros: track profit per property after fuel and crew, quote recurring work, manage your customer route, and get paid by card. From $19.99/mo.',
}

export default function LawnCarePage() {
  return (
    <IndustryPageLayout
      activePage="/for/lawn-care"
      trade="Lawn care"
      headline={<>Mow, blow, and actually know your numbers.</>}
      subtitle="Track profit per property after fuel and crew time, quote recurring work in seconds, and get paid without chasing checks."
      heroImage="/marketing/use-lawn-care.png"
      heroImageAlt="Lawn care professional checking dyia on a freshly mowed lawn"
      painPoints={[
        { title: 'Thin margins, lots of stops', text: 'Twenty lawns a day, small tickets each — a few unprofitable accounts can quietly sink your week.' },
        { title: 'Fuel and crew add up', text: 'Between gas, trimmer line and a helper’s hours, the real cost per property is easy to lose track of.' },
        { title: 'Recurring quotes', text: 'Weekly and bi-weekly accounts need clean, repeatable pricing — not a number scribbled on a notepad.' },
        { title: 'Slow payments', text: 'Waiting on checks from a dozen homeowners is a part-time job you didn’t sign up for.' },
      ]}
      builtFor={{
        eyebrow: 'Made for the route',
        title: 'Know which accounts actually pay',
        body: (
          <>
            Log each property with revenue, fuel and crew time and dyia shows the profit per stop — so you can spot the
            accounts worth keeping and the ones to re-price. Send recurring quotes, track your customers, and collect by
            card so the money shows up on time.
          </>
        ),
        bullets: [
          { icon: 'profit', text: 'Profit per property after fuel and crew' },
          { icon: 'customers', text: 'Customer history so you know every account’s value' },
          { icon: 'payments', text: 'Card payments and pay links for recurring work' },
        ],
        image: '/marketing/use-onsite-phone.png',
        imageAlt: 'Lawn care pro logging a property on dyia',
      }}
      cards={[
        { icon: 'profit', title: 'Profit per property', desc: 'After fuel, crew time and materials.' },
        { icon: 'quote', title: 'Recurring quotes', desc: 'Clean, repeatable pricing for weekly accounts.' },
        { icon: 'customers', title: 'Customer CRM', desc: 'Every property’s history and lifetime value.' },
        { icon: 'payments', title: 'Dyia Pay', desc: 'Collect by card; stop chasing checks.' },
        { icon: 'goal', title: 'Monthly goals', desc: 'Track route revenue against your target.' },
        { icon: 'ai', title: 'Dyia AI', desc: 'Log the day’s lawns by talking to Dyia.', pro: true },
      ]}
    />
  )
}
