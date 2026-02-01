'use client'

import type { ToolResult } from './Assistant'

interface ToolResultCardProps {
  result: ToolResult
}

export function ToolResultCard({ result }: ToolResultCardProps) {
  return (
    <div className={`tool-result-card ${result.success ? 'success' : 'error'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          result.success
            ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
            : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
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
          <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-line">{result.message}</p>

          {/* Show created data summary */}
          {result.success && result.data && (
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <div className="flex flex-wrap gap-2">
                {result.data && 'jobId' in result.data && result.data.jobId != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-400">
                    <span>📋</span> Job #{String(result.data.jobId).slice(0, 8)}
                  </span>
                )}
                {result.data && 'quoteId' in result.data && result.data.quoteId != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-400">
                    <span>📝</span> Quote #{String(result.data.quoteId).slice(0, 8)}
                  </span>
                )}
                {result.data && 'expenseId' in result.data && result.data.expenseId != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-400">
                    <span>💸</span> Expense added
                  </span>
                )}
                {result.data && 'period' in result.data && result.data.period != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-xs">
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
