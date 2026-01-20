# JunkProfit Tracker - Setup Guide

## Tech Stack
- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Auth & Database**: Supabase
- **Payments**: Stripe
- **Hosting**: Vercel

## Prerequisites
1. Node.js 18+
2. Supabase account (https://supabase.com)
3. Stripe account (https://stripe.com)
4. Vercel account (https://vercel.com)

## Environment Variables

Create a `.env.local` file with the following:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID=price_xxxxx
NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID=price_xxxxx

# App URL (Vercel sets this automatically)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Supabase Setup

### 1. Create a new project at supabase.com

### 2. Run the database migration

Go to SQL Editor and run the migration from `supabase/migrations/001_create_junkprofit_schema.sql`:

This creates:
- `junkprofit_users` - User profiles linked to auth
- `junkprofit_settings` - Per-user settings
- `junkprofit_jobs` - Job tracking
- `junkprofit_quotes` - Quote storage
- Row-Level Security policies for data isolation

### 3. Enable Email Auth
- Go to Authentication → Providers
- Ensure Email is enabled

### 4. Get your API keys
- Go to Settings → API
- Copy Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- Copy anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy service_role key → `SUPABASE_SERVICE_ROLE_KEY`

## Stripe Setup

### 1. Create Products
In Stripe Dashboard → Products, create:

**Monthly Plan:**
- Name: "JunkProfit Monthly"
- Price: $12.99/month (recurring)
- Copy Price ID → `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID`

**Annual Plan:**
- Name: "JunkProfit Annual"
- Price: $119/year (recurring)
- Copy Price ID → `NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID`

### 2. Create Coupon (for Gumroad buyers)
- Go to Products → Coupons
- Create coupon code: `GUMROAD20`
- 20% off, forever duration

### 3. Setup Webhook
- Go to Developers → Webhooks
- Add endpoint: `https://your-domain.vercel.app/api/stripe/webhook`
- Events to listen for:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- Copy Signing Secret → `STRIPE_WEBHOOK_SECRET`

### 4. Get API Keys
- Go to Developers → API Keys
- Copy Secret key → `STRIPE_SECRET_KEY`

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Visit http://localhost:3000

## Deploy to Vercel

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin your-repo-url
git push -u origin main
```

### 2. Import to Vercel
- Go to vercel.com
- Import your GitHub repository
- Add all environment variables
- Deploy

### 3. Update Stripe Webhook
After deployment, update your Stripe webhook URL to:
`https://your-domain.vercel.app/api/stripe/webhook`

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── stripe/
│   │       ├── checkout/route.ts
│   │       └── webhook/route.ts
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── app/
│   │   ├── Dashboard.tsx
│   │   ├── Jobs.tsx
│   │   ├── Quotes.tsx
│   │   ├── QuoteBuilder.tsx
│   │   ├── Settings.tsx
│   │   └── Sidebar.tsx
│   └── auth/
│       └── AuthModal.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── middleware.ts
│   │   └── server.ts
│   └── utils.ts
├── middleware.ts
└── types/
    └── database.ts
```

## Key Features

- **Landing Page** (`/`) - Marketing page with pricing
- **App** (`/app`) - Protected dashboard requiring auth
- **Stripe Checkout** - `/api/stripe/checkout` creates sessions
- **Stripe Webhook** - `/api/stripe/webhook` handles subscription events
- **Auth Middleware** - Protects `/app` routes

## Pricing

- Monthly: $12.99/month
- Annual: $119/year (2 months free)
- Coupon: GUMROAD20 for 20% off annual
