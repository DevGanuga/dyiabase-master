'use client'

import { Suspense, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useUser, useClerk, useAuth } from '@clerk/nextjs'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient, initSupabaseAuth } from '@/lib/supabase/client'
import { extractAdditionalExpenseLabel, getRelativeLocalDateInput } from '@/lib/utils'
import type { AppJob, AppQuote, AppSettings, UserProfile, PaymentRequestStatus } from '@/types/database'
import { computeSubscriptionState } from '@/lib/subscription'
import { Sidebar } from '@/components/app/Sidebar'
import { Dashboard } from '@/components/app/Dashboard'
import { Jobs } from '@/components/app/Jobs'
import { Quotes } from '@/components/app/Quotes'
import { QuoteBuilder } from '@/components/app/QuoteBuilder'
import { Settings } from '@/components/app/Settings'
import { TrialBanner } from '@/components/app/TrialBanner'
import { TopBar } from '@/components/app/TopBar'
import { ConfirmProvider } from '@/components/providers/ConfirmProvider'
import type { LaunchpadItem } from '@/components/app/Launchpad'

const FollowUps = dynamic(() => import('@/components/app/FollowUps').then(m => ({ default: m.FollowUps })), { ssr: false })
const Reports = dynamic(() => import('@/components/app/Reports').then(m => ({ default: m.Reports })), { ssr: false })
const Marketing = dynamic(() => import('@/components/app/Marketing').then(m => ({ default: m.Marketing })), { ssr: false })
const Customers = dynamic(() => import('@/components/app/Customers').then(m => ({ default: m.Customers })), { ssr: false })
const MassEmail = dynamic(() => import('@/components/app/MassEmail').then(m => ({ default: m.MassEmail })), { ssr: false })
const Assistant = dynamic(() => import('@/components/app/Assistant').then(m => ({ default: m.Assistant })), { ssr: false })
const Calendar = dynamic(() => import('@/components/app/Calendar').then(m => ({ default: m.Calendar })), { ssr: false })
const Payments = dynamic(() => import('@/components/app/Payments').then(m => ({ default: m.Payments })), { ssr: false })
const AdminPanel = dynamic(() => import('@/components/app/AdminPanel').then(m => ({ default: m.AdminPanel })), { ssr: false })
const ProfitCalculator = dynamic(() => import('@/components/app/ProfitCalculator').then(m => ({ default: m.ProfitCalculator })), { ssr: false })
const Intel = dynamic(() => import('@/components/app/Intel').then(m => ({ default: m.Intel })), { ssr: false })
const Maps = dynamic(() => import('@/components/app/Maps').then(m => ({ default: m.Maps })), { ssr: false })

type View = 'dashboard' | 'jobs' | 'quotes' | 'quoteBuilder' | 'followUps' | 'calendar' | 'reports' | 'marketing' | 'customers' | 'massEmail' | 'assistant' | 'settings' | 'payments' | 'admin' | 'profitCalculator' | 'intel' | 'maps'

// Demo data for showcase
// Demo pins are spread around Austin, TX so the Maps view has something to show
// without making any Google API calls (coordinates are hard-coded).
const DEMO_JOBS: AppJob[] = [
  { id: 'demo-1', date: getRelativeLocalDateInput(0), customerName: 'Johnson Family', source: 'Google', revenue: 450, labor: 80, gas: 25, dumpFee: 65, dumpsterRental: 0, additionalExpense: 0, numWorkers: 2, costPerWorker: 40, notes: 'Full garage cleanout', status: 'scheduled', scheduledKind: 'job', appointmentWindow: '8:00-10:00am', address: '1200 Maple Dr, Austin, TX 78704', latitude: 30.2466, longitude: -97.7592, customerPhone: '(555) 678-9012' },
  { id: 'demo-6', date: getRelativeLocalDateInput(0), customerName: 'Lisa Chen', source: 'Yelp', revenue: 0, estimateLow: 350, estimateHigh: 450, labor: 0, gas: 0, dumpFee: 0, dumpsterRental: 0, additionalExpense: 0, numWorkers: 1, costPerWorker: 0, notes: 'Storm debris — needs estimate', status: 'scheduled', scheduledKind: 'estimate', appointmentWindow: '11:00am-12:00pm', address: '892 Oak Ave, Austin, TX 78745', latitude: 30.2200, longitude: -97.7700, customerPhone: '(555) 234-5678' },
  { id: 'demo-7', date: getRelativeLocalDateInput(0), customerName: 'Kevin Park', source: 'Website', revenue: 700, labor: 120, gas: 30, dumpFee: 90, dumpsterRental: 0, additionalExpense: 0, numWorkers: 2, costPerWorker: 60, notes: 'Construction debris from bathroom remodel', status: 'scheduled', scheduledKind: 'job', appointmentWindow: '2:00-4:00pm', address: '88 Birch Ln, Austin, TX 78702', latitude: 30.2640, longitude: -97.7180, customerPhone: '(555) 567-8901' },
  { id: 'demo-2', date: getRelativeLocalDateInput(-1), customerName: 'Mike\'s Restaurant', source: 'Referral', revenue: 800, labor: 150, gas: 40, dumpFee: 120, dumpsterRental: 150, additionalExpense: 0, numWorkers: 3, costPerWorker: 50, notes: 'Commercial kitchen equipment removal', status: 'completed', address: '450 Congress Ave, Austin, TX 78701', latitude: 30.2670, longitude: -97.7430 },
  { id: 'demo-3', date: getRelativeLocalDateInput(-2), customerName: 'Sarah Miller', source: 'Yelp', revenue: 275, labor: 60, gas: 20, dumpFee: 45, dumpsterRental: 0, additionalExpense: 0, numWorkers: 2, costPerWorker: 30, notes: 'Basement cleanout', status: 'completed', address: '2100 Barton Springs Rd, Austin, TX 78704', latitude: 30.2630, longitude: -97.7700 },
  { id: 'demo-4', date: getRelativeLocalDateInput(-3), customerName: 'Downtown Office Co', source: 'Website', revenue: 1200, labor: 200, gas: 50, dumpFee: 180, dumpsterRental: 200, additionalExpense: 50, additionalExpenseLabel: 'Supplies', numWorkers: 4, costPerWorker: 50, notes: 'Office furniture disposal', status: 'completed', address: '600 Guadalupe St, Austin, TX 78701', latitude: 30.2715, longitude: -97.7470 },
  { id: 'demo-5', date: getRelativeLocalDateInput(-4), customerName: 'The Martinez Home', source: 'Google', revenue: 350, labor: 70, gas: 22, dumpFee: 55, dumpsterRental: 0, additionalExpense: 0, numWorkers: 2, costPerWorker: 35, notes: 'Attic cleanout', status: 'completed', address: '3400 N Lamar Blvd, Austin, TX 78705', latitude: 30.3010, longitude: -97.7390 },
]

