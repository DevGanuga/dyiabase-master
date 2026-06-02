'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useUser, useAuth, UserButton } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { createClient, initSupabaseAuth } from '@/lib/supabase/client'
import { useTheme } from '@/hooks/useTheme'
import { compressImage } from '@/lib/utils'

type Step = 'welcome' | 'you' | 'business' | 'strategy' | 'operations' | 'financials' | 'pricing'

const STEPS: Step[] = ['welcome', 'you', 'business', 'strategy', 'operations', 'financials', 'pricing']

const BUSINESS_TYPES = [
  { id: 'junk_removal', label: 'Junk Removal', icon: '🚛', available: true },
  { id: 'lawn_care', label: 'Lawn Care', icon: '🌿', available: true },
  { id: 'cleaning', label: 'Cleaning', icon: '🧹', available: true },
  { id: 'moving', label: 'Moving', icon: '📦', available: true },
  { id: 'handyman', label: 'Handyman', icon: '🔧', available: true },
  { id: 'other', label: 'Other', icon: '💼', available: true },
]

const TEAM_SIZES = [
  { id: 'solo', label: 'Just me' },
  { id: 'small', label: '2-5' },
  { id: 'medium', label: '6-15' },
  { id: 'large', label: '15+' },
]

const REFERRAL_SOURCES = [
  { id: 'google', label: 'Google' },
  { id: 'social', label: 'Social Media' },
  { id: 'friend', label: 'Referral' },
  { id: 'other', label: 'Other' },
]

const BUSINESS_STAGES = [
  { id: 'starting', label: 'Just starting', desc: 'First year, building foundation', icon: '🌱' },
  { id: 'growing', label: 'Growing', desc: 'Have customers, scaling up', icon: '📈' },
  { id: 'established', label: 'Established', desc: 'Steady business, optimizing', icon: '🏢' },
]

const BIGGEST_CHALLENGES = [
  { id: 'getting_customers', label: 'Getting customers' },
  { id: 'pricing', label: 'Pricing right' },
  { id: 'time_management', label: 'Managing time' },
  { id: 'tracking_money', label: 'Tracking money' },
  { id: 'hiring', label: 'Hiring & team' },
  { id: 'marketing', label: 'Marketing' },
]

const PRICING_PHILOSOPHIES = [
  { id: 'budget', label: 'Lowest price wins', desc: 'Compete on price' },
  { id: 'value', label: 'Fair price, great service', desc: 'Balance of both' },
  { id: 'premium', label: 'Premium service', desc: 'Higher price, top quality' },
]

const YEARS_OPTIONS = [
  { id: 'new', label: '< 1 year' },
  { id: '1-3', label: '1-3 years' },
  { id: '3-5', label: '3-5 years' },
  { id: '5+', label: '5+ years' },
]

const WEEKLY_JOB_CAPACITY = [
  { id: '1-3', label: '1-3' },
  { id: '4-7', label: '4-7' },
  { id: '8-15', label: '8-15' },
  { id: '15+', label: '15+' },
]

const MARKETING_CHANNELS = [
  { id: 'google_ads', label: 'Google Ads' },
  { id: 'social_media', label: 'Social Media' },
  { id: 'yelp', label: 'Yelp' },
  { id: 'nextdoor', label: 'Nextdoor' },
  { id: 'referrals', label: 'Referrals' },
  { id: 'flyers', label: 'Flyers/Door' },
  { id: 'none', label: 'None yet' },
]

