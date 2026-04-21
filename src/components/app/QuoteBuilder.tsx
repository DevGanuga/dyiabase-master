'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppQuote, AppPriceTemplate, AppJob, QuoteStatus } from '@/types/database'
import { formatCurrency, formatLocalDateInput, compressImage } from '@/lib/utils'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { useCustomerAutocomplete } from '@/hooks/useCustomerAutocomplete'
import { ensureCustomer } from '@/lib/customers'
import { downloadQuotePdf } from '@/lib/quote-pdf'

interface QuoteBuilderProps {
  quotes: AppQuote[]
  setQuotes: (quotes: AppQuote[]) => void
  userId: string
  selectedJob: AppJob | null
  editingQuote?: AppQuote | null
  customerNames?: string[]
  onBack: () => void
  showSuccess: (message: string) => void
  onOpenDyiaWithPrompt?: (prompt: string) => void
  isPro?: boolean
  settings?: { businessInfo?: { name?: string; phone?: string; email?: string; address?: string; logo?: string | null } }
}

interface LineItem {
  id: string
  description: string
  amount: number
}

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

const SOURCES = ['Google', 'Facebook', 'Referral', 'Repeat Customer', 'Yelp', 'Craigslist', 'Instagram', 'Nextdoor', 'Thumbtack', 'HomeAdvisor', 'Website', 'Other']

