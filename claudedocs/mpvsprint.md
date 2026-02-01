Dyia — Market MVP Sprint Proposal
Overview Bring Dyia to a true market-ready MVP by stabilizing the foundation and shipping the first high-
impact AI features. This sprint focuses on reliability, scalability, and clear user value — not experimental AI.
What’s already done (Milestones 1–2, $1,000 total) • Migrated app from vanilla JS to Next.js 16 + TypeScript •
Deployed on Vercel with dyia.io domain setup • Supabase database + auth with per-user data isolation •
Stripe subscriptions (monthly/yearly) with webhook groundwork • Dashboard with core stats and job/quote
flows • Landing page + branding aligned to Dyia • Ongoing bug fixes, testing, and deployment work •
Product/UX input, roadmap thinking, AI ideation • Acting as technical lead coordinating across repos
Current state • App is functional but core logic is single-fire • Components mix UI + data logic • No AI
features implemented yet • No email/notification system • No background jobs or reporting layer
Sprint goals • Refactor core logic so the app can safely support AI and scaling • Ship must-have AI features
users immediately understand • Add email delivery and reporting • Stabilize Stripe, auth, and main user
flows
Scope of work
1.
Foundation & Refactor (required) • Separate UI from data/services • Shared types, hooks, domain
services • Error handling, loading states, guardrails Estimated: 10–14 hrs
2.
Weekly AI Insights (required) • Auto-generated weekly performance summary • Revenue, profit,
margins, quote activity • Actionable suggestions (follow-ups, drops, spikes) • Delivered via email +
shown in dashboard Estimated: 5–7 hrs
3.
Revenue Forecasting (MVP) • Short-term forecast (week/month) • Historical trend-based + AI
narrative • Dashboard widget with confidence note Estimated: 4–6 hrs
4.
Smart Follow-Ups • Detect stale/unconverted quotes • Dashboard list of follow-ups to send • Optional
email reminders Estimated: 3–5 hrs
5.
Dynamic Pricing Recommendations (MVP) • "Price this job" assistant • Uses job inputs + historical
data + profit goals • Outputs safe price range with explanation • User always controls final price
Estimated: 8–12 hrs
6.
Monthly PDF Report • Downloadable monthly performance report • Key metrics, tables, summaries •
Optional email delivery Estimated: 4–6 hrs
7.
Email & Notifications • Resend integration • Templates for insights, follow-ups, reports • Event-based
+ scheduled sends Estimated: 4–6 hrs
8.
QA & Stabilization • End-to-end testing across flows • Fix edge cases, polish UX Estimated: 6–8 hrs
1
Estimated total • 40–55 hours • At $60/hr: $2,400 – $3,300 • Expected execution range: 45–50 hrs ($2,700 –
$3,000)
Proposed milestone structure
Milestone 3A – Foundation & Stability (20–25 hrs) • Refactor for AI readiness • Finish Stripe wiring + domain
correctness • Email system live • Smart follow-ups shipped
Milestone 3B – AI & Reporting (20–25 hrs) • Weekly insights • Revenue forecasting • Dynamic pricing (MVP) •
Monthly PDF reports
Timeline • 5–7 focused working days • Feb 1 market release is realistic if scope stays locked
Client inputs needed • Auth decision (current vs Clerk) • Stripe keys + final pricing tiers • Resend domain
access • Weekly insight cadence • Pricing optimization goal (profit vs revenue)
Out of scope (unless added later) • Full admin panel • CRM repo merge • Advanced forecasting models •
Vector similarity pricing • SMS/WhatsApp automation
Definition of done • Stable dyia.io deployment • Subscriptions fully working • AI insights delivered reliably •
Forecasting visible in dashboard • Follow-ups surfaced clearly • Pricing recommendations safe + explainable
• Monthly reports generated without errors
2