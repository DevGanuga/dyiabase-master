# 💼 JunkProfit Tracker Pro

**Cloud-based profit tracking for junk removal businesses**

⚠️ **PROPRIETARY SOFTWARE - CONFIDENTIAL** - See LICENSE file

---

## 🚀 What It Does

JunkProfit Tracker Pro helps junk removal business owners:

- **Track Jobs & Profits** - Log revenue, expenses, and see real profit instantly
- **Generate Professional Quotes** - PDF quotes with your logo and branding
- **Calculate Tax Set-Asides** - Know exactly how much to save from each job
- **Track Marketing Sources** - See which channels bring the most business
- **Set & Track Goals** - Monthly revenue targets with visual progress

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Backend | Supabase (PostgreSQL + Auth) |
| Payments | Stripe Subscriptions |
| Hosting | Vercel |
| PDF Generation | jsPDF |

---

## 📁 Project Structure

```
junkprofit-tracker/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── layout.tsx            # Root layout
│   │   ├── globals.css           # Tailwind + custom styles
│   │   ├── app/
│   │   │   ├── page.tsx          # Dashboard (protected)
│   │   │   └── layout.tsx        # App layout with sidebar
│   │   └── api/
│   │       └── stripe/
│   │           ├── checkout/route.ts   # Create checkout session
│   │           └── webhook/route.ts    # Handle subscriptions
│   ├── components/
│   │   ├── app/                  # Dashboard components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Jobs.tsx
│   │   │   ├── Quotes.tsx
│   │   │   ├── QuoteBuilder.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── Sidebar.tsx
│   │   └── auth/
│   │       └── AuthModal.tsx     # Login/signup modal
│   ├── lib/
│   │   ├── supabase/             # Supabase client utilities
│   │   │   ├── client.ts         # Browser client
│   │   │   ├── server.ts         # Server client
│   │   │   └── middleware.ts     # Session refresh
│   │   └── utils.ts              # Helper functions
│   ├── middleware.ts             # Auth protection
│   └── types/
│       └── database.ts           # TypeScript definitions
├── supabase/
│   └── migrations/
│       └── 001_create_junkprofit_schema.sql
├── SETUP.md                      # Configuration guide
├── vercel.json                   # Vercel config
└── package.json
```

---

## 💰 Pricing

| Plan | Price | Features |
|------|-------|----------|
| Monthly | $12.99/month | Full access, cancel anytime |
| Annual | $119/year | Full access + 2 months free |

**Gumroad buyers:** Use code `GUMROAD20` for 20% off annual plans

---

## ⚡ Quick Start

### Prerequisites

- Node.js 18+
- Supabase account (free tier works)
- Stripe account
- Vercel account

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/junkprofit-tracker.git
cd junkprofit-tracker
npm install
```

### 2. Configure Environment

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID=price_xxx
NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID=price_xxx

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run Database Migration

Run `supabase/migrations/001_create_junkprofit_schema.sql` in Supabase SQL Editor.

### 4. Run Locally

```bash
npm run dev
```

### 5. Deploy to Vercel

```bash
vercel
# Or push to GitHub and import in Vercel dashboard
```

Update Stripe webhook URL to `https://your-domain.vercel.app/api/stripe/webhook`

---

## 🔧 Development

### Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Key Files

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Landing page with pricing |
| `src/app/app/page.tsx` | Main dashboard |
| `src/components/auth/AuthModal.tsx` | Authentication flow |
| `src/app/api/stripe/checkout/route.ts` | Creates Stripe checkout |
| `src/app/api/stripe/webhook/route.ts` | Handles subscription events |
| `src/lib/supabase/*` | Supabase client utilities |

---

## 🗄️ Database Schema

**Users** - Profile & subscription info
```sql
junkprofit_users (
  id, auth_user_id, email,
  stripe_customer_id, stripe_subscription_id,
  subscription_status, subscription_plan, subscription_ends_at
)
```

**Settings** - Business info & preferences
```sql
junkprofit_settings (
  user_id, tax_percentage, monthly_goal,
  business_name, business_phone, business_email, business_logo
)
```

**Jobs** - Revenue & expense tracking
```sql
junkprofit_jobs (
  user_id, date, customer_name, source, revenue,
  labor, gas, dump_fee, dumpster_rental, additional_expense
)
```

**Quotes** - Customer estimates
```sql
junkprofit_quotes (
  user_id, customer_name/phone/email/address, job_description,
  pricing (JSONB), estimate_low, estimate_high, photo_urls
)
```

All tables have Row-Level Security (RLS) - users can only access their own data.

---

## 🔒 Security

- **Supabase RLS** - Database-level user isolation
- **Supabase Auth** - Industry-standard authentication
- **Stripe Webhooks** - Signature verification
- **HTTPS** - Enforced by Vercel
- **Service Role Isolation** - Admin keys server-side only
- **TypeScript** - Type safety throughout

---

## 📊 Features Checklist

### ✅ Completed (Milestone 1)

- [x] Cloud database with Supabase
- [x] User authentication (signup/login/reset)
- [x] Stripe subscription payments
- [x] Landing page with pricing
- [x] Job tracking (CRUD)
- [x] Quote builder with PDF export
- [x] Marketing source tracking
- [x] Monthly goal progress
- [x] Tax set-aside calculator
- [x] CSV data export
- [x] Image compression
- [x] Mobile responsive design
- [x] Next.js + TypeScript migration
- [x] Vercel deployment ready

### 🚧 Planned (Milestone 2+)

- [ ] Labor tracking (worker count × rate)
- [ ] Quote estimate type toggle (range vs flat)
- [ ] Monthly email statements
- [ ] In-app subscription management
- [ ] Free tier option

---

## 📞 Support

**Project Owner:** Marco A.  
**Email:** theseventhsea.co@yahoo.com

---

## 📄 License

**PROPRIETARY SOFTWARE - ALL RIGHTS RESERVED**

Unauthorized copying, distribution, or modification is prohibited.
See LICENSE file for full terms.

---

*Last Updated: January 2026*  
*Version: 3.0.0 (Next.js)*
