'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppSettings, UserProfile } from '@/types/database'
import { compressImage, formatCurrency } from '@/lib/utils'
import { FixedExpenses } from './FixedExpenses'
import { PriceTemplates } from './PriceTemplates'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { useSubscription } from '@/hooks/useSubscription'
import { useClerk } from '@clerk/nextjs'

interface SettingsProps {
  settings: AppSettings
  setSettings: (settings: AppSettings) => void
  userId: string
  showSuccess: (message: string) => void
  userProfile?: UserProfile | null
  userEmail?: string
  userImageUrl?: string
  userName?: string
  isDemoMode?: boolean
}

export function Settings({ settings, setSettings, userId, showSuccess, userProfile, userEmail, userImageUrl, userName, isDemoMode = false }: SettingsProps) {
  const hookSub = useSubscription()
  const clerk = useClerk()

  // Prefer userProfile-derived subscription data (handles demo mode correctly)
  const subscription = userProfile ? {
    ...hookSub,
    tier: (userProfile.subscription_status === 'trialing' ? 'trial'
      : ['active', 'trialing'].includes(userProfile.subscription_status) ? 'pro'
        : 'basic') as 'basic' | 'trial' | 'pro',
    isPro: ['active', 'trialing'].includes(userProfile.subscription_status),
    status: userProfile.subscription_status,
    plan: (userProfile.subscription_plan || null) as 'monthly' | 'annual' | null,
    daysRemaining: userProfile.subscription_ends_at
      ? Math.max(0, Math.ceil((new Date(userProfile.subscription_ends_at).getTime() - Date.now()) / 86400000))
      : 0,
    aiCredits: userProfile.ai_credits_balance || 0,
    canUseAI: ['active', 'trialing'].includes(userProfile.subscription_status) || (userProfile.ai_credits_balance || 0) > 0,
    isLoading: false,
  } : hookSub
  const [businessName, setBusinessName] = useState(settings.businessInfo.name)
  const [businessPhone, setBusinessPhone] = useState(settings.businessInfo.phone)
  const [businessEmail, setBusinessEmail] = useState(settings.businessInfo.email)
  const [businessAddress, setBusinessAddress] = useState(settings.businessInfo.address)
  const [reviewUrl, setReviewUrl] = useState(settings.businessInfo.reviewUrl ?? '')
  const [reviewUrlGoogle, setReviewUrlGoogle] = useState(settings.businessInfo.reviewUrlGoogle ?? '')
  const [reviewUrlYelp, setReviewUrlYelp] = useState(settings.businessInfo.reviewUrlYelp ?? '')
  const [reviewUrlFacebook, setReviewUrlFacebook] = useState(settings.businessInfo.reviewUrlFacebook ?? '')
  const [taxPercentage, setTaxPercentage] = useState(settings.taxPercentage)
  const [monthlyGoal, setMonthlyGoal] = useState(settings.monthlyGoal)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  const supabase = createClient()
  const { confirm, alert } = useConfirm()

  const openBillingPortal = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        await alert({ title: 'Billing', message: data.error || 'Could not open billing', variant: 'warning' })
        return
      }
      if (data.url) window.location.href = data.url
    } catch {
      await alert({ title: 'Error', message: 'Failed to open billing portal', variant: 'error' })
    } finally {
      setPortalLoading(false)
    }
  }

  const exportData = async () => {
    setExportLoading(true)
    try {
      const res = await fetch('/api/export/data')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dyia-export-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      showSuccess('Export downloaded')
    } catch {
      await alert({ title: 'Error', message: 'Failed to export data', variant: 'error' })
    } finally {
      setExportLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)

    try {
      const dbSettings: Record<string, unknown> = {
        tax_percentage: taxPercentage,
        monthly_goal: Math.max(0, monthlyGoal),
        business_name: businessName || null,
        business_phone: businessPhone || null,
        business_email: businessEmail || null,
        business_address: businessAddress || null,
        business_logo: settings.businessInfo.logo,
        review_url: reviewUrl?.trim() || null
      }
      // Only include per-platform review URLs when migration 011 has been applied
      if (Object.prototype.hasOwnProperty.call(settings.businessInfo, 'reviewUrlGoogle')) {
        dbSettings.review_url_google = reviewUrlGoogle?.trim() || null
        dbSettings.review_url_yelp = reviewUrlYelp?.trim() || null
        dbSettings.review_url_facebook = reviewUrlFacebook?.trim() || null
      }

      const { error } = await supabase
        .from('dyia_settings')
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
          logo: settings.businessInfo.logo,
          reviewUrl: reviewUrl?.trim() || null,
          ...(Object.prototype.hasOwnProperty.call(settings.businessInfo, 'reviewUrlGoogle') && {
            reviewUrlGoogle: reviewUrlGoogle?.trim() || null,
            reviewUrlYelp: reviewUrlYelp?.trim() || null,
            reviewUrlFacebook: reviewUrlFacebook?.trim() || null
          })
        },
        onboardingCompleted: settings.onboardingCompleted,
        onboardingSkipped: settings.onboardingSkipped,
        onboardingCompletedAt: settings.onboardingCompletedAt
      })

      showSuccess('✅ Settings saved!')
    } catch (error) {
      console.error('Error saving settings:', error)
      await alert({ title: 'Error', message: 'Error saving settings.', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      await alert({ title: 'File Too Large', message: 'Logo file is too large. Please use an image under 2MB.', variant: 'warning' })
      return
    }

    setUploadingLogo(true)

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const dataUrl = event.target?.result as string
        const compressed = await compressImage(dataUrl, 400, 0.8)

        const { error } = await supabase
          .from('dyia_settings')
          .update({ business_logo: compressed })
          .eq('user_id', userId)

        if (error) {
          console.error('Error uploading logo:', error)
          await alert({ title: 'Error', message: 'Error uploading logo.', variant: 'error' })
          return
        }

        setSettings({
          ...settings,
          businessInfo: { ...settings.businessInfo, logo: compressed }
        })

        showSuccess('✅ Logo uploaded!')
      } catch (err) {
        console.error('Error processing logo:', err)
        await alert({ title: 'Error', message: 'Error processing logo image.', variant: 'error' })
      } finally {
        setUploadingLogo(false)
      }
    }
    reader.onerror = () => {
      setUploadingLogo(false)
      alert({ title: 'Error', message: 'Error reading file. Please try again.', variant: 'error' })
    }
    reader.readAsDataURL(file)
  }

  const removeLogo = async () => {
    const ok = await confirm({ title: 'Remove Logo', message: 'Are you sure you want to remove the uploaded logo?', confirmLabel: 'Remove', variant: 'danger' })
    if (!ok) return

    const { error } = await supabase
      .from('dyia_settings')
      .update({ business_logo: null })
      .eq('user_id', userId)

    if (error) {
      console.error('Error removing logo:', error)
      await alert({ title: 'Error', message: 'Error removing logo.', variant: 'error' })
      return
    }

    setSettings({
      ...settings,
      businessInfo: { ...settings.businessInfo, logo: null }
    })

    showSuccess('🗑️ Logo removed!')
  }

  const [activeTab, setActiveTab] = useState<'business' | 'financial' | 'expenses' | 'templates' | 'account'>('business')

  const tabs = [
    { id: 'business' as const, label: 'Business', icon: '🏢' },
    { id: 'financial' as const, label: 'Financial', icon: '🐷' },
    { id: 'expenses' as const, label: 'Expenses', icon: '📊' },
    { id: 'templates' as const, label: 'Templates', icon: '📋' },
    { id: 'account' as const, label: 'Account', icon: '👤' },
  ]

  return (
    <div className="animate-fade-in">
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your business profile and preferences</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <span className="text-base">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Business Information */}
      {activeTab === 'business' && (
      <>
      <div className="app-card mb-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">🏢</span>
          <div>
            <h3 className="font-semibold text-[var(--color-text-primary)]">Business Information</h3>
            <p className="text-sm text-[var(--color-text-muted)]">This appears on your quotes</p>
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

          <div>
            <label className="app-label">Review link (for completed jobs)</label>
            <input
              type="url"
              value={reviewUrl}
              onChange={(e) => setReviewUrl(e.target.value)}
              className="app-input"
              placeholder="https://g.page/your-business/review"
            />
            <p className="mt-1 text-xs text-slate-500">Used for copy-paste review requests on completed quotes.</p>
          </div>
          {Object.prototype.hasOwnProperty.call(settings.businessInfo, 'reviewUrlGoogle') && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="app-label">Review link — Google</label>
                  <input
                    type="url"
                    value={reviewUrlGoogle}
                    onChange={(e) => setReviewUrlGoogle(e.target.value)}
                    className="app-input"
                    placeholder="https://g.page/..."
                  />
                </div>
                <div>
                  <label className="app-label">Review link — Yelp</label>
                  <input
                    type="url"
                    value={reviewUrlYelp}
                    onChange={(e) => setReviewUrlYelp(e.target.value)}
                    className="app-input"
                    placeholder="https://yelp.com/..."
                  />
                </div>
                <div>
                  <label className="app-label">Review link — Facebook</label>
                  <input
                    type="url"
                    value={reviewUrlFacebook}
                    onChange={(e) => setReviewUrlFacebook(e.target.value)}
                    className="app-input"
                    placeholder="https://facebook.com/..."
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">Optional. When set, the selected platform in the review modal uses this link.</p>
            </>
          )}

          {/* Logo Upload */}
          <div>
            <label className="app-label">Business Logo</label>
            <p className="text-sm text-[var(--color-text-muted)] mb-3">Upload a logo to display on your quotes (max 2MB)</p>
            
            {settings.businessInfo.logo ? (
              <div className="flex items-start gap-4">
                <div className="relative">
                  <img
                    src={settings.businessInfo.logo}
                    alt="Business Logo"
                    className="w-32 h-32 object-contain rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)]"
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
                <div className="w-full max-w-xs aspect-video bg-[var(--color-bg-subtle)] border-2 border-dashed border-[var(--color-border)] rounded-xl flex flex-col items-center justify-center gap-2 hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-900/20 transition-all">
                  {uploadingLogo ? (
                    <>
                      <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                      <span className="text-sm text-[var(--color-text-muted)]">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-8 h-8 text-[var(--color-text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm text-[var(--color-text-muted)]">Click to upload logo</span>
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

      {/* Save Button - Business */}
      <div className="flex justify-end mt-6">
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
      </>
      )}

      {/* Tax & Savings */}
      {activeTab === 'financial' && (
      <>
      <div className="app-card mb-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">🐷</span>
          <div>
            <h3 className="font-semibold text-[var(--color-text-primary)]">Tax & Savings Set-Aside</h3>
            <p className="text-sm text-[var(--color-text-muted)]">Percentage of profit to set aside for taxes</p>
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
            <div className="flex justify-between text-xs text-[var(--color-text-faint)] mt-2">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
            </div>
          </div>
          <div className="text-center sm:text-right">
            <div className="text-4xl font-bold text-orange-600">{taxPercentage}%</div>
            <p className="text-sm text-[var(--color-text-muted)]">of profit</p>
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
            <h3 className="font-semibold text-[var(--color-text-primary)]">Monthly Revenue Goal</h3>
            <p className="text-sm text-[var(--color-text-muted)]">Track your progress on the dashboard</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <label className="app-label">Target Revenue</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]">$</span>
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

      {/* Save Button - Financial */}
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
      </>
      )}

      {/* Fixed Expenses */}
      {activeTab === 'expenses' && (
        <FixedExpenses userId={userId} showSuccess={showSuccess} />
      )}

      {/* Pricing Templates */}
      {activeTab === 'templates' && (
        <PriceTemplates userId={userId} showSuccess={showSuccess} />
      )}

      {/* Account Tab */}
      {activeTab === 'account' && (
      <>
        {/* Profile Card */}
        <div className="app-card mb-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-2xl">👤</span>
            <div>
              <h3 className="font-semibold text-[var(--color-text-primary)]">Profile</h3>
              <p className="text-sm text-[var(--color-text-muted)]">Your personal information</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {userImageUrl ? (
              <img src={userImageUrl} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-[var(--color-border)]" />
            ) : (
              <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center border-2 border-[var(--color-border)]">
                <span className="text-xl font-bold text-orange-500">
                  {(userName || userEmail || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              {userName && (
                <p className="text-lg font-semibold text-[var(--color-text-primary)] truncate">{userName}</p>
              )}
              {userEmail && (
                <p className="text-sm text-[var(--color-text-muted)] truncate">{userEmail}</p>
              )}
            </div>
          </div>
          {!isDemoMode && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => clerk.openUserProfile()}
                className="app-btn-secondary text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Profile
              </button>
              <button
                onClick={() => clerk.openUserProfile({ customPages: [] })}
                className="app-btn-secondary text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Security & Password
              </button>
            </div>
          )}
        </div>

        {/* Subscription Card */}
        <div className="app-card mb-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-2xl">💎</span>
            <div>
              <h3 className="font-semibold text-[var(--color-text-primary)]">Subscription</h3>
              <p className="text-sm text-[var(--color-text-muted)]">Your current plan and billing</p>
            </div>
          </div>

          {subscription.isLoading ? (
            <div className="flex items-center gap-3 py-4">
              <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-[var(--color-text-muted)]">Loading subscription...</span>
            </div>
          ) : (
            <>
              {/* Current Plan Display */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)] mb-5">
                <div className="flex-1">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                      subscription.tier === 'pro' 
                        ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400' 
                        : subscription.tier === 'trial'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      {subscription.tier === 'pro' ? 'PRO' : subscription.tier === 'trial' ? 'TRIAL' : 'FREE'}
                    </span>
                    {subscription.plan && (
                      <span className="text-xs text-[var(--color-text-muted)] capitalize">{subscription.plan}</span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {subscription.tier === 'pro' 
                      ? 'Full access to all features including AI assistant, reports, and marketing tools.'
                      : subscription.tier === 'trial'
                        ? `Your free trial is active. ${subscription.daysRemaining} day${subscription.daysRemaining !== 1 ? 's' : ''} remaining.`
                        : 'Basic access. Upgrade to Pro for AI assistant, advanced reports, marketing tools, and email blasts.'}
                  </p>
                  {subscription.tier === 'trial' && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden w-40">
                        <div 
                          className={`h-full rounded-full transition-all ${subscription.daysRemaining <= 3 ? 'bg-red-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.max(5, (subscription.daysRemaining / 14) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-[var(--color-text-faint)] mt-1">{subscription.daysRemaining} of 14 days remaining</p>
                    </div>
                  )}
                </div>
                {subscription.canUseAI && (
                  <div className="text-center px-4 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)]">
                    <p className="text-lg font-bold text-[var(--color-text-primary)]">{subscription.aiCredits}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">AI Credits</p>
                  </div>
                )}
              </div>

              {/* Plan Comparison */}
              {subscription.tier !== 'pro' && !isDemoMode && (
                <div className="mb-5">
                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                    {subscription.tier === 'basic' ? 'Start Your 14-Day Free Trial' : 'Upgrade to Pro'}
                  </h4>
                  <p className="text-xs text-[var(--color-text-muted)] mb-3">
                    {subscription.tier === 'basic' ? 'Try Pro free for 14 days. You won\'t be charged until the trial ends.' : 'Keep your Pro features active.'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Monthly */}
                    <button
                      onClick={async () => {
                        const priceId = process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID
                        if (!priceId) { await alert({ title: 'Error', message: 'Pricing not configured.', variant: 'error' }); return }
                        try {
                          const res = await fetch('/api/stripe/checkout', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              priceId,
                              clerkUserId: userProfile?.clerk_user_id,
                              userEmail: userProfile?.email || userEmail,
                            }),
                          })
                          const data = await res.json()
                          if (data.url) window.location.href = data.url
                          else if (data.error) await alert({ title: 'Error', message: data.error, variant: 'error' })
                        } catch { await alert({ title: 'Error', message: 'Could not start checkout.', variant: 'error' }) }
                      }}
                      className="flex flex-col items-center p-4 rounded-xl border-2 border-[var(--color-border)] hover:border-orange-500 transition-colors text-left group"
                    >
                      <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Monthly</span>
                      <span className="text-2xl font-bold text-[var(--color-text-primary)]">$29.99<span className="text-sm font-normal text-[var(--color-text-muted)]">/mo</span></span>
                      <span className="text-xs text-[var(--color-text-muted)] mt-1">Cancel anytime</span>
                    </button>
                    {/* Annual */}
                    <button
                      onClick={async () => {
                        const priceId = process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID
                        if (!priceId) { await alert({ title: 'Error', message: 'Pricing not configured.', variant: 'error' }); return }
                        try {
                          const res = await fetch('/api/stripe/checkout', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              priceId,
                              clerkUserId: userProfile?.clerk_user_id,
                              userEmail: userProfile?.email || userEmail,
                            }),
                          })
                          const data = await res.json()
                          if (data.url) window.location.href = data.url
                          else if (data.error) await alert({ title: 'Error', message: data.error, variant: 'error' })
                        } catch { await alert({ title: 'Error', message: 'Could not start checkout.', variant: 'error' }) }
                      }}
                      className="relative flex flex-col items-center p-4 rounded-xl border-2 border-orange-500/50 hover:border-orange-500 bg-orange-500/5 transition-colors text-left group"
                    >
                      <span className="absolute -top-2.5 right-3 px-2 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full">2 MONTHS FREE</span>
                      <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Annual</span>
                      <span className="text-2xl font-bold text-[var(--color-text-primary)]">$24.99<span className="text-sm font-normal text-[var(--color-text-muted)]">/mo</span></span>
                      <span className="text-xs text-[var(--color-text-muted)] mt-1">$299.90 billed yearly</span>
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-[var(--color-text-muted)]">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      AI Business Assistant
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Advanced Reports
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Marketing Tools
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      Mass Email Blasts
                    </div>
                  </div>
                </div>
              )}

              {/* Manage Billing */}
              {(subscription.tier === 'pro' || userProfile?.stripe_customer_id) && (
                <button
                  type="button"
                  onClick={openBillingPortal}
                  disabled={portalLoading}
                  className="app-btn-secondary w-full sm:w-auto"
                >
                  {portalLoading ? 'Opening…' : 'Manage Billing & Invoices'}
                </button>
              )}
            </>
          )}
        </div>

        {/* Data & Export Card */}
        <div className="app-card mb-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-2xl">📦</span>
            <div>
              <h3 className="font-semibold text-[var(--color-text-primary)]">Data</h3>
              <p className="text-sm text-[var(--color-text-muted)]">Export your business data</p>
            </div>
          </div>
          <button
            type="button"
            onClick={exportData}
            disabled={exportLoading}
            className="app-btn-secondary"
          >
            {exportLoading ? 'Preparing…' : 'Export all data (CSV)'}
          </button>
          <p className="text-xs text-[var(--color-text-faint)] mt-2">
            Download all your jobs, quotes, and customer data as a CSV file.
          </p>
        </div>
      </>
      )}
    </div>
  )
}
