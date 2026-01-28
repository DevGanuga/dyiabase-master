'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppPriceTemplate } from '@/types/database'
import { formatCurrency } from '@/lib/utils'

interface PriceTemplatesProps {
  userId: string
  showSuccess: (message: string) => void
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

const defaultFormData: TemplateFormData = {
  name: '',
  prices: { ...DEFAULT_PRICES }
}

export function PriceTemplates({ userId, showSuccess }: PriceTemplatesProps) {
  const [templates, setTemplates] = useState<AppPriceTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<TemplateFormData>(defaultFormData)
  const [saving, setSaving] = useState(false)

  const supabase = useMemo(() => createClient(), [])

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
              minimumFee: t.prices?.minimumFee ?? DEFAULT_PRICES.minimumFee,
              quarterLoad: t.prices?.quarterLoad ?? DEFAULT_PRICES.quarterLoad,
              halfLoad: t.prices?.halfLoad ?? DEFAULT_PRICES.halfLoad,
              threeQuarterLoad: t.prices?.threeQuarterLoad ?? DEFAULT_PRICES.threeQuarterLoad,
              fullLoad: t.prices?.fullLoad ?? DEFAULT_PRICES.fullLoad,
              additionalLoads: t.prices?.additionalLoads ?? DEFAULT_PRICES.additionalLoads,
              laborPerHour: t.prices?.laborPerHour ?? DEFAULT_PRICES.laborPerHour,
              dumpFee: t.prices?.dumpFee ?? DEFAULT_PRICES.dumpFee,
              surcharges: {
                trampoline: t.prices?.surcharges?.trampoline ?? DEFAULT_PRICES.surcharges.trampoline,
                hotTub: t.prices?.surcharges?.hotTub ?? DEFAULT_PRICES.surcharges.hotTub,
                piano: t.prices?.surcharges?.piano ?? DEFAULT_PRICES.surcharges.piano,
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
    setFormData({ name: '', prices: { ...DEFAULT_PRICES } })
    setEditingId(null)
    setShowForm(false)
  }, [])

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
        surcharges: { ...prev.prices.surcharges, [field]: Math.max(0, value) }
      }
    }))
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a template name')
      return
    }

    setSaving(true)

    try {
      if (editingId) {
        // Update existing template
        const { error } = await supabase
          .from('dyia_price_templates')
          .update({
            name: formData.name.trim(),
            prices: formData.prices
          })
          .eq('id', editingId)

        if (error) throw error

        setTemplates(templates.map(t =>
          t.id === editingId
            ? { ...t, name: formData.name.trim(), prices: formData.prices }
            : t
        ))
        showSuccess('Template updated!')
      } else {
        // Create new template
        const isFirst = templates.length === 0
        const { data, error } = await supabase
          .from('dyia_price_templates')
          .insert({
            user_id: userId,
            name: formData.name.trim(),
            prices: formData.prices,
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
            prices: formData.prices
          }, ...templates])
        }
        showSuccess('Template created!')
      }
      resetForm()
    } catch (error) {
      console.error('Error saving template:', error)
      alert('Error saving template')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    const template = templates.find(t => t.id === id)
    if (template?.isDefault) {
      alert('Cannot delete the default template. Set another template as default first.')
      return
    }
    
    if (!confirm('Delete this template?')) return

    try {
      const { error } = await supabase
        .from('dyia_price_templates')
        .delete()
        .eq('id', id)

      if (error) throw error

      setTemplates(templates.filter(t => t.id !== id))
      showSuccess('Template deleted!')
    } catch (error) {
      console.error('Error deleting template:', error)
      alert('Error deleting template')
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
      alert('Error setting default template')
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
            <h3 className="font-semibold text-slate-900">Pricing Templates</h3>
            <p className="text-sm text-slate-500">Pre-set pricing for quick quote creation</p>
          </div>
        </div>
        <button
          onClick={() => {
            setFormData({ name: '', prices: { ...DEFAULT_PRICES } })
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
        <div className="bg-slate-50 rounded-xl p-5 mb-6 border border-slate-200">
          <h4 className="font-medium text-slate-900 mb-4">
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

            {/* Load Sizes */}
            <div>
              <h5 className="text-sm font-medium text-slate-700 mb-3">📦 Load Sizes</h5>
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
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
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
              <h5 className="text-sm font-medium text-slate-700 mb-3">⚙️ Labor & Fees</h5>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="app-label text-xs">Labor (per hour)</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
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
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
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
              <h5 className="text-sm font-medium text-slate-700 mb-3">🔧 Specialty Surcharges</h5>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { field: 'trampoline', label: 'Trampoline' },
                  { field: 'hotTub', label: 'Hot Tub' },
                  { field: 'piano', label: 'Piano' },
                ].map(({ field, label }) => (
                  <div key={field}>
                    <label className="app-label text-xs">{label}</label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                      <input
                        type="number"
                        value={formData.prices.surcharges[field as keyof typeof formData.prices.surcharges] || ''}
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
        <div className="text-center py-8 text-slate-500">
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
                  ? 'bg-orange-50 border-orange-200'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-slate-900">{template.name}</h4>
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
                      className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition"
                      title="Set as default"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(template)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  {!template.isDefault && (
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Price Preview Grid */}
              <div className="grid grid-cols-4 md:grid-cols-8 gap-2 text-xs">
                <div className="bg-white/50 rounded-lg p-2 text-center">
                  <div className="text-slate-500">Min</div>
                  <div className="font-semibold text-slate-900">{formatCurrency(template.prices.minimumFee)}</div>
                </div>
                <div className="bg-white/50 rounded-lg p-2 text-center">
                  <div className="text-slate-500">1/4</div>
                  <div className="font-semibold text-slate-900">{formatCurrency(template.prices.quarterLoad)}</div>
                </div>
                <div className="bg-white/50 rounded-lg p-2 text-center">
                  <div className="text-slate-500">1/2</div>
                  <div className="font-semibold text-slate-900">{formatCurrency(template.prices.halfLoad)}</div>
                </div>
                <div className="bg-white/50 rounded-lg p-2 text-center">
                  <div className="text-slate-500">3/4</div>
                  <div className="font-semibold text-slate-900">{formatCurrency(template.prices.threeQuarterLoad)}</div>
                </div>
                <div className="bg-white/50 rounded-lg p-2 text-center">
                  <div className="text-slate-500">Full</div>
                  <div className="font-semibold text-slate-900">{formatCurrency(template.prices.fullLoad)}</div>
                </div>
                <div className="bg-white/50 rounded-lg p-2 text-center">
                  <div className="text-slate-500">Labor/hr</div>
                  <div className="font-semibold text-slate-900">{formatCurrency(template.prices.laborPerHour)}</div>
                </div>
                <div className="bg-white/50 rounded-lg p-2 text-center">
                  <div className="text-slate-500">Dump</div>
                  <div className="font-semibold text-slate-900">{formatCurrency(template.prices.dumpFee)}</div>
                </div>
                <div className="bg-white/50 rounded-lg p-2 text-center">
                  <div className="text-slate-500">Hot Tub</div>
                  <div className="font-semibold text-slate-900">{formatCurrency(template.prices.surcharges.hotTub)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tip */}
      {templates.length > 0 && (
        <div className="mt-6 bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-sm text-amber-800">
            💡 <strong>Tip:</strong> Your default template will auto-fill the Quote Builder. You can always adjust prices for individual quotes.
          </p>
        </div>
      )}
    </div>
  )
}
