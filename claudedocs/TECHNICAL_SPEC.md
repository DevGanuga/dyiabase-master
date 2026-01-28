# Dyia MVP – Technical Specification Document

**Version:** 1.0
**Date:** January 27, 2026
**Sprint Window:** January 28 – February 3, 2026
**Total Estimated Effort:** ~65 hours

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Architecture Overview](#3-architecture-overview)
4. [Sprint Unit Breakdown](#4-sprint-unit-breakdown)
5. [AI Integration Specification](#5-ai-integration-specification)
6. [Thread Persistence System](#6-thread-persistence-system)
7. [Resend Notification System](#7-resend-notification-system)
8. [Database Schema Changes](#8-database-schema-changes)
9. [API Route Specifications](#9-api-route-specifications)
10. [Deployment & Infrastructure](#10-deployment--infrastructure)

---

## 1. Executive Summary

### 1.1 Objective
Deliver a production-ready MVP of Dyia with AI-powered insights, chat assistant, and automated notifications by February 3, 2026.

### 1.2 Tech Stack
| Layer | Technology | Status |
|-------|------------|--------|
| Frontend | Next.js 16, React 19, TypeScript | ✅ Built |
| Styling | Tailwind CSS 4 | ✅ Built |
| Auth | Clerk | ✅ Built |
| Database | Supabase (PostgreSQL) | ✅ Built |
| Payments | Stripe | ✅ Built |
| AI - Chat | OpenAI GPT-5.2 (Responses API) | ❌ New |
| AI - Reports | Anthropic Claude | ❌ New |
| Email | Resend | ❌ New |
| PDF | jsPDF | ✅ Built |

### 1.3 Tier Structure
```
┌─────────────────────────────────────────────────────────────────┐
│ BASIC ($14.99/mo)                                                │
├─────────────────────────────────────────────────────────────────┤
│ • Unlimited jobs + quotes                                        │
│ • Dashboard: revenue, profit, expenses                           │
│ • Tax set-aside calculator                                       │
│ • Monthly + yearly fixed expenses tracking                       │
│ • Follow-up dashboard (manual, non-AI)                           │
│ • PDF quote generation                                           │
│ • Mobile-friendly app                                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ PRO ($24.99/mo) – 7-day free trial                              │
├─────────────────────────────────────────────────────────────────┤
│ • Everything in Basic                                            │
│ • AI insights (weekly/monthly trend analysis)                    │
│ • Smart follow-up reminders (conversion risk detection)          │
│ • Revenue forecasting (MVP model)                                │
│ • AI quote suggestions                                           │
│ • PDF reports                                                    │
│ • Chat-based assistant UI ("Talk to Dyia")                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Current State Analysis

### 2.1 Feature Completion Matrix

| Feature | Status | Gap Assessment |
|---------|--------|----------------|
| Authentication (Clerk) | ✅ Complete | None |
| Stripe Subscriptions | ✅ Complete | Need tier gating logic |
| Job Tracking | ✅ Complete | None |
| Quote Builder + PDF | ✅ Complete | Add AI suggestions |
| Dashboard | ✅ Complete | Add AI insights section |
| Settings | ✅ Complete | Add fixed expenses |
| Landing Page | ✅ Complete | Update pricing tiers |
| Email System | ❌ Missing | Full implementation needed |
| AI Chat Assistant | ❌ Missing | Full implementation needed |
| AI Insights Engine | ❌ Missing | Full implementation needed |
| Fixed Expenses | ❌ Missing | DB + UI needed |
| Follow-up System | ❌ Missing | Full implementation needed |
| Thread Persistence | ❌ Missing | DB + API needed |

### 2.2 Database Schema (Current)

```sql
-- EXISTING TABLES
dyia_users (
  id, clerk_user_id, email, first_name, last_name,
  stripe_customer_id, stripe_subscription_id,
  subscription_status, subscription_plan,
  created_at, updated_at
)

dyia_settings (
  id, user_id, tax_percentage, monthly_goal,
  business_name, business_phone, business_email,
  business_address, business_logo,
  created_at, updated_at
)

dyia_jobs (
  id, user_id, date, customer_name, source,
  revenue, labor, gas, dump_fee, dumpster_rental,
  additional_expense, num_workers, cost_per_worker,
  notes, created_at, updated_at
)

dyia_quotes (
  id, user_id, created_at, customer, pricing,
  photos, estimate_range, total, updated_at
)
```

### 2.3 Files to Modify

| File | Changes Needed |
|------|----------------|
| `src/app/app/page.tsx` | Add AI chat, insights, follow-ups tabs |
| `src/components/app/Dashboard.tsx` | Add AI insights section, fixed expenses |
| `src/components/app/Settings.tsx` | Add fixed expenses management |
| `src/components/app/Sidebar.tsx` | Add "Dyia Assistant" nav item |
| `src/app/page.tsx` | Update pricing to $14.99/$24.99 |
| `src/types/database.ts` | Add new interfaces |
| `src/lib/utils.ts` | Add expense calculations |

---

## 3. Architecture Overview

### 3.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Next.js)                            │
├─────────────────────────────────────────────────────────────────────────┤
│  Dashboard  │  Jobs  │  Quotes  │  Assistant  │  Follow-ups  │  Settings │
└──────┬──────┴────────┴──────────┴──────┬──────┴──────────────┴───────────┘
       │                                  │
       ▼                                  ▼
┌─────────────────────┐         ┌─────────────────────────────────────────┐
│   Supabase Client   │         │           API Routes (/api)              │
│   (Browser)         │         ├─────────────────────────────────────────┤
│   • Jobs CRUD       │         │ /api/ai/chat        → OpenAI GPT-5.2    │
│   • Quotes CRUD     │         │ /api/ai/insights    → Anthropic Claude  │
│   • Settings        │         │ /api/ai/forecast    → OpenAI GPT-5.2    │
│   • Threads         │         │ /api/notifications  → Resend            │
└──────────┬──────────┘         │ /api/stripe/*       → Stripe            │
           │                    │ /api/clerk/*        → Clerk             │
           ▼                    └───────────┬─────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE (PostgreSQL)                            │
├─────────────────────────────────────────────────────────────────────────┤
│  dyia_users  │  dyia_jobs  │  dyia_quotes  │  dyia_threads  │  dyia_*   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 AI Service Flow

```
User Input (Chat/Dashboard)
         │
         ▼
┌─────────────────────┐
│  /api/ai/chat       │──────────────────────┐
│  (Function Router)  │                      │
└─────────┬───────────┘                      │
          │                                  │
    ┌─────┴─────┬──────────┬────────┐        │
    ▼           ▼          ▼        ▼        │
┌───────┐ ┌─────────┐ ┌────────┐ ┌──────┐    │
│Create │ │Generate │ │  Log   │ │Query │    │
│ Job   │ │ Quote   │ │Expense │ │Stats │    │
└───┬───┘ └────┬────┘ └───┬────┘ └──┬───┘    │
    │          │          │         │        │
    └──────────┴──────────┴─────────┘        │
                    │                        │
                    ▼                        │
         ┌──────────────────┐                │
         │   Supabase DB    │◄───────────────┘
         │   (Persist)      │    Thread Context
         └──────────────────┘
```

---

## 4. Sprint Unit Breakdown

### Sprint 1: Infrastructure + Core UI (25 hours)

#### Unit 1.1: Fixed Expenses System (6 hours)

**Database Migration:**
```sql
CREATE TABLE dyia_fixed_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES dyia_users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('monthly', 'yearly')),
  category VARCHAR(50), -- 'vehicle', 'insurance', 'software', 'other'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Component:** `src/components/app/FixedExpenses.tsx`
```typescript
interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'yearly';
  category: string;
  isActive: boolean;
}

// UI: List view with add/edit/delete
// Calculations: Monthly rollup (yearly ÷ 12)
// Integration: Dashboard displays total monthly fixed costs
```

**Files to Create:**
- `src/components/app/FixedExpenses.tsx`
- `supabase/migrations/003_fixed_expenses.sql`

**Files to Modify:**
- `src/types/database.ts` – Add FixedExpense interface
- `src/components/app/Dashboard.tsx` – Add fixed expenses card
- `src/lib/utils.ts` – Add `calculateMonthlyFixedExpenses()`

---

#### Unit 1.2: Follow-Up System (8 hours)

**Database Migration:**
```sql
CREATE TABLE dyia_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES dyia_users(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES dyia_quotes(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'converted', 'lost', 'snoozed')),
  last_contacted_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  notes TEXT,
  contact_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Component:** `src/components/app/FollowUps.tsx`
```typescript
interface FollowUp {
  id: string;
  quote: AppQuote;
  status: 'pending' | 'contacted' | 'converted' | 'lost' | 'snoozed';
  daysSinceQuote: number;
  lastContactedAt?: Date;
  nextFollowUpAt?: Date;
  contactCount: number;
}

// Features:
// - List unconverted quotes sorted by age
// - Status badges (Hot 🔥 = 0-3 days, Warm = 3-7 days, Cold = 7+ days)
// - Click phone → opens tel: link
// - Click text → copies pre-written message to clipboard
// - Mark as contacted/converted/lost/snoozed
```

**Pre-written Message Template:**
```typescript
const generateFollowUpMessage = (quote: AppQuote): string => {
  return `Hi ${quote.customer.name}, this is [BUSINESS_NAME] following up on the estimate we provided for your ${quote.customer.jobDescription}. The estimate was ${quote.estimateRange.low}-${quote.estimateRange.high}. Would you like to schedule this job? Let me know if you have any questions!`;
};
```

**Files to Create:**
- `src/components/app/FollowUps.tsx`
- `supabase/migrations/004_follow_ups.sql`

**Files to Modify:**
- `src/app/app/page.tsx` – Add FollowUps tab
- `src/types/database.ts` – Add FollowUp interface

---

#### Unit 1.3: Dashboard Polish & Tier Gating (6 hours)

**Tier Gating Hook:**
```typescript
// src/hooks/useSubscription.ts
export function useSubscription() {
  const [tier, setTier] = useState<'basic' | 'pro' | 'trial'>('basic');
  const [daysRemaining, setDaysRemaining] = useState<number>(0);

  // Check subscription_status and subscription_plan from dyia_users
  // trial = subscription_status === 'trialing'
  // pro = subscription_plan === 'monthly' || 'annual' && status === 'active'
  // basic = everything else

  return { tier, daysRemaining, isPro: tier === 'pro' || tier === 'trial' };
}
```

**Gated Components:**
```typescript
// Wrap Pro features with this component
const ProFeature: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isPro } = useSubscription();

  if (!isPro) {
    return (
      <div className="relative">
        <div className="opacity-50 pointer-events-none">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <button className="btn-primary">Upgrade to Pro</button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
```

**Files to Create:**
- `src/hooks/useSubscription.ts`
- `src/components/ui/ProFeature.tsx`

**Files to Modify:**
- `src/components/app/Dashboard.tsx` – Add AI insights section (gated)
- `src/app/page.tsx` – Update pricing to $14.99/$24.99

---

#### Unit 1.4: Quote Price Templates (5 hours)

**Database Migration:**
```sql
CREATE TABLE dyia_price_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES dyia_users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  prices JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default template structure:
-- {
--   "minimumFee": 75,
--   "quarterLoad": 150,
--   "halfLoad": 250,
--   "threeQuarterLoad": 350,
--   "fullLoad": 450,
--   "additionalLoads": 400,
--   "laborPerHour": 50,
--   "dumpFee": 75,
--   "surcharges": {
--     "trampoline": 50,
--     "hotTub": 150,
--     "piano": 200
--   }
-- }
```

**Component:** `src/components/app/PriceTemplates.tsx`
- Settings panel to manage price templates
- Default template auto-populates quote builder
- AI references these for quote suggestions

**Files to Create:**
- `src/components/app/PriceTemplates.tsx`
- `supabase/migrations/005_price_templates.sql`

**Files to Modify:**
- `src/components/app/Settings.tsx` – Add price templates section
- `src/components/app/QuoteBuilder.tsx` – Auto-fill from default template

---

### Sprint 2: AI + Pro Features (30 hours)

#### Unit 2.1: AI Chat Assistant – Infrastructure (8 hours)

**Thread Storage Schema:**
```sql
CREATE TABLE dyia_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES dyia_users(id) ON DELETE CASCADE,
  openai_thread_id VARCHAR(255), -- OpenAI's thread ID
  title VARCHAR(255) DEFAULT 'New Conversation',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dyia_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES dyia_threads(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  tool_calls JSONB, -- Function call metadata
  tool_results JSONB, -- Function call results
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**API Route:** `/api/ai/chat/route.ts`
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Using Responses API (GPT-5.2)
export async function POST(req: Request) {
  const { threadId, message, userId } = await req.json();

  // 1. Get or create thread
  let thread = await getOrCreateThread(userId, threadId);

  // 2. Add message to thread
  await openai.beta.threads.messages.create(thread.openai_thread_id, {
    role: 'user',
    content: message
  });

  // 3. Run assistant with function calling
  const run = await openai.beta.threads.runs.create(thread.openai_thread_id, {
    assistant_id: process.env.OPENAI_ASSISTANT_ID,
    tools: DYIA_FUNCTIONS, // Function definitions
  });

  // 4. Handle function calls (polling or streaming)
  // 5. Return response + persist to dyia_messages
}
```

**Files to Create:**
- `src/app/api/ai/chat/route.ts`
- `src/lib/openai/client.ts`
- `src/lib/openai/functions.ts`
- `supabase/migrations/006_threads.sql`

---

#### Unit 2.2: AI Function Definitions (6 hours)

**Function Schemas:** `src/lib/openai/functions.ts`
```typescript
export const DYIA_FUNCTIONS = [
  {
    type: 'function',
    function: {
      name: 'create_job',
      description: 'Log a new job with revenue and expenses',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date' },
          customerName: { type: 'string' },
          source: { type: 'string', enum: ['repeat', 'referral', 'google', 'facebook', 'craigslist', 'nextdoor', 'thumbtack', 'other'] },
          revenue: { type: 'number' },
          labor: { type: 'number' },
          gas: { type: 'number' },
          dumpFee: { type: 'number' },
          dumpsterRental: { type: 'number' },
          additionalExpense: { type: 'number' },
          numWorkers: { type: 'integer' },
          costPerWorker: { type: 'number' },
          notes: { type: 'string' }
        },
        required: ['date', 'customerName', 'revenue']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_quote',
      description: 'Create a quote for a customer based on job description',
      parameters: {
        type: 'object',
        properties: {
          customerName: { type: 'string' },
          customerPhone: { type: 'string' },
          customerEmail: { type: 'string' },
          customerAddress: { type: 'string' },
          jobDescription: { type: 'string' },
          estimateLow: { type: 'number' },
          estimateHigh: { type: 'number' }
        },
        required: ['customerName', 'jobDescription', 'estimateLow', 'estimateHigh']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'log_expense',
      description: 'Log a fixed expense (monthly or yearly)',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          amount: { type: 'number' },
          frequency: { type: 'string', enum: ['monthly', 'yearly'] },
          category: { type: 'string', enum: ['vehicle', 'insurance', 'software', 'marketing', 'other'] }
        },
        required: ['name', 'amount', 'frequency']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_performance_stats',
      description: 'Get business performance metrics for a time period',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['today', 'this_week', 'this_month', 'last_month', 'this_year', 'custom'] },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' }
        },
        required: ['period']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_pending_follow_ups',
      description: 'Get list of quotes that need follow-up',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['all', 'hot', 'warm', 'cold'] },
          limit: { type: 'integer', default: 10 }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'suggest_quote_price',
      description: 'Get AI-suggested pricing for a job based on historical data',
      parameters: {
        type: 'object',
        properties: {
          jobDescription: { type: 'string' },
          estimatedHours: { type: 'number' },
          loadSize: { type: 'string', enum: ['quarter', 'half', 'three_quarter', 'full', 'multiple'] }
        },
        required: ['jobDescription']
      }
    }
  }
];
```

**Function Handlers:** `src/lib/openai/handlers.ts`
```typescript
export async function handleFunctionCall(
  functionName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<string> {
  switch (functionName) {
    case 'create_job':
      return await createJob(args, userId);
    case 'generate_quote':
      return await generateQuote(args, userId);
    case 'log_expense':
      return await logExpense(args, userId);
    case 'get_performance_stats':
      return await getPerformanceStats(args, userId);
    case 'get_pending_follow_ups':
      return await getPendingFollowUps(args, userId);
    case 'suggest_quote_price':
      return await suggestQuotePrice(args, userId);
    default:
      throw new Error(`Unknown function: ${functionName}`);
  }
}
```

**Files to Create:**
- `src/lib/openai/functions.ts`
- `src/lib/openai/handlers.ts`

---

#### Unit 2.3: AI Chat UI Component (6 hours)

**Component:** `src/components/app/Assistant.tsx`
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  createdAt: Date;
}

interface Thread {
  id: string;
  title: string;
  lastMessageAt: Date;
  messageCount: number;
}

// Features:
// - Thread list sidebar
// - Message history with auto-scroll
// - Input with send button + Enter to submit
// - Function call results displayed as cards
// - New conversation button
// - Thread title auto-generation from first message
```

**UI Structure:**
```
┌───────────────────────────────────────────────────────────────┐
│ 💬 Dyia Assistant                                      [+ New] │
├─────────────┬─────────────────────────────────────────────────┤
│ Threads     │  Thread: "Help with pricing"                    │
│             │ ─────────────────────────────────────────────── │
│ > Today     │  🤖 Hi! I'm Dyia, your business assistant.     │
│   Pricing   │     I can help you log jobs, create quotes,    │
│   help      │     track expenses, and analyze your business. │
│             │                                                 │
│ > Yesterday │  👤 I need to log a job from today             │
│   Monthly   │                                                 │
│   report    │  🤖 Sure! Tell me about the job:               │
│             │     - Customer name                             │
│             │     - Revenue amount                            │
│             │     - Any expenses?                             │
│             │                                                 │
│             │  👤 John Smith, $450, $50 dump fee              │
│             │                                                 │
│             │  🤖 ✅ Job logged successfully!                 │
│             │     ┌────────────────────────┐                  │
│             │     │ Customer: John Smith   │                  │
│             │     │ Revenue: $450          │                  │
│             │     │ Dump Fee: $50          │                  │
│             │     │ Profit: $400           │                  │
│             │     └────────────────────────┘                  │
│             │                                                 │
├─────────────┴─────────────────────────────────────────────────┤
│ [Type your message...                                ] [Send] │
└───────────────────────────────────────────────────────────────┘
```

**Files to Create:**
- `src/components/app/Assistant.tsx`
- `src/components/app/MessageBubble.tsx`
- `src/components/app/ThreadList.tsx`
- `src/components/app/ToolResultCard.tsx`

---

#### Unit 2.4: AI Insights Engine (6 hours)

**Report Generation with Anthropic:**

**API Route:** `/api/ai/insights/route.ts`
```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const { userId, reportType } = await req.json();

  // 1. Fetch user data for context
  const userData = await getUserInsightsData(userId);

  // 2. Generate report with Claude
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: INSIGHTS_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: formatInsightsPrompt(reportType, userData)
    }]
  });

  // 3. Parse and structure response
  return NextResponse.json({
    report: response.content[0].text,
    generatedAt: new Date().toISOString(),
    dataRange: userData.dateRange
  });
}
```

**System Prompt:** `src/lib/anthropic/prompts.ts`
```typescript
export const INSIGHTS_SYSTEM_PROMPT = `You are Dyia's business insights analyst. Generate clear, actionable insights for service business owners (junk removal, lawn care, cleaning).

Guidelines:
- Use plain language, no jargon
- Focus on actionable recommendations
- Highlight trends and patterns
- Be encouraging but honest
- Keep insights concise (3-5 key points)
- Include specific numbers from the data
- Suggest concrete next steps

Format your response as:
## Weekly Summary
[2-3 sentence overview]

## Key Metrics
- Revenue: $X (↑/↓ X% vs last week)
- Profit: $X (margin: X%)
- Jobs completed: X
- Avg job value: $X

## What's Working
[1-2 positive observations with specifics]

## Opportunities
[1-2 areas for improvement with specific suggestions]

## Action Items
1. [Specific, actionable recommendation]
2. [Specific, actionable recommendation]
`;
```

**Insights Types:**
- `weekly_summary` – Weekly performance overview
- `monthly_analysis` – Monthly deep dive with trends
- `quote_follow_up` – Conversion analysis and recommendations
- `expense_review` – Cost optimization suggestions

**Files to Create:**
- `src/app/api/ai/insights/route.ts`
- `src/lib/anthropic/client.ts`
- `src/lib/anthropic/prompts.ts`

---

#### Unit 2.5: Revenue Forecasting (4 hours)

**API Route:** `/api/ai/forecast/route.ts`
```typescript
// Simple forecasting model using historical data + seasonality

interface ForecastResult {
  predictedRevenue: number;
  confidence: 'low' | 'medium' | 'high';
  factors: string[];
  comparisonToGoal: {
    goalAmount: number;
    percentageOfGoal: number;
    onTrack: boolean;
  };
}

export async function POST(req: Request) {
  const { userId, targetMonth } = await req.json();

  // 1. Get historical data (last 6-12 months)
  const history = await getJobHistory(userId, 12);

  // 2. Calculate trends
  const avgMonthlyRevenue = calculateMonthlyAverages(history);
  const growthRate = calculateGrowthRate(history);
  const seasonality = detectSeasonality(history);

  // 3. Generate forecast
  const forecast = generateForecast(avgMonthlyRevenue, growthRate, seasonality, targetMonth);

  // 4. Use OpenAI to explain the forecast
  const explanation = await explainForecast(forecast, history);

  return NextResponse.json({ forecast, explanation });
}
```

**Files to Create:**
- `src/app/api/ai/forecast/route.ts`
- `src/lib/forecasting/index.ts`

---

### Sprint 3: Notifications + Polish (10 hours)

#### Unit 3.1: Resend Integration (4 hours)

**Setup:** `src/lib/resend/client.ts`
```typescript
import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);

// Email types:
// - welcome: New user signup
// - trial_ending: 2 days before trial ends
// - trial_ended: Trial expired, downgrade notice
// - weekly_insights: Pro users get weekly email
// - follow_up_reminder: Quote needs attention
// - subscription_confirmed: Payment successful
// - subscription_canceled: Cancellation confirmation
```

**Email Templates:** `src/lib/resend/templates/`
```typescript
// src/lib/resend/templates/welcome.tsx
export const WelcomeEmail = ({ firstName }: { firstName: string }) => (
  <Html>
    <Head />
    <Body style={main}>
      <Container>
        <Img src="https://dyia.io/logo.png" alt="Dyia" />
        <Heading>Welcome to Dyia, {firstName}! 🎉</Heading>
        <Text>
          You're on your way to taking control of your business finances.
        </Text>
        <Button href="https://dyia.io/app">
          Get Started
        </Button>
      </Container>
    </Body>
  </Html>
);

// src/lib/resend/templates/weekly-insights.tsx
export const WeeklyInsightsEmail = ({
  firstName,
  insights
}: {
  firstName: string;
  insights: InsightsReport;
}) => (
  <Html>
    <Head />
    <Body style={main}>
      <Container>
        <Heading>Your Weekly Business Insights</Heading>
        <Text>Hi {firstName}, here's your weekly performance summary:</Text>

        <Section>
          <Heading as="h2">Revenue: ${insights.revenue}</Heading>
          <Text>{insights.revenueChange}% vs last week</Text>
        </Section>

        <Section>
          <Heading as="h2">Key Insights</Heading>
          {insights.keyPoints.map((point, i) => (
            <Text key={i}>• {point}</Text>
          ))}
        </Section>

        <Button href="https://dyia.io/app">
          View Full Dashboard
        </Button>
      </Container>
    </Body>
  </Html>
);
```

**API Routes:**
```typescript
// /api/notifications/send/route.ts
export async function POST(req: Request) {
  const { type, userId, data } = await req.json();

  const user = await getUser(userId);

  switch (type) {
    case 'welcome':
      await resend.emails.send({
        from: 'Dyia <hello@dyia.io>',
        to: user.email,
        subject: 'Welcome to Dyia! 🎉',
        react: WelcomeEmail({ firstName: user.first_name })
      });
      break;
    // ... other types
  }
}
```

**Cron Job for Weekly Insights:**
```typescript
// /api/cron/weekly-insights/route.ts
// Triggered by Vercel Cron: every Monday at 8am

export async function GET(req: Request) {
  // Verify cron secret
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get all Pro users
  const proUsers = await getProUsers();

  // Generate and send insights for each
  for (const user of proUsers) {
    const insights = await generateWeeklyInsights(user.id);
    await sendWeeklyInsightsEmail(user, insights);
  }

  return NextResponse.json({ sent: proUsers.length });
}
```

**Files to Create:**
- `src/lib/resend/client.ts`
- `src/lib/resend/templates/welcome.tsx`
- `src/lib/resend/templates/weekly-insights.tsx`
- `src/lib/resend/templates/trial-ending.tsx`
- `src/lib/resend/templates/follow-up-reminder.tsx`
- `src/app/api/notifications/send/route.ts`
- `src/app/api/cron/weekly-insights/route.ts`

---

#### Unit 3.2: Trial Management (3 hours)

**Trial Flow:**
```
User Signs Up
      │
      ▼
┌─────────────────┐
│ 7-Day Pro Trial │ subscription_status = 'trialing'
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
Day 5:    Day 7:
Email     Check subscription
"2 days   ├─ Paid → Active Pro
left"     └─ Not paid → Downgrade to Basic
```

**Webhook Enhancement:** `src/app/api/stripe/webhook/route.ts`
```typescript
// Add trial handling
case 'customer.subscription.trial_will_end':
  // Send trial ending email (2 days before)
  await sendTrialEndingEmail(subscription.customer);
  break;

case 'customer.subscription.updated':
  if (subscription.status === 'active' && previousAttributes?.status === 'trialing') {
    // Trial converted to paid
    await sendSubscriptionConfirmedEmail(subscription.customer);
  }
  break;
```

**UI Component:** Trial countdown banner
```typescript
// src/components/app/TrialBanner.tsx
const TrialBanner = () => {
  const { tier, daysRemaining } = useSubscription();

  if (tier !== 'trial') return null;

  return (
    <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-3">
      <p className="text-center">
        ⏳ {daysRemaining} days left in your Pro trial •
        <button className="underline ml-2">Upgrade Now</button>
      </p>
    </div>
  );
};
```

**Files to Create:**
- `src/components/app/TrialBanner.tsx`

**Files to Modify:**
- `src/app/api/stripe/webhook/route.ts` – Add trial events
- `src/app/app/layout.tsx` – Add TrialBanner

---

#### Unit 3.3: Final QA & Polish (3 hours)

**Test Scenarios:**
1. **Basic Tier Flow:**
   - Sign up → Dashboard access → Jobs/Quotes work → AI features locked

2. **Pro Trial Flow:**
   - Sign up → 7-day trial starts → All features available → Day 5 email → Day 7 downgrade

3. **Pro Upgrade Flow:**
   - Basic user → Click upgrade → Stripe checkout → Immediate Pro access

4. **Pro Downgrade Flow:**
   - Pro user → Cancel subscription → Access until period end → Downgrade to Basic

5. **AI Assistant:**
   - Create job via chat → Verify job in Jobs list
   - Generate quote via chat → Verify quote in Quotes list
   - Ask for stats → Verify data accuracy

6. **Email Delivery:**
   - Welcome email on signup
   - Weekly insights email (Pro only)
   - Trial ending reminder

**Polish Checklist:**
- [ ] Mobile responsiveness audit
- [ ] Loading states for all async operations
- [ ] Error handling with user-friendly messages
- [ ] Empty states for new users
- [ ] Tooltip hints for new features
- [ ] Keyboard navigation
- [ ] Form validation feedback

---

## 5. AI Integration Specification

### 5.1 OpenAI Configuration

**Model:** `gpt-5.2` via Responses API
**Use Cases:** Chat assistant, function calling, quote suggestions

**Assistant Setup:**
```typescript
// One-time setup via OpenAI API
const assistant = await openai.beta.assistants.create({
  name: 'Dyia Business Assistant',
  instructions: `You are Dyia, a friendly and knowledgeable business assistant for service business owners (junk removal, lawn care, cleaning, etc.).

Your capabilities:
- Log jobs with revenue and expenses
- Create quotes for customers
- Track fixed expenses
- Provide performance statistics
- Suggest pricing based on historical data
- Help with follow-up strategy

Personality:
- Friendly but professional
- Concise and action-oriented
- Encouraging without being cheesy
- Use numbers and specifics
- Celebrate wins, be constructive about improvements

When users ask to log a job or create a quote, always confirm the details before executing.
When providing stats, include comparison to goals and trends.`,
  model: 'gpt-5.2',
  tools: DYIA_FUNCTIONS
});
```

**Token Optimization:**
- System prompt: ~200 tokens (cached)
- Average user message: ~30 tokens
- Average response: ~100 tokens
- Function call overhead: ~50 tokens
- **Estimated cost per interaction:** $0.002-0.003

### 5.2 Anthropic Configuration

**Model:** `claude-sonnet-4-20250514`
**Use Cases:** Report generation, insights analysis, complex reasoning

**Why Anthropic for Reports:**
- Superior long-form writing quality
- Better at structured analysis
- More nuanced business insights
- Cost-effective for batch operations

**Token Optimization:**
- Weekly insights: ~500 input + ~800 output tokens
- Monthly analysis: ~1000 input + ~1500 output tokens
- **Estimated cost per report:** $0.008-0.015

---

## 6. Thread Persistence System

### 6.1 Data Model

```sql
-- Thread stores conversation metadata
CREATE TABLE dyia_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES dyia_users(id) ON DELETE CASCADE,
  openai_thread_id VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) DEFAULT 'New Conversation',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages stores local copy for quick loading + offline access
CREATE TABLE dyia_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES dyia_threads(id) ON DELETE CASCADE,
  openai_message_id VARCHAR(255),
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_results JSONB,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX idx_threads_user_id ON dyia_threads(user_id);
CREATE INDEX idx_threads_last_message ON dyia_threads(last_message_at DESC);
CREATE INDEX idx_messages_thread_id ON dyia_messages(thread_id);
CREATE INDEX idx_messages_created_at ON dyia_messages(created_at);
```

### 6.2 Thread Lifecycle

```
User Opens Assistant
        │
        ▼
┌───────────────────┐
│ Load Thread List  │ SELECT * FROM dyia_threads WHERE user_id = ? ORDER BY last_message_at DESC
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
[New Chat]  [Resume Thread]
    │           │
    ▼           ▼
Create      Load Messages
OpenAI      from dyia_messages
Thread      + sync with OpenAI
    │           │
    └─────┬─────┘
          ▼
    User Sends Message
          │
          ▼
    ┌─────────────────┐
    │ 1. Save to DB   │
    │ 2. Send to API  │
    │ 3. Stream resp  │
    │ 4. Save resp    │
    │ 5. Update meta  │
    └─────────────────┘
```

### 6.3 Thread Title Generation

```typescript
// Auto-generate title from first user message
async function generateThreadTitle(firstMessage: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: `Generate a 3-5 word title for a conversation that starts with: "${firstMessage}". Return only the title, no quotes.`
    }],
    max_tokens: 20
  });

  return response.choices[0].message.content || 'New Conversation';
}
```

---

## 7. Resend Notification System

### 7.1 Email Types & Triggers

| Email Type | Trigger | Audience | Frequency |
|------------|---------|----------|-----------|
| Welcome | User signup | All | Once |
| Trial Ending | 2 days before trial ends | Trial users | Once |
| Trial Ended | Trial expires | Trial → Basic | Once |
| Weekly Insights | Monday 8am | Pro users | Weekly |
| Monthly Report | 1st of month | Pro users | Monthly |
| Follow-up Reminder | Quote > 3 days old | All users | As needed |
| Subscription Confirmed | Payment successful | New Pro | Once |
| Subscription Canceled | Cancellation | Former Pro | Once |
| Payment Failed | Payment fails | Pro users | As needed |

### 7.2 Resend Configuration

```typescript
// Environment variables
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=hello@dyia.io
RESEND_REPLY_TO=support@dyia.io
```

**Domain Setup:**
1. Add `dyia.io` to Resend
2. Configure DNS records (DKIM, SPF, DMARC)
3. Verify domain ownership
4. Enable click/open tracking

### 7.3 Retention Strategy

**Engagement Emails:**
```typescript
// Weekly engagement check - sent to inactive users
async function sendEngagementReminder(userId: string) {
  const lastActivity = await getLastActivity(userId);
  const daysSinceActive = differenceInDays(new Date(), lastActivity);

  if (daysSinceActive >= 7 && daysSinceActive < 14) {
    // Week 1: Gentle reminder
    await sendEmail('engagement_week1', userId);
  } else if (daysSinceActive >= 14 && daysSinceActive < 30) {
    // Week 2-4: Value proposition reminder
    await sendEmail('engagement_week2', userId);
  } else if (daysSinceActive >= 30) {
    // Month+: Win-back offer
    await sendEmail('engagement_winback', userId);
  }
}
```

**Email Preference Center:**
```typescript
// Store user email preferences
interface EmailPreferences {
  weeklyInsights: boolean;
  followUpReminders: boolean;
  productUpdates: boolean;
  marketingEmails: boolean;
}
```

---

## 8. Database Schema Changes

### 8.1 Complete Migration File

```sql
-- Migration: 003_mvp_sprint.sql
-- Sprint 1-3 database changes

-- ============================================
-- FIXED EXPENSES
-- ============================================
CREATE TABLE dyia_fixed_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('monthly', 'yearly')),
  category VARCHAR(50) DEFAULT 'other',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fixed_expenses_user_id ON dyia_fixed_expenses(user_id);

-- ============================================
-- FOLLOW-UPS
-- ============================================
CREATE TABLE dyia_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES dyia_quotes(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'converted', 'lost', 'snoozed')),
  last_contacted_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  notes TEXT,
  contact_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_follow_ups_user_id ON dyia_follow_ups(user_id);
CREATE INDEX idx_follow_ups_quote_id ON dyia_follow_ups(quote_id);
CREATE INDEX idx_follow_ups_status ON dyia_follow_ups(status);

-- ============================================
-- PRICE TEMPLATES
-- ============================================
CREATE TABLE dyia_price_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  prices JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_price_templates_user_id ON dyia_price_templates(user_id);

-- ============================================
-- AI THREADS
-- ============================================
CREATE TABLE dyia_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  openai_thread_id VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) DEFAULT 'New Conversation',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_threads_user_id ON dyia_threads(user_id);
CREATE INDEX idx_threads_last_message ON dyia_threads(last_message_at DESC);

-- ============================================
-- AI MESSAGES
-- ============================================
CREATE TABLE dyia_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES dyia_threads(id) ON DELETE CASCADE,
  openai_message_id VARCHAR(255),
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_results JSONB,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_thread_id ON dyia_messages(thread_id);
CREATE INDEX idx_messages_created_at ON dyia_messages(created_at);

-- ============================================
-- AI INSIGHTS CACHE
-- ============================================
CREATE TABLE dyia_insights_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  report_type VARCHAR(50) NOT NULL,
  report_data JSONB NOT NULL,
  data_hash VARCHAR(64), -- Hash of input data for cache invalidation
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 week'
);

CREATE INDEX idx_insights_cache_user_id ON dyia_insights_cache(user_id);
CREATE INDEX idx_insights_cache_type ON dyia_insights_cache(report_type);

-- ============================================
-- EMAIL LOGS
-- ============================================
CREATE TABLE dyia_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES dyia_users(id) ON DELETE SET NULL,
  email_type VARCHAR(50) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  resend_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'sent',
  metadata JSONB DEFAULT '{}',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_logs_user_id ON dyia_email_logs(user_id);
CREATE INDEX idx_email_logs_type ON dyia_email_logs(email_type);

-- ============================================
-- USER PREFERENCES
-- ============================================
ALTER TABLE dyia_settings ADD COLUMN IF NOT EXISTS
  email_preferences JSONB DEFAULT '{
    "weeklyInsights": true,
    "followUpReminders": true,
    "productUpdates": true,
    "marketingEmails": false
  }';

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_fixed_expenses_updated_at
  BEFORE UPDATE ON dyia_fixed_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_follow_ups_updated_at
  BEFORE UPDATE ON dyia_follow_ups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_price_templates_updated_at
  BEFORE UPDATE ON dyia_price_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_threads_updated_at
  BEFORE UPDATE ON dyia_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 9. API Route Specifications

### 9.1 New API Routes

| Route | Method | Description | Auth |
|-------|--------|-------------|------|
| `/api/ai/chat` | POST | Send message to AI assistant | Pro |
| `/api/ai/insights` | POST | Generate AI insights report | Pro |
| `/api/ai/forecast` | POST | Get revenue forecast | Pro |
| `/api/ai/suggest-price` | POST | Get AI quote suggestion | Pro |
| `/api/threads` | GET | List user's threads | Pro |
| `/api/threads/[id]` | GET | Get thread with messages | Pro |
| `/api/threads/[id]` | DELETE | Archive thread | Pro |
| `/api/fixed-expenses` | GET/POST | CRUD fixed expenses | All |
| `/api/fixed-expenses/[id]` | PATCH/DELETE | Update/delete expense | All |
| `/api/follow-ups` | GET | List follow-ups | All |
| `/api/follow-ups/[id]` | PATCH | Update follow-up status | All |
| `/api/price-templates` | GET/POST | CRUD price templates | All |
| `/api/notifications/send` | POST | Send notification | Internal |
| `/api/cron/weekly-insights` | GET | Cron: weekly emails | Cron |
| `/api/cron/trial-check` | GET | Cron: trial expiry check | Cron |

### 9.2 Route Implementations

**AI Chat Route:**
```typescript
// /api/ai/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { auth } from '@clerk/nextjs/server';
import { checkProAccess } from '@/lib/subscription';
import { DYIA_FUNCTIONS, handleFunctionCall } from '@/lib/openai/functions';

const openai = new OpenAI();

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isPro = await checkProAccess(userId);
  if (!isPro) {
    return NextResponse.json({ error: 'Pro subscription required' }, { status: 403 });
  }

  const { threadId, message } = await req.json();

  try {
    // Get or create thread
    let thread = await getOrCreateThread(userId, threadId);

    // Add user message
    await openai.beta.threads.messages.create(thread.openai_thread_id, {
      role: 'user',
      content: message
    });

    // Save to local DB
    await saveMessage(thread.id, 'user', message);

    // Run assistant
    const run = await openai.beta.threads.runs.create(thread.openai_thread_id, {
      assistant_id: process.env.OPENAI_ASSISTANT_ID!,
    });

    // Poll for completion (or use streaming)
    let runStatus = await openai.beta.threads.runs.retrieve(
      thread.openai_thread_id,
      run.id
    );

    while (runStatus.status === 'queued' || runStatus.status === 'in_progress') {
      await new Promise(resolve => setTimeout(resolve, 500));
      runStatus = await openai.beta.threads.runs.retrieve(
        thread.openai_thread_id,
        run.id
      );
    }

    // Handle function calls
    if (runStatus.status === 'requires_action') {
      const toolCalls = runStatus.required_action?.submit_tool_outputs.tool_calls || [];
      const toolOutputs = [];

      for (const toolCall of toolCalls) {
        const result = await handleFunctionCall(
          toolCall.function.name,
          JSON.parse(toolCall.function.arguments),
          userId
        );
        toolOutputs.push({
          tool_call_id: toolCall.id,
          output: JSON.stringify(result)
        });
      }

      // Submit tool outputs
      await openai.beta.threads.runs.submitToolOutputs(
        thread.openai_thread_id,
        run.id,
        { tool_outputs: toolOutputs }
      );

      // Continue polling...
    }

    // Get assistant response
    const messages = await openai.beta.threads.messages.list(thread.openai_thread_id);
    const assistantMessage = messages.data[0];

    // Save assistant message
    await saveMessage(thread.id, 'assistant', assistantMessage.content[0].text.value);

    // Update thread metadata
    await updateThreadMetadata(thread.id);

    return NextResponse.json({
      threadId: thread.id,
      message: assistantMessage.content[0].text.value
    });

  } catch (error) {
    console.error('AI Chat error:', error);
    return NextResponse.json({ error: 'Failed to process message' }, { status: 500 });
  }
}
```

---

## 10. Deployment & Infrastructure

### 10.1 Environment Variables

```bash
# .env.local additions

# OpenAI
OPENAI_API_KEY=sk-xxxx
OPENAI_ASSISTANT_ID=asst_xxxx

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxxx

# Resend
RESEND_API_KEY=re_xxxx
RESEND_FROM_EMAIL=hello@dyia.io

# Cron
CRON_SECRET=xxxx

# Feature Flags
ENABLE_AI_FEATURES=true
ENABLE_PRO_TRIAL=true
PRO_TRIAL_DAYS=7
```

### 10.2 Vercel Cron Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/weekly-insights",
      "schedule": "0 13 * * 1"  // Monday 8am EST (13:00 UTC)
    },
    {
      "path": "/api/cron/trial-check",
      "schedule": "0 12 * * *"  // Daily at 7am EST
    },
    {
      "path": "/api/cron/follow-up-reminders",
      "schedule": "0 14 * * *"  // Daily at 9am EST
    }
  ]
}
```

### 10.3 Cost Projections

| Service | Per User/Month | 1000 Users |
|---------|----------------|------------|
| OpenAI (GPT-5.2) | ~$0.50 | $500 |
| Anthropic (Claude) | ~$0.10 | $100 |
| Resend (emails) | ~$0.01 | $10 |
| Supabase (DB) | Fixed | $25 |
| Vercel (hosting) | Fixed | $20 |
| **Total** | | **~$655/mo** |

---

## Appendix A: File Creation Checklist

### New Files to Create

```
src/
├── app/
│   └── api/
│       ├── ai/
│       │   ├── chat/route.ts
│       │   ├── insights/route.ts
│       │   ├── forecast/route.ts
│       │   └── suggest-price/route.ts
│       ├── threads/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── fixed-expenses/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── follow-ups/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── price-templates/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── notifications/
│       │   └── send/route.ts
│       └── cron/
│           ├── weekly-insights/route.ts
│           ├── trial-check/route.ts
│           └── follow-up-reminders/route.ts
├── components/
│   ├── app/
│   │   ├── Assistant.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── ThreadList.tsx
│   │   ├── ToolResultCard.tsx
│   │   ├── FixedExpenses.tsx
│   │   ├── FollowUps.tsx
│   │   ├── PriceTemplates.tsx
│   │   ├── TrialBanner.tsx
│   │   └── AIInsights.tsx
│   └── ui/
│       └── ProFeature.tsx
├── hooks/
│   └── useSubscription.ts
├── lib/
│   ├── openai/
│   │   ├── client.ts
│   │   ├── functions.ts
│   │   └── handlers.ts
│   ├── anthropic/
│   │   ├── client.ts
│   │   └── prompts.ts
│   ├── resend/
│   │   ├── client.ts
│   │   └── templates/
│   │       ├── welcome.tsx
│   │       ├── weekly-insights.tsx
│   │       ├── trial-ending.tsx
│   │       └── follow-up-reminder.tsx
│   └── forecasting/
│       └── index.ts
└── types/
    └── database.ts (modify)

supabase/
└── migrations/
    └── 003_mvp_sprint.sql
```

### Files to Modify

```
src/app/app/page.tsx         # Add new tabs
src/app/app/layout.tsx       # Add TrialBanner
src/app/page.tsx             # Update pricing
src/components/app/Dashboard.tsx    # Add AI insights, fixed expenses
src/components/app/Settings.tsx     # Add price templates section
src/components/app/Sidebar.tsx      # Add Assistant nav item
src/components/app/QuoteBuilder.tsx # Auto-fill from template
src/types/database.ts        # Add new interfaces
src/lib/utils.ts             # Add expense calculations
```

---

## Appendix B: Sprint Schedule

### Week 1: Jan 28-31 (Sprint 1)

| Day | Focus | Hours |
|-----|-------|-------|
| Tue 28 | Unit 1.1: Fixed Expenses DB + UI | 6 |
| Wed 29 | Unit 1.2: Follow-Up System | 8 |
| Thu 30 | Unit 1.3: Tier Gating + Dashboard Polish | 6 |
| Fri 31 | Unit 1.4: Price Templates | 5 |

### Week 2: Feb 1-3 (Sprint 2 + 3)

| Day | Focus | Hours |
|-----|-------|-------|
| Sat 1 | Unit 2.1-2.2: AI Infrastructure + Functions | 14 |
| Sun 2 | Unit 2.3-2.5: AI Chat UI + Insights + Forecast | 16 |
| Mon 3 | Unit 3.1-3.3: Resend + Trial + QA | 10 |

---

**Document Version:** 1.0
**Last Updated:** January 27, 2026
**Author:** Dev Ganugapenta

---

*This document serves as the single source of truth for the Dyia MVP sprint. All implementation should reference this spec for requirements and architecture decisions.*
