'use client'

/**
 * Mass Email Blast (Pro) — placeholder.
 * When Gmail/Outlook OAuth is configured, this view will allow:
 * - Connecting user's Gmail or Outlook account
 * - Selecting customers (from customer list or filters)
 * - Composing a message and sending through their account
 * - Tracking who was emailed and when
 *
 * To enable: add OAuth credentials to env (see SETUP.md "Mass Email") and implement
 * /api/email/connect, /api/email/send, and optional dyia_email_sends table for tracking.
 */
export function MassEmail() {
  return (
    <div className="space-y-8 animate-view-enter">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">Email blast</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Send promotional emails to your customers from your own Gmail or Outlook.
        </p>
      </div>
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl p-6 sm:p-8">
        <p className="text-[var(--color-text-secondary)] mb-4">
          Connect your Gmail or Outlook account to send emails to your customer list. Emails are sent from your address so replies come to you.
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">
          <strong>To enable:</strong> Configure OAuth in your environment (see SETUP.md → Mass Email). Once configured, you’ll be able to connect an account, choose customers, write your message, and send. Definitive OAuth client IDs and callback URLs can be plugged in when ready.
        </p>
      </div>
    </div>
  )
}
