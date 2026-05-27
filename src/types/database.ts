export interface Job {
  id: string
  user_id: string
  customer_id?: string | null
  date: string
  customer_name: string
  source?: string | null
  revenue: number
  estimate_low?: number | null
  estimate_high?: number | null
  labor: number
  gas: number
  dump_fee: number
  dumpster_rental: number
  additional_expense: number
  num_workers: number
  cost_per_worker: number
  notes?: string | null
  receipt_url?: string | null
  payment_status?: PaymentRequestStatus
  payment_amount_cents?: number | null
  payment_requested_at?: string | null
  payment_paid_at?: string | null
  payment_last_request_id?: string | null
  created_at: string
  updated_at: string
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'completed'
export type PaymentRequestStatus = 'not_requested' | 'pending' | 'paid' | 'failed' | 'expired' | 'refunded'
export type PaymentRecordStatus = 'pending' | 'checkout_created' | 'paid' | 'failed' | 'expired' | 'refunded' | 'partial_refund'
export type PaymentRequestKind = 'payment_link' | 'invoice' | 'quote_payment' | 'job_payment'

export interface PaymentLineItem {
  description: string
  quantity: number
  unitAmountCents: number
}

export interface Quote {
  id: string
  user_id: string
  customer_id?: string | null
  job_id?: string | null
  customer_name: string
  customer_phone?: string | null
  customer_email?: string | null
  customer_address?: string | null
  job_description?: string | null
  pricing: Record<string, unknown>
  estimate_low: number
  estimate_high: number
  total: number
  status: QuoteStatus
  sent_at?: string | null
  payment_status?: PaymentRequestStatus
  payment_amount_cents?: number | null
  payment_requested_at?: string | null
  payment_paid_at?: string | null
  payment_last_request_id?: string | null
  photo_urls: string[]
  created_at: string
  updated_at: string
}

export interface Settings {
  id: string
  user_id: string
  tax_percentage: number
  monthly_goal: number
  business_name?: string | null
  business_phone?: string | null
  business_email?: string | null
  business_address?: string | null
  business_logo?: string | null
  review_url?: string | null
  review_url_google?: string | null
  review_url_yelp?: string | null
  review_url_facebook?: string | null
  onboarding_completed: boolean
  onboarding_skipped: boolean
  onboarding_completed_at?: string | null
  created_at: string
  updated_at: string
}

export type UserRole = 'user' | 'admin' | 'super_admin'

export interface UserProfile {
  id: string
  clerk_user_id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  stripe_customer_id?: string | null
  stripe_connect_account_id?: string | null
  stripe_connect_onboarding_complete: boolean
  stripe_connect_details_submitted: boolean
  stripe_connect_charges_enabled: boolean
  stripe_connect_payouts_enabled: boolean
  stripe_connect_country?: string | null
  stripe_connect_default_currency?: string | null
  stripe_subscription_id?: string | null
  subscription_status: 'active' | 'inactive' | 'canceled' | 'past_due' | 'trialing'
  subscription_plan?: 'monthly' | 'annual' | null
  subscription_tier?: 'basic' | 'pro' | null
  subscription_ends_at?: string | null
  trial_consumed_at?: string | null
  /** First-failure timestamp from Stripe invoice.payment_failed; null when not in dunning. (BUG-022 round 4) */
  payment_failed_at?: string | null
  ai_credits_balance: number
  ai_credits_used_lifetime: number
  is_admin: boolean
  role: UserRole
  created_at: string
  updated_at: string
}

export type BetaAccessRequestStatus = 'pending' | 'approved' | 'google_added' | 'invited' | 'rejected'

export interface BetaAccessRequest {
  id: string
  name: string
  signup_email: string
  google_email: string
  business_name: string | null
  requested_feature: string
  notes: string | null
  status: BetaAccessRequestStatus
  admin_notes: string | null
  reviewed_at: string | null
  reviewed_by_clerk_user_id: string | null
  created_at: string
  updated_at: string
}

// ============================================
// CREDIT TRANSACTIONS
// ============================================
export interface CreditTransaction {
  id: string
  user_id: string
  type: 'purchase' | 'usage' | 'grant' | 'refund'
  amount: number
  balance_after: number
  description: string | null
  stripe_payment_id: string | null
  message_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface AppCreditTransaction {
  id: string
  type: CreditTransaction['type']
  amount: number
  balanceAfter: number
  description: string | null
  createdAt: Date
}

// ============================================
// MARKETING SPEND
// ============================================
export interface MarketingSpend {
  id: string
  user_id: string
  source: string
  month: string
  amount: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AppMarketingSpend {
  id: string
  source: string
  month: Date
  amount: number
  notes: string | null
}

export interface SourceROI {
  source: string
  spend: number
  revenue: number
  jobs: number
  quotes?: number
  roi: number
  costPerJob: number
  costPerLead?: number
  conversionRate?: number
}

export interface ReviewRequest {
  id: string
  user_id: string
  quote_id: string | null
  customer_name: string
  platform: string
  requested_at: string
}

export interface AppReviewRequest {
  id: string
  quoteId: string | null
  customerName: string
  platform: string
  requestedAt: Date
}

// App-side transformed types (camelCase)
export type JobStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type ScheduledJobKind = 'job' | 'estimate' | 'free_estimate'

export interface AppJob {
  id: string
  customerId?: string | null
  date: string
  customerName: string
  source?: string
  revenue: number
  estimateLow?: number
  estimateHigh?: number
  appointmentWindow?: string
  scheduledKind?: ScheduledJobKind
  labor: number
  gas: number
  dumpFee: number
  dumpsterRental: number
  additionalExpense: number
  additionalExpenseLabel?: string
  numWorkers: number
  costPerWorker: number
  notes?: string
  status?: JobStatus
  address?: string
  receiptUrl?: string | null
  paymentStatus?: PaymentRequestStatus
  paymentAmountCents?: number | null
  paymentRequestedAt?: string | null
  paymentPaidAt?: string | null
  paymentLastRequestId?: string | null
}

export interface AppQuote {
  id: string
  customerId?: string | null
  jobId?: string
  createdAt: number
  customer: {
    name: string
    phone?: string
    email?: string
    address?: string
    jobDescription?: string
  }
  pricing: Record<string, unknown>
  photos: string[]
  estimateRange: { low: number; high: number }
  total: number
  status: QuoteStatus
  sentAt?: number
  paymentStatus?: PaymentRequestStatus
  paymentAmountCents?: number | null
  paymentRequestedAt?: string | null
  paymentPaidAt?: string | null
  paymentLastRequestId?: string | null
}

export interface AppSettings {
  taxPercentage: number
  monthlyGoal: number
  businessInfo: {
    name: string
    phone: string
    email: string
    address: string
    logo: string | null
    reviewUrl: string | null
    reviewUrlGoogle?: string | null
    reviewUrlYelp?: string | null
    reviewUrlFacebook?: string | null
  }
  onboardingCompleted: boolean
  onboardingSkipped: boolean
  onboardingCompletedAt: string | null
}

export interface PaymentRecord {
  id: string
  user_id: string
  quote_id?: string | null
  job_id?: string | null
  public_token: string
  stripe_connected_account_id: string
  stripe_checkout_session_id?: string | null
  stripe_payment_intent_id?: string | null
  stripe_charge_id?: string | null
  status: PaymentRecordStatus
  kind: PaymentRequestKind
  amount_cents: number
  subtotal_cents?: number | null
  tax_cents?: number | null
  application_fee_amount_cents: number
  destination_amount_cents: number
  currency: string
  customer_name?: string | null
  customer_email?: string | null
  customer_phone?: string | null
  customer_address?: string | null
  description?: string | null
  invoice_number?: string | null
  due_date?: string | null
  line_items?: PaymentLineItem[] | null
  checkout_url?: string | null
  paid_at?: string | null
  refunded_at?: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AppPaymentRecord {
  id: string
  quoteId?: string | null
  jobId?: string | null
  publicToken: string
  status: PaymentRecordStatus
  kind: PaymentRequestKind
  amountCents: number
  subtotalCents?: number | null
  taxCents?: number | null
  applicationFeeAmountCents: number
  destinationAmountCents: number
  currency: string
  customerName?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  customerAddress?: string | null
  description?: string | null
  invoiceNumber?: string | null
  dueDate?: string | null
  lineItems?: PaymentLineItem[] | null
  checkoutUrl?: string | null
  paidAt?: string | null
  refundedAt?: string | null
  createdAt: string
  updatedAt: string
}

// ============================================
// FIXED EXPENSES
// ============================================
export interface FixedExpense {
  id: string
  user_id: string
  name: string
  amount: number
  frequency: 'monthly' | 'yearly'
  category: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type FixedExpenseInsert = Omit<FixedExpense, 'id' | 'created_at' | 'updated_at'>

export interface AppFixedExpense {
  id: string
  name: string
  amount: number
  frequency: 'monthly' | 'yearly'
  category: string
  isActive: boolean
}

// ============================================
// FOLLOW-UPS
// ============================================
export interface FollowUp {
  id: string
  user_id: string
  customer_id?: string | null
  quote_id: string
  status: 'pending' | 'contacted' | 'converted' | 'lost' | 'snoozed'
  last_contacted_at: string | null
  next_follow_up_at: string | null
  notes: string | null
  contact_count: number
  created_at: string
  updated_at: string
}

export interface FollowUpWithQuote extends FollowUp {
  quote: AppQuote
  daysSinceQuote: number
}

// ============================================
// PRICE TEMPLATES
// ============================================
export interface PriceTemplate {
  id: string
  user_id: string
  name: string
  prices: {
    /** Custom line items (label + amount). When present, used for display; legacy keys still populated for compatibility. */
    items?: { label: string; amount: number }[]
    minimumFee?: number
    quarterLoad?: number
    halfLoad?: number
    threeQuarterLoad?: number
    fullLoad?: number
    additionalLoads?: number
    laborPerHour?: number
    dumpFee?: number
    surcharges?: {
      trampoline?: number
      hotTub?: number
      piano?: number
    }
  }
  is_default: boolean
  created_at: string
  updated_at: string
}

// ============================================
// AI THREADS & MESSAGES
// ============================================
export interface Thread {
  id: string
  user_id: string
  openai_thread_id: string
  title: string
  last_message_at: string
  message_count: number
  is_archived: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  thread_id: string
  openai_message_id: string | null
  role: 'user' | 'assistant' | 'system'
  content: string
  tool_calls: Record<string, unknown>[] | null
  tool_results: Record<string, unknown>[] | null
  tokens_used: number | null
  credit_cost: number | null
  created_at: string
}

// ============================================
// APP-SIDE TRANSFORMED TYPES (camelCase)
// ============================================
export interface AppThread {
  id: string
  openaiThreadId: string
  title: string
  lastMessageAt: Date
  messageCount: number
  isArchived: boolean
  createdAt: Date
}

export interface AppMessage {
  id: string
  threadId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls?: Record<string, unknown>[]
  toolResults?: Record<string, unknown>[]
  createdAt: Date
}

export interface AppPriceTemplate {
  id: string
  name: string
  isDefault: boolean
  prices: {
    items?: { label: string; amount: number }[]
    minimumFee?: number
    quarterLoad?: number
    halfLoad?: number
    threeQuarterLoad?: number
    fullLoad?: number
    additionalLoads?: number
    laborPerHour?: number
    dumpFee?: number
    surcharges?: {
      trampoline?: number
      hotTub?: number
      piano?: number
    }
  }
}

export interface AppFollowUp {
  id: string
  quoteId: string
  status: 'pending' | 'contacted' | 'converted' | 'lost' | 'snoozed'
  lastContactedAt: Date | null
  nextFollowUpAt: Date | null
  notes: string | null
  contactCount: number
  quote: AppQuote
  daysSinceQuote: number
  priority: 'hot' | 'warm' | 'cold'
}

// ============================================
// EMAIL PREFERENCES
// ============================================
export interface EmailPreferences {
  weeklyInsights: boolean
  followUpReminders: boolean
  productUpdates: boolean
  marketingEmails: boolean
}

// ============================================
// AI PENDING ACTIONS (Confirmation System)
// ============================================

export type PendingActionType = 'create_job' | 'generate_quote' | 'log_expense' | 'update_follow_up'
export type PendingActionStatus = 'pending' | 'confirmed' | 'cancelled' | 'edited'
export type ConfidenceLevel = 'high' | 'medium' | 'inferred'

// Job Proposal - Data extracted from conversation, awaiting confirmation
export interface JobProposal {
  date: string
  customerId?: string
  customerName: string
  source?: string
  revenue: number
  estimateLow?: number
  estimateHigh?: number
  labor: number
  gas: number
  dumpFee: number
  dumpsterRental: number
  additionalExpense: number
  additionalExpenseLabel?: string
  numWorkers: number
  costPerWorker: number
  notes?: string
  // Confidence levels indicate how the data was extracted
  confidence: Partial<Record<keyof Omit<JobProposal, 'confidence'>, ConfidenceLevel>>
}

// Quote Proposal - Data extracted from conversation, awaiting confirmation
export interface QuoteProposal {
  customerId?: string
  customerName: string
  customerPhone?: string
  customerEmail?: string
  customerAddress?: string
  jobDescription?: string
  estimateLow: number
  estimateHigh: number
  // Confidence levels indicate how the data was extracted
  confidence: Partial<Record<keyof Omit<QuoteProposal, 'confidence'>, ConfidenceLevel>>
}

// Expense Proposal - Data extracted from conversation, awaiting confirmation
export interface ExpenseProposal {
  name: string
  amount: number
  frequency: 'monthly' | 'yearly'
  category: string
  // Confidence levels indicate how the data was extracted
  confidence: Partial<Record<keyof Omit<ExpenseProposal, 'confidence'>, ConfidenceLevel>>
}

// Union type for all proposal data
export type ProposalData = JobProposal | QuoteProposal | ExpenseProposal

// Pending Action - Wraps proposal with metadata
export interface PendingAction {
  id: string
  type: PendingActionType
  data: JobProposal | QuoteProposal | ExpenseProposal
  status: PendingActionStatus
  messageId?: string  // Links to the message that created this action
  createdAt: number
}

// Type guards for proposal discrimination
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isJobProposal(data: any): data is JobProposal {
  return data && 'revenue' in data && 'customerName' in data && 'date' in data
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isQuoteProposal(data: any): data is QuoteProposal {
  return data && 'estimateLow' in data && 'estimateHigh' in data
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isExpenseProposal(data: any): data is ExpenseProposal {
  return data && 'frequency' in data && 'category' in data && !('revenue' in data)
}

// User Context - Business settings for AI awareness
export interface UserContext {
  settings: {
    businessName?: string
    businessPhone?: string
    businessEmail?: string
    businessAddress?: string
    taxPercentage: number
    monthlyGoal: number
  }
  defaultPriceTemplate?: AppPriceTemplate
  recentJobs: Array<{
    customerName: string
    revenue: number
    date: string
    source?: string
  }>
  missingFields: string[]  // Fields the user should fill in
}

// ============================================
// MASS EMAIL
// ============================================
export type EmailProvider = 'gmail' | 'outlook'

export interface EmailConnection {
  id: string
  user_id: string
  provider: EmailProvider
  email_address: string
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  is_active: boolean
  connected_at: string
  last_used_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AppEmailConnection {
  id: string
  provider: EmailProvider
  emailAddress: string
  isActive: boolean
  connectedAt: Date
  lastUsedAt: Date | null
}

export type EmailSendStatus = 'pending' | 'sent' | 'failed' | 'bounced'

export interface EmailSend {
  id: string
  user_id: string
  connection_id: string | null
  campaign_id: string | null
  recipient_email: string
  recipient_name: string | null
  subject: string
  body_preview: string | null
  status: EmailSendStatus
  error_message: string | null
  provider_message_id: string | null
  sent_at: string | null
  created_at: string
}

export interface AppEmailSend {
  id: string
  recipientEmail: string
  recipientName: string | null
  subject: string
  status: EmailSendStatus
  errorMessage: string | null
  sentAt: Date | null
  createdAt: Date
}

export type EmailCampaignStatus = 'draft' | 'sending' | 'completed' | 'failed'

export interface EmailCampaign {
  id: string
  user_id: string
  name: string | null
  subject: string
  body: string
  recipient_count: number
  sent_count: number
  failed_count: number
  status: EmailCampaignStatus
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface AppEmailCampaign {
  id: string
  name: string | null
  subject: string
  body: string
  recipientCount: number
  sentCount: number
  failedCount: number
  status: EmailCampaignStatus
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
}

// ============================================
// CUSTOMERS (CRM)
// ============================================
export interface Customer {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export type CustomerInsert = Omit<Customer, 'id' | 'created_at' | 'updated_at'>

export interface AppCustomer {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  tags: string[]
  createdAt: Date
  updatedAt: Date
  // Computed from jobs/quotes (not stored in DB)
  totalRevenue?: number
  jobCount?: number
  quoteCount?: number
  lastJobDate?: string
}

// Customer with email for mass email selection
export interface CustomerWithEmail {
  name: string
  email: string
  totalRevenue: number
  jobCount: number
  lastJobDate: string
}

// ============================================
// INTEL — Competitive Intelligence
// ============================================

export type IntelSource = 'public_page' | 'crm_monthly'
export type IntelJobStatus = 'pending' | 'running' | 'complete' | 'failed'
export type IntelActionPriority = 'high' | 'medium' | 'quick_win' | 'ongoing'
export type IntelActionCategory = 'reviews' | 'keywords' | 'ads' | 'gbp'

export interface IntelResearchSource {
  url: string
  title: string
}

export interface IntelTopCompetitor {
  name: string
  reviews: number
  estimated_ad_spend: number
  rank: number
}

export interface IntelGapScores {
  reviews_pct: number
  keywords_pct: number
  ads_pct: number
  gbp_pct: number
}

export interface IntelScanData {
  local_rank: number
  total_competitors: number
  review_count_mine: number
  review_count_leader: number
  review_gap: number
  missing_keywords: string[]
  missing_keywords_count: number
  competitor_ad_spend_avg: number
  top_competitors: IntelTopCompetitor[]
  gbp_gaps: string[]
  gap_scores: IntelGapScores
  scan_date: string
  target_zip_codes: string[]
}

export interface IntelActionStep {
  step_number: number
  category: IntelActionCategory
  priority: IntelActionPriority
  title: string
  description: string
  include_in_free_preview: boolean
}

export interface IntelScan {
  id: string
  user_id: string | null
  email: string | null
  full_name: string | null
  business_name: string
  website_url: string | null
  zip_code: string
  city: string | null
  state: string | null
  phone: string | null
  google_business_url: string | null
  main_services: string[] | null
  years_in_business: number | null
  team_size: number | null
  industry: string
  radius_miles: number
  scan_data: IntelScanData | null
  research_sources: IntelResearchSource[] | null
  action_plan: IntelActionStep[] | null
  stripe_session_id: string | null
  action_plan_purchased: boolean
  source: IntelSource
  created_at: string
}

export interface IntelMonthlyStatus {
  id: string
  user_id: string
  month_year: string
  scan_id: string
  job_status: IntelJobStatus
  viewed_at: string | null
  created_at: string
}

export interface AppIntelScan {
  id: string
  businessName: string
  websiteUrl: string | null
  zipCode: string
  industry: string
  radiusMiles: number
  scanData: IntelScanData | null
  researchSources: IntelResearchSource[] | null
  actionPlan: IntelActionStep[] | null
  actionPlanPurchased: boolean
  source: IntelSource
  createdAt: Date
}

export interface AppIntelMonthlyStatus {
  id: string
  monthYear: string
  scanId: string
  jobStatus: IntelJobStatus
  viewedAt: Date | null
  createdAt: Date
}

export const INTEL_INDUSTRIES = [
  'Junk Removal', 'Landscaping', 'Plumbing', 'Cleaning', 'HVAC',
  'Roofing', 'Painting', 'Moving', 'Pest Control', 'Pressure Washing',
  'Electrical', 'Handyman', 'Tree Service', 'Fencing', 'Concrete', 'Other',
] as const

export type IntelIndustry = (typeof INTEL_INDUSTRIES)[number]

export const INTEL_RADIUS_OPTIONS = [10, 25, 50, 100] as const
export type IntelRadius = (typeof INTEL_RADIUS_OPTIONS)[number]
