'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { AppJob, AppQuote, AppSettings, UserProfile } from '@/types/database'
import { AuthModal } from '@/components/auth/AuthModal'
import { Sidebar } from '@/components/app/Sidebar'
import { Dashboard } from '@/components/app/Dashboard'
import { Jobs } from '@/components/app/Jobs'
import { Quotes } from '@/components/app/Quotes'
import { QuoteBuilder } from '@/components/app/QuoteBuilder'
import { Settings } from '@/components/app/Settings'

type View = 'dashboard' | 'jobs' | 'quotes' | 'quoteBuilder' | 'settings'

export default function AppPage() {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [jobs, setJobs] = useState<AppJob[]>([])
  const [quotes, setQuotes] = useState<AppQuote[]>([])
  const [settings, setSettings] = useState<AppSettings>({
    taxPercentage: 30,
    monthlyGoal: 0,
    businessInfo: { name: '', phone: '', email: '', address: '', logo: null }
  })
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const supabase = createClient()

  const showSuccess = useCallback((message: string) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(null), 3000)
  }, [])

  const loadData = useCallback(async (userId: string) => {
    try {
      // Load jobs
      const { data: jobsData } = await supabase
        .from('junkprofit_jobs')
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
          notes: j.notes || undefined
        })))
      }

      // Load quotes
      const { data: quotesData } = await supabase
        .from('junkprofit_quotes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (quotesData) {
        setQuotes(quotesData.map(q => ({
          id: q.id,
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
          total: parseFloat(q.total) || 0
        })))
      }

      // Load settings
      const { data: settingsData } = await supabase
        .from('junkprofit_settings')
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
            logo: settingsData.business_logo || null
          }
        })
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }, [supabase])

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        setUser(session.user)
        
        // Get or create user profile
        let { data: profile } = await supabase
          .from('junkprofit_users')
          .select('*')
          .eq('auth_user_id', session.user.id)
          .single()

        if (!profile) {
          const { data: newProfile } = await supabase
            .from('junkprofit_users')
            .insert({ auth_user_id: session.user.id, email: session.user.email })
            .select()
            .single()

          if (newProfile) {
            await supabase
              .from('junkprofit_settings')
              .insert({ user_id: newProfile.id })

            profile = newProfile
          }
        }

        if (profile) {
          setUserProfile(profile)
          await loadData(profile.id)
        }
      }

      setLoading(false)
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        
        let { data: profile } = await supabase
          .from('junkprofit_users')
          .select('*')
          .eq('auth_user_id', session.user.id)
          .single()

        if (!profile) {
          const { data: newProfile } = await supabase
            .from('junkprofit_users')
            .insert({ auth_user_id: session.user.id, email: session.user.email })
            .select()
            .single()

          if (newProfile) {
            await supabase
              .from('junkprofit_settings')
              .insert({ user_id: newProfile.id })

            profile = newProfile
          }
        }

        if (profile) {
          setUserProfile(profile)
          await loadData(profile.id)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setUserProfile(null)
        setJobs([])
        setQuotes([])
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, loadData])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center text-3xl mb-4 mx-auto shadow-lg shadow-emerald-500/20 animate-pulse">
            💼
          </div>
          <div className="loading-spinner mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  // Auth Required
  if (!user) {
    return <AuthModal />
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            jobs={jobs}
            settings={settings}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            onAddJob={() => setCurrentView('jobs')}
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
            showSuccess={showSuccess}
          />
        )
      case 'quotes':
        return (
          <Quotes
            quotes={quotes}
            setQuotes={setQuotes}
            userId={userProfile?.id || ''}
            settings={settings}
            onCreateQuote={() => setCurrentView('quoteBuilder')}
            showSuccess={showSuccess}
          />
        )
      case 'quoteBuilder':
        return (
          <QuoteBuilder
            quotes={quotes}
            setQuotes={setQuotes}
            userId={userProfile?.id || ''}
            onBack={() => setCurrentView('quotes')}
            showSuccess={showSuccess}
          />
        )
      case 'settings':
        return (
          <Settings
            settings={settings}
            setSettings={setSettings}
            userId={userProfile?.id || ''}
            showSuccess={showSuccess}
          />
        )
    }
  }

  return (
    <div className="app-layout">
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        userEmail={user.email || ''}
        onLogout={handleLogout}
        jobs={jobs}
        showSuccess={showSuccess}
      />
      
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          {renderContent()}
        </div>
      </main>

      {/* Success Toast */}
      {successMessage && (
        <div className="toast toast-success">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}
    </div>
  )
}
