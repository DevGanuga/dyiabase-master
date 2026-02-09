'use client'

import { useState, useRef, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageBubble } from './MessageBubble'
import { ThreadList } from './ThreadList'
import { JobPreviewCard } from './JobPreviewCard'
import { QuotePreviewCard } from './QuotePreviewCard'
import type { JobProposal, QuoteProposal, PendingAction } from '@/types/database'

interface AssistantProps {
  userId: string
  showSuccess: (message: string) => void
  /** When true, hides the inner header & thread sidebar (parent provides its own chrome) */
  embedded?: boolean
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
  content: `Hey! I'm **Dyia** — tell me what you need and I'll do it.\n\nTry: *"Log a job for Sarah, $450, Thumbtack lead"* or tap an action below.`,
  timestamp: new Date(),
}

// Default quick actions (fallback)
const DEFAULT_QUICK_ACTIONS = [
  { id: 'log-job', label: 'Log a job', prompt: 'I just finished a job and want to log it. Ask me for the customer name, revenue, date, and any expenses.', icon: 'briefcase' },
  { id: 'create-quote', label: 'Create a quote', prompt: 'I need to create a quote for a customer. Walk me through it.', icon: 'document' },
  { id: 'stats', label: "This week's stats", prompt: 'How did I do this week? Show me my job stats and revenue breakdown.', icon: 'chart' },
  { id: 'follow-ups', label: 'Check follow-ups', prompt: 'Show me my pending follow-ups. Which ones are highest priority?', icon: 'bell' },
  { id: 'pricing', label: 'Suggest a price', prompt: 'I have a job coming up. Based on my history, what should I charge?', icon: 'dollar' },
  { id: 'summary', label: 'Monthly summary', prompt: 'Give me a full summary of how my business is doing this month.', icon: 'chart' },
]

interface QuickAction {
  id: string
  label: string
  prompt: string
  icon?: string
}

export interface AssistantHandle {
  sendMessage: (msg: string) => void
}

