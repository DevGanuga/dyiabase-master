'use client'

import ReactMarkdown from 'react-markdown'
import type { ToolResult } from './Assistant'

interface ToolResultCardProps {
  result: ToolResult
}

// Detect result type from data keys
function getResultType(data?: Record<string, unknown>): 'stats' | 'followups' | 'pricing' | 'job' | 'quote' | 'expense' | 'summary' | 'generic' {
  if (!data) return 'generic'
  if ('totalRevenue' in data || 'jobCount' in data) return 'stats'
  if ('followUps' in data || 'hotFollowUps' in data) return 'followups'
  if ('suggestedLow' in data || 'suggestedHigh' in data) return 'pricing'
  if ('jobId' in data && 'profit' in data) return 'job'
  if ('quoteId' in data) return 'quote'
  if ('expenseId' in data) return 'expense'
  if ('topSources' in data || 'monthlyRevenue' in data) return 'summary'
  return 'generic'
}

function formatMoney(n: unknown): string {
  const num = typeof n === 'number' ? n : parseFloat(String(n)) || 0
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ── Stats Card ──
function StatsResult({ data }: { data: Record<string, unknown> }) {
  const items = [
    { label: 'Revenue', value: formatMoney(data.totalRevenue), color: 'text-green-600 dark:text-green-400' },
    { label: 'Profit', value: formatMoney(data.totalProfit ?? data.netProfit), color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Jobs', value: String(data.jobCount || 0), color: 'text-blue-600 dark:text-blue-400' },
    ...(data.avgJobRevenue ? [{ label: 'Avg/Job', value: formatMoney(data.avgJobRevenue), color: 'text-purple-600 dark:text-purple-400' }] : []),
  ].filter(i => i.value !== '$0' || i.label === 'Jobs')

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(item => (
        <div key={item.label} className="bg-white/60 dark:bg-slate-800/40 rounded-lg p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] font-medium">{item.label}</p>
          <p className={`text-base font-bold ${item.color}`}>{item.value}</p>
        </div>
      ))}
    </div>
  )
}

// ── Follow-ups Card ──
function FollowUpsResult({ data }: { data: Record<string, unknown> }) {
  const followUps = (data.followUps || data.items || []) as Array<Record<string, unknown>>
  const hot = (data.hotFollowUps || data.hot || 0) as number

  return (
    <div>
      {hot > 0 && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-semibold text-red-600 dark:text-red-400">{hot} hot — needs attention now</span>
        </div>
      )}
      {followUps.length > 0 ? (
        <div className="space-y-1.5">
          {followUps.slice(0, 5).map((fu, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/40 rounded-lg px-2.5 py-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                fu.priority === 'hot' ? 'bg-red-500' : fu.priority === 'warm' ? 'bg-amber-500' : 'bg-blue-400'
              }`} />
              <span className="text-xs font-medium text-[var(--color-text-primary)] truncate flex-1">{String(fu.customerName || fu.customer || 'Customer')}</span>
              <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">{fu.estimate ? formatMoney(fu.estimate) : ''}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--color-text-muted)]">No pending follow-ups.</p>
      )}
    </div>
  )
}

// ── Pricing Card ──
function PricingResult({ data }: { data: Record<string, unknown> }) {
  const low = data.suggestedLow as number || 0
  const high = data.suggestedHigh as number || 0
  const confidence = data.confidence as string || ''
  const similar = (data.similarJobs || data.basedOn || 0) as number

  return (
    <div className="text-center">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] font-medium mb-1">Suggested price range</p>
      <p className="text-2xl font-bold text-[var(--color-text-primary)]">
        {formatMoney(low)} – {formatMoney(high)}
      </p>
      <div className="flex items-center justify-center gap-3 mt-2">
        {confidence && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            confidence === 'high' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            : confidence === 'medium' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}>
            {confidence} confidence
          </span>
        )}
        {similar > 0 && (
          <span className="text-[10px] text-[var(--color-text-muted)]">Based on {similar} similar jobs</span>
        )}
      </div>
    </div>
  )
}

// ── Job Saved Card ──
function JobResult({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{String(data.customer || 'Job saved')}</p>
        <div className="flex items-center gap-3 mt-0.5">
          {data.revenue != null && <span className="text-xs text-green-600 dark:text-green-400 font-medium">{formatMoney(data.revenue)} revenue</span>}
          {data.profit != null && <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{formatMoney(data.profit)} profit</span>}
        </div>
      </div>
    </div>
  )
}

export function ToolResultCard({ result }: ToolResultCardProps) {
  const resultType = getResultType(result.data)

  // Error state
  if (!result.success) {
    return (
      <div className="rounded-xl border border-red-200/50 dark:border-red-800/30 bg-red-50/50 dark:bg-red-950/10 p-3">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-red-600 dark:text-red-400">{result.message || 'Something went wrong'}</p>
        </div>
      </div>
    )
  }

  // Specialized cards for data-rich results
  if (result.data) {
    if (resultType === 'stats') return <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3"><StatsResult data={result.data} /></div>
    if (resultType === 'followups') return <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3"><FollowUpsResult data={result.data} /></div>
    if (resultType === 'pricing') return <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3"><PricingResult data={result.data} /></div>
    if (resultType === 'job') return <div className="rounded-xl border border-green-200/50 dark:border-green-800/30 bg-green-50/50 dark:bg-green-950/10 p-3"><JobResult data={result.data} /></div>
    if (resultType === 'quote') {
      return (
        <div className="rounded-xl border border-blue-200/50 dark:border-blue-800/30 bg-blue-50/50 dark:bg-blue-950/10 p-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Quote created for {String(result.data.customer || 'customer')}</p>
          </div>
        </div>
      )
    }
    if (resultType === 'expense') {
      return (
        <div className="rounded-xl border border-amber-200/50 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-950/10 p-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Expense logged</p>
          </div>
        </div>
      )
    }
  }

  // Generic fallback with markdown
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
      <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed dyia-markdown">
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold text-[var(--color-text-primary)]">{children}</strong>,
            ul: ({ children }) => <ul className="space-y-0.5 mb-1">{children}</ul>,
            li: ({ children }) => (
              <li className="flex items-start gap-1.5">
                <span className="text-orange-500 mt-1 shrink-0 text-[7px]">●</span>
                <span className="flex-1">{children}</span>
              </li>
            ),
          }}
        >
          {result.message}
        </ReactMarkdown>
      </div>
    </div>
  )
}
