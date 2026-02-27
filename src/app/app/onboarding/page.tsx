'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useUser, useAuth, UserButton } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { createClient, initSupabaseAuth } from '@/lib/supabase/client'
import { useTheme } from '@/hooks/useTheme'
import { AnimatedDropdown } from '@/components/ui/AnimatedDropdown'
import { compressImage } from '@/lib/utils'

type Step = 'welcome' | 'profile' | 'business' | 'goals' | 'financials' | 'template'

const STEPS: Step[] = ['welcome', 'profile', 'business', 'goals', 'financials', 'template']

const BUSINESS_TYPES = [
  { id: 'junk_removal', label: 'Junk Removal', icon: '🚛', available: true },
  { id: 'lawn_care', label: 'Lawn Care', icon: '🌿', available: false },
  { id: 'cleaning', label: 'Cleaning', icon: '🧹', available: false },
  { id: 'moving', label: 'Moving', icon: '📦', available: false },
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
  { id: 'starting', label: 'Just starting out', icon: '🌱' },
  { id: 'growing', label: 'Growing', icon: '📈' },
  { id: 'established', label: 'Established', icon: '🏢' },
]

const BIGGEST_CHALLENGES = [
  { id: 'getting_customers', label: 'Getting customers' },
  { id: 'pricing', label: 'Pricing right' },
  { id: 'time_management', label: 'Managing time' },
  { id: 'tracking_money', label: 'Tracking money' },
  { id: 'hiring', label: 'Hiring & team' },
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

export default function OnboardingPage() {
  const { user, isLoaded } = useUser()
  const { getToken } = useAuth()
  const router = useRouter()
  // Read returnUrl from the raw URL to preserve view state through onboarding
  const [returnUrl] = useState(() => {
    if (typeof window === 'undefined') return '/app'
    const params = new URLSearchParams(window.location.search)
    return params.get('returnUrl') || '/app'
  })

  // Initialize Supabase client with Clerk JWT for RLS-authenticated queries.
  // Called synchronously so token getter is set before any queries.
  initSupabaseAuth(() => getToken({ template: 'supabase' }))

  const supabase = createClient()
  const { resolvedTheme, setTheme } = useTheme()
  
  const [currentStep, setCurrentStep] = useState<Step>('welcome')
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Profile state
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  
  // Business state
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [teamSize, setTeamSize] = useState('')
  const [businessPhone, setBusinessPhone] = useState('')
  const [businessEmail, setBusinessEmail] = useState('')
  const [referralSource, setReferralSource] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [businessAddress, setBusinessAddress] = useState('')
  const [serviceArea, setServiceArea] = useState('')
  const [servicesOffered, setServicesOffered] = useState('')
  const [yearsInBusiness, setYearsInBusiness] = useState('')
  
  // Goals & Strategy state
  const [businessStage, setBusinessStage] = useState('')
  const [biggestChallenge, setBiggestChallenge] = useState('')
  const [pricingPhilosophy, setPricingPhilosophy] = useState('')
  
  // Financial state
  const [taxPercentage, setTaxPercentage] = useState(30)
  const [monthlyGoal, setMonthlyGoal] = useState(0)
  const [averageJobRevenue, setAverageJobRevenue] = useState<number | 'not_sure' | ''>('')
  
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
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100
  const isLastStep = currentStep === 'template'

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
  const showChecklist = currentStep === 'business' || currentStep === 'template' || currentStep === 'financials'

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!isLoaded || !user) {
        if (isLoaded) router.push('/sign-in')
        return
      }

      if (user.firstName) setFirstName(user.firstName)
      if (user.lastName) setLastName(user.lastName)

      try {
        const { data: profile } = await supabase
          .from('dyia_users')
          .select('id, first_name, last_name')
          .eq('clerk_user_id', user.id)
          .single()

        if (!profile) {
          // No profile yet — still use Clerk email as the default suggestion
          setBusinessEmail(user.primaryEmailAddress?.emailAddress || '')
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

        if (settings?.onboarding_completed || settings?.onboarding_skipped) {
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
          if (settings.business_logo) setLogoPreview(settings.business_logo)
          if (settings.tax_percentage) setTaxPercentage(settings.tax_percentage)
          if (settings.monthly_goal) setMonthlyGoal(settings.monthly_goal)
        } else {
          // Settings row exists but is empty: use Clerk email as the default suggestion
          setBusinessEmail(user.primaryEmailAddress?.emailAddress || '')
        }

        setLoading(false)
      } catch (err) {
        console.error('Error checking onboarding status:', err)
        setLoading(false)
      }
    }

    checkOnboardingStatus()
  }, [isLoaded, user, supabase, router, returnUrl])

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
    setLogoFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setLogoPreview(reader.result as string)
    reader.onerror = () => setError('Could not read image. Try a different file.')
    reader.readAsDataURL(file)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- handleComplete has many state deps; re-registering listener on every state change is unnecessary
  }, [currentStep, nextStep, isLastStep, saving])

  const handleSkip = async () => {
    if (!userId) return
    setSaving(true)
    setError(null)
    
    try {
      // Try to update with onboarding_skipped column
      const { error: updateError } = await supabase
        .from('dyia_settings')
        .update({ onboarding_skipped: true })
        .eq('user_id', userId)

      // If it fails (column doesn't exist), just proceed to app
      if (updateError) {
        console.warn('Skip update failed (column may not exist):', updateError)
      }
      
      router.push(returnUrl)
    } catch (err) {
      console.error('Skip error:', err)
      // Even if there's an error, let them proceed
      router.push(returnUrl)
    }
  }

  const handleComplete = async () => {
    if (!userId) return
    setSaving(true)
    setError(null)

    try {
      // Update user profile
      const { error: userError } = await supabase
        .from('dyia_users')
        .update({
          first_name: firstName || null,
          last_name: lastName || null,
        })
        .eq('id', userId)
      
      if (userError) {
        console.error('User update error:', userError)
      }

      // Handle logo: compress and save to DB (same as Settings — works without storage bucket)
      let logoUrl: string | null = logoPreview
      if (logoFile) {
        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(logoFile)
          })
          logoUrl = await compressImage(dataUrl, 400, 0.8)
        } catch (err) {
          console.error('Error processing logo:', err)
          setError('Could not process logo image. You can continue without it and add one later in Settings.')
          setSaving(false)
          return
        }
      }

      // Try full update with onboarding columns first
      let settingsError = null
      const fullUpdate = await supabase
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
          onboarding_completed_at: new Date().toISOString(),
          metadata: {
            business_type: businessType,
            team_size: teamSize,
            referral_source: referralSource,
            service_area: serviceArea || undefined,
            services_offered: servicesOffered || undefined,
            average_job_revenue: averageJobRevenue === 'not_sure' ? 'not_sure' : (typeof averageJobRevenue === 'number' ? averageJobRevenue : undefined),
            years_in_business: yearsInBusiness || undefined,
            business_stage: businessStage || undefined,
            biggest_challenge: biggestChallenge || undefined,
            pricing_philosophy: pricingPhilosophy || undefined,
          }
        })
        .eq('user_id', userId)

      if (fullUpdate.error) {
        // If full update fails (likely due to missing columns), try basic update
        console.warn('Full settings update failed, trying basic update:', fullUpdate.error)
        
        const basicUpdate = await supabase
          .from('dyia_settings')
          .update({
            business_name: businessName || null,
            business_phone: businessPhone || null,
            business_email: businessEmail || null,
            business_logo: logoUrl,
            tax_percentage: taxPercentage,
            monthly_goal: monthlyGoal,
          })
          .eq('user_id', userId)
        
        settingsError = basicUpdate.error
      }

      if (settingsError) {
        throw new Error(`Settings update failed: ${settingsError.message}`)
      }

      // Create price template if requested (custom items + legacy keys for QuoteBuilder)
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
        let { error: templateError } = await supabase
          .from('dyia_price_templates')
          .insert({
            user_id: userId,
            name: templateName.trim(),
            prices: pricesPayload,
            is_default: true,
          })

        // Fallback: try without items (legacy-only) in case of schema/RLS issues
        if (templateError) {
          const err = templateError as { message?: string; code?: string }
          const errMsg = err?.message ?? err?.code ?? String(templateError)
          console.warn('Template creation error:', errMsg)
          const legacyOnlyPrices = {
            minimumFee: pricesPayload.minimumFee,
            quarterLoad: pricesPayload.quarterLoad,
            halfLoad: pricesPayload.halfLoad,
            threeQuarterLoad: pricesPayload.threeQuarterLoad,
            fullLoad: pricesPayload.fullLoad,
          }
          const fallback = await supabase
            .from('dyia_price_templates')
            .insert({
              user_id: userId,
              name: templateName.trim(),
              prices: legacyOnlyPrices,
              is_default: true,
            })
          if (fallback.error) {
            console.warn('Template fallback also failed:', (fallback.error as Error).message ?? fallback.error)
          }
        }
      }

      router.push(returnUrl)
    } catch (err) {
      console.error('Onboarding save error:', err)
      const message = err instanceof Error ? err.message : 'Failed to save settings'
      setError(message.includes('column') 
        ? 'Database migration needed. Please run migration 005_onboarding_trial.sql in Supabase.' 
        : message
      )
      setSaving(false)
    }
  }

  const isDark = resolvedTheme === 'dark'

  if (loading || !isLoaded) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        isDark 
          ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' 
          : 'bg-gradient-to-br from-orange-50 via-white to-amber-50'
      }`}>
        <div className="text-center">
          <div className="flex items-center justify-center mb-6">
            <img
              src="/dyia-logo-full.png"
              alt="dyia"
              className="h-10 object-contain"
            />
          </div>
          <div style={{ width: 24, height: 24, border: '2px solid #f97316', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto' }} className="animate-spin" />
        </div>
      </div>
    )
  }

  const stepLabels: Record<Step, string> = {
    welcome: 'Welcome',
    profile: 'You',
    business: 'Business',
    goals: 'Goals',
    financials: 'Finances',
    template: 'Pricing',
  }

  const animationClass = isAnimating 
    ? direction === 'forward' ? 'opacity-0 translate-x-4' : 'opacity-0 -translate-x-4'
    : 'opacity-100 translate-x-0'

  // Theme-aware color scheme
  const colors = {
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
  }

  return (
    <>
      <style jsx global>{`
        .onboarding-input:focus {
          border-color: #f97316 !important;
          box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.15);
        }
      `}</style>
      
      <div className={`min-h-screen transition-colors duration-300 ${colors.bg} ${colors.text}`}>
        {/* Header */}
        <header className="absolute top-0 left-0 right-0 px-6 py-4 flex items-center justify-between z-50">
          <div className="flex items-center">
            <img
              src="/dyia-logo-full.png"
              alt="dyia"
              className="h-9 object-contain"
            />
          </div>
          
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${colors.headerBtn}`}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? (
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            
            {/* Clerk User Button */}
            <UserButton 
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: {
                    width: 36,
                    height: 36,
                  }
                }
              }}
            />
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
                <p className={`text-xs font-semibold mb-2.5 ${setupChecklistComplete ? (isDark ? 'text-green-400' : 'text-green-700') : colors.textMuted}`}>
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
                      <span className={`text-sm ${item.done ? (isDark ? 'text-green-300' : 'text-green-700') : colors.textMuted}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Steps */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                {STEPS.map((step, index) => (
                  <button
                    key={step}
                    onClick={() => index < currentStepIndex && animateToStep(step, 'backward')}
                    disabled={index >= currentStepIndex}
                    className="flex items-center gap-2 bg-transparent border-none p-0"
                    style={{ cursor: index < currentStepIndex ? 'pointer' : 'default' }}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                      index === currentStepIndex 
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/40' 
                        : index < currentStepIndex 
                          ? colors.stepComplete 
                          : colors.stepPending
                    }`}>
                      {index < currentStepIndex ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span className={`text-sm hidden sm:inline ${
                      index === currentStepIndex 
                        ? colors.text 
                        : index < currentStepIndex 
                          ? 'text-orange-500' 
                          : colors.textSubtle
                    }`}>
                      {stepLabels[step]}
                    </span>
                  </button>
                ))}
              </div>
              <div className={`h-1 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                <div 
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Card */}
            <div className={`backdrop-blur-xl rounded-2xl p-5 sm:p-8 border transition-colors ${colors.card}`}>
              <div className={`transition-all duration-150 ${animationClass}`}>
                {currentStep === 'welcome' && (
                  <div className="text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/30">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold mb-3">Welcome to dyia</h1>
                    <p className={`text-base mb-8 max-w-[360px] mx-auto ${colors.textMuted}`}>
                      Your business command center. Track jobs, send quotes, and see your real profit.
                    </p>
                    <div className="flex justify-center gap-8 mb-6">
                      {[
                        { icon: '📋', label: 'Track Jobs' },
                        { icon: '📄', label: 'Send Quotes' },
                        { icon: '💰', label: 'See Profit' },
                      ].map((item) => (
                        <div key={item.label} className="text-center">
                          <div className="text-3xl mb-2">{item.icon}</div>
                          <div className={`text-sm ${colors.textMuted}`}>{item.label}</div>
                        </div>
                      ))}
                    </div>
                    <p className={`text-sm ${colors.textSubtle}`}>Takes about 2 minutes</p>
                  </div>
                )}

                {currentStep === 'profile' && (
                  <div>
                    <h2 className="text-2xl font-bold mb-2">What&apos;s your name?</h2>
                    <p className={`mb-6 ${colors.textMuted}`}>So we know what to call you</p>
                    
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div>
                        <label className={`block text-sm mb-1.5 ${colors.textMuted}`}>First Name</label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="John"
                          className={`w-full px-4 py-3 rounded-xl border text-base outline-none transition-all ${colors.input}`}
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className={`block text-sm mb-1.5 ${colors.textMuted}`}>Last Name</label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Smith"
                          className={`w-full px-4 py-3 rounded-xl border text-base outline-none transition-all ${colors.input}`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={`block text-sm mb-2 ${colors.textMuted}`}>How did you find us?</label>
                      <div className="flex flex-wrap gap-2">
                        {REFERRAL_SOURCES.map((source) => (
                          <button
                            key={source.id}
                            type="button"
                            onClick={() => setReferralSource(source.id)}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                              referralSource === source.id ? colors.chipActive : colors.chip
                            }`}
                          >
                            {source.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 'business' && (
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Your business</h2>
                    <p className={`mb-6 ${colors.textMuted}`}>This appears on your quotes</p>
                    
                    <div className="flex gap-4 mb-5">
                      <label className={`w-[72px] h-[72px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all shrink-0 ${
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
                            <svg className={`w-6 h-6 mb-1 ${colors.textSubtle}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className={`text-[10px] ${colors.textSubtle}`}>Logo</span>
                          </>
                        )}
                      </label>
                      <div className="flex-1">
                        <label className={`block text-sm mb-1.5 ${colors.textMuted}`}>Business Name</label>
                        <input
                          type="text"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          placeholder="Johnson's Junk Removal"
                          className={`w-full px-4 py-3 rounded-xl border text-base outline-none transition-all ${colors.input}`}
                        />
                        <p className={`text-[10px] mt-1 ${colors.textSubtle}`}>Logo: JPG, PNG or WebP, max 2MB</p>
                      </div>
                    </div>

                    <div className="mb-5">
                      <div className="flex items-center gap-2 mb-2">
                        <label className={`block text-sm ${colors.textMuted}`}>Type of business</label>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600'}`}>
                          Lawn care, cleaning &amp; moving coming soon
                        </span>
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
                                : businessType === type.id ? colors.chipActive : colors.chip
                            }`}
                          >
                            <span>{type.icon}</span>
                            <span>{type.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-5">
                      <AnimatedDropdown
                        label="Team size"
                        options={TEAM_SIZES}
                        value={teamSize}
                        onChange={setTeamSize}
                        placeholder="Select team size"
                        isDark={isDark}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                      <div>
                        <label className={`block text-sm mb-1.5 ${colors.textMuted}`}>Phone</label>
                        <input
                          type="tel"
                          value={businessPhone}
                          onChange={(e) => setBusinessPhone(e.target.value)}
                          placeholder="(555) 123-4567"
                          className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${colors.input}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-sm mb-1.5 ${colors.textMuted}`}>Email</label>
                        <input
                          type="email"
                          value={businessEmail}
                          onChange={(e) => setBusinessEmail(e.target.value)}
                          placeholder="hello@business.com"
                          className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${colors.input}`}
                        />
                      </div>
                    </div>

                    <div className="mb-5">
                      <label className={`block text-sm mb-1.5 ${colors.textMuted}`}>Business Address</label>
                      <input
                        type="text"
                        value={businessAddress}
                        onChange={(e) => setBusinessAddress(e.target.value)}
                        placeholder="123 Main St, City, State"
                        className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${colors.input}`}
                      />
                      <p className={`text-[10px] mt-1 ${colors.textSubtle}`}>Shows on your quote PDFs</p>
                    </div>

                    <div className="mb-5">
                      <label className={`block text-sm mb-1.5 ${colors.textMuted}`}>Service Area</label>
                      <input
                        type="text"
                        value={serviceArea}
                        onChange={(e) => setServiceArea(e.target.value)}
                        placeholder="e.g. Metro Atlanta"
                        className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${colors.input}`}
                      />
                    </div>

                    <div className="mb-5">
                      <label className={`block text-sm mb-1.5 ${colors.textMuted}`}>Services you offer</label>
                      <p className={`text-xs mb-2 ${colors.textSubtle}`}>
                        This is for context so the Dyia AI assistant can give you better, tailored advice. List your main services — e.g. comma-separated (Junk removal, Haul away, Demolition) or a short description.
                      </p>
                      <input
                        type="text"
                        value={servicesOffered}
                        onChange={(e) => setServicesOffered(e.target.value)}
                        placeholder="e.g. Junk removal, haul away, demolition"
                        className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${colors.input}`}
                      />
                    </div>

                    <div>
                      <AnimatedDropdown
                        label="Years in business"
                        options={YEARS_OPTIONS}
                        value={yearsInBusiness}
                        onChange={setYearsInBusiness}
                        placeholder="Select years in business"
                        isDark={isDark}
                      />
                    </div>
                  </div>
                )}

                {currentStep === 'goals' && (
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Your goals</h2>
                    <p className={`mb-6 ${colors.textMuted}`}>Helps Dyia give you better advice</p>
                    
                    <div className="mb-5">
                      <label className={`block text-sm mb-2 ${colors.textMuted}`}>Where is your business at?</label>
                      <div className="grid grid-cols-3 gap-2">
                        {BUSINESS_STAGES.map((stage) => (
                          <button
                            key={stage.id}
                            type="button"
                            onClick={() => setBusinessStage(stage.id)}
                            className={`px-3 py-3 rounded-xl border text-sm font-medium transition-all flex flex-col items-center gap-1.5 ${
                              businessStage === stage.id ? colors.chipActive : colors.chip
                            }`}
                          >
                            <span className="text-xl">{stage.icon}</span>
                            <span>{stage.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-5">
                      <label className={`block text-sm mb-2 ${colors.textMuted}`}>Biggest challenge right now?</label>
                      <div className="flex flex-wrap gap-2">
                        {BIGGEST_CHALLENGES.map((ch) => (
                          <button
                            key={ch.id}
                            type="button"
                            onClick={() => setBiggestChallenge(ch.id)}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                              biggestChallenge === ch.id ? colors.chipActive : colors.chip
                            }`}
                          >
                            {ch.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className={`block text-sm mb-2 ${colors.textMuted}`}>Pricing approach?</label>
                      <div className="space-y-2">
                        {PRICING_PHILOSOPHIES.map((ph) => (
                          <button
                            key={ph.id}
                            type="button"
                            onClick={() => setPricingPhilosophy(ph.id)}
                            className={`w-full px-4 py-3 rounded-xl border text-left transition-all ${
                              pricingPhilosophy === ph.id ? colors.chipActive : colors.chip
                            }`}
                          >
                            <div className="font-medium text-sm">{ph.label}</div>
                            <div className={`text-xs mt-0.5 ${pricingPhilosophy === ph.id ? 'text-white/70' : colors.textSubtle}`}>{ph.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 'financials' && (
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Financial settings</h2>
                    <p className={`mb-6 ${colors.textMuted}`}>Calculate your real take-home profit</p>
                    
                    <div className={`rounded-2xl p-5 mb-5 border ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <div className="text-base font-semibold mb-0.5">Tax Rate</div>
                          <div className={`text-xs ${colors.textSubtle}`}>Your self-employment tax bracket</div>
                        </div>
                        <div className="text-3xl font-bold text-orange-500">{taxPercentage}%</div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={taxPercentage}
                        onChange={(e) => setTaxPercentage(Number(e.target.value))}
                        className="w-full accent-orange-500"
                      />
                      <div className={`flex justify-between text-xs mt-1 ${colors.textSubtle}`}>
                        <span>0%</span><span>25%</span><span>50%</span>
                      </div>
                    </div>

                    <div className={`rounded-2xl p-5 border ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="text-base font-semibold mb-0.5">Monthly Revenue Goal</div>
                      <div className={`text-xs mb-3 ${colors.textSubtle}`}>We&apos;ll track your progress. This can be updated monthly.</div>
                      <div className="relative">
                        <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-lg ${colors.textSubtle}`}>$</span>
                        <input
                          type="number"
                          value={monthlyGoal || ''}
                          onChange={(e) => setMonthlyGoal(Number(e.target.value) || 0)}
                          placeholder="8000"
                          className={`w-full pl-9 pr-4 py-3 rounded-xl border text-lg outline-none transition-all ${colors.input}`}
                        />
                      </div>
                      <div className="flex gap-2 mt-3">
                        {[5000, 8000, 10000, 15000].map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => setMonthlyGoal(amount)}
                            className={`flex-1 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                              monthlyGoal === amount ? colors.chipActive : colors.chip
                            }`}
                          >
                            ${(amount / 1000)}k
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={`rounded-2xl p-5 mt-5 border ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="text-base font-semibold mb-0.5">Average job revenue</div>
                      <div className={`text-xs mb-3 ${colors.textSubtle}`}>Typical revenue per job (optional)</div>
                      <div className="flex flex-wrap gap-2">
                        {[200, 500, 800, 1500].map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => setAverageJobRevenue(amount)}
                            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                              averageJobRevenue === amount ? colors.chipActive : colors.chip
                            }`}
                          >
                            ${amount}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setAverageJobRevenue('not_sure')}
                          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                            averageJobRevenue === 'not_sure' ? colors.chipActive : colors.chip
                          }`}
                        >
                          Not sure
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 'template' && (
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Price template</h2>
                    <p className={`mb-5 ${colors.textMuted}`}>Standard pricing for quick quotes</p>
                    
                    <label className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer mb-5 border transition-all ${
                      isDark ? 'bg-slate-700/50 border-slate-600 hover:border-slate-500' : 'bg-slate-50 border-slate-200 hover:border-orange-300'
                    }`}>
                      <input
                        type="checkbox"
                        checked={createTemplate}
                        onChange={(e) => setCreateTemplate(e.target.checked)}
                        className="w-5 h-5 accent-orange-500"
                      />
                      <div>
                        <div className="font-semibold mb-0.5">Create a price template</div>
                        <div className={`text-xs ${colors.textSubtle}`}>Speed up quote creation</div>
                      </div>
                    </label>
                    
                    {createTemplate && (
                      <div>
                        <input
                          type="text"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          placeholder="Template Name"
                          className={`w-full px-4 py-3 rounded-xl border text-base outline-none transition-all mb-4 ${colors.input}`}
                        />
                        <p className={`text-xs mb-3 ${colors.textSubtle}`}>Add your own price tiers — edit the label and amount, or add more rows.</p>
                        <div className="space-y-3">
                          {priceRows.map((row) => (
                            <div key={row.id} className="flex gap-2 items-center">
                              <input
                                type="text"
                                value={row.label}
                                onChange={(e) => setPriceRows(prev => prev.map(r => r.id === row.id ? { ...r, label: e.target.value } : r))}
                                placeholder="Label"
                                className={`flex-1 min-w-0 px-3 py-2.5 rounded-xl border text-sm outline-none transition-all ${colors.input}`}
                              />
                              <div className="relative w-28 shrink-0">
                                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${colors.textSubtle}`}>$</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={row.amount || ''}
                                  onChange={(e) => setPriceRows(prev => prev.map(r => r.id === row.id ? { ...r, amount: Number(e.target.value) || 0 } : r))}
                                  className={`w-full pl-7 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-all ${colors.input}`}
                                  placeholder="0"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => setPriceRows(prev => prev.filter(r => r.id !== row.id))}
                                disabled={priceRows.length <= 1}
                                className={`p-2.5 rounded-xl border shrink-0 transition-all ${colors.chip} disabled:opacity-50 disabled:cursor-not-allowed`}
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
                          className={`mt-3 w-full py-2.5 rounded-xl border text-sm font-medium transition-all ${colors.chip}`}
                        >
                          + Add price tier
                        </button>
                      </div>
                    )}
                    
                    {!createTemplate && (
                      <p className={`text-sm ${colors.textSubtle}`}>You can create templates later in Settings.</p>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center mt-6">
              {currentStep === 'welcome' ? (
                <button
                  onClick={handleSkip}
                  disabled={saving}
                  className={`bg-transparent border-none text-sm cursor-pointer p-2 transition-colors ${colors.textSubtle} hover:text-orange-500`}
                >
                  Skip setup
                </button>
              ) : (
                <button
                  onClick={prevStep}
                  disabled={saving || isAnimating}
                  className={`bg-transparent border-none text-sm cursor-pointer p-2 flex items-center gap-1 transition-colors ${colors.textMuted} hover:text-orange-500`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
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
                  'Get Started'
                ) : (
                  <>
                    Continue
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </div>
            {isLastStep && showChecklist && !setupChecklistComplete && (
              <p className={`text-center text-xs mt-2 ${colors.textSubtle}`}>
                Complete the items above for a full profile, or click Get Started to finish later in Settings.
              </p>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