export function QuoteBuilder({ quotes, setQuotes, userId, selectedJob, editingQuote, customerNames = [], onBack, showSuccess, onOpenDyiaWithPrompt, isPro = true, settings }: QuoteBuilderProps) {
  const { suggestions: customerSuggestions, findByName } = useCustomerAutocomplete(customerNames)
  // BUG-021: custom combobox state (replaces the native <datalist> which is
  // broken on iOS Safari). Mirrors the pattern used in Jobs "Customer Name".
  const [showNameSuggestions, setShowNameSuggestions] = useState(false)
  const supabase = useMemo(() => createClient(), [])
  const { alert } = useConfirm()

  const isEditing = !!editingQuote

  // Customer state
  const [customer, setCustomer] = useState(() => ({
    name: editingQuote?.customer.name || selectedJob?.customerName || '',
    phone: editingQuote?.customer.phone || '',
    email: editingQuote?.customer.email || '',
    address: editingQuote?.customer.address || '',
    jobDescription: editingQuote?.customer.jobDescription || selectedJob?.notes || '',
  }))
  const [customerFound, setCustomerFound] = useState(!!editingQuote)
  const [editingCustomer, setEditingCustomer] = useState(!selectedJob && !editingQuote)

  // Quote date
  const [quoteDate, setQuoteDate] = useState(() => {
    if (editingQuote?.createdAt) return formatLocalDateInput(new Date(editingQuote.createdAt))
    return formatLocalDateInput()
  })

  // Estimate range (direct inputs)
  const [estimateLow, setEstimateLow] = useState(editingQuote?.estimateRange.low || 0)
  const [estimateHigh, setEstimateHigh] = useState(editingQuote?.estimateRange.high || 0)

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>(() => {
    if (editingQuote?.pricing?.lineItems) {
      return (editingQuote.pricing.lineItems as Array<{description: string; amount: number}>).map((li, i) => ({
        id: `li-edit-${i}`,
        description: li.description,
        amount: li.amount,
      }))
    }
    return []
  })

  // Pricing calculator (hidden by default)
  const [showCalculator, setShowCalculator] = useState(false)
  const [pricing, setPricing] = useState<Record<string, number>>({})
  const [numLoads, setNumLoads] = useState(0)
  const [pricePerLoad, setPricePerLoad] = useState(0)

  // Details (collapsed)
  const [showDetails, setShowDetails] = useState(!!editingQuote)
  const [photos, setPhotos] = useState<(string | null)[]>(() => {
    if (editingQuote?.photos && editingQuote.photos.length > 0) {
      const p: (string | null)[] = [...editingQuote.photos]
      while (p.length < 3) p.push(null)
      return p.slice(0, 3)
    }
    return [null, null, null]
  })
  const [total, setTotal] = useState(0)
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState<AppPriceTemplate[]>([])
  const [defaultTemplate, setDefaultTemplate] = useState<AppPriceTemplate | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [templateLoaded, setTemplateLoaded] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [quoteSource, setQuoteSource] = useState(() => {
    if (editingQuote?.pricing?.source) return editingQuote.pricing.source as string
    return ''
  })
  const [notes, setNotes] = useState(() => {
    if (editingQuote?.pricing?.notes) return editingQuote.pricing.notes as string
    return ''
  })
  const [aiSuggesting, setAiSuggesting] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<{ low: number; high: number; method?: string } | null>(null)
  const [saveTemplateModal, setSaveTemplateModal] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  const handleCustomerNameChange = useCallback((name: string) => {
    setCustomer(prev => {
      // BUG-025: if the previously selected name matched a known customer and
      // the user is now typing a different name, clear the stale contact info
      // so it doesn't get silently carried over onto a new customer.
      const previousMatch = findByName(prev.name)
      const newMatch = findByName(name)
      const nameChanged = prev.name.trim().toLowerCase() !== name.trim().toLowerCase()
      const shouldClearContact = nameChanged && !!previousMatch && !newMatch
      if (shouldClearContact) {
        return { ...prev, name, phone: '', email: '', address: '' }
      }
      return { ...prev, name }
    })
    // When the user edits the name field, they're no longer on the compact
    // "known customer" card view, and until we can re-match, treat as editing.
    if (name.length > 0) {
      setEditingCustomer(true)
      setCustomerFound(false)
    }
  }, [findByName])

  const selectCustomerSuggestion = useCallback((name: string) => {
    const match = findByName(name)
    if (match) {
      setCustomer(prev => ({
        ...prev,
        name,
        phone: match.phone || '',
        email: match.email || '',
        address: match.address || '',
      }))
      setCustomerFound(true)
      setEditingCustomer(false)
    }
  }, [findByName])

  // Pre-fill from selectedJob's customer_id
  useEffect(() => {
    if (!selectedJob?.customerId || !userId) return
    const loadCustomer = async () => {
      const { data } = await supabase
        .from('dyia_customers')
        .select('name, phone, email, address')
        .eq('id', selectedJob.customerId)
        .single()
      if (data) {
        setCustomer(prev => ({
          ...prev,
          name: data.name || prev.name,
          phone: data.phone || prev.phone,
          email: data.email || prev.email,
          address: data.address || prev.address,
        }))
        setCustomerFound(true)
        setEditingCustomer(false)
      }
    }
    loadCustomer()
  }, [selectedJob?.customerId, userId, supabase])

  // Load all templates and default on mount; apply default template initially
  useEffect(() => {
    if (!userId || templateLoaded || userId.startsWith('demo')) {
      setTemplateLoaded(true)
      return
    }
    const loadTemplates = async () => {
      try {
        const { data, error } = await supabase
          .from('dyia_price_templates')
          .select('*')
          .eq('user_id', userId)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false })

        if (error) throw error

        const list: AppPriceTemplate[] = (data || []).map((row: Record<string, unknown>) => ({
          id: row.id as string,
          name: row.name as string,
          isDefault: Boolean(row.is_default),
          prices: (row.prices as AppPriceTemplate['prices']) || {},
        }))
        setTemplates(list)

        const defaultT = list.find((t) => t.isDefault) ?? list[0] ?? null
        setDefaultTemplate(defaultT)

        if (defaultT && !isEditing) {
          setSelectedTemplateId(defaultT.id)
          const p = defaultT.prices
          const templatePricing: Record<string, number> = {}
          if (p.minimumFee != null) templatePricing.minimumFee = p.minimumFee
          if (p.quarterLoad != null) templatePricing.quarterLoad = p.quarterLoad
          if (p.halfLoad != null) templatePricing.halfLoad = p.halfLoad
          if (p.threeQuarterLoad != null) templatePricing.threeQuarterLoad = p.threeQuarterLoad
          if (p.fullLoad != null) templatePricing.fullLoad = p.fullLoad
          if (p.surcharges?.trampoline != null) templatePricing.trampoline = p.surcharges.trampoline
          if (p.surcharges?.hotTub != null) templatePricing.hotTub = p.surcharges.hotTub
          if (p.surcharges?.piano != null) templatePricing.piano = p.surcharges.piano
          setPricing((prev) => ({ ...prev, ...templatePricing }))

          const genItems: LineItem[] = []
          let genTotal = 0
          for (const { field, label } of VOLUME_FIELDS) {
            const val = templatePricing[field] || 0
            if (val > 0) { genItems.push({ id: `vol-${field}`, description: label, amount: val }); genTotal += val }
          }
          for (const { field, label } of SPECIALTY_FIELDS) {
            const val = templatePricing[field] || 0
            if (val > 0) { genItems.push({ id: `spec-${field}`, description: `${label} Removal`, amount: val }); genTotal += val }
          }
          if (genItems.length > 0) {
            setLineItems(genItems)
            setEstimateLow(Math.floor(genTotal * 0.9))
            setEstimateHigh(Math.ceil(genTotal * 1.1))
          }
        } else if (!isEditing) {
          setSelectedTemplateId(null)
        }
      } catch (error) {
        console.error('Error loading templates:', error)
      } finally {
        setTemplateLoaded(true)
      }
    }

    loadTemplates()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, supabase, templateLoaded])

  const selectedTemplate = selectedTemplateId ? templates.find((t) => t.id === selectedTemplateId) ?? null : null

  const generateFromPricing = useCallback((pricingValues: Record<string, number>, loads = 0, perLoad = 0) => {
    const items: LineItem[] = []
    let total = 0

    for (const { field, label } of VOLUME_FIELDS) {
      const val = pricingValues[field] || 0
      if (val > 0) { items.push({ id: `vol-${field}`, description: label, amount: val }); total += val }
    }
    if (loads > 0 && perLoad > 0) {
      const amt = loads * perLoad
      items.push({ id: 'multi-loads', description: `${loads} Full Loads @ ${formatCurrency(perLoad)}`, amount: amt })
      total += amt
    }
    for (const { field, label } of SPECIALTY_FIELDS) {
      const val = pricingValues[field] || 0
      if (val > 0) { items.push({ id: `spec-${field}`, description: `${label} Removal`, amount: val }); total += val }
    }
    for (const { field, label } of FEE_FIELDS) {
      const val = pricingValues[field] || 0
      if (val > 0) { items.push({ id: `fee-${field}`, description: `${label} Fee`, amount: val }); total += val }
    }

    return { items, total }
  }, [])

  const applyTemplate = useCallback((template: AppPriceTemplate | null) => {
    if (!template) {
      setPricing({})
      setNumLoads(0)
      setPricePerLoad(0)
      setSelectedTemplateId(null)
      setLineItems([])
      return
    }
    setSelectedTemplateId(template.id)
    const p = template.prices
    const next: Record<string, number> = {}
    if (p.minimumFee != null) next.minimumFee = p.minimumFee
    if (p.quarterLoad != null) next.quarterLoad = p.quarterLoad
    if (p.halfLoad != null) next.halfLoad = p.halfLoad
    if (p.threeQuarterLoad != null) next.threeQuarterLoad = p.threeQuarterLoad
    if (p.fullLoad != null) next.fullLoad = p.fullLoad
    if (p.surcharges?.trampoline != null) next.trampoline = p.surcharges.trampoline
    if (p.surcharges?.hotTub != null) next.hotTub = p.surcharges.hotTub
    if (p.surcharges?.piano != null) next.piano = p.surcharges.piano
    setPricing(next)

    const { items, total } = generateFromPricing(next)
    if (items.length > 0) {
      setLineItems(items)
      setEstimateLow(Math.floor(total * 0.9))
      setEstimateHigh(Math.ceil(total * 1.1))
    }
  }, [generateFromPricing])

  const fetchAiSuggestion = useCallback(async () => {
    const desc = customer.jobDescription?.trim()
    if (!desc || desc.length < 10) {
      await alert({ title: 'Add job description', message: 'Enter a job description (at least 10 characters) to get an AI suggestion.', variant: 'warning' })
      return
    }
    setAiSuggesting(true)
    setAiSuggestion(null)
    try {
      const res = await fetch('/api/ai/suggest-quote-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_description: desc }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.needsPro) await alert({ title: 'Pro feature', message: data.error ?? 'Upgrade to Pro for AI pricing suggestions.', variant: 'warning' })
        else await alert({ title: 'Error', message: data.error ?? 'Could not get suggestion.', variant: 'error' })
        return
      }
      setAiSuggestion({ low: data.suggestedLow, high: data.suggestedHigh, method: data.pricingMethod })
    } catch {
      await alert({ title: 'Error', message: 'Failed to get AI suggestion.', variant: 'error' })
    } finally {
      setAiSuggesting(false)
    }
  }, [customer.jobDescription, alert])

  const applyAiSuggestion = useCallback(() => {
    if (!aiSuggestion) return
    const mid = Math.round((aiSuggestion.low + aiSuggestion.high) / 2)
    setPricing((prev) => ({ ...prev, fullLoad: mid }))
    setAiSuggestion(null)
  }, [aiSuggestion])

  const saveAsTemplate = useCallback(async () => {
    const name = newTemplateName.trim()
    if (!name) {
      await alert({ title: 'Name required', message: 'Enter a name for the template.', variant: 'warning' })
      return
    }
    setSavingTemplate(true)
    try {
      const pricesPayload = {
        minimumFee: pricing.minimumFee ?? 0,
        quarterLoad: pricing.quarterLoad ?? 0,
        halfLoad: pricing.halfLoad ?? 0,
        threeQuarterLoad: pricing.threeQuarterLoad ?? 0,
        fullLoad: pricing.fullLoad ?? 0,
        surcharges: {
          trampoline: pricing.trampoline ?? 0,
          hotTub: pricing.hotTub ?? 0,
          piano: pricing.piano ?? 0,
        },
      }
      const { data, error } = await supabase
        .from('dyia_price_templates')
        .insert({ user_id: userId, name, prices: pricesPayload, is_default: templates.length === 0 })
        .select()
        .single()

      if (error) throw error
      const newT: AppPriceTemplate = { id: data.id, name: data.name, isDefault: data.is_default, prices: data.prices }
      setTemplates((prev) => [newT, ...prev])
      setSaveTemplateModal(false)
      setNewTemplateName('')
      showSuccess('Template saved! You can use it in Settings or pick it next time.')
    } catch (err) {
      console.error('Save template error:', err)
      await alert({ title: 'Error', message: 'Could not save template.', variant: 'error' })
    } finally {
      setSavingTemplate(false)
    }
  }, [newTemplateName, pricing, userId, supabase, templates.length, showSuccess, alert])

  // When calculator values change, generate line items and update estimate range
  const applyCalculator = useCallback(() => {
    const { items, total } = generateFromPricing(pricing, numLoads, pricePerLoad)

    setLineItems(items)
    if (total > 0) {
      setEstimateLow(Math.floor(total * 0.9))
      setEstimateHigh(Math.ceil(total * 1.1))
    }
    setShowCalculator(false)
  }, [pricing, numLoads, pricePerLoad, generateFromPricing])

  const addLineItem = () => {
    setLineItems(prev => [...prev, { id: `li-${Date.now()}`, description: '', amount: 0 }])
  }

  const updateLineItem = (id: string, field: 'description' | 'amount', value: string | number) => {
    setLineItems(prev => prev.map(li => li.id === id ? { ...li, [field]: value } : li))
  }

  const removeLineItem = (id: string) => {
    setLineItems(prev => prev.filter(li => li.id !== id))
  }

  const lineItemsTotal = lineItems.reduce((sum, li) => sum + (li.amount || 0), 0)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string
      const compressed = await compressImage(dataUrl, 800, 0.7)
      setPhotos(prev => { const n = [...prev]; n[index] = compressed; return n })
    }
    reader.readAsDataURL(file)
  }

  const removeImage = (index: number) => {
    const newPhotos = [...photos]
    newPhotos[index] = null
    setPhotos(newPhotos)
  }

  const saveQuote = async (downloadPdf = false) => {
    if (!customer.name.trim()) {
      await alert({ title: 'Missing Name', message: 'Please enter a customer name.', variant: 'warning' })
      return
    }
    if (estimateLow <= 0 && estimateHigh <= 0) {
      await alert({ title: 'No Estimate', message: 'Please enter an estimate range.', variant: 'warning' })
      return
    }

    setSaving(true)
    try {
      const low = Math.min(estimateLow, estimateHigh)
      const high = Math.max(estimateLow, estimateHigh)
      const total = Math.round((low + high) / 2)

      const customerId = await ensureCustomer(supabase, userId, customer.name.trim(), {
        phone: customer.phone || null,
        email: customer.email || null,
        address: customer.address || null,
      })

      const pricingData = {
        ...pricing,
        lineItems: lineItems.filter(li => li.description && li.amount > 0).map(li => ({ description: li.description, amount: li.amount })),
        ...(numLoads > 0 && pricePerLoad > 0 ? { multipleLoads: { numLoads, pricePerLoad, total: numLoads * pricePerLoad } } : {}),
        ...(notes ? { notes } : {}),
        ...(quoteSource ? { source: quoteSource } : {}),
      }

      const quotePayload = {
        user_id: userId,
        customer_id: customerId,
        job_id: selectedJob?.id || editingQuote?.jobId || null,
        customer_name: customer.name.trim(),
        customer_phone: customer.phone || null,
        customer_email: customer.email || null,
        customer_address: customer.address || null,
        job_description: customer.jobDescription || null,
        source: quoteSource || null,
        pricing: pricingData,
        estimate_low: low,
        estimate_high: high,
        total,
        photo_urls: photos.filter(Boolean) as string[],
        created_at: new Date(quoteDate + 'T12:00:00').toISOString(),
      }

      let savedId: string
      let createdAtTimestamp: number

      if (isEditing && editingQuote) {
        const { error } = await supabase
          .from('dyia_quotes')
          .update(quotePayload)
          .eq('id', editingQuote.id)
          .eq('user_id', userId)

        if (error) throw error
        savedId = editingQuote.id
        createdAtTimestamp = new Date(quoteDate + 'T12:00:00').getTime()

        const updatedQuote: AppQuote = {
          ...editingQuote,
          customerId,
          createdAt: createdAtTimestamp,
          customer: { name: customer.name, phone: customer.phone, email: customer.email, address: customer.address, jobDescription: customer.jobDescription },
          pricing: pricingData,
          photos: photos.filter(Boolean) as string[],
          estimateRange: { low, high },
          total,
        }
        setQuotes(quotes.map(q => q.id === editingQuote.id ? updatedQuote : q))
      } else {
        const insertPayload = { ...quotePayload, status: 'draft' as QuoteStatus }
        const { data, error } = await supabase
          .from('dyia_quotes')
          .insert(insertPayload)
          .select()
          .single()

        if (error) throw error
        savedId = data.id
        createdAtTimestamp = new Date(data.created_at).getTime()

        await supabase.from('dyia_follow_ups').insert({
          user_id: userId,
          customer_id: customerId,
          quote_id: data.id,
          status: 'pending',
          contact_count: 0,
        })

        const newQuote: AppQuote = {
          id: savedId,
          customerId,
          jobId: selectedJob?.id,
          createdAt: createdAtTimestamp,
          customer: { name: customer.name, phone: customer.phone, email: customer.email, address: customer.address, jobDescription: customer.jobDescription },
          pricing: pricingData,
          photos: photos.filter(Boolean) as string[],
          estimateRange: { low, high },
          total,
          status: 'draft',
        }
        setQuotes([newQuote, ...quotes])
      }

      if (downloadPdf) {
        const pdfLineItems = lineItems.filter(li => li.description && li.amount > 0).map(li => ({ description: li.description, amount: li.amount }))
        downloadQuotePdf(
          {
            customerName: customer.name,
            customerPhone: customer.phone,
            customerEmail: customer.email,
            customerAddress: customer.address,
            jobDescription: customer.jobDescription,
            estimateLow: low,
            estimateHigh: high,
            lineItems: pdfLineItems.length > 0 ? pdfLineItems : undefined,
            photos: photos.filter(Boolean) as string[],
            createdAt: new Date(quoteDate + 'T12:00:00'),
          },
          {
            name: settings?.businessInfo?.name,
            phone: settings?.businessInfo?.phone,
            email: settings?.businessInfo?.email,
            address: settings?.businessInfo?.address,
            logo: settings?.businessInfo?.logo,
          }
        )
        showSuccess(`Quote ${isEditing ? 'updated' : 'saved'} & PDF downloaded for ${customer.name}`)
      } else {
        showSuccess(`Quote ${isEditing ? 'updated' : 'saved'} for ${customer.name} — ${formatCurrency(low)}–${formatCurrency(high)}`)
      }

      setTimeout(onBack, 400)
    } catch (error) {
      console.error('Error saving quote:', error)
      await alert({ title: 'Error', message: 'Failed to save quote. Please try again.', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const photoCount = photos.filter(Boolean).length

  return (
    <div className="animate-fade-in pb-28">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title text-xl sm:text-2xl">{isEditing ? 'Edit Estimate' : 'New Estimate'}</h1>
          <p className="page-subtitle text-sm">
            {selectedJob
              ? <>For <span className="text-orange-600 dark:text-orange-400 font-medium">{selectedJob.customerName}</span></>
              : isEditing
                ? <>Editing quote for <span className="text-orange-600 dark:text-orange-400 font-medium">{editingQuote?.customer.name}</span></>
                : 'Create a professional estimate'}
          </p>
        </div>
        <button onClick={onBack} className="app-btn-secondary text-sm px-4 py-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="hidden sm:inline">Back</span>
        </button>
      </div>

      <div className="max-w-2xl mx-auto space-y-4">
        {/* Customer Section */}
        <div className="app-card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Customer
            </h3>
            {customerFound && !editingCustomer && (
              <button type="button" onClick={() => setEditingCustomer(true)} className="text-xs text-orange-500 hover:text-orange-600">Edit</button>
            )}
          </div>

          {/* Compact card when customer is known and not editing */}
          {customerFound && !editingCustomer ? (
            <div className="flex items-center gap-3 p-3 bg-[var(--color-bg-subtle)] rounded-lg">
              <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-orange-500">{customer.name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-[var(--color-text-primary)] truncate">{customer.name}</p>
                <div className="flex flex-wrap gap-x-3 text-xs text-[var(--color-text-muted)]">
                  {customer.phone && <span>{customer.phone}</span>}
                  {customer.email && <span>{customer.email}</span>}
                  {customer.address && <span className="truncate max-w-[200px]">{customer.address}</span>}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 relative">
                <label className="app-label" id="qb-name-label">Name *</label>
                {/*
                 * BUG-021: Replaced native <datalist> (broken hit-area + missing
                 * autocomplete on iOS Safari) with a custom combobox listbox —
                 * same pattern as Log Job "Customer Name" (Jobs.tsx).
                 */}
                <input
                  type="text"
                  role="combobox"
                  autoComplete="off"
                  aria-labelledby="qb-name-label"
                  aria-expanded={showNameSuggestions}
                  aria-controls="qb-name-suggestions"
                  aria-autocomplete="list"
                  value={customer.name}
                  onChange={(e) => {
                    const val = e.target.value
                    handleCustomerNameChange(val)
                    setShowNameSuggestions(val.trim().length >= 1)
                  }}
                  onFocus={() => { if (customer.name.trim().length >= 1) setShowNameSuggestions(true) }}
                  onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
                  className="app-input"
                  placeholder="Customer name"
                  required
                  autoFocus
                />
                {showNameSuggestions && (() => {
                  const q = customer.name.trim().toLowerCase()
                  const filtered = customerSuggestions.filter(c => c.name.toLowerCase().includes(q))
                  if (filtered.length === 0) return null
                  return (
                    <ul
                      id="qb-name-suggestions"
                      role="listbox"
                      className="absolute z-20 left-0 right-0 top-full mt-1 max-h-44 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-lg py-1"
                    >
                      {filtered.slice(0, 8).map(c => (
                        <li key={c.id} role="option" aria-selected={false}>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              // preventDefault so the input doesn't lose focus
                              // before the click handler reads the selection.
                              e.preventDefault()
                              selectCustomerSuggestion(c.name)
                              setShowNameSuggestions(false)
                            }}
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-[var(--color-bg-subtle)] transition-colors"
                          >
                            <div className="font-medium text-[var(--color-text-primary)]">{c.name}</div>
                            <div className="text-[var(--color-text-faint)] text-xs">
                              {[c.phone, c.email, c.address].filter(Boolean).join(' · ') || 'No contact info'}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                })()}
              </div>
              <div>
                <label className="app-label">Phone</label>
                <input type="tel" value={customer.phone} onChange={(e) => setCustomer(p => ({ ...p, phone: e.target.value }))} className="app-input" placeholder="(555) 123-4567" />
              </div>
              <div>
                <label className="app-label">Email</label>
                <input type="email" value={customer.email} onChange={(e) => setCustomer(p => ({ ...p, email: e.target.value }))} className="app-input" placeholder="email@example.com" />
              </div>
              <div className="sm:col-span-2">
                <label className="app-label">Address</label>
                <input type="text" value={customer.address} onChange={(e) => setCustomer(p => ({ ...p, address: e.target.value }))} className="app-input" placeholder="123 Main St, City, FL" />
              </div>
            </div>
          )}

          {/* Job Description */}
          <div className="mt-3">
            <label className="app-label">Job Description</label>
            <textarea
              value={customer.jobDescription}
              onChange={(e) => setCustomer(p => ({ ...p, jobDescription: e.target.value }))}
              className="app-input resize-none"
              rows={2}
              placeholder="Describe the work..."
            />
            {/* AI Pricing Suggestion — inline for Pro, or open Dyia */}
            {customer.jobDescription && customer.jobDescription.length > 10 && isPro && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={fetchAiSuggestion}
                  disabled={aiSuggesting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50/80 dark:bg-orange-950/30 border border-orange-200/50 dark:border-orange-800/30 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-950/50 transition-all disabled:opacity-60"
                >
                  {aiSuggesting ? (
                    <span className="inline-block w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <img src="/dyia-agent.png" alt="" className="w-3.5 h-3.5 object-contain" />
                  )}
                  {aiSuggesting ? 'Getting suggestion…' : 'Get AI pricing suggestion'}
                </button>
                {onOpenDyiaWithPrompt && (
                  <button
                    type="button"
                    onClick={() => onOpenDyiaWithPrompt(`I need to price a job: "${customer.jobDescription}". Based on my job history, what should I charge? Give me a suggested price range.`)}
                    className="text-xs text-[var(--color-text-muted)] hover:text-orange-500 underline"
                  >
                    Or ask in Dyia
                  </button>
                )}
              </div>
            )}
            {aiSuggestion && (
              <div className="mt-2 p-3 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200/50 dark:border-orange-800/30">
                <p className="text-xs font-medium text-orange-800 dark:text-orange-200 mb-1">Suggested range: {formatCurrency(aiSuggestion.low)} – {formatCurrency(aiSuggestion.high)}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setEstimateLow(aiSuggestion.low); setEstimateHigh(aiSuggestion.high); setAiSuggestion(null) }} className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline">
                    Apply to estimate
                  </button>
                  <button type="button" onClick={applyAiSuggestion} className="text-xs font-medium text-[var(--color-text-muted)] hover:underline">
                    Apply as full load price
                  </button>
                  <button type="button" onClick={() => setAiSuggestion(null)} className="text-xs text-[var(--color-text-muted)] hover:underline">
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quote Date + Pricing Template */}
        <div className="app-card p-4 sm:p-5">
          <div className={`${templates.length > 0 ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : ''}`}>
            <div>
              <label className="app-label flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Quote Date
              </label>
              <input
                type="date"
                value={quoteDate}
                onChange={(e) => setQuoteDate(e.target.value)}
                className="app-input w-full"
              />
            </div>

            {templates.length > 0 && (
              <div>
                <label className="app-label flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                  Pricing Template
                </label>
                <select
                  value={selectedTemplateId ?? '__scratch__'}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === '__scratch__') applyTemplate(null)
                    else {
                      const t = templates.find((x) => x.id === v)
                      if (t) applyTemplate(t)
                    }
                  }}
                  className="app-select w-full"
                >
                  <option value="__scratch__">From scratch</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2">
            <button
              type="button"
              onClick={() => setSaveTemplateModal(true)}
              className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline"
            >
              Save current pricing as template
            </button>
          </div>
        </div>

        {/* Estimate Range */}
        <div className="app-card p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Estimate Range
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="app-label">Low</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]">$</span>
                <input
                  type="number"
                  value={estimateLow || ''}
                  onChange={(e) => setEstimateLow(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="app-input pl-7 text-lg font-semibold"
                  min="0"
                  placeholder="250"
                />
              </div>
            </div>
            <div>
              <label className="app-label">High</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]">$</span>
                <input
                  type="number"
                  value={estimateHigh || ''}
                  onChange={(e) => setEstimateHigh(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="app-input pl-7 text-lg font-semibold"
                  min="0"
                  placeholder="350"
                />
              </div>
            </div>
          </div>

          {/* Pricing Calculator Toggle */}
          <button
            type="button"
            onClick={() => setShowCalculator(!showCalculator)}
            className="mt-3 w-full text-left flex items-center justify-between py-2 px-3 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Use pricing calculator
            </span>
            <svg className={`w-3.5 h-3.5 transition-transform ${showCalculator ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Calculator Panel */}
          {showCalculator && (
            <div className="mt-3 border border-[var(--color-border)] rounded-xl p-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Volume Pricing</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {VOLUME_FIELDS.map(({ field, label }) => (
                    <div key={field}>
                      <label className="text-[10px] text-[var(--color-text-muted)]">{label}</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-xs">$</span>
                        <input type="number" value={pricing[field] || ''} onChange={(e) => setPricing(p => ({ ...p, [field]: parseFloat(e.target.value) || 0 }))} className="app-input pl-6 text-sm py-1.5" min="0" placeholder="0" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Specialty Items</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SPECIALTY_FIELDS.map(({ field, label }) => (
                    <div key={field}>
                      <label className="text-[10px] text-[var(--color-text-muted)]">{label}</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-xs">$</span>
                        <input type="number" value={pricing[field] || ''} onChange={(e) => setPricing(p => ({ ...p, [field]: parseFloat(e.target.value) || 0 }))} className="app-input pl-6 text-sm py-1.5" min="0" placeholder="0" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Additional Fees</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {FEE_FIELDS.map(({ field, label }) => (
                    <div key={field}>
                      <label className="text-[10px] text-[var(--color-text-muted)]">{label}</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-xs">$</span>
                        <input type="number" value={pricing[field] || ''} onChange={(e) => setPricing(p => ({ ...p, [field]: parseFloat(e.target.value) || 0 }))} className="app-input pl-6 text-sm py-1.5" min="0" placeholder="0" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Multiple loads */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[var(--color-text-muted)]"># of Full Loads</label>
                  <input type="number" value={numLoads || ''} onChange={(e) => setNumLoads(parseInt(e.target.value) || 0)} className="app-input text-sm py-1.5" min="0" />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--color-text-muted)]">Price Per Load</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-xs">$</span>
                    <input type="number" value={pricePerLoad || ''} onChange={(e) => setPricePerLoad(parseFloat(e.target.value) || 0)} className="app-input pl-6 text-sm py-1.5" min="0" />
                  </div>
                </div>
              </div>
              <button type="button" onClick={applyCalculator} className="app-btn-primary w-full py-2 text-sm">
                Apply to Estimate
              </button>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="app-card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Line Items
              {lineItems.length > 0 && <span className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded-full">{lineItems.length}</span>}
            </h3>
            <button type="button" onClick={addLineItem} className="text-xs text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add item
            </button>
          </div>

          {lineItems.length === 0 ? (
            <p className="text-xs text-[var(--color-text-faint)] text-center py-4">Line items appear on the PDF as an itemized breakdown. Optional but recommended.</p>
          ) : (
            <div className="space-y-2">
              {lineItems.map((li) => (
                <div key={li.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={li.description}
                    onChange={(e) => updateLineItem(li.id, 'description', e.target.value)}
                    className="app-input flex-1 text-sm py-1.5"
                    placeholder="Description"
                  />
                  <div className="relative w-28 shrink-0">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-xs">$</span>
                    <input
                      type="number"
                      value={li.amount || ''}
                      onChange={(e) => updateLineItem(li.id, 'amount', parseFloat(e.target.value) || 0)}
                      className="app-input pl-6 text-sm py-1.5"
                      min="0"
                      placeholder="0"
                    />
                  </div>
                  <button type="button" onClick={() => removeLineItem(li.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              {lineItemsTotal > 0 && (
                <div className="flex justify-end pt-2 border-t border-[var(--color-border)]">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">Total: {formatCurrency(lineItemsTotal)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Details (collapsed) */}
        <div className="app-card overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-[var(--color-bg-subtle)] transition-colors"
          >
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Details
              {(photoCount > 0 || quoteSource || notes) && (
                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-[var(--color-text-muted)] px-1.5 py-0.5 rounded-full">
                  {[photoCount > 0 && `${photoCount} photo${photoCount !== 1 ? 's' : ''}`, quoteSource, notes && 'notes'].filter(Boolean).join(' · ')}
                </span>
              )}
            </h3>
            <svg className={`w-4 h-4 text-[var(--color-text-faint)] transition-transform ${showDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showDetails && (
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3">
              <div>
                <label className="app-label">Lead Source</label>
                <select value={quoteSource} onChange={(e) => setQuoteSource(e.target.value)} className="app-select">
                  <option value="">Select source...</option>
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="app-label">Internal Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="app-input resize-none" rows={2} placeholder="Notes for your records (not shown to customer)" />
              </div>
              <div>
                <label className="app-label">Photos ({photoCount}/3)</label>
                <div className="grid grid-cols-3 gap-2">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="image-upload-box aspect-square">
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, i)} />
                      {photos[i] ? (
                        <>
                          <img src={photos[i]!} alt={`Photo ${i + 1}`} className="image-preview" />
                          <button type="button" onClick={() => setPhotos(prev => { const n = [...prev]; n[i] = null; return n })} className="image-remove-btn">✕</button>
                        </>
                      ) : (
                        <div className="image-upload-placeholder">
                          <svg className="w-6 h-6 text-[var(--color-text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Inline Preview */}
        {(estimateLow > 0 || estimateHigh > 0) && (
          <div className="app-card p-4 sm:p-5 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200/50 dark:border-orange-800/30">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wider text-orange-600/70 dark:text-orange-400/70 font-semibold mb-1">Estimate</p>
              <p className="text-2xl sm:text-3xl font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(Math.min(estimateLow, estimateHigh))} – {formatCurrency(Math.max(estimateLow, estimateHigh))}
              </p>
              {lineItems.length > 0 && (
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{lineItems.length} line item{lineItems.length !== 1 ? 's' : ''} · {formatCurrency(lineItemsTotal)} subtotal</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-bg-page)]/95 backdrop-blur-lg border-t border-[var(--color-border)] px-4 sm:px-6 py-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <button type="button" onClick={onBack} className="app-btn-secondary flex-shrink-0 text-sm py-2.5 px-4">Cancel</button>
          <button
            type="button"
            onClick={() => saveQuote(false)}
            disabled={saving || (estimateLow <= 0 && estimateHigh <= 0)}
            className="app-btn-secondary flex-1 text-sm py-2.5 disabled:opacity-40"
          >
            {isEditing ? 'Update' : 'Save Draft'}
          </button>
          <button
            type="button"
            onClick={() => saveQuote(true)}
            disabled={saving || (estimateLow <= 0 && estimateHigh <= 0)}
            className="app-btn-primary flex-1 text-sm py-2.5 disabled:opacity-40"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              isEditing ? 'Update & Download PDF' : 'Save & Download PDF'
            )}
          </button>
        </div>
      </div>

      {/* Save as template modal */}
      {saveTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !savingTemplate && setSaveTemplateModal(false)}>
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Save as template</h3>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">Save your current pricing so you can reuse it for future quotes.</p>
            <input
              type="text"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="e.g. Standard rates"
              className="app-input w-full mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setSaveTemplateModal(false)} disabled={savingTemplate} className="app-btn-secondary text-sm py-2 px-4">
                Cancel
              </button>
              <button type="button" onClick={saveAsTemplate} disabled={savingTemplate || !newTemplateName.trim()} className="app-btn-primary text-sm py-2 px-4 disabled:opacity-50">
                {savingTemplate ? 'Saving…' : 'Save template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
