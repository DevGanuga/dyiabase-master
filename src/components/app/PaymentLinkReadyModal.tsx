'use client'

/**
 * BUG-031 UX gap (round 2): the previous flow was
 *   1. user clicks "Request Payment"
 *   2. async fetch creates the payment link
 *   3. we try `navigator.clipboard.writeText(url)` AFTER the await
 *   4. transient user activation is lost — clipboard rejects in most browsers
 *   5. we fall back to a "couldn't copy automatically" alert
 *
 * The fallback dialog ran every time in practice, so QA always saw a manual
 * copy step. This component replaces that with an explicit, intentional
 * dialog that opens immediately after the link is created. The Copy button
 * then does the clipboard write SYNCHRONOUSLY on user click — preserving
 * the user gesture and making clipboard succeed reliably across browsers.
 */
import { useEffect, useRef, useState } from 'react'

interface PaymentLinkReadyModalProps {
  open: boolean
  url: string | null
  /** Optional title — e.g. "Payment link for Acme Co." */
  title?: string
  /** Optional helper line beneath the URL field */
  description?: string
  onClose: () => void
}

export function PaymentLinkReadyModal({ open, url, title, description, onClose }: PaymentLinkReadyModalProps) {
  if (!open || !url) return null
  // Mount a fresh inner instance per (open, url) pair so the visible state
  // (copied, copyError) is naturally reset every time we open the dialog,
  // without needing setState in an effect.
  return (
    <PaymentLinkReadyModalInner
      key={url}
      url={url}
      title={title}
      description={description}
      onClose={onClose}
    />
  )
}

function PaymentLinkReadyModalInner({ url, title, description, onClose }: { url: string; title?: string; description?: string; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)

  // Auto-select the URL on mount so a Cmd/Ctrl+C also works immediately.
  useEffect(() => {
    const t = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 50)
    return () => window.clearTimeout(t)
  }, [])

  // Synchronous click handler — runs inside the user gesture, so the
  // clipboard write succeeds in every modern browser including Safari/iOS
  // unlike the previous post-await attempt.
  const handleCopy = async () => {
    setCopyError(false)
    let ok = false
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        ok = true
      }
    } catch {
      ok = false
    }
    if (!ok) {
      try {
        const ta = document.createElement('textarea')
        ta.value = url
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        ok = document.execCommand('copy')
        document.body.removeChild(ta)
      } catch {
        ok = false
      }
    }
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } else {
      setCopyError(true)
      // Re-select input so user can manually copy with keyboard.
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }

  const handleOpen = () => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              {title || 'Payment link ready'}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              {description || 'Share this link with your customer to collect payment.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] p-1 -mr-1 -mt-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1.5">Payment link</label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            onClick={(e) => e.currentTarget.select()}
            className="app-input flex-1 font-mono text-xs"
            aria-label="Payment link URL"
          />
          <button
            onClick={handleCopy}
            className={`app-btn-primary text-sm shrink-0 min-w-[96px] ${copied ? '!bg-emerald-500 hover:!bg-emerald-500' : ''}`}
            type="button"
          >
            {copied ? (
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Copied
              </span>
            ) : 'Copy link'}
          </button>
        </div>

        {copyError && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Couldn&apos;t copy automatically — the link is selected above, press Cmd/Ctrl+C to copy.
          </p>
        )}

        <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={handleOpen}
            className="app-btn-secondary text-sm"
          >
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open link
            </span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="app-btn-primary text-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
