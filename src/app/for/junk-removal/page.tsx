import type { Metadata } from 'next'
import { IndustryPageLayout } from '@/components/marketing/templates'

export const metadata: Metadata = {
  title: 'Junk removal business software | dyia',
  description:
    'Software built for junk removal pros: log a haul in 30 seconds, see real profit after dump fees and fuel, send branded quotes, and get paid by card on the spot. From $19.99/mo.',
}

export default function JunkRemovalPage() {
  return (
    <IndustryPageLayout
      activePage="/for/junk-removal"
      trade="Junk removal"
      headline={<>Run your junk removal business from the cab of your truck.</>}
      subtitle="Log the haul, see your real profit after dump fees and fuel, and collect payment before you pull off the curb."
      heroImage="/marketing/use-junk-removal.png"
      heroImageAlt="Junk removal business owner checking dyia beside his loaded truck at golden hour"
      painPoints={[
        { title: '“What did I actually clear?”', text: 'You hauled $600 today, but after two dump runs, fuel and the helper, the real number is anyone’s guess.' },
        { title: 'Dump fees eat the margin', text: 'Tonnage and disposal fees swing wildly by load. Without tracking them per job, you can’t tell a winner from a loser.' },
        { title: 'Quotes from the curb', text: 'You’re sizing up a garage cleanout on the spot and need a price that’s profitable — not a guess you regret later.' },
        { title: 'Getting paid', text: 'Cash and checks slow you down. You want a tap-to-pay link before you leave the driveway.' },
      ]}
      builtFor={{
        eyebrow: 'Made for the haul',
        title: 'Profit per load, fees and all',
        body: (
          <>
            dyia is built around the numbers junk removal lives on: revenue, dump fees, fuel, labor and dumpster
            rental. Log a job in seconds and see exactly what you cleared. Quote a cleanout with a profitable range,
            then convert it to a job — and a paid invoice — without leaving the site.
          </>
        ),
        bullets: [
          { icon: 'profit', text: 'Real profit per load after dump fees and fuel' },
          { icon: 'quote', text: 'On-site quotes with photos and an estimate range' },
          { icon: 'payments', text: 'Tap-to-pay links so you collect on the curb' },
        ],
        image: '/marketing/use-onsite-phone.png',
        imageAlt: 'Junk removal pro reviewing a job on dyia at the site',
      }}
      cards={[
        { icon: 'profit', title: 'Profit per haul', desc: 'Revenue minus dump fees, fuel, labor and rental.' },
        { icon: 'quote', title: 'Curbside quotes', desc: 'Branded PDF estimates with job-site photos.' },
        { icon: 'payments', title: 'Dyia Pay', desc: 'Card payments and tap-to-pay links on site.' },
        { icon: 'tax', title: 'Tax set-aside', desc: 'Reserved automatically on every job.' },
        { icon: 'followups', title: 'Follow-ups', desc: 'Chase pending cleanout quotes before they go cold.' },
        { icon: 'ai', title: 'Dyia AI', desc: '“Logged $350 for Mike, two dump runs.” Done.', pro: true },
      ]}
    />
  )
}