export default function OnboardingPage() {
  const { user, isLoaded } = useUser()
  const { getToken } = useAuth()
  const router = useRouter()
  const [returnUrl] = useState(() => {
    if (typeof window === 'undefined') return '/app'
    const params = new URLSearchParams(window.location.search)
    return params.get('returnUrl') || '/app'
  })
  const [isRedo] = useState(() => {
    if (typeof window === 'undefined') return false
    const params = new URLSearchParams(window.location.search)
    return params.get('redo') === 'true'
  })

  initSupabaseAuth(() => getToken({ template: 'supabase' }))

  const supabase = useMemo(() => createClient(), [])
  const { resolvedTheme, setTheme } = useTheme()
  
  // Restore step from sessionStorage so refresh doesn't lose progress
  const [currentStep, setCurrentStep] = useState<Step>(() => {
    if (typeof window === 'undefined') return 'welcome'
    const saved = sessionStorage.getItem('dyia_onboarding_step')
    return (saved && STEPS.includes(saved as Step)) ? saved as Step : 'welcome'
  })
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Restore form data from sessionStorage on mount
  const savedData = typeof window !== 'undefined' ? (() => {
    try { return JSON.parse(sessionStorage.getItem('dyia_onboarding_data') || '{}') } catch { return {} }
  })() : {}

  // Profile
  const [firstName, setFirstName] = useState(savedData.firstName || '')
  const [lastName, setLastName] = useState(savedData.lastName || '')
  const [referralSource, setReferralSource] = useState(savedData.referralSource || '')
  
  // Business
  const [businessName, setBusinessName] = useState(savedData.businessName || '')
  const [businessType, setBusinessType] = useState(savedData.businessType || '')
  const [teamSize, setTeamSize] = useState(savedData.teamSize || '')
  const [businessPhone, setBusinessPhone] = useState(savedData.businessPhone || '')
  const [businessEmail, setBusinessEmail] = useState(savedData.businessEmail || '')
  const [businessAddress, setBusinessAddress] = useState(savedData.businessAddress || '')
  const [serviceArea, setServiceArea] = useState(savedData.serviceArea || '')
  const [servicesOffered] = useState(savedData.servicesOffered || '')
  const [yearsInBusiness, setYearsInBusiness] = useState(savedData.yearsInBusiness || '')
  const [logoPreview, setLogoPreview] = useState<string | null>(savedData.logoPreview || null)
  
  // Strategy & AI context
  const [businessStage, setBusinessStage] = useState(savedData.businessStage || '')
  const [biggestChallenge, setBiggestChallenge] = useState(savedData.biggestChallenge || '')
  const [pricingPhilosophy, setPricingPhilosophy] = useState(savedData.pricingPhilosophy || '')
  const [weeklyJobCapacity, setWeeklyJobCapacity] = useState(savedData.weeklyJobCapacity || '')
  const [averageJobRevenue, setAverageJobRevenue] = useState<number | 'not_sure' | ''>(savedData.averageJobRevenue ?? '')
  const [marketingChannels, setMarketingChannels] = useState<string[]>(savedData.marketingChannels || [])
  const [commonServices, setCommonServices] = useState(savedData.commonServices || '')

  // Financial
  const [taxPercentage, setTaxPercentage] = useState(savedData.taxPercentage ?? 30)
  const [monthlyGoal, setMonthlyGoal] = useState(savedData.monthlyGoal ?? 0)

  // Price template state: customizable list of { id, label, amount }
  const defaultPriceRows = [
    { id: '1', label: 'Minimum', amount: 75 },
    { id: '2', label: '1/4 Load', amount: 150 },
    { id: '3', label: '1/2 Load', amount: 250 },
    { id: '4', label: '3/4 Load', amount: 350 },
    { id: '5', label: 'Full Load', amount: 450 },
  ]
  const [createTemplate, setCreateTemplate] = useState(true)
  const [templateName, setTemplateName] = useState('Standard Pricing')
  const [priceRows, setPriceRows] = useState<{ id: string; label: string; amount: number }[]>(defaultPriceRows)

  const currentStepIndex = STEPS.indexOf(currentStep)
  const isLastStep = currentStep === 'pricing'

  // Persist onboarding progress to sessionStorage so page refresh doesn't lose work
  useEffect(() => {
    sessionStorage.setItem('dyia_onboarding_step', currentStep)
  }, [currentStep])

  useEffect(() => {
    const data = {
      firstName, lastName, referralSource, businessName, businessType, teamSize,
      businessPhone, businessEmail, businessAddress, serviceArea, servicesOffered,
      yearsInBusiness, logoPreview, businessStage, biggestChallenge, pricingPhilosophy,
      weeklyJobCapacity, averageJobRevenue, marketingChannels, commonServices,
      taxPercentage, monthlyGoal,
    }
    sessionStorage.setItem('dyia_onboarding_data', JSON.stringify(data))
  }, [
    firstName, lastName, referralSource, businessName, businessType, teamSize,
    businessPhone, businessEmail, businessAddress, serviceArea, servicesOffered,
    yearsInBusiness, logoPreview, businessStage, biggestChallenge, pricingPhilosophy,
    weeklyJobCapacity, averageJobRevenue, marketingChannels, commonServices,
    taxPercentage, monthlyGoal,
  ])

  // Required setup checklist — resolves when user completes each item (for guidance only; we still allow Finish)
  const setupChecklist = useMemo(() => {
    const businessNameDone = !!businessName?.trim()
    const phoneDone = !!businessPhone?.trim()
    const emailDone = !!businessEmail?.trim()
    const templateDone = !createTemplate || (
      !!templateName?.trim() &&
      priceRows.some(r => (r.label?.trim() || '').length > 0 && (Number(r.amount) || 0) > 0)
    )
    return [
      { id: 'business-name', label: 'Business name', done: businessNameDone },
      { id: 'phone', label: 'Phone number', done: phoneDone },
      { id: 'email', label: 'Email', done: emailDone },
      { id: 'template', label: 'Price template (or skip)', done: templateDone },
    ]
  }, [businessName, businessPhone, businessEmail, createTemplate, templateName, priceRows])
  const setupChecklistComplete = setupChecklist.every((c) => c.done)
  const showChecklist = currentStep === 'business' || currentStep === 'operations' || currentStep === 'financials'

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!isLoaded || !user) {
        if (isLoaded) router.push('/sign-in')
        return
      }

      if (user.firstName) setFirstName(user.firstName)
      if (user.lastName) setLastName(user.lastName)

      try {
        // Load profile through server API (uses service role key, bypasses RLS)
        const initRes = await fetch('/api/user/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.primaryEmailAddress?.emailAddress || '' }),
        })
        const initData = initRes.ok ? await initRes.json() : null
        const profile = initData?.profile

        if (!profile) {
          setBusinessEmail(user.primaryEmailAddress?.emailAddress || '')
          setError('Could not load your account. Please refresh or sign out and back in.')
          setLoading(false)
          return
        }

        setUserId(profile.id)
        if (profile.first_name) setFirstName(profile.first_name)
        if (profile.last_name) setLastName(profile.last_name)

        const { data: settings } = await supabase
          .from('dyia_settings')
          .select('*')
          .eq('user_id', profile.id)
          .single()

        if (!isRedo && (settings?.onboarding_completed || settings?.onboarding_skipped)) {
          router.push(returnUrl)
          return
        }

        if (settings) {
          if (settings.business_name) setBusinessName(settings.business_name)
          if (settings.business_phone) setBusinessPhone(settings.business_phone)
          // Set email once, after the async query: prefer saved business_email,
          // fall back to Clerk email. This avoids the race where an early Clerk
          // assignment gets overwritten by the async DB result mid-typing.
          setBusinessEmail(settings.business_email || user.primaryEmailAddress?.emailAddress || '')
          if (settings.business_address) setBusinessAddress(settings.business_address)
          if (settings.business_logo) setLogoPreview(settings.business_logo)
          if (settings.tax_percentage) setTaxPercentage(settings.tax_percentage)
          if (settings.monthly_goal) setMonthlyGoal(settings.monthly_goal)
          // Restore metadata if redoing
          const meta = settings.metadata as Record<string, unknown> | null
          if (meta) {
            if (meta.business_type) setBusinessType(meta.business_type as string)
            if (meta.team_size) setTeamSize(meta.team_size as string)
            if (meta.service_area) setServiceArea(meta.service_area as string)
            if (meta.years_in_business) setYearsInBusiness(meta.years_in_business as string)
            if (meta.business_stage) setBusinessStage(meta.business_stage as string)
            if (meta.biggest_challenge) setBiggestChallenge(meta.biggest_challenge as string)
            if (meta.pricing_philosophy) setPricingPhilosophy(meta.pricing_philosophy as string)
            if (meta.weekly_job_capacity) setWeeklyJobCapacity(meta.weekly_job_capacity as string)
            if (meta.average_job_revenue) setAverageJobRevenue(meta.average_job_revenue as number)
            if (meta.marketing_channels) setMarketingChannels(meta.marketing_channels as string[])
            if (meta.common_services) setCommonServices(meta.common_services as string)
            if (meta.referral_source) setReferralSource(meta.referral_source as string)
          }
        } else {
          // Settings row does not exist or is empty: use Clerk email as the default suggestion
          setBusinessEmail(user.primaryEmailAddress?.emailAddress || '')
        }

        setLoading(false)
      } catch (err) {
        console.error('Error checking onboarding status:', err)
        setLoading(false)
      }
    }

    checkOnboardingStatus()
  }, [isLoaded, user, supabase, router, returnUrl, isRedo])

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (e.g. JPG, PNG, WebP)')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo must be under 2MB')
      return
    }
    setError(null)
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const dataUrl = event.target?.result as string
        const compressed = await compressImage(dataUrl, 400, 0.8)
        setLogoPreview(compressed)
      } catch {
        setError('Error processing logo image')
      }
    }
    reader.onerror = () => setError('Could not read image. Try a different file.')
    reader.readAsDataURL(file)
  }

  const toggleMarketingChannel = (id: string) => {
    setMarketingChannels(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const animateToStep = useCallback((newStep: Step, dir: 'forward' | 'backward') => {
    if (isAnimating) return
    setError(null)
    setIsAnimating(true)
    setDirection(dir)
    setTimeout(() => {
      setCurrentStep(newStep)
      setIsAnimating(false)
    }, 150)
  }, [isAnimating])

  const nextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      animateToStep(STEPS[nextIndex], 'forward')
    }
  }, [currentStepIndex, animateToStep])

  const prevStep = useCallback(() => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      animateToStep(STEPS[prevIndex], 'backward')
    }
  }, [currentStepIndex, animateToStep])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !saving) {
        e.preventDefault()
        if (isLastStep) {
          handleComplete()
        } else {
          nextStep()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, nextStep, isLastStep, saving])

  const handleSkip = async () => {
    if (!userId) {
      setError('Account not found. Please refresh the page or sign out and back in.')
      return
    }
    setSaving(true)
    setError(null)
    
    try {
      await supabase
        .from('dyia_settings')
        .update({ onboarding_skipped: true })
        .eq('user_id', userId)
    } catch (err) {
      console.error('Skip error:', err)
    } finally {
      sessionStorage.removeItem('dyia_onboarding_step')
      sessionStorage.removeItem('dyia_onboarding_data')
      setSaving(false)
      window.location.href = returnUrl
    }
  }

  const handleComplete = async () => {
    if (!userId) {
      setError('Account not found. Please refresh the page or sign out and back in.')
      return
    }
    setSaving(true)
    setError(null)

    try {
      await supabase
        .from('dyia_users')
        .update({ first_name: firstName || null, last_name: lastName || null })
        .eq('id', userId)

      const logoUrl: string | null = logoPreview

      const { error: settingsError } = await supabase
        .from('dyia_settings')
        .update({
          business_name: businessName || null,
          business_phone: businessPhone || null,
          business_email: businessEmail || null,
          business_address: businessAddress || null,
          business_logo: logoUrl,
          tax_percentage: taxPercentage,
          monthly_goal: monthlyGoal,
          onboarding_completed: true,
          onboarding_skipped: false,
          onboarding_completed_at: new Date().toISOString(),
          metadata: {
            business_type: businessType || undefined,
            team_size: teamSize || undefined,
            referral_source: referralSource || undefined,
            service_area: serviceArea || undefined,
            services_offered: servicesOffered || undefined,
            average_job_revenue: averageJobRevenue === 'not_sure' ? 'not_sure' : (typeof averageJobRevenue === 'number' ? averageJobRevenue : undefined),
            years_in_business: yearsInBusiness || undefined,
            business_stage: businessStage || undefined,
            biggest_challenge: biggestChallenge || undefined,
            pricing_philosophy: pricingPhilosophy || undefined,
            weekly_job_capacity: weeklyJobCapacity || undefined,
            marketing_channels: marketingChannels.length > 0 ? marketingChannels : undefined,
            common_services: commonServices || undefined,
          }
        })
        .eq('user_id', userId)

      if (settingsError) {
        console.warn('Full settings update failed, trying without metadata:', settingsError.message)
        const { error: basicError } = await supabase
          .from('dyia_settings')
          .update({
            business_name: businessName || null,
            business_phone: businessPhone || null,
            business_email: businessEmail || null,
            business_logo: logoUrl,
            tax_percentage: taxPercentage,
            monthly_goal: monthlyGoal,
            onboarding_completed: true,
            onboarding_skipped: false,
            onboarding_completed_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
        if (basicError) throw new Error(`Settings update failed: ${basicError.message}`)
      }

      // Verify the save actually persisted (catches silent RLS failures)
      const { data: verify } = await supabase
        .from('dyia_settings')
        .select('onboarding_completed')
        .eq('user_id', userId)
        .single()

      if (!verify?.onboarding_completed) {
        throw new Error('Save did not persist. Your browser may not have permission to write data. Please try signing out and back in, or contact support.')
      }

      if (createTemplate && templateName) {
        const items = priceRows.filter(r => r.label.trim()).map(r => ({ label: r.label.trim(), amount: Number(r.amount) || 0 }))
        const pricesPayload: Record<string, unknown> = {
          items,
          minimumFee: items[0]?.amount ?? 0,
          quarterLoad: items[1]?.amount ?? 0,
          halfLoad: items[2]?.amount ?? 0,
          threeQuarterLoad: items[3]?.amount ?? 0,
          fullLoad: items[4]?.amount ?? 0,
        }
        const { error: templateError } = await supabase
          .from('dyia_price_templates')
          .insert({
            user_id: userId,
            name: templateName.trim(),
            prices: pricesPayload,
            is_default: true,
          })
        if (templateError) {
          console.warn('Template creation failed:', templateError.message)
        }
      }

      sessionStorage.removeItem('dyia_onboarding_step')
      sessionStorage.removeItem('dyia_onboarding_data')
      window.location.href = returnUrl
    } catch (err) {
      console.error('Onboarding save error:', err)
      const message = err instanceof Error ? err.message : 'Failed to save settings'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const isDark = resolvedTheme === 'dark'

  if (loading || !isLoaded) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        isDark ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-orange-50 via-white to-amber-50'
      }`}>
        <div className="text-center">
          <img src="/dyia-logo-full.png" alt="dyia" className={`h-10 object-contain mx-auto mb-6 ${isDark ? 'brightness-0 invert' : ''}`} />
          <div style={{ width: 24, height: 24, border: '2px solid #f97316', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }} className="animate-spin" />
        </div>
      </div>
    )
  }

  const stepLabels: Record<Step, string> = {
    welcome: 'Welcome',
    you: 'You',
    business: 'Business',
    strategy: 'Strategy',
    operations: 'Operations',
    financials: 'Finances',
    pricing: 'Pricing',
  }

  const animationClass = isAnimating 
    ? direction === 'forward' ? 'opacity-0 translate-x-4' : 'opacity-0 -translate-x-4'
    : 'opacity-100 translate-x-0'

  const c = {
    bg: isDark ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-orange-50 via-white to-amber-50',
    text: isDark ? 'text-white' : 'text-slate-800',
    textMuted: isDark ? 'text-slate-400' : 'text-slate-500',
    textSubtle: isDark ? 'text-slate-500' : 'text-slate-400',
    card: isDark ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white/80 border-orange-200/50 shadow-xl shadow-orange-500/5',
    input: isDark ? 'bg-slate-700/80 border-slate-600 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400',
    chip: isDark ? 'bg-slate-700/80 border-slate-600 text-slate-300 hover:bg-slate-600 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700',
    chipActive: 'bg-orange-500 border-orange-500 text-white',
    stepPending: isDark ? 'bg-slate-700 text-slate-500' : 'bg-slate-200 text-slate-400',
    stepComplete: isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600',
    headerBtn: isDark ? 'bg-white/10 border-white/20 hover:bg-white/20' : 'bg-white border-slate-200 hover:bg-orange-50 shadow-sm',
    section: isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200',
  }

  return (
    <>
      <style jsx global>{`
        .onboarding-input:focus { border-color: #f97316 !important; box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.15); }
      `}</style>
      
      <div className={`min-h-screen transition-colors duration-300 ${c.bg} ${c.text}`}>
        {/* Header */}
        <header className="absolute top-0 left-0 right-0 px-6 py-4 flex items-center justify-between z-50">
          <img src="/dyia-logo-full.png" alt="dyia" className={`h-9 object-contain ${isDark ? 'brightness-0 invert' : ''}`} />
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${c.headerBtn}`}
            >
              {isDark ? (
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>
            <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: { width: 36, height: 36 } } }} />
          </div>
        </header>

        {/* Main */}
        <main className="flex items-center justify-center min-h-screen px-4 py-20 pt-24">
          <div className="w-full max-w-[520px]">
            {/* Required setup checklist — visible from business step onward */}
            {showChecklist && (
              <div className={`mb-6 rounded-xl border p-4 transition-colors ${
                setupChecklistComplete
                  ? (isDark ? 'bg-green-900/20 border-green-700/50' : 'bg-green-50 border-green-200')
                  : (isDark ? 'bg-slate-800/50 border-slate-600' : 'bg-slate-50 border-slate-200')
              }`}>
                <p className={`text-xs font-semibold mb-2.5 ${setupChecklistComplete ? (isDark ? 'text-green-400' : 'text-green-700') : c.textMuted}`}>
                  {setupChecklistComplete ? '✓ Required info complete' : 'Complete these for your profile'}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {setupChecklist.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                        item.done ? 'bg-green-500 text-white' : (isDark ? 'bg-slate-600' : 'bg-slate-300')
                      }`}>
                        {item.done ? (
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : null}
                      </span>
                      <span className={`text-sm ${item.done ? (isDark ? 'text-green-300' : 'text-green-700') : c.textMuted}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Steps */}
            <div className="mb-8">
              {/* Step indicator dots */}
              <div className="flex items-center justify-center gap-2 mb-3">
                {STEPS.map((step, index) => (
                  <button
                    key={step}
                    onClick={() => index < currentStepIndex && animateToStep(step, 'backward')}
                    disabled={index >= currentStepIndex}
                    className="p-0 bg-transparent border-none"
                    style={{ cursor: index < currentStepIndex ? 'pointer' : 'default' }}
                    title={stepLabels[step]}
                  >
                    <div className={`rounded-full transition-all duration-300 ${
                      index === currentStepIndex 
                        ? 'w-8 h-2 bg-orange-500 shadow-sm shadow-orange-500/40' 
                        : index < currentStepIndex 
                          ? 'w-2 h-2 bg-orange-400/60'
                          : `w-2 h-2 ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`
                    }`} />
                  </button>
                ))}
              </div>
              {/* Current step label */}
              <p className={`text-center text-xs font-medium uppercase tracking-widest ${c.textSubtle}`}>
                Step {currentStepIndex + 1} of {STEPS.length} — {stepLabels[currentStep]}
              </p>
            </div>

            {/* Card */}
            <div className={`backdrop-blur-xl rounded-2xl p-5 sm:p-8 border transition-colors ${c.card}`}>
              <div className={`transition-all duration-150 ${animationClass}`}>

                {/* ===== WELCOME ===== */}
                {currentStep === 'welcome' && (
                  <div className="text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/30">
                      <img src="/dyia-agent.png" alt="" className="w-12 h-12 object-contain" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold mb-3">Welcome to Dyia</h1>
                    <p className={`text-base mb-8 max-w-[380px] mx-auto ${c.textMuted}`}>
                      Let&apos;s set up your business in a few minutes. This helps Dyia give you personalized insights and smarter quotes.
                    </p>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      {[
                        { icon: '📋', label: 'Track Jobs', desc: 'Revenue & expenses' },
                        { icon: '📄', label: 'Send Quotes', desc: 'Professional PDFs' },
                        { icon: '🤖', label: 'AI Insights', desc: 'Powered by Dyia' },
                      ].map((item) => (
                        <div key={item.label} className={`text-center p-3 rounded-xl border ${c.section}`}>
                          <div className="text-2xl mb-1.5">{item.icon}</div>
                          <div className="text-sm font-semibold">{item.label}</div>
                          <div className={`text-[11px] ${c.textSubtle}`}>{item.desc}</div>
                        </div>
                      ))}
                    </div>
                    <p className={`text-sm ${c.textSubtle}`}>Takes about 2 minutes</p>
                  </div>
                )}

                {/* ===== YOU ===== */}
                {currentStep === 'you' && (
                  <div>
                    <h2 className="text-2xl font-bold mb-2">About you</h2>
                    <p className={`mb-6 ${c.textMuted}`}>So Dyia knows who it&apos;s working with</p>
                    
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div>
                        <label className={`block text-sm mb-1.5 ${c.textMuted}`}>First Name</label>
                        <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John"
                          className={`w-full px-4 py-3 rounded-xl border text-base outline-none transition-all onboarding-input ${c.input}`} autoFocus />
                      </div>
                      <div>
                        <label className={`block text-sm mb-1.5 ${c.textMuted}`}>Last Name</label>
                        <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith"
                          className={`w-full px-4 py-3 rounded-xl border text-base outline-none transition-all onboarding-input ${c.input}`} />
                      </div>
                    </div>

                    <div>
                      <label className={`block text-sm mb-2 ${c.textMuted}`}>How did you find us?</label>
                      <div className="flex flex-wrap gap-2">
                        {REFERRAL_SOURCES.map((source) => (
                          <button key={source.id} type="button" onClick={() => setReferralSource(source.id)}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${referralSource === source.id ? c.chipActive : c.chip}`}>
                            {source.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== BUSINESS ===== */}
                {currentStep === 'business' && (
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Your business</h2>
                    <p className={`mb-6 ${c.textMuted}`}>This info powers your quotes and AI insights</p>
                    
                    <div className="flex gap-4 mb-5">
                      <label className={`w-[72px] h-[72px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all shrink-0 overflow-hidden ${
                        isDark ? 'border-slate-600 bg-slate-700/50 hover:border-slate-500' : 'border-slate-300 bg-slate-100 hover:border-orange-400'
                      }`}>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={handleLogoChange}
                          className="hidden"
                        />
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" className="w-full h-full object-contain rounded-lg" />
                        ) : (
                          <>
                            <svg className={`w-6 h-6 mb-1 ${c.textSubtle}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <span className={`text-[10px] ${c.textSubtle}`}>Logo</span>
                          </>
                        )}
                      </label>
                      <div className="flex-1">
                        <label className={`block text-sm mb-1.5 ${c.textMuted}`}>Business Name</label>
                        <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Johnson's Junk Removal"
                          className={`w-full px-4 py-3 rounded-xl border text-base outline-none transition-all onboarding-input ${c.input}`} />
                        <p className={`text-[10px] mt-1 ${c.textSubtle}`}>Logo: JPG, PNG or WebP, max 2MB</p>
                      </div>
                    </div>

                    <div className="mb-5">
                      <div className="flex items-center gap-2 mb-2">
                        <label className={`block text-sm ${c.textMuted}`}>Type of business</label>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {BUSINESS_TYPES.map((type) => (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => type.available && setBusinessType(type.id)}
                            disabled={!type.available}
                            className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                              !type.available
                                ? isDark ? 'bg-slate-800/60 border-slate-600 text-slate-500 cursor-not-allowed opacity-75' : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-75'
                                : businessType === type.id ? c.chipActive : c.chip
                            }`}
                          >
                            <span>{type.icon}</span>
                            <span>{type.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                      <div>
                        <label className={`block text-sm mb-2 ${c.textMuted}`}>Team size</label>
                        <div className="flex gap-1.5">
                          {TEAM_SIZES.map((size) => (
                            <button key={size.id} type="button" onClick={() => setTeamSize(size.id)}
                              className={`flex-1 px-2 py-2 rounded-lg border text-xs font-medium transition-all ${teamSize === size.id ? c.chipActive : c.chip}`}>
                              {size.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className={`block text-sm mb-2 ${c.textMuted}`}>Years in business</label>
                        <div className="flex gap-1.5">
                          {YEARS_OPTIONS.map((opt) => (
                            <button key={opt.id} type="button" onClick={() => setYearsInBusiness(opt.id)}
                              className={`flex-1 px-1 py-2 rounded-lg border text-[10px] font-medium transition-all ${yearsInBusiness === opt.id ? c.chipActive : c.chip}`}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                      <div>
                        <label className={`block text-sm mb-1.5 ${c.textMuted}`}>Phone</label>
                        <input type="tel" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} placeholder="(555) 123-4567"
                          className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all onboarding-input ${c.input}`} />
                      </div>
                      <div>
                        <label className={`block text-sm mb-1.5 ${c.textMuted}`}>Email</label>
                        <input type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} placeholder="hello@business.com"
                          className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all onboarding-input ${c.input}`} autoComplete="email" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={`block text-sm mb-1.5 ${c.textMuted}`}>Address</label>
                        <input type="text" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} placeholder="123 Main St, City"
                          className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all onboarding-input ${c.input}`} />
                      </div>
                      <div>
                        <label className={`block text-sm mb-1.5 ${c.textMuted}`}>Service area</label>
                        <input type="text" value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} placeholder="e.g. Metro Atlanta"
                          className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all onboarding-input ${c.input}`} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== STRATEGY ===== */}
                {currentStep === 'strategy' && (
                  <div>
                    <h2 className="text-2xl font-bold mb-1">Your strategy</h2>
                    <p className={`mb-6 text-sm ${c.textMuted}`}>Helps Dyia tailor advice to where you are</p>
                    
                    <div className="mb-6">
                      <label className={`block text-sm mb-2 ${c.textMuted}`}>Where is your business at?</label>
                      <div className="grid grid-cols-3 gap-2">
                        {BUSINESS_STAGES.map((stage) => (
                          <button key={stage.id} type="button" onClick={() => setBusinessStage(stage.id)}
                            className={`px-3 py-3 rounded-xl border text-sm font-medium transition-all flex flex-col items-center gap-1 ${businessStage === stage.id ? c.chipActive : c.chip}`}>
                            <span className="text-lg">{stage.icon}</span>
                            <span className="text-xs font-semibold">{stage.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-6">
                      <label className={`block text-sm mb-2 ${c.textMuted}`}>Biggest challenge right now?</label>
                      <div className="flex flex-wrap gap-2">
                        {BIGGEST_CHALLENGES.map((ch) => (
                          <button key={ch.id} type="button" onClick={() => setBiggestChallenge(ch.id)}
                            className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${biggestChallenge === ch.id ? c.chipActive : c.chip}`}>
                            {ch.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className={`block text-sm mb-2 ${c.textMuted}`}>Pricing approach?</label>
                      <div className="grid grid-cols-3 gap-2">
                        {PRICING_PHILOSOPHIES.map((ph) => (
                          <button key={ph.id} type="button" onClick={() => setPricingPhilosophy(ph.id)}
                            className={`px-3 py-3 rounded-xl border text-center transition-all ${pricingPhilosophy === ph.id ? c.chipActive : c.chip}`}>
                            <div className="font-medium text-xs">{ph.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== OPERATIONS ===== */}
                {currentStep === 'operations' && (
                  <div>
                    <h2 className="text-2xl font-bold mb-1">How you operate</h2>
                    <p className={`mb-6 text-sm ${c.textMuted}`}>Dyia uses this for smarter pricing and revenue projections</p>
                    
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <label className={`block text-sm mb-2 ${c.textMuted}`}>Jobs per week?</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {WEEKLY_JOB_CAPACITY.map((cap) => (
                            <button key={cap.id} type="button" onClick={() => setWeeklyJobCapacity(cap.id)}
                              className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${weeklyJobCapacity === cap.id ? c.chipActive : c.chip}`}>
                              {cap.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className={`block text-sm mb-2 ${c.textMuted}`}>Avg job revenue?</label>
                        <div className="relative">
                          <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${c.textSubtle}`}>$</span>
                          <input type="number" value={averageJobRevenue || ''} onChange={(e) => setAverageJobRevenue(Number(e.target.value) || 0)} placeholder="350"
                            className={`w-full pl-7 pr-3 py-3 rounded-xl border text-base outline-none transition-all onboarding-input ${c.input}`} />
                        </div>
                        <div className="flex gap-1.5 mt-2">
                          {[200, 350, 500].map((amt) => (
                            <button key={amt} type="button" onClick={() => setAverageJobRevenue(amt)}
                              className={`flex-1 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${averageJobRevenue === amt ? c.chipActive : c.chip}`}>
                              ${amt}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <label className={`block text-sm mb-2 ${c.textMuted}`}>Where do you get customers?</label>
                      <div className="flex flex-wrap gap-2">
                        {MARKETING_CHANNELS.map((ch) => (
                          <button key={ch.id} type="button" onClick={() => toggleMarketingChannel(ch.id)}
                            className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${marketingChannels.includes(ch.id) ? c.chipActive : c.chip}`}>
                            {ch.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className={`block text-sm mb-1.5 ${c.textMuted}`}>Services you offer</label>
                      <input type="text" value={commonServices} onChange={(e) => setCommonServices(e.target.value)}
                        placeholder="e.g. Garage cleanouts, furniture removal, yard debris"
                        className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all onboarding-input ${c.input}`} />
                      <p className={`text-[10px] mt-1 ${c.textSubtle}`}>Helps Dyia suggest accurate pricing</p>
                    </div>
                  </div>
                )}

                {/* ===== FINANCIALS ===== */}
                {currentStep === 'financials' && (
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Financial settings</h2>
                    <p className={`mb-6 ${c.textMuted}`}>Calculate your real take-home profit</p>
                    
                    <div className={`rounded-2xl p-5 mb-5 border ${c.section}`}>
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <div className="text-base font-semibold mb-0.5">Tax Rate</div>
                          <div className={`text-xs ${c.textSubtle}`}>Your self-employment tax bracket</div>
                        </div>
                        <div className="text-3xl font-bold text-orange-500">{taxPercentage}%</div>
                      </div>
                      <input type="range" min="0" max="50" value={taxPercentage} onChange={(e) => setTaxPercentage(Number(e.target.value))} className="w-full accent-orange-500" />
                      <div className={`flex justify-between text-xs mt-1 ${c.textSubtle}`}><span>0%</span><span>25%</span><span>50%</span></div>
                    </div>

                    <div className={`rounded-2xl p-5 border ${c.section}`}>
                      <div className="text-base font-semibold mb-0.5">Monthly Revenue Goal</div>
                      <div className={`text-xs mb-3 ${c.textSubtle}`}>We&apos;ll track your progress. This can be updated monthly.</div>
                      <div className="relative">
                        <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-lg ${c.textSubtle}`}>$</span>
                        <input type="number" value={monthlyGoal || ''} onChange={(e) => setMonthlyGoal(Number(e.target.value) || 0)} placeholder="8000"
                          className={`w-full pl-9 pr-4 py-3 rounded-xl border text-lg outline-none transition-all onboarding-input ${c.input}`} />
                      </div>
                      <div className="flex gap-2 mt-3">
                        {[5000, 8000, 10000, 15000].map((amount) => (
                          <button key={amount} type="button" onClick={() => setMonthlyGoal(amount)}
                            className={`flex-1 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${monthlyGoal === amount ? c.chipActive : c.chip}`}>
                            ${amount / 1000}k
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={`rounded-2xl p-5 mt-5 border ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="text-base font-semibold mb-0.5">Average job revenue</div>
                      <div className={`text-xs mb-3 ${c.textSubtle}`}>Typical revenue per job (optional)</div>
                      <div className="flex flex-wrap gap-2">
                        {[200, 500, 800, 1500].map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => setAverageJobRevenue(amount)}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                              averageJobRevenue === amount ? c.chipActive : c.chip
                            }`}
                          >
                            ${amount}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setAverageJobRevenue('not_sure')}
                          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                            averageJobRevenue === 'not_sure' ? c.chipActive : c.chip
                          }`}
                        >
                          Not sure
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ===== PRICING TEMPLATE ===== */}
                {currentStep === 'pricing' && (
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Price template</h2>
                    <p className={`mb-5 ${c.textMuted}`}>Standard pricing for quick quotes — edit anytime in Settings</p>
                    
                    <label className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer mb-5 border transition-all ${c.section}`}>
                      <input type="checkbox" checked={createTemplate} onChange={(e) => setCreateTemplate(e.target.checked)} className="w-5 h-5 accent-orange-500" />
                      <div>
                        <div className="font-semibold mb-0.5">Create a price template</div>
                        <div className={`text-xs ${c.textSubtle}`}>Speed up quote creation</div>
                      </div>
                    </label>
                    
                    {createTemplate && (
                      <div>
                        <input
                          type="text"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          placeholder="Template Name"
                          className={`w-full px-4 py-3 rounded-xl border text-base outline-none transition-all onboarding-input mb-4 ${c.input}`}
                        />
                        <p className={`text-xs mb-3 ${c.textSubtle}`}>Add your own price tiers — edit the label and amount, or add more rows.</p>
                        <div className="space-y-3">
                          {priceRows.map((row) => (
                            <div key={row.id} className="flex gap-2 items-center">
                              <input
                                type="text"
                                value={row.label}
                                onChange={(e) => setPriceRows(prev => prev.map(r => r.id === row.id ? { ...r, label: e.target.value } : r))}
                                placeholder="Label"
                                className={`flex-1 min-w-0 px-3 py-2.5 rounded-xl border text-sm outline-none transition-all onboarding-input ${c.input}`}
                              />
                              <div className="relative w-28 shrink-0">
                                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${c.textSubtle}`}>$</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={row.amount || ''}
                                  onChange={(e) => setPriceRows(prev => prev.map(r => r.id === row.id ? { ...r, amount: Number(e.target.value) || 0 } : r))}
                                  className={`w-full pl-7 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-all onboarding-input ${c.input}`}
                                  placeholder="0"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => setPriceRows(prev => prev.filter(r => r.id !== row.id))}
                                disabled={priceRows.length <= 1}
                                className={`p-2.5 rounded-xl border shrink-0 transition-all ${c.chip} disabled:opacity-50 disabled:cursor-not-allowed`}
                                title="Remove row"
                                aria-label="Remove row"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setPriceRows(prev => [...prev, { id: String(Date.now()), label: '', amount: 0 }])}
                          className={`mt-3 w-full py-2.5 rounded-xl border text-sm font-medium transition-all ${c.chip}`}
                        >
                          + Add price tier
                        </button>
                      </div>
                    )}
                    
                    {!createTemplate && (
                      <p className={`text-sm ${c.textSubtle}`}>You can create templates later in Settings.</p>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center mt-6">
              {currentStep === 'welcome' ? (
                <button onClick={handleSkip} disabled={saving}
                  className={`bg-transparent border-none text-sm cursor-pointer p-2 transition-colors ${c.textSubtle} hover:text-orange-500`}>
                  Skip setup
                </button>
              ) : (
                <button onClick={prevStep} disabled={saving || isAnimating}
                  className={`bg-transparent border-none text-sm cursor-pointer p-2 flex items-center gap-1 transition-colors ${c.textMuted} hover:text-orange-500`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Back
                </button>
              )}

              <button
                onClick={isLastStep ? handleComplete : nextStep}
                disabled={saving || isAnimating}
                className="px-8 py-3.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 min-w-[160px]"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : isLastStep ? (
                  'Launch Dyia'
                ) : (
                  <>
                    Continue
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </>
                )}
              </button>
            </div>
            {isLastStep && showChecklist && !setupChecklistComplete && (
              <p className={`text-center text-xs mt-2 ${c.textSubtle}`}>
                Complete the items above for a full profile, or click Get Started to finish later in Settings.
              </p>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
