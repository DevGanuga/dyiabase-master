# Dyia MVP – Development Plan

**Sprint Window:** January 28 – February 3, 2026
**Total Hours:** 65 hours
**Daily Target:** ~9-10 hours/day

---

## Quick Reference: Current vs Target State

| Feature | Current | Target | Gap |
|---------|---------|--------|-----|
| Fixed Expenses | ❌ None | ✅ Monthly/Yearly tracking | Full build |
| Follow-Ups | ❌ None | ✅ Quote status tracking + messages | Full build |
| Price Templates | ❌ None | ✅ Admin settings for quote pricing | Full build |
| AI Chat | ❌ None | ✅ OpenAI GPT-5.2 with functions | Full build |
| AI Insights | ❌ None | ✅ Anthropic-powered reports | Full build |
| Tier Gating | ❌ No logic | ✅ Basic/Pro feature locks | Implement |
| Email System | ❌ None | ✅ Resend integration | Full build |
| Trial Flow | ❌ Incomplete | ✅ 7-day trial with emails | Enhance |
| Pricing | $12.99/$119 | $14.99/$24.99 | Update |

---

## Day 1: Tuesday, January 28 (6 hours)

### Focus: Fixed Expenses System

#### Task 1.1: Database Migration (1 hour)
**File:** `supabase/migrations/003_fixed_expenses.sql`

```sql
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
```

**Acceptance Criteria:**
- [ ] Migration runs without errors
- [ ] Table created in Supabase dashboard
- [ ] Index visible in schema

---

#### Task 1.2: TypeScript Types (30 min)
**File:** `src/types/database.ts`

```typescript
// Add to existing file
export interface FixedExpense {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'yearly';
  category: 'vehicle' | 'insurance' | 'software' | 'marketing' | 'office' | 'other';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type FixedExpenseInsert = Omit<FixedExpense, 'id' | 'created_at' | 'updated_at'>;
```

**Acceptance Criteria:**
- [ ] Types compile without errors
- [ ] Category union covers all common expense types

---

#### Task 1.3: Utility Functions (30 min)
**File:** `src/lib/utils.ts`

```typescript
// Add to existing utils
export function calculateMonthlyFixedExpenses(expenses: FixedExpense[]): number {
  return expenses
    .filter(e => e.is_active)
    .reduce((total, expense) => {
      if (expense.frequency === 'monthly') {
        return total + expense.amount;
      } else {
        return total + (expense.amount / 12);
      }
    }, 0);
}

export function calculateYearlyFixedExpenses(expenses: FixedExpense[]): number {
  return expenses
    .filter(e => e.is_active)
    .reduce((total, expense) => {
      if (expense.frequency === 'yearly') {
        return total + expense.amount;
      } else {
        return total + (expense.amount * 12);
      }
    }, 0);
}

export function groupExpensesByCategory(expenses: FixedExpense[]): Record<string, FixedExpense[]> {
  return expenses.reduce((acc, expense) => {
    const category = expense.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(expense);
    return acc;
  }, {} as Record<string, FixedExpense[]>);
}
```

**Acceptance Criteria:**
- [ ] Monthly calculation correctly divides yearly by 12
- [ ] Yearly calculation correctly multiplies monthly by 12
- [ ] Inactive expenses are excluded

---

#### Task 1.4: FixedExpenses Component (3 hours)
**File:** `src/components/app/FixedExpenses.tsx`

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FixedExpense, FixedExpenseInsert } from '@/types/database';
import { calculateMonthlyFixedExpenses, formatCurrency } from '@/lib/utils';

interface FixedExpensesProps {
  userId: string;
  onUpdate?: () => void;
}

const CATEGORIES = [
  { value: 'vehicle', label: 'Vehicle', emoji: '🚗' },
  { value: 'insurance', label: 'Insurance', emoji: '🛡️' },
  { value: 'software', label: 'Software', emoji: '💻' },
  { value: 'marketing', label: 'Marketing', emoji: '📣' },
  { value: 'office', label: 'Office', emoji: '🏢' },
  { value: 'other', label: 'Other', emoji: '📦' },
];

