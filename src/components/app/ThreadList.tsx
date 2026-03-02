'use client'

import type { Thread } from './Assistant'

interface ThreadListProps {
  threads: Thread[]
  currentThreadId: string | null
  onSelect: (threadId: string) => void
  onDelete?: (threadId: string) => void
}

export function ThreadList({ threads, currentThreadId, onSelect, onDelete }: ThreadListProps) {
  // Group threads by date
  const groupThreadsByDate = (threads: Thread[]) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)

    const groups: { label: string; threads: Thread[] }[] = [
      { label: 'Today', threads: [] },
      { label: 'Yesterday', threads: [] },
      { label: 'This Week', threads: [] },
      { label: 'Older', threads: [] },
    ]

    threads.forEach(thread => {
      const date = thread.lastMessageAt
      const isToday = date.toDateString() === today.toDateString()
      const isYesterday = date.toDateString() === yesterday.toDateString()
      const isThisWeek = date >= weekAgo

      if (isToday) {
        groups[0].threads.push(thread)
      } else if (isYesterday) {
        groups[1].threads.push(thread)
      } else if (isThisWeek) {
        groups[2].threads.push(thread)
      } else {
        groups[3].threads.push(thread)
      }
    })

    return groups.filter(g => g.threads.length > 0)
  }

  const groupedThreads = groupThreadsByDate(threads)

  const formatTime = (date: Date) => {
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    }
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  if (threads.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 bg-[var(--color-bg-subtle)] rounded-xl flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-[var(--color-text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h3 className="font-medium text-[var(--color-text-primary)] text-sm mb-1">No conversations yet</h3>
        <p className="text-xs text-[var(--color-text-muted)]">
          Start chatting with Dyia
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-4">
      {groupedThreads.map((group) => (
        <div key={group.label}>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-3 mb-2">
            {group.label}
          </h4>
          <div className="space-y-1">
            {group.threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => onSelect(thread.id)}
                className={`thread-item w-full group ${
                  currentThreadId === thread.id ? 'active' : ''
                }`}
              >
                <div className="flex-1 min-w-0 text-left">
                  <p className="thread-item-title">{thread.title}</p>
                  {thread.preview && (
                    <p className="thread-item-preview">{thread.preview}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="thread-item-time group-hover:hidden">
                    {formatTime(thread.lastMessageAt)}
                  </span>
                  {onDelete && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(thread.id) }}
                      className="thread-delete-btn hidden group-hover:flex"
                      title="Delete conversation"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
