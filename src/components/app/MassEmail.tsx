'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import type { AppJob, AppQuote, AppEmailConnection, CustomerWithEmail } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface MassEmailProps {
  jobs: AppJob[]
  quotes: AppQuote[]
  isPro?: boolean
  showSuccess: (message: string) => void
  showError: (message: string) => void
}

interface SendResult {
  campaignId: string
  total: number
  sent: number
  failed: number
}

interface BetaRequestState {
  googleEmail: string
  notes: string
}

export function MassEmail({ jobs, quotes, isPro = false, showSuccess, showError }: MassEmailProps) {
  const searchParams = useSearchParams()
  
  // Connection state
  const [connections, setConnections] = useState<AppEmailConnection[]>([])
  const [loadingConnections, setLoadingConnections] = useState(true)
  const [connecting, setConnecting] = useState<'gmail' | 'outlook' | null>(null)
  
  // Compose state
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set())
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [lastResult, setLastResult] = useState<SendResult | null>(null)
  
  // View state
  const [view, setView] = useState<'compose' | 'history'>('compose')
  const [history, setHistory] = useState<Array<{
    id: string
    subject: string
    recipientCount: number
    sentCount: number
    failedCount: number
    status: string
    createdAt: string
  }>>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [betaRequest, setBetaRequest] = useState<BetaRequestState>({ googleEmail: '', notes: '' })
  const [submittingBetaRequest, setSubmittingBetaRequest] = useState(false)
  const [betaRequestSubmitted, setBetaRequestSubmitted] = useState(false)
  const [betaRequestMessage, setBetaRequestMessage] = useState<string | null>(null)

  // Customer database state
  const [dbCustomers, setDbCustomers] = useState<Array<{ name: string; email: string }>>([])

  // Load customers from database on mount
  useEffect(() => {
    const loadDbCustomers = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('dyia_customers')
          .select('name, email')
          .not('email', 'is', null)
        if (data) {
          setDbCustomers(data.filter(c => c.email && c.email.includes('@')))
        }
      } catch (err) {
        console.error('Failed to load customers from DB:', err)
      }
    }
    if (isPro) loadDbCustomers()
  }, [isPro])

  // Extract customers with email addresses from quotes AND customer database
  const customersWithEmail = useMemo((): CustomerWithEmail[] => {
    const emailMap = new Map<string, CustomerWithEmail>()
    
    // Get emails from customer database first (most reliable source)
    for (const customer of dbCustomers) {
      if (customer.email && customer.name) {
        const email = customer.email.toLowerCase()
        if (!emailMap.has(email)) {
          emailMap.set(email, {
            name: customer.name,
            email,
            totalRevenue: 0,
            jobCount: 0,
            lastJobDate: '',
          })
        }
      }
    }

    // Get emails from quotes (may catch ones not in customer DB)
    for (const quote of quotes) {
      if (quote.customer?.email && quote.customer?.name) {
        const email = quote.customer.email.toLowerCase()
        if (!emailMap.has(email)) {
          emailMap.set(email, {
            name: quote.customer.name,
            email,
            totalRevenue: 0,
            jobCount: 0,
            lastJobDate: '',
          })
        }
      }
    }
    
    // Enhance with job data
    for (const job of jobs) {
      const name = (job.customerName || '').trim()
      for (const [, customer] of emailMap) {
        if (customer.name.toLowerCase() === name.toLowerCase()) {
          customer.totalRevenue += job.revenue || 0
          customer.jobCount++
          if (!customer.lastJobDate || job.date > customer.lastJobDate) {
            customer.lastJobDate = job.date
          }
        }
      }
    }
    
    return Array.from(emailMap.values())
      .filter(c => c.email && c.email.includes('@'))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
  }, [jobs, quotes, dbCustomers])

  // Fetch connections on mount
  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch('/api/email/connections')
      if (res.ok) {
        const data = await res.json()
        setConnections(data.connections || [])
        // Auto-select first connection
        if (data.connections?.length > 0 && !selectedConnectionId) {
          setSelectedConnectionId(data.connections[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to fetch connections:', err)
    } finally {
      setLoadingConnections(false)
    }
  }, [selectedConnectionId])

  useEffect(() => {
    fetchConnections()
  }, [fetchConnections])

  // Handle OAuth callback
  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    
    if (connected) {
      showSuccess(`${connected === 'gmail' ? 'Gmail' : 'Outlook'} connected successfully!`)
      fetchConnections()
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname)
    } else if (error) {
      const errorMessages: Record<string, string> = {
        oauth_denied: 'Authorization was denied. Please try again.',
        missing_params: 'OAuth callback missing parameters.',
        not_configured: 'OAuth not configured. Contact support.',
        token_exchange: 'Failed to exchange token. Please try again.',
        user_info: 'Failed to get account info. Please try again.',
        user_not_found: 'User not found. Please sign in again.',
        storage: 'Failed to save connection. Please try again.',
        unknown: 'An unknown error occurred. Please try again.',
      }
      showError(errorMessages[error] || 'Connection failed. Please try again.')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [searchParams, showSuccess, showError, fetchConnections])

  // Connect account
  const connectAccount = async (provider: 'gmail' | 'outlook') => {
    setConnecting(provider)
    try {
      const res = await fetch(`/api/email/connect/${provider}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to initiate connection')
      }
      const { authUrl } = await res.json()
      window.location.href = authUrl
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Connection failed')
      setConnecting(null)
    }
  }

  // Disconnect account
  const disconnectAccount = async (connectionId: string) => {
    try {
      const res = await fetch('/api/email/connections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      })
      if (res.ok) {
        setConnections(prev => prev.filter(c => c.id !== connectionId))
        if (selectedConnectionId === connectionId) {
          setSelectedConnectionId(null)
        }
        showSuccess('Account disconnected')
      }
    } catch {
      showError('Failed to disconnect account')
    }
  }

  // Toggle customer selection
  const toggleCustomer = (email: string) => {
    setSelectedCustomers(prev => {
      const next = new Set(prev)
      if (next.has(email)) {
        next.delete(email)
      } else {
        next.add(email)
      }
      return next
    })
  }

  // Select/deselect all
  const selectAll = () => {
    if (selectedCustomers.size === customersWithEmail.length) {
      setSelectedCustomers(new Set())
    } else {
      setSelectedCustomers(new Set(customersWithEmail.map(c => c.email)))
    }
  }

  // Send emails
  const sendEmails = async () => {
    if (!selectedConnectionId || selectedCustomers.size === 0 || !subject.trim() || !body.trim()) {
      showError('Please fill in all fields and select recipients')
      return
    }

    setSending(true)
    setLastResult(null)

    try {
      const recipients = customersWithEmail
        .filter(c => selectedCustomers.has(c.email))
        .map(c => ({ email: c.email, name: c.name }))

      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: selectedConnectionId,
          recipients,
          subject: subject.trim(),
          body: body.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send emails')
      }

      setLastResult(data)
      showSuccess(`Sent ${data.sent} of ${data.total} emails`)
      
      // Reset form on success
      if (data.sent > 0) {
        setSelectedCustomers(new Set())
        setSubject('')
        setBody('')
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to send emails')
    } finally {
      setSending(false)
    }
  }

  // Fetch history
  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/email/send?limit=20')
      if (res.ok) {
        const data = await res.json()
        setHistory(data.campaigns || [])
      }
    } catch (err) {
      console.error('Failed to fetch history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    if (view === 'history') {
      fetchHistory()
    }
  }, [view])

  const submitBetaRequest = async () => {
    const googleEmail = betaRequest.googleEmail.trim()
    if (!googleEmail) {
      showError('Enter the Google email you want to connect')
      return
    }

    setSubmittingBetaRequest(true)
    setBetaRequestMessage(null)
    try {
      const res = await fetch('/api/beta-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleEmail,
          requestedFeature: 'gmail_beta',
          notes: betaRequest.notes.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit beta access request')
      }

      setBetaRequestSubmitted(true)
      setBetaRequestMessage(
        data.alreadyExists
          ? 'You already have an active beta access request for this Google email. We will review it from the admin side.'
          : 'Beta access request submitted. We will review it and add this Google account if approved.'
      )
      showSuccess('Beta access request submitted')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit beta access request'
      setBetaRequestMessage(message)
      showError(message)
    } finally {
      setSubmittingBetaRequest(false)
    }
  }

  // Pro gate
  if (!isPro) {
    return (
      <div className="page-content">
        <div>
          <h1 className="page-title">Email Blast</h1>
          <p className="page-subtitle">Send promotional emails to your customers</p>
        </div>
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">Pro Feature</h2>
          <p className="text-[var(--color-text-muted)] mb-4">Upgrade to Pro to send email blasts to your customers from your own Gmail or Outlook account.</p>
          <span className="inline-block bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
            Upgrade to Pro
          </span>
        </div>
      </div>
    )
  }

  const activeConnection = connections.find(c => c.id === selectedConnectionId)

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Email Blast</h1>
          <p className="page-subtitle">
            Send promotional emails to your customers from your own email
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView('compose')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'compose'
                ? 'bg-orange-500 text-white'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
            }`}
          >
            Compose
          </button>
          <button
            type="button"
            onClick={() => setView('history')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'history'
                ? 'bg-orange-500 text-white'
                : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
            }`}
          >
            History
          </button>
        </div>
      </div>

      {view === 'compose' ? (
        <>
          {/* Connection Section */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Email Account</h2>
            
            {loadingConnections ? (
              <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading...
              </div>
            ) : connections.length > 0 ? (
              <div className="space-y-3">
                {connections.map(conn => (
                  <div
                    key={conn.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                      selectedConnectionId === conn.id
                        ? 'border-orange-500 bg-orange-500/5'
                        : 'border-[var(--color-border)] hover:border-orange-500/50'
                    }`}
                    onClick={() => setSelectedConnectionId(conn.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        conn.provider === 'gmail' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                      }`}>
                        {conn.provider === 'gmail' ? (
                          <svg className="w-5 h-5 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h12.9q.44 0 .75.3.3.3.3.75V12zm-6-8.25v3h3v-3zm0 4.5v3h3v-3zm0 4.5v1.83l3.05-1.83zm-5.25-9v3h3.75v-3zm0 4.5v3h3.75v-3zm0 4.5v2.03l2.41 1.5 1.34-.8v-2.73zM9 3.75V6h2l.13.01.12.04v-2.3zM5.98 15.98q.9 0 1.6-.3.7-.32 1.19-.86.48-.55.73-1.28.25-.74.25-1.61 0-.83-.25-1.55-.24-.71-.71-1.24t-1.15-.83q-.68-.3-1.55-.3-.92 0-1.64.3-.71.3-1.2.85-.5.54-.75 1.3-.25.74-.25 1.63 0 .85.26 1.56.26.72.74 1.23.48.52 1.17.81.69.3 1.56.3zM7.5 21h12.39L12 16.08V17q0 .41-.3.7-.29.3-.7.3H7.5zm15-.13v-7.24l-5.9 3.54Z"/>
                          </svg>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-[var(--color-text-primary)]">{conn.emailAddress}</div>
                        <div className="text-xs text-[var(--color-text-muted)] capitalize">{conn.provider}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        disconnectAccount(conn.id)
                      }}
                      className="text-sm text-red-600 dark:text-red-400 hover:underline"
                    >
                      Disconnect
                    </button>
                  </div>
                ))}
                
                {/* Add another account */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => connectAccount('gmail')}
                    disabled={connecting !== null || connections.some(c => c.provider === 'gmail')}
                    className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:border-orange-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {connecting === 'gmail' ? (
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <span className="text-red-600">+</span>
                    )}
                    Add Gmail
                  </button>
                  <button
                    type="button"
                    onClick={() => connectAccount('outlook')}
                    disabled={connecting !== null || connections.some(c => c.provider === 'outlook')}
                    className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg hover:border-orange-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {connecting === 'outlook' ? (
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <span className="text-blue-600">+</span>
                    )}
                    Add Outlook
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-[var(--color-text-muted)] mb-4">
                  Connect your email account to send emails. They&apos;ll come from your address, so replies go directly to you.
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => connectAccount('gmail')}
                    disabled={connecting !== null}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {connecting === 'gmail' ? (
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                      </svg>
                    )}
                    Connect Gmail
                  </button>
                  <button
                    type="button"
                    onClick={() => connectAccount('outlook')}
                    disabled={connecting !== null}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {connecting === 'outlook' ? (
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.85-.2q-.35-.21-.57-.55-.22-.33-.33-.75-.1-.42-.1-.86t.1-.87q.1-.43.34-.76.22-.34.59-.54.36-.2.87-.2t.86.2q.35.21.57.55.22.34.31.77.1.43.1.88zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18H1q-.41 0-.7-.3-.3-.29-.3-.7V7q0-.41.3-.7Q.58 6 1 6h6.5V2.55q0-.44.3-.75.3-.3.75-.3h12.9q.44 0 .75.3.3.3.3.75V12z"/>
                      </svg>
                    )}
                    Connect Outlook
                  </button>
                </div>
                <div className="mt-6 pt-6 border-t border-[var(--color-border)] text-left max-w-xl mx-auto">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                      Gmail Beta
                    </span>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      If Gmail says access is blocked
                    </p>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)] mb-4">
                    Submit the Google email you want to connect and we&apos;ll review it from the admin panel and grant access there.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                        Google email to approve
                      </label>
                      <input
                        type="email"
                        value={betaRequest.googleEmail}
                        onChange={(e) => setBetaRequest(prev => ({ ...prev, googleEmail: e.target.value }))}
                        placeholder="you@gmail.com"
                        className="app-input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                        Notes (optional)
                      </label>
                      <textarea
                        value={betaRequest.notes}
                        onChange={(e) => setBetaRequest(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Anything helpful for approval"
                        rows={3}
                        className="app-input w-full resize-none"
                      />
                    </div>

                    {betaRequestMessage && (
                      <div className={`rounded-lg border px-4 py-3 text-sm ${
                        betaRequestSubmitted
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-400'
                          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400'
                      }`}>
                        {betaRequestMessage}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={submitBetaRequest}
                      disabled={submittingBetaRequest}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {submittingBetaRequest ? 'Submitting...' : 'Request Gmail Access'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Recipients Section */}
          {connections.length > 0 && (
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  Recipients ({selectedCustomers.size} selected)
                </h2>
                {customersWithEmail.length > 0 && (
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-sm text-orange-600 dark:text-orange-400 hover:underline"
                  >
                    {selectedCustomers.size === customersWithEmail.length ? 'Deselect all' : 'Select all'}
                  </button>
                )}
              </div>
              
              {customersWithEmail.length === 0 ? (
                <p className="text-[var(--color-text-muted)] text-center py-4">
                  No customers with email addresses found. Add emails to your customer database or include them in quotes.
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {customersWithEmail.map(customer => (
                    <label
                      key={customer.email}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedCustomers.has(customer.email)
                          ? 'border-orange-500 bg-orange-500/5'
                          : 'border-[var(--color-border)] hover:border-orange-500/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCustomers.has(customer.email)}
                        onChange={() => toggleCustomer(customer.email)}
                        className="w-4 h-4 accent-orange-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[var(--color-text-primary)] truncate">{customer.name}</div>
                        <div className="text-sm text-[var(--color-text-muted)] truncate">{customer.email}</div>
                      </div>
                      <div className="text-right text-sm text-[var(--color-text-muted)] shrink-0">
                        {customer.jobCount > 0 && (
                          <div>{formatCurrency(customer.totalRevenue)}</div>
                        )}
                        {customer.jobCount > 0 && (
                          <div className="text-xs">{customer.jobCount} job{customer.jobCount !== 1 ? 's' : ''}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Compose Section */}
          {connections.length > 0 && (
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Message</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Special offer for valued customers"
                    className="app-input w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                    Message
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Hi there,

I wanted to reach out with a special offer..."
                    rows={8}
                    className="app-input w-full resize-none"
                  />
                </div>

                {activeConnection && (
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Sending from: <strong>{activeConnection.emailAddress}</strong>
                  </p>
                )}

                {lastResult && (
                  <div className={`p-4 rounded-lg ${
                    lastResult.failed > 0 
                      ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50' 
                      : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50'
                  }`}>
                    <p className={lastResult.failed > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'}>
                      Sent {lastResult.sent} of {lastResult.total} emails
                      {lastResult.failed > 0 && ` (${lastResult.failed} failed)`}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={sendEmails}
                  disabled={sending || selectedCustomers.size === 0 || !subject.trim() || !body.trim() || !selectedConnectionId}
                  className="app-btn-primary w-full flex items-center justify-center gap-2"
                >
                  {sending ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send to {selectedCustomers.size} recipient{selectedCustomers.size !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* History View */
        <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Send History</h2>
          
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8 text-[var(--color-text-muted)]">
              <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
            </div>
          ) : history.length === 0 ? (
            <p className="text-[var(--color-text-muted)] text-center py-8">
              No emails sent yet. Compose your first email blast above.
            </p>
          ) : (
            <div className="space-y-3">
              {history.map(campaign => (
                <div
                  key={campaign.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-4 rounded-lg border border-[var(--color-border)]"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-[var(--color-text-primary)] truncate">{campaign.subject}</div>
                    <div className="text-sm text-[var(--color-text-muted)]">
                      {new Date(campaign.createdAt).toLocaleDateString()} · {campaign.sentCount}/{campaign.recipientCount} sent
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    campaign.status === 'completed' 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : campaign.status === 'failed'
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                  }`}>
                    {campaign.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
