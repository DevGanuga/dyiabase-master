# dyia - Operational Setup Checklist

Everything you need to configure before going live.

---

## 1. Vercel Environment Variables

Set these in your Vercel project settings (Settings > Environment Variables):

### Required (App Won't Work Without These)

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key | Clerk Dashboard > API Keys |
| `CLERK_SECRET_KEY` | Clerk secret key | Clerk Dashboard > API Keys |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signing secret | Clerk Dashboard > Webhooks |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | Supabase Dashboard > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Supabase Dashboard > Settings > API |
| `STRIPE_SECRET_KEY` | Stripe secret key | Stripe Dashboard > Developers > API Keys |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Stripe Dashboard > Developers > Webhooks |
| `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID` | Stripe price ID for monthly plan | Stripe Dashboard > Products |
| `NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID` | Stripe price ID for annual plan | Stripe Dashboard > Products |
| `OPENAI_API_KEY` | OpenAI API key | OpenAI Platform > API Keys |

### Required for Emails (Cron Jobs, Welcome, Trial Reminders)

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `RESEND_API_KEY` | Resend API key | resend.com > API Keys |
| `RESEND_FROM_EMAIL` | Sender email (e.g., `Dyia <hello@dyia.io>`) | Must verify domain in Resend |

### Required for Cron Jobs

| Variable | Description | How to Set |
|----------|-------------|------------|
| `CRON_SECRET` | Random string for cron auth | Generate: `openssl rand -hex 32` |

### Required for Email Blast (Gmail/Outlook OAuth)

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `GMAIL_CLIENT_ID` | Google OAuth client ID | Google Cloud Console |
| `GMAIL_CLIENT_SECRET` | Google OAuth client secret | Google Cloud Console |
| `OUTLOOK_CLIENT_ID` | Azure AD app client ID | Azure Portal |
| `OUTLOOK_CLIENT_SECRET` | Azure AD app client secret | Azure Portal |

### Optional

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Production URL (e.g., `https://dyia.io`). Defaults to `http://localhost:3000` |
| `DEMO_PASSWORD` | Password for demo mode access. If not set, demo mode is disabled. |
| `STRIPE_FOUNDERS_COUPON_ID` | Stripe coupon ID for founders pricing |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for error monitoring (recommended for production) |
| `SENTRY_ORG` | Sentry organization slug (for source maps upload) |
| `SENTRY_PROJECT` | Sentry project slug (for source maps upload) |
| `SENTRY_AUTH_TOKEN` | Sentry auth token (for source maps upload during build) |

---

## 2. Stripe Setup

### Create Products and Prices

1. Go to Stripe Dashboard > Products
2. Create **"dyia Pro"** product with two prices:
   - Monthly: **$29.99/month** (recurring) — copy Price ID → `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID`
   - Annual: **$299.90/year** (recurring, = 10 months, 2 months free) — copy Price ID → `NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID`

### Create Founders Coupon (first 50 beta testers get Pro at $19.99/mo)

1. Go to Products > Coupons > **Create coupon**
   - **Name:** `Founders Pricing`
   - **Type:** Amount off
   - **Discount:** **$10.00 off** (brings $29.99/mo → $19.99/mo)
   - **Duration:** **Forever** (locked in as long as they stay subscribed)
   - **Max redemptions:** **50** (auto-stops after 50 uses)
2. Copy the **Coupon ID** → `STRIPE_FOUNDERS_COUPON_ID`
3. Optionally create a **Promotion Code** for the coupon:
   - Click into the coupon > Promotion codes > Create
   - Code: `FOUNDERS` (for manual entry at checkout)

**How founders pricing works:**
- Share `https://yourdomain.com/#pricing?founders=1` — coupon auto-applies at checkout
- Or users enter code `FOUNDERS` at Stripe checkout
- Rate is locked at $19.99/mo forever, as long as they stay subscribed
- If they cancel and re-subscribe, the coupon is gone — they pay full $29.99/mo
- Once 50 founders slots are filled, the coupon automatically stops working

### Register Webhook

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://yourdomain.com/api/stripe/webhook`
3. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### Enable Test Mode First

- Use test API keys (`sk_test_...`) during development
- Switch to live keys (`sk_live_...`) when ready to accept real payments

---

## 3. Clerk Setup

### Register Webhook

1. Go to Clerk Dashboard > Webhooks
2. Add endpoint: `https://yourdomain.com/api/clerk/webhook`
3. Select these events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
4. Copy the signing secret to `CLERK_WEBHOOK_SECRET`

### Create JWT Template for Supabase (REQUIRED for database security)

This enables Row-Level Security so users can only access their own data.

1. Go to Clerk Dashboard > JWT Templates
2. Click "New template" > choose **Supabase**
3. Set the **Signing key** to your **Supabase JWT Secret** (found in Supabase Dashboard > Settings > API > JWT Settings > JWT Secret)
4. The template should include these claims (Clerk pre-fills this for Supabase templates):
   ```json
   {
     "sub": "{{user.id}}",
     "iss": "clerk",
     "iat": "{{time.now}}",
     "exp": "{{time.now + 3600}}",
     "role": "authenticated"
   }
   ```
5. Save the template — the name must be **supabase** (lowercase)

After creating the template, run migration `018_rls_policies.sql` in Supabase to activate the user-scoped security policies.

---

## 4. Resend Email Setup

