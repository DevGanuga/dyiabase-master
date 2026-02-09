'use client'

import { Suspense, useEffect, useState, useCallback, useRef } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { AppJob, AppQuote, AppSettings, UserProfile } from '@/types/database'
import { Sidebar } from '@/components/app/Sidebar'
import { Dashboard } from '@/components/app/Dashboard'
import { Jobs } from '@/components/app/Jobs'
import { Quotes } from '@/components/app/Quotes'
import { QuoteBuilder } from '@/components/app/QuoteBuilder'
import { Settings } from '@/components/app/Settings'
import { FollowUps } from '@/components/app/FollowUps'
import { Reports } from '@/components/app/Reports'
import { Marketing } from '@/components/app/Marketing'
import { Customers } from '@/components/app/Customers'
import { MassEmail } from '@/components/app/MassEmail'
import { TrialBanner } from '@/components/app/TrialBanner'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import { DyiaOrb } from '@/components/app/DyiaOrb'
import { DyiaPanel } from '@/components/app/DyiaPanel'
import { DyiaNudge } from '@/components/app/DyiaNudge'
import type { LaunchpadItem } from '@/components/app/Launchpad'

type View = 'dashboard' | 'jobs' | 'quotes' | 'quoteBuilder' | 'followUps' | 'reports' | 'marketing' | 'customers' | 'massEmail' | 'assistant' | 'settings'

// Track selected job for quote building
interface QuoteBuilderState {
  selectedJob: AppJob | null
}

// Demo data for showcase
const DEMO_JOBS: AppJob[] = [
  { id: 'demo-1', date: new Date().toISOString().split('T')[0], customerName: 'Johnson Family', source: 'Google', revenue: 450, labor: 80, gas: 25, dumpFee: 65, dumpsterRental: 0, additionalExpense: 0, numWorkers: 2, costPerWorker: 40, notes: 'Full garage cleanout' },
  { id: 'demo-2', date: new Date(Date.now() - 86400000).toISOString().split('T')[0], customerName: 'Mike\'s Restaurant', source: 'Referral', revenue: 800, labor: 150, gas: 40, dumpFee: 120, dumpsterRental: 150, additionalExpense: 0, numWorkers: 3, costPerWorker: 50, notes: 'Commercial kitchen equipment removal' },
  { id: 'demo-3', date: new Date(Date.now() - 172800000).toISOString().split('T')[0], customerName: 'Sarah Miller', source: 'Yelp', revenue: 275, labor: 60, gas: 20, dumpFee: 45, dumpsterRental: 0, additionalExpense: 0, numWorkers: 2, costPerWorker: 30, notes: 'Basement cleanout' },
  { id: 'demo-4', date: new Date(Date.now() - 259200000).toISOString().split('T')[0], customerName: 'Downtown Office Co', source: 'Website', revenue: 1200, labor: 200, gas: 50, dumpFee: 180, dumpsterRental: 200, additionalExpense: 50, numWorkers: 4, costPerWorker: 50, notes: 'Office furniture disposal' },
  { id: 'demo-5', date: new Date(Date.now() - 345600000).toISOString().split('T')[0], customerName: 'The Martinez Home', source: 'Google', revenue: 350, labor: 70, gas: 22, dumpFee: 55, dumpsterRental: 0, additionalExpense: 0, numWorkers: 2, costPerWorker: 35, notes: 'Attic cleanout' },
]

const DEMO_SETTINGS: AppSettings = {
  taxPercentage: 30,
  monthlyGoal: 8000,
  businessInfo: { name: 'Demo Junk Co', phone: '(555) 123-4567', email: 'demo@dyia.co', address: '123 Demo Street', logo: null, reviewUrl: null, reviewUrlGoogle: null, reviewUrlYelp: null, reviewUrlFacebook: null },
  onboardingCompleted: true,
  onboardingSkipped: false,
  onboardingCompletedAt: null
}

