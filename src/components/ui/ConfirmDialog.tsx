'use client'

import { useEffect, useRef } from 'react'

export type DialogVariant = 'danger' | 'default' | 'error' | 'warning' | 'info'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: DialogVariant
  alertOnly?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const variantStyles: Record<DialogVariant, { icon: string; buttonClass: string; iconBg: string }> = {
  danger: {
    icon: '⚠️',
    buttonClass: 'bg-red-500 hover:bg-red-600 text-white',
    iconBg: 'bg-red-50 dark:bg-red-900/30',
  },
  error: {
    icon: '❌',
    buttonClass: 'bg-red-500 hover:bg-red-600 text-white',
    iconBg: 'bg-red-50 dark:bg-red-900/30',
  },
  warning: {
    icon: '⚠️',
    buttonClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    iconBg: 'bg-amber-50 dark:bg-amber-900/30',
  },
  info: {
    icon: 'ℹ️',
    buttonClass: 'bg-orange-500 hover:bg-orange-600 text-white',
    iconBg: 'bg-blue-50 dark:bg-blue-900/30',
  },
  default: {
    icon: '❓',
    buttonClass: 'bg-orange-500 hover:bg-orange-600 text-white',
    iconBg: 'bg-orange-50 dark:bg-orange-900/30',
  },
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  alertOnly = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Focus the confirm button when opened
  useEffect(() => {
    if (open) {
      // Small delay to allow animation to start
      const timer = setTimeout(() => confirmRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Handle escape key
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  // Trap focus within dialog
  useEffect(() => {
    if (!open || !dialogRef.current) return
    const dialog = dialogRef.current
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    dialog.addEventListener('keydown', handleTab)
    return () => dialog.removeEventListener('keydown', handleTab)
  }, [open])

  if (!open) return null

  const styles = variantStyles[variant]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        style={{ animation: 'fadeIn 0.15s ease-out both' }}
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="relative w-full max-w-md bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden"
        style={{ animation: 'dialogSlideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) both' }}
      >
        <div className="p-6">
          {/* Icon */}
          <div className={`w-12 h-12 ${styles.iconBg} rounded-xl flex items-center justify-center mx-auto mb-4`}>
            <span className="text-2xl">{styles.icon}</span>
          </div>

          {/* Title */}
          <h3
            id="confirm-dialog-title"
            className="text-lg font-semibold text-[var(--color-text-primary)] text-center mb-2"
          >
            {title}
          </h3>

          {/* Message */}
          <p
            id="confirm-dialog-message"
            className="text-sm text-[var(--color-text-muted)] text-center mb-6"
          >
            {message}
          </p>

          {/* Actions */}
          <div className={`flex gap-3 ${alertOnly ? 'justify-center' : ''}`}>
            {!alertOnly && (
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-subtle)] hover:bg-[var(--color-border)] border border-[var(--color-border)] rounded-xl transition-colors"
              >
                {cancelLabel}
              </button>
            )}
            <button
              ref={confirmRef}
              onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${styles.buttonClass}`}
            >
              {alertOnly ? 'OK' : confirmLabel}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes dialogSlideUp {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  )
}
