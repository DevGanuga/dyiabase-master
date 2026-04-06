import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

let _resend: Resend | null = null

export function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set. Please add it to .env.local')
    }
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

export const EMAIL_CONFIG = {
  from: process.env.RESEND_FROM_EMAIL || 'Dyia <hello@dyia.io>',
  replyTo: process.env.SUPPORT_EMAIL || 'dyia.io.app@gmail.com',
}

export type EmailType = 
  | 'welcome'
  | 'trial_ending'
  | 'trial_ended'
  | 'weekly_insights'
  | 'monthly_report'
  | 'follow_up_reminder'
  | 'subscription_confirmed'
  | 'subscription_canceled'
  | 'payment_failed'
  | 'quiz_report'
  | 'quiz_followup'
  | 'intel_action_plan'
  | 'intel_free_report'

export interface EmailSendResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send an email via Resend and automatically log it to dyia_email_logs.
 * Logging is best-effort — a logging failure never blocks the send result.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  emailType: EmailType,
  userId?: string | null
): Promise<EmailSendResult> {
  let result: EmailSendResult

  try {
    const resend = getResend()
    
    const { data, error } = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to,
      subject,
      html,
      headers: {
        'X-Email-Type': emailType,
      },
    })

    if (error) {
      console.error(`Failed to send ${emailType} email:`, error)
      result = { success: false, error: error.message }
    } else {
      result = { success: true, messageId: data?.id }
    }
  } catch (err) {
    console.error(`Error sending ${emailType} email:`, err)
    result = { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }

  logEmailSend(to, emailType, subject, userId || null, result).catch(() => {})

  return result
}

async function logEmailSend(
  recipientEmail: string,
  emailType: EmailType,
  _subject: string,
  userId: string | null,
  result: EmailSendResult
): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    await supabase.from('dyia_email_logs').insert({
      user_id: userId,
      email_type: emailType,
      recipient_email: recipientEmail,
      resend_id: result.messageId || null,
      status: result.success ? 'sent' : 'failed',
      metadata: result.error ? { error: result.error, subject: _subject } : { subject: _subject },
    })
  } catch {
    console.error(`Failed to log ${emailType} email send`)
  }
}
