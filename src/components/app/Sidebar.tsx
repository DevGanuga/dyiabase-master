'use client'

import type { AppJob } from '@/types/database'
import Link from 'next/link'
import Image from 'next/image'

type View = 'dashboard' | 'jobs' | 'quotes' | 'quoteBuilder' | 'settings'

interface SidebarProps {
  currentView: View
  setCurrentView: (view: View) => void
  userEmail: string
  onLogout: () => void
  jobs: AppJob[]
  showSuccess: (message: string) => void
}

const NAV_ITEMS: { id: View; icon: string; label: string }[] = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'jobs', icon: '💼', label: 'Jobs' },
  { id: 'quotes', icon: '📋', label: 'Quotes' },
  { id: 'quoteBuilder', icon: '✏️', label: 'Quote Builder' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
]

export function Sidebar({ currentView, setCurrentView, userEmail, onLogout, jobs, showSuccess }: SidebarProps) {
  
  const exportData = () => {
    if (jobs.length === 0) {
      alert('No jobs to export')
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

    showSuccess('📥 CSV exported successfully!')
  }

  return (
    <aside className="app-sidebar">
      {/* Logo Header */}
      <div className="sidebar-header p-6 border-b border-slate-100">
        <Link href="/" className="flex items-center gap-3 group">
          <Image 
            src="/image-removebg-preview.png" 
            alt="dyia logo" 
            width={44} 
            height={44}
            className="group-hover:scale-105 transition-transform"
          />
          <div className="sidebar-logo-text">
            <h1 className="text-lg font-bold text-slate-900">dyia</h1>
            <p className="text-xs text-slate-500 font-medium">Your day, decoded</p>
          </div>
        </Link>
      </div>

      {/* User Info */}
      <div className="sidebar-user px-4 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 bg-gradient-to-br from-orange-100 to-amber-100 rounded-lg flex items-center justify-center text-lg">
            👤
          </div>
          <div className="sidebar-text flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{userEmail}</p>
            <p className="text-xs text-slate-500">Free Account</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 overflow-y-auto">
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`app-nav-btn ${currentView === item.id ? 'active' : ''}`}
            >
              <span className="text-xl w-7 text-center">{item.icon}</span>
              <span className="sidebar-text text-sm">{item.label}</span>
              {currentView === item.id && (
                <span className="sidebar-text ml-auto w-1.5 h-1.5 bg-orange-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Footer Actions */}
      <div className="sidebar-footer p-4 border-t border-slate-100 space-y-2">
        <button
          onClick={exportData}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-xl font-medium transition-all text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span className="sidebar-text">Export CSV</span>
        </button>
        
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl font-medium transition-all text-sm"
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
