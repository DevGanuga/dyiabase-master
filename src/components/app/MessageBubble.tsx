'use client'

import { useMemo } from 'react'
import type { Message, ToolResult } from './Assistant'

interface MessageBubbleProps {
  message: Message
  isLatest: boolean
}

// Parse basic markdown to HTML (bold, bullet points, code)
function parseMarkdown(text: string): string {
  return text
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-sm">$1</code>')
    // Bullet points (at start of lines)
    .replace(/^• /gm, '<span class="mr-2">•</span>')
    // Line breaks
    .replace(/\n/g, '<br />')
}

function ToolResultCard({ result }: { result: ToolResult }) {
  return (
    <div className={`tool-result-card ${result.success ? 'success' : 'error'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          result.success 
            ? 'bg-green-100 text-green-600' 
            : 'bg-red-100 text-red-600'
        }`}>
          {result.success ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-600 whitespace-pre-line">{result.message}</p>
          
          {/* Show created data summary */}
          {result.success && result.data && (
            <div className="mt-2 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap gap-2">
                {result.data && 'jobId' in result.data && result.data.jobId != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                    <span>📋</span> Job #{String(result.data.jobId).slice(0, 8)}
                  </span>
                )}
                {result.data && 'quoteId' in result.data && result.data.quoteId != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                    <span>📝</span> Quote #{String(result.data.quoteId).slice(0, 8)}
                  </span>
                )}
                {result.data && 'expenseId' in result.data && result.data.expenseId != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                    <span>💸</span> Expense added
                  </span>
                )}
                {result.data && 'period' in result.data && result.data.period != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-700 rounded text-xs">
                    <span>📊</span> {String(result.data.period)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function MessageBubble({ message, isLatest }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const formattedTime = useMemo(() => {
    return message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [message.timestamp])

  const parsedContent = useMemo(() => parseMarkdown(message.content), [message.content])

  return (
    <div 
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      style={isLatest ? { animation: 'scaleIn 0.2s ease-out forwards' } : undefined}
    >
      <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} max-w-[85%]`}>
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ${
          isUser 
            ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white' 
            : 'bg-gradient-to-br from-orange-100 to-amber-100'
        }`}>
          {isUser ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ) : (
            <span className="text-sm">✨</span>
          )}
        </div>

        {/* Content */}
        <div className={`message-bubble ${isUser ? 'user' : 'assistant'}`}>
          <div 
            className="whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: parsedContent }}
          />
          
          {/* Tool Results */}
          {message.toolResults && message.toolResults.length > 0 && (
            <div className="mt-4 space-y-3">
              {message.toolResults.map((result, idx) => (
                <ToolResultCard key={idx} result={result} />
              ))}
            </div>
          )}
          
          {/* Timestamp */}
          <div className={`mt-2 text-[10px] ${isUser ? 'text-orange-100' : 'text-slate-400'}`}>
            {formattedTime}
          </div>
        </div>
      </div>
    </div>
  )
}