1. Sign up at resend.com
2. Add and verify your domain (e.g., `dyia.io`)
3. Create an API key
4. Set `RESEND_API_KEY` in Vercel
5. Set `RESEND_FROM_EMAIL` to e.g., `Dyia <hello@dyia.io>`

Without Resend configured:
- No welcome emails
- No trial reminder emails
- No weekly insight emails
- No follow-up reminder emails

---

## 5. Gmail OAuth Setup (for Email Blast)

1. Go to Google Cloud Console (console.cloud.google.com)
2. Create a project (or use existing)
3. Enable Gmail API: APIs & Services > Library > Gmail API > Enable
4. Configure OAuth consent screen:
   - User type: External
   - App name: dyia
   - Scopes: `gmail.send`, `userinfo.email`
5. Create OAuth credentials:
   - Type: Web application
   - Authorized redirect URI: `https://yourdomain.com/api/email/connect/gmail/callback`
6. Copy Client ID and Client Secret

**Note:** In "Testing" mode, limited to 100 users. Submit for Google verification to remove the limit.

---

## 6. Outlook OAuth Setup (for Email Blast)

1. Go to Azure Portal (portal.azure.com)
2. Register an app: Azure Active Directory > App registrations > New registration
   - Name: dyia
   - Supported account types: Personal Microsoft accounts
   - Redirect URI: `https://yourdomain.com/api/email/connect/outlook/callback`
3. Add client secret: Certificates & secrets > New client secret
4. Add API permissions: API permissions > Add > Microsoft Graph:
   - `Mail.Send`
   - `openid`
   - `email`
   - `offline_access`
5. Copy Application (client) ID and client secret

---

## 7. Supabase Migrations

Run **all** migrations in the Supabase SQL Editor, in numerical order:

| # | File | What It Does |
|---|------|-------------|
| 001 | `001_create_junkprofit_schema.sql` | Base schema (users, settings, jobs, quotes) |
| 002 | `002_rename_to_dyia_add_clerk.sql` | Rename tables to `dyia_*`, add Clerk auth |
| 003 | `003_mvp_sprint.sql` | Fixed expenses, follow-ups, price templates, AI threads/messages |
| 004 | `004_quotes_nested_in_jobs.sql` | Quote-job relationship |
| 005 | `005_onboarding_trial.sql` | Onboarding tracking columns |
| 006 | `006_quotes_independent.sql` | Quotes independence |
| 007 | `007_job_embeddings.sql` | Job embeddings |
| 008 | `008_pending_actions.sql` | Pending actions |
| 009 | `009_ai_credits_marketing_reviews.sql` | AI credits, marketing spend, review requests |
| 010 | `010_review_requests.sql` | Review request tracking |
| 011 | `011_review_urls_per_platform.sql` | Per-platform review URLs |
| 012 | `012_mass_email.sql` | Email connections, sends, campaigns |
| 013 | `013_customers_table.sql` | Customers CRM table |
| 014 | `014_quiz_submissions.sql` | Profit calculator lead funnel |
| 015 | `015_admin_role.sql` | Admin role + `is_admin` flag |
| 016 | `016_fix_customers_add_quote_source.sql` | Customers table fix + quote source |
| 017a | `017_admin_panel.sql` | Webhook event log table |
| 017b | `017_job_status_and_address.sql` | Job status + address columns |
| 018 | `018_rls_policies.sql` | **CRITICAL**: Row-Level Security (requires Clerk JWT template) |
| 019 | `019_fix_admin_role_constraint.sql` | Fix admin role constraint + re-seed admins |

---

## 8. Set Admin Users

Founding admins (seeded in migration 019) are automatically promoted when they sign up:
- `devganuga@initdev.co`
- `ricardo.bezi@initdev.co`
- `marco.aayala97@yahoo.com`

**To add more admins**, run this SQL after they sign up:

```sql
UPDATE dyia_users 
SET is_admin = true, role = 'admin', subscription_status = 'active'
WHERE email IN ('new-admin@example.com');
```

**Important:** Always set BOTH `is_admin = true` AND `role = 'admin'` (or `'super_admin'`).
The sidebar uses `is_admin`, the admin layout uses `is_admin`, and API routes use `is_admin`.
Setting just `role` without `is_admin` will not work.

Admin panel: `https://yourdomain.com/app/admin`

---

## 9. Cron Jobs

Configured in `vercel.json`. They run automatically once deployed to Vercel:

| Job | Schedule | What It Does |
|-----|----------|--------------|
| `/api/cron/trial-reminders` | Daily 9:00 UTC | Emails users whose trial ends in 2 days |
| `/api/cron/follow-up-reminders` | Daily 8:00 UTC | Emails users with pending follow-ups |
| `/api/cron/weekly-insights` | Mondays 9:00 UTC | Emails Pro users weekly business stats |

All require `CRON_SECRET` and `RESEND_API_KEY` to be set.

---

## 10. Post-Deploy Verification

After deploying, verify each integration:

- [ ] Visit `/sign-up` — Clerk auth works
- [ ] Create a user — Check Supabase for `dyia_users` record
- [ ] Visit `/app/admin` — Admin panel loads (after setting role)
- [ ] Click "Start Free Trial" in Settings — Stripe checkout loads
- [ ] Complete checkout — Webhook fires, subscription status updates
- [ ] Send a test email blast — Gmail/Outlook OAuth flow works
- [ ] Check `/app/admin/webhooks` — Events are being logged
- [ ] Wait 24 hours — Check cron job logs in Vercel dashboard
