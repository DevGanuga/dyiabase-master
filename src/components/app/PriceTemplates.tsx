'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppPriceTemplate } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { defaultTemplateItems, usesLegacyJunkPricing } from '@/lib/quotes/templates'

interface PriceTemplatesProps {
  userId: string
  showSuccess: (message: string) => void
  onDataChanged?: () => void
  /** Business vertical — seeds trade-appropriate categories for new templates. */
  businessType?: string
}

const DEFAULT_PRICES: AppPriceTemplate['prices'] = {
  minimumFee: 75,
  quarterLoad: 150,
  halfLoad: 250,
  threeQuarterLoad: 350,
  fullLoad: 450,
  additionalLoads: 400,
  laborPerHour: 50,
  dumpFee: 50,
  surcharges: {
    trampoline: 100,
    hotTub: 200,
    piano: 150,
  }
}

interface TemplateFormData {
  name: string
  prices: AppPriceTemplate['prices']
}

/**
 * Build starter prices for a brand-new template. Junk removal keeps the legacy
 * load-tier fields; other trades start with seeded `items[]` categories.
 */
function makeDefaultPrices(businessType?: string): AppPriceTemplate['prices'] {
  if (usesLegacyJunkPricing(businessType)) return { ...DEFAULT_PRICES }
  return { items: defaultTemplateItems(businessType) }
}

