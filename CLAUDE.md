# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**dyia** ("Your Day, Decoded") is a business management SaaS for service businesses (junk removal, lawn care, house cleaning). Features job tracking, quote generation with PDF export, follow-up management, and AI-powered business insights.

**Tech Stack**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Clerk Auth, Supabase (PostgreSQL), Stripe, OpenAI

## Development

```bash
npm install    # Install dependencies
npm run dev    # Run development server (localhost:3000)
npm run build  # Build for production
npm run lint   # Run ESLint
```

## Architecture

### Authentication & Authorization
- **Clerk**: Handles auth UI (`/sign-in`, `/sign-up`) and session management
- **Clerk Webhook** (`/api/clerk/webhook`): Syncs user.created/updated/deleted events to `dyia_users`
- **App Layout** (`src/app/app/layout.tsx`): Server-side auth check, redirects unauthenticated users
- **Demo Mode**: Cookie-based bypass (`dyia_demo_access=true`) for unauthenticated access

### Subscription Tiers
Three tiers gated by `useSubscription()` hook:
- **basic**: Free tier (limited features)
- **trial**: Trial period (`trialing` status)
- **pro**: Paid (`active` or `trialing` status)

Use `<ProFeature>` component to gate UI behind pro subscription.

### Database Schema (Supabase)
All tables prefixed with `dyia_`:
- `dyia_users` - User profiles, Clerk/Stripe IDs, subscription status
- `dyia_settings` - Per-user settings (tax %, monthly goal, business info)
- `dyia_jobs` - Job tracking (date, customer, revenue, expenses breakdown)
- `dyia_quotes` - Quote storage (customer info, pricing, photos, estimate range)
- `dyia_follow_ups` - Quote follow-up tracking with priority system (hot/warm/cold)
- `dyia_fixed_expenses` - Recurring business expenses (monthly/yearly)
- `dyia_price_templates` - Saved pricing templates for quotes
- `dyia_threads` / `dyia_messages` - AI chat conversation storage

### API Routes
- `/api/clerk/webhook` - Clerk user sync (uses svix for signature verification)
- `/api/stripe/checkout` - Creates Stripe checkout session
- `/api/stripe/webhook` - Handles subscription lifecycle events
- `/api/user/init` - Initializes user data on first app load
- `/api/demo/activate` - Enables demo mode cookie

### Data Flow
```
Browser → Clerk Auth Check → Component → Supabase Client → Database
                                              ↓
                                    Server routes use service role key
                                    (bypasses RLS for admin operations)
```

### AI Integration (OpenAI)
Located in `src/lib/openai/`:
- `client.ts` - OpenAI client initialization
- `functions.ts` - Function definitions for AI tool calling
- `handlers.ts` - Server-side handlers for AI function calls (create_job, generate_quote, log_expense, get_performance_stats, get_pending_follow_ups, suggest_quote_price)

### Key Patterns

**Database ↔ Frontend Type Transformation**:
- Database types: snake_case (`customer_name`, `dump_fee`)
- App types: camelCase with `App` prefix (`AppJob`, `AppQuote`)
- Types defined in `src/types/database.ts`

**Supabase Clients**:
- `src/lib/supabase/client.ts` - Browser client (uses anon key)
- `src/lib/supabase/server.ts` - Server client (uses anon key + cookies)
- API routes create direct clients with `SUPABASE_SERVICE_ROLE_KEY`

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID
NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID

OPENAI_API_KEY
```

## Design Tokens

Primary: `#f97316` (orange-500), Gradient: `from-orange-500 to-amber-500`
Success: `#f97316` (uses orange), Warning: `#fbbf24`, Danger: `#ef4444`

## Naming Conventions

- Database tables: `dyia_*` prefix, snake_case columns
- TypeScript types: PascalCase (`Job`), App-side with `App` prefix (`AppJob`)
- Component props: camelCase
- Utility functions: camelCase, grouped by domain in `src/lib/`
