import type { Metadata } from 'next'
import { DM_Sans, Space_Grotesk } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
})

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dyia.io'

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'dyia – Your Day, Decoded | Simple Profit Tracking for Service Businesses',
    template: '%s | dyia',
  },
  description: 'Track jobs, profits, expenses, and generate professional quotes. Built for junk removal, lawn care, and house cleaning businesses who want results without the complexity.',
  applicationName: 'dyia',
  keywords: ['profit tracking', 'job tracking', 'quotes', 'service business', 'junk removal', 'lawn care', 'house cleaning', 'small business'],
  authors: [{ name: 'dyia', url: appUrl }],
  creator: 'dyia',
  icons: {
    icon: [
      { url: '/dyia-logo.png', type: 'image/png', sizes: 'any' },
    ],
    apple: [
      { url: '/dyia-logo.png', type: 'image/png', sizes: '180x180' },
    ],
  },
  openGraph: {
    title: 'dyia – Your Day, Decoded',
    description: 'Simple profit tracking for service businesses. Track jobs, generate quotes, and know your real profit.',
    url: '/',
    siteName: 'dyia',
    type: 'website',
    images: [
      {
        url: '/dyia-logo-full.png',
        width: 1200,
        height: 630,
        alt: 'dyia - Your Day, Decoded',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'dyia – Your Day, Decoded',
    description: 'Simple profit tracking for service businesses. Track jobs, generate quotes, and know your real profit.',
    images: ['/dyia-logo-full.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: '/manifest.json',
}

const clerkAppearance = {
  variables: {
    colorPrimary: '#f97316',
    colorTextOnPrimaryBackground: '#ffffff',
    borderRadius: '0.75rem',
  },
  elements: {
    formButtonPrimary: 
      'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 shadow-lg shadow-orange-500/20',
    card: 'shadow-xl',
    headerTitle: 'text-slate-900',
    headerSubtitle: 'text-slate-500',
    socialButtonsBlockButton: 'border-slate-200 hover:bg-slate-50',
    formFieldInput: 
      'border-slate-200 focus:border-orange-500 focus:ring-orange-500/20',
    footerActionLink: 'text-orange-600 hover:text-orange-700',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Check if Clerk is configured
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  // If Clerk isn't configured, render without it (for development/testing)
  const themeScript = `(function(){try{var t=localStorage.getItem('dyia-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme:dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}})();`

  if (!clerkKey) {
    return (
      <html lang="en" suppressHydrationWarning>
        <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
        <body className={`${dmSans.variable} ${spaceGrotesk.variable} antialiased`}>
          {children}
        </body>
      </html>
    )
  }

  return (
    <ClerkProvider
      appearance={clerkAppearance}
      signInFallbackRedirectUrl="/app"
      signUpFallbackRedirectUrl="/app"
    >
      <html lang="en" suppressHydrationWarning>
        <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
        <body className={`${dmSans.variable} ${spaceGrotesk.variable} antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