const DEMO_QUOTES: AppQuote[] = [
  { id: 'demo-q1', customerId: 'demo-c1', createdAt: Date.now() - 86400000 * 1, customer: { name: 'Lisa Chen', phone: '(555) 234-5678', email: 'lisa.chen@email.com', address: '892 Oak Ave', jobDescription: 'Full yard debris removal after storm' }, pricing: {}, photos: [], estimateRange: { low: 350, high: 450 }, total: 400, status: 'sent' },
  { id: 'demo-q2', customerId: 'demo-c2', createdAt: Date.now() - 86400000 * 4, customer: { name: 'Robert Hayes', phone: '(555) 345-6789', email: 'rob.hayes@email.com', address: '1420 Elm St', jobDescription: 'Hot tub removal and disposal' }, pricing: {}, photos: [], estimateRange: { low: 500, high: 700 }, total: 600, status: 'sent' },
  { id: 'demo-q3', customerId: 'demo-c3', createdAt: Date.now() - 86400000 * 9, customer: { name: 'Amanda Torres', phone: '(555) 456-7890', address: '305 Pine Rd', jobDescription: 'Garage cleanout — 2 car garage, mostly furniture' }, pricing: {}, photos: [], estimateRange: { low: 275, high: 375 }, total: 325, status: 'sent' },
  { id: 'demo-q4', customerId: 'demo-c4', createdAt: Date.now() - 86400000 * 2, customer: { name: 'Kevin Park', phone: '(555) 567-8901', email: 'kpark@email.com', address: '88 Birch Ln', jobDescription: 'Construction debris from bathroom remodel' }, pricing: {}, photos: [], estimateRange: { low: 600, high: 800 }, total: 700, status: 'draft' },
  { id: 'demo-q5', customerId: 'demo-c5', jobId: 'demo-1', createdAt: Date.now() - 86400000 * 6, customer: { name: 'Johnson Family', phone: '(555) 678-9012', address: '1200 Maple Dr', jobDescription: 'Full garage cleanout' }, pricing: {}, photos: [], estimateRange: { low: 400, high: 500 }, total: 450, status: 'accepted' },
]

const DEMO_SETTINGS: AppSettings = {
  taxPercentage: 30,
  monthlyGoal: 8000,
  businessInfo: { name: 'Demo Junk Co', phone: '(555) 123-4567', email: 'demo@dyia.co', address: '123 Demo Street', logo: null, reviewUrl: null, reviewUrlGoogle: null, reviewUrlYelp: null, reviewUrlFacebook: null },
  onboardingCompleted: true,
  onboardingSkipped: false,
  onboardingCompletedAt: null
}

const VALID_VIEWS: View[] = ['dashboard', 'jobs', 'quotes', 'quoteBuilder', 'followUps', 'calendar', 'reports', 'marketing', 'customers', 'massEmail', 'assistant', 'settings', 'payments', 'admin', 'profitCalculator', 'intel', 'maps']

