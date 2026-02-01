'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageBubble } from './MessageBubble'
import { ThreadList } from './ThreadList'

interface AssistantProps {
  userId: string
  showSuccess: (message: string) => void
}

export interface ToolResult {
  success: boolean
  message: string
  data?: Record<string, unknown>
  type?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  toolResults?: ToolResult[]
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
  content: `Hey! 👋 I'm your Dyia Assistant. I can actually **do things** for you, not just chat.

**Try saying:**
• "Log a job for John Smith, $450 from a garage cleanout"
• "How did I do this week?"
• "Create a quote for a basement cleanout, $300-400"
• "What should I charge for a hot tub removal?"
• "Show me my follow-ups"
• "Give me a business summary for this month"

What can I help with?`,
  timestamp: new Date(),
}

const QUICK_ACTIONS = [
  { label: '📊 This week\'s stats', prompt: 'How did I do this week?' },
  { label: '📍 Pending follow-ups', prompt: 'Show me pending follow-ups' },
  { label: '💰 Suggest a price', prompt: 'What should I charge for a full truck load?' },
  { label: '📋 Monthly summary', prompt: 'Give me a business summary for this month' },
]

export function Assistant({ userId, showSuccess }: AssistantProps) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [showThreads, setShowThreads] = useState(false)
  const [lastResponseId, setLastResponseId] = useState<string | null>(null) // For stateful conversation
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
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

  const handleSend = async (customMessage?: string) => {
    const content = (customMessage || inputValue).trim()
    if (!content || isSending) return

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

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          conversationId: currentThreadId,
          previousResponseId: lastResponseId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message')
      }

      // Update thread ID if new conversation
      if (data.threadId && !currentThreadId) {
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

      // Add assistant response
      const assistantMessage: Message = {
        id: data.messageId || `resp-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        toolResults: data.toolResults,
      }
      setMessages(prev => [...prev, assistantMessage])

      // Show success if action was taken
      if (data.toolResults?.some((r: ToolResult) => r.success)) {
        const successActions = data.toolResults.filter((r: ToolResult) => r.success)
        if (successActions.length === 1) {
          showSuccess('Action completed!')
        } else {
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
            <span className="text-base sm:text-lg">✨</span>
            <span className="font-medium text-[var(--color-text-primary)] text-xs sm:text-sm">Dyia Assistant</span>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isSending ? 'bg-orange-500 animate-pulse' : 'bg-green-500'
            }`} />
            {isSending && (
              <span className="text-[10px] sm:text-xs text-[var(--color-text-faint)] truncate">Working...</span>
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

                {isSending && (
                  <div className="flex justify-start">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-orange-100 to-amber-100 rounded-lg flex items-center justify-center shadow-sm">
                        <span className="text-sm">✨</span>
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
              {QUICK_ACTIONS.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickAction(action.prompt)}
                  className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-orange-50 dark:hover:bg-orange-900/30 hover:text-orange-700 dark:hover:text-orange-300 text-slate-600 dark:text-slate-300 text-xs sm:text-sm rounded-full transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="p-3 sm:p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <div className="max-w-3xl mx-auto">
            <div className="chat-input-wrapper">
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
                disabled={!inputValue.trim() || isSending}
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
