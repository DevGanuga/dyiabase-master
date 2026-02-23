'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
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
  hasPendingAction?: boolean
  attachmentUrl?: string
  attachmentName?: string
  attachmentFileType?: string
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
  const [attachmentFileType, setAttachmentFileType] = useState<string | null>(null)
  const [attachmentContent, setAttachmentContent] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [supportsVoice, setSupportsVoice] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const dragCounterRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const skipThreadLoadRef = useRef(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  // Detect voice support on client
  useEffect(() => {
    setSupportsVoice('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  }, [])

  // Auto-focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300)
  }, [])

  // Auto-clear voice errors
  useEffect(() => {
    if (voiceError) {
      const timer = setTimeout(() => setVoiceError(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [voiceError])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Track scroll position to show "scroll to bottom" button
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollBtn(distFromBottom > 150)
  }, [])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

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

  const handleDeleteThread = useCallback(async (threadId: string) => {
    try {
      const response = await fetch(`/api/threads/${threadId}`, { method: 'DELETE' })
      if (response.ok) {
        setThreads(prev => prev.filter(t => t.id !== threadId))
        if (currentThreadId === threadId) {
          setCurrentThreadId(null)
          setMessages([WELCOME_MESSAGE])
          setLastResponseId(null)
        }
      }
    } catch (error) {
      console.error('Error deleting thread:', error)
    }
  }, [currentThreadId])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    processFile(file)
  }

  const processFile = async (file: File) => {
    if (isUploading) return
    setIsUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/ai/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setAttachmentUrl(data.url)
      setAttachmentName(data.fileName || file.name)
      setAttachmentFileType(data.fileType || null)
      setAttachmentContent(data.extractedContent || null)
    } catch (err) {
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

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragOver(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const toggleVoice = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognitionCtor) {
      setVoiceError('Voice input is not supported in this browser. Try Chrome or Edge.')
      return
    }

    try {
      const recognition = new SpeechRecognitionCtor()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-US'

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results as ArrayLike<{ 0: { transcript: string } }>)
          .map((r: { 0: { transcript: string } }) => r[0].transcript)
          .join('')
        setInputValue(transcript)
        if (inputRef.current) {
          inputRef.current.style.height = 'auto'
          inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`
        }
      }

      recognition.onend = () => {
        setIsListening(false)
        setTimeout(() => inputRef.current?.focus(), 100)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        setIsListening(false)
        const errMap: Record<string, string> = {
          'not-allowed': 'Microphone access denied. Please allow mic access in browser settings.',
          'no-speech': "Didn't catch that. Tap the mic and try again.",
          'network': 'Network error. Check your connection and try again.',
        }
        if (event.error !== 'aborted') {
          setVoiceError(errMap[event.error] || 'Voice input error. Please try again.')
        }
      }

      recognitionRef.current = recognition
      recognition.start()
      setIsListening(true)
      setVoiceError(null)
    } catch {
      setVoiceError('Could not start voice input. Please check microphone permissions.')
    }
  }, [isListening])

  const handleSend = async (customMessage?: string) => {
    const content = (customMessage || inputValue).trim()
    if ((!content && !attachmentUrl) || isSending) return

    // Add user message immediately
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
      ...(attachmentUrl && {
        attachmentUrl,
        attachmentName: attachmentName || undefined,
        attachmentFileType: attachmentFileType || undefined,
      }),
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
    const fileTypeToSend = attachmentFileType
    const contentToSend = attachmentContent
    if (attachmentUrl) {
      setAttachmentUrl(null)
      setAttachmentName(null)
      setAttachmentFileType(null)
      setAttachmentContent(null)
    }

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content || '(see attached file)',
          conversationId: currentThreadId,
          previousResponseId: lastResponseId,
          ...(urlToSend && {
            fileUrl: urlToSend,
            fileName: nameToSend || 'file',
            fileType: fileTypeToSend,
            ...(contentToSend && { extractedContent: contentToSend }),
          }),
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
            customer_id: jobData.customerId || undefined,
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
            customer_id: quoteData.customerId || undefined,
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
          <div className="sidebar-header">
            <button
              onClick={handleNewConversation}
              className="sidebar-new-chat-btn"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New chat
            </button>
            <button
              onClick={() => setShowThreads(false)}
              className="chat-header-btn sm:hidden"
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
            onDelete={handleDeleteThread}
          />
        </div>
      </div>

      {/* Main Chat Area */}
      <div
        className="flex-1 flex flex-col min-w-0 h-full relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drop zone overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-orange-400 bg-orange-500/10">
              <div className="w-14 h-14 rounded-full bg-orange-500/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-white font-semibold text-base">Drop file here</p>
                <p className="text-slate-400 text-sm mt-1">Images, PDFs, CSV, Excel, or text files</p>
              </div>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="chat-header">
          <button
            onClick={() => setShowThreads(!showThreads)}
            className="chat-header-btn"
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
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative">
              <img src="/dyia-agent.png" alt="Dyia AI" className="w-8 h-8 rounded-full shadow-sm object-cover" />
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--color-bg-card)] ${
                isSending ? 'bg-orange-500 animate-pulse' : 'bg-emerald-500'
              }`} />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-[var(--color-text-primary)] text-sm leading-tight">Dyia</span>
              <span className="text-[10px] text-[var(--color-text-faint)] leading-tight">
                {isSending ? 'Thinking...' : 'Online'}
              </span>
            </div>
          </div>
          <button
            onClick={handleNewConversation}
            className="chat-header-btn"
            title="New conversation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto relative flex flex-col"
          onScroll={handleScroll}
        >
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="loading-spinner mx-auto mb-4" />
                <p className="text-sm text-[var(--color-text-muted)]">Loading conversation...</p>
              </div>
            </div>
          ) : messages.length <= 1 && !isSending ? (
            /* Welcome Screen */
            <div className="flex-1 flex flex-col items-center justify-center px-4 pb-4">
              <div className="flex flex-col items-center max-w-lg w-full">
                <div className="relative mb-5">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 dark:from-orange-500/20 dark:to-amber-500/20 p-2 shadow-lg shadow-orange-500/5">
                    <img src="/dyia-agent.png" alt="Dyia" className="w-full h-full object-contain rounded-xl" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-[3px] border-[var(--color-bg)]" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] mb-1">Hey! I&apos;m Dyia</h2>
                <p className="text-sm text-[var(--color-text-muted)] mb-8 text-center leading-relaxed max-w-xs">
                  Your AI business partner. I log jobs, create quotes, track profits, and more.
                </p>

                <div className="grid grid-cols-2 gap-2.5 sm:gap-3 w-full max-w-sm">
                  {quickActionsLoading ? (
                    [1, 2, 3, 4].map((i) => (
                      <div key={i} className="quick-action-card animate-pulse">
                        <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 mb-2" />
                        <div className="w-20 h-3 rounded bg-slate-200 dark:bg-slate-700" />
                      </div>
                    ))
                  ) : (
                    quickActions.slice(0, 4).map((action) => (
                      <button
                        key={action.id}
                        onClick={() => handleQuickAction(action.prompt)}
                        className="quick-action-card group"
                      >
                        <span className="text-2xl mb-1.5 group-hover:scale-110 transition-transform duration-200">
                          {action.icon || '✨'}
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-[var(--color-text-secondary)] group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors leading-tight text-center">
                          {action.icon ? action.label.replace(action.icon, '').trim() : action.label}
                        </span>
                      </button>
                    ))
                  )}
                </div>

                <p className="text-[11px] text-[var(--color-text-faint)] mt-6 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.586 6.586a6 6 0 008.486 8.486l6.414-6.414" /></svg>
                  Drop files or use voice to get started
                </p>
              </div>
            </div>
          ) : (
            /* Messages */
            <div className="px-3 sm:px-4 py-4 sm:py-6">
              <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
                {messages.filter(m => m.id !== 'welcome').map((message, index, arr) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isLatest={index === arr.length - 1}
                  />
                ))}

                {pendingAction && pendingAction.status === 'pending' && (
                  <div className="flex justify-start">
                    <div className="flex gap-3 w-full max-w-md">
                      <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center shadow-md flex-shrink-0">
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
                      <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center shadow-md animate-pulse">
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
              </div>
            </div>
          )}

          {/* Scroll to bottom button */}
          {showScrollBtn && messages.length > 2 && (
            <button
              onClick={scrollToBottom}
              className="scroll-to-bottom-btn"
              title="Scroll to latest"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          )}
        </div>

        {/* Input Area */}
        <div className="chat-input-area">
          <div className="max-w-3xl mx-auto">
            {/* Voice error toast */}
            {voiceError && (
              <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 animate-in">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span>{voiceError}</span>
              </div>
            )}

            {/* Recording indicator */}
            {isListening && (
              <div className="recording-bar">
                <div className="recording-dot-pulse" />
                <span className="text-sm font-medium text-red-400">Listening...</span>
                <span className="flex-1 text-xs text-[var(--color-text-faint)] truncate">
                  {inputValue ? `"${inputValue}"` : 'Speak now'}
                </span>
                <button
                  onClick={toggleVoice}
                  className="px-3 py-1 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-full transition-colors"
                >
                  Stop
                </button>
              </div>
            )}

            {/* Attachment preview */}
            {attachmentUrl && (
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <svg className="w-3.5 h-3.5 text-orange-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.586 6.586a6 6 0 008.486 8.486l6.414-6.414" />
                  </svg>
                  <span className="text-xs text-orange-400 truncate max-w-[200px]">{attachmentName}</span>
                  <button
                    type="button"
                    onClick={() => { setAttachmentUrl(null); setAttachmentName(null); setAttachmentFileType(null); setAttachmentContent(null) }}
                    className="text-slate-400 hover:text-red-400 transition-colors ml-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Input */}
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
                className="chat-action-btn"
                title="Attach file"
              >
                {isUploading ? (
                  <div className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.586 6.586a6 6 0 008.486 8.486l6.414-6.414" />
                  </svg>
                )}
              </button>
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? 'Listening...' : 'Ask Dyia anything...'}
                className="chat-input"
                rows={1}
                disabled={isSending || isListening}
              />
              {/* Mic/Send toggle: show send when there's content, mic when empty */}
              {inputValue.trim() || attachmentUrl ? (
                <button
                  onClick={() => handleSend()}
                  disabled={isSending}
                  className="chat-send-btn"
                  title="Send message"
                >
                  {isSending ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  )}
                </button>
              ) : supportsVoice ? (
                <button
                  type="button"
                  onClick={toggleVoice}
                  disabled={isSending}
                  className={`chat-mic-btn ${isListening ? 'recording' : ''}`}
                  title={isListening ? 'Stop listening' : 'Voice input'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={() => handleSend()}
                  disabled={true}
                  className="chat-send-btn"
                  title="Type a message to send"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-[10px] text-[var(--color-text-faint)] mt-1.5 text-center hidden sm:block">
              Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
