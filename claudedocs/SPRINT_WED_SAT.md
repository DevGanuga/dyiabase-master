# Dyia MVP Sprint: Wed Jan 28 - Sat Feb 1

**Start:** Wednesday, January 28, 5:00 PM  
**Deadline:** Saturday, February 1, 11:59 PM  
**Available Time:** ~40 hours (assuming 10-12 hours/day)

---

## Priority Matrix

| Priority | Feature | Est. Hours | Status |
|----------|---------|------------|--------|
| P0 | Fixed Expenses | 5h | ⬜ |
| P0 | Follow-Up System | 6h | ⬜ |
| P0 | Tier Gating (useSubscription + ProFeature) | 3h | ⬜ |
| P0 | Price Templates | 4h | ⬜ |
| P1 | AI Chat Infrastructure | 6h | ⬜ |
| P1 | AI Function Handlers | 4h | ⬜ |
| P1 | AI Chat UI | 5h | ⬜ |
| P2 | AI Insights (Anthropic) | 3h | ⬜ |
| P2 | Resend Email Setup | 2h | ⬜ |
| P3 | Revenue Forecasting | 3h | ⬜ |
| P3 | Email Templates | 2h | ⬜ |
| P3 | Cron Jobs | 2h | ⬜ |

**Total Core (P0-P1):** ~33 hours  
**Total All:** ~45 hours

---

## Day 1: Wednesday, Jan 28 (5pm-12am = 6-7 hours)

### Focus: Fixed Expenses + Database Setup

#### Task 1.1: Database Migrations
**File:** `supabase/migrations/003_mvp_sprint.sql`

- [ ] Create `dyia_fixed_expenses` table
- [ ] Create `dyia_follow_ups` table  
- [ ] Create `dyia_price_templates` table
- [ ] Create `dyia_threads` table
- [ ] Create `dyia_messages` table
- [ ] Add `updated_at` triggers
- [ ] Run migration in Supabase

```sql
-- Run this in Supabase SQL Editor
-- Full SQL is in TECHNICAL_SPEC.md Section 8.1
```

#### Task 1.2: TypeScript Types
**File:** `src/types/database.ts`

- [ ] Add `FixedExpense` interface
- [ ] Add `FixedExpenseInsert` type
- [ ] Add `FollowUp` interface  
- [ ] Add `FollowUpWithQuote` interface
- [ ] Add `PriceTemplate` interface
- [ ] Add `Thread` interface
- [ ] Add `Message` interface

#### Task 1.3: Utility Functions
**File:** `src/lib/utils.ts`

- [ ] Add `calculateMonthlyFixedExpenses()`
- [ ] Add `calculateYearlyFixedExpenses()`
- [ ] Add `groupExpensesByCategory()`

#### Task 1.4: FixedExpenses Component
**File:** `src/components/app/FixedExpenses.tsx`

- [ ] Create component with state management
- [ ] Implement CRUD operations (add/edit/delete)
- [ ] Toggle active/inactive
- [ ] Show monthly total
- [ ] Category selection with emojis
- [ ] Frequency selection (monthly/yearly)

**Acceptance Criteria:**
- [ ] Can add new expense
- [ ] Can edit existing expense  
- [ ] Can delete expense
- [ ] Can toggle active/inactive
- [ ] Monthly total shows correctly

---

## Day 2: Thursday, Jan 29 (10-12 hours)

### Focus: Follow-Ups + Tier Gating

#### Task 2.1: FollowUps Component
**File:** `src/components/app/FollowUps.tsx`

- [ ] Create component with state management
- [ ] Load quotes with follow-up status
- [ ] Priority badges (Hot 🔥 / Warm 🌡️ / Cold ❄️)
- [ ] Click-to-call phone links
- [ ] Copy follow-up message to clipboard
- [ ] Status update (contacted/converted/lost/snoozed)
- [ ] Snooze with date picker
- [ ] Notes field
- [ ] Filter by status/priority

```typescript
// Priority calculation:
// Hot = 0-3 days since quote
// Warm = 3-7 days since quote  
// Cold = 7+ days since quote
```

