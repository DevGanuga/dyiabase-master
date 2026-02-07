'use client'

import { useMemo } from 'react'
import type { Message } from './Assistant'
import { ToolResultCard } from './ToolResultCard'

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
        {isUser ? (
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-md bg-gradient-to-br from-orange-500 to-amber-500 text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        ) : (
          <img src="/dyia-agent.png" alt="Dyia AI" className="w-8 h-8 rounded-full flex-shrink-0 shadow-md ring-2 ring-orange-400/30 object-cover" />
        )}

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