const VALID_VIEWS: View[] = ['dashboard', 'jobs', 'quotes', 'quoteBuilder', 'followUps', 'reports', 'marketing', 'customers', 'massEmail', 'assistant', 'settings']

export default function AppPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AppPageContent />
    </Suspense>
  )
}

function AppPageContent() {
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDemoMode, setIsDemoMode] = useState(false)

  // View state: local state is the source of truth for rendering.
  // URL is kept in sync but never overrides an explicit user navigation.
  const viewParam = searchParams.get('view') as View | null
  const [currentView, setCurrentViewState] = useState<View>(
    viewParam && VALID_VIEWS.includes(viewParam) ? viewParam : 'dashboard'
  )

  // Track whether we are the ones pushing the URL so we don't fight ourselves
  const isNavigatingRef = useRef(false)
  
  // Sync URL → state ONLY for external navigations (browser back/forward, direct URL entry)
  // Skip if we just pushed the URL ourselves.
  useEffect(() => {
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false
      return
    }
    const urlView = viewParam && VALID_VIEWS.includes(viewParam) ? viewParam : 'dashboard'
    // If URL says assistant, open the panel and show dashboard instead
    if (urlView === 'assistant') {
      setDyiaPanelOpen(true)
      if (currentView !== 'dashboard') setCurrentViewState('dashboard')
      return
    }
    if (urlView !== currentView) {
      setCurrentViewState(urlView)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewParam])
  
  const setCurrentView = useCallback((view: View) => {
    // Intercept assistant view - open panel instead of navigating
    if (view === 'assistant') {
      setDyiaPanelOpen(true)
      return
    }
    // Set state immediately for instant UI response
    setCurrentViewState(view)
    // Then update URL (mark that we're doing this so the sync effect skips)
    isNavigatingRef.current = true
    const url = view === 'dashboard' ? '/app' : `/app?view=${view}`
    router.push(url, { scroll: false })
  }, [router])
  const [jobs, setJobs] = useState<AppJob[]>([])
  const [quotes, setQuotes] = useState<AppQuote[]>([])
  const [settings, setSettings] = useState<AppSettings>({
    taxPercentage: 30,
    monthlyGoal: 0,
    businessInfo: { name: '', phone: '', email: '', address: '', logo: null, reviewUrl: null, reviewUrlGoogle: null, reviewUrlYelp: null, reviewUrlFacebook: null },
    onboardingCompleted: false,
    onboardingSkipped: false,
    onboardingCompletedAt: null
  })
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [fixedMonthlyExpenses, setFixedMonthlyExpenses] = useState(0)
  const [pendingFollowUpsCount, setPendingFollowUpsCount] = useState(0)
  const [selectedJobForQuote, setSelectedJobForQuote] = useState<AppJob | null>(null)
  const [priceTemplatesCount, setPriceTemplatesCount] = useState(0)
  const [dyiaPanelOpen, setDyiaPanelOpen] = useState(false)
  const [dyiaInitialPrompt, setDyiaInitialPrompt] = useState<string | null>(null)
  const [impersonating, setImpersonating] = useState<string | null>(null)

  const supabase = createClient()

  // Check for impersonation cookie
  useEffect(() => {
    const cookies = document.cookie.split(';')
    const impCookie = cookies.find(c => c.trim().startsWith('dyia_impersonate_user_id='))
    if (impCookie) {
      setImpersonating(impCookie.split('=')[1]?.trim() || null)
    }
  }, [])

  // Check for demo mode cookie
  useEffect(() => {
    const checkDemoMode = () => {
      const cookies = document.cookie.split(';')
      const demoCookie = cookies.find(c => c.trim().startsWith('dyia_demo_access='))
      if (demoCookie) {
        setIsDemoMode(true)
        setJobs(DEMO_JOBS)
        setSettings(DEMO_SETTINGS)
        setQuotes([])
        setFixedMonthlyExpenses(0)
        setUserProfile({
          id: 'demo-user',
          clerk_user_id: 'demo',
          email: 'demo@dyia.co',
          subscription_status: 'active',
          ai_credits_balance: 0,
          ai_credits_used_lifetime: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        setLoading(false)
      }
    }
    checkDemoMode()
  }, [])

  const showSuccess = useCallback((message: string) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(null), 3000)
  }, [])

  const showError = useCallback((message: string) => {
    setErrorMessage(message)
    setTimeout(() => setErrorMessage(null), 4000)
  }, [])

  const openDyiaWithPrompt = useCallback((prompt: string) => {
    setDyiaInitialPrompt(prompt)
    setDyiaPanelOpen(true)
  }, [])

  const loadData = useCallback(async (userId: string) => {
    try {
      // Load jobs
      const { data: jobsData } = await supabase
        .from('dyia_jobs')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })

      if (jobsData) {
        setJobs(jobsData.map(j => ({
          id: j.id,
          date: j.date,
          customerName: j.customer_name,
          source: j.source || undefined,
          revenue: parseFloat(j.revenue) || 0,
          labor: parseFloat(j.labor) || 0,
          gas: parseFloat(j.gas) || 0,
          dumpFee: parseFloat(j.dump_fee) || 0,
          dumpsterRental: parseFloat(j.dumpster_rental) || 0,
          additionalExpense: parseFloat(j.additional_expense) || 0,
          numWorkers: j.num_workers || 1,
          costPerWorker: parseFloat(j.cost_per_worker) || 0,
          notes: j.notes || undefined,
          status: j.status || 'completed',
          address: j.address || undefined
        })))
      }

      // Load quotes
      const { data: quotesData } = await supabase
        .from('dyia_quotes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (quotesData) {
        setQuotes(quotesData.map(q => ({
          id: q.id,
          jobId: q.job_id || undefined,
          createdAt: new Date(q.created_at).getTime(),
          customer: {
            name: q.customer_name,
            phone: q.customer_phone || undefined,
            email: q.customer_email || undefined,
            address: q.customer_address || undefined,
            jobDescription: q.job_description || undefined
          },
          pricing: q.pricing || {},
          photos: q.photo_urls || [],
          estimateRange: { low: parseFloat(q.estimate_low) || 0, high: parseFloat(q.estimate_high) || 0 },
          total: parseFloat(q.total) || 0,
          status: q.status || 'draft',
          sentAt: q.sent_at ? new Date(q.sent_at).getTime() : undefined
        })))
      }

      // Load settings
      const { data: settingsData } = await supabase
        .from('dyia_settings')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (settingsData) {
        setSettings({
          taxPercentage: settingsData.tax_percentage || 30,
          monthlyGoal: parseFloat(settingsData.monthly_goal) || 0,
          businessInfo: {
            name: settingsData.business_name || '',
            phone: settingsData.business_phone || '',
            email: settingsData.business_email || '',
            address: settingsData.business_address || '',
            logo: settingsData.business_logo || null,
            reviewUrl: settingsData.review_url ?? null,
            ...(Object.prototype.hasOwnProperty.call(settingsData, 'review_url_google') && { reviewUrlGoogle: settingsData.review_url_google ?? null }),
            ...(Object.prototype.hasOwnProperty.call(settingsData, 'review_url_yelp') && { reviewUrlYelp: settingsData.review_url_yelp ?? null }),
            ...(Object.prototype.hasOwnProperty.call(settingsData, 'review_url_facebook') && { reviewUrlFacebook: settingsData.review_url_facebook ?? null })
          },
          onboardingCompleted: settingsData.onboarding_completed || false,
          onboardingSkipped: settingsData.onboarding_skipped || false,
          onboardingCompletedAt: settingsData.onboarding_completed_at || null
        })
      }

      try {
        const { data: fixedData, error: fixedError } = await supabase
          .from('dyia_fixed_expenses')
          .select('amount, frequency, is_active')
          .eq('user_id', userId)

        if (fixedError) throw fixedError

        const monthlyTotal = (fixedData || []).reduce((sum, expense) => {
          if (expense.is_active === false) return sum
          const amount = parseFloat(expense.amount) || 0
          return sum + (expense.frequency === 'yearly' ? amount / 12 : amount)
        }, 0)

        setFixedMonthlyExpenses(monthlyTotal)
      } catch (error) {
        console.error('Error loading fixed expenses:', error)
        setFixedMonthlyExpenses(0)
      }

      // Load pending follow-ups count
      try {
        const { count, error: followUpError } = await supabase
          .from('dyia_follow_ups')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .in('status', ['pending', 'contacted', 'snoozed'])

        if (followUpError) throw followUpError
        setPendingFollowUpsCount(count || 0)
      } catch (error) {
        console.error('Error loading follow-ups count:', error)
        setPendingFollowUpsCount(0)
      }

      // Load price templates count for launchpad
      try {
        const { count, error: templatesError } = await supabase
          .from('dyia_price_templates')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)

        if (templatesError) throw templatesError
        setPriceTemplatesCount(count || 0)
      } catch (error) {
        console.error('Error loading templates count:', error)
        setPriceTemplatesCount(0)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }, [supabase])

  // Initialize user profile when Clerk user is loaded
  useEffect(() => {
    const initUserProfile = async () => {
      // Skip if in demo mode
      if (isDemoMode) return
      
      if (!isLoaded) {
        // Clerk still loading - keep loading=true, effect will re-fire when isLoaded changes
        return
      }
      if (!user) {
        // Clerk loaded but no user (shouldn't reach here due to layout guard)
        setLoading(false)
        return
      }

      try {
        // Check if user profile exists
        let { data: profile } = await supabase
          .from('dyia_users')
          .select('*')
          .eq('clerk_user_id', user.id)
          .single()

        // If no profile, create one via API (uses service role key)
        if (!profile) {
          const response = await fetch('/api/user/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              email: user.primaryEmailAddress?.emailAddress || '' 
            }),
          })

          if (response.ok) {
            const data = await response.json()
            profile = data.profile
          } else {
            const error = await response.json()
            console.error('Error creating user profile:', error)
          }
        }

        if (profile) {
          setUserProfile(profile)
          await loadData(profile.id)
        }
      } catch (error) {
        console.error('Error initializing user:', error)
      } finally {
        setLoading(false)
      }
    }

    initUserProfile()
  }, [isLoaded, user, supabase, loadData, isDemoMode])

  const handleLogout = async () => {
    if (isDemoMode) {
      // Clear demo cookie and redirect
      document.cookie = 'dyia_demo_access=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      window.location.href = '/'
      return
    }
    await signOut()
  }

  // Only redirect to onboarding if user hasn't completed it AND has no data yet
  // Users who've already been using the app (have jobs/quotes) don't need onboarding
  const hasExistingData = jobs.length > 0 || quotes.length > 0
  const needsOnboarding = !loading && !isDemoMode && !!userProfile && !settings.onboardingCompleted && !settings.onboardingSkipped && !hasExistingData

  // Redirect to onboarding for new users (after loading completes)
  useEffect(() => {
    if (needsOnboarding) {
      // Preserve the intended view through the onboarding redirect
      const returnUrl = viewParam && viewParam !== 'dashboard' 
        ? `/app?view=${viewParam}` 
        : '/app'
      router.push(`/app/onboarding?returnUrl=${encodeURIComponent(returnUrl)}`)
    }
  }, [needsOnboarding, router, viewParam])

  const handleReopenOnboarding = () => {
    router.push('/app/onboarding')
  }

  const loadingOrRedirecting = (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(255,247,237,0.4), #fafafa 50%, rgba(255,251,235,0.3))' }}>
      <div className="text-center">
        <div className="flex items-center gap-2 justify-center mb-6">
          <img
            src="/dyia-agent.png"
            alt="dyia"
            className="w-10 h-10 object-contain"
          />
          <span className="text-xl font-bold bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">dyia</span>
        </div>
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-slate-500 font-medium">
          {needsOnboarding ? 'Setting up your account...' : 'Loading...'}
        </p>
      </div>
    </div>
  )

  // Loading State
  if ((!isLoaded && !isDemoMode) || loading) {
    return loadingOrRedirecting
  }

  // Don't flash dashboard: show loading-style screen until redirect to onboarding
  if (needsOnboarding) {
    return loadingOrRedirecting
  }

  // This shouldn't happen due to middleware, but just in case
  if (!user && !isDemoMode) {
    return null
  }

  // Build launchpad items for both Sidebar and Dashboard
  const launchpadItems: LaunchpadItem[] = [
    {
      id: 'onboarding',
      label: 'Complete setup',
      description: 'Set up your business profile',
      completed: settings.onboardingCompleted,
      action: settings.onboardingCompleted ? undefined : handleReopenOnboarding,
    },
    {
      id: 'business-info',
      label: 'Add business info',
      description: 'Name, phone & email for quotes',
      completed: !!(settings.businessInfo.name && settings.businessInfo.phone),
      action: (settings.businessInfo.name && settings.businessInfo.phone) ? undefined : () => setCurrentView('settings'),
    },
    {
      id: 'first-job',
      label: 'Log your first job',
      description: 'Track revenue and expenses',
      completed: jobs.length > 0,
      action: jobs.length > 0 ? undefined : () => setCurrentView('jobs'),
    },
    {
      id: 'first-customer',
      label: 'Add a customer',
      description: 'Build your customer database',
      completed: jobs.length > 0, // will be true once they have at least 1 job (auto-synced)
      action: jobs.length > 0 ? undefined : () => setCurrentView('customers'),
    },
    {
      id: 'first-quote',
      label: 'Create a quote',
      description: 'Send professional estimates',
      completed: quotes.length > 0,
      action: quotes.length > 0 ? undefined : () => setCurrentView('quoteBuilder'),
    },
    {
      id: 'first-template',
      label: 'Save a price template',
      description: 'Speed up future quotes',
      completed: priceTemplatesCount > 0,
      action: priceTemplatesCount > 0 ? undefined : () => setCurrentView('settings'),
    },
  ]
  const showLaunchpadOnDashboard = !isDemoMode && launchpadItems.some(item => !item.completed)

  // Computed once — used everywhere
  const isPro = ['active', 'trialing'].includes(userProfile?.subscription_status || '')

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            jobs={jobs}
            quotes={quotes}
            settings={settings}
            userName={isDemoMode ? 'Demo User' : (userProfile?.first_name || user?.firstName || user?.primaryEmailAddress?.emailAddress || '')}
            onNavigate={(view) => setCurrentView(view as View)}
            pendingFollowUps={pendingFollowUpsCount}
            fixedMonthlyExpenses={fixedMonthlyExpenses}
            isPro={isPro}
            taxPercentage={settings.taxPercentage}
            launchpadItems={launchpadItems}
            showLaunchpad={showLaunchpadOnDashboard}
            onOpenDyia={() => setDyiaPanelOpen(true)}
            onOpenDyiaWithPrompt={openDyiaWithPrompt}
          />
        )
      case 'jobs':
        return (
          <Jobs
            jobs={jobs}
            setJobs={setJobs}
            userId={userProfile?.id || ''}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            settings={settings}
            showSuccess={showSuccess}
            onOpenDyiaWithPrompt={openDyiaWithPrompt}
            isPro={isPro}
          />
        )
      case 'quotes':
        return (
          <Quotes
            quotes={quotes}
            setQuotes={setQuotes}
            jobs={jobs}
            userId={userProfile?.id || ''}
            settings={settings}
            onCreateQuote={(job?: AppJob) => {
              setSelectedJobForQuote(job || null)
              setCurrentView('quoteBuilder')
            }}
            showSuccess={showSuccess}
            onOpenDyiaWithPrompt={openDyiaWithPrompt}
            isPro={isPro}
          />
        )
      case 'quoteBuilder':
        return (
          <QuoteBuilder
            quotes={quotes}
            setQuotes={setQuotes}
            userId={userProfile?.id || ''}
            selectedJob={selectedJobForQuote}
            customerNames={[...new Set(jobs.map(j => j.customerName).filter(Boolean))]}
            onBack={() => {
              setSelectedJobForQuote(null)
              setCurrentView('quotes')
            }}
            showSuccess={showSuccess}
            onOpenDyiaWithPrompt={openDyiaWithPrompt}
            isPro={isPro}
          />
        )
      case 'settings':
        return (
          <Settings
            settings={settings}
            setSettings={setSettings}
            userId={userProfile?.id || ''}
            showSuccess={showSuccess}
            userProfile={userProfile}
            userEmail={isDemoMode ? 'demo@dyia.co' : (user?.primaryEmailAddress?.emailAddress || '')}
            userImageUrl={isDemoMode ? undefined : user?.imageUrl}
            userName={isDemoMode ? 'Demo User' : (userProfile?.first_name || user?.firstName || '')}
            isDemoMode={isDemoMode}
          />
        )
      case 'followUps':
        return (
          <FollowUps
            userId={userProfile?.id || ''}
            businessName={settings.businessInfo.name || 'dyia'}
            showSuccess={showSuccess}
            onOpenDyiaWithPrompt={openDyiaWithPrompt}
            isPro={isPro}
          />
        )
      case 'reports':
        return (
          <Reports
            jobs={jobs}
            quotes={quotes}
            fixedMonthlyExpenses={fixedMonthlyExpenses}
            isPro={isPro}
            taxPercentage={settings.taxPercentage}
          />
        )
      case 'marketing':
        return <Marketing showSuccess={showSuccess} isPro={isPro} />
      case 'customers':
        return (
          <Customers
            jobs={jobs}
            quotes={quotes}
            isPro={isPro}
            onNavigate={(view) => setCurrentView(view as View)}
            onCreateQuote={(job) => { setSelectedJobForQuote(job ?? null); setCurrentView('quoteBuilder') }}
            showSuccess={showSuccess}
            isDemoMode={isDemoMode}
            onOpenDyiaWithPrompt={openDyiaWithPrompt}
          />
        )
      case 'massEmail':
        return (
          <MassEmail
            jobs={jobs}
            quotes={quotes}
            isPro={isPro}
            showSuccess={showSuccess}
            showError={showError}
          />
        )
      case 'assistant':
        // This shouldn't render — setCurrentView('assistant') opens the panel instead.
        // But if somehow we reach here, just show the dashboard.
        return (
          <Dashboard
            jobs={jobs}
            quotes={quotes}
            settings={settings}
            userName={isDemoMode ? 'Demo User' : (userProfile?.first_name || user?.firstName || user?.primaryEmailAddress?.emailAddress || '')}
            onNavigate={(view) => setCurrentView(view as View)}
            pendingFollowUps={pendingFollowUpsCount}
            fixedMonthlyExpenses={fixedMonthlyExpenses}
            isPro={isPro}
            taxPercentage={settings.taxPercentage}
            launchpadItems={launchpadItems}
            showLaunchpad={showLaunchpadOnDashboard}
            onOpenDyia={() => setDyiaPanelOpen(true)}
            onOpenDyiaWithPrompt={openDyiaWithPrompt}
          />
        )
    }
  }

  return (
    <ConfirmProvider>
    <div className="app-layout">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-slate-900 text-white text-center py-2 px-4 text-xs sm:text-sm font-medium shadow-lg border-b border-orange-500/30">
          <span className="text-orange-400">Demo Mode</span> — Sample data only, nothing is saved.{' '}
          <button 
            onClick={handleLogout}
            className="text-orange-400 hover:text-orange-300 underline underline-offset-2 ml-1"
          >
            Exit
          </button>
        </div>
      )}

      {/* Admin Impersonation Banner */}
      {impersonating && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-black text-center py-2 px-4 text-xs sm:text-sm font-medium shadow-lg">
          Viewing as user {userProfile?.email || impersonating} —{' '}
          <button 
            onClick={async () => {
              await fetch('/api/admin/impersonate', { method: 'DELETE' })
              setImpersonating(null)
              window.location.href = '/app/admin/users'
            }}
            className="font-bold underline underline-offset-2 ml-1 hover:opacity-70"
          >
            Exit Impersonation
          </button>
        </div>
      )}
      
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        userEmail={isDemoMode ? 'demo@dyia.co' : (user?.primaryEmailAddress?.emailAddress || '')}
        userName={isDemoMode ? 'Demo User' : (userProfile?.first_name || user?.firstName || '')}
        userImageUrl={isDemoMode ? undefined : user?.imageUrl}
        onLogout={handleLogout}
        isPro={['active', 'trialing'].includes(userProfile?.subscription_status || '')}
        subscriptionTier={
          userProfile?.subscription_status === 'trialing' ? 'trial'
            : ['active', 'trialing'].includes(userProfile?.subscription_status || '') ? 'pro'
              : 'basic'
        }
        trialDaysRemaining={
          userProfile?.subscription_ends_at
            ? Math.max(0, Math.ceil((new Date(userProfile.subscription_ends_at).getTime() - Date.now()) / 86400000))
            : 0
        }
        launchpadItems={showLaunchpadOnDashboard ? launchpadItems : undefined}
        isDemoMode={isDemoMode}
      />
      
      <main className={`flex-1 flex flex-col overflow-hidden ${isDemoMode ? 'pt-16' : ''}`} style={{ animation: 'contentReveal 0.6s cubic-bezier(0.16, 1, 0.3, 1) both' }}>
        {!isDemoMode && <TrialBanner />}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </main>

      {/* Dyia Floating Orb - visible on all pages */}
      <DyiaOrb
        isOpen={dyiaPanelOpen}
        onToggle={() => setDyiaPanelOpen(!dyiaPanelOpen)}
        notificationCount={pendingFollowUpsCount > 0 ? pendingFollowUpsCount : 0}
        isPro={isPro}
      />

      {/* Dyia Nudge System - contextual suggestions */}
      {!dyiaPanelOpen && (
        <DyiaNudge
          currentView={currentView}
          pendingFollowUps={pendingFollowUpsCount}
          isNewUser={!settings.onboardingCompleted && !isDemoMode}
          onNavigate={(view) => setCurrentView(view as View)}
          onOpenDyia={() => setDyiaPanelOpen(true)}
          jobCount={jobs.length}
          hasBusinessInfo={!!(settings.businessInfo.name && settings.businessInfo.phone)}
        />
      )}

      {/* Dyia Side Panel */}
      <DyiaPanel
        isOpen={dyiaPanelOpen}
        onClose={() => setDyiaPanelOpen(false)}
        userId={userProfile?.id || ''}
        showSuccess={showSuccess}
        currentView={currentView}
        initialPrompt={dyiaInitialPrompt}
        onPromptConsumed={() => setDyiaInitialPrompt(null)}
        isPro={isPro}
      />

      {/* Success Toast */}
      {successMessage && (
        <div className="toast toast-success" role="status">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm">{successMessage}</span>
        </div>
      )}

      {/* Error Toast */}
      {errorMessage && (
        <div className="toast toast-error" role="alert">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm">{errorMessage}</span>
        </div>
      )}
    </div>
    </ConfirmProvider>
  )
}
