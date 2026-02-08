'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageBubble } from './MessageBubble'
import { ThreadList } from './ThreadList'
import { JobPreviewCard } from './JobPreviewCard'
import { QuotePreviewCard } from './QuotePreviewCard'
import type { JobProposal, QuoteProposal, PendingAction } from '@/types/database'

interface AssistantProps {
  userId: string
  showSuccess: (message: string) => void
}

export interface ToolResult {
  success: boolean
  message: string
  data?: Record<string, unknown>
  type?: string
  // For proposal results, this contains the pending action info
  pendingAction?: {
    type: 'create_job' | 'generate_quote' | 'log_expense'
    proposal: JobProposal | QuoteProposal | Record<string, unknown>
  }
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  toolResults?: ToolResult[]
  // Track if this message has a pending action that needs confirmation
  hasPendingAction?: boolean
}

export interface Thread {
  id: string
  title: string
  lastMessageAt: Date
  preview: string
}

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: `Hey! I'm **Dyia** — your business partner in your pocket.

I don't just answer questions. I actually **do things** for you:

• Log jobs and track your profit
• Create and send quotes
• Remind you to follow up
• Suggest prices based on your history
• Show you how your business is doing

Just tell me what you need.`,
  timestamp: new Date(),
}

// Default quick actions (fallback)
const DEFAULT_QUICK_ACTIONS = [
  { id: 'stats', label: "📊 This week's stats", prompt: 'How did I do this week?', icon: '📊' },
  { id: 'follow-ups', label: '📞 Pending follow-ups', prompt: 'Show me pending follow-ups', icon: '📞' },
  { id: 'pricing', label: '💰 Suggest a price', prompt: 'What should I charge for a full truck load?', icon: '💰' },
  { id: 'summary', label: '📋 Monthly summary', prompt: 'Give me a business summary for this month', icon: '📋' },
]

interface QuickAction {
  id: string
  label: string
  prompt: string
  icon?: string
}

