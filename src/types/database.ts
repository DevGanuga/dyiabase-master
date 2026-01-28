export interface Job {
  id: string
  user_id: string
  date: string
  customer_name: string
  source?: string | null
  revenue: number
  labor: number
  gas: number
  dump_fee: number
  dumpster_rental: number
  additional_expense: number
  num_workers: number
  cost_per_worker: number
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface Quote {
  id: string
  user_id: string
  customer_name: string
  customer_phone?: string | null
  customer_email?: string | null
  customer_address?: string | null
  job_description?: string | null
  pricing: Record<string, unknown>
  estimate_low: number
  estimate_high: number
  total: number
  estimate_type?: string | null
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
  created_at: string
  updated_at: string
}

export interface UserProfile {
  id: string
  clerk_user_id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  subscription_status: 'active' | 'inactive' | 'canceled' | 'past_due' | 'trialing'
  subscription_plan?: 'monthly' | 'annual' | null
  subscription_ends_at?: string | null
  created_at: string
  updated_at: string
}

// App-side transformed types (camelCase)
export interface AppJob {
  id: string
  date: string
  customerName: string
  source?: string
  revenue: number
  labor: number
  gas: number
  dumpFee: number
  dumpsterRental: number
  additionalExpense: number
  numWorkers: number
  costPerWorker: number
  notes?: string
}

export interface AppQuote {
  id: string
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
  }
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
    minimumFee: number
    quarterLoad: number
    halfLoad: number
    threeQuarterLoad: number
    fullLoad: number
    additionalLoads: number
    laborPerHour: number
    dumpFee: number
    surcharges: {
      trampoline: number
      hotTub: number
      piano: number
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
