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

---

## 2. Stripe Setup

### Create Products and Prices

1. Go to Stripe Dashboard > Products
2. Create "dyia Basic" product:
   - Monthly price: $19.99/mo
   - Annual price: $191/year ($15.92/mo)
3. Create "dyia Pro" product:
   - Monthly price: $29.99/mo
   - Annual price: $287/year ($23.92/mo)
4. Copy the price IDs to `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID` and `NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID`

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

Run these migrations in the Supabase SQL Editor (in order):

1. `016_fix_customers_add_quote_source.sql` — Creates customers table + adds quote source
2. `017_admin_panel.sql` — Adds admin role + webhook event log

---

## 8. Set Admin Users

After your first users sign up, grant admin access:

```sql
UPDATE dyia_users SET role = 'admin' 
WHERE email IN ('your-email@example.com', 'co-admin@example.com');
```

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
