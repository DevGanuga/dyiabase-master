'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppQuote, AppPriceTemplate, AppJob, QuoteStatus } from '@/types/database'
import { formatCurrency, compressImage } from '@/lib/utils'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { useCustomerAutocomplete } from '@/hooks/useCustomerAutocomplete'

interface QuoteBuilderProps {
  quotes: AppQuote[]
  setQuotes: (quotes: AppQuote[]) => void
  userId: string
  selectedJob: AppJob | null
  customerNames?: string[]
  onBack: () => void
  showSuccess: (message: string) => void
}

const PRICE_FIELDS = [
  'minimumFee', 'quarterLoad', 'halfLoad', 'threeQuarterLoad', 'fullLoad',
  'trampoline', 'shed', 'fridge', 'furniture', 'hotTub', 'customDemo',
  'laborFee', 'heavyItemFee', 'distanceFee', 'timeFee', 'hazardFee', 'customFee'
]

const VOLUME_FIELDS = [
  { field: 'minimumFee', label: 'Minimum Fee' },
  { field: 'quarterLoad', label: '1/4 Load' },
  { field: 'halfLoad', label: '1/2 Load' },
  { field: 'threeQuarterLoad', label: '3/4 Load' },
  { field: 'fullLoad', label: 'Full Load' },
]

const SPECIALTY_FIELDS = [
  { field: 'trampoline', label: 'Trampoline' },
  { field: 'shed', label: 'Shed Demo' },
  { field: 'fridge', label: 'Fridge' },
  { field: 'furniture', label: 'Furniture' },
  { field: 'hotTub', label: 'Hot Tub' },
  { field: 'customDemo', label: 'Custom Demo' },
]

const FEE_FIELDS = [
  { field: 'laborFee', label: 'Labor' },
  { field: 'heavyItemFee', label: 'Heavy Item' },
  { field: 'distanceFee', label: 'Distance' },
  { field: 'timeFee', label: 'Extra Time' },
  { field: 'hazardFee', label: 'Hazard' },
  { field: 'customFee', label: 'Custom' },
]

