'use client'

import type { Thread } from './Assistant'

interface ThreadListProps {
  threads: Thread[]
  currentThreadId: string | null
  onSelect: (threadId: string) => void
}

export function ThreadList({ threads, currentThreadId, onSelect }: ThreadListProps) {
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
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
          <span className="text-3xl">💬</span>
        </div>
        <h3 className="font-medium text-slate-900 mb-1">No conversations yet</h3>
        <p className="text-sm text-slate-500">
          Start a new chat to get help with your business
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
                className={`thread-item w-full ${
                  currentThreadId === thread.id ? 'active' : ''
                }`}
              >
                <div className="w-8 h-8 bg-gradient-to-br from-slate-100 to-slate-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">💬</span>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="thread-item-title">{thread.title}</p>
                  {thread.preview && (
                    <p className="thread-item-preview">{thread.preview}</p>
                  )}
                </div>
                <span className="thread-item-time flex-shrink-0">
                  {formatTime(thread.lastMessageAt)}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
