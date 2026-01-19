# JunkProfit Tracker - Setup Guide

## New Project Structure

```
junkprofit-tracker/
├── index.html              # Redirects to landing.html
├── landing.html            # Marketing page with pricing
├── app.html                # Authenticated app (new)
├── app.js                  # Main app logic (to be refactored)
├── styles.css              # App styles
├── netlify/
│   └── functions/
│       ├── create-checkout.js   # Stripe checkout session
│       ├── stripe-webhook.js    # Stripe webhook handler
│       └── package.json         # Function dependencies
└── supabase/
    └── migrations/
        └── 001_create_junkprofit_schema.sql
```

---

## Step 1: Supabase Setup

### 1.1 Apply Database Migration

1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/001_create_junkprofit_schema.sql`
4. Paste and run the migration

This creates:
- `junkprofit_users` - User profiles linked to auth
- `junkprofit_settings` - Business settings per user
- `junkprofit_jobs` - Job tracking
- `junkprofit_quotes` - Quote records

### 1.2 Get Your Supabase Keys

From Supabase Dashboard → Settings → API:
- **Project URL**: `https://xxxxx.supabase.co`
- **Anon/Public Key**: `eyJhbGciOi...`
- **Service Role Key**: (for Netlify functions - keep secret!)

### 1.3 Enable Email Auth

1. Go to Authentication → Providers
2. Ensure **Email** is enabled
3. Configure email templates (optional)

---

## Step 2: Stripe Setup

### 2.1 Create Products & Prices

In Stripe Dashboard → Products:

**Product: JunkProfit Tracker**
- Create two prices:
  1. **Monthly**: $12.99/month recurring
  2. **Annual**: $119.00/year recurring

Note the **Price IDs** (start with `price_`)

### 2.2 Create Coupon (for Gumroad buyers)

In Stripe Dashboard → Products → Coupons:
- **ID**: `GUMROAD20`
- **Type**: Percentage off
- **Discount**: 20%
- **Duration**: Forever (or once)
- **Applies to**: Annual plan only (optional)

### 2.3 Set Up Webhook

In Stripe Dashboard → Developers → Webhooks:

1. Add endpoint: `https://your-site.netlify.app/.netlify/functions/stripe-webhook`
2. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
3. Copy the **Webhook Signing Secret** (starts with `whsec_`)

---

## Step 3: Netlify Environment Variables

In Netlify Dashboard → Site Settings → Environment Variables:

```
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

---

## Step 4: Update App Configuration

### 4.1 Update `app.html`

Find the CONFIG object and replace:

```javascript
const CONFIG = {
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: 'your-anon-key',
  STRIPE_MONTHLY_PRICE: 'price_xxxxx',
  STRIPE_ANNUAL_PRICE: 'price_xxxxx',
};
```

### 4.2 Update `landing.html`

Find the CONFIG object and replace (same keys as app.html):
```javascript
const CONFIG = {
  SUPABASE_URL: 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: 'your-anon-key',
  STRIPE_MONTHLY_PRICE: 'price_xxxxx',
  STRIPE_ANNUAL_PRICE: 'price_xxxxx',
};
```

---

## Step 5: Deploy to Netlify

### 5.1 Install Function Dependencies

```bash
cd netlify/functions
npm install
```

### 5.2 Push to GitHub

```bash
git add .
git commit -m "Add Supabase auth, Stripe subscriptions, landing page"
git push origin main
```

Netlify will auto-deploy.

---

## Step 6: Test the Flow

1. Visit your Netlify URL
2. Landing page should show
3. Click "Get Started" → Redirects to Stripe checkout
4. Complete payment with test card: `4242 4242 4242 4242`
5. Should redirect to app.html, now logged in
6. Verify subscription status in Supabase `junkprofit_users` table

---

## Completed: app.js Refactor ✅

The `app.js` has been refactored to use Supabase:

1. ✅ **Replaced localStorage reads** → Supabase queries
2. ✅ **Replaced localStorage writes** → Supabase inserts/updates
3. ✅ **Added image compression** → Client-side compression before storage
4. ✅ **Added CSV export** → `exportData()` generates CSV from jobs
5. ⏳ **Monthly email statements** → TODO: Supabase Edge Function + Resend

### How Data Flows

1. User logs in via `app.html` (Supabase Auth)
2. `auth.handleAuthSuccess()` fetches/creates user profile
3. `app.init()` loads data from Supabase tables
4. All saves go to Supabase via async functions
5. RLS policies ensure users only see their own data

---

## Quick Reference

| Service | Dashboard |
|---------|-----------|
| Supabase | https://supabase.com/dashboard |
| Stripe | https://dashboard.stripe.com |
| Netlify | https://app.netlify.com |

---

## Pricing Summary

- **Monthly**: $12.99/month
- **Annual**: $119/year (saves $36.88)
- **Gumroad Discount**: 20% off annual with code `GUMROAD20`

---

## Support

Questions? Contact the development team or check the Upwork thread for context.

