'use client'

import { useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'

interface PublicHeaderProps {
  variant?: 'default' | 'simple'
  activePage?: string
}

// Reading the demo cookie via useSyncExternalStore (instead of setState-in-effect)
// keeps the server snapshot stable (false) while letting the client read the real
// value on hydration — without triggering an extra cascading render.
const subscribeNoop = () => () => {}
const getDemoCookieSnapshot = () =>
  document.cookie.split(';').some(c => c.trim().startsWith('dyia_demo_active='))
const getDemoCookieServerSnapshot = () => false

export function PublicHeader({ variant = 'default', activePage }: PublicHeaderProps) {
  const { isSignedIn } = useUser()
  const hasDemoCookie = useSyncExternalStore(subscribeNoop, getDemoCookieSnapshot, getDemoCookieServerSnapshot)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isAuthed = isSignedIn || hasDemoCookie
  const authLink = isAuthed ? '/app' : '/sign-in'
  const authLabel = isAuthed ? 'Dashboard' : 'Sign in'
  const ctaLink = isAuthed ? '/app' : '/sign-up?redirect_url=/app'
  const ctaLabel = isAuthed ? 'Open App' : 'Start Free'

  const navLinks = [
    { href: '/features', label: 'Features' },
    { href: '/#pricing', label: 'Pricing' },
    { href: '/intel', label: 'Intel', highlight: true },
    { href: '/support', label: 'Support' },
  ]

  const isActive = (href: string) => activePage === href

  if (variant === 'simple') {
    return (
      <nav className="border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img src="/dyia-logo-full.png" alt="dyia" className="h-8 object-contain brightness-0 invert" />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-slate-400 hover:text-white transition">Home</Link>
            <Link href="/support" className="text-sm text-slate-400 hover:text-white transition">Support</Link>
            <Link href={authLink} className="text-sm text-slate-400 hover:text-white transition">{authLabel}</Link>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] px-4 sm:px-6 py-3">
          <Link href="/" className="flex items-center">
            <img src="/dyia-logo-full.png" alt="dyia" className="h-7 sm:h-8 object-contain brightness-0 invert" />
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm transition ${
                  isActive(link.href)
                    ? 'text-orange-400 font-medium'
                    : link.highlight
                      ? 'text-purple-400 hover:text-purple-300 font-medium'
                      : 'text-slate-400 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side: auth + CTA + hamburger */}
          <div className="flex items-center gap-3">
            <Link href={authLink} className="text-sm text-slate-400 hover:text-white transition">
              {authLabel}
            </Link>
            {!isAuthed && (
              <Link
                href={ctaLink}
                className="hidden sm:inline-flex px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white rounded-xl font-semibold text-sm shadow-lg shadow-orange-500/20 transition-all"
              >
                {ctaLabel}
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 text-slate-400 hover:text-white transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-2 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-white/[0.06] px-4 py-3 space-y-1">
            {navLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-lg text-sm transition ${
                  isActive(link.href)
                    ? 'text-orange-400 bg-orange-500/10'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
            {!isAuthed && (
              <Link
                href={ctaLink}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-semibold text-orange-400 hover:bg-orange-500/10 transition"
              >
                Start Free Trial
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
