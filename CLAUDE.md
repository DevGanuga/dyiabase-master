# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**dyia** ("Your Day, Decoded") is a business management web application for service businesses (junk removal, lawn care, house cleaning). It's built with Next.js 16 (App Router), TypeScript, and uses Clerk for authentication, Supabase for data storage, and Stripe for subscriptions.

**Tech Stack**: Next.js 16, TypeScript, Tailwind CSS, Clerk Auth, Supabase (PostgreSQL), Stripe

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Architecture

### Authentication Flow (Clerk)
1. User signs up/in via Clerk (`/sign-in`, `/sign-up`)
2. Clerk webhook (`/api/clerk/webhook`) syncs user to `dyia_users` table
3. App pages use `useUser()` from `@clerk/nextjs` to get current user
4. Middleware (`src/middleware.ts`) protects `/app` routes

### Database Schema (Supabase)
- `dyia_users` - User profiles, linked via `clerk_user_id`, stores Stripe subscription info
- `dyia_settings` - Per-user settings (tax %, monthly goal, business info)
- `dyia_jobs` - Job tracking (date, customer, revenue, expenses)
- `dyia_quotes` - Quote storage (customer info, pricing, photos)

### Key Files
- `src/app/layout.tsx` - Root layout with ClerkProvider
- `src/middleware.ts` - Clerk auth middleware
- `src/app/app/page.tsx` - Main app dashboard (protected)
- `src/app/api/clerk/webhook/route.ts` - User sync webhook
- `src/app/api/stripe/*/route.ts` - Payment webhooks

### Data Flow
```
User Action → Component → Supabase Client → Database
                              ↓
                         RLS bypassed (service role)
                              ↓
                    App handles auth via Clerk
```

### Key Data Structures

**dyia_users** (database):
```typescript
{
  id: UUID,
  clerk_user_id: string,          // From Clerk
  email: string,
  first_name?: string,
  last_name?: string,
  stripe_customer_id?: string,
  stripe_subscription_id?: string,
  subscription_status: 'active' | 'inactive' | 'canceled' | 'past_due' | 'trialing',
  subscription_plan?: 'monthly' | 'annual'
}
```

**AppJob** (frontend):
```typescript
{
  id, date, customerName, source,
  revenue, labor, gas, dumpFee, dumpsterRental, additionalExpense,
  numWorkers, costPerWorker, notes
}
```

**AppQuote** (frontend):
```typescript
{
  id, createdAt,
  customer: { name, phone, email, address, jobDescription },
  pricing: { ... },
  photos: string[],
  estimateRange: { low, high },
  total
}
```

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk public key
- `CLERK_SECRET_KEY` - Clerk secret key
- `CLERK_WEBHOOK_SECRET` - Clerk webhook signing secret
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side)
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID` - Stripe price ID
- `NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID` - Stripe price ID

## Design Tokens

Primary: `#f97316` (orange-500), Gradient: `from-orange-500 to-amber-500`
Success: `#f97316` (uses orange), Warning: `#fbbf24`, Danger: `#ef4444`

## Naming Convention

- Database tables: `dyia_*` prefix (snake_case)
- Database columns: snake_case
- Frontend types: PascalCase
- Frontend props: camelCase