export default function FixedExpenses({ userId, onUpdate }: FixedExpensesProps) {
  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<FixedExpenseInsert>>({
    name: '',
    amount: 0,
    frequency: 'monthly',
    category: 'other'
  });

  const supabase = createClient();

  const loadExpenses = useCallback(async () => {
    const { data, error } = await supabase
      .from('dyia_fixed_expenses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setExpenses(data);
    }
  }, [userId, supabase]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      // Update existing
      await supabase
        .from('dyia_fixed_expenses')
        .update(formData)
        .eq('id', editingId);
    } else {
      // Create new
      await supabase
        .from('dyia_fixed_expenses')
        .insert({ ...formData, user_id: userId });
    }

    setFormData({ name: '', amount: 0, frequency: 'monthly', category: 'other' });
    setIsAdding(false);
    setEditingId(null);
    loadExpenses();
    onUpdate?.();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('dyia_fixed_expenses').delete().eq('id', id);
    loadExpenses();
    onUpdate?.();
  };

  const handleToggleActive = async (expense: FixedExpense) => {
    await supabase
      .from('dyia_fixed_expenses')
      .update({ is_active: !expense.is_active })
      .eq('id', expense.id);
    loadExpenses();
    onUpdate?.();
  };

  const monthlyTotal = calculateMonthlyFixedExpenses(expenses);

  return (
    <div className="card">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Fixed Expenses</h2>
        <div className="text-right">
          <p className="text-sm text-gray-500">Monthly Total</p>
          <p className="text-xl font-bold text-orange-600">
            {formatCurrency(monthlyTotal)}
          </p>
        </div>
      </div>

      {/* Expense List */}
      <div className="space-y-2 mb-4">
        {expenses.map((expense) => (
          <div
            key={expense.id}
            className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg ${
              !expense.is_active ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <span>{CATEGORIES.find(c => c.value === expense.category)?.emoji}</span>
              <div>
                <p className="font-medium">{expense.name}</p>
                <p className="text-sm text-gray-500">
                  {formatCurrency(expense.amount)} / {expense.frequency}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggleActive(expense)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                {expense.is_active ? 'Pause' : 'Resume'}
              </button>
              <button
                onClick={() => {
                  setEditingId(expense.id);
                  setFormData(expense);
                  setIsAdding(true);
                }}
                className="text-sm text-orange-600 hover:text-orange-700"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(expense.id)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        {expenses.length === 0 && !isAdding && (
          <p className="text-gray-500 text-center py-4">
            No fixed expenses yet. Add your first one!
          </p>
        )}
      </div>

      {/* Add/Edit Form */}
      {isAdding ? (
        <form onSubmit={handleSubmit} className="space-y-3 border-t pt-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Expense name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              required
            />
            <input
              type="number"
              placeholder="Amount"
              value={formData.amount || ''}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              className="input"
              step="0.01"
              min="0"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value as 'monthly' | 'yearly' })}
              className="input"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="input"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.emoji} {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1">
              {editingId ? 'Update' : 'Add'} Expense
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setEditingId(null);
                setFormData({ name: '', amount: 0, frequency: 'monthly', category: 'other' });
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="btn-secondary w-full"
        >
          + Add Fixed Expense
        </button>
      )}
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Can add new expense with all fields
- [ ] Can edit existing expense
- [ ] Can delete expense
- [ ] Can toggle active/inactive
- [ ] Monthly total calculates correctly
- [ ] Yearly expenses show as monthly equivalent

---

#### Task 1.5: Dashboard Integration (1 hour)
**File:** `src/components/app/Dashboard.tsx`

Add fixed expenses summary card to dashboard:

```typescript
// Add import
import { calculateMonthlyFixedExpenses } from '@/lib/utils';

// In component, fetch fixed expenses and add to stats calculation
// Add card showing:
// - Monthly fixed expenses total
// - Impact on net profit
// - Link to manage expenses
```

**Acceptance Criteria:**
- [ ] Fixed expenses card visible on dashboard
- [ ] Total matches FixedExpenses component
- [ ] Net profit calculation includes fixed expenses

---

### Day 1 Checklist:
- [ ] Migration created and run
- [ ] Types added to database.ts
- [ ] Utility functions working
- [ ] FixedExpenses component complete
- [ ] Dashboard shows fixed expenses summary
- [ ] All CRUD operations tested

---

## Day 2: Wednesday, January 29 (8 hours)

### Focus: Follow-Up System

#### Task 2.1: Database Migration (30 min)
**File:** `supabase/migrations/004_follow_ups.sql`

```sql
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

-- Auto-create follow-up when quote is created
CREATE OR REPLACE FUNCTION create_follow_up_for_quote()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO dyia_follow_ups (user_id, quote_id)
  VALUES (NEW.user_id, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_follow_up
  AFTER INSERT ON dyia_quotes
  FOR EACH ROW EXECUTE FUNCTION create_follow_up_for_quote();
```

---

#### Task 2.2: Types (30 min)
**File:** `src/types/database.ts`

```typescript
export interface FollowUp {
  id: string;
  user_id: string;
  quote_id: string;
  status: 'pending' | 'contacted' | 'converted' | 'lost' | 'snoozed';
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  notes: string | null;
  contact_count: number;
  created_at: string;
  updated_at: string;
}

export interface FollowUpWithQuote extends FollowUp {
  quote: AppQuote;
  daysSinceQuote: number;
  priority: 'hot' | 'warm' | 'cold';
}
```

---

#### Task 2.3: FollowUps Component (5 hours)
**File:** `src/components/app/FollowUps.tsx`

Features to implement:
- List all unconverted quotes with status
- Priority badges (Hot 🔥 = 0-3 days, Warm 🌡️ = 3-7 days, Cold ❄️ = 7+ days)
- Click phone → opens tel: link
- Click "Copy Message" → copies follow-up message to clipboard
- Update status (contacted, converted, lost, snoozed)
- Snooze with date picker
- Notes field
- Filter by status/priority

```typescript
// Message generation function
function generateFollowUpMessage(quote: AppQuote, businessName: string): string {
  const { name, jobDescription } = quote.customer;
  const { low, high } = quote.estimateRange;

  return `Hi ${name}! This is ${businessName} following up on the estimate we provided for your ${jobDescription}. The estimate was $${low}-$${high}. Would you like to schedule this job? Let me know if you have any questions!`;
}
```

---

#### Task 2.4: Tab Integration (2 hours)
**File:** `src/app/app/page.tsx`

Add "Follow-ups" tab to main app page alongside Jobs, Quotes, Settings.

---

### Day 2 Checklist:
- [ ] Migration created and run
- [ ] Auto-trigger creates follow-up for new quotes
- [ ] FollowUps component complete
- [ ] Priority calculation working
- [ ] Copy message to clipboard working
- [ ] Status updates persisting
- [ ] Tab navigation working

---

## Day 3: Thursday, January 30 (6 hours)

### Focus: Tier Gating + Dashboard Polish

#### Task 3.1: useSubscription Hook (1.5 hours)
**File:** `src/hooks/useSubscription.ts`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@clerk/nextjs';

interface SubscriptionState {
  tier: 'basic' | 'pro' | 'trial';
  status: string;
  plan: string | null;
  daysRemaining: number;
  trialEndsAt: Date | null;
  isPro: boolean;
  isLoading: boolean;
}

export function useSubscription(): SubscriptionState {
  const { user } = useUser();
  const [state, setState] = useState<SubscriptionState>({
    tier: 'basic',
    status: 'inactive',
    plan: null,
    daysRemaining: 0,
    trialEndsAt: null,
    isPro: false,
    isLoading: true,
  });

  useEffect(() => {
    if (!user) return;

    const fetchSubscription = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('dyia_users')
        .select('subscription_status, subscription_plan, trial_ends_at')
        .eq('clerk_user_id', user.id)
        .single();

      if (data) {
        const isTrialing = data.subscription_status === 'trialing';
        const isActive = data.subscription_status === 'active';
        const trialEndsAt = data.trial_ends_at ? new Date(data.trial_ends_at) : null;
        const daysRemaining = trialEndsAt
          ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : 0;

        setState({
          tier: isTrialing ? 'trial' : isActive ? 'pro' : 'basic',
          status: data.subscription_status,
          plan: data.subscription_plan,
          daysRemaining,
          trialEndsAt,
          isPro: isTrialing || isActive,
          isLoading: false,
        });
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchSubscription();
  }, [user]);

  return state;
}
```

---

#### Task 3.2: ProFeature Component (1 hour)
**File:** `src/components/ui/ProFeature.tsx`

```typescript
'use client';

import { useSubscription } from '@/hooks/useSubscription';

interface ProFeatureProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ProFeature({ children, fallback }: ProFeatureProps) {
  const { isPro, isLoading } = useSubscription();

  if (isLoading) {
    return <div className="animate-pulse bg-gray-200 rounded h-20" />;
  }

  if (!isPro) {
    return fallback || (
      <div className="relative">
        <div className="opacity-40 pointer-events-none blur-sm">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
          <div className="text-center p-4">
            <p className="text-gray-600 mb-2">Pro Feature</p>
            <a href="/pricing" className="btn-primary">
              Upgrade to Pro
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
```

---

#### Task 3.3: Trial Banner (1 hour)
**File:** `src/components/app/TrialBanner.tsx`

```typescript
'use client';

import { useSubscription } from '@/hooks/useSubscription';

export function TrialBanner() {
  const { tier, daysRemaining } = useSubscription();

  if (tier !== 'trial') return null;

  const urgency = daysRemaining <= 2 ? 'bg-red-500' : 'bg-gradient-to-r from-orange-500 to-amber-500';

  return (
    <div className={`${urgency} text-white py-2 px-4`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <p className="text-sm">
          ⏳ {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left in your Pro trial
        </p>
        <a href="/pricing" className="text-sm font-medium underline hover:no-underline">
          Upgrade Now →
        </a>
      </div>
    </div>
  );
}
```

---

#### Task 3.4: Update Pricing (1 hour)
**File:** `src/app/page.tsx`

- Change $12.99/month → $14.99/month (Basic)
- Add $24.99/month (Pro)
- Update feature lists per tier
- Update Stripe price IDs in checkout

---

#### Task 3.5: Dashboard AI Insights Section (1.5 hours)
**File:** `src/components/app/Dashboard.tsx`

Add placeholder for AI insights section (gated with ProFeature):

```typescript
<ProFeature>
  <div className="card">
    <h3 className="font-semibold mb-3">AI Insights</h3>
    <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-4 rounded-lg">
      <p className="text-gray-600">
        Your weekly insights will appear here...
      </p>
    </div>
  </div>
</ProFeature>
```

---

### Day 3 Checklist:
- [ ] useSubscription hook working
- [ ] ProFeature wrapper working
- [ ] TrialBanner showing for trial users
- [ ] Pricing page updated
- [ ] Dashboard shows gated AI section
- [ ] Basic users see upgrade prompts

---

## Day 4: Friday, January 31 (5 hours)

### Focus: Price Templates

#### Task 4.1: Migration + Types (1 hour)

```sql
-- Migration 005
CREATE TABLE dyia_price_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES dyia_users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  prices JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### Task 4.2: PriceTemplates Component (3 hours)
**File:** `src/components/app/PriceTemplates.tsx`

Settings panel to manage pricing templates with fields:
- Minimum fee
- Load sizes (quarter, half, three-quarter, full)
- Additional load price
- Labor per hour
- Common surcharges (trampoline, hot tub, piano, etc.)

---

#### Task 4.3: QuoteBuilder Integration (1 hour)
**File:** `src/components/app/QuoteBuilder.tsx`

Auto-fill quote form with default template prices.

---

### Day 4 Checklist:
- [ ] Templates table created
- [ ] Templates management UI complete
- [ ] Can set default template
- [ ] QuoteBuilder uses default template
- [ ] All template fields saving correctly

---

## Day 5: Saturday, February 1 (14 hours)

### Focus: AI Infrastructure + Functions

#### Task 5.1: OpenAI Client Setup (1 hour)
**Files:**
- `src/lib/openai/client.ts`
- `.env.local` updates

---

#### Task 5.2: Function Definitions (3 hours)
**File:** `src/lib/openai/functions.ts`

Define all 6 functions:
- create_job
- generate_quote
- log_expense
- get_performance_stats
- get_pending_follow_ups
- suggest_quote_price

---

#### Task 5.3: Function Handlers (4 hours)
**File:** `src/lib/openai/handlers.ts`

Implement handlers that execute Supabase operations.

---

#### Task 5.4: Chat API Route (3 hours)
**File:** `src/app/api/ai/chat/route.ts`

Implement the main chat endpoint with:
- Thread management
- Message persistence
- Function call handling
- Response streaming

---

#### Task 5.5: Thread Migrations (1 hour)
**File:** `supabase/migrations/006_threads.sql`

Create dyia_threads and dyia_messages tables.

---

#### Task 5.6: Anthropic Setup (2 hours)
**Files:**
- `src/lib/anthropic/client.ts`
- `src/lib/anthropic/prompts.ts`
- `src/app/api/ai/insights/route.ts`

---

### Day 5 Checklist:
- [ ] OpenAI client configured
- [ ] All 6 functions defined
- [ ] All handlers implemented
- [ ] Chat API working end-to-end
- [ ] Thread persistence working
- [ ] Anthropic insights endpoint working

---

## Day 6: Sunday, February 2 (16 hours)

### Focus: AI Chat UI + Insights + Forecast

#### Task 6.1: Thread List Component (2 hours)
**File:** `src/components/app/ThreadList.tsx`

---

#### Task 6.2: Message Components (2 hours)
**Files:**
- `src/components/app/MessageBubble.tsx`
- `src/components/app/ToolResultCard.tsx`

---

#### Task 6.3: Assistant Component (4 hours)
**File:** `src/components/app/Assistant.tsx`

Full chat interface with:
- Thread sidebar
- Message history
- Input area
- Function result display

---

#### Task 6.4: AI Insights Component (3 hours)
**File:** `src/components/app/AIInsights.tsx`

Dashboard section showing:
- Weekly summary
- Key metrics
- Recommendations
- Refresh button

---

#### Task 6.5: Forecast API + UI (3 hours)
**Files:**
- `src/app/api/ai/forecast/route.ts`
- `src/lib/forecasting/index.ts`

---

#### Task 6.6: Integration Testing (2 hours)

Test full AI flows:
- Create job via chat
- Generate quote via chat
- View insights
- Check forecast

---

### Day 6 Checklist:
- [ ] Assistant tab fully functional
- [ ] Can create jobs via chat
- [ ] Can generate quotes via chat
- [ ] Thread history persists
- [ ] AI insights generating
- [ ] Forecast showing predictions

---

## Day 7: Monday, February 3 (10 hours)

### Focus: Resend + Trial + Final QA

#### Task 7.1: Resend Setup (2 hours)
**Files:**
- `src/lib/resend/client.ts`
- `src/lib/resend/templates/welcome.tsx`
- `src/lib/resend/templates/weekly-insights.tsx`
- `src/lib/resend/templates/trial-ending.tsx`

---

#### Task 7.2: Notification API (1.5 hours)
**File:** `src/app/api/notifications/send/route.ts`

---

#### Task 7.3: Cron Jobs (1.5 hours)
**Files:**
- `src/app/api/cron/weekly-insights/route.ts`
- `src/app/api/cron/trial-check/route.ts`
- `vercel.json` cron config

---

#### Task 7.4: Trial Flow Enhancement (2 hours)

Update Stripe webhook to handle trial events:
- Trial ending (2 days before)
- Trial ended + downgrade

---

#### Task 7.5: End-to-End Testing (2 hours)

Test all flows:
1. New user signup → welcome email
2. Trial countdown → trial ending email
3. Upgrade flow → Pro access
4. Downgrade flow → Basic access
5. AI features locked for Basic
6. AI features available for Pro

---

#### Task 7.6: Final Polish (1 hour)

- Mobile responsiveness check
- Loading states
- Error messages
- Empty states

---

### Day 7 Checklist:
- [ ] Welcome email sending
- [ ] Weekly insights cron working
- [ ] Trial flow complete
- [ ] All E2E tests passing
- [ ] Mobile responsive
- [ ] Ready for launch

---

## Environment Variables Checklist

```bash
# Required for Day 5+
OPENAI_API_KEY=sk-...
OPENAI_ASSISTANT_ID=asst_...

# Required for Day 5+
ANTHROPIC_API_KEY=sk-ant-...

# Required for Day 7
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=hello@dyia.io
CRON_SECRET=...

# Existing (verify working)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| OpenAI API latency | Implement streaming responses |
| Function call failures | Graceful error handling + retry |
| Token cost overrun | Set max_tokens limits |
| Email deliverability | Use verified domain + warm-up |
| Trial abuse | Rate limit + fraud detection |

---

## Definition of Done

Each feature is complete when:
- [ ] Code implemented and TypeScript compiles
- [ ] Database migrations run successfully
- [ ] Manual testing confirms functionality
- [ ] Mobile responsive
- [ ] Loading/error states handled
- [ ] Gated appropriately (Basic vs Pro)

---

**Ready to start. Day 1 kicks off January 28, 2026.**
