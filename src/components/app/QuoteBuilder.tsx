'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppQuote, AppPriceTemplate, AppJob } from '@/types/database'
import { formatCurrency, compressImage } from '@/lib/utils'
import { useConfirm } from '@/components/providers/ConfirmProvider'

interface QuoteBuilderProps {
  quotes: AppQuote[]
  setQuotes: (quotes: AppQuote[]) => void
  userId: string
  selectedJob: AppJob | null  // Job context for the quote
  onBack: () => void
  showSuccess: (message: string) => void
}

const PRICE_FIELDS = [
  'minimumFee', 'quarterLoad', 'halfLoad', 'threeQuarterLoad', 'fullLoad',
  'trampoline', 'shed', 'fridge', 'furniture', 'hotTub', 'customDemo',
  'laborFee', 'heavyItemFee', 'distanceFee', 'timeFee', 'hazardFee', 'customFee'
]

export function QuoteBuilder({ quotes, setQuotes, userId, selectedJob, onBack, showSuccess }: QuoteBuilderProps) {
  // Pre-fill customer info from the selected job
  const [customer, setCustomer] = useState(() => ({
    name: selectedJob?.customerName || '',
    phone: '',
    email: '',
    address: '',
    jobDescription: selectedJob?.notes || ''
  }))
  const [pricing, setPricing] = useState<Record<string, number>>({})
  const [numLoads, setNumLoads] = useState(0)
  const [pricePerLoad, setPricePerLoad] = useState(0)
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null])
  const [total, setTotal] = useState(0)
  const [saving, setSaving] = useState(false)
  const [defaultTemplate, setDefaultTemplate] = useState<AppPriceTemplate | null>(null)
  const [templateLoaded, setTemplateLoaded] = useState(false)

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

        if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows

        if (data) {
          const template: AppPriceTemplate = {
            id: data.id,
            name: data.name,
            isDefault: data.is_default,
            prices: data.prices
          }
          setDefaultTemplate(template)
          
          // Auto-fill pricing fields from template
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
    setPricing({ ...pricing, [field]: Math.max(0, value) })
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

  const saveQuote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customer.name.trim()) {
      await alert({ title: 'Missing Name', message: 'Please enter a customer name.', variant: 'warning' })
      return
    }

    setSaving(true)

    try {
      const multipleLoadsTotal = numLoads * pricePerLoad
      const rangeLow = Math.floor(total * 0.9)
      const rangeHigh = Math.ceil(total * 1.1)

      const quoteData = {
        user_id: userId,
        job_id: selectedJob?.id || null,  // Link quote to job
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
        photo_urls: photos.filter(p => p) as string[]
      }

      const { data, error } = await supabase
        .from('dyia_quotes')
        .insert(quoteData)
        .select()
        .single()

      if (error) throw error

      // Auto-create a follow-up for this quote
      await supabase
        .from('dyia_follow_ups')
        .insert({
          user_id: userId,
          quote_id: data.id,
          status: 'pending',
          contact_count: 0
        })

      const newQuote: AppQuote = {
        id: data.id,
        jobId: selectedJob?.id,  // Include job reference
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
        total
      }

      setQuotes([newQuote, ...quotes])
      showSuccess('✅ Quote saved successfully!')
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

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title text-xl sm:text-3xl">Quote Builder</h1>
          <p className="page-subtitle text-sm sm:text-base">
            {selectedJob 
              ? <>Creating quote for <span className="text-orange-600 font-medium">{selectedJob.customerName}</span></>
              : 'Create a professional estimate'
            }
          </p>
        </div>
        <button onClick={onBack} className="app-btn-secondary text-sm sm:text-base px-3 sm:px-6 py-2 sm:py-3">
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="hidden sm:inline">Back</span>
        </button>
      </div>

      <form onSubmit={saveQuote}>
        {/* Customer Information */}
        <div className="app-card mb-4 sm:mb-5 p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
            <span className="text-lg sm:text-xl">👤</span>
            <h3 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)]">Customer Information</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="app-label">Customer Name *</label>
              <input
                type="text"
                value={customer.name}
                onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                className="app-input"
                placeholder="John Smith"
                required
              />
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
          <div className="mt-4">
            <label className="app-label">Job Description</label>
            <textarea
              value={customer.jobDescription}
              onChange={(e) => setCustomer({ ...customer, jobDescription: e.target.value })}
              className="app-input resize-none"
              rows={3}
              placeholder="Describe the work to be done..."
            />
          </div>
        </div>

        {/* Volume-Based Pricing */}
        <div className="app-card mb-4 sm:mb-5 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 sm:mb-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-lg sm:text-xl">📦</span>
              <h3 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)]">Volume-Based Pricing</h3>
            </div>
            {defaultTemplate && (
              <span className="text-[10px] sm:text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full self-start sm:self-auto">
                Using: {defaultTemplate.name}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {[
              { field: 'minimumFee', label: 'Minimum Fee' },
              { field: 'quarterLoad', label: '1/4 Load' },
              { field: 'halfLoad', label: '1/2 Load' },
              { field: 'threeQuarterLoad', label: '3/4 Load' },
              { field: 'fullLoad', label: 'Full Load' },
            ].map(({ field, label }) => (
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
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mt-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🚛</span>
              <h4 className="font-semibold text-amber-900">Multiple Full Loads</h4>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="app-label text-sm text-amber-800"># of Loads</label>
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
                <label className="app-label text-sm text-amber-800">Price Per Load</label>
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
              <p className="text-amber-800 mt-3 font-medium text-sm">
                Subtotal: {numLoads} loads × {formatCurrency(pricePerLoad)} = <strong>{formatCurrency(numLoads * pricePerLoad)}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Specialty Jobs */}
        <div className="app-card mb-4 sm:mb-5 p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
            <span className="text-lg sm:text-xl">🔧</span>
            <h3 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)]">Specialty Jobs</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {[
              { field: 'trampoline', label: 'Trampoline' },
              { field: 'shed', label: 'Shed Demo' },
              { field: 'fridge', label: 'Fridge' },
              { field: 'furniture', label: 'Furniture' },
              { field: 'hotTub', label: 'Hot Tub' },
              { field: 'customDemo', label: 'Custom Demo' },
            ].map(({ field, label }) => (
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
        </div>

        {/* Additional Fees */}
        <div className="app-card mb-4 sm:mb-5 p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
            <span className="text-lg sm:text-xl">💰</span>
            <h3 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)]">Additional Fees</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {[
              { field: 'laborFee', label: 'Labor' },
              { field: 'heavyItemFee', label: 'Heavy Item' },
              { field: 'distanceFee', label: 'Distance' },
              { field: 'timeFee', label: 'Extra Time' },
              { field: 'hazardFee', label: 'Hazard' },
              { field: 'customFee', label: 'Custom' },
            ].map(({ field, label }) => (
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
        </div>

        {/* Live Estimate Preview */}
        <div className="app-card mb-4 sm:mb-5 p-4 sm:p-6 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-500">
          <div className="text-center py-2 sm:py-4">
            <div className="text-[10px] sm:text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1 sm:mb-2">Live Estimate Preview</div>
            <div className="text-2xl sm:text-4xl font-bold text-emerald-700 mb-1 sm:mb-2">
              {formatCurrency(rangeLow)} - {formatCurrency(rangeHigh)}
            </div>
            <div className="text-xs sm:text-sm text-emerald-600/70">
              Base total: <strong>{formatCurrency(total)}</strong> (±10% range)
            </div>
          </div>
        </div>

        {/* Job Photos */}
        <div className="app-card mb-4 sm:mb-6 p-4 sm:p-6">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <span className="text-lg sm:text-xl">📸</span>
            <h3 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)]">Job Photos</h3>
            <span className="text-xs sm:text-sm text-[var(--color-text-muted)]">(Optional)</span>
          </div>
          <p className="text-[var(--color-text-muted)] text-xs sm:text-sm mb-3 sm:mb-4">Upload up to 3 photos to include in the quote PDF.</p>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
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
                    <svg className="w-8 h-8 text-[var(--color-text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-[var(--color-text-faint)]">Add Photo</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
          <button type="button" onClick={onBack} className="app-btn-secondary w-full sm:w-auto text-sm sm:text-base py-2.5 sm:py-3">Cancel</button>
          <button type="submit" disabled={saving} className="app-btn-primary w-full sm:w-auto text-sm sm:text-base py-2.5 sm:py-3">
            {saving ? (
              <>
                <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
