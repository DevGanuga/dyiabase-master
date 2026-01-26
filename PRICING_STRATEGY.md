# Dyia Pricing & Tier Strategy

**Prepared for:** Marco Ayala  
**Date:** January 26, 2026  
**Re:** AI Feature Tiers & Pricing Recommendation

---

## Executive Summary

**Recommendation: Two-tier model** — a Basic plan for job tracking + a Pro plan with AI features.

This approach:
- Lowers barrier to entry (more signups)
- Creates clear upgrade path with tangible AI value
- Improves unit economics vs. single low-price tier
- Positions Dyia competitively against Jobber/Housecall Pro

---

## The Math Problem

| Scenario | Monthly Price | Users to Break Even ($8k dev) | With AI Costs (~$0.50/user/mo) |
|----------|---------------|-------------------------------|--------------------------------|
| Single tier @ $12.99 | $12.99 | 616 users | 640+ users |
| Single tier @ $19.99 | $19.99 | 400 users | 411 users |
| Two tiers (blended) | ~$17 avg | 471 users | 485 users |

At $12.99 single-tier, you need **600+ paying users** just to cover development. That's a lot of volume for a niche tool.

**Two tiers solve this** by capturing:
- Price-sensitive users at Basic (still paying something)
- Higher willingness-to-pay users at Pro (where margin is better)

---

## Recommended Tier Structure

### Basic Plan — $12.99/month (or $129/year)

**Core Value:** "Track every job, know your numbers"

| Feature | Included |
|---------|----------|
| Unlimited job tracking | ✓ |
| Dashboard with stats (revenue, profit, expenses) | ✓ |
| Monthly goal tracking | ✓ |
| Tax set-aside calculator | ✓ |
| Quote builder | ✓ |
| Marketing source tracking | ✓ |
| Basic PDF quotes | ✓ |
| Mobile-friendly web app | ✓ |

**What's NOT included:**
- AI features
- Email notifications
- Advanced reports
- Priority support

---

### Pro Plan — $24.99/month (or $249/year)

**Core Value:** "AI-powered insights to grow your business"

| Feature | Included |
|---------|----------|
| Everything in Basic | ✓ |
| **Weekly AI Insights** — Personalized business summary delivered to your inbox | ✓ |
| **Smart Follow-Up Reminders** — Know which quotes to chase and when | ✓ |
| **Revenue Forecasting** — Predict next month's income | ✓ |
| **AI Quote Suggestions** — Pricing recommendations based on your history | ✓ |
| **Monthly PDF Reports** — Professional reports for taxes/partners | ✓ |
| **Email Notifications** — Get notified on key events | ✓ |
| Priority support | ✓ |

---

## AI Features Breakdown

### Launching with MVP Sprint (Feb 1)

| Feature | Tier | Description | AI Cost/User |
|---------|------|-------------|--------------|
| Weekly Insights | Pro | GPT-generated summary of your week's performance | ~$0.10/week |
| Smart Follow-Ups | Pro | Surface quotes that need attention based on age + patterns | ~$0.02/trigger |
| Revenue Forecasting | Pro | Predict next month's revenue from historical data | ~$0.05/month |
| AI Quote Suggestions | Pro | "Similar jobs priced at $180-$220" | ~$0.03/quote |

**Estimated AI cost per Pro user:** $0.40-0.60/month  
**Margin at $24.99:** ~$24/user/month after AI costs

### Future Features (Post-Launch)

| Feature | Potential Tier | Notes |
|---------|----------------|-------|
| Dynamic Pricing | Pro | "Demand is high, consider +15%" |
| Photo-Based Estimation | Pro+ or Add-on | Requires vision API, higher cost |
| Voice Job Entry | Pro | "Hey Dyia, log a job..." |
| Route Optimization | Pro+ or Add-on | Requires maps API |
| Natural Language Entry | Basic or Pro | High value, moderate cost |

---

## Why Two Tiers (Not One)

### Option A: Single Tier @ $12.99
❌ **Problems:**
- Need 600+ users to break even
- AI costs eat into already thin margin
- No upgrade path = leaving money on table
- Competing on price with spreadsheets

### Option B: Single Tier @ $24.99
❌ **Problems:**
- Higher barrier to entry
- Some users just want basic tracking
- May limit initial adoption/word-of-mouth

### Option C: Two Tiers ✓
✅ **Advantages:**
- Basic captures price-sensitive users (still revenue)
- Pro captures users who see AI value (better margin)
- Natural upgrade flow: use Basic → see value → want more → upgrade
- Can A/B test pricing on Pro tier
- Positions AI as premium differentiator

---

## Competitive Positioning

| Competitor | Price | AI Features | Dyia Advantage |
|------------|-------|-------------|----------------|
| Jobber | $49-249/mo | None | AI insights, 1/4 the price |
| Housecall Pro | $49-109/mo | None | AI insights, simpler UX |
| Spreadsheets | Free | None | Automated tracking, insights |
| Dyia Basic | $12.99/mo | None | Affordable, purpose-built |
| **Dyia Pro** | $24.99/mo | ✓ Weekly insights, forecasting, follow-ups | **Only AI-powered option** |

**Positioning statement:**
> "Dyia doesn't just track your jobs — it learns your business and helps you make more money."

---

## Recommended Launch Strategy

### Phase 1: Launch (Feb 1)
- **Basic:** $12.99/mo — full job tracking, quotes, dashboard
- **Pro:** $24.99/mo — adds Weekly Insights, Follow-Ups, Revenue Forecast
- **Free trial:** 14 days of Pro (converts to Basic if no payment, or stays Pro if they pay)

### Phase 2: Post-Launch (Feb-March)
- Monitor conversion rates (Basic → Pro)
- Add AI Quote Suggestions to Pro
- Add Monthly PDF Reports
- Consider annual discount (2 months free)

### Phase 3: Scale (Q2)
- Evaluate Pro+ tier or add-ons for premium features (photo estimation, route optimization)
- Evaluate usage-based pricing for heavy AI users
- Build admin panel as user base grows

---

## Breakeven Scenarios (Revised)

Assuming 30% of users go Pro, 70% stay Basic:

| Total Users | Basic Revenue | Pro Revenue | Monthly Total | Months to $8k |
|-------------|---------------|-------------|---------------|---------------|
| 100 | $909 | $750 | $1,659 | 4.8 |
| 200 | $1,818 | $1,500 | $3,318 | 2.4 |
| 300 | $2,727 | $2,250 | $4,977 | 1.6 |
| 500 | $4,545 | $3,750 | $8,295 | < 1 |

**With two tiers, 300-400 users gets you to profitability** vs. 600+ with single tier.

---

## Final Recommendation

| Decision | Recommendation |
|----------|----------------|
| Number of tiers | **Two** (Basic + Pro) |
| Basic price | **$12.99/month** |
| Pro price | **$24.99/month** |
| Free trial | **14 days of Pro** |
| Annual discount | **2 months free** ($129/yr Basic, $249/yr Pro) |
| AI features in Basic | **None** (keep as Pro differentiator) |

This structure:
- Keeps entry price competitive ($12.99)
- Creates real value differentiation for Pro
- Improves unit economics significantly
- Gives room to add Pro+ tier later
- Aligns AI costs with revenue (only Pro users trigger AI)

---

## Questions for Marco

1. Does $24.99 for Pro feel right, or should we test $19.99?
2. Should we offer a "Founder's discount" for early adopters (e.g., $19.99/mo Pro locked in)?
3. Any features you want moved between tiers?
4. Comfortable with 14-day Pro trial, or prefer 7 days?

---

*Document created: January 26, 2026*
