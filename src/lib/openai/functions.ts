import type { ChatCompletionTool } from 'openai/resources/chat/completions'

// Function definitions for the OpenAI Assistants API
// These define what actions the AI can take

export const DYIA_FUNCTIONS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'create_job',
      description: 'Log a completed job with revenue and expenses. Use when the user wants to record a job they completed.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Job date in YYYY-MM-DD format. Defaults to today if not specified.'
          },
          customerName: {
            type: 'string',
            description: 'Customer name'
          },
          source: {
            type: 'string',
            description: 'How the customer found them (Google, Yelp, Referral, etc.)'
          },
          revenue: {
            type: 'number',
            description: 'Total revenue/payment received'
          },
          labor: {
            type: 'number',
            description: 'Labor costs paid to workers'
          },
          gas: {
            type: 'number',
            description: 'Gas/fuel costs'
          },
          dumpFee: {
            type: 'number',
            description: 'Dump/disposal fees'
          },
          dumpsterRental: {
            type: 'number',
            description: 'Dumpster rental costs if applicable'
          },
          additionalExpense: {
            type: 'number',
            description: 'Any other expenses'
          },
          numWorkers: {
            type: 'number',
            description: 'Number of workers on the job'
          },
          costPerWorker: {
            type: 'number',
            description: 'Cost per worker'
          },
          notes: {
            type: 'string',
            description: 'Notes about the job'
          }
        },
        required: ['customerName', 'revenue']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_quote',
      description: 'Create a quote/estimate for a potential customer. Use when the user wants to create a quote.',
      parameters: {
        type: 'object',
        properties: {
          customerName: {
            type: 'string',
            description: 'Customer name'
          },
          customerPhone: {
            type: 'string',
            description: 'Customer phone number'
          },
          customerEmail: {
            type: 'string',
            description: 'Customer email'
          },
          customerAddress: {
            type: 'string',
            description: 'Job location address'
          },
          jobDescription: {
            type: 'string',
            description: 'Description of the work to be done'
          },
          estimateLow: {
            type: 'number',
            description: 'Low end of the estimate range'
          },
          estimateHigh: {
            type: 'number',
            description: 'High end of the estimate range'
          }
        },
        required: ['customerName', 'jobDescription', 'estimateLow', 'estimateHigh']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'log_expense',
      description: 'Add a fixed/recurring expense like truck payment, insurance, software subscriptions. Use when user mentions a new recurring cost.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Name of the expense (e.g., "Truck Payment", "Liability Insurance")'
          },
          amount: {
            type: 'number',
            description: 'Amount of the expense'
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
        required: ['name', 'amount', 'frequency']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_performance_stats',
      description: 'Get performance statistics like revenue, profit, job count. Use when user asks about their performance, how they did, stats, numbers, etc.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'this_week', 'this_month', 'last_month', 'this_year', 'all_time'],
            description: 'Time period for stats. Defaults to this_month.'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_pending_follow_ups',
      description: 'Get list of quotes that need follow-up. Use when user asks about follow-ups, pending quotes, or customers to contact.',
      parameters: {
        type: 'object',
        properties: {
          priority: {
            type: 'string',
            enum: ['hot', 'warm', 'cold', 'all'],
            description: 'Filter by priority level. Hot = 0-3 days, Warm = 3-7 days, Cold = 7+ days.'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of follow-ups to return. Defaults to 5.'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'suggest_quote_price',
      description: 'Suggest a price range for a job based on description. Use when user asks for pricing advice or how much to charge.',
      parameters: {
        type: 'object',
        properties: {
          jobDescription: {
            type: 'string',
            description: 'Description of the work (e.g., "full garage cleanout", "hot tub removal", "3 loads of furniture")'
          },
          factors: {
            type: 'array',
            items: { type: 'string' },
            description: 'Additional factors to consider (e.g., "stairs", "long distance", "heavy items")'
          }
        },
        required: ['jobDescription']
      }
    }
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
