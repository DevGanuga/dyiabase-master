'use client'

import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Message } from './Assistant'
import { ToolResultCard } from './ToolResultCard'

interface MessageBubbleProps {
  message: Message
  isLatest: boolean
}

export function MessageBubble({ message, isLatest }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const formattedTime = useMemo(() => {
    return message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [message.timestamp])

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''} max-w-[85%] sm:max-w-[80%]`}>
        {/* Avatar */}
        {isUser ? (
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-sm mt-0.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden mt-0.5">
            <img src="/dyia-agent.png" alt="" className="w-7 h-7 object-cover rounded-full" />
          </div>
        )}

        {/* Content */}
        <div className={`message-bubble ${isUser ? 'user' : 'assistant'} ${isLatest ? 'message-bubble-enter' : ''}`}>
          {/* Attachment preview */}
          {message.attachmentUrl && message.attachmentFileType === 'image' && (
            <div className="mb-2 -mx-1">
              <img
                src={message.attachmentUrl}
                alt={message.attachmentName || 'Attached image'}
                className="rounded-lg max-h-48 max-w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(message.attachmentUrl, '_blank')}
              />
            </div>
          )}
          {message.attachmentUrl && message.attachmentFileType && message.attachmentFileType !== 'image' && (
            <div className="mb-2 flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-white/10 rounded text-[11px]">
                <svg className="w-3 h-3 shrink-0 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="truncate max-w-[180px] opacity-80">{message.attachmentName}</span>
              </div>
            </div>
          )}
          {isUser ? (
            <div className="whitespace-pre-wrap">{message.content}</div>
          ) : (
            // Assistant messages: render markdown properly
            <div className="dyia-markdown">
              <ReactMarkdown
                components={{
                  // Headings
                  h1: ({ children }) => (
                    <h3 className="text-base font-bold text-[var(--color-text-primary)] mt-3 mb-1.5 first:mt-0">{children}</h3>
                  ),
                  h2: ({ children }) => (
                    <h4 className="text-sm font-bold text-[var(--color-text-primary)] mt-2.5 mb-1 first:mt-0">{children}</h4>
                  ),
                  h3: ({ children }) => (
                    <h5 className="text-sm font-semibold text-[var(--color-text-primary)] mt-2 mb-1 first:mt-0">{children}</h5>
                  ),
                  // Paragraphs
                  p: ({ children }) => (
                    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                  ),
                  // Bold
                  strong: ({ children }) => (
                    <strong className="font-semibold text-[var(--color-text-primary)]">{children}</strong>
                  ),
                  // Lists
                  ul: ({ children }) => (
                    <ul className="mb-2 last:mb-0 space-y-1">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="mb-2 last:mb-0 space-y-1 list-decimal list-inside">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="flex items-start gap-1.5">
                      <span className="text-orange-500 mt-1.5 shrink-0 text-[8px]">●</span>
                      <span className="flex-1">{children}</span>
                    </li>
                  ),
                  // Code
                  code: ({ children, className }) => {
                    const isBlock = className?.includes('language-')
                    if (isBlock) {
                      return (
                        <code className="block bg-slate-800 text-slate-200 dark:bg-slate-900 rounded-lg p-3 text-xs font-mono overflow-x-auto my-2">
                          {children}
                        </code>
                      )
                    }
                    return (
                      <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs font-mono">
                        {children}
                      </code>
                    )
                  },
                  pre: ({ children }) => (
                    <pre className="my-2 last:my-0">{children}</pre>
                  ),
                  // Links
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-orange-600 dark:text-orange-400 underline underline-offset-2 hover:text-orange-700 dark:hover:text-orange-300">
                      {children}
                    </a>
                  ),
                  // Horizontal rule
                  hr: () => (
                    <hr className="my-3 border-[var(--color-border)]" />
                  ),
                  // Blockquote
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-orange-300 dark:border-orange-700 pl-3 my-2 text-[var(--color-text-muted)] italic">
                      {children}
                    </blockquote>
                  ),
                  // Table
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="w-full text-xs border-collapse">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="bg-slate-50 dark:bg-slate-800">{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th className="px-2 py-1.5 text-left font-semibold border-b border-[var(--color-border)] text-[var(--color-text-primary)]">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="px-2 py-1.5 border-b border-[var(--color-border-light,var(--color-border))]">{children}</td>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
          
          {/* Tool Results */}
          {message.toolResults && message.toolResults.length > 0 && (
            <div className="mt-3 space-y-2">
              {message.toolResults.map((result, idx) => (
                <ToolResultCard key={idx} result={result} />
              ))}
            </div>
          )}
          
          {/* Timestamp */}
          <div className={`mt-1.5 text-[10px] opacity-60 ${isUser ? 'text-orange-100 text-right' : 'text-[var(--color-text-faint)]'}`}>
            {formattedTime}
          </div>
        </div>
      </div>
    </div>
  )
}