**Message Template:**
```typescript
function generateFollowUpMessage(quote, businessName) {
  return `Hi ${quote.customer.name}! This is ${businessName} following up on the estimate we provided for your ${quote.customer.jobDescription}. The estimate was $${quote.estimateRange.low}-$${quote.estimateRange.high}. Would you like to schedule this job? Let me know if you have any questions!`;
}
```

#### Task 2.2: Tab Integration
**File:** `src/app/app/page.tsx`

- [ ] Add "Follow-ups" tab to main navigation
- [ ] Import and render FollowUps component
- [ ] Pass required props (userId)

#### Task 2.3: useSubscription Hook
**File:** `src/hooks/useSubscription.ts`

- [ ] Create hook
- [ ] Fetch subscription data from `dyia_users`
- [ ] Calculate tier (basic/pro/trial)
- [ ] Calculate days remaining for trial
- [ ] Return `{ tier, status, plan, daysRemaining, isPro, isLoading }`

#### Task 2.4: ProFeature Component
**File:** `src/components/ui/ProFeature.tsx`

- [ ] Create wrapper component
- [ ] Show blur overlay for non-Pro users
- [ ] Show "Upgrade to Pro" button
- [ ] Loading state while checking subscription

#### Task 2.5: TrialBanner Component
**File:** `src/components/app/TrialBanner.tsx`

- [ ] Create banner component
- [ ] Show days remaining
- [ ] Urgent styling for ≤2 days
- [ ] Link to pricing page
- [ ] Only show for trial users

#### Task 2.6: Dashboard Integration
**File:** `src/components/app/Dashboard.tsx`

- [ ] Add fixed expenses summary card
- [ ] Show monthly fixed expenses total
- [ ] Add AI insights placeholder (gated with ProFeature)
- [ ] Include fixed expenses in net profit calculation

**Acceptance Criteria:**
- [ ] Follow-ups tab shows unconverted quotes
- [ ] Priority badges calculate correctly
- [ ] Copy message works
- [ ] useSubscription returns correct tier
- [ ] ProFeature gates content for Basic users
- [ ] Trial banner shows for trialing users

---

## Day 3: Friday, Jan 30 (10-12 hours)

### Focus: Price Templates + AI Infrastructure

#### Task 3.1: PriceTemplates Component
**File:** `src/components/app/PriceTemplates.tsx`

- [ ] Create settings panel UI
- [ ] Fields: minimum fee, load sizes, labor rate, dump fee
- [ ] Surcharges section (trampoline, hot tub, piano)
- [ ] Save/update template
- [ ] Set as default template
- [ ] Delete template

```typescript
// Default template structure:
interface PriceTemplate {
  minimumFee: number;
  quarterLoad: number;
  halfLoad: number;
  threeQuarterLoad: number;
  fullLoad: number;
  additionalLoads: number;
  laborPerHour: number;
  dumpFee: number;
  surcharges: {
    trampoline: number;
    hotTub: number;
    piano: number;
  }
}
```

#### Task 3.2: QuoteBuilder Integration
**File:** `src/components/app/QuoteBuilder.tsx`

- [ ] Load default price template on mount
- [ ] Auto-fill pricing fields from template
- [ ] Allow override of template values

#### Task 3.3: Settings Integration
**File:** `src/components/app/Settings.tsx`

- [ ] Add "Pricing Templates" section
- [ ] Import and render PriceTemplates component

#### Task 3.4: OpenAI Client Setup
**File:** `src/lib/openai/client.ts`

- [ ] Initialize OpenAI client
- [ ] Configure for Assistants API
- [ ] Export client instance

```typescript
import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
```

#### Task 3.5: AI Function Definitions
**File:** `src/lib/openai/functions.ts`

- [ ] Define `create_job` function schema
- [ ] Define `generate_quote` function schema
- [ ] Define `log_expense` function schema
- [ ] Define `get_performance_stats` function schema
- [ ] Define `get_pending_follow_ups` function schema
- [ ] Define `suggest_quote_price` function schema
- [ ] Export `DYIA_FUNCTIONS` array

