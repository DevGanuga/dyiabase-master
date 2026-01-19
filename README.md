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
| Frontend | Vanilla JavaScript, HTML5, CSS3 |
| Backend | Supabase (PostgreSQL + Auth) |
| Payments | Stripe Subscriptions |
| Hosting | Netlify |
| Functions | Netlify Functions (Node.js) |
| PDF Generation | jsPDF |

---

## 📁 Project Structure

```
junkprofit-tracker/
├── index.html                    # Redirects to landing page
├── landing.html                  # Marketing page with pricing
├── app.html                      # Authenticated app shell
├── app.js                        # Main application logic
├── styles.css                    # App styling
├── SETUP.md                      # Configuration guide
├── MILESTONE_1_DELIVERABLES.md   # Detailed delivery documentation
├── netlify/
│   └── functions/
│       ├── create-checkout.js    # Stripe checkout session
│       ├── stripe-webhook.js     # Subscription webhooks
│       └── package.json
└── supabase/
    └── migrations/
        └── 001_create_junkprofit_schema.sql
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

- Supabase account (free tier works)
- Stripe account
- Netlify account
- Node.js (for local function testing)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/junkprofit-tracker.git
cd junkprofit-tracker
cd netlify/functions && npm install
```

### 2. Configure Services

See `SETUP.md` for detailed instructions:

1. Create Supabase project and run migration
2. Set up Stripe products and webhook
3. Update config in `app.html` and `landing.html`
4. Set Netlify environment variables

### 3. Deploy

```bash
git push origin main  # Netlify auto-deploys
```

---

## 🔧 Development

### Local Testing

Open `index.html` directly in browser for basic testing.

For full auth/payments flow, you need:
1. Netlify Dev (`netlify dev`) for functions
2. Supabase project (can use development project)
3. Stripe test mode

### Key Files

| File | Purpose |
|------|---------|
| `app.js` | All application logic, Supabase queries |
| `app.html` | Auth flow, app shell, Supabase init |
| `landing.html` | Marketing, pricing, checkout trigger |
| `create-checkout.js` | Creates Stripe checkout sessions |
| `stripe-webhook.js` | Handles subscription lifecycle |

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
- **HTTPS** - Enforced by Netlify
- **Service Role Isolation** - Admin keys server-side only

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
*Version: 2.0.0 (SaaS)*
