import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dyia Intel — Free Competitive Intelligence Report',
  description: 'See how your business stacks up against local competitors. Get a free competitive analysis with reviews, keywords, ads, and Google Business Profile gaps.',
}

export default function IntelLayout({ children }: { children: React.ReactNode }) {
  return children
}
