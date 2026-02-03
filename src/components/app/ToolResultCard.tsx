'use client'

import { useMemo } from 'react'
import type { ToolResult } from './Assistant'

interface ToolResultCardProps {
  result: ToolResult
}

// Parse markdown to rendered HTML
function parseMarkdown(text: string): string {
  return text
    // Headers (## and ###)
    .replace(/^### (.+)$/gm, '<h4 class="font-semibold text-[var(--color-text-primary)] mt-3 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="font-semibold text-[var(--color-text-primary)] text-lg mt-3 mb-2">$1</h3>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-[var(--color-text-primary)]">$1</strong>')
    // Bullet points
    .replace(/^[•\-] (.+)$/gm, '<div class="flex gap-2 ml-1"><span class="text-[var(--color-text-muted)]">•</span><span>$1</span></div>')
    // Line breaks (but not double for spacing)
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br />')
}

export function ToolResultCard({ result }: ToolResultCardProps) {
  const parsedMessage = useMemo(() => parseMarkdown(result.message), [result.message])
  
  return (
    <div className={`rounded-xl overflow-hidden ${
      result.success 
        ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200/50 dark:border-green-800/30' 
        : 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border border-red-200/50 dark:border-red-800/30'
    }`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Status Icon */}
          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
            result.success
              ? 'bg-green-500 text-white'
              : 'bg-red-500 text-white'
          }`}>
            {result.success ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div 
              className="text-sm text-[var(--color-text-secondary)] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: parsedMessage }}
            />

            {/* Action badges */}
            {result.success && result.data && (
              <div className="mt-3 flex flex-wrap gap-2">
                {result.data && 'jobId' in result.data && result.data.jobId != null && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/60 dark:bg-slate-800/60 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 shadow-sm">
                    📋 Job #{String(result.data.jobId).slice(0, 8)}
                  </span>
                )}
                {result.data && 'quoteId' in result.data && result.data.quoteId != null && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/60 dark:bg-slate-800/60 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 shadow-sm">
                    📝 Quote #{String(result.data.quoteId).slice(0, 8)}
                  </span>
                )}
                {result.data && 'expenseId' in result.data && result.data.expenseId != null && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/60 dark:bg-slate-800/60 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 shadow-sm">
                    💸 Expense added
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
