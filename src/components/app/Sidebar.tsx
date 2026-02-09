'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useTheme } from '@/hooks/useTheme'
import type { LaunchpadItem } from '@/components/app/Launchpad'

type View = 'dashboard' | 'jobs' | 'quotes' | 'quoteBuilder' | 'followUps' | 'reports' | 'marketing' | 'customers' | 'massEmail' | 'assistant' | 'settings'

type SubscriptionTier = 'basic' | 'trial' | 'pro'

interface SidebarProps {
  currentView: View
  setCurrentView: (view: View) => void
  userEmail: string
  userName?: string
  userImageUrl?: string
  onLogout: () => void
  isPro?: boolean
  subscriptionTier?: SubscriptionTier
  trialDaysRemaining?: number
  launchpadItems?: LaunchpadItem[]
  isDemoMode?: boolean
}

// Clean SVG Icons
const Icons = {
  home: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  briefcase: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  document: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  bell: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  sparkles: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  dyia: (
    <img src="/dyia-agent.png" alt="Dyia AI" className="w-6 h-6 object-contain" />
  ),
  cog: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  chart: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  plus: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  megaphone: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  envelope: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  more: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  close: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  chevronDown: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  ),
}

// Grouped navigation structure
interface NavSection {
  label: string
  items: { id: View; icon: keyof typeof Icons; label: string; pro?: boolean }[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Work',
    items: [
      { id: 'dashboard', icon: 'home', label: 'Home' },
      { id: 'jobs', icon: 'briefcase', label: 'Jobs' },
      { id: 'quotes', icon: 'document', label: 'Quotes' },
      { id: 'followUps', icon: 'bell', label: 'Follow-ups' },
    ],
  },
  {
    label: 'Customers',
    items: [
      { id: 'customers', icon: 'users', label: 'Customers' },
      { id: 'massEmail', icon: 'envelope', label: 'Email Blast', pro: true },
    ],
  },
  {
    label: 'Insights',
    items: [
      { id: 'reports', icon: 'chart', label: 'Reports' },
      { id: 'marketing', icon: 'megaphone', label: 'Marketing', pro: true },
    ],
  },
]

// Mobile bottom nav items (visible without "More")
const MOBILE_PRIMARY: View[] = ['dashboard', 'jobs', 'quotes', 'customers']

function NavButton({ 
  id, icon, label, pro, isPro, isActive, onClick, animDelay 
}: { 
  id: View; icon: keyof typeof Icons; label: string; pro?: boolean; isPro: boolean; isActive: boolean; onClick: () => void; animDelay?: number 
}) {
  return (
    <button
      onClick={onClick}
      className={`nav-item-animated w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all duration-200 group ${
        isActive
          ? 'active bg-slate-800 text-white'
          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
      }`}
      style={animDelay !== undefined ? { animationDelay: `${animDelay}s` } : undefined}
    >
      <span className={`transition-all duration-200 flex-shrink-0 pointer-events-none ${isActive ? 'text-orange-400 scale-110' : 'group-hover:scale-110'}`}>
        {Icons[icon]}
      </span>
      <span className="sidebar-text text-sm truncate">{label}</span>
      {pro && !isPro && (
        <span className="sidebar-text ml-auto px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 flex-shrink-0">
          PRO
        </span>
      )}
    </button>
  )
}

