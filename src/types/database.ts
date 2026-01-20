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
  auth_user_id: string
  email: string
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
