'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'
import { GripVertical, Phone, ClipboardCopy, Clock, Plus, ChevronDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type FollowUpStatus = 'pending' | 'contacted' | 'converted' | 'lost' | 'snoozed'
type FollowUpPriority = 'hot' | 'warm' | 'cold'

export interface KanbanFollowUp {
  id: string
  quoteId: string
  customerName: string
  phone?: string
  email?: string
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
  onConvert?: (item: KanbanFollowUp) => void
}

const PRIORITY_STYLES: Record<FollowUpPriority, { label: string; className: string }> = {
  hot: { label: 'Hot 🔥', className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800' },
  warm: { label: 'Warm 🌡️', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  cold: { label: 'Cold ❄️', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
}

export default function KanbanBoard({ columns, onStatusChange, onCopyMessage, onConvert }: KanbanBoardProps) {
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

                        {/* Contact Actions */}
                        {(item.phone || item.email) && (
                          <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
                            {item.phone && (
                              <a
                                href={`tel:${item.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] sm:text-xs font-medium rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                                title={`Call ${item.phone}`}
                              >
                                <Phone className="w-3 h-3" />
                                Call
                              </a>
                            )}
                            {item.phone && (
                              <a
                                href={`sms:${item.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] sm:text-xs font-medium rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                title={`Text ${item.phone}`}
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                Text
                              </a>
                            )}
                          </div>
                        )}

                        {/* Status + Actions row */}
                        <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
                          <div className="flex items-center gap-2">
                            {/* Mobile-friendly status change dropdown */}
                            <select
                              value={item.status}
                              onChange={(e) => {
                                e.stopPropagation()
                                const newStatus = e.target.value as FollowUpStatus
                                if (newStatus !== item.status) {
                                  onStatusChange(item, newStatus)
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] sm:text-xs font-medium bg-[var(--color-bg-subtle,#f8fafc)] border border-[var(--color-border)] rounded-md px-1.5 py-1 text-[var(--color-text-secondary)] appearance-none cursor-pointer pr-5 min-h-[28px]"
                              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%239ca3af\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center' }}
                            >
                              <option value="pending">Pending</option>
                              <option value="contacted">Contacted</option>
                              <option value="snoozed">Snoozed</option>
                              <option value="converted">Converted</option>
                              <option value="lost">Lost</option>
                            </select>

                            <div className="flex items-center gap-1.5 text-[var(--color-text-faint)]">
                              <span className="text-[10px] sm:text-xs font-medium">{item.daysSinceQuote}d</span>
                              {item.contactCount > 0 && (
                                <span className="text-[10px] sm:text-xs font-medium flex items-center gap-0.5">
                                  <Phone className="w-3 h-3" />{item.contactCount}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {onConvert && item.status !== 'converted' && item.status !== 'lost' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onConvert(item) }}
                                className="p-1.5 rounded hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                                title="Convert to job"
                              >
                                <Plus className="w-4 h-4 text-green-600 dark:text-green-400" />
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); onCopyMessage(item) }}
                              className="p-1.5 rounded hover:bg-[var(--color-bg-hover)] transition-colors"
                              title="Copy follow-up message"
                            >
                              <ClipboardCopy className="w-4 h-4 text-[var(--color-text-faint)]" />
                            </button>
                          </div>
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
