'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Step = 'welcome' | 'profile' | 'business' | 'financials' | 'template'

const STEPS: Step[] = ['welcome', 'profile', 'business', 'financials', 'template']

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

export default function OnboardingPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const supabase = createClient()
  
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
  
  // Financial state
  const [taxPercentage, setTaxPercentage] = useState(30)
  const [monthlyGoal, setMonthlyGoal] = useState(0)
  
  // Price template state
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
  const isLastStep = currentStep === 'template'

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

        if (settings?.onboarding_completed || settings?.onboarding_skipped) {
          router.push('/app')
          return
        }

        if (settings) {
          if (settings.business_name) setBusinessName(settings.business_name)
          if (settings.business_phone) setBusinessPhone(settings.business_phone)
          if (settings.business_email) setBusinessEmail(settings.business_email)
          if (settings.business_logo) setLogoPreview(settings.business_logo)
          if (settings.tax_percentage) setTaxPercentage(settings.tax_percentage)
          if (settings.monthly_goal) setMonthlyGoal(settings.monthly_goal)
        }

        setLoading(false)
      } catch (err) {
        console.error('Error checking onboarding status:', err)
        setLoading(false)
      }
    }

    checkOnboardingStatus()
  }, [isLoaded, user, supabase, router])

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
  }, [currentStep, nextStep, isLastStep, saving])

  const handleSkip = async () => {
    if (!userId) return
    setSaving(true)
    setError(null)
    
    try {
      const { error: updateError } = await supabase
        .from('dyia_settings')
        .update({ onboarding_skipped: true })
        .eq('user_id', userId)

      if (updateError) throw updateError
      router.push('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to skip onboarding')
      setSaving(false)
    }
  }

  const handleComplete = async () => {
    if (!userId) return
    setSaving(true)
    setError(null)

    try {
      await supabase
        .from('dyia_users')
        .update({
          first_name: firstName || null,
          last_name: lastName || null,
        })
        .eq('id', userId)

      let logoUrl = logoPreview
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop()
        const fileName = `${userId}-logo-${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(fileName, logoFile, { upsert: true })

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('logos')
            .getPublicUrl(fileName)
          logoUrl = publicUrl
        }
      }

      const { error: settingsError } = await supabase
        .from('dyia_settings')
        .update({
          business_name: businessName || null,
          business_phone: businessPhone || null,
          business_email: businessEmail || null,
          business_logo: logoUrl,
          tax_percentage: taxPercentage,
          monthly_goal: monthlyGoal,
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString(),
          metadata: {
            business_type: businessType,
            team_size: teamSize,
            referral_source: referralSource,
          }
        })
        .eq('user_id', userId)

      if (settingsError) throw settingsError

      if (createTemplate && templateName) {
        await supabase
          .from('dyia_price_templates')
          .insert({
            user_id: userId,
            name: templateName,
            prices: prices,
            is_default: true,
          })
      }

      router.push('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
      setSaving(false)
    }
  }

  if (loading || !isLoaded) {
    return (
      <div className="onboarding-page">
        <style jsx global>{`
          .onboarding-page {
            min-height: 100vh;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
            display: flex;
            align-items: center;
            justify-content: center;
          }
        `}</style>
        <div className="text-center">
          <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #f97316, #f59e0b)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg style={{ width: 24, height: 24, color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
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
    financials: 'Finances',
    template: 'Pricing',
  }

  const animationClass = isAnimating 
    ? direction === 'forward' ? 'opacity-0 translate-x-4' : 'opacity-0 -translate-x-4'
    : 'opacity-100 translate-x-0'

  return (
    <>
      <style jsx global>{`
        .onboarding-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
          color: white;
        }
        .onboarding-page * {
          box-sizing: border-box;
        }
        .onboarding-input {
          width: 100%;
          padding: 12px 16px;
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 12px;
          color: white;
          font-size: 15px;
          outline: none;
          transition: all 0.2s;
        }
        .onboarding-input::placeholder {
          color: #64748b;
        }
        .onboarding-input:focus {
          border-color: #f97316;
          box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
        }
        .onboarding-card {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 20px;
          padding: 32px;
        }
        .onboarding-btn {
          padding: 14px 32px;
          background: linear-gradient(135deg, #f97316, #f59e0b);
          color: white;
          font-weight: 600;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 160px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .onboarding-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(249, 115, 22, 0.3);
        }
        .onboarding-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        .chip {
          padding: 8px 16px;
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 10px;
          color: #94a3b8;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .chip:hover {
          background: rgba(51, 65, 85, 0.8);
          color: white;
        }
        .chip.active {
          background: #f97316;
          border-color: #f97316;
          color: white;
        }
        .step-dot {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 600;
          transition: all 0.3s;
        }
        .step-dot.active {
          background: #f97316;
          color: white;
          box-shadow: 0 0 20px rgba(249, 115, 22, 0.4);
        }
        .step-dot.complete {
          background: rgba(249, 115, 22, 0.2);
          color: #f97316;
        }
        .step-dot.pending {
          background: rgba(51, 65, 85, 0.8);
          color: #475569;
        }
      `}</style>
      
      <div className="onboarding-page">
        {/* Header */}
        <header style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #f97316, #f59e0b)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg style={{ width: 20, height: 20, color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span style={{ color: 'white', fontWeight: 600, fontSize: 18 }}>dyia</span>
          </div>
        </header>

        {/* Main */}
        <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '80px 16px 40px' }}>
          <div style={{ width: '100%', maxWidth: 520 }}>
            {/* Steps */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                {STEPS.map((step, index) => (
                  <button
                    key={step}
                    onClick={() => index < currentStepIndex && animateToStep(step, 'backward')}
                    disabled={index >= currentStepIndex}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: index < currentStepIndex ? 'pointer' : 'default', padding: 0 }}
                  >
                    <div className={`step-dot ${index === currentStepIndex ? 'active' : index < currentStepIndex ? 'complete' : 'pending'}`}>
                      {index < currentStepIndex ? (
                        <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span style={{ fontSize: 14, color: index === currentStepIndex ? 'white' : index < currentStepIndex ? '#f97316' : '#475569', display: 'none' }} className="sm:inline">
                      {stepLabels[step]}
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ height: 4, background: 'rgba(51, 65, 85, 0.5)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #f97316, #f59e0b)', transition: 'width 0.3s ease', borderRadius: 4 }} />
              </div>
            </div>

            {/* Card */}
            <div className="onboarding-card">
              <div className={`transition-all duration-150 ${animationClass}`}>
                {currentStep === 'welcome' && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 80, height: 80, background: 'linear-gradient(135deg, #f97316, #f59e0b)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 8px 32px rgba(249, 115, 22, 0.3)' }}>
                      <svg style={{ width: 40, height: 40, color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Welcome to dyia</h1>
                    <p style={{ color: '#94a3b8', fontSize: 16, marginBottom: 32, maxWidth: 360, margin: '0 auto 32px' }}>
                      Your business command center. Track jobs, send quotes, and see your real profit.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 24 }}>
                      {[
                        { icon: '📋', label: 'Track Jobs' },
                        { icon: '📄', label: 'Send Quotes' },
                        { icon: '💰', label: 'See Profit' },
                      ].map((item) => (
                        <div key={item.label} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 28, marginBottom: 8 }}>{item.icon}</div>
                          <div style={{ fontSize: 13, color: '#94a3b8' }}>{item.label}</div>
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: 13, color: '#64748b' }}>Takes about 2 minutes</p>
                  </div>
                )}

                {currentStep === 'profile' && (
                  <div>
                    <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>What&apos;s your name?</h2>
                    <p style={{ color: '#94a3b8', marginBottom: 24 }}>So we know what to call you</p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 14, color: '#cbd5e1', marginBottom: 6 }}>First Name</label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="John"
                          className="onboarding-input"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 14, color: '#cbd5e1', marginBottom: 6 }}>Last Name</label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Smith"
                          className="onboarding-input"
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 14, color: '#cbd5e1', marginBottom: 8 }}>How did you find us?</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {REFERRAL_SOURCES.map((source) => (
                          <button
                            key={source.id}
                            type="button"
                            onClick={() => setReferralSource(source.id)}
                            className={`chip ${referralSource === source.id ? 'active' : ''}`}
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
                    <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Your business</h2>
                    <p style={{ color: '#94a3b8', marginBottom: 24 }}>This appears on your quotes</p>
                    
                    <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                      <label style={{ width: 72, height: 72, borderRadius: 14, border: '2px dashed rgba(71, 85, 105, 0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(30, 41, 59, 0.5)', transition: 'all 0.2s', flexShrink: 0 }}>
                        <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 12 }} />
                        ) : (
                          <>
                            <svg style={{ width: 24, height: 24, color: '#64748b', marginBottom: 4 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span style={{ fontSize: 10, color: '#64748b' }}>Logo</span>
                          </>
                        )}
                      </label>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: 14, color: '#cbd5e1', marginBottom: 6 }}>Business Name</label>
                        <input
                          type="text"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          placeholder="Johnson's Junk Removal"
                          className="onboarding-input"
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <label style={{ display: 'block', fontSize: 14, color: '#cbd5e1', marginBottom: 8 }}>Type of business</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {BUSINESS_TYPES.map((type) => (
                          <button
                            key={type.id}
                            type="button"
                            onClick={() => setBusinessType(type.id)}
                            className={`chip ${businessType === type.id ? 'active' : ''}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
                          >
                            <span>{type.icon}</span>
                            <span style={{ fontSize: 12 }}>{type.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <label style={{ display: 'block', fontSize: 14, color: '#cbd5e1', marginBottom: 8 }}>Team size</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {TEAM_SIZES.map((size) => (
                          <button
                            key={size.id}
                            type="button"
                            onClick={() => setTeamSize(size.id)}
                            className={`chip ${teamSize === size.id ? 'active' : ''}`}
                            style={{ flex: 1 }}
                          >
                            {size.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 14, color: '#cbd5e1', marginBottom: 6 }}>Phone</label>
                        <input
                          type="tel"
                          value={businessPhone}
                          onChange={(e) => setBusinessPhone(e.target.value)}
                          placeholder="(555) 123-4567"
                          className="onboarding-input"
                          style={{ fontSize: 14 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 14, color: '#cbd5e1', marginBottom: 6 }}>Email</label>
                        <input
                          type="email"
                          value={businessEmail}
                          onChange={(e) => setBusinessEmail(e.target.value)}
                          placeholder="hello@business.com"
                          className="onboarding-input"
                          style={{ fontSize: 14 }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 'financials' && (
                  <div>
                    <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Financial settings</h2>
                    <p style={{ color: '#94a3b8', marginBottom: 24 }}>Calculate your real take-home profit</p>
                    
                    <div style={{ background: 'rgba(30, 41, 59, 0.5)', borderRadius: 16, padding: 20, marginBottom: 20, border: '1px solid rgba(51, 65, 85, 0.5)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Tax Rate</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>Your self-employment tax bracket</div>
                        </div>
                        <div style={{ fontSize: 32, fontWeight: 700, color: '#f97316' }}>{taxPercentage}%</div>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={taxPercentage}
                        onChange={(e) => setTaxPercentage(Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#f97316' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        <span>0%</span><span>25%</span><span>50%</span>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(30, 41, 59, 0.5)', borderRadius: 16, padding: 20, border: '1px solid rgba(51, 65, 85, 0.5)' }}>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>Monthly Revenue Goal</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>We&apos;ll track your progress</div>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 18 }}>$</span>
                        <input
                          type="number"
                          value={monthlyGoal || ''}
                          onChange={(e) => setMonthlyGoal(Number(e.target.value) || 0)}
                          placeholder="8000"
                          className="onboarding-input"
                          style={{ paddingLeft: 36, fontSize: 18 }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        {[5000, 8000, 10000, 15000].map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => setMonthlyGoal(amount)}
                            className={`chip ${monthlyGoal === amount ? 'active' : ''}`}
                            style={{ flex: 1, fontSize: 12, padding: '6px 8px' }}
                          >
                            ${(amount / 1000)}k
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {currentStep === 'template' && (
                  <div>
                    <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Price template</h2>
                    <p style={{ color: '#94a3b8', marginBottom: 20 }}>Standard pricing for quick quotes</p>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'rgba(30, 41, 59, 0.5)', borderRadius: 12, cursor: 'pointer', marginBottom: 20, border: '1px solid rgba(51, 65, 85, 0.5)' }}>
                      <input
                        type="checkbox"
                        checked={createTemplate}
                        onChange={(e) => setCreateTemplate(e.target.checked)}
                        style={{ width: 20, height: 20, accentColor: '#f97316' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>Create a price template</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>Speed up quote creation</div>
                      </div>
                    </label>
                    
                    {createTemplate && (
                      <div>
                        <input
                          type="text"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          placeholder="Template Name"
                          className="onboarding-input"
                          style={{ marginBottom: 16 }}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          {[
                            { key: 'minimumFee', label: 'Minimum', val: '75' },
                            { key: 'quarterLoad', label: '1/4 Load', val: '150' },
                            { key: 'halfLoad', label: '1/2 Load', val: '250' },
                            { key: 'threeQuarterLoad', label: '3/4 Load', val: '350' },
                          ].map(({ key, label, val }) => (
                            <div key={key}>
                              <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{label}</label>
                              <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 14 }}>$</span>
                                <input
                                  type="number"
                                  value={prices[key as keyof typeof prices] || ''}
                                  onChange={(e) => setPrices({ ...prices, [key]: Number(e.target.value) || 0 })}
                                  className="onboarding-input"
                                  style={{ paddingLeft: 28, fontSize: 14 }}
                                  placeholder={val}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: 12 }}>
                          <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Full Load</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: 14 }}>$</span>
                            <input
                              type="number"
                              value={prices.fullLoad || ''}
                              onChange={(e) => setPrices({ ...prices, fullLoad: Number(e.target.value) || 0 })}
                              className="onboarding-input"
                              style={{ paddingLeft: 28, fontSize: 14 }}
                              placeholder="450"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {!createTemplate && (
                      <p style={{ color: '#64748b', fontSize: 14 }}>You can create templates later in Settings.</p>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div style={{ marginTop: 20, padding: 16, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 12, color: '#f87171', fontSize: 14 }}>
                  {error}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
              {currentStep === 'welcome' ? (
                <button
                  onClick={handleSkip}
                  disabled={saving}
                  style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 14, cursor: 'pointer', padding: 8 }}
                >
                  Skip setup
                </button>
              ) : (
                <button
                  onClick={prevStep}
                  disabled={saving || isAnimating}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 14, cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
              )}

              <button
                onClick={isLastStep ? handleComplete : nextStep}
                disabled={saving || isAnimating}
                className="onboarding-btn"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin" style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : isLastStep ? (
                  'Get Started'
                ) : (
                  <>
                    Continue
                    <svg style={{ width: 16, height: 16 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
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
