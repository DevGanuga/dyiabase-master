'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppJob } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { useConfirm } from '@/components/providers/ConfirmProvider'

interface JobsProps {
  jobs: AppJob[]
  setJobs: (jobs: AppJob[]) => void
  userId: string
  selectedMonth: Date
  setSelectedMonth: (date: Date) => void
  showSuccess: (message: string) => void
}

interface TempCustomer {
  id: number
  name: string
  source: string
  revenue: number
}

interface TempExpenses {
  labor: number
  gas: number
  dumpFee: number
  dumpsterRental: number
  additional: number
}

const MARKETING_SOURCES = ['Google', 'Facebook', 'Referral', 'Repeat Customer', 'Yelp', 'Craigslist', 'Instagram', 'Nextdoor', 'Thumbtack', 'HomeAdvisor', 'Website', 'Other']

export function Jobs({ jobs, setJobs, userId, selectedMonth, setSelectedMonth, showSuccess }: JobsProps) {
  const [editingJob, setEditingJob] = useState<AppJob | 'new' | null>(null)
  const [tempCustomers, setTempCustomers] = useState<TempCustomer[]>([])
  const [tempExpenses, setTempExpenses] = useState<TempExpenses>({ labor: 0, gas: 0, dumpFee: 0, dumpsterRental: 0, additional: 0 })
  const [tempDate, setTempDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string>('all')

  const supabase = createClient()
  const { confirm, alert } = useConfirm()

  // Filter jobs by month
  const monthJobs = useMemo(() => {
    return jobs.filter(job => {
      const jobDate = new Date(job.date)
      return jobDate.getMonth() === selectedMonth.getMonth() &&
             jobDate.getFullYear() === selectedMonth.getFullYear()
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [jobs, selectedMonth])

  // Apply search and source filters
  const filteredJobs = useMemo(() => {
    return monthJobs.filter(job => {
      const matchesSearch = searchQuery === '' || 
        job.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (job.source && job.source.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesSource = sourceFilter === 'all' || job.source === sourceFilter
      return matchesSearch && matchesSource
    })
  }, [monthJobs, searchQuery, sourceFilter])

  // Calculate stats
  const stats = useMemo(() => {
    const totalRevenue = monthJobs.reduce((sum, j) => sum + (j.revenue || 0), 0)
    const totalExpenses = monthJobs.reduce((sum, j) => 
      sum + (j.labor || 0) + (j.gas || 0) + (j.dumpFee || 0) + 
      (j.dumpsterRental || 0) + (j.additionalExpense || 0), 0)
    const profit = totalRevenue - totalExpenses
    const avgRevenue = monthJobs.length > 0 ? totalRevenue / monthJobs.length : 0
    
    // Get unique sources
    const sources = [...new Set(monthJobs.map(j => j.source).filter(Boolean))]
    
    return { totalRevenue, totalExpenses, profit, avgRevenue, sources }
  }, [monthJobs])

  const monthName = selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const monthValue = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`

  const navigateMonth = (dir: number) => {
    const newDate = new Date(selectedMonth)
    newDate.setMonth(newDate.getMonth() + dir)
    setSelectedMonth(newDate)
  }

  const startAddJob = () => {
    setEditingJob('new')
    setTempCustomers([{ id: Date.now(), name: '', source: '', revenue: 0 }])
    setTempExpenses({ labor: 0, gas: 0, dumpFee: 0, dumpsterRental: 0, additional: 0 })
    setTempDate(new Date().toISOString().split('T')[0])
  }

  const startEditJob = (job: AppJob) => {
    setEditingJob(job)
    setTempCustomers([{ id: Date.now(), name: job.customerName, source: job.source || '', revenue: job.revenue }])
    setTempExpenses({
      labor: job.labor,
      gas: job.gas,
      dumpFee: job.dumpFee,
      dumpsterRental: job.dumpsterRental,
      additional: job.additionalExpense
    })
    setTempDate(job.date)
  }

  const cancelForm = () => {
    setEditingJob(null)
    setTempCustomers([])
  }

  const addCustomerRow = () => {
    setTempCustomers([...tempCustomers, { id: Date.now(), name: '', source: '', revenue: 0 }])
  }

  const removeCustomerRow = (index: number) => {
    if (tempCustomers.length > 1) {
      setTempCustomers(tempCustomers.filter((_, i) => i !== index))
    }
  }

  const updateCustomer = (index: number, field: keyof TempCustomer, value: string | number) => {
    const updated = [...tempCustomers]
    updated[index] = { ...updated[index], [field]: value }
    setTempCustomers(updated)
  }

  const saveJobs = async () => {
    const validCustomers = tempCustomers.filter(c => c.name.trim() && c.revenue > 0)
    if (validCustomers.length === 0) {
      await alert({ title: 'Missing Info', message: 'Please add at least one customer with a name and revenue greater than 0.', variant: 'warning' })
      return
    }

    setSaving(true)

    try {
      const isEditing = editingJob && editingJob !== 'new'

      if (isEditing) {
        const customer = validCustomers[0]
        const dbJob = {
          date: tempDate,
          customer_name: customer.name.trim(),
          source: customer.source || null,
          revenue: Math.max(0, customer.revenue),
          labor: Math.max(0, tempExpenses.labor),
          gas: Math.max(0, tempExpenses.gas),
          dump_fee: Math.max(0, tempExpenses.dumpFee),
          dumpster_rental: Math.max(0, tempExpenses.dumpsterRental),
          additional_expense: Math.max(0, tempExpenses.additional),
        }

        const { error } = await supabase
          .from('dyia_jobs')
          .update(dbJob)
          .eq('id', (editingJob as AppJob).id)
          .eq('user_id', userId)

        if (error) throw error

        setJobs(jobs.map(j => j.id === (editingJob as AppJob).id ? {
          ...j,
          date: tempDate,
          customerName: customer.name.trim(),
          source: customer.source,
          revenue: customer.revenue,
          labor: tempExpenses.labor,
          gas: tempExpenses.gas,
          dumpFee: tempExpenses.dumpFee,
          dumpsterRental: tempExpenses.dumpsterRental,
          additionalExpense: tempExpenses.additional,
        } : j))
        showSuccess('Job updated!')
      } else {
        const newJobs: AppJob[] = []
        for (const customer of validCustomers) {
          const dbJob = {
            user_id: userId,
            date: tempDate,
            customer_name: customer.name.trim(),
            source: customer.source || null,
            revenue: Math.max(0, customer.revenue),
            labor: Math.max(0, tempExpenses.labor / validCustomers.length),
            gas: Math.max(0, tempExpenses.gas / validCustomers.length),
            dump_fee: Math.max(0, tempExpenses.dumpFee / validCustomers.length),
            dumpster_rental: Math.max(0, tempExpenses.dumpsterRental / validCustomers.length),
            additional_expense: Math.max(0, tempExpenses.additional / validCustomers.length),
          }

          const { data, error } = await supabase
            .from('dyia_jobs')
            .insert(dbJob)
            .select()
            .single()

          if (error) throw error

          newJobs.push({
            id: data.id,
            date: tempDate,
            customerName: customer.name.trim(),
            source: customer.source,
            revenue: customer.revenue,
            labor: tempExpenses.labor / validCustomers.length,
            gas: tempExpenses.gas / validCustomers.length,
            dumpFee: tempExpenses.dumpFee / validCustomers.length,
            dumpsterRental: tempExpenses.dumpsterRental / validCustomers.length,
            additionalExpense: tempExpenses.additional / validCustomers.length,
            numWorkers: 1,
            costPerWorker: 0,
          })
        }

        setJobs([...newJobs, ...jobs])
        showSuccess(`${validCustomers.length} job${validCustomers.length === 1 ? '' : 's'} saved!`)
      }

      cancelForm()
    } catch (error) {
      console.error('Error saving jobs:', error)
      await alert({ title: 'Error', message: 'Error saving jobs.', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const deleteJob = async (id: string) => {
    const ok = await confirm({ title: 'Delete Job', message: 'Are you sure you want to delete this job?', confirmLabel: 'Delete', variant: 'danger' })
    if (!ok) return

    try {
      const { error } = await supabase
        .from('dyia_jobs')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error

      setJobs(jobs.filter(j => j.id !== id))
      showSuccess('Job deleted')
    } catch (error) {
      console.error('Error deleting job:', error)
      await alert({ title: 'Error', message: 'Error deleting job.', variant: 'error' })
    }
  }

  const totalExpenses = Object.values(tempExpenses).reduce((sum, e) => sum + (e || 0), 0)
  const expensePerCustomer = tempCustomers.length > 0 ? totalExpenses / tempCustomers.length : 0

  // Form View
  if (editingJob) {
    const isEditing = editingJob !== 'new'

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{isEditing ? 'Edit Job' : 'Log Jobs'}</h1>
            <p className="text-[var(--color-text-muted)]">{isEditing ? 'Update job details' : 'Log one or multiple customers from the same trip'}</p>
          </div>
          <button onClick={cancelForm} className="px-4 py-2 text-slate-600 hover:text-[var(--color-text-primary)]">
            Cancel
          </button>
        </div>

        {/* Job Date */}
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">Job Date</label>
          <input
            type="date"
            value={tempDate}
            onChange={(e) => setTempDate(e.target.value)}
            className="px-4 py-2.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>

        {/* Customers */}
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-[var(--color-text-primary)]">
              Customers <span className="text-[var(--color-text-faint)] font-normal">({tempCustomers.length})</span>
            </h3>
            {!isEditing && (
              <button 
                onClick={addCustomerRow} 
                className="text-sm text-orange-600 hover:text-orange-700 font-medium"
              >
                + Add Another
              </button>
            )}
          </div>

          <div className="space-y-4">
            {tempCustomers.map((customer, index) => (
              <div 
                key={customer.id} 
                className="relative bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded-xl p-5"
              >
                {!isEditing && tempCustomers.length > 1 && (
                  <button
                    onClick={() => removeCustomerRow(index)}
                    className="absolute top-3 right-3 w-7 h-7 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg text-sm flex items-center justify-center"
                  >
                    ×
                  </button>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Customer Name *</label>
                    <input
                      type="text"
                      value={customer.name}
                      onChange={(e) => updateCustomer(index, 'name', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Revenue *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]">$</span>
                      <input
                        type="number"
                        value={customer.revenue || ''}
                        onChange={(e) => updateCustomer(index, 'revenue', Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full px-4 py-2.5 pl-8 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        placeholder="500"
                        min="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Lead Source</label>
                    <select
                      value={customer.source}
                      onChange={(e) => updateCustomer(index, 'source', e.target.value)}
                      className="w-full px-4 py-2.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    >
                      <option value="">Select source</option>
                      {MARKETING_SOURCES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5">
          <h3 className="font-semibold text-[var(--color-text-primary)] mb-4">
            {isEditing ? 'Expenses' : 'Shared Expenses'}
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { key: 'labor', label: 'Labor' },
              { key: 'gas', label: 'Gas' },
              { key: 'dumpFee', label: 'Dump Fee' },
              { key: 'dumpsterRental', label: 'Dumpster' },
              { key: 'additional', label: 'Other' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]">$</span>
                  <input
                    type="number"
                    value={tempExpenses[key as keyof TempExpenses] || ''}
                    onChange={(e) => setTempExpenses({ ...tempExpenses, [key]: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full px-4 py-2.5 pl-7 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    min="0"
                  />
                </div>
              </div>
            ))}
          </div>

          {!isEditing && tempCustomers.length > 1 && totalExpenses > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-4">
              <p className="text-sm text-blue-800">
                <strong>Expense Split:</strong> {formatCurrency(totalExpenses)} ÷ {tempCustomers.length} = <strong>{formatCurrency(expensePerCustomer)}</strong> per customer
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button onClick={cancelForm} className="px-5 py-2.5 border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-bg-subtle)] font-medium">
            Cancel
          </button>
          <button 
            onClick={saveJobs} 
            disabled={saving} 
            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>Save {tempCustomers.length > 1 ? `${tempCustomers.length} Jobs` : 'Job'}</>
            )}
          </button>
        </div>
      </div>
    )
  }

  // List View
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Jobs</h1>
          <p className="text-[var(--color-text-muted)]">{monthName}</p>
        </div>
        <button 
          onClick={startAddJob} 
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Log Job
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
          <p className="text-sm text-[var(--color-text-muted)]">Jobs</p>
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">{monthJobs.length}</p>
        </div>
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
          <p className="text-sm text-[var(--color-text-muted)]">Revenue</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</p>
        </div>
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
          <p className="text-sm text-[var(--color-text-muted)]">Expenses</p>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(stats.totalExpenses)}</p>
        </div>
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
          <p className="text-sm text-[var(--color-text-muted)]">Profit</p>
          <p className={`text-2xl font-bold ${stats.profit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
            {formatCurrency(stats.profit)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Month Navigation */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigateMonth(-1)} 
            className="p-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <input
            type="month"
            value={monthValue}
            onChange={(e) => {
              const [year, month] = e.target.value.split('-')
              setSelectedMonth(new Date(parseInt(year), parseInt(month) - 1, 1))
            }}
            className="px-3 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg font-medium text-sm"
          />
          <button 
            onClick={() => navigateMonth(1)} 
            className="p-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button 
            onClick={() => setSelectedMonth(new Date())} 
            className="px-3 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)] font-medium text-sm"
          >
            Today
          </button>
        </div>

        {/* Search & Filter */}
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search jobs..."
              className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
          {stats.sources.length > 0 && (
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg text-sm"
            >
              <option value="all">All sources</option>
              {stats.sources.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Jobs List */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        {filteredJobs.length === 0 ? (
          <div className="text-center py-12 px-6">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[var(--color-text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              {searchQuery || sourceFilter !== 'all' ? 'No matching jobs' : 'No jobs yet'}
            </h3>
            <p className="text-[var(--color-text-muted)] mb-4">
              {searchQuery || sourceFilter !== 'all' 
                ? 'Try adjusting your filters' 
                : `Start tracking by logging your first job for ${monthName}`}
            </p>
            {!searchQuery && sourceFilter === 'all' && (
              <button onClick={startAddJob} className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Log Your First Job
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredJobs.map(job => {
              const totalExpenses = (job.labor || 0) + (job.gas || 0) + (job.dumpFee || 0) +
                                   (job.dumpsterRental || 0) + (job.additionalExpense || 0)
              const profit = (job.revenue || 0) - totalExpenses
              const margin = job.revenue > 0 ? Math.round((profit / job.revenue) * 100) : 0

              return (
                <div key={job.id} className="flex items-center justify-between p-4 hover:bg-[var(--color-bg-subtle)] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${profit >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-[var(--color-text-primary)]">{job.customerName}</p>
                      <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                        <span>{new Date(job.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        {job.source && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="text-orange-600">{job.source}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="font-semibold text-green-600">{formatCurrency(job.revenue)}</p>
                      <p className="text-xs text-[var(--color-text-faint)]">{margin}% margin</p>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => startEditJob(job)} 
                        className="p-2 text-[var(--color-text-faint)] hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => deleteJob(job.id)} 
                        className="p-2 text-[var(--color-text-faint)] hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
