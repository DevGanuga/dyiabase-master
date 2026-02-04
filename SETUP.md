# dyia - Setup Guide

## Tech Stack
- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Auth**: Clerk
- **Database**: Supabase (PostgreSQL)
- **Payments**: Stripe
- **Hosting**: Vercel

## Prerequisites
1. Node.js 18+
2. Clerk account (https://clerk.com)
3. Supabase account (https://supabase.com)
4. Stripe account (https://stripe.com)
5. Vercel account (https://vercel.com)

## Environment Variables

Create a `.env.local` file with the following:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx

# Clerk Redirect URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/app
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/app

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID=price_xxxxx
NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID=price_xxxxx
# Optional: Stripe Coupon ID (e.g. founders/Gumroad). When set, /#pricing?founders=1 applies it at checkout.
# STRIPE_FOUNDERS_COUPON_ID=coupon_xxxxx

# App URL (Vercel sets this automatically)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Clerk Setup

### 1. Create a Clerk Application
- Go to https://clerk.com and create a new application
- Choose "Email" as your primary authentication method
- You can also enable social providers (Google, GitHub, etc.)

### 2. Get Your API Keys
- Go to Clerk Dashboard → API Keys
- Copy `Publishable Key` → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- Copy `Secret Key` → `CLERK_SECRET_KEY`

### 3. Configure Redirect URLs
In Clerk Dashboard → Paths:
- Sign-in URL: `/sign-in`
- Sign-up URL: `/sign-up`
- After sign-in URL: `/app`
- After sign-up URL: `/app`

### 4. Setup Webhook for User Sync
In Clerk Dashboard → Webhooks:
- Add endpoint: `https://your-domain.vercel.app/api/clerk/webhook`
- Events to listen for:
  - `user.created`
  - `user.updated`
  - `user.deleted`
- Copy Signing Secret → `CLERK_WEBHOOK_SECRET`

## Supabase Setup

### 1. Create a new project at supabase.com

### 2. Run the database migration

Go to SQL Editor and run the migration from `supabase/migrations/002_rename_to_dyia_add_clerk.sql`:

This creates:
- `dyia_users` - User profiles linked to Clerk
- `dyia_settings` - Per-user settings
- `dyia_jobs` - Job tracking
- `dyia_quotes` - Quote storage

### 3. Get your API keys
- Go to Settings → API
- Copy Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- Copy anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy service_role key → `SUPABASE_SERVICE_ROLE_KEY`

Note: We use the service_role key for server-side operations. This bypasses RLS policies since authorization is handled by Clerk at the application layer.

### 4. Storage (for chat file uploads)
- In Supabase Dashboard → Storage, create a bucket named **dyia-files** (public or with RLS as needed). The Pro "File upload & data extraction" feature uploads chat attachments here.

## Stripe Setup

### 1. Create Products
In Stripe Dashboard → Products, create:

**Monthly Plan:**
- Name: "dyia Monthly"
- Price: $12.99/month (recurring)
- Copy Price ID → `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID`

**Annual Plan:**
- Name: "dyia Annual"
- Price: $119/year (recurring)
- Copy Price ID → `NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID`

### 2. Coupons and promotion codes
- **Promotion codes**: Checkout has “allow promotion codes” enabled. In Stripe Dashboard → Products → Coupons, create a coupon (e.g. percent or amount off). Then create a Promotion Code that references it (e.g. code `FOUNDERS50`). Customers can enter that code on the Stripe Checkout page.
- **Founders / Gumroad link**: To auto-apply a coupon when users open a special link:
  1. Create a coupon in Stripe (e.g. “First year annual” or “$19.99/mo founders”).
  2. Copy the Coupon ID (starts with `coupon_`).
  3. Set `STRIPE_FOUNDERS_COUPON_ID=coupon_xxxxx` in your env.
  4. Share the link `https://your-domain.com/#pricing?founders=1`. When users click a Pro plan and checkout, that coupon is applied automatically.

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

### 5. Mass Email (Pro) — optional
When you want to enable the “Email blast” feature (Gmail/Outlook):
- Create a Google Cloud project and OAuth 2.0 Client (Web) for Gmail; add redirect URI `https://your-domain.com/api/auth/gmail/callback`.
- Or create an Azure AD app for Outlook; add redirect URI for your app.
- Set in env: `NEXT_PUBLIC_GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and/or Outlook equivalents.
- Implement `/api/email/connect` and `/api/email/send` (and optional `dyia_email_sends` table for tracking). The Mass Email UI is in place; plug in OAuth and send logic when ready.

### 6. Logo & branding
- **App logo**: Replace `public/dyia-logo.png` and `public/dyia-logo-full.png` with your final assets. The app references these paths.
- **Favicon**: Replace `src/app/favicon.ico` with your app icon.
- Optional: set `NEXT_PUBLIC_LOGO_URL` (and use in layout) if you prefer to load the logo from a URL.

### 7. Cron jobs (Vercel)
For trial reminders, weekly insights, and follow-up reminders, set `CRON_SECRET` in Vercel and add it to the `Authorization: Bearer CRON_SECRET` header when calling the cron endpoints (or use Vercel’s built-in cron triggers).

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

### 3. Update Webhooks
After deployment, update your webhook URLs:
- Clerk: `https://your-domain.vercel.app/api/clerk/webhook`
- Stripe: `https://your-domain.vercel.app/api/stripe/webhook`

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── clerk/
│   │   │   └── webhook/route.ts    # Clerk user sync
│   │   └── stripe/
│   │       ├── checkout/route.ts
│   │       └── webhook/route.ts
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx                # Protected dashboard
│   ├── sign-in/
│   │   └── [[...sign-in]]/page.tsx # Clerk sign-in
│   ├── sign-up/
│   │   └── [[...sign-up]]/page.tsx # Clerk sign-up
│   ├── globals.css
│   ├── layout.tsx                  # Root layout with ClerkProvider
│   └── page.tsx                    # Landing page
├── components/
│   └── app/
│       ├── Dashboard.tsx
│       ├── Jobs.tsx
│       ├── Quotes.tsx
│       ├── QuoteBuilder.tsx
│       ├── Settings.tsx
│       └── Sidebar.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   └── utils.ts
├── middleware.ts                   # Clerk middleware
└── types/
    └── database.ts
```

## Key Features

- **Landing Page** (`/`) - Marketing page with pricing
- **Sign In** (`/sign-in`) - Clerk authentication
- **Sign Up** (`/sign-up`) - Clerk registration
- **App** (`/app`) - Protected dashboard requiring auth
- **Stripe Checkout** - `/api/stripe/checkout` creates sessions
- **Stripe Webhook** - `/api/stripe/webhook` handles subscription events
- **Clerk Webhook** - `/api/clerk/webhook` syncs users to Supabase
- **Auth Middleware** - Protects `/app` routes via Clerk

## Auth Flow

1. User visits `/` (landing page)
2. Clicks "Sign In" → redirects to `/sign-in` (Clerk)
3. After auth, Clerk redirects to `/app`
4. Clerk webhook creates/updates `dyia_users` record in Supabase
5. App page fetches user profile from Supabase using `clerk_user_id`

## Pricing

- Monthly: $12.99/month
- Annual: $119/year (2 months free)
- Coupon: GUMROAD20 for 20% off annual