export function Sidebar({ currentView, setCurrentView, userEmail, userName, userImageUrl, onLogout, isPro = false, subscriptionTier = 'basic', trialDaysRemaining = 0, launchpadItems, isDemoMode = false }: SidebarProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [createOpen, setCreateOpen] = useState(false)
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const createRef = useRef<HTMLDivElement>(null)

  // Close create dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setCreateOpen(false)
      }
    }
    if (createOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [createOpen])

  // Flat list of all nav items for convenience
  const allNavItems = NAV_SECTIONS.flatMap(s => s.items)
  let animIndex = 0

  return (
    <>
      <aside className="app-sidebar bg-slate-900">
        {/* Logo - hidden on mobile */}
        <div className="px-4 pt-4 pb-3 hidden sm:block">
          <Link href="/" className="flex items-center gap-2 group">
            <img
              src="/dyia-agent.png"
              alt="dyia"
              className="w-11 h-11 object-contain drop-shadow-[0_0_8px_rgba(249,115,22,0.3)] group-hover:drop-shadow-[0_0_12px_rgba(249,115,22,0.5)] transition-all"
            />
            <span className="text-2xl font-extrabold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent tracking-tight">dyia</span>
          </Link>
        </div>

        {/* Create Dropdown - hidden on mobile */}
        <div className="px-4 mb-3 hidden sm:block relative" ref={createRef}>
          <button
            onClick={() => setCreateOpen(!createOpen)}
            className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
          >
            <span className="flex items-center gap-2">
              {Icons.plus}
              <span className="sidebar-text">Create</span>
            </span>
            <span className={`sidebar-text transition-transform duration-200 ${createOpen ? 'rotate-180' : ''}`}>
              {Icons.chevronDown}
            </span>
          </button>
          {createOpen && (
            <div className="absolute left-4 right-4 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
              <button
                onClick={() => { setCurrentView('jobs'); setCreateOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              >
                {Icons.briefcase}
                <span>Log Job</span>
              </button>
              <button
                onClick={() => { setCurrentView('quoteBuilder'); setCreateOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              >
                {Icons.document}
                <span>New Quote</span>
              </button>
              <button
                onClick={() => { setCurrentView('customers'); setCreateOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              >
                {Icons.users}
                <span>Add Customer</span>
              </button>
            </div>
          )}
        </div>

        {/* Grouped Navigation - Desktop */}
        <nav className="sidebar-desktop-nav flex-1 px-3 py-1 overflow-y-auto hidden sm:block">
          {NAV_SECTIONS.map((section, sectionIdx) => (
            <div key={section.label} className={sectionIdx > 0 ? 'mt-4' : ''}>
              <div className="px-3 mb-1.5">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                  {section.label}
                </span>
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const idx = animIndex++
                  return (
                    <NavButton
                      key={item.id}
                      id={item.id}
                      icon={item.icon}
                      label={item.label}
                      pro={item.pro}
                      isPro={isPro}
                      isActive={currentView === item.id || (item.id === 'quotes' && currentView === 'quoteBuilder')}
                      onClick={() => setCurrentView(item.id)}
                      animDelay={idx * 0.04}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Mobile Bottom Nav */}
        <nav className="sidebar-mobile-nav sm:hidden flex-1 flex items-end">
          <div className="w-full flex items-center justify-around py-1">
            {MOBILE_PRIMARY.map((viewId) => {
              const item = allNavItems.find(i => i.id === viewId)!
              const isActive = currentView === item.id || (item.id === 'quotes' && currentView === 'quoteBuilder')
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-all ${
                    isActive ? 'text-orange-400' : 'text-slate-400'
                  }`}
                >
                  <span className={isActive ? 'scale-110' : ''}>{Icons[item.icon]}</span>
                  <span className="text-[10px]">{item.label}</span>
                </button>
              )
            })}
            {/* More button */}
            <button
              onClick={() => setMobileMoreOpen(true)}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-all ${
                !MOBILE_PRIMARY.includes(currentView) && currentView !== 'quoteBuilder' ? 'text-orange-400' : 'text-slate-400'
              }`}
            >
              <span>{Icons.more}</span>
              <span className="text-[10px]">More</span>
            </button>
          </div>
        </nav>

        {/* Footer - hidden on mobile */}
        <div className="p-3 border-t border-slate-800 hidden sm:block space-y-1">
          {/* Trial upgrade nudge */}
          {subscriptionTier === 'trial' && (
            <button
              onClick={() => setCurrentView('settings')}
              className="w-full flex items-center gap-2 px-3 py-2 mb-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/15 transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="sidebar-text text-xs font-medium truncate">
                {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} left in trial
              </span>
            </button>
          )}
          {subscriptionTier === 'basic' && (
            <button
              onClick={() => setCurrentView('settings')}
              className="w-full flex items-center gap-2 px-3 py-2 mb-1 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/15 transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span className="sidebar-text text-xs font-medium truncate">Upgrade to Pro</span>
            </button>
          )}

          {/* Settings */}
          <button
            onClick={() => setCurrentView('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
              currentView === 'settings'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
            }`}
            title="Settings"
          >
            <span className={`shrink-0 ${currentView === 'settings' ? 'text-orange-400' : ''}`}>
              {Icons.cog}
            </span>
            <span className="sidebar-text text-sm">Settings</span>
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-all"
            title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {resolvedTheme === 'dark' ? (
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
            <span className="sidebar-text text-sm">{resolvedTheme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>

          {/* User card */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer group"
               onClick={() => setCurrentView('settings')}
               title="Account settings"
          >
            {userImageUrl ? (
              <img src={userImageUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-slate-700 group-hover:ring-slate-600" />
            ) : (
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center shrink-0 ring-2 ring-slate-700 group-hover:ring-slate-600">
                <span className="text-sm text-white font-semibold">
                  {(userName || userEmail || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="sidebar-text flex-1 min-w-0">
              {userName && (
                <p className="text-sm font-medium text-slate-200 truncate leading-tight">{userName}</p>
              )}
              <p className={`${userName ? 'text-[11px]' : 'text-sm'} text-slate-400 truncate leading-tight`}>{userEmail}</p>
            </div>
            <span className={`sidebar-text shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold ${
              subscriptionTier === 'pro'
                ? 'bg-orange-500/20 text-orange-400'
                : subscriptionTier === 'trial'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-slate-700 text-slate-400'
            }`}>
              {subscriptionTier === 'pro' ? 'PRO' : subscriptionTier === 'trial' ? 'TRIAL' : 'FREE'}
            </span>
          </div>

          {/* Sign Out */}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-500 hover:text-red-400 hover:bg-slate-800/50 rounded-lg transition-all"
            title="Sign Out"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="sidebar-text text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile "More" Drawer */}
      {mobileMoreOpen && (
        <div className="fixed inset-0 z-[100] sm:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMoreOpen(false)}
          />
          {/* Drawer from bottom */}
          <div className="absolute bottom-0 left-0 right-0 bg-slate-900 rounded-t-2xl max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <span className="text-lg font-semibold text-white">Menu</span>
              <button 
                onClick={() => setMobileMoreOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                {Icons.close}
              </button>
            </div>

            {/* Quick actions */}
            <div className="px-4 py-3 border-b border-slate-800">
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => { setCurrentView('jobs'); setMobileMoreOpen(false) }}
                  className="flex flex-col items-center gap-1.5 py-3 bg-orange-500/10 rounded-xl text-orange-400"
                >
                  {Icons.briefcase}
                  <span className="text-xs font-medium">Log Job</span>
                </button>
                <button
                  onClick={() => { setCurrentView('quoteBuilder'); setMobileMoreOpen(false) }}
                  className="flex flex-col items-center gap-1.5 py-3 bg-orange-500/10 rounded-xl text-orange-400"
                >
                  {Icons.document}
                  <span className="text-xs font-medium">New Quote</span>
                </button>
                <button
                  onClick={() => { setCurrentView('customers'); setMobileMoreOpen(false) }}
                  className="flex flex-col items-center gap-1.5 py-3 bg-orange-500/10 rounded-xl text-orange-400"
                >
                  {Icons.users}
                  <span className="text-xs font-medium">Customer</span>
                </button>
              </div>
            </div>

            {/* All nav sections */}
            <div className="px-4 py-3">
              {NAV_SECTIONS.map((section) => (
                <div key={section.label} className="mb-4">
                  <div className="px-2 mb-2">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                      {section.label}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {section.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => { setCurrentView(item.id); setMobileMoreOpen(false) }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all ${
                          currentView === item.id
                            ? 'bg-slate-800 text-white'
                            : 'text-slate-300 hover:bg-slate-800/50'
                        }`}
                      >
                        <span className={currentView === item.id ? 'text-orange-400' : 'text-slate-400'}>
                          {Icons[item.icon]}
                        </span>
                        <span className="text-sm">{item.label}</span>
                        {item.pro && !isPro && (
                          <span className="ml-auto px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 flex-shrink-0">
                            PRO
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Settings in mobile drawer */}
              <div className="border-t border-slate-800 pt-3 mt-2">
                <button
                  onClick={() => { setCurrentView('settings'); setMobileMoreOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all ${
                    currentView === 'settings' ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  <span className={currentView === 'settings' ? 'text-orange-400' : 'text-slate-400'}>
                    {Icons.cog}
                  </span>
                  <span className="text-sm">Settings</span>
                </button>
                <button
                  onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                  className="w-full flex items-center gap-3 px-3 py-3 text-slate-300 hover:bg-slate-800/50 rounded-lg transition-all"
                >
                  {resolvedTheme === 'dark' ? (
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                  <span className="text-sm">{resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                </button>
                <button
                  onClick={() => { onLogout(); setMobileMoreOpen(false) }}
                  className="w-full flex items-center gap-3 px-3 py-3 text-red-400 hover:bg-slate-800/50 rounded-lg transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="text-sm">Sign Out</span>
                </button>
              </div>
            </div>

            {/* Bottom safe area */}
            <div className="h-6" />
          </div>
        </div>
      )}
    </>
  )
}
