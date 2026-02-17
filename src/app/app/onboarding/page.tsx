'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser, useAuth, UserButton } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { createClient, initSupabaseAuth } from '@/lib/supabase/client'
import { useTheme } from '@/hooks/useTheme'

type Step = 'welcome' | 'you' | 'business' | 'strategy' | 'financials' | 'pricing'

const STEPS: Step[] = ['welcome', 'you', 'business', 'strategy', 'financials', 'pricing']

const BUSINESS_TYPES = [
  { id: 'junk_removal', label: 'Junk Removal', icon: '🚛' },
  { id: 'lawn_care', label: 'Lawn Care', icon: '🌿' },
  { id: 'cleaning', label: 'Cleaning', icon: '🧹' },
  { id: 'moving', label: 'Moving', icon: '📦' },
  { id: 'handyman', label: 'Handyman', icon: '🔧' },
  { id: 'other', label: 'Other', icon: '💼' },
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

  const supabase = createClient()
  const { resolvedTheme, setTheme } = useTheme()
  
  const [currentStep, setCurrentStep] = useState<Step>('welcome')
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Profile
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [referralSource, setReferralSource] = useState('')
  
  // Business
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [teamSize, setTeamSize] = useState('')
  const [businessPhone, setBusinessPhone] = useState('')
  const [businessEmail, setBusinessEmail] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [serviceArea, setServiceArea] = useState('')
  const [yearsInBusiness, setYearsInBusiness] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  
  // Strategy & AI context
  const [businessStage, setBusinessStage] = useState('')
  const [biggestChallenge, setBiggestChallenge] = useState('')
  const [pricingPhilosophy, setPricingPhilosophy] = useState('')
  const [weeklyJobCapacity, setWeeklyJobCapacity] = useState('')
  const [averageJobRevenue, setAverageJobRevenue] = useState(0)
  const [marketingChannels, setMarketingChannels] = useState<string[]>([])
  const [commonServices, setCommonServices] = useState('')
  
  // Financial
  const [taxPercentage, setTaxPercentage] = useState(30)
  const [monthlyGoal, setMonthlyGoal] = useState(0)
  
  // Pricing template
  const [createTemplate, setCreateTemplate] = useState(true)
  const [templateName, setTemplateName] = useState('Standard Pricing')
  const [prices, setPrices] = useState({
    minimumFee: 75,
    quarterLoad: 150,
    halfLoad: 250,
    threeQuarterLoad: 350,
    fullLoad: 450,
  })

  const currentStepIndex = STEPS.indexOf(currentStep)
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100
  const isLastStep = currentStep === 'pricing'

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!isLoaded || !user) {
        if (isLoaded) router.push('/sign-in')
        return
      }

      if (user.firstName) setFirstName(user.firstName)
      if (user.lastName) setLastName(user.lastName)
      if (user.primaryEmailAddress?.emailAddress) {
        setBusinessEmail(user.primaryEmailAddress.emailAddress)
      }

      try {
        const { data: profile } = await supabase
          .from('dyia_users')
          .select('id, first_name, last_name')
          .eq('clerk_user_id', user.id)
          .single()

        if (!profile) {
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
          if (settings.business_email) setBusinessEmail(settings.business_email)
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
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('Logo must be under 2MB')
        return
      }
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setLogoPreview(reader.result as string)
      reader.readAsDataURL(file)
      setError(null)
    }
  }

  const toggleMarketingChannel = (id: string) => {
    setMarketingChannels(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const animateToStep = useCallback((newStep: Step, dir: 'forward' | 'backward') => {
    if (isAnimating) return
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
    if (!userId) return
    setSaving(true)
    setError(null)
    
    try {
      await supabase
        .from('dyia_settings')
        .update({ onboarding_skipped: true })
        .eq('user_id', userId)
      
      router.push(returnUrl)
    } catch (err) {
      console.error('Skip error:', err)
      router.push(returnUrl)
    }
  }

  const handleComplete = async () => {
    if (!userId) return
    setSaving(true)
    setError(null)

    try {
      await supabase
        .from('dyia_users')
        .update({ first_name: firstName || null, last_name: lastName || null })
        .eq('id', userId)

      let logoUrl = logoPreview
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop()
        const fileName = `${userId}-logo-${Date.now()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(fileName, logoFile, { upsert: true })
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(fileName)
          logoUrl = publicUrl
        }
      }

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
          onboarding_skipped: false,
          onboarding_completed_at: new Date().toISOString(),
          metadata: {
            business_type: businessType || undefined,
            team_size: teamSize || undefined,
            referral_source: referralSource || undefined,
            service_area: serviceArea || undefined,
            years_in_business: yearsInBusiness || undefined,
            business_stage: businessStage || undefined,
            biggest_challenge: biggestChallenge || undefined,
            pricing_philosophy: pricingPhilosophy || undefined,
            weekly_job_capacity: weeklyJobCapacity || undefined,
            average_job_revenue: averageJobRevenue || undefined,
            marketing_channels: marketingChannels.length > 0 ? marketingChannels : undefined,
            common_services: commonServices || undefined,
          }
        })
        .eq('user_id', userId)

      if (fullUpdate.error) {
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
        if (basicUpdate.error) throw new Error(`Settings update failed: ${basicUpdate.error.message}`)
      }

      if (createTemplate && templateName) {
        await supabase.from('dyia_price_templates').insert({
          user_id: userId,
          name: templateName,
          prices: prices,
          is_default: true,
        })
      }

      router.push(returnUrl)
    } catch (err) {
      console.error('Onboarding save error:', err)
      const message = err instanceof Error ? err.message : 'Failed to save settings'
      setError(message.includes('column') 
        ? 'Database migration needed. Please run the latest migration in Supabase.' 
        : message
      )
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
          <img src="/dyia-logo-full.png" alt="dyia" className="h-10 object-contain mx-auto mb-6" />
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
          <img src="/dyia-logo-full.png" alt="dyia" className="h-9 object-contain" />
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
          <div className="w-full max-w-[540px]">
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
                          ? c.stepComplete 
                          : c.stepPending
                    }`}>
                      {index < currentStepIndex ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      ) : index + 1}
                    </div>
                    <span className={`text-sm hidden sm:inline ${
                      index === currentStepIndex ? c.text : index < currentStepIndex ? 'text-orange-500' : c.textSubtle
                    }`}>{stepLabels[step]}</span>
                  </button>
                ))}
              </div>
              <div className={`h-1 rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                <div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {/* Card */}
            <div className={`backdrop-blur-xl rounded-2xl p-8 border transition-colors ${c.card}`}>
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
                      <label className={`w-[72px] h-[72px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all shrink-0 ${
                        isDark ? 'border-slate-600 bg-slate-700/50 hover:border-slate-500' : 'border-slate-300 bg-slate-100 hover:border-orange-400'
                      }`}>
                        <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
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
                      </div>
                    </div>

                    <div className="mb-5">
                      <label className={`block text-sm mb-2 ${c.textMuted}`}>Type of business</label>
                      <div className="grid grid-cols-3 gap-2">
                        {BUSINESS_TYPES.map((type) => (
                          <button key={type.id} type="button" onClick={() => setBusinessType(type.id)}
                            className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${businessType === type.id ? c.chipActive : c.chip}`}>
                            <span>{type.icon}</span><span>{type.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-5">
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

                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div>
                        <label className={`block text-sm mb-1.5 ${c.textMuted}`}>Phone</label>
                        <input type="tel" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} placeholder="(555) 123-4567"
                          className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all onboarding-input ${c.input}`} />
                      </div>
                      <div>
                        <label className={`block text-sm mb-1.5 ${c.textMuted}`}>Email</label>
                        <input type="email" value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} placeholder="hello@business.com"
                          className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all onboarding-input ${c.input}`} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
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

                {/* ===== STRATEGY (AI-relevant) ===== */}
                {currentStep === 'strategy' && (
                  <div>
                    <h2 className="text-2xl font-bold mb-1">Your business strategy</h2>
                    <p className={`mb-6 text-sm ${c.textMuted}`}>Dyia uses this to give you personalized advice, pricing suggestions, and insights</p>
                    
                    <div className="mb-5">
                      <label className={`block text-sm mb-2 ${c.textMuted}`}>Where is your business at?</label>
                      <div className="grid grid-cols-3 gap-2">
                        {BUSINESS_STAGES.map((stage) => (
                          <button key={stage.id} type="button" onClick={() => setBusinessStage(stage.id)}
                            className={`px-3 py-3 rounded-xl border text-sm font-medium transition-all flex flex-col items-center gap-1 ${businessStage === stage.id ? c.chipActive : c.chip}`}>
                            <span className="text-lg">{stage.icon}</span>
                            <span className="text-xs font-semibold">{stage.label}</span>
                            <span className={`text-[10px] ${businessStage === stage.id ? 'text-white/70' : c.textSubtle}`}>{stage.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-5">
                      <label className={`block text-sm mb-2 ${c.textMuted}`}>Biggest challenge right now?</label>
                      <div className="flex flex-wrap gap-2">
                        {BIGGEST_CHALLENGES.map((ch) => (
                          <button key={ch.id} type="button" onClick={() => setBiggestChallenge(ch.id)}
                            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${biggestChallenge === ch.id ? c.chipActive : c.chip}`}>
                            {ch.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-5">
                      <label className={`block text-sm mb-2 ${c.textMuted}`}>Pricing approach?</label>
                      <div className="space-y-2">
                        {PRICING_PHILOSOPHIES.map((ph) => (
                          <button key={ph.id} type="button" onClick={() => setPricingPhilosophy(ph.id)}
                            className={`w-full px-4 py-3 rounded-xl border text-left transition-all ${pricingPhilosophy === ph.id ? c.chipActive : c.chip}`}>
                            <div className="font-medium text-sm">{ph.label}</div>
                            <div className={`text-xs mt-0.5 ${pricingPhilosophy === ph.id ? 'text-white/70' : c.textSubtle}`}>{ph.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div>
                        <label className={`block text-sm mb-2 ${c.textMuted}`}>Jobs per week?</label>
                        <div className="flex gap-1.5">
                          {WEEKLY_JOB_CAPACITY.map((cap) => (
                            <button key={cap.id} type="button" onClick={() => setWeeklyJobCapacity(cap.id)}
                              className={`flex-1 px-2 py-2 rounded-lg border text-xs font-medium transition-all ${weeklyJobCapacity === cap.id ? c.chipActive : c.chip}`}>
                              {cap.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className={`block text-sm mb-1.5 ${c.textMuted}`}>Avg job revenue?</label>
                        <div className="relative">
                          <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${c.textSubtle}`}>$</span>
                          <input type="number" value={averageJobRevenue || ''} onChange={(e) => setAverageJobRevenue(Number(e.target.value) || 0)} placeholder="350"
                            className={`w-full pl-7 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-all onboarding-input ${c.input}`} />
                        </div>
                      </div>
                    </div>

                    <div className="mb-5">
                      <label className={`block text-sm mb-2 ${c.textMuted}`}>Where do you get customers?</label>
                      <div className="flex flex-wrap gap-2">
                        {MARKETING_CHANNELS.map((ch) => (
                          <button key={ch.id} type="button" onClick={() => toggleMarketingChannel(ch.id)}
                            className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${marketingChannels.includes(ch.id) ? c.chipActive : c.chip}`}>
                            {ch.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className={`block text-sm mb-1.5 ${c.textMuted}`}>Common services you offer</label>
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
                      <div className={`text-xs mb-3 ${c.textSubtle}`}>We&apos;ll track your progress on the dashboard</div>
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
                        <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Template Name"
                          className={`w-full px-4 py-3 rounded-xl border text-base outline-none transition-all onboarding-input mb-4 ${c.input}`} />
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { key: 'minimumFee', label: 'Minimum', val: '75' },
                            { key: 'quarterLoad', label: '1/4 Load', val: '150' },
                            { key: 'halfLoad', label: '1/2 Load', val: '250' },
                            { key: 'threeQuarterLoad', label: '3/4 Load', val: '350' },
                          ].map(({ key, label, val }) => (
                            <div key={key}>
                              <label className={`block text-xs mb-1 ${c.textMuted}`}>{label}</label>
                              <div className="relative">
                                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${c.textSubtle}`}>$</span>
                                <input type="number" value={prices[key as keyof typeof prices] || ''} onChange={(e) => setPrices({ ...prices, [key]: Number(e.target.value) || 0 })}
                                  className={`w-full pl-7 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-all onboarding-input ${c.input}`} placeholder={val} />
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3">
                          <label className={`block text-xs mb-1 ${c.textMuted}`}>Full Load</label>
                          <div className="relative">
                            <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm ${c.textSubtle}`}>$</span>
                            <input type="number" value={prices.fullLoad || ''} onChange={(e) => setPrices({ ...prices, fullLoad: Number(e.target.value) || 0 })}
                              className={`w-full pl-7 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-all onboarding-input ${c.input}`} placeholder="450" />
                          </div>
                        </div>
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
          </div>
        </main>
      </div>
    </>
  )
}
