// Function definitions for OpenAI Responses API
// These define what actions the AI can take in the Dyia platform
// Using Responses API format (internally-tagged, strict by default)

export interface FunctionTool {
  type: 'function'
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
      enum?: string[]
      items?: { type: string }
    }>
    required: string[]
    additionalProperties: false
  }
  strict: boolean
}

export const DYIA_TOOLS: FunctionTool[] = [
  {
    type: 'function',
    name: 'create_job',
    description: 'Log a completed job with revenue and expenses. Use when the user mentions completing a job, getting paid, or wants to record work done.',
    parameters: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Job date in YYYY-MM-DD format. Defaults to today if not specified.'
        },
        customer_name: {
          type: 'string',
          description: 'Customer name (required)'
        },
        source: {
          type: 'string',
          description: 'How the customer found them (Google, Yelp, Referral, Facebook, Website, etc.)'
        },
        revenue: {
          type: 'number',
          description: 'Total revenue/payment received in dollars'
        },
        labor: {
          type: 'number',
          description: 'Labor costs paid to workers in dollars'
        },
        gas: {
          type: 'number',
          description: 'Gas/fuel costs in dollars'
        },
        dump_fee: {
          type: 'number',
          description: 'Dump/disposal fees in dollars'
        },
        dumpster_rental: {
          type: 'number',
          description: 'Dumpster rental costs in dollars'
        },
        additional_expense: {
          type: 'number',
          description: 'Any other expenses in dollars'
        },
        num_workers: {
          type: 'number',
          description: 'Number of workers on the job'
        },
        cost_per_worker: {
          type: 'number',
          description: 'Cost per worker in dollars'
        },
        notes: {
          type: 'string',
          description: 'Notes about the job (type of work, special circumstances)'
        }
      },
      required: ['date', 'customer_name', 'source', 'revenue', 'labor', 'gas', 'dump_fee', 'dumpster_rental', 'additional_expense', 'num_workers', 'cost_per_worker', 'notes'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function',
    name: 'generate_quote',
    description: 'Create a quote/estimate for a potential customer. Use when user wants to create, make, or generate a quote or estimate.',
    parameters: {
      type: 'object',
      properties: {
        customer_name: {
          type: 'string',
          description: 'Customer name (required)'
        },
        customer_phone: {
          type: 'string',
          description: 'Customer phone number'
        },
        customer_email: {
          type: 'string',
          description: 'Customer email address'
        },
        customer_address: {
          type: 'string',
          description: 'Job location/address'
        },
        job_description: {
          type: 'string',
          description: 'Description of the work to be done (required)'
        },
        estimate_low: {
          type: 'number',
          description: 'Low end of the estimate range in dollars (required)'
        },
        estimate_high: {
          type: 'number',
          description: 'High end of the estimate range in dollars (required)'
        }
      },
      required: ['customer_name', 'customer_phone', 'customer_email', 'customer_address', 'job_description', 'estimate_low', 'estimate_high'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function',
    name: 'log_expense',
    description: 'Add a fixed/recurring business expense like truck payment, insurance, software subscriptions. Use when user mentions a new recurring cost or wants to track overhead.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the expense (e.g., "Truck Payment", "Liability Insurance", "CRM Software")'
        },
        amount: {
          type: 'number',
          description: 'Amount of the expense in dollars'
        },
        frequency: {
          type: 'string',
          enum: ['monthly', 'yearly'],
          description: 'How often this expense occurs'
        },
        category: {
          type: 'string',
          enum: ['vehicle', 'insurance', 'software', 'rent', 'utilities', 'marketing', 'equipment', 'subscription', 'other'],
          description: 'Category of the expense'
        }
      },
      required: ['name', 'amount', 'frequency', 'category'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function',
    name: 'get_performance_stats',
    description: 'Get performance statistics like revenue, profit, job count, expenses. Use when user asks about how they did, their performance, stats, numbers, revenue, profit, etc.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'this_week', 'this_month', 'last_month', 'this_year', 'all_time'],
          description: 'Time period for stats. Defaults to this_month.'
        }
      },
      required: ['period'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function',
    name: 'get_pending_follow_ups',
    description: 'Get list of quotes that need follow-up with customers. Use when user asks about follow-ups, pending quotes, customers to contact, or leads.',
    parameters: {
      type: 'object',
      properties: {
        priority: {
          type: 'string',
          enum: ['hot', 'warm', 'cold', 'all'],
          description: 'Filter by priority level. Hot = 0-3 days since quote, Warm = 3-7 days, Cold = 7+ days. Defaults to all.'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of follow-ups to return. Defaults to 5.'
        }
      },
      required: ['priority', 'limit'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function',
    name: 'suggest_quote_price',
    description: 'Get AI pricing recommendations based on job description. Use when user asks how much to charge, what to price something at, or needs pricing guidance.',
    parameters: {
      type: 'object',
      properties: {
        job_description: {
          type: 'string',
          description: 'Description of the work (e.g., "full garage cleanout", "hot tub removal", "3 loads of furniture")'
        },
        factors: {
          type: 'array',
          items: { type: 'string' },
          description: 'Additional factors to consider (e.g., "stairs", "long distance", "heavy items", "hazardous materials")'
        }
      },
      required: ['job_description', 'factors'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function',
    name: 'update_follow_up_status',
    description: 'Update the status of a follow-up (mark as contacted, converted, lost, or snoozed). Use when user mentions contacting a customer, closing a deal, or losing a lead.',
    parameters: {
      type: 'object',
      properties: {
        follow_up_id: {
          type: 'string',
          description: 'ID of the follow-up to update'
        },
        status: {
          type: 'string',
          enum: ['contacted', 'converted', 'lost', 'snoozed'],
          description: 'New status for the follow-up'
        },
        notes: {
          type: 'string',
          description: 'Notes about the follow-up interaction'
        },
        snooze_until: {
          type: 'string',
          description: 'If status is snoozed, the date to follow up again (YYYY-MM-DD)'
        }
      },
      required: ['follow_up_id', 'status', 'notes', 'snooze_until'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function',
    name: 'get_business_summary',
    description: 'Get a comprehensive business summary including revenue trends, top sources, expense breakdown. Use for weekly/monthly reviews or when user wants an overview.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['this_week', 'this_month', 'last_month', 'this_quarter', 'this_year'],
          description: 'Time period for the summary'
        }
      },
      required: ['period'],
      additionalProperties: false
    },
    strict: true
  }
]

// Export function names for type checking
export type DyiaFunctionName = 
  | 'create_job'
  | 'generate_quote'
  | 'log_expense'
  | 'get_performance_stats'
  | 'get_pending_follow_ups'
  | 'suggest_quote_price'
  | 'update_follow_up_status'
  | 'get_business_summary'