type SettingsTab = 'business' | 'financial' | 'expenses' | 'templates' | 'account'
const VALID_SETTINGS_TABS: SettingsTab[] = ['business', 'financial', 'expenses', 'templates', 'account']

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
  const { getToken } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isDemoMode, setIsDemoMode] = useState(false)

  // Initialize Supabase client with Clerk JWT for RLS-authenticated queries.
  // Must be called synchronously (not in useEffect) so the token getter is set
  // before any Supabase queries run in subsequent effects.
  initSupabaseAuth(() => getToken({ template: 'supabase' }))

  // URL params for checkout flow and view routing.
  // Default to dashboard (Home) whenever view is missing or invalid so /app always opens to Home.
  const viewParamRaw = searchParams.get('view')
  const viewParam = (viewParamRaw && VALID_VIEWS.includes(viewParamRaw as View)) ? (viewParamRaw as View) : null
  const planParam = searchParams.get('plan') as 'monthly' | 'annual' | null
  const sessionIdParam = searchParams.get('session_id')
  // Deep link into a specific Settings tab (e.g. upgrade CTAs across the app use
  // /app?view=settings&tab=account#subscription). Previously `tab` was ignored,
  // so those CTAs landed on the default Business tab and the #subscription
  // scroll never ran.
  const tabParamRaw = searchParams.get('tab')
  const tabParam = (tabParamRaw && VALID_SETTINGS_TABS.includes(tabParamRaw as SettingsTab)) ? (tabParamRaw as SettingsTab) : null
  const [currentView, setCurrentViewState] = useState<View>(viewParam ?? 'dashboard')

  // Keep currentView in sync when URL changes (e.g., browser back/forward).
  // Any missing or invalid view param resets to dashboard so /app and /app?view= always show Home when view is not a valid panel.
  useEffect(() => {
    if (viewParam) {
      setCurrentViewState(viewParam)
    } else {
      setCurrentViewState('dashboard')
      // Normalize URL when we're showing dashboard but URL has a stray or empty view param
      if (typeof window !== 'undefined' && window.location.pathname === '/app') {
        const params = new URLSearchParams(window.location.search)
        const hasView = params.has('view')
        if (hasView) {
          params.delete('view')
          const next = params.toString() ? `/app?${params.toString()}` : '/app'
          router.replace(next, { scroll: false })
        }
      }
    }
  }, [viewParam, router])
  
  const setCurrentView = useCallback((view: View) => {
    if (view !== 'settings') setSettingsInitialTab(null)
    setCurrentViewState(view)
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
  const [closeDayDateFromDashboard, setCloseDayDateFromDashboard] = useState<string | null>(null)
  const [jobDraftDate, setJobDraftDate] = useState<string | null>(null)
  const [jobDraftStatus, setJobDraftStatus] = useState<AppJob['status'] | null>(null)
  // Cross-link target: when navigating to Maps from Calendar/Jobs, pre-select this pin.
  const [mapFocusJobId, setMapFocusJobId] = useState<string | null>(null)
  // When opening a job from a Maps pin, scroll/expand it in the Jobs view.
  const [jobFocusId, setJobFocusId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Set when the primary data load (jobs/quotes/settings) fails so we can show
  // a retry banner instead of silently leaving the app empty.
  const [loadError, setLoadError] = useState(false)
  const [fixedMonthlyExpenses, setFixedMonthlyExpenses] = useState(0)
  const [pendingFollowUpsCount, setPendingFollowUpsCount] = useState(0)
  const [selectedJobForQuote, setSelectedJobForQuote] = useState<AppJob | null>(null)
  const [editingQuote, setEditingQuote] = useState<AppQuote | null>(null)
  const [assistantInitialPrompt, setAssistantInitialPrompt] = useState<string | null>(null)
  const [priceTemplatesCount, setPriceTemplatesCount] = useState(0)
  const [hasViewedAssistant, setHasViewedAssistant] = useState(false)
  const [hasNewIntel, setHasNewIntel] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab | null>(null)
  const [verifyingCheckout, setVerifyingCheckout] = useState(false)
  const checkoutTriggeredRef = useRef(false)
  const verifyAttemptedRef = useRef(false)
  const contentScrollRef = useRef<HTMLDivElement>(null)
  const initAttemptedRef = useRef(false)

  // Memoize the Supabase client so it's created once — NOT on every render.
  // The client's custom fetch reads the module-level token getter at request time,
  // so it always picks up the latest Clerk JWT without needing recreation.
  const supabase = useMemo(() => createClient(), [])

  // Track when user opens Assistant so we can keep it mounted (preserves conversation when switching views)
  useEffect(() => {
    if (currentView === 'assistant') setHasViewedAssistant(true)
  }, [currentView])

  // Clear Intel badge when viewing the Intel tab
  useEffect(() => {
    if (currentView === 'intel' && hasNewIntel) {
      setHasNewIntel(false)
    }
  }, [currentView, hasNewIntel])

  // Scroll content area to top when switching views (smoother navigation)
  useEffect(() => {
    if (currentView !== 'assistant' && contentScrollRef.current) {
      contentScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [currentView])
  
  // Check for demo mode cookie
  useEffect(() => {
    const checkDemoMode = () => {
      const cookies = document.cookie.split(';')
      const demoCookie = cookies.find(c => c.trim().startsWith('dyia_demo_active='))
      if (demoCookie) {
        setIsDemoMode(true)
        setJobs(DEMO_JOBS)
        setSettings(DEMO_SETTINGS)
        setQuotes(DEMO_QUOTES)
        setFixedMonthlyExpenses(0)
        setUserProfile({
          id: 'demo-user',
          clerk_user_id: 'demo',
          email: 'demo@dyia.co',
          stripe_connect_onboarding_complete: false,
          stripe_connect_details_submitted: false,
          stripe_connect_charges_enabled: false,
          stripe_connect_payouts_enabled: false,
          subscription_status: 'active',
          subscription_tier: 'pro',
          subscription_plan: 'monthly',
          ai_credits_balance: 0,
          ai_credits_used_lifetime: 0,
          is_admin: false,
          role: 'user',
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

  const loadData = useCallback(async (userId: string) => {
    setLoadError(false)
    try {
      // Load jobs
      const { data: jobsData } = await supabase
        .from('dyia_jobs')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })

      if (jobsData) {
        setJobs(jobsData.map(j => {
          const { additionalExpenseLabel, cleanNotes } = extractAdditionalExpenseLabel(j.notes || undefined)

          return {
            id: j.id,
            date: j.date,
            customerName: j.customer_name,
            customerId: j.customer_id || null,
            source: j.source || undefined,
            revenue: parseFloat(j.revenue) || 0,
          estimateLow: j.estimate_low ? parseFloat(j.estimate_low) || 0 : undefined,
          estimateHigh: j.estimate_high ? parseFloat(j.estimate_high) || 0 : undefined,
          appointmentWindow: (j as { appointment_window_text?: string | null }).appointment_window_text || undefined,
          scheduledKind: (j as { scheduled_kind?: AppJob['scheduledKind'] | null }).scheduled_kind || undefined,
            labor: parseFloat(j.labor) || 0,
            gas: parseFloat(j.gas) || 0,
            dumpFee: parseFloat(j.dump_fee) || 0,
            dumpsterRental: parseFloat(j.dumpster_rental) || 0,
            additionalExpense: parseFloat(j.additional_expense) || 0,
            additionalExpenseLabel,
            numWorkers: j.num_workers || 1,
            costPerWorker: parseFloat(j.cost_per_worker) || 0,
            notes: cleanNotes,
            address: (j as { address?: string }).address || undefined,
            latitude: (j as { latitude?: number | null }).latitude ?? null,
            longitude: (j as { longitude?: number | null }).longitude ?? null,
            status: (j as { status?: string }).status as AppJob['status'] | undefined,
            receiptUrl: (j as { receipt_url?: string | null }).receipt_url ?? undefined,
            // Payment fields must be hydrated from the DB so paid/pending badges
            // and "Copy Pay Link" survive a reload or an async customer payment;
            // previously only optimistic in-memory updates set these.
            paymentStatus: (j as { payment_status?: PaymentRequestStatus }).payment_status ?? undefined,
            paymentAmountCents: (j as { payment_amount_cents?: number | null }).payment_amount_cents ?? null,
            paymentRequestedAt: (j as { payment_requested_at?: string | null }).payment_requested_at ?? null,
            paymentPaidAt: (j as { payment_paid_at?: string | null }).payment_paid_at ?? null,
            paymentLastRequestId: (j as { payment_last_request_id?: string | null }).payment_last_request_id ?? null,
          }
        }))
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
          customerId: q.customer_id || null,
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
          sentAt: q.sent_at ? new Date(q.sent_at).getTime() : undefined,
          paymentStatus: (q as { payment_status?: PaymentRequestStatus }).payment_status ?? undefined,
          paymentAmountCents: (q as { payment_amount_cents?: number | null }).payment_amount_cents ?? null,
          paymentRequestedAt: (q as { payment_requested_at?: string | null }).payment_requested_at ?? null,
          paymentPaidAt: (q as { payment_paid_at?: string | null }).payment_paid_at ?? null,
          paymentLastRequestId: (q as { payment_last_request_id?: string | null }).payment_last_request_id ?? null,
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

      // Check for new Intel report (unviewed monthly status)
      try {
        const now = new Date()
        const monthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const { data: intelStatus } = await supabase
          .from('dyia_intel_monthly_status')
          .select('viewed_at, job_status')
          .eq('user_id', userId)
          .eq('month_year', monthYear)
          .single()
        setHasNewIntel(intelStatus?.job_status === 'complete' && !intelStatus?.viewed_at)
      } catch {
        // Intel not set up yet — not an error
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setLoadError(true)
    }
  }, [supabase])

  // BUG-011 / BUG-031 (round 4): umbrella refresh so the AI Assistant's
  // confirm path and the Stripe-payment-success focus path can both bring
  // grids up to date without a manual page reload. Skips when the user isn't
  // loaded yet or we're in demo mode (DEMO_JOBS / DEMO_QUOTES are static).
  const refreshAllData = useCallback(async () => {
    const uid = userProfile?.id
    if (!uid || isDemoMode) return
    try {
      await loadData(uid)
    } catch (err) {
      console.error('Error refreshing data:', err)
    }
  }, [userProfile?.id, isDemoMode, loadData])

  // BUG-031 (round 5): when the merchant returns to the Dyia tab after the
  // customer completed a Stripe payment in another window/device, the
  // existing grid state was stale until they manually navigated away and
  // back. Two-step refresh:
  //   1. Call /api/payments/sync-pending so any payment stuck in `pending`
  //      because the webhook was misconfigured / silent gets reconciled
  //      against the authoritative Stripe state.
  //   2. Refetch local grids so the merchant sees the up-to-date status.
  // Also runs once on mount (when userProfile resolves) so a hard navigation
  // into /app catches up on anything that completed while the tab was closed.
  useEffect(() => {
    if (!userProfile?.id || isDemoMode) return

    let lastRefreshAt = 0
    const MIN_REFETCH_INTERVAL_MS = 5_000

    const reconcileThenRefresh = async () => {
      try {
        await fetch('/api/payments/sync-pending', { method: 'POST' })
      } catch {
        // sync-pending is best-effort; the local refresh below still runs.
      }
      await refreshAllData()
    }

    const onMaybeRefresh = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastRefreshAt < MIN_REFETCH_INTERVAL_MS) return
      lastRefreshAt = now
      void reconcileThenRefresh()
    }

    void reconcileThenRefresh()
    lastRefreshAt = Date.now()

    document.addEventListener('visibilitychange', onMaybeRefresh)
    window.addEventListener('focus', onMaybeRefresh)
    return () => {
      document.removeEventListener('visibilitychange', onMaybeRefresh)
      window.removeEventListener('focus', onMaybeRefresh)
    }
  }, [userProfile?.id, isDemoMode, refreshAllData])

  const refreshCounts = useCallback(async () => {
    const uid = userProfile?.id
    if (!uid) return
    try {
      const [fixedRes, followRes, templatesRes] = await Promise.all([
        supabase.from('dyia_fixed_expenses').select('amount, frequency, is_active').eq('user_id', uid),
        supabase.from('dyia_follow_ups').select('*', { count: 'exact', head: true }).eq('user_id', uid).in('status', ['pending', 'contacted', 'snoozed']),
        supabase.from('dyia_price_templates').select('*', { count: 'exact', head: true }).eq('user_id', uid),
      ])
      if (fixedRes.data) {
        setFixedMonthlyExpenses(fixedRes.data.reduce((sum, e) => {
          if (e.is_active === false) return sum
          const amt = parseFloat(e.amount) || 0
          return sum + (e.frequency === 'yearly' ? amt / 12 : amt)
        }, 0))
      }
      setPendingFollowUpsCount(followRes.count || 0)
      setPriceTemplatesCount(templatesRes.count || 0)
    } catch (err) {
      console.error('Error refreshing counts:', err)
    }
  }, [supabase, userProfile?.id])

  // Initialize user profile when Clerk user is loaded.
  // Guard with initAttemptedRef so this runs exactly once per mount
  // (prevents re-firing when dependency refs change).
  useEffect(() => {
    if (initAttemptedRef.current) return
    if (isDemoMode) return
    if (!isLoaded) return
    
    if (!user) {
      setLoading(false)
      return
    }

    initAttemptedRef.current = true

    const initUserProfile = async () => {
      try {
        // Always load profile through server API (uses service role key, bypasses RLS).
        // This ensures admin fields (is_admin, role) are always returned correctly
        // regardless of RLS policies on the browser client.
        const response = await fetch('/api/user/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: user.primaryEmailAddress?.emailAddress || '' 
          }),
        })

        let profile = null
        if (response.ok) {
          const data = await response.json()
          profile = data.profile
        } else {
          const error = await response.json()
          console.error('Error loading user profile:', error)
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

  // Auto-trigger Stripe checkout when arriving with ?plan= and ?tier= params (e.g. from landing page pricing CTA)
  useEffect(() => {
    if (!planParam || !userProfile || checkoutTriggeredRef.current || loading || isDemoMode) return
    const tier = searchParams.get('tier') as 'basic' | 'pro' | null
    if (!tier) return
    checkoutTriggeredRef.current = true
    setCheckoutLoading(true)

    const triggerCheckout = async () => {
      const STRIPE_PRICES: Record<string, Record<string, string | undefined>> = {
        basic: {
          monthly: process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID,
          annual: process.env.NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID,
        },
        pro: {
          monthly: process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID,
          annual: process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID,
        },
      }
      const priceId = STRIPE_PRICES[tier]?.[planParam]

      if (!priceId) {
        showError('Pricing not configured. Please try again later.')
        setCheckoutLoading(false)
        return
      }

      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            priceId,
            clerkUserId: userProfile.clerk_user_id,
            userEmail: userProfile.email || user?.primaryEmailAddress?.emailAddress || '',
            tier,
          }),
        })

        const data = await res.json()
        if (data.url) {
          window.location.href = data.url
        } else {
          showError(data.error || 'Could not start checkout. Try from Settings.')
          setCheckoutLoading(false)
        }
      } catch {
        showError('Could not connect to payment provider.')
        setCheckoutLoading(false)
      }
    }

    triggerCheckout()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planParam, userProfile, loading, isDemoMode])

  // Handle successful return from Stripe checkout — verify session server-side to
  // synchronously activate subscription before the subscription gate evaluates.
  // This eliminates the race condition where the webhook hasn't fired yet.
  useEffect(() => {
    if (!sessionIdParam || loading || !userProfile || verifyAttemptedRef.current) return
    verifyAttemptedRef.current = true
    setVerifyingCheckout(true)

    const verifySession = async () => {
      let verifiedProfile: UserProfile | null = null
      try {
        const res = await fetch('/api/stripe/verify-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionIdParam }),
        })
        const data = await res.json().catch(() => ({}))
        // CRITICAL: only treat this as success when the server actually
        // confirmed and returned the updated profile. Previously ANY response
        // (including 4xx/5xx) fell through to the success path below, so users
        // saw "Your Pro trial is active!" even when activation failed.
        if (!res.ok || !data.profile) {
          console.error('Checkout verification failed:', data?.error)
          showError(
            typeof data?.error === 'string' && data.error
              ? data.error
              : "We couldn't confirm your subscription yet. Refresh in a moment — if it keeps happening, contact support."
          )
          // Keep session_id in the URL so a refresh retries verification.
          setVerifyingCheckout(false)
          return
        }
        verifiedProfile = data.profile as UserProfile
        setUserProfile(verifiedProfile)
      } catch (err) {
        console.error('Failed to verify checkout session:', err)
        // Keep session_id in URL so a refresh can retry verification
        // instead of bouncing the user to pricing
        setVerifyingCheckout(false)
        return
      }

      // Derive an accurate success message from the verified profile so we
      // don't tell a Basic subscriber they're on a "Pro trial".
      const verifiedState = computeSubscriptionState(verifiedProfile)
      const successMsg =
        verifiedState.tier === 'trial'
          ? verifiedState.productTier === 'basic'
            ? "Your free trial is active. You'll move to the Basic plan when it ends."
            : 'Your free trial is active! Welcome to Dyia Pro.'
          : verifiedState.planTier === 'pro'
            ? "You're on Dyia Pro! Welcome aboard."
            : 'Your Basic plan is active. Welcome to Dyia!'
      sessionStorage.setItem('dyia_checkout_success', successMsg)
      const url = new URL(window.location.href)
      url.searchParams.delete('session_id')
      router.replace(url.pathname + (url.search || ''), { scroll: false })
      setVerifyingCheckout(false)
    }

    verifySession()
  }, [sessionIdParam, loading, userProfile, router, showError])

  // Show checkout success toast after onboarding is complete (not during redirect to onboarding)
  const needsOnboardingEarly = !settings.onboardingCompleted && !settings.onboardingSkipped
  useEffect(() => {
    if (!loading && !verifyingCheckout && userProfile && !needsOnboardingEarly) {
      const successMsg = sessionStorage.getItem('dyia_checkout_success')
      if (successMsg) {
        sessionStorage.removeItem('dyia_checkout_success')
        // Tolerate the legacy '1' flag from older sessions.
        showSuccess(successMsg === '1' ? 'Welcome to Dyia!' : successMsg)
      }
    }
  }, [loading, verifyingCheckout, userProfile, needsOnboardingEarly, showSuccess])

  const handleLogout = async () => {
    if (isDemoMode) {
      // Clear demo cookies via API (httpOnly cookie can't be cleared from JS) and redirect
      await fetch('/api/demo/activate', { method: 'DELETE' })
      document.cookie = 'dyia_demo_active=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      window.location.href = '/'
      return
    }
    await signOut()
  }

  // Subscription gate — single source of truth (BUG-022 round 4).
  // computeSubscriptionState matches useSubscription() exactly so the badge,
  // banners, ProFeature gates, and DyiaInsight upsell can never disagree
  // about whether a given user has Pro access.
  const subState = useMemo(() => computeSubscriptionState(userProfile), [userProfile])
  const isAdmin = subState.isAdmin
  const isPro = subState.isPro
  // AI is usable with Pro access OR purchased credits. Non-Pro users with no
  // credits get an upgrade panel instead of hitting a raw 403 from /api/ai/chat.
  const canUseAI = subState.canUseAI
  // Brand-new users with no Stripe history now land in the app on the Free/Basic
  // experience (row 1 of QA_SUBSCRIPTION_STATE_MATRIX). TrialBanner handles the
  // upsell — no forced redirect to the marketing pricing section.

  // Only redirect to onboarding if user hasn't completed it AND has no data yet
  // Users who've already been using the app (have jobs/quotes) don't need onboarding
  const hasExistingData = jobs.length > 0 || quotes.length > 0
  const needsOnboarding = !loading && !isDemoMode && !!userProfile && !settings.onboardingCompleted && !settings.onboardingSkipped && !hasExistingData

  // Redirect to onboarding for new users (after loading completes)
  // Skip if checkout is in progress or session is being verified.
  // Brand-new users (neverSubscribed) now also get onboarding — they land in the
  // app on the Free/Basic tier and the onboarding step captures business info.
  useEffect(() => {
    if (needsOnboarding && !checkoutLoading && !checkoutTriggeredRef.current && !verifyingCheckout && !sessionIdParam) {
      const returnUrl = viewParam && viewParam !== 'dashboard'
        ? `/app?view=${viewParam}`
        : '/app'
      router.push(`/app/onboarding?returnUrl=${encodeURIComponent(returnUrl)}`)
    }
  }, [needsOnboarding, router, viewParam, checkoutLoading, verifyingCheckout, sessionIdParam])

  const handleReopenOnboarding = () => {
    router.push('/app/onboarding?redo=true')
  }

  const loadingOrRedirecting = (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(255,247,237,0.4), #fafafa 50%, rgba(255,251,235,0.3))' }}>
      <div className="text-center">
        <img
          src="/dyia-logo-full.png"
          alt="dyia logo"
          className="h-8 mb-6 mx-auto opacity-80"
        />
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-slate-500 font-medium">
          {verifyingCheckout ? 'Activating your subscription...' : checkoutLoading ? 'Redirecting to checkout...' : needsOnboarding ? 'Setting up your account...' : 'Loading...'}
        </p>
      </div>
    </div>
  )

  // Loading State
  if ((!isLoaded && !isDemoMode) || loading) {
    return loadingOrRedirecting
  }

  // Show loading while verifying Stripe checkout session
  if (verifyingCheckout) {
    return loadingOrRedirecting
  }

  // Show loading while redirecting to Stripe checkout
  if (checkoutLoading) {
    return loadingOrRedirecting
  }

  // Expired trial / canceled — user continues with basic tier access.
  // The TrialBanner component handles showing the upgrade prompt inline,
  // and ProFeature gates pro-only features. No full-page blocker needed.

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
      // Note: onboardingSkipped users can still re-enter via ?redo=true
    },
    {
      id: 'business-info',
      label: 'Add business info',
      description: 'Name, phone & email for quotes',
      completed: !!(settings.businessInfo.name?.trim() && settings.businessInfo.phone?.trim() && settings.businessInfo.email?.trim()),
      action: (settings.businessInfo.name?.trim() && settings.businessInfo.phone?.trim() && settings.businessInfo.email?.trim()) ? undefined : () => { setSettingsInitialTab('business'); setCurrentView('settings') },
    },
    {
      id: 'connect-payments',
      label: 'Connect Stripe',
      description: 'Accept customer payments',
      completed: !!userProfile?.stripe_connect_charges_enabled,
      action: userProfile?.stripe_connect_charges_enabled ? undefined : () => setCurrentView('payments'),
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
      action: priceTemplatesCount > 0 ? undefined : () => { setSettingsInitialTab('templates'); setCurrentView('settings') },
    },
  ]
  const showLaunchpadOnDashboard = !isDemoMode && launchpadItems.some(item => !item.completed)

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            jobs={jobs}
            quotes={quotes}
            settings={settings}
            userName={isDemoMode ? 'Demo User' : (user?.firstName || userProfile?.first_name || user?.primaryEmailAddress?.emailAddress || '')}
            onNavigate={(view) => setCurrentView(view as View)}
            pendingFollowUps={pendingFollowUpsCount}
            fixedMonthlyExpenses={fixedMonthlyExpenses}
            isPro={isPro}
            taxPercentage={settings.taxPercentage}
            launchpadItems={launchpadItems}
            showLaunchpad={showLaunchpadOnDashboard}
            onLogDailyExpenses={(date) => {
              setCloseDayDateFromDashboard(date)
              setCurrentView('jobs' as View)
            }}
            onOpenDyia={() => setCurrentView('assistant' as View)}
            onOpenDyiaWithPrompt={(prompt) => {
              setAssistantInitialPrompt(prompt)
              setCurrentView('assistant' as View)
            }}
          />
        )
      case 'jobs':
        return (
          <Jobs
            jobs={jobs}
            setJobs={setJobs}
            userId={userProfile?.id || ''}
            isDemoMode={isDemoMode}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            settings={settings}
            showSuccess={showSuccess}
            isPro={isPro}
            onOpenDyiaWithPrompt={(prompt) => {
              setAssistantInitialPrompt(prompt)
              setCurrentView('assistant' as View)
            }}
            initialCloseDayDate={closeDayDateFromDashboard}
            onCloseDayDateConsumed={() => setCloseDayDateFromDashboard(null)}
            initialDraftDate={jobDraftDate}
            initialDraftStatus={jobDraftStatus}
            onDraftConsumed={() => {
              setJobDraftDate(null)
              setJobDraftStatus(null)
            }}
            initialFocusJobId={jobFocusId}
            onFocusConsumed={() => setJobFocusId(null)}
            onOpenMap={(jobId) => {
              setMapFocusJobId(jobId)
              setCurrentView('maps')
            }}
          />
        )
      case 'quotes':
        return (
          <Quotes
            quotes={quotes}
            setQuotes={setQuotes}
            jobs={jobs}
            setJobs={setJobs}
            userId={userProfile?.id || ''}
            settings={settings}
            onCreateQuote={(job?: AppJob) => {
              setSelectedJobForQuote(job || null)
              setEditingQuote(null)
              setCurrentView('quoteBuilder')
            }}
            onEditQuote={(quote: AppQuote) => {
              setEditingQuote(quote)
              setSelectedJobForQuote(null)
              setCurrentView('quoteBuilder')
            }}
            showSuccess={showSuccess}
            isPro={isPro}
            onOpenDyiaWithPrompt={(prompt) => {
              setAssistantInitialPrompt(prompt)
              setCurrentView('assistant' as View)
            }}
          />
        )
      case 'quoteBuilder':
        return (
          <QuoteBuilder
            quotes={quotes}
            setQuotes={setQuotes}
            userId={userProfile?.id || ''}
            selectedJob={selectedJobForQuote}
            editingQuote={editingQuote}
            customerNames={[...new Set(jobs.map(j => j.customerName).filter(Boolean))]}
            onBack={() => {
              setSelectedJobForQuote(null)
              setEditingQuote(null)
              setCurrentView('quotes')
            }}
            showSuccess={showSuccess}
            isPro={isPro}
            settings={settings}
            onOpenDyiaWithPrompt={(prompt) => {
              setCurrentView('assistant')
              setAssistantInitialPrompt(prompt)
            }}
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
            userName={isDemoMode ? 'Demo User' : (user?.firstName || userProfile?.first_name || '')}
            isDemoMode={isDemoMode}
            initialTab={settingsInitialTab ?? tabParam ?? undefined}
            onDataChanged={refreshCounts}
            onOpenPayments={() => setCurrentView('payments')}
          />
        )
      case 'payments':
        return (
          <Payments
            userProfile={userProfile}
            settings={settings}
            showSuccess={showSuccess}
            showError={showError}
            isDemoMode={isDemoMode}
            onOpenSettings={() => {
              setSettingsInitialTab('business')
              setCurrentView('settings')
            }}
            onNavigateQuotes={() => setCurrentView('quotes')}
          />
        )
      case 'followUps':
        return (
          <FollowUps
            userId={userProfile?.id || ''}
            businessName={settings.businessInfo.name || 'dyia'}
            showSuccess={showSuccess}
            onDataChanged={refreshCounts}
            isDemoMode={isDemoMode}
            demoQuotes={isDemoMode ? quotes : undefined}
          />
        )
      case 'calendar':
        return (
          <Calendar
            jobs={jobs}
            onNavigate={(view) => setCurrentView(view as View)}
            onScheduleJob={(date) => {
              setJobDraftDate(date)
              setJobDraftStatus('scheduled')
              setCurrentView('jobs')
            }}
            onOpenMap={(jobId) => {
              setMapFocusJobId(jobId)
              setCurrentView('maps')
            }}
          />
        )
      case 'reports':
        return (
          <Reports
            jobs={jobs}
            quotes={quotes}
            fixedMonthlyExpenses={fixedMonthlyExpenses}
            isPro={isPro}
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
            userId={userProfile?.id || ''}
            onNavigate={(view) => setCurrentView(view as View)}
            onCreateQuote={(job) => { setSelectedJobForQuote(job ?? null); setCurrentView('quoteBuilder') }}
            showSuccess={showSuccess}
            isDemoMode={isDemoMode}
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
      case 'admin':
        return <AdminPanel />
      case 'profitCalculator':
        return <ProfitCalculator />
      case 'intel':
        return (
          <Intel
            businessName={settings.businessInfo.name || ''}
            showSuccess={showSuccess}
          />
        )
      case 'maps':
        return (
          <Maps
            jobs={jobs}
            setJobs={setJobs}
            settings={settings}
            userId={userProfile?.id || ''}
            isPro={isPro}
            isDemoMode={isDemoMode}
            focusJobId={mapFocusJobId}
            onFocusConsumed={() => setMapFocusJobId(null)}
            onOpenJob={(job) => {
              setJobFocusId(job.id)
              setCurrentView('jobs')
            }}
          />
        )
      case 'assistant':
        return null // Rendered separately in main - kept mounted for continuous chat experience
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
      
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        onLogout={handleLogout}
        isPro={isPro}
        subscriptionTier={subState.tier}
        trialDaysRemaining={subState.daysRemaining}
        subscriptionPlan={(userProfile?.subscription_plan || null) as 'monthly' | 'annual' | null}
        isDemoMode={isDemoMode}
        isAdmin={isAdmin}
        hasNewIntel={hasNewIntel}
      />
      
      <main className={`flex-1 flex flex-col overflow-hidden ${isDemoMode ? 'pt-16' : ''}`} style={{ animation: 'contentReveal 0.6s cubic-bezier(0.16, 1, 0.3, 1) both' }}>
        {!isDemoMode && !isAdmin && <TrialBanner />}
        <TopBar
          userName={isDemoMode ? 'Demo User' : (user?.firstName || userProfile?.first_name || '')}
          userEmail={isDemoMode ? 'demo@dyia.co' : (user?.primaryEmailAddress?.emailAddress || '')}
          userImageUrl={isDemoMode ? undefined : user?.imageUrl}
          onLogout={handleLogout}
          subscriptionTier={subState.tier}
          isDemoMode={isDemoMode}
        />
        {loadError && !isDemoMode && (
          <div className="mx-4 sm:mx-6 lg:mx-8 mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center justify-between gap-3" role="alert">
            <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300 min-w-0">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
              </svg>
              <span className="truncate">We couldn&apos;t load your latest data. Some screens may be incomplete.</span>
            </div>
            <button
              onClick={() => { void refreshAllData() }}
              className="app-btn-secondary text-xs py-1.5 px-3 shrink-0"
            >
              Retry
            </button>
          </div>
        )}
        {/* Assistant: render when open; keep mounted after first visit so conversation persists when switching views */}
        {(currentView === 'assistant' || hasViewedAssistant) && canUseAI && (
          <div
            className={`flex-1 min-h-0 flex flex-col ${currentView === 'assistant' ? 'animate-view-enter' : 'hidden'}`}
          >
            <Assistant
              userId={userProfile?.id || ''}
              showSuccess={showSuccess}
              initialPrompt={assistantInitialPrompt}
              onPromptConsumed={() => setAssistantInitialPrompt(null)}
              onAppDataChanged={refreshAllData}
            />
          </div>
        )}
        {currentView === 'assistant' && !canUseAI && (
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 animate-view-enter">
            <div className="max-w-xl mx-auto mt-8 text-center bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-8">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Meet your AI business assistant</h2>
              <p className="text-[var(--color-text-muted)] mb-5">
                Ask Dyia logs jobs, drafts quotes, tracks expenses, and surfaces insights from a chat. It&apos;s included with Pro — or use AI credits.
              </p>
              <a
                href="/app?view=settings&tab=account#subscription"
                className="inline-block bg-gradient-to-r from-orange-500 to-amber-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Upgrade to Pro
              </a>
            </div>
          </div>
        )}
        {currentView !== 'assistant' && (
          <div
            ref={contentScrollRef}
            className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8"
          >
            <div
              key={currentView}
              className="max-w-5xl mx-auto animate-view-enter"
            >
              {renderContent()}
            </div>
          </div>
        )}
      </main>

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
