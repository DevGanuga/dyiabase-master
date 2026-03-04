// Function definitions for OpenAI Responses API
// These define what actions the AI can take in the Dyia platform
// Using Responses API format (internally-tagged, strict by default)

interface ParameterProperty {
  type: string
  description: string
  enum?: string[]
  items?: {
    type: string
    properties?: Record<string, ParameterProperty>
    required?: string[]
    additionalProperties?: false
  }
}

export interface FunctionTool {
  type: 'function'
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, ParameterProperty>
    required: string[]
    additionalProperties: false
  }
  strict: boolean
}

export const DYIA_TOOLS: FunctionTool[] = [
  // ============================================
  // PROPOSAL TOOLS (Require User Confirmation)
  // These extract data and show a preview card for confirmation
  // ============================================
  {
    type: 'function',
    name: 'propose_job',
    description: 'Extract job information from the conversation and propose saving it. ALWAYS use this instead of create_job. This shows the user a preview of the extracted data with a confirmation button. Only after user confirms will the job be saved.',
    parameters: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Job date in YYYY-MM-DD format. Use today if not specified.'
        },
        customer_name: {
          type: 'string',
          description: 'Customer name extracted from conversation'
        },
        source: {
          type: 'string',
          description: 'How the customer found them (Google, Yelp, Referral, Facebook, Website, etc.). Use "Unknown" if not mentioned.'
        },
        revenue: {
          type: 'number',
          description: 'Total revenue/payment received in dollars'
        },
        labor: {
          type: 'number',
          description: 'Labor costs paid to workers. Default to 0 if not mentioned.'
        },
        gas: {
          type: 'number',
          description: 'Gas/fuel costs. Default to 0 if not mentioned.'
        },
        dump_fee: {
          type: 'number',
          description: 'Dump/disposal fees. Default to 0 if not mentioned.'
        },
        dumpster_rental: {
          type: 'number',
          description: 'Dumpster rental costs. Default to 0 if not mentioned.'
        },
        additional_expense: {
          type: 'number',
          description: 'Any other expenses. Default to 0 if not mentioned.'
        },
        num_workers: {
          type: 'number',
          description: 'Number of workers. Default to 1 if not mentioned.'
        },
        cost_per_worker: {
          type: 'number',
          description: 'Cost per worker. Default to 0 if not mentioned.'
        },
        notes: {
          type: 'string',
          description: 'Notes about the job (type of work, items removed, special circumstances). Summarize from conversation.'
        }
      },
      required: ['date', 'customer_name', 'source', 'revenue', 'labor', 'gas', 'dump_fee', 'dumpster_rental', 'additional_expense', 'num_workers', 'cost_per_worker', 'notes'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function',
    name: 'propose_quote',
    description: 'Extract quote information from the conversation and propose creating it. ALWAYS use this instead of generate_quote. This shows the user a preview with a "Save Quote" or "Save & Download PDF" confirmation button.',
    parameters: {
      type: 'object',
      properties: {
        customer_name: {
          type: 'string',
          description: 'Customer name extracted from conversation'
        },
        customer_phone: {
          type: 'string',
          description: 'Customer phone number. Use empty string if not provided.'
        },
        customer_email: {
          type: 'string',
          description: 'Customer email address. Use empty string if not provided.'
        },
        customer_address: {
          type: 'string',
          description: 'Job location/address. Use empty string if not provided.'
        },
        job_description: {
          type: 'string',
          description: 'Description of the work to be done'
        },
        estimate_low: {
          type: 'number',
          description: 'Low end of the estimate range in dollars'
        },
        estimate_high: {
          type: 'number',
          description: 'High end of the estimate range in dollars'
        }
      },
      required: ['customer_name', 'customer_phone', 'customer_email', 'customer_address', 'job_description', 'estimate_low', 'estimate_high'],
      additionalProperties: false
    },
    strict: true
  },
  // ============================================
  // DIRECT EXECUTION TOOLS (Used after confirmation or for read-only ops)
  // ============================================
  {
    type: 'function',
    name: 'create_job',
    description: 'INTERNAL: Only used after user confirms a job proposal. Do NOT call directly - use propose_job instead.',
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
    description: 'INTERNAL: Only used after user confirms a quote proposal. Do NOT call directly - use propose_quote instead.',
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
    name: 'convert_quote_to_job',
    description: 'Convert an accepted quote into a logged job. Use when a customer has agreed to a quote and the user wants to create a job from it.',
    parameters: {
      type: 'object',
      properties: {
        quote_id: {
          type: 'string',
          description: 'The ID of the quote to convert into a job'
        },
        revenue: {
          type: 'number',
          description: 'Final agreed revenue in dollars. If not provided, uses the average of the quote estimate range.'
        },
        date: {
          type: 'string',
          description: 'Job date in YYYY-MM-DD format. Defaults to today.'
        }
      },
      required: ['quote_id', 'revenue', 'date'],
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
  },
  {
    type: 'function',
    name: 'get_user_context',
    description: 'Get user business settings and context. Call this early in conversations to personalize responses and check for missing business details. Returns settings, default price template, recent jobs, and a list of fields the user should fill in.',
    parameters: {
      type: 'object',
      properties: {
        include_recent_jobs: {
          type: 'number',
          description: 'Number of recent jobs to include for context (0-10). Default 5.'
        }
      },
      required: ['include_recent_jobs'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function',
    name: 'find_similar_jobs',
    description: 'Find similar past jobs based on job description using semantic search. Use this to help with pricing suggestions, reference past work, or show the user relevant job history. Returns jobs ranked by similarity with revenue and profit margin data.',
    parameters: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Job description to match against (e.g., "garage cleanout", "hot tub removal", "estate cleanout")'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of similar jobs to return (1-10). Default 5.'
        }
      },
      required: ['description', 'limit'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function',
    name: 'get_revenue_forecast',
    description: 'Get a revenue forecast for the current or next period based on historical trends. Use when user asks about projected earnings, what they might make, or future revenue predictions.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['this_week', 'this_month', 'next_week', 'next_month'],
          description: 'The period to forecast revenue for'
        }
      },
      required: ['period'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function',
    name: 'get_follow_up_risk_analysis',
    description: 'Analyze follow-ups for conversion risk. Identifies which quotes are at risk of going cold and provides conversion probability estimates based on historical data.',
    parameters: {
      type: 'object',
      properties: {
        include_all: {
          type: 'boolean',
          description: 'If true, include all pending follow-ups. If false, only show high-risk ones.'
        }
      },
      required: ['include_all'],
      additionalProperties: false
    },
    strict: true
  },
  // ============================================
  // BATCH TOOLS (Handle bulk operations from CSV/spreadsheet data)
  // ============================================
  {
    type: 'function',
    name: 'batch_store_customers',
    description: 'Store multiple customers at once from parsed CSV/spreadsheet data. Use this when the user uploads or pastes a CSV with customer data. Extract all customers and store them in one call. This is a DIRECT action — no confirmation needed. After storing, tell the user what was saved and ask what they want to do next (create quotes, etc).',
    parameters: {
      type: 'object',
      properties: {
        customers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Customer name (required)' },
              phone: { type: 'string', description: 'Phone number. Empty string if unknown.' },
              email: { type: 'string', description: 'Email address. Empty string if unknown.' },
              address: { type: 'string', description: 'Full address (street, city, state, zip combined). Empty string if unknown.' },
              notes: { type: 'string', description: 'Notes about the customer or job details. Combine service_type, items, load_size, special instructions, etc.' },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tags for categorization (e.g. service type, city, priority)'
              }
            },
            required: ['name', 'phone', 'email', 'address', 'notes', 'tags'],
            additionalProperties: false
          },
          description: 'Array of customer records to store'
        }
      },
      required: ['customers'],
      additionalProperties: false
    },
    strict: true
  },
  {
    type: 'function',
    name: 'batch_create_quotes',
    description: 'Create multiple quotes at once from parsed CSV/spreadsheet data or batch of customer info. Use this after customers have been stored, when the user wants to generate quotes for all of them. This is a DIRECT action — creates all quotes, follow-ups, and links to customers in one call. Use suggest_quote_price logic or user-provided pricing template to set estimate ranges.',
    parameters: {
      type: 'object',
      properties: {
        quotes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              customer_name: { type: 'string', description: 'Customer name (must match a stored customer)' },
              customer_phone: { type: 'string', description: 'Phone. Empty string if unknown.' },
              customer_email: { type: 'string', description: 'Email. Empty string if unknown.' },
              customer_address: { type: 'string', description: 'Address. Empty string if unknown.' },
              job_description: { type: 'string', description: 'Description of the work to be done' },
              estimate_low: { type: 'number', description: 'Low end estimate in dollars' },
              estimate_high: { type: 'number', description: 'High end estimate in dollars' },
              preferred_date: { type: 'string', description: 'Preferred date for the job (YYYY-MM-DD or empty string)' },
              notes: { type: 'string', description: 'Additional notes (time window, special instructions, etc.)' }
            },
            required: ['customer_name', 'customer_phone', 'customer_email', 'customer_address', 'job_description', 'estimate_low', 'estimate_high', 'preferred_date', 'notes'],
            additionalProperties: false
          },
          description: 'Array of quotes to create'
        }
      },
      required: ['quotes'],
      additionalProperties: false
    },
    strict: true
  },
  // ============================================
  // MEMORY TOOL
  // ============================================
  {
    type: 'function',
    name: 'save_memory',
    description: 'Save an important fact, preference, or instruction about the user for future conversations. Use this when you learn something worth remembering: their preferred name, typical dump fee, common job types, pricing preferences, work schedule, crew size, truck capacity, etc. Memories persist across all conversations. Do NOT save trivial or one-time information.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['preference', 'fact', 'pattern', 'instruction'],
          description: 'preference = how they like things done. fact = a concrete detail about them/their business. pattern = a recurring behavior. instruction = something they told you to always/never do.'
        },
        content: {
          type: 'string',
          description: 'The memory to save. Write it as a clear, reusable note. Example: "Prefers to be called Marco", "Typical dump fee is $45-55", "Runs a 2-person crew on most jobs", "Always charges extra for stairs"'
        }
      },
      required: ['category', 'content'],
      additionalProperties: false
    },
    strict: true
  }
]

// Export function names for type checking
export type DyiaFunctionName =
  | 'propose_job'
  | 'propose_quote'
  | 'create_job'
  | 'generate_quote'
  | 'log_expense'
  | 'get_performance_stats'
  | 'get_pending_follow_ups'
  | 'suggest_quote_price'
  | 'update_follow_up_status'
  | 'convert_quote_to_job'
  | 'get_business_summary'
  | 'get_user_context'
  | 'find_similar_jobs'
  | 'get_revenue_forecast'
  | 'get_follow_up_risk_analysis'
  | 'batch_store_customers'
  | 'batch_create_quotes'
  | 'save_memory'

export type ProposalFunctionName = 'propose_job' | 'propose_quote'
export function isProposalFunction(name: string): name is ProposalFunctionName {
  return name === 'propose_job' || name === 'propose_quote'
}