export function PriceTemplates({ userId, showSuccess, onDataChanged, businessType }: PriceTemplatesProps) {
  const [templates, setTemplates] = useState<AppPriceTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<TemplateFormData>({ name: '', prices: makeDefaultPrices(businessType) })
  const [saving, setSaving] = useState(false)

  const supabase = useMemo(() => createClient(), [])
  const { confirm, alert } = useConfirm()

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      if (!userId) {
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('dyia_price_templates')
          .select('*')
          .eq('user_id', userId)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false })

        if (error) throw error

        if (data) {
          setTemplates(data.map(t => ({
            id: t.id,
            name: t.name,
            isDefault: t.is_default,
            prices: {
              ...(Array.isArray(t.prices?.items) && t.prices.items.length > 0 ? { items: t.prices.items } : {}),
              minimumFee: t.prices?.minimumFee ?? DEFAULT_PRICES.minimumFee,
              quarterLoad: t.prices?.quarterLoad ?? DEFAULT_PRICES.quarterLoad,
              halfLoad: t.prices?.halfLoad ?? DEFAULT_PRICES.halfLoad,
              threeQuarterLoad: t.prices?.threeQuarterLoad ?? DEFAULT_PRICES.threeQuarterLoad,
              fullLoad: t.prices?.fullLoad ?? DEFAULT_PRICES.fullLoad,
              additionalLoads: t.prices?.additionalLoads ?? DEFAULT_PRICES.additionalLoads,
              laborPerHour: t.prices?.laborPerHour ?? DEFAULT_PRICES.laborPerHour,
              dumpFee: t.prices?.dumpFee ?? DEFAULT_PRICES.dumpFee,
              surcharges: {
                trampoline: t.prices?.surcharges?.trampoline ?? DEFAULT_PRICES.surcharges?.trampoline ?? 100,
                hotTub: t.prices?.surcharges?.hotTub ?? DEFAULT_PRICES.surcharges?.hotTub ?? 200,
                piano: t.prices?.surcharges?.piano ?? DEFAULT_PRICES.surcharges?.piano ?? 150,
              }
            }
          })))
        }
      } catch (error) {
        console.error('Error loading templates:', error)
      } finally {
        setLoading(false)
      }
    }

    loadTemplates()
  }, [userId, supabase])

  const resetForm = useCallback(() => {
    setFormData({ name: '', prices: makeDefaultPrices(businessType) })
    setEditingId(null)
    setShowForm(false)
  }, [businessType])

  const handleEdit = useCallback((template: AppPriceTemplate) => {
    setFormData({
      name: template.name,
      prices: { ...template.prices }
    })
    setEditingId(template.id)
    setShowForm(true)
  }, [])

  const handlePriceChange = (field: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      prices: { ...prev.prices, [field]: Math.max(0, value) }
    }))
  }

  const handleSurchargeChange = (field: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      prices: {
        ...prev.prices,
        surcharges: { ...(prev.prices.surcharges || {}), [field]: Math.max(0, value) }
      }
    }))
  }

  const handleItemChange = (index: number, field: 'label' | 'amount', value: string | number) => {
    setFormData(prev => {
      const items = [...(prev.prices.items || [])]
      const current = items[index] || { label: '', amount: 0 }
      items[index] = field === 'label'
        ? { ...current, label: value as string }
        : { ...current, amount: Math.max(0, Number(value) || 0) }
      return { ...prev, prices: { ...prev.prices, items } }
    })
  }

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      prices: { ...prev.prices, items: [...(prev.prices.items || []), { label: '', amount: 0 }] }
    }))
  }

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      prices: { ...prev.prices, items: (prev.prices.items || []).filter((_, i) => i !== index) }
    }))
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      await alert({ title: 'Missing Name', message: 'Please enter a template name.', variant: 'warning' })
      return
    }

    setSaving(true)

    // Drop blank item rows so empty placeholders don't get persisted.
    const cleanedItems = (formData.prices.items || []).filter(it => it.label.trim() && it.amount > 0)
    const prices: AppPriceTemplate['prices'] = {
      ...formData.prices,
      ...(cleanedItems.length > 0 ? { items: cleanedItems } : { items: undefined }),
    }

    try {
      if (editingId) {
        // Update existing template
        const { error } = await supabase
          .from('dyia_price_templates')
          .update({
            name: formData.name.trim(),
            prices
          })
          .eq('id', editingId)

        if (error) throw error

        setTemplates(templates.map(t =>
          t.id === editingId
            ? { ...t, name: formData.name.trim(), prices }
            : t
        ))
        showSuccess('Template updated!')
        onDataChanged?.()
      } else {
        // Create new template
        const isFirst = templates.length === 0
        const { data, error } = await supabase
          .from('dyia_price_templates')
          .insert({
            user_id: userId,
            name: formData.name.trim(),
            prices,
            is_default: isFirst // First template is default
          })
          .select()
          .single()

        if (error) throw error

        if (data) {
          setTemplates([{
            id: data.id,
            name: data.name,
            isDefault: data.is_default,
            prices
          }, ...templates])
        }
        showSuccess('Template created!')
        onDataChanged?.()
      }
      resetForm()
    } catch (error) {
      console.error('Error saving template:', error)
      await alert({ title: 'Error', message: 'Error saving template.', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const template = templates.find(t => t.id === id)
    if (template?.isDefault) {
      await alert({ title: 'Cannot Delete', message: 'Cannot delete the default template. Set another template as default first.', variant: 'warning' })
      return
    }

    const ok = await confirm({ title: 'Delete Template', message: 'Are you sure you want to delete this template?', confirmLabel: 'Delete', variant: 'danger' })
    if (!ok) return

    try {
      const { error } = await supabase
        .from('dyia_price_templates')
        .delete()
        .eq('id', id)

      if (error) throw error

      setTemplates(templates.filter(t => t.id !== id))
      showSuccess('Template deleted!')
      onDataChanged?.()
    } catch (error) {
      console.error('Error deleting template:', error)
      await alert({ title: 'Error', message: 'Error deleting template.', variant: 'error' })
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      // First, unset all defaults for this user
      await supabase
        .from('dyia_price_templates')
        .update({ is_default: false })
        .eq('user_id', userId)

      // Then set the new default
      const { error } = await supabase
        .from('dyia_price_templates')
        .update({ is_default: true })
        .eq('id', id)

      if (error) throw error

      setTemplates(templates.map(t => ({
        ...t,
        isDefault: t.id === id
      })))
      showSuccess('Default template updated!')
    } catch (error) {
      console.error('Error setting default:', error)
      await alert({ title: 'Error', message: 'Error setting default template.', variant: 'error' })
    }
  }

  if (loading) {
    return (
      <div className="app-card">
        <div className="flex items-center justify-center py-8">
          <div className="loading-spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="app-card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💲</span>
          <div>
            <h3 className="font-semibold text-[var(--color-text-primary)]">Pricing Templates</h3>
            <p className="text-sm text-[var(--color-text-muted)]">Pre-set pricing for quick quote creation</p>
          </div>
        </div>
        <button
          onClick={() => {
            setFormData({ name: '', prices: makeDefaultPrices(businessType) })
            setEditingId(null)
            setShowForm(true)
          }}
          className="app-btn-secondary text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Template
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-[var(--color-bg-subtle)] rounded-xl p-5 mb-6 border border-[var(--color-border)]">
          <h4 className="font-medium text-[var(--color-text-primary)] mb-4">
            {editingId ? 'Edit Template' : 'Create New Template'}
          </h4>

          <div className="space-y-5">
            {/* Template Name */}
            <div>
              <label className="app-label">Template Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="app-input"
                placeholder="e.g., Standard Pricing, Premium Rates"
              />
            </div>

            {/* Custom line items — trade-agnostic categories (lawn care, cleaning, …) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-sm font-medium text-[var(--color-text-secondary)]">🧾 Line Items</h5>
                <button type="button" onClick={addItem} className="text-xs text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add item
                </button>
              </div>
              {(formData.prices.items || []).length === 0 ? (
                <p className="text-xs text-[var(--color-text-faint)] mb-1">Add your own pricing categories (e.g. {usesLegacyJunkPricing(businessType) ? 'Full Load, Hot Tub Removal' : 'Standard Clean, Mowing'}). These auto-fill the quote builder.</p>
              ) : (
                <div className="space-y-2">
                  {(formData.prices.items || []).map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => handleItemChange(i, 'label', e.target.value)}
                        className="app-input flex-1 text-sm"
                        placeholder="Category label"
                      />
                      <div className="relative w-28 shrink-0">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-sm">$</span>
                        <input
                          type="number"
                          value={item.amount || ''}
                          onChange={(e) => handleItemChange(i, 'amount', parseFloat(e.target.value) || 0)}
                          className="app-input pl-6 text-sm"
                          min="0"
                          placeholder="0"
                        />
                      </div>
                      <button type="button" onClick={() => removeItem(i)} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Remove">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Load Sizes — legacy junk-removal fields, only for junk businesses */}
            {usesLegacyJunkPricing(businessType) && (
            <>
            <div>
              <h5 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">📦 Load Sizes</h5>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { field: 'minimumFee', label: 'Minimum' },
                  { field: 'quarterLoad', label: '1/4 Load' },
                  { field: 'halfLoad', label: '1/2 Load' },
                  { field: 'threeQuarterLoad', label: '3/4 Load' },
                  { field: 'fullLoad', label: 'Full Load' },
                  { field: 'additionalLoads', label: 'Additional' },
                ].map(({ field, label }) => {
                  const fieldValue = formData.prices[field as keyof Omit<typeof formData.prices, 'surcharges'>]
                  return (
                    <div key={field}>
                      <label className="app-label text-xs">{label}</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-sm">$</span>
                        <input
                          type="number"
                          value={typeof fieldValue === 'number' ? fieldValue : ''}
                          onChange={(e) => handlePriceChange(field, parseFloat(e.target.value) || 0)}
                          className="app-input pl-6 text-sm"
                          min="0"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Labor & Dump Fee */}
            <div>
              <h5 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">⚙️ Labor & Fees</h5>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="app-label text-xs">Labor (per hour)</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-sm">$</span>
                    <input
                      type="number"
                      value={formData.prices.laborPerHour || ''}
                      onChange={(e) => handlePriceChange('laborPerHour', parseFloat(e.target.value) || 0)}
                      className="app-input pl-6 text-sm"
                      min="0"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="app-label text-xs">Dump Fee</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-sm">$</span>
                    <input
                      type="number"
                      value={formData.prices.dumpFee || ''}
                      onChange={(e) => handlePriceChange('dumpFee', parseFloat(e.target.value) || 0)}
                      className="app-input pl-6 text-sm"
                      min="0"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Surcharges */}
            <div>
              <h5 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">🔧 Specialty Surcharges</h5>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { field: 'trampoline', label: 'Trampoline' },
                  { field: 'hotTub', label: 'Hot Tub' },
                  { field: 'piano', label: 'Piano' },
                ].map(({ field, label }) => (
                  <div key={field}>
                    <label className="app-label text-xs">{label}</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)] text-sm">$</span>
                      <input
                        type="number"
                        value={formData.prices.surcharges?.[field as keyof NonNullable<typeof formData.prices.surcharges>] || ''}
                        onChange={(e) => handleSurchargeChange(field, parseFloat(e.target.value) || 0)}
                        className="app-input pl-6 text-sm"
                        min="0"
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="app-btn-primary text-sm flex-1"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {editingId ? 'Update' : 'Create'} Template
                  </>
                )}
              </button>
              <button onClick={resetForm} className="app-btn-secondary text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates List */}
      {templates.length === 0 ? (
        <div className="text-center py-8 text-[var(--color-text-muted)]">
          <span className="text-4xl mb-3 block">📋</span>
          <p>No pricing templates yet.</p>
          <p className="text-sm">Create templates to speed up quote creation.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className={`p-4 rounded-xl border transition ${
                template.isDefault
                  ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/30'
                  : 'bg-[var(--color-bg-card)] border-[var(--color-border)]'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-[var(--color-text-primary)]">{template.name}</h4>
                  {template.isDefault && (
                    <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-medium">
                      Default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!template.isDefault && (
                    <button
                      onClick={() => handleSetDefault(template.id)}
                      className="p-2 text-[var(--color-text-faint)] hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition"
                      title="Set as default"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(template)}
                    className="p-2 text-[var(--color-text-faint)] hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  {!template.isDefault && (
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="p-2 text-[var(--color-text-faint)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Price Preview Grid — custom items when present, else legacy junk fields */}
              {template.prices.items && template.prices.items.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {template.prices.items.slice(0, 8).map((it, i) => (
                    <div key={i} className="bg-[var(--color-bg-card)]/50 rounded-lg p-2 text-center">
                      <div className="text-[var(--color-text-muted)] truncate" title={it.label}>{it.label}</div>
                      <div className="font-semibold text-[var(--color-text-primary)]">{formatCurrency(it.amount ?? 0)}</div>
                    </div>
                  ))}
                </div>
              ) : (
              <div className="grid grid-cols-4 md:grid-cols-8 gap-2 text-xs">
                <div className="bg-[var(--color-bg-card)]/50 rounded-lg p-2 text-center">
                  <div className="text-[var(--color-text-muted)]">Min</div>
                  <div className="font-semibold text-[var(--color-text-primary)]">{formatCurrency(template.prices.minimumFee ?? 0)}</div>
                </div>
                <div className="bg-[var(--color-bg-card)]/50 rounded-lg p-2 text-center">
                  <div className="text-[var(--color-text-muted)]">1/4</div>
                  <div className="font-semibold text-[var(--color-text-primary)]">{formatCurrency(template.prices.quarterLoad ?? 0)}</div>
                </div>
                <div className="bg-[var(--color-bg-card)]/50 rounded-lg p-2 text-center">
                  <div className="text-[var(--color-text-muted)]">1/2</div>
                  <div className="font-semibold text-[var(--color-text-primary)]">{formatCurrency(template.prices.halfLoad ?? 0)}</div>
                </div>
                <div className="bg-[var(--color-bg-card)]/50 rounded-lg p-2 text-center">
                  <div className="text-[var(--color-text-muted)]">3/4</div>
                  <div className="font-semibold text-[var(--color-text-primary)]">{formatCurrency(template.prices.threeQuarterLoad ?? 0)}</div>
                </div>
                <div className="bg-[var(--color-bg-card)]/50 rounded-lg p-2 text-center">
                  <div className="text-[var(--color-text-muted)]">Full</div>
                  <div className="font-semibold text-[var(--color-text-primary)]">{formatCurrency(template.prices.fullLoad ?? 0)}</div>
                </div>
                <div className="bg-[var(--color-bg-card)]/50 rounded-lg p-2 text-center">
                  <div className="text-[var(--color-text-muted)]">Labor/hr</div>
                  <div className="font-semibold text-[var(--color-text-primary)]">{formatCurrency(template.prices.laborPerHour ?? 0)}</div>
                </div>
                <div className="bg-[var(--color-bg-card)]/50 rounded-lg p-2 text-center">
                  <div className="text-[var(--color-text-muted)]">Dump</div>
                  <div className="font-semibold text-[var(--color-text-primary)]">{formatCurrency(template.prices.dumpFee ?? 0)}</div>
                </div>
                <div className="bg-[var(--color-bg-card)]/50 rounded-lg p-2 text-center">
                  <div className="text-[var(--color-text-muted)]">Hot Tub</div>
                  <div className="font-semibold text-[var(--color-text-primary)]">{formatCurrency(template.prices.surcharges?.hotTub ?? 0)}</div>
                </div>
              </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tip */}
      {templates.length > 0 && (
        <div className="mt-6 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800/30 rounded-xl p-4">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            💡 <strong>Tip:</strong> Your default template will auto-fill the Quote Builder. You can always adjust prices for individual quotes.
          </p>
        </div>
      )}
    </div>
  )
}
