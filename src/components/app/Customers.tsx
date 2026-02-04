'use client'

import { useMemo, useState } from 'react'
import type { AppJob } from '@/types/database'
import { formatCurrency } from '@/lib/utils'

interface CustomerRow {
  name: string
  jobs: AppJob[]
  totalRevenue: number
}

interface CustomersProps {
  jobs: AppJob[]
  isPro?: boolean
  onNavigate: (view: string) => void
  onCreateQuote: (job: AppJob | null) => void
  showSuccess: (message: string) => void
}

function buildMinimalJob(customerName: string): AppJob {
  const d = new Date()
  return {
    id: '',
    date: d.toISOString().split('T')[0],
    customerName,
    source: '',
    revenue: 0,
    labor: 0,
    gas: 0,
    dumpFee: 0,
    dumpsterRental: 0,
    additionalExpense: 0,
    numWorkers: 0,
    costPerWorker: 0,
    notes: '',
  }
}

export function Customers({ jobs, isPro = false, onNavigate, onCreateQuote }: CustomersProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null)
  const [search, setSearch] = useState('')

  const customers = useMemo(() => {
    const byName: Record<string, { jobs: AppJob[]; totalRevenue: number }> = {}
    for (const job of jobs) {
      const name = (job.customerName || '').trim() || 'Unknown'
      if (!byName[name]) {
        byName[name] = { jobs: [], totalRevenue: 0 }
      }
      byName[name].jobs.push(job)
      byName[name].totalRevenue += job.revenue || 0
    }
    return Object.entries(byName)
      .map(([name, { jobs: j, totalRevenue }]) => ({
        name,
        jobs: j.sort((a, b) => (b.date || '').localeCompare(a.date || '')),
        totalRevenue,
      }))
      .filter(c => c.name !== 'Unknown')
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
  }, [jobs])

  const filtered = useMemo(() => {
    if (!search.trim()) return customers
    const q = search.trim().toLowerCase()
    return customers.filter(c => c.name.toLowerCase().includes(q))
  }, [customers, search])

  return (
    <div className="space-y-8 animate-view-enter">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">Customers</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Everyone you’ve done work for — tap for history or start a new quote</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="search"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="app-input flex-1 max-w-sm"
        />
      </div>

      {selectedCustomer ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setSelectedCustomer(null)}
            className="text-sm text-orange-600 dark:text-orange-400 hover:underline"
          >
            ← Back to list
          </button>
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{selectedCustomer.name}</h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {selectedCustomer.jobs.length} job{selectedCustomer.jobs.length !== 1 ? 's' : ''} · {formatCurrency(selectedCustomer.totalRevenue)} total
            </p>
            {isPro && selectedCustomer.jobs.length > 0 && (
              <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg px-3 py-2 mt-3">
                This customer has spent {formatCurrency(selectedCustomer.totalRevenue)} over {selectedCustomer.jobs.length} job{selectedCustomer.jobs.length !== 1 ? 's' : ''} — consider offering a loyalty discount.
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                onCreateQuote(buildMinimalJob(selectedCustomer.name))
                setSelectedCustomer(null)
              }}
              className="mt-4 app-btn-primary"
            >
              New quote for this customer
            </button>
            <ul className="mt-6 space-y-2">
              {selectedCustomer.jobs.map((job) => (
                <li
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-[var(--color-border)] last:border-0"
                >
                  <span className="text-sm text-[var(--color-text-secondary)]">{job.date}</span>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">{formatCurrency(job.revenue)}</span>
                  {job.notes && <span className="text-xs text-[var(--color-text-muted)] w-full">{job.notes}</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <>
          {filtered.length === 0 ? (
            <p className="text-[var(--color-text-muted)]">No customers yet. Log jobs to see them here.</p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((row) => (
                <li
                  key={row.name}
                  className="flex flex-wrap items-center justify-between gap-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-4 py-3 cursor-pointer hover:border-orange-500/50 transition-colors"
                  onClick={() => setSelectedCustomer(row)}
                >
                  <span className="font-medium text-[var(--color-text-primary)]">{row.name}</span>
                  <span className="text-sm text-[var(--color-text-muted)]">
                    {row.jobs.length} job{row.jobs.length !== 1 ? 's' : ''} · {formatCurrency(row.totalRevenue)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onCreateQuote(buildMinimalJob(row.name))
                    }}
                    className="text-xs text-orange-600 dark:text-orange-400 hover:underline"
                  >
                    New quote
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
