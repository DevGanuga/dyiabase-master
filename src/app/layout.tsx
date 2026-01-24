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

export const metadata: Metadata = {
  title: 'dyia – Your Day, Decoded | Simple Profit Tracking for Service Businesses',
  description: 'Track jobs, profits, expenses, and generate professional quotes. Built for junk removal, lawn care, and house cleaning businesses who want results without the complexity.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider
      appearance={{
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
      }}
    >
      <html lang="en">
        <body className={`${dmSans.variable} ${spaceGrotesk.variable} antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
