'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { GripVertical, Phone, ClipboardCopy, Clock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type FollowUpStatus = 'pending' | 'contacted' | 'converted' | 'lost' | 'snoozed'
type FollowUpPriority = 'hot' | 'warm' | 'cold'

export interface KanbanFollowUp {
  id: string
  quoteId: string
  customerName: string
  phone?: string
  jobDescription?: string
  estimateLow: number
  estimateHigh: number
  status: FollowUpStatus
  priority: FollowUpPriority
  daysSinceQuote: number
  contactCount: number
  notes?: string | null
  nextFollowUpAt?: string | null
}

export interface KanbanColumn {
  id: FollowUpStatus
  title: string
  items: KanbanFollowUp[]
  color: string
}

interface KanbanBoardProps {
  columns: KanbanColumn[]
  onStatusChange: (item: KanbanFollowUp, newStatus: FollowUpStatus) => void
  onCopyMessage: (item: KanbanFollowUp) => void
}

const PRIORITY_STYLES: Record<FollowUpPriority, { label: string; className: string }> = {
  hot: { label: 'Hot 🔥', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800' },
  warm: { label: 'Warm 🌡️', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  cold: { label: 'Cold ❄️', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
}

export default function KanbanBoard({ columns, onStatusChange, onCopyMessage }: KanbanBoardProps) {
  const handleDragStart = (e: React.DragEvent, item: KanbanFollowUp, columnId: string) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ item, sourceColumnId: columnId }))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, targetColumnId: FollowUpStatus) => {
    e.preventDefault()
    const data = JSON.parse(e.dataTransfer.getData('text/plain'))
    const { item, sourceColumnId } = data as { item: KanbanFollowUp; sourceColumnId: string }

    if (sourceColumnId === targetColumnId) return

    onStatusChange(item, targetColumnId)
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {columns.map((column) => (
          <div
            key={column.id}
            className="app-card p-4 sm:p-5 min-h-[200px]"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full" style={{ backgroundColor: column.color }} />
                <h3 className="font-semibold text-sm sm:text-base text-[var(--color-text-primary)]">
                  {column.title}
                </h3>
                <span className="badge badge-info text-[10px] sm:text-xs">
                  {column.items.length}
                </span>
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {column.items.length === 0 && (
                <div className="text-center py-6 sm:py-8 text-[var(--color-text-faint)] text-xs sm:text-sm">
                  Drop follow-ups here
                </div>
              )}
              {column.items.map((item) => {
                const priorityStyle = PRIORITY_STYLES[item.priority]
                return (
                  <Card
                    key={item.id || item.quoteId}
                    className="cursor-move transition-all duration-200 border border-[var(--color-border)] bg-[var(--color-bg-card)] hover:shadow-md hover:border-[var(--color-border-hover)]"
                    draggable
                    onDragStart={(e) => handleDragStart(e, item, column.id)}
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="space-y-2 sm:space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-sm sm:text-base text-[var(--color-text-primary)] leading-tight">
                            {item.customerName}
                          </h4>
                          <GripVertical className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--color-text-faint)] cursor-move flex-shrink-0" />
                        </div>

                        {item.jobDescription && (
                          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] leading-relaxed line-clamp-2">
                            {item.jobDescription}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-1.5">
                          <Badge className={`text-[10px] sm:text-xs ${priorityStyle.className}`}>
                            {priorityStyle.label}
                          </Badge>
                        </div>

                        <div className="text-xs sm:text-sm font-semibold text-orange-600 dark:text-orange-400">
                          {formatCurrency(item.estimateLow)} - {formatCurrency(item.estimateHigh)}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
                          <div className="flex items-center gap-3 text-[var(--color-text-faint)]">
                            <div className="flex items-center gap-1" title={`${item.daysSinceQuote} days since quote`}>
                              <Clock className="w-3.5 h-3.5" />
                              <span className="text-[10px] sm:text-xs font-medium">{item.daysSinceQuote}d</span>
                            </div>
                            {item.contactCount > 0 && (
                              <div className="flex items-center gap-1" title={`Contacted ${item.contactCount} times`}>
                                <Phone className="w-3.5 h-3.5" />
                                <span className="text-[10px] sm:text-xs font-medium">{item.contactCount}</span>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={(e) => { e.stopPropagation(); onCopyMessage(item) }}
                            className="p-1 rounded hover:bg-[var(--color-bg-hover)] transition-colors"
                            title="Copy follow-up message"
                          >
                            <ClipboardCopy className="w-3.5 h-3.5 text-[var(--color-text-faint)]" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
