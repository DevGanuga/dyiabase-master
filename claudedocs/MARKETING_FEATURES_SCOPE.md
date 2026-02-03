# Marketing Features Scope

**Date:** February 3, 2026  
**Requested by:** Marco Ayyala  
**Status:** Proposed for Final Milestone

---

## Overview

Add a dedicated **Marketing** page to dyia that helps service business owners track their marketing spend, measure ROI by channel, and see which lead sources generate the most revenue.

---

## Features

### 1. Marketing Page (New Section in Sidebar)

A dedicated page accessible from the sidebar that consolidates all marketing-related data.

#### 1.1 Marketing Spend Tracker
- Add/edit/delete marketing expenses by channel
- Predefined channels: Google Ads, Meta/Facebook Ads, Yard Signs, Thumbtack, Yelp Ads, Other/Custom
- Track spend per month (or date range)
- Separate from fixed expenses for cleaner reporting

#### 1.2 Marketing ROI Dashboard
- Revenue generated per marketing source (from jobs with that source)
- Cost per channel (from marketing spend tracker)
- Auto-calculated ROI: `((Revenue - Cost) / Cost) × 100`
- Visual breakdown: bar chart or table
- Time period selector (this month, last 3 months, YTD, all time)

#### 1.3 Lead Source Analytics
- Which sources bring the most jobs
- Average job value by source
- Conversion insights (if quote → job tracking enabled)

**Estimated Hours:** 6-8h

---

### 2. Marketing Source on Jobs (Enhancement)

The `source` field already exists on `dyia_jobs` but needs better UX.

#### Changes:
- Dropdown with preset options: Google, Facebook, Yard Sign, Referral, Word of Mouth, Thumbtack, Craigslist, Custom
- Custom input fallback for unlisted sources
- Source shown on job cards and in job list
- Filterable by source in Jobs view

**Estimated Hours:** 1.5-2h

---

### 3. Marketing Expenses (Standalone or Integrated)

#### Option A: Integrate into Marketing Page (Recommended)
- Marketing spend lives on the Marketing page
- Separate from Fixed Expenses (which is for overhead like insurance, rent)
- Can be recurring (monthly budget) or one-time (yard signs purchase)

#### Option B: Enhance Fixed Expenses
- Add sub-categories under "Marketing" category
- Filter fixed expenses by category on existing page

**Estimated Hours:** 2-3h

---

### 4. Review Request System

Help users collect reviews from satisfied customers.

#### 4.1 Review Templates (Copy/Paste)
- Pre-written templates for Google, Yelp, Facebook
- Customizable with business name
- One-click copy to clipboard
- Accessible from completed jobs or quotes

#### 4.2 Review Request Tracking
- Track which customers received review requests
- Date sent, platform, response status (optional)
- "Request Review" button on completed jobs

#### 4.3 Review Link Generator (Optional Enhancement)
- Store business review URLs in Settings
- Generate short links or QR codes for review pages

**Estimated Hours:** 3-4h (templates + tracking), +2h for link generator

---

### 5. AI Credits System (Separate from Marketing)

Prevent AI abuse and monetize AI usage.

#### 5.1 Usage Tracking
- New table: `dyia_ai_usage` (user_id, month, messages_used, tokens_used)
- Middleware to track each AI chat message
- Dashboard widget showing usage

#### 5.2 Pro Plan Limits
- Monthly limit (e.g., 150 AI messages)
- Soft warning at 80%, hard stop at 100%
- Option to purchase additional credits

#### 5.3 Credit Packs (Stripe Integration)
- Product: 100 credits for $4.99
- One-time purchase, adds to balance
- Webhook handles credit fulfillment

#### 5.4 Basic Plan Free Credits
- Give basic users 5-10 free AI messages/month
- Taste of AI features without full subscription
- Upgrade CTA when credits exhausted

**Estimated Hours:** 10-14h total

---

## Summary: Hour Estimates

| Feature | Hours | Priority |
|---------|-------|----------|
| Marketing Page (spend tracker + ROI dashboard) | 6-8h | High |
| Marketing Source Presets on Jobs | 1.5-2h | High |
| Marketing Expenses Integration | 2-3h | High |
| Review Templates (copy/paste) | 2-3h | High |
| Review Request Tracking | 1-2h | Medium |
| Review Link Generator | 2h | Low |
| AI Credits System (full) | 10-14h | Medium |

---

## Recommended Scope for Final Milestone

### Core Marketing Features (11-15 hours)
- [ ] Marketing Page with spend tracker
- [ ] ROI dashboard showing revenue vs cost per channel
- [ ] Marketing source presets on job form
- [ ] Review request templates with copy/paste

### Nice-to-Have (+4-6 hours)
- [ ] Review request tracking (who was asked, when)
- [ ] Lead source analytics (avg job value by source)

### Post-Launch (+10-14 hours)
- [ ] AI credits system with Stripe integration
- [ ] Basic tier free credits

---

## Database Changes Required

```sql
-- New table for marketing spend (if separate from fixed_expenses)
CREATE TABLE dyia_marketing_spend (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES dyia_users(clerk_id),
  channel TEXT NOT NULL, -- 'google_ads', 'meta_ads', 'yard_signs', etc.
  amount DECIMAL(10,2) NOT NULL,
  month DATE NOT NULL, -- First of month for monthly tracking
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Review request tracking
CREATE TABLE dyia_review_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES dyia_users(clerk_id),
  job_id UUID REFERENCES dyia_jobs(id),
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  platform TEXT NOT NULL, -- 'google', 'yelp', 'facebook'
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'sent' -- 'sent', 'clicked', 'reviewed'
);

-- AI usage tracking (for credits system)
CREATE TABLE dyia_ai_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES dyia_users(clerk_id),
  month DATE NOT NULL, -- First of month
  messages_used INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  credits_purchased INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month)
);
```

---

## UI Mockup Concepts

### Marketing Page Layout
```
┌─────────────────────────────────────────────────────────┐
│ Marketing                                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ Total Spend │ │ Total Rev   │ │ Overall ROI │       │
│  │   $450      │ │   $3,200    │ │    611%     │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                         │
│  ROI by Channel                    This Month ▼        │
│  ┌─────────────────────────────────────────────┐       │
│  │ Google Ads    $200 spend  →  $1,400 rev  600%│       │
│  │ Yard Signs    $150 spend  →  $1,200 rev  700%│       │
│  │ Facebook      $100 spend  →  $600 rev    500%│       │
│  └─────────────────────────────────────────────┘       │
│                                                         │
│  [+ Add Marketing Spend]                               │
│                                                         │
│  Lead Sources (Jobs)                                   │
│  ┌─────────────────────────────────────────────┐       │
│  │ Referral      12 jobs    $4,200    $350 avg │       │
│  │ Google        8 jobs     $2,800    $350 avg │       │
│  │ Yard Sign     6 jobs     $1,800    $300 avg │       │
│  └─────────────────────────────────────────────┘       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Notes

- Marketing source field already exists on jobs (`source` column)
- Fixed expenses already has `marketing` category but lacks channel granularity
- Review system should be simple: copy template, mark as sent
- AI credits can be deferred to post-launch if timeline is tight