// Collapsible section component
function Section({ title, icon, badge, defaultOpen = true, children }: {
  title: string
  icon: string
  badge?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="app-card mb-4 sm:mb-5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 sm:p-5 text-left hover:bg-[var(--color-bg-subtle)] transition-colors"
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-lg sm:text-xl">{icon}</span>
          <h3 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)]">{title}</h3>
          {badge && <span className="text-[10px] sm:text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full">{badge}</span>}
        </div>
        <svg className={`w-4 h-4 text-[var(--color-text-faint)] transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 sm:px-5 pb-4 sm:pb-5">{children}</div>}
    </div>
  )
}

export function QuoteBuilder({ quotes, setQuotes, userId, selectedJob, customerNames = [], onBack, showSuccess }: QuoteBuilderProps) {
  const { nameList, findByName } = useCustomerAutocomplete(customerNames)

  const [customer, setCustomer] = useState(() => ({
    name: selectedJob?.customerName || '',
    phone: '',
    email: '',
    address: '',
    jobDescription: selectedJob?.notes || ''
  }))

  const handleCustomerNameChange = useCallback((name: string) => {
    setCustomer(prev => {
      const match = findByName(name)
      if (match) {
        return {
          ...prev,
          name,
          phone: match.phone || prev.phone,
          email: match.email || prev.email,
          address: match.address || prev.address,
        }
      }
      return { ...prev, name }
    })
  }, [findByName])
  const [pricing, setPricing] = useState<Record<string, number>>({})
  const [numLoads, setNumLoads] = useState(0)
  const [pricePerLoad, setPricePerLoad] = useState(0)
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null])
  const [total, setTotal] = useState(0)
  const [saving, setSaving] = useState(false)
  const [defaultTemplate, setDefaultTemplate] = useState<AppPriceTemplate | null>(null)
  const [templateLoaded, setTemplateLoaded] = useState(false)
  const [showSummary, setShowSummary] = useState(false)

  const supabase = useMemo(() => createClient(), [])
  const { alert } = useConfirm()

  // Load default price template on mount
  useEffect(() => {
    const loadDefaultTemplate = async () => {
      if (!userId || templateLoaded) return

      try {
        const { data, error } = await supabase
          .from('dyia_price_templates')
          .select('*')
          .eq('user_id', userId)
          .eq('is_default', true)
          .single()

        if (error && error.code !== 'PGRST116') throw error

        if (data) {
          const template: AppPriceTemplate = {
            id: data.id,
            name: data.name,
            isDefault: data.is_default,
            prices: data.prices
          }
          setDefaultTemplate(template)
          
          const templatePricing: Record<string, number> = {}
          if (template.prices.minimumFee) templatePricing.minimumFee = template.prices.minimumFee
          if (template.prices.quarterLoad) templatePricing.quarterLoad = template.prices.quarterLoad
          if (template.prices.halfLoad) templatePricing.halfLoad = template.prices.halfLoad
          if (template.prices.threeQuarterLoad) templatePricing.threeQuarterLoad = template.prices.threeQuarterLoad
          if (template.prices.fullLoad) templatePricing.fullLoad = template.prices.fullLoad
          if (template.prices.surcharges?.trampoline) templatePricing.trampoline = template.prices.surcharges.trampoline
          if (template.prices.surcharges?.hotTub) templatePricing.hotTub = template.prices.surcharges.hotTub
          
          setPricing(templatePricing)
        }
      } catch (error) {
        console.error('Error loading default template:', error)
      } finally {
        setTemplateLoaded(true)
      }
    }

    loadDefaultTemplate()
  }, [userId, supabase, templateLoaded])

  const calculateTotal = useCallback(() => {
    const multipleLoadsTotal = numLoads * pricePerLoad
    let sum = multipleLoadsTotal
    PRICE_FIELDS.forEach(field => {
      sum += Math.max(0, pricing[field] || 0)
    })
    setTotal(sum)
  }, [numLoads, pricePerLoad, pricing])

  useEffect(() => {
    calculateTotal()
  }, [calculateTotal])

  const handlePricingChange = (field: string, value: number) => {
    setPricing(prev => ({ ...prev, [field]: Math.max(0, value) }))
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string
      const compressed = await compressImage(dataUrl, 800, 0.7)
      const newPhotos = [...photos]
      newPhotos[index] = compressed
      setPhotos(newPhotos)
    }
    reader.readAsDataURL(file)
  }

  const removeImage = (index: number) => {
    const newPhotos = [...photos]
    newPhotos[index] = null
    setPhotos(newPhotos)
  }

  // Build line items for summary
  const lineItems = useMemo(() => {
    const items: { label: string; amount: number }[] = []
    
    // Volume
    VOLUME_FIELDS.forEach(({ field, label }) => {
      const val = pricing[field] || 0
      if (val > 0) items.push({ label, amount: val })
    })
    
    // Multiple loads
    if (numLoads > 0 && pricePerLoad > 0) {
      items.push({ label: `${numLoads} Full Loads × ${formatCurrency(pricePerLoad)}`, amount: numLoads * pricePerLoad })
    }
    
    // Specialty
    SPECIALTY_FIELDS.forEach(({ field, label }) => {
      const val = pricing[field] || 0
      if (val > 0) items.push({ label, amount: val })
    })
    
    // Fees
    FEE_FIELDS.forEach(({ field, label }) => {
      const val = pricing[field] || 0
      if (val > 0) items.push({ label: `${label} Fee`, amount: val })
    })
    
    return items
  }, [pricing, numLoads, pricePerLoad])

  const saveQuote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customer.name.trim()) {
      await alert({ title: 'Missing Name', message: 'Please enter a customer name.', variant: 'warning' })
      return
    }

    if (total === 0) {
      await alert({ title: 'No Pricing', message: 'Please add at least one price before generating a quote.', variant: 'warning' })
      return
    }

    // Show summary first for confirmation
    if (!showSummary) {
      setShowSummary(true)
      return
    }

    setSaving(true)

    try {
      const multipleLoadsTotal = numLoads * pricePerLoad
      const rangeLow = Math.floor(total * 0.9)
      const rangeHigh = Math.ceil(total * 1.1)

      const quoteData = {
        user_id: userId,
        job_id: selectedJob?.id || null,
        customer_name: customer.name,
        customer_phone: customer.phone || null,
        customer_email: customer.email || null,
        customer_address: customer.address || null,
        job_description: customer.jobDescription || null,
        pricing: {
          ...pricing,
          multipleLoads: { numLoads, pricePerLoad, total: multipleLoadsTotal }
        },
        estimate_low: rangeLow,
        estimate_high: rangeHigh,
        total,
        status: 'draft',
        photo_urls: photos.filter(p => p) as string[]
      }

      const { data, error } = await supabase
        .from('dyia_quotes')
        .insert(quoteData)
        .select()
        .single()

      if (error) {
        console.error('Supabase insert error:', error.message, error.code, error.details, error.hint)
        throw error
      }

      // Auto-create a follow-up for this quote
      try {
        await supabase
          .from('dyia_follow_ups')
          .insert({
            user_id: userId,
            quote_id: data.id,
            status: 'pending',
            contact_count: 0
          })
      } catch (followUpError) {
        console.error('Error creating follow-up:', followUpError)
        // Non-fatal: quote was saved, follow-up creation failed
      }

      const newQuote: AppQuote = {
        id: data.id,
        jobId: selectedJob?.id,
        createdAt: new Date(data.created_at).getTime(),
        customer: {
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          address: customer.address,
          jobDescription: customer.jobDescription
        },
        pricing: quoteData.pricing,
        photos: quoteData.photo_urls,
        estimateRange: { low: rangeLow, high: rangeHigh },
        total,
        status: 'draft' as QuoteStatus
      }

      setQuotes([newQuote, ...quotes])
      showSuccess(`Quote for ${customer.name} — ${formatCurrency(rangeLow)}–${formatCurrency(rangeHigh)}`)
      setTimeout(onBack, 500)
    } catch (error) {
      console.error('Error saving quote:', error)
      await alert({ title: 'Error', message: 'Error saving quote.', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const rangeLow = Math.floor(total * 0.9)
  const rangeHigh = Math.ceil(total * 1.1)
  const photoCount = photos.filter(Boolean).length
  const hasSpecialty = SPECIALTY_FIELDS.some(({ field }) => (pricing[field] || 0) > 0)
  const hasFees = FEE_FIELDS.some(({ field }) => (pricing[field] || 0) > 0)

  // ======== SUMMARY / CONFIRMATION VIEW ========
  if (showSummary) {
    return (
      <div className="animate-fade-in max-w-lg mx-auto">
        <div className="page-header">
          <div>
            <h1 className="page-title text-xl sm:text-2xl">Review Quote</h1>
            <p className="page-subtitle text-sm">Confirm before generating</p>
          </div>
          <button onClick={() => setShowSummary(false)} className="app-btn-secondary text-sm px-4 py-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Edit
          </button>
        </div>

        {/* Customer */}
        <div className="app-card p-5 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-orange-500">{customer.name.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <p className="font-semibold text-[var(--color-text-primary)]">{customer.name}</p>
              <div className="flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
                {customer.phone && <span>{customer.phone}</span>}
                {customer.email && <span>{customer.email}</span>}
              </div>
            </div>
          </div>
          {customer.address && <p className="text-xs text-[var(--color-text-muted)] mt-1">{customer.address}</p>}
          {customer.jobDescription && (
            <p className="text-sm text-[var(--color-text-secondary)] mt-2 border-t border-[var(--color-border)] pt-2">{customer.jobDescription}</p>
          )}
        </div>

        {/* Line Items */}
        <div className="app-card p-5 mb-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Pricing Breakdown</h3>
          <div className="space-y-2">
            {lineItems.map((item, i) => (
              <div key={i} className="flex justify-between items-center py-1.5">
                <span className="text-sm text-[var(--color-text-secondary)]">{item.label}</span>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-[var(--color-border)] mt-3 pt-3 flex justify-between items-center">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">Total</span>
            <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Estimate Range */}
        <div className="app-card p-5 mb-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-2 border-orange-500">
          <div className="text-center">
            <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">Estimate Range (±10%)</p>
            <p className="text-2xl sm:text-3xl font-bold text-orange-700 dark:text-orange-300">
              {formatCurrency(rangeLow)} – {formatCurrency(rangeHigh)}
            </p>
          </div>
        </div>

        {/* Photos */}
        {photoCount > 0 && (
          <div className="app-card p-5 mb-4">
            <p className="text-xs text-[var(--color-text-muted)] mb-2">{photoCount} photo{photoCount !== 1 ? 's' : ''} attached</p>
            <div className="flex gap-2">
              {photos.filter(Boolean).map((photo, i) => (
                <img key={i} src={photo!} alt={`Photo ${i + 1}`} className="w-16 h-16 object-cover rounded-lg" />
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <form onSubmit={saveQuote}>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
            <button type="button" onClick={() => setShowSummary(false)} className="app-btn-secondary w-full sm:w-auto py-3">
              Back to Edit
            </button>
            <button type="submit" disabled={saving} className="app-btn-primary w-full sm:flex-1 py-3">
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Generate Quote
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    )
  }

  // ======== BUILDER VIEW ========
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title text-xl sm:text-2xl">Quote Builder</h1>
          <p className="page-subtitle text-sm">
            {selectedJob 
              ? <>For <span className="text-orange-600 dark:text-orange-400 font-medium">{selectedJob.customerName}</span></>
              : 'Build a professional estimate'
            }
          </p>
        </div>
        <button onClick={onBack} className="app-btn-secondary text-sm px-4 py-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="hidden sm:inline">Back</span>
        </button>
      </div>

      <form onSubmit={saveQuote}>
        {/* Customer Information — always open */}
        <div className="app-card mb-4 sm:mb-5 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">👤</span>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Customer</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="app-label">Name *</label>
              <input
                list="quote-customer-names"
                type="text"
                value={customer.name}
                onChange={(e) => handleCustomerNameChange(e.target.value)}
                className="app-input"
                placeholder="John Smith"
                required
                autoFocus
              />
              <datalist id="quote-customer-names">
                {nameList.map(n => <option key={n} value={n} />)}
              </datalist>
            </div>
            <div>
              <label className="app-label">Phone</label>
              <input
                type="tel"
                value={customer.phone}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                className="app-input"
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className="app-label">Email</label>
              <input
                type="email"
                value={customer.email}
                onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                className="app-input"
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label className="app-label">Address</label>
              <input
                type="text"
                value={customer.address}
                onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                className="app-input"
                placeholder="123 Main St, City, State"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="app-label">Job Description</label>
            <textarea
              value={customer.jobDescription}
              onChange={(e) => setCustomer({ ...customer, jobDescription: e.target.value })}
              className="app-input resize-none"
              rows={2}
              placeholder="Describe the work to be done..."
            />
          </div>
        </div>

        {/* Volume-Based Pricing — always open */}
        <Section title="Volume-Based Pricing" icon="📦" badge={defaultTemplate ? `Using: ${defaultTemplate.name}` : undefined}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {VOLUME_FIELDS.map(({ field, label }) => (
              <div key={field}>
                <label className="app-label text-sm">{label}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-sm">$</span>
                  <input
                    type="number"
                    value={pricing[field] || ''}
                    onChange={(e) => handlePricingChange(field, parseFloat(e.target.value) || 0)}
                    className="app-input pl-7 text-sm"
                    min="0"
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Multiple Full Loads */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">🚛</span>
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300">Multiple Full Loads</h4>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="app-label text-sm text-amber-800 dark:text-amber-400"># of Loads</label>
                <input
                  type="number"
                  value={numLoads || ''}
                  onChange={(e) => setNumLoads(Math.max(0, parseInt(e.target.value) || 0))}
                  className="app-input"
                  min="0"
                  placeholder="e.g., 3"
                />
              </div>
              <div>
                <label className="app-label text-sm text-amber-800 dark:text-amber-400">Price Per Load</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]">$</span>
                  <input
                    type="number"
                    value={pricePerLoad || ''}
                    onChange={(e) => setPricePerLoad(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="app-input pl-7"
                    min="0"
                    placeholder="e.g., 500"
                  />
                </div>
              </div>
            </div>
            {numLoads > 0 && pricePerLoad > 0 && (
              <p className="text-amber-800 dark:text-amber-300 mt-2 font-medium text-sm">
                {numLoads} loads × {formatCurrency(pricePerLoad)} = <strong>{formatCurrency(numLoads * pricePerLoad)}</strong>
              </p>
            )}
          </div>
        </Section>

        {/* Specialty Jobs — collapsed by default unless has values */}
        <Section title="Specialty Items" icon="🔧" defaultOpen={hasSpecialty} badge={hasSpecialty ? `${SPECIALTY_FIELDS.filter(f => (pricing[f.field] || 0) > 0).length} items` : undefined}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {SPECIALTY_FIELDS.map(({ field, label }) => (
              <div key={field}>
                <label className="app-label text-sm">{label}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-sm">$</span>
                  <input
                    type="number"
                    value={pricing[field] || ''}
                    onChange={(e) => handlePricingChange(field, parseFloat(e.target.value) || 0)}
                    className="app-input pl-7 text-sm"
                    min="0"
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Additional Fees — collapsed by default unless has values */}
        <Section title="Additional Fees" icon="💰" defaultOpen={hasFees} badge={hasFees ? `${FEE_FIELDS.filter(f => (pricing[f.field] || 0) > 0).length} fees` : undefined}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {FEE_FIELDS.map(({ field, label }) => (
              <div key={field}>
                <label className="app-label text-sm">{label}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-sm">$</span>
                  <input
                    type="number"
                    value={pricing[field] || ''}
                    onChange={(e) => handlePricingChange(field, parseFloat(e.target.value) || 0)}
                    className="app-input pl-7 text-sm"
                    min="0"
                    placeholder="0"
                  />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Job Photos — collapsed by default */}
        <Section title="Job Photos" icon="📸" defaultOpen={photoCount > 0} badge={photoCount > 0 ? `${photoCount} photo${photoCount !== 1 ? 's' : ''}` : 'optional'}>
          <p className="text-[var(--color-text-muted)] text-xs mb-3">Upload up to 3 photos to include in the quote PDF.</p>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="image-upload-box">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, i)}
                />
                {photos[i] ? (
                  <>
                    <img src={photos[i]!} alt={`Photo ${i + 1}`} className="image-preview" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="image-remove-btn"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <div className="image-upload-placeholder">
                    <svg className="w-6 h-6 text-[var(--color-text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-[var(--color-text-faint)]">Add Photo</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Sticky bottom bar — estimate + actions */}
        <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-[var(--color-bg)]/95 backdrop-blur-sm border-t border-[var(--color-border)]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-full">
            {/* Estimate preview */}
            <div className="flex items-center gap-4 w-full sm:w-auto">
              {total > 0 ? (
                <>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">Estimate</p>
                    <p className="text-lg sm:text-xl font-bold text-orange-600 dark:text-orange-400">
                      {formatCurrency(rangeLow)} – {formatCurrency(rangeHigh)}
                    </p>
                  </div>
                  {lineItems.length > 0 && (
                    <div className="hidden sm:block text-xs text-[var(--color-text-muted)]">
                      {lineItems.length} line item{lineItems.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">Add pricing to see estimate</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 w-full sm:w-auto">
              <button type="button" onClick={onBack} className="app-btn-secondary w-full sm:w-auto text-sm py-2.5 px-4">Cancel</button>
              <button type="submit" disabled={saving || total === 0} className="app-btn-primary w-full sm:w-auto text-sm py-2.5 px-5 disabled:opacity-40">
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Review & Generate'
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