#### Task 3.6: AI Function Handlers
**File:** `src/lib/openai/handlers.ts`

- [ ] Implement `createJob()` handler
- [ ] Implement `generateQuote()` handler
- [ ] Implement `logExpense()` handler
- [ ] Implement `getPerformanceStats()` handler
- [ ] Implement `getPendingFollowUps()` handler
- [ ] Implement `suggestQuotePrice()` handler
- [ ] Export `handleFunctionCall()` router

**Acceptance Criteria:**
- [ ] Price templates save and load
- [ ] QuoteBuilder auto-fills from default template
- [ ] OpenAI client initializes without errors
- [ ] All 6 function schemas defined
- [ ] Function handlers execute Supabase operations

---

## Day 4: Saturday, Feb 1 (12-14 hours)

### Focus: AI Chat UI + Polish + Testing

#### Task 4.1: Chat API Route
**File:** `src/app/api/ai/chat/route.ts`

- [ ] Auth check (Clerk)
- [ ] Pro access check
- [ ] Get or create thread
- [ ] Send message to OpenAI
- [ ] Handle function calls
- [ ] Submit tool outputs
- [ ] Return assistant response
- [ ] Persist messages to database

#### Task 4.2: Thread Management
**File:** `src/app/api/threads/route.ts`

- [ ] GET: List user's threads
- [ ] POST: Create new thread

**File:** `src/app/api/threads/[id]/route.ts`

- [ ] GET: Get thread with messages
- [ ] DELETE: Archive thread

#### Task 4.3: ThreadList Component
**File:** `src/components/app/ThreadList.tsx`

- [ ] List threads sorted by last_message_at
- [ ] Group by date (Today, Yesterday, This Week, Older)
- [ ] Click to select thread
- [ ] New conversation button
- [ ] Thread title display

#### Task 4.4: MessageBubble Component
**File:** `src/components/app/MessageBubble.tsx`

- [ ] User message styling (right-aligned, orange)
- [ ] Assistant message styling (left-aligned, gray)
- [ ] Timestamp display
- [ ] Loading indicator for pending messages

#### Task 4.5: ToolResultCard Component
**File:** `src/components/app/ToolResultCard.tsx`

- [ ] Display function call results in card format
- [ ] Success/error styling
- [ ] Show created job/quote details
- [ ] Link to view created item

#### Task 4.6: Assistant Component
**File:** `src/components/app/Assistant.tsx`

- [ ] Thread sidebar (left)
- [ ] Message history (center)
- [ ] Input area with send button
- [ ] Enter to submit
- [ ] Auto-scroll to bottom
- [ ] Loading states
- [ ] Error handling
- [ ] New conversation flow

#### Task 4.7: Sidebar Integration
**File:** `src/components/app/Sidebar.tsx`

- [ ] Add "Dyia Assistant" nav item
- [ ] Pro badge/lock icon for Basic users

#### Task 4.8: App Page Integration
**File:** `src/app/app/page.tsx`

- [ ] Add "Assistant" tab
- [ ] Import and render Assistant component
- [ ] Gate with ProFeature wrapper

#### Task 4.9: Pricing Page Update
**File:** `src/app/page.tsx`

- [ ] Update Basic: $14.99/month
- [ ] Update Pro: $24.99/month  
- [ ] Update feature lists per tier
- [ ] Update Stripe price IDs in checkout

#### Task 4.10: Environment Variables
**File:** `.env.local`

- [ ] Add `OPENAI_API_KEY`
- [ ] Add `OPENAI_ASSISTANT_ID` (create assistant first)
- [ ] Add `ANTHROPIC_API_KEY`
- [ ] Add `RESEND_API_KEY`

#### Task 4.11: End-to-End Testing

**Test: Fixed Expenses**
- [ ] Add monthly expense → shows in list
- [ ] Add yearly expense → monthly equivalent correct
- [ ] Edit expense → changes persist
- [ ] Delete expense → removed from list
- [ ] Toggle active/inactive → total updates

