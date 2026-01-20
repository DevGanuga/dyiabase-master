'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppSettings } from '@/types/database'
import { compressImage, formatCurrency } from '@/lib/utils'

interface SettingsProps {
  settings: AppSettings
  setSettings: (settings: AppSettings) => void
  userId: string
  showSuccess: (message: string) => void
}

export function Settings({ settings, setSettings, userId, showSuccess }: SettingsProps) {
  const [businessName, setBusinessName] = useState(settings.businessInfo.name)
  const [businessPhone, setBusinessPhone] = useState(settings.businessInfo.phone)
  const [businessEmail, setBusinessEmail] = useState(settings.businessInfo.email)
  const [businessAddress, setBusinessAddress] = useState(settings.businessInfo.address)
  const [taxPercentage, setTaxPercentage] = useState(settings.taxPercentage)
  const [monthlyGoal, setMonthlyGoal] = useState(settings.monthlyGoal)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const supabase = createClient()

  const saveSettings = async () => {
    setSaving(true)

    try {
      const dbSettings = {
        tax_percentage: taxPercentage,
        monthly_goal: Math.max(0, monthlyGoal),
        business_name: businessName || null,
        business_phone: businessPhone || null,
        business_email: businessEmail || null,
        business_address: businessAddress || null,
        business_logo: settings.businessInfo.logo
      }

      const { error } = await supabase
        .from('junkprofit_settings')
        .update(dbSettings)
        .eq('user_id', userId)

      if (error) throw error

      setSettings({
        taxPercentage,
        monthlyGoal,
        businessInfo: {
          name: businessName,
          phone: businessPhone,
          email: businessEmail,
          address: businessAddress,
          logo: settings.businessInfo.logo
        }
      })

      showSuccess('✅ Settings saved!')
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Error saving settings')
    } finally {
      setSaving(false)
    }
  }

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      alert('Logo file is too large. Please use an image under 2MB.')
      return
    }

    setUploadingLogo(true)

    const reader = new FileReader()
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string
      const compressed = await compressImage(dataUrl, 400, 0.8)

      const { error } = await supabase
        .from('junkprofit_settings')
        .update({ business_logo: compressed })
        .eq('user_id', userId)

      setUploadingLogo(false)

      if (error) {
        console.error('Error uploading logo:', error)
        alert('Error uploading logo')
        return
      }

      setSettings({
        ...settings,
        businessInfo: { ...settings.businessInfo, logo: compressed }
      })

      showSuccess('✅ Logo uploaded!')
    }
    reader.readAsDataURL(file)
  }

  const removeLogo = async () => {
    if (!confirm('Remove the uploaded logo?')) return

    const { error } = await supabase
      .from('junkprofit_settings')
      .update({ business_logo: null })
      .eq('user_id', userId)

    if (error) {
      console.error('Error removing logo:', error)
      alert('Error removing logo')
      return
    }

    setSettings({
      ...settings,
      businessInfo: { ...settings.businessInfo, logo: null }
    })

    showSuccess('🗑️ Logo removed!')
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header mb-8">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your business profile and preferences</p>
        </div>
      </div>

      {/* Business Information */}
      <div className="app-card mb-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">🏢</span>
          <div>
            <h3 className="font-semibold text-slate-900">Business Information</h3>
            <p className="text-sm text-slate-500">This appears on your quotes</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="app-label">Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="app-input"
              placeholder="Your Junk Removal Co."
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="app-label">Phone Number</label>
              <input
                type="tel"
                value={businessPhone}
                onChange={(e) => setBusinessPhone(e.target.value)}
                className="app-input"
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className="app-label">Email</label>
              <input
                type="email"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
                className="app-input"
                placeholder="info@company.com"
              />
            </div>
          </div>
          
          <div>
            <label className="app-label">Address</label>
            <input
              type="text"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              className="app-input"
              placeholder="123 Main St, City, State"
            />
          </div>

          {/* Logo Upload */}
          <div>
            <label className="app-label">Business Logo</label>
            <p className="text-sm text-slate-500 mb-3">Upload a logo to display on your quotes (max 2MB)</p>
            
            {settings.businessInfo.logo ? (
              <div className="flex items-start gap-4">
                <div className="relative">
                  <img
                    src={settings.businessInfo.logo}
                    alt="Business Logo"
                    className="w-32 h-32 object-contain rounded-xl border border-slate-200 bg-slate-50"
                  />
                  <button
                    onClick={removeLogo}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs shadow-lg transition"
                    title="Remove logo"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex-1">
                  <label className="cursor-pointer">
                    <span className="app-btn-secondary text-sm inline-flex">
                      Change Logo
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={uploadLogo}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="cursor-pointer block">
                <div className="w-full max-w-xs aspect-video bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all">
                  {uploadingLogo ? (
                    <>
                      <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                      <span className="text-sm text-slate-500">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm text-slate-500">Click to upload logo</span>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={uploadLogo}
                  className="hidden"
                  disabled={uploadingLogo}
                />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Tax & Savings */}
      <div className="app-card mb-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">🐷</span>
          <div>
            <h3 className="font-semibold text-slate-900">Tax & Savings Set-Aside</h3>
            <p className="text-sm text-slate-500">Percentage of profit to set aside for taxes</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-1">
            <input
              type="range"
              value={taxPercentage}
              onChange={(e) => setTaxPercentage(parseInt(e.target.value))}
              min="0"
              max="50"
              className="app-slider w-full"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-2">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
            </div>
          </div>
          <div className="text-center sm:text-right">
            <div className="text-4xl font-bold text-emerald-600">{taxPercentage}%</div>
            <p className="text-sm text-slate-500">of profit</p>
          </div>
        </div>
        
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mt-5">
          <p className="text-sm text-amber-800">
            💡 <strong>Pro tip:</strong> Most self-employed contractors should set aside 25-30% for federal + state taxes and self-employment tax.
          </p>
        </div>
      </div>

      {/* Monthly Goal */}
      <div className="app-card mb-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">🎯</span>
          <div>
            <h3 className="font-semibold text-slate-900">Monthly Revenue Goal</h3>
            <p className="text-sm text-slate-500">Track your progress on the dashboard</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <label className="app-label">Target Revenue</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number"
                value={monthlyGoal || ''}
                onChange={(e) => setMonthlyGoal(Math.max(0, parseFloat(e.target.value) || 0))}
                className="app-input pl-8"
                min="0"
                placeholder="10000"
              />
            </div>
          </div>
          {monthlyGoal > 0 && (
            <div className="text-slate-600 text-sm pb-3">
              = <strong>{formatCurrency(monthlyGoal / 4)}</strong>/week or <strong>{formatCurrency(monthlyGoal / 30)}</strong>/day
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button 
          onClick={saveSettings} 
          disabled={saving} 
          className="app-btn-primary"
        >
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
              Save Settings
            </>
          )}
        </button>
      </div>
    </div>
  )
}
