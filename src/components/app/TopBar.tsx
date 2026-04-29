'use client'

import { useState, useRef, useEffect } from 'react'
import { useTheme } from '@/hooks/useTheme'

interface TopBarProps {
  userName?: string
  userEmail: string
  userImageUrl?: string
  onLogout: () => void
  /** UI tier: basic/trial/pro — controls trial messaging. */
  subscriptionTier?: 'basic' | 'trial' | 'pro'
  /** Product tier: basic/pro — controls plan label on the account chip. */
  planTier?: 'basic' | 'pro'
  isDemoMode?: boolean
}

export function TopBar({ userName, userEmail, userImageUrl, onLogout, subscriptionTier = 'basic', planTier, isDemoMode }: TopBarProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [menuOpen])

  const initials = (userName || userEmail || 'U').charAt(0).toUpperCase()

  return (
    // BUG-007/017: `isolate` creates a new stacking context so the account
    // dropdown (z-[80] below) reliably paints above sibling banners, and
    // `relative z-40` gives the whole header priority over banners rendered
    // below it in the flex column.
    <div className="top-bar relative z-40 isolate flex items-center justify-between h-14 px-4 sm:px-6 lg:px-8 shrink-0 border-b border-[var(--color-border-light)]">
      {/* Left: Logo on mobile (sidebar logo is hidden).
          BUG-020: the previous attempt left `dark:brightness-0 dark:invert`
          on the <img>, which forced the dark-ink wordmark through an invert
          pipeline that produced unreadable, washed-out text against the dark
          surface. Swap to the dedicated `/dyia-logo-dark.png` asset (light
          wordmark on transparent background) when the resolved theme is
          dark; use the standard logo otherwise. No CSS filter needed. */}
      <div className="sm:hidden flex items-center">
        <img
          src={resolvedTheme === 'dark' ? '/dyia-logo-dark.png' : '/dyia-logo-full.png'}
          alt="dyia"
          className="h-5 opacity-90"
        />
      </div>
      <div className="hidden sm:block" />

      {/* Right: Utility actions */}
      <div className="flex items-center gap-1">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-all"
          aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {resolvedTheme === 'dark' ? (
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {/* Help - desktop only */}
        <a
          href="/support"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-all"
          aria-label="Help & Support"
          title="Help & Support"
        >
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </a>

        {/* Divider */}
        <div className="hidden sm:block w-px h-6 mx-1 bg-[var(--color-border)]" />

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="User menu"
            aria-expanded={menuOpen}
            aria-haspopup="true"
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-[var(--color-bg-hover)] transition-all"
          >
            {userImageUrl ? (
              <img src={userImageUrl} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-[var(--color-border-light)]" />
            ) : (
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center ring-2 ring-orange-500/20">
                <span className="text-xs text-white font-semibold">{initials}</span>
              </div>
            )}
            <svg className={`w-3.5 h-3.5 text-[var(--color-text-faint)] hidden sm:block transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border shadow-xl z-[80] overflow-hidden animate-slide-down"
                 style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
              {/* User info */}
              <div className="px-4 py-3.5 border-b" style={{ borderColor: 'var(--color-border-light)' }}>
                <div className="flex items-center gap-3">
                  {userImageUrl ? (
                    <img src={userImageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-sm text-white font-semibold">{initials}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {userName && (
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{userName}</p>
                    )}
                    <p className="text-xs text-[var(--color-text-muted)] truncate">{userEmail}</p>
                  </div>
                  {(() => {
                    // Display the plan the user actually has:
                    // - Pro trial   → PRO (orange)  (they're using Pro features)
                    // - Pro paid    → PRO (orange)
                    // - Basic paid  → BASIC (muted) — they have an active sub but not Pro
                    // - No sub      → FREE (muted)
                    const showPro = subscriptionTier === 'trial' || subscriptionTier === 'pro'
                    const showBasic = subscriptionTier === 'basic'
                    const label = showPro ? 'PRO' : showBasic ? 'BASIC' : 'FREE'
                    return (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        showPro
                          ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
                          : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-faint)]'
                      }`}>
                        {label}
                      </span>
                    )
                  })()}
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1.5">
                <a
                  href="/support"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <svg className="w-4 h-4 text-[var(--color-text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Help & Support
                </a>

                {!isDemoMode && (
                  <a
                    href="mailto:support@dyia.co"
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    <svg className="w-4 h-4 text-[var(--color-text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Contact Us
                  </a>
                )}
              </div>

              {/* Sign out */}
              <div className="border-t py-1.5" style={{ borderColor: 'var(--color-border-light)' }}>
                <button
                  onClick={() => { onLogout(); setMenuOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                  style={{ color: 'var(--color-danger)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-danger-bg)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
