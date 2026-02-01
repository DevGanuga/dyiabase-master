'use client'

import type { AppJob, AppQuote } from '@/types/database'
import Link from 'next/link'
import Image from 'next/image'
import { useTheme } from '@/hooks/useTheme'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { Launchpad, type LaunchpadItem } from '@/components/app/Launchpad'

type View = 'dashboard' | 'jobs' | 'quotes' | 'quoteBuilder' | 'followUps' | 'reports' | 'assistant' | 'settings'

interface LaunchpadData {
  onboardingCompleted: boolean
  onboardingSkipped: boolean
  jobsCount: number
  quotesCount: number
  templatesCount: number
  onReopenOnboarding: () => void
}

interface SidebarProps {
  currentView: View
  setCurrentView: (view: View) => void
  userEmail: string
  onLogout: () => void
  jobs: AppJob[]
  quotes?: AppQuote[]
  showSuccess: (message: string) => void
  isPro?: boolean
  launchpadData?: LaunchpadData
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
  pencil: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
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
}

const NAV_ITEMS: { id: View; icon: keyof typeof Icons; label: string; pro?: boolean; mobileHide?: boolean }[] = [
  { id: 'dashboard', icon: 'home', label: 'Home' },
  { id: 'jobs', icon: 'briefcase', label: 'Jobs' },
  { id: 'quotes', icon: 'document', label: 'Quotes' },
  { id: 'followUps', icon: 'bell', label: 'Follow-ups', mobileHide: true },
  { id: 'reports', icon: 'chart', label: 'Reports', mobileHide: true },
  { id: 'assistant', icon: 'sparkles', label: 'Ask Dyia', pro: true },
]

export function Sidebar({ currentView, setCurrentView, userEmail, onLogout, jobs, quotes = [], showSuccess, isPro = false, launchpadData, isDemoMode = false }: SidebarProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const { alert } = useConfirm()

  // Build launchpad items
  const launchpadItems: LaunchpadItem[] = launchpadData ? [
    {
      id: 'onboarding',
      label: 'Complete setup',
      completed: launchpadData.onboardingCompleted,
      action: launchpadData.onboardingCompleted ? undefined : launchpadData.onReopenOnboarding,
    },
    {
      id: 'first-job',
      label: 'Log your first job',
      completed: launchpadData.jobsCount > 0,
      action: launchpadData.jobsCount > 0 ? undefined : () => setCurrentView('jobs'),
    },
    {
      id: 'first-quote',
      label: 'Create a quote',
      completed: launchpadData.quotesCount > 0,
      action: launchpadData.quotesCount > 0 ? undefined : () => setCurrentView('quoteBuilder'),
    },
    {
      id: 'first-template',
      label: 'Save a price template',
      completed: launchpadData.templatesCount > 0,
      action: launchpadData.templatesCount > 0 ? undefined : () => setCurrentView('settings'),
    },
  ] : []

  const showLaunchpad = launchpadData && !isDemoMode && launchpadItems.some(item => !item.completed)

  const exportData = async () => {
    if (jobs.length === 0) {
      await alert({ title: 'No Data', message: 'No jobs to export.', variant: 'info' })
      return
    }

    const headers = ['Date', 'Customer', 'Source', 'Revenue', 'Labor', 'Gas', 'Dump Fee', 'Dumpster Rental', 'Other Expense', 'Total Expenses', 'Profit']
    
    const rows = jobs.map(job => {
      const totalExpenses = (job.labor || 0) + (job.gas || 0) + (job.dumpFee || 0) + 
                           (job.dumpsterRental || 0) + (job.additionalExpense || 0)
      const profit = (job.revenue || 0) - totalExpenses

      return [
        job.date,
        `"${(job.customerName || '').replace(/"/g, '""')}"`,
        `"${(job.source || '').replace(/"/g, '""')}"`,
        job.revenue || 0,
        job.labor || 0,
        job.gas || 0,
        job.dumpFee || 0,
        job.dumpsterRental || 0,
        job.additionalExpense || 0,
        totalExpenses,
        profit
      ].join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `dyia-jobs-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)

    showSuccess('CSV exported successfully!')
  }

  return (
    <aside className="app-sidebar bg-slate-900">
      {/* Logo - hidden on mobile */}
      <div className="p-5 hidden sm:block">
        <Link href="/" className="block">
          <Image 
            src="/dyia-logo-full.png" 
            alt="dyia" 
            width={80} 
            height={28}
            className="brightness-0 invert opacity-90 hover:opacity-100 transition-opacity"
          />
        </Link>
      </div>

      {/* Create Button - hidden on mobile */}
      <div className="px-4 mb-2 hidden sm:block">
        <button
          onClick={() => setCurrentView('quoteBuilder')}
          className="w-full flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
        >
          {Icons.plus}
          <span className="sidebar-text">Create</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item, index) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              data-mobile-hide={item.mobileHide ? "true" : undefined}
              className={`nav-item-animated w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 group ${
                currentView === item.id 
                  ? 'active bg-slate-800 text-white' 
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              } ${item.mobileHide ? 'sm:flex hidden' : ''}`}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <span className={`transition-all duration-200 flex-shrink-0 ${currentView === item.id ? 'text-orange-400 scale-110' : 'group-hover:scale-110'}`}>
                {Icons[item.icon]}
              </span>
              <span className="sidebar-text text-sm truncate">{item.label}</span>
              {item.pro && !isPro && (
                <span className="sidebar-text ml-auto px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 animate-pulse-soft flex-shrink-0">
                  PRO
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Launchpad - Getting Started Checklist */}
      {showLaunchpad && (
        <div className="hidden sm:block">
          <Launchpad items={launchpadItems} />
        </div>
      )}

      {/* Footer - hidden on mobile */}
      <div className="p-4 border-t border-slate-800 hidden sm:block">
        {/* Settings */}
        <button
          onClick={() => setCurrentView('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all mb-2 ${
            currentView === 'settings'
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
          }`}
          title="Settings"
        >
          <span className={currentView === 'settings' ? 'text-orange-400' : ''}>
            {Icons.cog}
          </span>
          <span className="sidebar-text text-sm">Settings</span>
        </button>

        {/* User */}
        <div className="flex items-center gap-3 px-2 mb-3">
          <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
            <span className="text-sm text-slate-300 font-medium">
              {userEmail.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="sidebar-text flex-1 min-w-0">
            <p className="text-sm text-slate-300 truncate">{userEmail}</p>
          </div>
        </div>

        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-all text-xs mb-2"
          title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {resolvedTheme === 'dark' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
          <span className="sidebar-text">{resolvedTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-all text-xs"
          title="Sign Out"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="sidebar-text">Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