**Test: Follow-ups**
- [ ] Create quote → follow-up auto-created
- [ ] Priority badge correct based on age
- [ ] Copy message → correct text in clipboard
- [ ] Mark as contacted → status updates
- [ ] Snooze → next follow-up date set

**Test: Tier Gating**
- [ ] Basic user sees "Upgrade" on AI features
- [ ] Pro user sees AI features unlocked
- [ ] Trial user sees countdown banner

**Test: AI Chat (Pro only)**
- [ ] "Log a job for John Smith, $450" → Job created
- [ ] "How did I do this week?" → Stats returned
- [ ] "Create a quote for..." → Quote generated
- [ ] Thread persists after refresh

**Acceptance Criteria:**
- [ ] AI Assistant fully functional
- [ ] All CRUD operations working
- [ ] Tier gating working correctly
- [ ] No console errors
- [ ] Mobile responsive

---

## Stretch Goals (if time permits)

### AI Insights (Anthropic)
- [ ] Create `src/lib/anthropic/client.ts`
- [ ] Create `src/lib/anthropic/prompts.ts`
- [ ] Create `src/app/api/ai/insights/route.ts`
- [ ] Create `src/components/app/AIInsights.tsx`
- [ ] Add to Dashboard (gated)

### Resend Email Setup
- [ ] Create `src/lib/resend/client.ts`
- [ ] Create welcome email template
- [ ] Create trial-ending email template
- [ ] Create `src/app/api/notifications/send/route.ts`

---

## Files to Create

```
src/
├── app/api/
│   ├── ai/
│   │   └── chat/route.ts
│   └── threads/
│       ├── route.ts
│       └── [id]/route.ts
├── components/
│   ├── app/
│   │   ├── Assistant.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── ThreadList.tsx
│   │   ├── ToolResultCard.tsx
│   │   ├── FixedExpenses.tsx
│   │   ├── FollowUps.tsx
│   │   ├── PriceTemplates.tsx
│   │   └── TrialBanner.tsx
│   └── ui/
│       └── ProFeature.tsx
├── hooks/
│   └── useSubscription.ts
└── lib/
    └── openai/
        ├── client.ts
        ├── functions.ts
        └── handlers.ts

supabase/migrations/
└── 003_mvp_sprint.sql
```

## Files to Modify

```
src/app/app/page.tsx           # Add tabs
src/app/app/layout.tsx         # Add TrialBanner
src/app/page.tsx               # Update pricing
src/components/app/Dashboard.tsx    # Add cards
src/components/app/Settings.tsx     # Add templates
src/components/app/Sidebar.tsx      # Add Assistant
src/components/app/QuoteBuilder.tsx # Template integration
src/types/database.ts          # Add interfaces
src/lib/utils.ts               # Add calculations
```

---

## Daily Progress Tracking

### Wednesday (Jan 28)
- [ ] Migrations complete
- [ ] Types added
- [ ] FixedExpenses working
- **End-of-day commit**

### Thursday (Jan 29)
- [ ] FollowUps working
- [ ] Tier gating working
- [ ] Dashboard updated
- **End-of-day commit**

### Friday (Jan 30)
- [ ] Price templates working
- [ ] AI functions defined
- [ ] Handlers implemented
- **End-of-day commit**

### Saturday (Feb 1)
- [ ] AI Chat working end-to-end
- [ ] All E2E tests passing
- [ ] Pricing updated
- **Final commit + deploy**

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| OpenAI API issues | Have fallback error messages |
| Function call complexity | Start with `create_job` only, add others incrementally |
| Time overrun on UI | Use simple styling first, polish later |
| Database migration issues | Test in Supabase dashboard first |

---

## Quick Commands

```bash
# Start dev server
npm run dev

# Run Supabase migration (after pasting SQL in dashboard)
# Go to: Supabase Dashboard → SQL Editor → New Query

# Check TypeScript
npx tsc --noEmit

# Build check
npm run build
```

---

**Let's build this. Starting with Task 1.1: Database Migrations.**
