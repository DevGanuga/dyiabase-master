'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppJob } from '@/types/database'
import { formatCurrency } from '@/lib/utils'

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

const MARKETING_SOURCES = ['Google', 'Facebook', 'Referral', 'Repeat Customer', 'Yelp', 'Craigslist', 'Instagram', 'Nextdoor', 'Other']

export function Jobs({ jobs, setJobs, userId, selectedMonth, setSelectedMonth, showSuccess }: JobsProps) {
  const [editingJob, setEditingJob] = useState<AppJob | 'new' | null>(null)
  const [tempCustomers, setTempCustomers] = useState<TempCustomer[]>([])
  const [tempExpenses, setTempExpenses] = useState<TempExpenses>({ labor: 0, gas: 0, dumpFee: 0, dumpsterRental: 0, additional: 0 })
  const [tempDate, setTempDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  const monthJobs = jobs.filter(job => {
    const jobDate = new Date(job.date)
    return jobDate.getMonth() === selectedMonth.getMonth() &&
           jobDate.getFullYear() === selectedMonth.getFullYear()
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

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
      alert('Please add at least one customer with a name and revenue greater than 0')
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
          .from('junkprofit_jobs')
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
            .from('junkprofit_jobs')
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
      }

      cancelForm()
      showSuccess(`✅ ${validCustomers.length} job${validCustomers.length === 1 ? '' : 's'} saved!`)
    } catch (error) {
      console.error('Error saving jobs:', error)
      alert('Error saving jobs')
    } finally {
      setSaving(false)
    }
  }

  const deleteJob = async (id: string) => {
    if (!confirm('Delete this job?')) return

    try {
      const { error } = await supabase
        .from('junkprofit_jobs')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error

      setJobs(jobs.filter(j => j.id !== id))
      showSuccess('🗑️ Job deleted')
    } catch (error) {
      console.error('Error deleting job:', error)
      alert('Error deleting job')
    }
  }

  const totalExpenses = Object.values(tempExpenses).reduce((sum, e) => sum + (e || 0), 0)
  const expensePerCustomer = tempCustomers.length > 0 ? totalExpenses / tempCustomers.length : 0

  // Form View
  if (editingJob) {
    const isEditing = editingJob !== 'new'

    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">{isEditing ? 'Edit Job' : 'Add Jobs'}</h1>
            <p className="page-subtitle">{isEditing ? 'Update job details' : 'Log one or multiple customers from the same trip'}</p>
          </div>
          <button onClick={cancelForm} className="app-btn-secondary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
        </div>

        {/* Job Date */}
        <div className="app-card mb-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">📅</span>
            <h3 className="font-semibold text-slate-900">Job Date</h3>
          </div>
          <input
            type="date"
            value={tempDate}
            onChange={(e) => setTempDate(e.target.value)}
            className="app-input max-w-xs"
          />
        </div>

        {/* Customers */}
        <div className="app-card mb-5">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">👥</span>
              <h3 className="font-semibold text-slate-900">
                Customers <span className="text-slate-400 font-normal">({tempCustomers.length})</span>
              </h3>
            </div>
            {!isEditing && (
              <button onClick={addCustomerRow} className="app-btn-ghost text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Customer
              </button>
            )}
          </div>

          <div className="space-y-4">
            {tempCustomers.map((customer, index) => (
              <div 
                key={customer.id} 
                className="relative bg-slate-50 border border-slate-200 rounded-xl p-5"
              >
                {!isEditing && tempCustomers.length > 1 && (
                  <button
                    onClick={() => removeCustomerRow(index)}
                    className="absolute top-3 right-3 w-7 h-7 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg text-sm flex items-center justify-center transition"
                    title="Remove customer"
                  >
                    ✕
                  </button>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="app-label">Customer Name *</label>
                    <input
                      type="text"
                      value={customer.name}
                      onChange={(e) => updateCustomer(index, 'name', e.target.value)}
                      className="app-input"
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label className="app-label">Revenue *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <input
                        type="number"
                        value={customer.revenue || ''}
                        onChange={(e) => updateCustomer(index, 'revenue', Math.max(0, parseFloat(e.target.value) || 0))}
                        className="app-input pl-8"
                        placeholder="500"
                        min="0"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mt-4">
                  <label className="app-label">How did they find you?</label>
                  <select
                    value={customer.source}
                    onChange={(e) => updateCustomer(index, 'source', e.target.value)}
                    className="app-select"
                  >
                    <option value="">Select source (optional)</option>
                    {MARKETING_SOURCES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expenses */}
        <div className="app-card mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">💰</span>
            <h3 className="font-semibold text-slate-900">
              {isEditing ? 'Expenses' : 'Shared Expenses'}
            </h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { key: 'labor', label: 'Labor' },
              { key: 'gas', label: 'Gas' },
              { key: 'dumpFee', label: 'Dump Fee' },
              { key: 'dumpsterRental', label: 'Dumpster' },
              { key: 'additional', label: 'Other' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="app-label">{label}</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input
                    type="number"
                    value={tempExpenses[key as keyof TempExpenses] || ''}
                    onChange={(e) => setTempExpenses({ ...tempExpenses, [key]: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="app-input pl-8"
                    min="0"
                  />
                </div>
              </div>
            ))}
          </div>

          {!isEditing && tempCustomers.length > 1 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-5">
              <p className="text-sm text-blue-800">
                <strong>💡 Expense Split:</strong> {formatCurrency(totalExpenses)} ÷ {tempCustomers.length} customers = <strong>{formatCurrency(expensePerCustomer)}</strong> each
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button onClick={cancelForm} className="app-btn-secondary">Cancel</button>
          <button onClick={saveJobs} disabled={saving} className="app-btn-primary">
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save {tempCustomers.length > 1 ? `${tempCustomers.length} Jobs` : 'Job'}
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  // List View
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Jobs</h1>
          <p className="page-subtitle">{monthJobs.length} job{monthJobs.length !== 1 ? 's' : ''} in {monthName}</p>
        </div>
        <button onClick={startAddJob} className="app-btn-primary">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Jobs
        </button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center gap-3 mb-8">
        <button 
          onClick={() => navigateMonth(-1)} 
          className="p-2.5 bg-white border border-slate-200 rounded-xl hover:border-emerald-500 hover:text-emerald-600 transition-all"
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
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-semibold"
        />
        <button 
          onClick={() => navigateMonth(1)} 
          className="p-2.5 bg-white border border-slate-200 rounded-xl hover:border-emerald-500 hover:text-emerald-600 transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button 
          onClick={() => setSelectedMonth(new Date())} 
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl hover:border-emerald-500 hover:text-emerald-600 font-medium text-sm transition-all"
        >
          Today
        </button>
      </div>

      {/* Jobs Table/List */}
      <div className="app-card p-0 overflow-hidden">
        {monthJobs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💼</div>
            <h3 className="empty-state-title">No jobs yet</h3>
            <p className="empty-state-desc">Start tracking by adding your first job for {monthName}.</p>
            <button onClick={startAddJob} className="app-btn-primary">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Your First Job
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="app-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Expenses</th>
                  <th className="text-right">Profit</th>
                  <th className="text-right w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {monthJobs.map(job => {
                  const totalExpenses = (job.labor || 0) + (job.gas || 0) + (job.dumpFee || 0) +
                                       (job.dumpsterRental || 0) + (job.additionalExpense || 0)
                  const profit = (job.revenue || 0) - totalExpenses
                  const profitMargin = job.revenue > 0 ? (profit / job.revenue) * 100 : 0

                  return (
                    <tr key={job.id}>
                      <td className="font-medium text-slate-900">{job.date}</td>
                      <td>
                        <div className="font-medium text-slate-900">{job.customerName}</div>
                        {job.source && (
                          <span className="badge badge-info mt-1">{job.source}</span>
                        )}
                      </td>
                      <td className="text-right font-semibold text-emerald-600">
                        {formatCurrency(job.revenue || 0)}
                      </td>
                      <td className="text-right text-slate-600">
                        {formatCurrency(totalExpenses)}
                      </td>
                      <td className="text-right">
                        <span className={`font-semibold ${profit >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                          {formatCurrency(profit)}
                        </span>
                        <div className="text-xs text-slate-400">{Math.round(profitMargin)}% margin</div>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => startEditJob(job)} 
                            className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => deleteJob(job.id)} 
                            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
