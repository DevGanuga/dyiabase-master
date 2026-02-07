'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import type { AppJob, AppQuote, AppCustomer } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useConfirm } from '@/components/providers/ConfirmProvider'

interface CustomersProps {
  jobs: AppJob[]
  quotes?: AppQuote[]
  isPro?: boolean
  onNavigate: (view: string) => void
  onCreateQuote: (job: AppJob | null) => void
  showSuccess: (message: string) => void
  isDemoMode?: boolean
}

interface CustomerFormData {
  name: string
  email: string
  phone: string
  address: string
  notes: string
  tags: string[]
}

const emptyForm: CustomerFormData = {
  name: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
  tags: [],
}

type SortOption = 'name' | 'revenue' | 'recent' | 'jobs'

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

function formatRelativeDate(dateStr: string | undefined): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}yr ago`
}

function formatFriendlyDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Determine if a customer needs attention (no contact in 30+ days with past revenue)
function needsAttention(customer: AppCustomer): boolean {
  if (!customer.lastJobDate) return false
  if ((customer.totalRevenue || 0) === 0) return false
  const lastJob = new Date(customer.lastJobDate)
  const daysSince = Math.floor((Date.now() - lastJob.getTime()) / (1000 * 60 * 60 * 24))
  return daysSince >= 30 && (customer.jobCount || 0) >= 2
}

export function Customers({ jobs, quotes = [], isPro = false, onNavigate, onCreateQuote, showSuccess, isDemoMode = false }: CustomersProps) {
  const { confirm } = useConfirm()
  const [customers, setCustomers] = useState<AppCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCustomer, setSelectedCustomer] = useState<AppCustomer | null>(null)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<AppCustomer | null>(null)
  const [formData, setFormData] = useState<CustomerFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('revenue')

  // Compute job/quote stats per customer
  const jobsByCustomer = useMemo(() => {
    const map: Record<string, AppJob[]> = {}
    for (const job of jobs) {
      const name = (job.customerName || '').trim().toLowerCase()
      if (!name || name === 'unknown') continue
      if (!map[name]) map[name] = []
      map[name].push(job)
    }
    return map
  }, [jobs])

  const quotesByCustomer = useMemo(() => {
    const map: Record<string, AppQuote[]> = {}
    for (const quote of quotes) {
      const name = (quote.customer?.name || '').trim().toLowerCase()
      if (!name) continue
      if (!map[name]) map[name] = []
      map[name].push(quote)
    }
    return map
  }, [quotes])

  // Load customers from database
  const loadCustomers = useCallback(async () => {
    if (isDemoMode) {
      const byName: Record<string, { jobs: AppJob[]; totalRevenue: number }> = {}
      for (const job of jobs) {
        const name = (job.customerName || '').trim() || 'Unknown'
        if (name === 'Unknown') continue
        if (!byName[name]) byName[name] = { jobs: [], totalRevenue: 0 }
        byName[name].jobs.push(job)
        byName[name].totalRevenue += job.revenue || 0
      }
      const derived: AppCustomer[] = Object.entries(byName).map(([name, data]) => ({
        id: `demo-${name}`,
        name,
        email: null,
        phone: null,
        address: null,
        notes: null,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        totalRevenue: data.totalRevenue,
        jobCount: data.jobs.length,
        quoteCount: 0,
        lastJobDate: data.jobs.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]?.date,
      }))
      setCustomers(derived.sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0)))
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('dyia_customers')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error

      const mapped: AppCustomer[] = (data || []).map((c) => {
        const nameLower = c.name.toLowerCase()
        const cJobs = jobsByCustomer[nameLower] || []
        const cQuotes = quotesByCustomer[nameLower] || []
        const totalRevenue = cJobs.reduce((sum, j) => sum + (j.revenue || 0), 0)
        const sortedJobs = [...cJobs].sort((a, b) => (b.date || '').localeCompare(a.date || ''))

        return {
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          address: c.address,
          notes: c.notes,
          tags: (c.tags || []) as string[],
          createdAt: new Date(c.created_at),
          updatedAt: new Date(c.updated_at),
          totalRevenue,
          jobCount: cJobs.length,
          quoteCount: cQuotes.length,
          lastJobDate: sortedJobs[0]?.date,
        }
      })

      setCustomers(mapped)
    } catch (err) {
      console.error('Error loading customers:', err)
      // Fallback: derive from jobs
      const byName: Record<string, { jobs: AppJob[]; totalRevenue: number }> = {}
      for (const job of jobs) {
        const name = (job.customerName || '').trim() || 'Unknown'
        if (name === 'Unknown') continue
        if (!byName[name]) byName[name] = { jobs: [], totalRevenue: 0 }
        byName[name].jobs.push(job)
        byName[name].totalRevenue += job.revenue || 0
      }
      const derived: AppCustomer[] = Object.entries(byName).map(([name, data]) => ({
        id: `derived-${name}`,
        name,
        email: null,
        phone: null,
        address: null,
        notes: null,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        totalRevenue: data.totalRevenue,
        jobCount: data.jobs.length,
        quoteCount: 0,
        lastJobDate: data.jobs.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]?.date,
      }))
      setCustomers(derived.sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0)))
    } finally {
      setLoading(false)
    }
  }, [isDemoMode, jobs, jobsByCustomer, quotesByCustomer])

  useEffect(() => { loadCustomers() }, [loadCustomers])

  const handleSave = async () => {
    if (!formData.name.trim()) return
    setSaving(true)

    try {
      if (isDemoMode) {
        showSuccess(editingCustomer ? 'Customer updated!' : 'Customer added!')
        setShowForm(false)
        setEditingCustomer(null)
        setFormData(emptyForm)
        setSaving(false)
        return
      }

      const supabase = createClient()

      if (editingCustomer && !editingCustomer.id.startsWith('derived-') && !editingCustomer.id.startsWith('demo-')) {
        const { error } = await supabase
          .from('dyia_customers')
          .update({
            name: formData.name.trim(),
            email: formData.email.trim() || null,
            phone: formData.phone.trim() || null,
            address: formData.address.trim() || null,
            notes: formData.notes.trim() || null,
            tags: formData.tags,
          })
          .eq('id', editingCustomer.id)

        if (error) throw error
        showSuccess('Customer updated!')
      } else {
        const { error } = await supabase
          .from('dyia_customers')
          .insert({
            name: formData.name.trim(),
            email: formData.email.trim() || null,
            phone: formData.phone.trim() || null,
            address: formData.address.trim() || null,
            notes: formData.notes.trim() || null,
            tags: formData.tags,
          })

        if (error) throw error
        showSuccess('Customer added!')
      }

      setShowForm(false)
      setEditingCustomer(null)
      setFormData(emptyForm)
      await loadCustomers()
    } catch (err) {
      console.error('Error saving customer:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (customer: AppCustomer) => {
    if (isDemoMode || customer.id.startsWith('derived-') || customer.id.startsWith('demo-')) return
    try {
      const supabase = createClient()
      const { error } = await supabase.from('dyia_customers').delete().eq('id', customer.id)
      if (error) throw error
      showSuccess('Customer removed')
      setSelectedCustomer(null)
      await loadCustomers()
    } catch (err) {
      console.error('Error deleting customer:', err)
    }
  }

  const openEditForm = (customer: AppCustomer) => {
    setEditingCustomer(customer)
    setFormData({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      notes: customer.notes || '',
      tags: customer.tags || [],
    })
    setShowForm(true)
  }

  const openNewForm = () => {
    setEditingCustomer(null)
    setFormData(emptyForm)
    setShowForm(true)
  }

  const addTag = () => {
    const t = tagInput.trim()
    if (t && !formData.tags.includes(t)) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, t] }))
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))
  }

  const filtered = useMemo(() => {
    let list = customers
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.tags.some(t => t.toLowerCase().includes(q))
      )
    }

    // Sort
    const sorted = [...list]
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'revenue':
        sorted.sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
        break
      case 'recent':
        sorted.sort((a, b) => {
          const aDate = a.lastJobDate || '0000'
          const bDate = b.lastJobDate || '0000'
          return bDate.localeCompare(aDate)
        })
        break
      case 'jobs':
        sorted.sort((a, b) => (b.jobCount || 0) - (a.jobCount || 0))
        break
    }
    return sorted
  }, [customers, search, sortBy])

  // Get job history for a customer
  const getJobHistory = (customer: AppCustomer) => {
    const nameLower = customer.name.toLowerCase()
    return (jobsByCustomer[nameLower] || []).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }

  // Get quote history for a customer
  const getQuoteHistory = (customer: AppCustomer) => {
    const nameLower = customer.name.toLowerCase()
    return (quotesByCustomer[nameLower] || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  }

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalRevenue = customers.reduce((s, c) => s + (c.totalRevenue || 0), 0)
    const repeatCustomers = customers.filter(c => (c.jobCount || 0) >= 2).length
    const attentionCount = customers.filter(needsAttention).length
    return { totalRevenue, repeatCustomers, attentionCount }
  }, [customers])

  if (loading) {
    return (
      <div className="space-y-8 animate-view-enter">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">Customers</h1>
        </div>
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  // ================ ADD/EDIT FORM ================
  if (showForm) {
    return (
      <div className="space-y-5 animate-view-enter">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowForm(false); setEditingCustomer(null); setFormData(emptyForm) }}
            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-subtle)] transition-colors"
          >
            <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
            {editingCustomer ? 'Edit Customer' : 'Add Customer'}
          </h1>
        </div>

        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 sm:p-6 space-y-4 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="app-input w-full"
              placeholder="Customer name"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="app-input w-full"
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="app-input w-full"
                placeholder="customer@email.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="app-input w-full"
              placeholder="123 Main St, City, State"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="app-input w-full min-h-[80px] resize-y"
              placeholder="Gate code, pet info, special instructions…"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Tags</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full text-xs">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-red-500">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                className="app-input flex-1"
                placeholder="Add tag (e.g. VIP, Residential)"
              />
              <button type="button" onClick={addTag} className="app-btn-secondary text-sm px-3">Add</button>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={!formData.name.trim() || saving}
              className="app-btn-primary flex-1"
            >
              {saving ? 'Saving…' : editingCustomer ? 'Save Changes' : 'Add Customer'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingCustomer(null); setFormData(emptyForm) }}
              className="app-btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ================ CUSTOMER DETAIL ================
  if (selectedCustomer) {
    const customerJobs = getJobHistory(selectedCustomer)
    const customerQuotes = getQuoteHistory(selectedCustomer)
    const isRepeat = customerJobs.length >= 2
    const attention = needsAttention(selectedCustomer)
    const avgJobValue = customerJobs.length > 0
      ? customerJobs.reduce((s, j) => s + (j.revenue || 0), 0) / customerJobs.length
      : 0

    return (
      <div className="space-y-5 animate-view-enter">
        {/* Back nav */}
        <button
          onClick={() => setSelectedCustomer(null)}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-orange-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          All Customers
        </button>

        {/* Contact Info Card */}
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-orange-500/10 rounded-full flex items-center justify-center shrink-0">
                <span className="text-xl font-bold text-orange-500">
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{selectedCustomer.name}</h2>
                  {isRepeat && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full font-medium">Repeat</span>
                  )}
                  {attention && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full font-medium">Re-engage</span>
                  )}
                </div>

                {/* Contact actions */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedCustomer.phone && (
                    <>
                      <a
                        href={`tel:${selectedCustomer.phone}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        Call
                      </a>
                      <a
                        href={`sms:${selectedCustomer.phone}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg text-xs font-medium hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Text
                      </a>
                    </>
                  )}
                  {selectedCustomer.email && (
                    <a
                      href={`mailto:${selectedCustomer.email}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Email
                    </a>
                  )}
                </div>

                {/* Address */}
                {selectedCustomer.address && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-2">{selectedCustomer.address}</p>
                )}

                {selectedCustomer.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedCustomer.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => openEditForm(selectedCustomer)} className="app-btn-secondary text-sm">
                Edit
              </button>
              <button
                onClick={() => { onCreateQuote(buildMinimalJob(selectedCustomer.name)); setSelectedCustomer(null) }}
                className="app-btn-primary text-sm"
              >
                New Quote
              </button>
            </div>
          </div>

          {selectedCustomer.notes && (
            <div className="mt-4 px-4 py-3 bg-[var(--color-bg-secondary)] rounded-lg">
              <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{selectedCustomer.notes}</p>
            </div>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(selectedCustomer.totalRevenue || 0)}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Lifetime Value</p>
          </div>
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{customerJobs.length}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Jobs</p>
          </div>
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{formatCurrency(avgJobValue)}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Avg Job Value</p>
          </div>
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-4">
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{formatRelativeDate(selectedCustomer.lastJobDate)}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Last Active</p>
          </div>
        </div>

        {/* Pro insight */}
        {isPro && isRepeat && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-3">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {attention
                ? `Last job was ${formatRelativeDate(selectedCustomer.lastJobDate).toLowerCase()}. This repeat customer (${formatCurrency(selectedCustomer.totalRevenue || 0)} lifetime) might be worth a follow-up or seasonal offer.`
                : `Repeat customer — ${formatCurrency(selectedCustomer.totalRevenue || 0)} over ${customerJobs.length} jobs. Consider requesting a review.`
              }
            </p>
          </div>
        )}

        {/* Job History */}
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Job History</h3>
            <span className="text-xs text-[var(--color-text-muted)]">{customerJobs.length} job{customerJobs.length !== 1 ? 's' : ''}</span>
          </div>
          {customerJobs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[var(--color-text-muted)] text-center">No jobs logged for this customer yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {customerJobs.map(job => {
                const jobExpenses = (job.labor || 0) + (job.gas || 0) + (job.dumpFee || 0) + (job.dumpsterRental || 0) + (job.additionalExpense || 0)
                const profit = (job.revenue || 0) - jobExpenses
                return (
                  <li key={job.id} className="px-5 py-3 flex items-center justify-between hover:bg-[var(--color-bg-subtle)] transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${profit >= 0 ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                        {job.revenue > 0 ? `${Math.round((profit / job.revenue) * 100)}%` : '—'}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm text-[var(--color-text-primary)]">{formatFriendlyDate(job.date)}</span>
                        {job.source && <span className="text-[10px] ml-2 px-1.5 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full">{job.source}</span>}
                        {job.notes && <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate max-w-[250px]">{job.notes}</p>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">{formatCurrency(job.revenue)}</span>
                      <p className="text-[10px] text-[var(--color-text-faint)]">{formatCurrency(profit)} profit</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Quote History */}
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Quote History</h3>
            <span className="text-xs text-[var(--color-text-muted)]">{customerQuotes.length} quote{customerQuotes.length !== 1 ? 's' : ''}</span>
          </div>
          {customerQuotes.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-sm text-[var(--color-text-muted)] mb-2">No quotes yet.</p>
              <button
                onClick={() => { onCreateQuote(buildMinimalJob(selectedCustomer.name)); setSelectedCustomer(null) }}
                className="text-sm text-orange-600 dark:text-orange-400 hover:underline font-medium"
              >
                Create a quote for {selectedCustomer.name}
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {customerQuotes.map(quote => (
                <li key={quote.id} className="px-5 py-3 flex items-center justify-between hover:bg-[var(--color-bg-subtle)] transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {new Date(quote.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      quote.status === 'accepted' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                      quote.status === 'sent' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                      quote.status === 'declined' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                      'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                    }`}>
                      {quote.status}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    {quote.estimateRange
                      ? `${formatCurrency(quote.estimateRange.low)} – ${formatCurrency(quote.estimateRange.high)}`
                      : formatCurrency(quote.total)
                    }
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Danger zone */}
        {!isDemoMode && !selectedCustomer.id.startsWith('derived-') && !selectedCustomer.id.startsWith('demo-') && (
          <div className="pt-2 border-t border-[var(--color-border)]">
            <button
              onClick={async () => {
                const confirmed = await confirm({
                  title: 'Delete Customer',
                  message: `Are you sure you want to delete ${selectedCustomer.name}? This cannot be undone.`,
                  confirmLabel: 'Delete',
                  variant: 'danger',
                })
                if (confirmed) handleDelete(selectedCustomer)
              }}
              className="text-sm text-red-500 hover:text-red-600 hover:underline"
            >
              Delete customer
            </button>
          </div>
        )}
      </div>
    )
  }

  // ================ CUSTOMER LIST ================
  return (
    <div className="space-y-5 animate-view-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">Customers</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {customers.length} customer{customers.length !== 1 ? 's' : ''}
            {summaryStats.totalRevenue > 0 && <> · {formatCurrency(summaryStats.totalRevenue)} total revenue</>}
          </p>
        </div>
        <button onClick={openNewForm} className="app-btn-primary flex items-center gap-2 shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Customer
        </button>
      </div>

      {/* Summary badges */}
      {customers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg text-xs">
            <span className="text-[var(--color-text-muted)]">Repeat:</span>
            <span className="font-semibold text-[var(--color-text-primary)]">{summaryStats.repeatCustomers}</span>
          </div>
          {summaryStats.attentionCount > 0 && (
            <button
              onClick={() => { setSortBy('recent'); setSearch('') }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
            >
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
              {summaryStats.attentionCount} need{summaryStats.attentionCount === 1 ? 's' : ''} follow-up
            </button>
          )}
        </div>
      )}

      {/* Search + Sort */}
      {customers.length > 0 && (
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              placeholder="Search by name, email, phone, or tag…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="app-input w-full pl-9"
            />
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg text-sm min-w-0"
          >
            <option value="revenue">Top Revenue</option>
            <option value="recent">Most Recent</option>
            <option value="jobs">Most Jobs</option>
            <option value="name">A → Z</option>
          </select>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-8 text-center">
          {customers.length === 0 ? (
            <>
              <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">Build Your Customer Database</h3>
              <p className="text-sm text-[var(--color-text-muted)] mb-4 max-w-sm mx-auto">
                Add customers to track contact info, job history, and lifetime value. Customers are auto-added when you log jobs.
              </p>
              <button onClick={openNewForm} className="app-btn-primary">
                Add Your First Customer
              </button>
            </>
          ) : (
            <p className="text-[var(--color-text-muted)]">No customers matching &ldquo;{search}&rdquo;</p>
          )}
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map(customer => {
            const attention = needsAttention(customer)
            const isRepeat = (customer.jobCount || 0) >= 2
            return (
              <div
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                className={`bg-[var(--color-bg-card)] border rounded-xl px-4 sm:px-5 py-3 sm:py-4 cursor-pointer hover:border-orange-500/50 transition-colors group ${attention ? 'border-amber-300 dark:border-amber-700/50' : 'border-[var(--color-border)]'}`}
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-orange-500">
                      {customer.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[var(--color-text-primary)] truncate">{customer.name}</span>
                      {isRepeat && (
                        <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full">Repeat</span>
                      )}
                      {attention && (
                        <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full">Re-engage</span>
                      )}
                      {customer.tags.length > 0 && (
                        <div className="hidden sm:flex gap-1">
                          {customer.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="px-1.5 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full text-[10px]">
                              {tag}
                            </span>
                          ))}
                          {customer.tags.length > 2 && (
                            <span className="text-[10px] text-[var(--color-text-muted)]">+{customer.tags.length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--color-text-muted)] mt-0.5">
                      {customer.lastJobDate && <span>Last job: {formatRelativeDate(customer.lastJobDate)}</span>}
                      {customer.phone && <span className="hidden sm:inline">{customer.phone}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">{formatCurrency(customer.totalRevenue || 0)}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {customer.jobCount || 0} job{(customer.jobCount || 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-orange-500 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
