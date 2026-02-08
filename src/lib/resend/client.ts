import { Resend } from 'resend'

// Lazy-initialized Resend client
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

// Check if Resend is configured
export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

// Email configuration
export const EMAIL_CONFIG = {
  from: process.env.RESEND_FROM_EMAIL || 'Dyia <hello@dyia.io>',
  replyTo: 'support@dyia.io',
}

// Email types for tracking
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

// Email send result
export interface EmailSendResult {
  success: boolean
  messageId?: string
  error?: string
}

// Generic email send function
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  emailType: EmailType
): Promise<EmailSendResult> {
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
      return { success: false, error: error.message }
    }

    return { success: true, messageId: data?.id }
  } catch (err) {
    console.error(`Error sending ${emailType} email:`, err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
