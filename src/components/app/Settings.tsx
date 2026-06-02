'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AppSettings, UserProfile } from '@/types/database'
import { compressImage, formatCurrency, formatLocalDateInput } from '@/lib/utils'
import { FixedExpenses } from './FixedExpenses'
import { PriceTemplates } from './PriceTemplates'
import { useConfirm } from '@/components/providers/ConfirmProvider'
import { useSubscription } from '@/hooks/useSubscription'
import { computeSubscriptionState } from '@/lib/subscription'
import { useClerk } from '@clerk/nextjs'

type SettingsTabId = 'business' | 'financial' | 'expenses' | 'templates' | 'account'

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
  /** When set, open this tab (e.g. from launchpad "Add business info" or "Save a price template") */
  initialTab?: SettingsTabId | null
  onDataChanged?: () => void
  onOpenPayments?: () => void
}

export function Settings({ settings, setSettings, userId, showSuccess, userProfile, userEmail, userImageUrl, userName, isDemoMode = false, initialTab, onDataChanged, onOpenPayments }: SettingsProps) {
  const hookSub = useSubscription()
  const clerk = useClerk()

  // Round 4 (BUG-022): use the unified subscription computer when we have a
  // userProfile (handles demo mode and admin overrides accurately) and fall
  // back to the live hook value otherwise. Both code paths run the same
  // `computeSubscriptionState` so the badge, banners, and feature gates
  // can never disagree about a user's tier.
  const subscription = userProfile
    ? { ...computeSubscriptionState(userProfile), isLoading: false }
    : hookSub
  const isAdminAccount = !!userProfile?.is_admin || ['admin', 'super_admin'].includes(userProfile?.role || '')
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
  const [downgradeLoading, setDowngradeLoading] = useState(false)
  // Local mirror of the scheduled-downgrade flag so the UI flips instantly
  // after the user confirms, without waiting on a userProfile refresh.
  const [cancelScheduledLocal, setCancelScheduledLocal] = useState<boolean | null>(null)

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

  // The effective "downgrade scheduled" state: the optimistic local override
  // wins once the user acts; otherwise fall back to the computed value.
  const downgradeScheduled = cancelScheduledLocal ?? subscription.cancelScheduled
  const accessEndsLabel = userProfile?.subscription_ends_at
    ? new Date(userProfile.subscription_ends_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : subscription.daysRemaining > 0
      ? `${subscription.daysRemaining} day${subscription.daysRemaining === 1 ? '' : 's'} from now`
      : 'the end of your billing period'

  const scheduleDowngrade = async () => {
    const ok = await confirm({
      title: 'Downgrade to Basic?',
      message: `You'll keep full Pro access until ${accessEndsLabel}. After that, your account moves to the free Basic plan (job & quote tracking, calendar, customers, and payments). You won't be charged again. You can undo this anytime before then.`,
      confirmLabel: 'Schedule downgrade',
      cancelLabel: 'Keep Pro',
      variant: 'warning',
    })
    if (!ok) return
    setDowngradeLoading(true)
    try {
      const res = await fetch('/api/stripe/subscription/cancel', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        await alert({ title: 'Could not downgrade', message: data.error || 'Please try again.', variant: 'error' })
        return
      }
      setCancelScheduledLocal(true)
      onDataChanged?.()
      await alert({
        title: 'Downgrade scheduled',
        message: `You'll keep Pro until ${accessEndsLabel}, then move to Basic. Changed your mind? Use "Keep my Pro plan" anytime before then.`,
        variant: 'info',
      })
    } catch {
      await alert({ title: 'Error', message: 'Could not reach billing. Check your connection and try again.', variant: 'error' })
    } finally {
      setDowngradeLoading(false)
    }
  }

  const resumePlan = async () => {
    setDowngradeLoading(true)
    try {
      const res = await fetch('/api/stripe/subscription/cancel', { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        await alert({ title: 'Could not resume', message: data.error || 'Please try again.', variant: 'error' })
        return
      }
      setCancelScheduledLocal(false)
      onDataChanged?.()
      await alert({ title: 'Pro plan kept', message: 'Your subscription will continue and renew as usual. No downgrade scheduled.', variant: 'info' })
    } catch {
      await alert({ title: 'Error', message: 'Could not reach billing. Check your connection and try again.', variant: 'error' })
    } finally {
      setDowngradeLoading(false)
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
      a.download = `dyia-export-${formatLocalDateInput()}.csv`
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

      showSuccess('Settings saved')
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

        showSuccess('Logo uploaded')
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

    showSuccess('Logo removed')
  }

  const [activeTab, setActiveTab] = useState<SettingsTabId>('business')

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab)
  }, [initialTab])

  // When navigated to the Account tab from an "Upgrade to Pro" CTA, scroll the
  // Subscription card into view (BUG-024).
  useEffect(() => {
    if (activeTab !== 'account') return
    const el = document.getElementById('subscription')
    if (!el) return
    // Delay one frame so the tab's content mounts before we scroll.
    const id = window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(id)
  }, [activeTab])

  const tabIcons: Record<string, React.ReactNode> = {
    business: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    financial: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    expenses: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
    templates: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    account: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  }

  const tabs = [
    { id: 'business' as const, label: 'Business' },
    { id: 'financial' as const, label: 'Financial' },
    { id: 'expenses' as const, label: 'Expenses' },
    { id: 'templates' as const, label: 'Templates' },
    { id: 'account' as const, label: 'Account' },
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
      <div className="flex gap-1 p-1 mb-8 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border-light)] overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            <span className={activeTab === tab.id ? 'text-orange-500' : ''}>{tabIcons[tab.id]}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Business Information */}
      {activeTab === 'business' && (
      <>
      <div className="app-card mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
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
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
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
        
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 rounded-xl p-4 mt-5">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Pro tip:</strong> Most self-employed contractors should set aside 25-30% for federal + state taxes and self-employment tax.
            </p>
          </div>
        </div>
      </div>

      {/* Monthly Goal */}
      <div className="app-card mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
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
        <FixedExpenses userId={userId} showSuccess={showSuccess} onDataChanged={onDataChanged} />
      )}

      {/* Pricing Templates */}
      {activeTab === 'templates' && (
        <PriceTemplates userId={userId} showSuccess={showSuccess} onDataChanged={onDataChanged} />
      )}

      {/* Account Tab */}
      {activeTab === 'account' && (
      <>
        {/* Profile Card */}
        <div className="app-card mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
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
        <div id="subscription" className="app-card mb-6 scroll-mt-24">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
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
              {(() => {
                // Plan label strategy (BUG-002/022 round 2):
                // - Truly free (no `subscription_tier` recorded):  FREE
                // - Trial of any tier:                              PRO badge + "Free Trial"
                // - subscription_tier === 'basic' (any status):    BASIC
                // - subscription_tier === 'pro' (any status):      PRO
                //
                // The fix: render the badge from `productTier` (the DB value)
                // not `uiTier`, so a Basic plan with status `inactive` /
                // `canceled` still shows BASIC instead of regressing to FREE
                // (which was QA's complaint).
                // Plan label strategy (BUG-022 round 4):
                //   productTier === null  → never had a subscription → FREE
                //   tier === 'trial'      → PRO badge + Free Trial chip
                //   productTier === 'pro' → PRO
                //   productTier === 'basic' → BASIC (never FREE for a paying user)
                //
                // `productTier` comes from computeSubscriptionState; it is the
                // ONLY field that can render the FREE badge.
                const uiTier = subscription.tier
                const productTier = subscription.productTier
                const isTrial = uiTier === 'trial'
                const isRegisteredBasic = productTier === 'basic'
                const isRegisteredPro = productTier === 'pro'
                // A user with status 'past_due' is dunning. They still appear
                // as their paid tier so the badge does not regress to FREE.
                const PAID_STATUSES = ['active', 'past_due', 'trialing']
                const isPaidBasic = isRegisteredBasic && PAID_STATUSES.includes(subscription.status || '')
                const isPaidPro = isRegisteredPro && PAID_STATUSES.includes(subscription.status || '')
                const isInDunning = subscription.isInDunning
                const showOrange = isTrial || isPaidPro
                const badgeLabel =
                  isTrial ? 'PRO'
                  : isRegisteredPro ? 'PRO'
                  : isRegisteredBasic ? 'BASIC'
                  : 'FREE'
                const bodyCopy =
                  isAdminAccount
                    ? 'Admin accounts have full Pro access and are never billed through Stripe.'
                  : isInDunning && isPaidPro
                    ? `Your last payment failed. Pro features stay active for ${subscription.dunningGraceDaysLeft} more day${subscription.dunningGraceDaysLeft !== 1 ? 's' : ''} while we retry your card. Update your payment method to avoid an interruption.`
                  : isInDunning && isPaidBasic
                    ? `Your last payment failed. Basic access stays active for ${subscription.dunningGraceDaysLeft} more day${subscription.dunningGraceDaysLeft !== 1 ? 's' : ''} while we retry your card. Update your payment method to avoid an interruption.`
                  : isTrial
                    ? (productTier === 'basic'
                        ? 'You currently have Pro access during your free trial. When the trial ends, your card will be charged for the Basic plan you selected at checkout.'
                        : 'You have full Pro access. Your card will be charged when the free trial ends.')
                  : isPaidPro
                    ? 'Full access to all features including AI assistant, reports, and marketing tools.'
                  : isPaidBasic
                    ? 'Basic plan — job & quote tracking, calendar, customers, and payments. Upgrade to Pro for AI assistant, advanced reports, and email blasts.'
                  : isRegisteredBasic
                    ? 'Basic plan — your subscription is currently inactive. Reactivate to keep using job & quote tracking, calendar, customers, and payments.'
                  : isRegisteredPro
                    ? 'Pro plan — your subscription is currently inactive. Reactivate to restore AI assistant, advanced reports, and marketing tools.'
                  : 'Upgrade to Pro for AI assistant, advanced reports, marketing tools, and email blasts.'
                return (
              <div className={`p-4 rounded-xl border mb-5 ${
                showOrange
                  ? 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200/50 dark:border-orange-800/30'
                  : 'bg-[var(--color-bg-subtle)] border-[var(--color-border)]'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                        showOrange
                          ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        {badgeLabel}
                      </span>
                      {isTrial && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
                          Free Trial{productTier === 'basic' ? ' (Basic plan)' : ''}
                        </span>
                      )}
                      {(isPaidPro || isPaidBasic) && subscription.plan && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[10px] font-semibold text-[var(--color-text-muted)] uppercase">
                          {subscription.plan === 'annual' ? 'Annual Plan' : 'Monthly Plan'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)]">{bodyCopy}</p>
                    {subscription.tier === 'trial' && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                            Billing starts in {subscription.daysRemaining} day{subscription.daysRemaining !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-[var(--color-text-faint)]">14 day free trial</span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${subscription.daysRemaining <= 3 ? 'bg-amber-500' : 'bg-gradient-to-r from-orange-500 to-amber-500'}`}
                            style={{ width: `${Math.max(5, (subscription.daysRemaining / 14) * 100)}%` }}
                          />
                        </div>
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
              </div>
                )
              })()}

              {/* Scheduled downgrade banner + undo (native cancel flow) */}
              {downgradeScheduled && !isDemoMode && !isAdminAccount && (
                <div className="mb-5 p-4 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50/80 dark:bg-amber-950/20">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">
                          Downgrading to Basic on {accessEndsLabel}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          You keep full Pro access until then. After that you move to the free Basic plan and won&apos;t be charged again.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={resumePlan}
                      disabled={downgradeLoading}
                      className="app-btn-primary text-sm shrink-0 disabled:opacity-60"
                    >
                      {downgradeLoading ? 'Working…' : 'Keep my Pro plan'}
                    </button>
                  </div>
                </div>
              )}

              {/* Trial user: manage billing (card already on file) */}
              {subscription.tier === 'trial' && !isDemoMode && !isAdminAccount && (
                <div className="mb-5">
                  <div className="p-4 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)]">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">Your payment method is on file</p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          You&apos;ll be automatically charged when your free trial ends. You can manage your billing details or cancel anytime.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={openBillingPortal}
                      disabled={portalLoading}
                      className="app-btn-secondary"
                    >
                      {portalLoading ? 'Opening…' : 'Manage Billing'}
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-[var(--color-text-muted)]">
                    {['AI Business Assistant', 'Advanced Reports', 'Marketing Tools', 'Mass Email Blasts'].map(feat => (
                      <div key={feat} className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        {feat}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Basic user: needs to subscribe */}
              {subscription.tier === 'basic' && !isDemoMode && !isAdminAccount && (
                <div className="mb-5">
                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">Upgrade to Pro</h4>
                  <p className="text-xs text-[var(--color-text-muted)] mb-3">
                    Get full access to AI assistant, advanced reports, marketing tools, and email blasts.
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
                      className="flex flex-col items-center p-4 rounded-xl border-2 border-[var(--color-border)] hover:border-orange-500 transition-all hover:shadow-md text-center group"
                    >
                      <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Monthly</span>
                      <span className="text-2xl font-bold text-[var(--color-text-primary)]">$29.99<span className="text-sm font-normal text-[var(--color-text-muted)]">/mo</span></span>
                      <span className="text-xs text-[var(--color-text-muted)] mt-1">Cancel anytime</span>
                      <span className="mt-3 text-xs font-semibold text-orange-500 group-hover:underline">Get Started</span>
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
                      className="relative flex flex-col items-center p-4 rounded-xl border-2 border-orange-500/50 hover:border-orange-500 bg-orange-500/5 transition-all hover:shadow-md text-center group"
                    >
                      <span className="absolute -top-2.5 right-3 px-2 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full">BEST VALUE</span>
                      <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Annual</span>
                      <span className="text-2xl font-bold text-[var(--color-text-primary)]">$24.99<span className="text-sm font-normal text-[var(--color-text-muted)]">/mo</span></span>
                      <span className="text-xs text-[var(--color-text-muted)] mt-1">$299.90/yr — save $60</span>
                      <span className="mt-3 text-xs font-semibold text-orange-500 group-hover:underline">Get Started</span>
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-[var(--color-text-muted)]">
                    {['AI Business Assistant', 'Advanced Reports', 'Marketing Tools', 'Mass Email Blasts'].map(feat => (
                      <div key={feat} className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        {feat}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pro user: Manage plan / Switch plan / Downgrade */}
              {subscription.tier === 'pro' && !isDemoMode && !isAdminAccount && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openBillingPortal}
                    disabled={portalLoading}
                    className="app-btn-primary"
                  >
                    {portalLoading ? 'Opening…' : 'Manage Billing & Invoices'}
                  </button>
                  {subscription.plan === 'monthly' && (
                    <button
                      type="button"
                      onClick={openBillingPortal}
                      disabled={portalLoading}
                      className="app-btn-secondary"
                    >
                      Switch to Annual (Save $60/yr)
                    </button>
                  )}
                  {/* Native downgrade — no Stripe portal round-trip. Hidden once
                      a downgrade is already scheduled (the undo banner shows). */}
                  {!downgradeScheduled && (
                    <button
                      type="button"
                      onClick={scheduleDowngrade}
                      disabled={downgradeLoading}
                      className="text-sm font-medium text-[var(--color-text-muted)] hover:text-red-600 dark:hover:text-red-400 underline-offset-2 hover:underline px-2 disabled:opacity-60"
                    >
                      {downgradeLoading ? 'Working…' : 'Cancel subscription'}
                    </button>
                  )}
                </div>
              )}

              {/* Basic user with Stripe history: billing portal */}
              {subscription.tier === 'basic' && userProfile?.stripe_customer_id && !isAdminAccount && (
                <button
                  type="button"
                  onClick={openBillingPortal}
                  disabled={portalLoading}
                  className="app-btn-secondary w-full sm:w-auto mt-2"
                >
                  {portalLoading ? 'Opening…' : 'View Billing History'}
                </button>
              )}
            </>
          )}
        </div>

        <div className="app-card mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 8.25h19.5M3.75 5.25h16.5a1.5 1.5 0 011.5 1.5v10.5a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5V6.75a1.5 1.5 0 011.5-1.5zm2.25 9h3.75" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--color-text-primary)]">Customer payments</h3>
              <p className="text-sm text-[var(--color-text-muted)]">Set up Stripe Connect and request payment links for quotes and jobs.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
              userProfile?.stripe_connect_charges_enabled
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            }`}>
              {userProfile?.stripe_connect_charges_enabled ? 'Ready to accept payments' : 'Stripe setup needed'}
            </span>
            {onOpenPayments && (
              <button onClick={onOpenPayments} className="app-btn-secondary text-sm">
                Open Payments
              </button>
            )}
          </div>
        </div>

        {/* Data & Export Card */}
        <div className="app-card mb-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
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
