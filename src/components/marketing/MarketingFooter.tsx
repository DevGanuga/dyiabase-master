import Link from 'next/link'

const columns: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'Profit tracking', href: '/features/profit-tracking' },
      { label: 'Quotes & invoices', href: '/features/quotes' },
      { label: 'Dyia Pay', href: '/features/payments' },
      { label: 'Dyia AI', href: '/features/dyia-ai' },
      { label: 'Pricing', href: '/#pricing' },
    ],
  },
  {
    heading: 'Industries',
    links: [
      { label: 'Junk removal', href: '/for/junk-removal' },
      { label: 'Lawn care', href: '/for/lawn-care' },
      { label: 'Cleaning', href: '/for/cleaning' },
      { label: 'Dyia Intel (free report)', href: '/intel' },
    ],
  },
  {
    heading: 'Compare',
    links: [
      { label: 'dyia vs Jobber', href: '/vs/jobber' },
      { label: 'dyia vs Housecall Pro', href: '/vs/housecall-pro' },
      { label: 'Profit calculator', href: '/pricing-calculator' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Support', href: '/support' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Sign in', href: '/sign-in' },
    ],
  },
]

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/[0.06] py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center mb-4">
              <img src="/dyia-logo-full.png" alt="dyia" className="h-7 object-contain brightness-0 invert" />
            </Link>
            <p className="text-sm text-slate-500 leading-relaxed">
              Your day, decoded. The AI business manager that shows service pros their real profit.
            </p>
            <p className="text-xs text-slate-600 mt-3">American-built · Billed in USD · Secured by Stripe</p>
          </div>
          {columns.map((col) => (
            <div key={col.heading}>
              <h4 className="text-sm font-semibold text-white mb-4">{col.heading}</h4>
              <ul className="space-y-2.5 text-sm text-slate-500">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:text-orange-400 transition">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/[0.06] pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-600 text-sm">© {new Date().getFullYear()} dyia. All rights reserved.</p>
          <p className="text-slate-600 text-xs">Built for the people who do the work.</p>
        </div>
      </div>
    </footer>
  )
}