export function Assistant({ userId, showSuccess }: AssistantProps) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showThreads, setShowThreads] = useState(false)
  const [lastResponseId, setLastResponseId] = useState<string | null>(null) // For stateful conversation
  
  // Dynamic quick actions fetched from API
  const [quickActions, setQuickActions] = useState<QuickAction[]>(DEFAULT_QUICK_ACTIONS)
  const [quickActionsLoading, setQuickActionsLoading] = useState(false)
  
  // Pending action state for confirmations
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  // File attachment for upload & extraction
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null)
  const [attachmentName, setAttachmentName] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const skipThreadLoadRef = useRef(false) // Skip load when threadId comes from chat response (we already have messages)
  const supabase = useMemo(() => createClient(), [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load threads on mount
  useEffect(() => {
    const loadThreads = async () => {
      if (!userId) return
      
      try {
        const response = await fetch('/api/threads')
        if (response.ok) {
          const data = await response.json()
          setThreads(data.threads?.map((t: { id: string; title: string; last_message_at: string }) => ({
            id: t.id,
            title: t.title || 'New Conversation',
            lastMessageAt: new Date(t.last_message_at),
            preview: ''
          })) || [])
        }
      } catch (error) {
        console.error('Error loading threads:', error)
      }
    }

    loadThreads()
  }, [userId])

  // Track if we've fetched quick actions for this session
  const [quickActionsFetched, setQuickActionsFetched] = useState(false)

  // Fetch dynamic quick actions ONCE on mount (not on every message)
  useEffect(() => {
    const fetchQuickActions = async () => {
      // Only fetch once per session
      if (quickActionsFetched) return
      
      setQuickActionsLoading(true)
      try {
        const response = await fetch('/api/ai/quick-actions')
        if (response.ok) {
          const data = await response.json()
          if (data.actions && data.actions.length > 0) {
            // Format actions with icons in labels
            const formattedActions = data.actions.map((a: { id: string; label: string; prompt: string; icon?: string }) => ({
              id: a.id,
              label: a.icon ? `${a.icon} ${a.label}` : a.label,
              prompt: a.prompt,
              icon: a.icon
            }))
            setQuickActions(formattedActions)
          }
        }
        setQuickActionsFetched(true)
      } catch (error) {
        console.error('Error fetching quick actions:', error)
        // Keep default actions on error
      } finally {
        setQuickActionsLoading(false)
      }
    }

    fetchQuickActions()
  }, [quickActionsFetched])

  // Load messages when thread changes (e.g. user selects a different conversation)
  useEffect(() => {
    const loadMessages = async () => {
      if (!currentThreadId) {
        setMessages([WELCOME_MESSAGE])
        setLastResponseId(null)
        return
      }

      // Skip load when threadId was just set from chat response - we already have messages in memory
      if (skipThreadLoadRef.current) {
        skipThreadLoadRef.current = false
        return
      }

      setIsLoading(true)
      try {
        const response = await fetch(`/api/threads/${currentThreadId}`)
        if (response.ok) {
          const data = await response.json()
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages.map((m: { id: string; role: 'user' | 'assistant'; content: string; created_at: string; tool_results?: ToolResult[] }) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
              timestamp: new Date(m.created_at),
              toolResults: m.tool_results
            })))
          } else {
            setMessages([WELCOME_MESSAGE])
          }
        }
      } catch (error) {
        console.error('Error loading messages:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadMessages()
  }, [currentThreadId])

  const handleNewConversation = useCallback(() => {
    setCurrentThreadId(null)
    setMessages([WELCOME_MESSAGE])
    setInputValue('')
    setLastResponseId(null)
    inputRef.current?.focus()
  }, [])

  const handleSelectThread = useCallback((threadId: string) => {
    setCurrentThreadId(threadId)
    setShowThreads(false)
  }, [])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setIsUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/ai/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setAttachmentUrl(data.url)
      setAttachmentName(data.fileName || file.name)
    } catch (err) {
      // Show upload error as a system message in the chat
      const errorMsg = err instanceof Error ? err.message : 'Upload failed'
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant' as const,
        content: `File upload failed: ${errorMsg}. Please try again.`,
        timestamp: new Date(),
      }])
    } finally {
      setIsUploading(false)
    }
  }

  const handleSend = async (customMessage?: string) => {
    const content = (customMessage || inputValue).trim()
    if ((!content && !attachmentUrl) || isSending) return

    // Add user message immediately
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsSending(true)

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    const urlToSend = attachmentUrl
    const nameToSend = attachmentName
    if (attachmentUrl) {
      setAttachmentUrl(null)
      setAttachmentName(null)
    }

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content || '(see attached file)',
          conversationId: currentThreadId,
          previousResponseId: lastResponseId,
          ...(urlToSend && { fileUrl: urlToSend, fileName: nameToSend || 'file' }),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message')
      }

      // Update thread ID if new conversation (skip loadMessages effect - we already have messages)
      if (data.threadId && !currentThreadId) {
        skipThreadLoadRef.current = true
        setCurrentThreadId(data.threadId)
        // Refresh thread list
        const threadsResponse = await fetch('/api/threads')
        if (threadsResponse.ok) {
          const threadsData = await threadsResponse.json()
          setThreads(threadsData.threads?.map((t: { id: string; title: string; last_message_at: string }) => ({
            id: t.id,
            title: t.title || 'New Conversation',
            lastMessageAt: new Date(t.last_message_at),
            preview: ''
          })) || [])
        }
      }

      // Store response ID for stateful continuation
      if (data.responseId) {
        setLastResponseId(data.responseId)
      }

      // Check if there's a pending action in the response
      const pendingActionResult = data.toolResults?.find((r: ToolResult) => r.pendingAction)
      
      // Add assistant response
      const assistantMessage: Message = {
        id: data.messageId || `resp-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        toolResults: data.toolResults,
        hasPendingAction: !!pendingActionResult,
      }
      setMessages(prev => [...prev, assistantMessage])

      // If there's a pending action, set it up for confirmation AND save to database
      if (pendingActionResult?.pendingAction) {
        const action = pendingActionResult.pendingAction
        const pendingId = `pending-${Date.now()}`
        
        setPendingAction({
          id: pendingId,
          type: action.type,
          data: action.proposal as JobProposal | QuoteProposal,
          status: 'pending',
          messageId: assistantMessage.id,
          createdAt: Date.now()
        })

        // Save to database for persistence (fire and forget)
        fetch('/api/pending-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actionType: action.type,
            proposalData: action.proposal,
            threadId: data.threadId || currentThreadId,
            originalMessage: content,
            aiResponse: data.message?.substring(0, 200)
          })
        }).catch(err => console.error('Failed to save pending action:', err))
      } else if (data.toolResults?.some((r: ToolResult) => r.success && !r.pendingAction)) {
        // Show success only for non-pending actions that completed
        const successActions = data.toolResults.filter((r: ToolResult) => r.success && !r.pendingAction)
        if (successActions.length === 1) {
          showSuccess('Action completed!')
        } else if (successActions.length > 1) {
          showSuccess(`${successActions.length} actions completed!`)
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I ran into an issue: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      }])
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
  }

  const handleQuickAction = (prompt: string) => {
    handleSend(prompt)
  }

  // Handle confirming a pending job
  const handleConfirmJob = async (jobData: JobProposal) => {
    if (!pendingAction || isConfirming) return
    
    setIsConfirming(true)
    
    try {
      const response = await fetch('/api/ai/chat/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: 'create_job',
          data: {
            date: jobData.date,
            customer_name: jobData.customerName,
            source: jobData.source || 'Unknown',
            revenue: jobData.revenue,
            labor: jobData.labor,
            gas: jobData.gas,
            dump_fee: jobData.dumpFee,
            dumpster_rental: jobData.dumpsterRental,
            additional_expense: jobData.additionalExpense,
            num_workers: jobData.numWorkers,
            cost_per_worker: jobData.costPerWorker,
            notes: jobData.notes || ''
          },
          conversationId: currentThreadId,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save job')
      }

      // Update the thread ID if it changed (skip load - we're about to add confirmation message)
      if (result.threadId && !currentThreadId) {
        skipThreadLoadRef.current = true
        setCurrentThreadId(result.threadId)
      }

      // Add confirmation message
      const confirmMessage: Message = {
        id: `confirm-${Date.now()}`,
        role: 'assistant',
        content: result.message || 'Job saved successfully!',
        timestamp: new Date(),
        toolResults: result.toolResults,
      }
      setMessages(prev => [...prev, confirmMessage])

      // Clear the pending action
      setPendingAction(null)
      showSuccess('Job saved!')

      // Refresh thread list
      const threadsResponse = await fetch('/api/threads')
      if (threadsResponse.ok) {
        const threadsData = await threadsResponse.json()
        setThreads(threadsData.threads?.map((t: { id: string; title: string; last_message_at: string }) => ({
          id: t.id,
          title: t.title || 'New Conversation',
          lastMessageAt: new Date(t.last_message_at),
          preview: ''
        })) || [])
      }
    } catch (error) {
      console.error('Error confirming job:', error)
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I couldn't save the job: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      }])
    } finally {
      setIsConfirming(false)
    }
  }

  // Handle confirming a pending quote
  const handleConfirmQuote = async (quoteData: QuoteProposal, downloadPdf?: boolean) => {
    if (!pendingAction || isConfirming) return
    
    setIsConfirming(true)
    
    try {
      const response = await fetch('/api/ai/chat/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: 'generate_quote',
          data: {
            customer_name: quoteData.customerName,
            customer_phone: quoteData.customerPhone || '',
            customer_email: quoteData.customerEmail || '',
            customer_address: quoteData.customerAddress || '',
            job_description: quoteData.jobDescription || '',
            estimate_low: quoteData.estimateLow,
            estimate_high: quoteData.estimateHigh,
          },
          conversationId: currentThreadId,
          downloadPdf,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save quote')
      }

      // Update the thread ID if it changed (skip load - we're about to add confirmation message)
      if (result.threadId && !currentThreadId) {
        skipThreadLoadRef.current = true
        setCurrentThreadId(result.threadId)
      }

      // Add confirmation message
      const confirmMessage: Message = {
        id: `confirm-${Date.now()}`,
        role: 'assistant',
        content: result.message || 'Quote saved successfully!',
        timestamp: new Date(),
        toolResults: result.toolResults,
      }
      setMessages(prev => [...prev, confirmMessage])

      // Clear the pending action
      setPendingAction(null)
      showSuccess(downloadPdf ? 'Quote saved & PDF downloaded!' : 'Quote saved!')

      // Refresh thread list
      const threadsResponse = await fetch('/api/threads')
      if (threadsResponse.ok) {
        const threadsData = await threadsResponse.json()
        setThreads(threadsData.threads?.map((t: { id: string; title: string; last_message_at: string }) => ({
          id: t.id,
          title: t.title || 'New Conversation',
          lastMessageAt: new Date(t.last_message_at),
          preview: ''
        })) || [])
      }
    } catch (error) {
      console.error('Error confirming quote:', error)
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I couldn't save the quote: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      }])
    } finally {
      setIsConfirming(false)
    }
  }

  // Handle canceling a pending action
  const handleCancelPendingAction = async () => {
    // Mark as cancelled in database
    if (pendingAction?.id) {
      fetch('/api/pending-actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId: pendingAction.id,
          status: 'cancelled'
        })
      }).catch(err => console.error('Failed to cancel pending action:', err))
    }
    
    setPendingAction(null)
    // Add a message acknowledging the cancellation
    setMessages(prev => [...prev, {
      id: `cancel-${Date.now()}`,
      role: 'assistant',
      content: 'No problem! I\'ve cancelled that. What else can I help you with?',
      timestamp: new Date(),
    }])
  }

  // Check if pending action is a job
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isJobProposal = (data: any): data is JobProposal => {
    return data && 'revenue' in data && 'customerName' in data && 'date' in data
  }

  // Check if pending action is a quote
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isQuoteProposal = (data: any): data is QuoteProposal => {
    return data && 'estimateLow' in data && 'estimateHigh' in data
  }

  return (
    <div className="h-full flex relative">
      {/* Thread Sidebar - overlay on mobile, side panel on desktop */}
      <div className={`
        assistant-sidebar-panel 
        ${showThreads ? 'assistant-sidebar-open' : 'assistant-sidebar-closed'}
        sm:relative
        ${showThreads ? 'fixed inset-0 z-50 sm:z-auto' : ''}
      `}>
        {/* Mobile overlay backdrop */}
        {showThreads && (
          <div 
            className="fixed inset-0 bg-black/50 sm:hidden"
            onClick={() => setShowThreads(false)}
          />
        )}
        <div className={`
          relative z-10 h-full bg-[var(--color-bg-card)] 
          ${showThreads ? 'w-72 sm:w-72' : 'w-0'}
          transition-all duration-200
        `}>
          <div className="p-3 border-b border-[var(--color-border)] whitespace-nowrap flex items-center justify-between">
            <button
              onClick={handleNewConversation}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New chat
            </button>
            <button
              onClick={() => setShowThreads(false)}
              className="sm:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <ThreadList
            threads={threads}
            currentThreadId={currentThreadId}
            onSelect={(threadId) => { handleSelectThread(threadId); setShowThreads(false); }}
          />
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header */}
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[var(--color-border)] flex items-center gap-2 sm:gap-3 bg-[var(--color-bg-card)]">
          <button
            onClick={() => setShowThreads(!showThreads)}
            className="p-1.5 sm:p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            title={showThreads ? 'Hide conversations' : 'Show conversations'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {showThreads ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
              )}
            </svg>
          </button>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
            {/* Dyia Avatar */}
            <img src="/dyia-agent.png" alt="Dyia AI" className="w-7 h-7 sm:w-8 sm:h-8 rounded-full shadow-md ring-2 ring-orange-400/30 object-cover" />
            <span className="font-semibold text-[var(--color-text-primary)] text-sm sm:text-base">Dyia</span>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isSending ? 'bg-orange-500 animate-pulse' : 'bg-green-500'
            }`} />
            {isSending && (
              <span className="text-[10px] sm:text-xs text-[var(--color-text-faint)] truncate">thinking...</span>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="loading-spinner mx-auto mb-4" />
                  <p className="text-[var(--color-text-muted)]">Loading conversation...</p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isLatest={index === messages.length - 1}
                  />
                ))}

                {/* Pending Action Cards */}
                {pendingAction && pendingAction.status === 'pending' && (
                  <div className="flex justify-start">
                    <div className="flex gap-3 w-full max-w-md">
                      <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center shadow-md flex-shrink-0 ring-2 ring-orange-400/30">
                        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
                          <path d="M12 2v4m0 12v4M2 12h4m12 0h4" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        {pendingAction.type === 'create_job' && isJobProposal(pendingAction.data) && (
                          <JobPreviewCard
                            proposal={pendingAction.data}
                            onConfirm={handleConfirmJob}
                            onCancel={handleCancelPendingAction}
                            isSubmitting={isConfirming}
                          />
                        )}
                        {pendingAction.type === 'generate_quote' && isQuoteProposal(pendingAction.data) && (
                          <QuotePreviewCard
                            proposal={pendingAction.data}
                            onConfirm={handleConfirmQuote}
                            onCancel={handleCancelPendingAction}
                            isSubmitting={isConfirming}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {isSending && (
                  <div className="flex justify-start">
                    <div className="flex gap-3 items-center">
                      <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center shadow-md ring-2 ring-orange-400/30 animate-pulse">
                        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
                          <path d="M12 2v4m0 12v4M2 12h4m12 0h4" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="typing-indicator">
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        {messages.length <= 1 && !isSending && (
          <div className="px-3 sm:px-4 pb-2">
            <div className="max-w-3xl mx-auto flex flex-wrap gap-1.5 sm:gap-2 justify-center">
              {quickActionsLoading ? (
                // Loading skeleton for quick actions
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-slate-100 dark:bg-slate-700 rounded-full animate-pulse w-24 sm:w-32 h-6 sm:h-7"
                    />
                  ))}
                </>
              ) : (
                quickActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleQuickAction(action.prompt)}
                    className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-orange-50 dark:hover:bg-orange-900/30 hover:text-orange-700 dark:hover:text-orange-300 text-slate-600 dark:text-slate-300 text-xs sm:text-sm rounded-full transition-colors"
                  >
                    {action.label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-3 sm:p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <div className="max-w-3xl mx-auto">
            {attachmentUrl && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-[var(--color-text-muted)]">Attached: {attachmentName}</span>
                <button
                  type="button"
                  onClick={() => { setAttachmentUrl(null); setAttachmentName(null) }}
                  className="text-[var(--color-text-faint)] hover:text-red-500 text-xs"
                >
                  Remove
                </button>
              </div>
            )}
            <div className="chat-input-wrapper">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.csv,.txt,.xlsx,.xls"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSending || isUploading}
                className="p-2 text-[var(--color-text-faint)] hover:text-orange-500 rounded-lg transition-colors flex-shrink-0"
                title="Attach file (image, PDF, CSV)"
              >
                {isUploading ? (
                  <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a2 2 0 00-2.828-2.828l-6.586 6.586a4 4 0 105.656 5.656l6.414-6.414a2 2 0 000-2.828l-2.828-2.828a2 2 0 00-2.828 0l-6.414 6.414a4 4 0 01-5.656-5.656l6.414-6.414" />
                  </svg>
                )}
              </button>
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask Dyia anything..."
                className="chat-input text-sm sm:text-base"
                rows={1}
                disabled={isSending}
              />
              <button
                onClick={() => handleSend()}
                disabled={(!inputValue.trim() && !attachmentUrl) || isSending}
                className="chat-send-btn"
                title="Send message"
              >
                {isSending ? (
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-[10px] sm:text-xs text-[var(--color-text-faint)] mt-1.5 sm:mt-2 text-center hidden sm:block">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