export const Assistant = forwardRef<AssistantHandle, AssistantProps>(function Assistant({ userId, showSuccess, embedded = false }, ref) {
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
  
  // Pending action state for confirmations — restore from sessionStorage on mount
  const [pendingAction, setPendingActionRaw] = useState<PendingAction | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const stored = sessionStorage.getItem('dyia_pending_action')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })
  const [isConfirming, setIsConfirming] = useState(false)

  // Wrapper that also persists to sessionStorage
  const setPendingAction = useCallback((action: PendingAction | null) => {
    setPendingActionRaw(action)
    try {
      if (action) {
        sessionStorage.setItem('dyia_pending_action', JSON.stringify(action))
      } else {
        sessionStorage.removeItem('dyia_pending_action')
      }
    } catch { /* ignore storage errors */ }
  }, [])

  // File attachment for upload & extraction
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null)
  const [attachmentName, setAttachmentName] = useState<string | null>(null)
  const [attachmentContent, setAttachmentContent] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const handleSendRef = useRef<(msg?: string) => void>(() => {})
  const supabase = useMemo(() => createClient(), [])

  // Expose sendMessage to parent via ref
  useImperativeHandle(ref, () => ({
    sendMessage: (msg: string) => {
      handleSendRef.current(msg)
    }
  }), [])

  // Auto-scroll to bottom when messages change, but only if near the bottom already
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) {
      // Fallback: just scroll the sentinel into view
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    // Only auto-scroll if user is within 150px of the bottom (or it's a new message from the user)
    if (distanceFromBottom < 150) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isSending])

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

  // Load messages when thread changes
  useEffect(() => {
    const loadMessages = async () => {
      if (!currentThreadId) {
        setMessages([WELCOME_MESSAGE])
        setLastResponseId(null)
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
      setAttachmentContent(data.extractedContent || null)
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

    if (inputRef.current) inputRef.current.style.height = 'auto'

    const urlToSend = attachmentUrl
    const nameToSend = attachmentName
    const contentToSend = attachmentContent
    if (attachmentUrl) { setAttachmentUrl(null); setAttachmentName(null); setAttachmentContent(null) }

    // Create a placeholder assistant message that we'll stream into
    const assistantMsgId = `resp-${Date.now()}`
    const assistantMessage: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      toolResults: [],
    }
    setMessages(prev => [...prev, assistantMessage])

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content || '(see attached file)',
          conversationId: currentThreadId,
          previousResponseId: lastResponseId,
          ...(urlToSend && { fileUrl: urlToSend, fileName: nameToSend || 'file', fileContent: contentToSend }),
        }),
      })

      if (!response.ok) {
        // Non-streaming error (auth, credits, etc.)
        const errData = await response.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(errData.error || 'Failed to send message')
      }

      // ── Read SSE stream ──
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''
      let streamedText = ''
      const streamedToolResults: ToolResult[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE events from buffer
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          try {
            const event = JSON.parse(jsonStr)

            if (event.type === 'delta') {
              // Append text incrementally
              streamedText += event.text
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, content: streamedText } : m
              ))
            }

            if (event.type === 'tool_result') {
              // Add tool result to the message
              const result = event.result as ToolResult
              streamedToolResults.push(result)
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, toolResults: [...streamedToolResults] } : m
              ))

              // Handle pending actions from proposals
              if (result.pendingAction) {
                const action = result.pendingAction
                const pendingId = `pending-${Date.now()}`
                setPendingAction({
                  id: pendingId,
                  type: action.type,
                  data: action.proposal as JobProposal | QuoteProposal,
                  status: 'pending',
                  messageId: assistantMsgId,
                  createdAt: Date.now(),
                })
                // Persist (fire and forget)
                fetch('/api/pending-actions', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ actionType: action.type, proposalData: action.proposal, threadId: currentThreadId, originalMessage: content }),
                }).catch(err => console.error('Failed to save pending action:', err))
              } else if (result.success) {
                showSuccess('Action completed!')
              }
            }

            if (event.type === 'done') {
              // Finalize: update thread state
              if (event.threadId && !currentThreadId) {
                setCurrentThreadId(event.threadId)
                // Refresh thread list
                fetch('/api/threads').then(r => r.ok ? r.json() : null).then(data => {
                  if (data?.threads) {
                    setThreads(data.threads.map((t: { id: string; title: string; last_message_at: string }) => ({
                      id: t.id, title: t.title || 'New Conversation', lastMessageAt: new Date(t.last_message_at), preview: '',
                    })))
                  }
                }).catch(() => {})
              }
              if (event.responseId) setLastResponseId(event.responseId)

              // Mark message as final with hasPendingAction flag
              const hasPending = streamedToolResults.some(r => r.pendingAction)
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, hasPendingAction: hasPending } : m
              ))
            }

            if (event.type === 'error') {
              throw new Error(event.error || 'Stream error')
            }
          } catch (parseErr) {
            // Skip malformed SSE lines
            if (parseErr instanceof SyntaxError) continue
            throw parseErr
          }
        }
      }

      // If no text was streamed, set a fallback
      if (!streamedText) {
        setMessages(prev => prev.map(m =>
          m.id === assistantMsgId ? { ...m, content: 'I processed your request.' } : m
        ))
      }

    } catch (error) {
      console.error('Error sending message:', error)
      // Remove the empty placeholder and add error message
      setMessages(prev => [
        ...prev.filter(m => m.id !== assistantMsgId),
        {
          id: `error-${Date.now()}`,
          role: 'assistant' as const,
          content: `Sorry, I ran into an issue: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  // Keep ref in sync for parent to call sendMessage
  handleSendRef.current = handleSend

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

      // Update the thread ID if it changed
      if (result.threadId && !currentThreadId) {
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

      // Update the thread ID if it changed
      if (result.threadId && !currentThreadId) {
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

  // ─── Embedded mode: no header, no thread sidebar, tighter spacing ───
  if (embedded) {
    return (
      <div className="h-full flex flex-col bg-[var(--color-bg-page)]">
        {/* Toolbar */}
        <div className="px-3 py-2 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg-card)] shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowThreads(!showThreads)}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              title="Conversations"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
              </svg>
            </button>
            <button
              onClick={handleNewConversation}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              title="New conversation"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
            {isSending && (
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-[10px] text-orange-500 font-medium">thinking...</span>
              </div>
            )}
          </div>
        </div>

        {/* Thread list overlay */}
        {showThreads && (
          <div className="absolute inset-0 z-20 bg-[var(--color-bg-card)] flex flex-col" style={{ top: 0 }}>
            <div className="px-3 py-2 border-b border-[var(--color-border)] flex items-center justify-between shrink-0">
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">Conversations</span>
              <button
                onClick={() => setShowThreads(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ThreadList
                threads={threads}
                currentThreadId={currentThreadId}
                onSelect={(threadId) => { handleSelectThread(threadId); setShowThreads(false); }}
              />
            </div>
            <div className="p-3 border-t border-[var(--color-border)]">
              <button
                onClick={() => { handleNewConversation(); setShowThreads(false); }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-950/50 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New conversation
              </button>
            </div>
          </div>
        )}

        {/* Messages area */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-3 py-4 relative bg-[var(--color-bg-page)]">
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs text-[var(--color-text-muted)]">Loading...</p>
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
                  <div className="flex justify-start message-bubble-enter">
                    <div className="flex gap-2.5 w-full">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-orange-500/10 to-amber-500/10 dark:from-orange-500/20 dark:to-amber-500/20 mt-0.5">
                        <img src="/dyia-agent.png" alt="" className="w-5 h-5 object-contain" />
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
                    <div className="flex gap-2.5 items-center">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gradient-to-br from-orange-500/10 to-amber-500/10 dark:from-orange-500/20 dark:to-amber-500/20">
                        <img src="/dyia-agent.png" alt="" className="w-5 h-5 object-contain animate-pulse" />
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

        {/* Quick Actions (only on fresh conversation) */}
        {messages.length <= 1 && !isSending && (
          <div className="px-3 pb-2 shrink-0">
            <div className="grid grid-cols-2 gap-1.5">
              {quickActionsLoading ? (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-9 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                  ))}
                </>
              ) : (
                quickActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleQuickAction(action.prompt)}
                    className="flex items-center gap-2 px-3 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-orange-300 dark:hover:border-orange-700 text-[var(--color-text-secondary)] hover:text-orange-700 dark:hover:text-orange-400 text-xs font-medium rounded-lg transition-all text-left"
                  >
                    <span className="w-1 h-1 rounded-full bg-orange-400 shrink-0" />
                    {action.label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-bg-card)] shrink-0">
          {attachmentUrl && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-[var(--color-text-muted)]">
                Attached: {attachmentName}
                {attachmentContent && <span className="text-green-600 dark:text-green-400 ml-1">(content extracted)</span>}
              </span>
              <button type="button" onClick={() => { setAttachmentUrl(null); setAttachmentName(null); setAttachmentContent(null) }} className="text-[var(--color-text-faint)] hover:text-red-500 text-xs">Remove</button>
            </div>
          )}
          <div className="chat-input-wrapper">
            <input ref={fileInputRef} type="file" accept="image/*,.pdf,.csv,.txt,.xlsx,.xls" className="hidden" onChange={handleFileSelect} disabled={isUploading} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending || isUploading}
              className="p-1.5 text-[var(--color-text-faint)] hover:text-orange-500 rounded-lg transition-colors flex-shrink-0"
              title="Attach file"
            >
              {isUploading ? (
                <div className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="chat-input text-sm"
              rows={1}
              disabled={isSending}
            />
            <button
              onClick={() => handleSend()}
              disabled={(!inputValue.trim() && !attachmentUrl) || isSending}
              className="chat-send-btn !p-2"
              title="Send"
            >
              {isSending ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Full-page mode (non-embedded) ───
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
            <img src="/dyia-agent.png" alt="Dyia AI" className="w-8 h-8 sm:w-9 sm:h-9 object-contain" />
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
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
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
            <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-3 gap-2">
              {quickActionsLoading ? (
                <>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
                  ))}
                </>
              ) : (
                quickActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleQuickAction(action.prompt)}
                    className="flex items-center gap-2 px-3 py-2.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] hover:border-orange-300 dark:hover:border-orange-700 text-[var(--color-text-secondary)] hover:text-orange-700 dark:hover:text-orange-400 text-xs sm:text-sm font-medium rounded-lg transition-all text-left"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
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
                <span className="text-xs text-[var(--color-text-muted)]">
                  Attached: {attachmentName}
                  {attachmentContent && <span className="text-green-600 dark:text-green-400 ml-1">(content extracted)</span>}
                </span>
                <button
                  type="button"
                  onClick={() => { setAttachmentUrl(null); setAttachmentName(null); setAttachmentContent(null) }}
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
})
