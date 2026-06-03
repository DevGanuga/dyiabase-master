# Dyia Release Guide — June 2, 2026

**Dyia Pay · Subscriptions & Downgrades · Full Admin Control · iOS-Native App UI · Marketing Website**

> This document covers the full body of work in commit **`fb492ab`** —
> _"Update project configuration and enhance payment processing features"_
> (133 files: **68 added, 64 modified, 1 removed**). At the time of writing the
> working tree is clean (everything below is committed). Use this as the QA /
> deploy / hand-off guide for the release.

---

## 0. At a glance

| Workstream | What shipped | Risk | Needs migration? |
|---|---|---|---|
| **A. Dyia Pay** | Stripe Connect payments, tips, reconciliation, expired-session handling, live hub refresh | Medium (money) | Yes — `041` |
| **B. Subscriptions** | Self-service + admin downgrade to Basic, cancel at period end | Medium (billing) | Yes — `040` |
| **C. Admin panel** | Dashboard fix, full subscription lifecycle, cross-linked surfaces, auth alignment | Low | Yes — `042` |
| **D. iOS-native UI** | Unified motion system, translucent safe-area tab bar, themed sheets | Low (CSS/UI) | No |
| **E. Marketing site** | 11-page site, 8 custom graphics, emoji-free icon system | Low (public pages) | No |

**Verification status:** `tsc --noEmit` clean · ESLint clean on all changed files · 11 marketing routes return `200` · mobile (390×844) + desktop (1440×900) visually verified · payments money-math unit test passing.

---

## A. Dyia Pay (Stripe Connect payments)

Lets a merchant collect card payments from their customers. Money flows via a
**Stripe Connect destination charge** to the merchant's connected account; Dyia
takes a flat **0.75% platform fee on the base amount only**.

### What this release adds / fixes
- **Customer tipping (Marco's request).** Optional tip on the public `/pay/[token]`
  page (15/18/20% or custom) across pay links, invoices, and quote/job payments.
  **Tips go 100% to the merchant** — the platform fee is computed on the base
  (`amount_cents`) only and the tip is a separate Stripe line item.
- **Tip reconciliation everywhere.** Tip is computed authoritatively from the paid
  Stripe session/intent total in all three reconciliation paths:
  - `checkout.session.completed` / `payment_intent.succeeded` webhook handlers
  - the customer redirect `verify` route
  - **`sync-pending` (fixed this release)** — previously marked a payment paid
    **without** writing `tip_cents`, so tips under-reported whenever the webhook
    was down. Now mirrors the webhook math (`max(0, total − base)`).
- **Stuck-checkout cleanup (new).** Added a `checkout.session.expired` webhook
  handler that rolls an unpaid `checkout_created` row back to `pending` (still
  payable) instead of leaving it stuck forever, and drops the dead session id.
- **Live payments hub.** `Payments.tsx` now reconciles + refetches on tab
  focus/visibility (throttled 5s), so a payment made elsewhere appears without a
  manual reload.
- **Merchant onboarding stays live.** `account.updated` webhook keeps the
  `stripe_connect_*` flags current so the hub flips to "Live" automatically.
- **Admin payments + full refunds** (`/app/admin/payments` + `/api/admin/payments`).

### Key files
- Public flow: `src/app/pay/[token]/page.tsx`, `src/app/api/payments/public/[token]/{route,checkout,verify}.ts`
- Create: `src/app/api/payments/request/route.ts`, `request/custom/route.ts`, `src/components/app/CreatePaymentRequestModal.tsx`, `PaymentLinkReadyModal.tsx`
- Hub: `src/components/app/Payments.tsx`, `src/app/api/payments/list/route.ts`
- Reconcile: `src/app/api/payments/sync-pending/route.ts`, `src/app/api/stripe/webhook/route.ts`
- Connect: `src/app/api/stripe/connect/{account,status,dashboard,onboarding}/route.ts`
- Money math (single source of truth): `src/lib/payments.ts`; demo mode: `src/lib/demo-payments.ts`; helpers: `src/lib/stripe.ts`

### ⚠️ Operational dependency
Tip + paid reconciliation is correct in three layers, but the **Stripe webhook
must be configured correctly in production** (see §8). `verify` and `sync-pending`
are backups, not substitutes.

---

## B. Subscriptions & Billing

Three tiers gated by `computeSubscriptionState()` (`src/lib/subscription.ts`,
`src/hooks/useSubscription.ts`): **basic** (free), **trial** (14-day full Pro),
**pro** (paid). 14-day trial is full Pro and steps down to the chosen plan after.

### What this release adds / fixes
- **Self-service downgrade to Basic (Pro → Basic at period end).**
  `POST /api/stripe/subscription/cancel` sets Stripe `cancel_at_period_end: true`,
  mirrors the flag + `subscription_ends_at` in the DB (migration **040**), and
  `DELETE` undoes the scheduled downgrade. The user keeps Pro until the period
  they already paid for ends.
- **Admin cancel parity (fixed this release).** `/api/admin/cancel-subscription`
  now writes `cancel_at_period_end` + `subscription_ends_at` optimistically on the
  scheduled path (previously relied solely on the webhook), matching the
  self-service route.
- **Admin plan switch** `/api/admin/switch-plan` (live Stripe price swap, prorated)
  for support cases ("downgrade me to Basic").
- **Dunning.** `invoice.payment_failed` stamps `payment_failed_at` (one-time) for a
  grace window and emails the customer; cleared on recovery.

### Key files
`src/lib/subscription.ts`, `src/hooks/useSubscription.ts`,
`src/app/api/stripe/subscription/cancel/route.ts`,
`src/app/api/admin/cancel-subscription/route.ts`, `src/app/api/admin/switch-plan/route.ts`,
`src/app/api/stripe/webhook/route.ts` (subscription events),
`src/app/api/stripe/{checkout,verify-session,portal}/route.ts`.

---

## C. Admin Panel

Two surfaces: the in-app **AdminPanel** (Sidebar → "Admin Panel") and the
standalone **`/app/admin/*`** pages (dashboard, users, user detail, Dyia Pay,
webhooks).

### What this release adds / fixes
- **Dashboard crash fixed.** `/app/admin` read the whole `{ metrics, users }`
  payload as `metrics`, so every `m.mrr`/`m.totalUsers` was `undefined` and the
  page crashed. Now unwrapped + guarded.
- **Full subscription lifecycle on the user-detail page.** Added **Cancel at
  Period End / Cancel Immediately** controls, surfaced the **"Scheduled to cancel
  on \<date\>"** state, and hardened load error handling (403/500 no longer shows
  a misleading "User not found").
- **Surfaces interconnected.** The in-app AdminPanel now links to the previously
  URL-only standalone tools (Dyia Pay, Webhooks, full dashboard); the **Admin**
  entry also appears in the mobile "More" sheet.
- **Auth aligned.** `/app/admin/layout.tsx` now authorizes via `isAdminByClerkId`
  (`is_admin` **OR** `role` in admin/super_admin) — matching the admin APIs.
  Previously a role-based admin could call every admin API but was bounced out of
  the standalone pages.
- **Webhook log fix.** Migration **042** adds `dyia_webhook_events.error_message`
  (the column `logWebhookEvent()` actually writes) so the admin Webhooks log stops
  under-reporting errors.

### Key files
`src/app/app/admin/{layout,page}.tsx`, `src/app/app/admin/users/{page,[id]/page}.tsx`,
`src/app/app/admin/{payments,webhooks}/page.tsx`, `src/components/app/AdminPanel.tsx`,
`src/app/api/admin/{metrics,stats,users/[id],payments,webhooks,cancel-subscription,switch-plan,toggle,beta-access}/route.ts`,
`src/lib/admin.ts`.

---

## D. iOS-Native App UI & Motion (in-app `/app`)

A platform-wide polish pass so the whole product shares one motion language and
feels native on iPhone.

### What this release adds
- **Unified motion system** in `src/app/globals.css` — a tailwindcss-animate-compatible
  `enter`/`exit` engine with a single iOS-spring curve. The
  `animate-in / fade-in / slide-in-from-* / zoom-in-95 / duration-*` classes used
  across 8+ components were previously **no-ops**; they now resolve to consistent,
  springy motion. Includes full **`prefers-reduced-motion`** support.
- **iOS bottom tab bar.** The flat dark bar became a **translucent, blurred,
  theme-aware** tab bar that respects `env(safe-area-inset-bottom)` (no more
  home-indicator overlap), with an active-tab lift and press feedback (`.ios-tab`).
- **Themed "More" sheet.** Proper iOS bottom sheet: grab handle, safe-area inset,
  theme-aware surface, springy slide, plus the Admin entry for admins.
- **Nothing clipped.** Content padding reserves the tab-bar height + safe area;
  overlays/sheets contain their overscroll (native rubber-band).

### Key files
`src/app/globals.css`, `src/components/app/Sidebar.tsx`,
`src/components/app/CreatePaymentRequestModal.tsx`, `src/components/app/Assistant.tsx`,
`src/app/app/page.tsx`.

### Verified
Mobile viewport (390×844): translucent tab bar + active state, "More" sheet
animation, and **no overflow/clipping** on Dashboard, Payments, and Jobs.

---

## E. Marketing Website

Went from a **single** landing page (≈25 emojis, no SEO, no depth) to a structured
**11-page** marketing site — the page-depth pattern competitors (Jobber, Housecall
Pro, ServiceTitan) use to rank and feel like a serious platform.

### What this release adds
- **8 custom brand graphics** (`public/marketing/`): 5 photoreal "service owners
  using dyia" shots (junk removal, lawn care, cleaning, doorway tap-to-pay, on-site
  phone) + 3 brand renders (profit dashboard, AI orb, chaos→clarity). One warm
  dark/orange grade.
- **Emoji-free icon system** — a crafted 28-icon line set (`src/components/marketing/icons.tsx`)
  replaces every decorative emoji site-wide.
- **Reusable marketing kit:** `MarketingShell`, `MarketingFooter`, `sections.tsx`
  (CTAs, headings, feature splits/cards, proof strip, comparison table),
  `templates.tsx` (feature + industry page layouts).
- **Landing page rebuilt:** real "Built for the people who do the work" band,
  reworked Problem section (chaos→clarity image + icon cards), a new **Dyia Pay**
  section, an **honest/current** comparison (Jobber starts ~$49 not $349; competitors
  have AI), trademark disclaimers, links to `/vs` pages, beta-credible proof (no
  invented user counts), and the shared footer.
- **10 new pages, each with SEO `metadata`:**
  - `/features` (hub) + `/features/{profit-tracking,quotes,payments,dyia-ai}`
  - `/vs/jobber`, `/vs/housecall-pro`
  - `/for/{junk-removal,lawn-care,cleaning}`
- **Nav updated:** `PublicHeader` points to `/features`; `BusinessTypes` uses icons
  and links the three live trades to their industry pages.

### Decision to confirm
The core product is trade-agnostic, so **lawn care + cleaning are marked "Live"**
alongside junk removal (moving/handyman/pressure-wash remain "coming soon" with the
waitlist). Flip those two to a waitlist framing if you'd prefer.

---

## 6. Database migrations — apply in order

New in this release (additive, safe — `ADD COLUMN IF NOT EXISTS`):

| Migration | Adds | Why |
|---|---|---|
| `040_cancel_at_period_end.sql` | `dyia_users.cancel_at_period_end BOOLEAN DEFAULT FALSE` | Mirrors Stripe's scheduled-downgrade flag so the UI shows "Downgrading on \<date\>" without a Stripe round-trip. |
| `041_payment_tips.sql` | `dyia_payments.tip_cents INTEGER DEFAULT 0`, `allow_tip BOOLEAN DEFAULT true` | Customer tipping; tip is 100% merchant, fee on base only. |
| `042_webhook_error_message.sql` | `dyia_webhook_events.error_message TEXT` (+ backfill) | Aligns the table with `logWebhookEvent()` so the admin webhook log reports errors. |

> Prerequisite (must already be applied from prior payments work): `028` (Stripe
> Connect / `dyia_payments`), `036` (`refunded_amount_cents` + `partial_refund`),
> `037` (`payment_failed_at`), `039` (standalone payments / invoices).

```bash
# Apply via Supabase CLI (or paste each SQL into the SQL editor in order)
supabase db push
```

---

## 7. Environment variables

Already required (see `CLAUDE.md`): Clerk, Supabase (url/anon/service role),
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `OPENAI_API_KEY`, monthly/annual
Pro price IDs.

Confirm these are set for this release:
- `NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID`, `NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID` — Basic plan + admin switch-plan downgrades.
- `STRIPE_CONNECT_COUNTRY` (optional; defaults to `US`) — Connect Express onboarding.
- Resend key (customer dunning / confirmation emails) if used.

> The dev log flagged these as currently unset: `CRON_SECRET`,
> `NEXT_PUBLIC_STRIPE_BASIC_*_PRICE_ID`, `STRIPE_CONNECT_COUNTRY`,
> `NEXT_PUBLIC_SENTRY_DSN`. Set the Basic price IDs before relying on Basic
> checkout / downgrades.

---

## 8. Stripe configuration

1. **Connect** — enable Express accounts on the platform account.
2. **Webhook endpoint** → `/api/stripe/webhook`, subscribed to:
   - `checkout.session.completed`
   - **`checkout.session.expired`** ← new in this release
   - `payment_intent.succeeded`
   - `charge.refunded`
   - `account.updated`
   - `customer.subscription.updated`, `customer.subscription.deleted`
   - `invoice.paid`, `invoice.payment_failed`
3. Set `STRIPE_WEBHOOK_SECRET` to the endpoint's signing secret (`whsec_…`).
4. Each merchant completes Connect onboarding (`charges_enabled`) before "Get paid"
   unlocks; merchant business info (name/email/phone) must be filled in Settings.

---

## 9. Testing performed this session

- **Type check:** `npx tsc --noEmit` → clean.
- **Lint:** ESLint clean on all changed files.
- **Route smoke test:** all 11 marketing routes return `200`
  (`/`, `/features`, 4 feature pages, 2 `/vs`, 3 `/for`).
- **Mobile iOS visual verification (390×844):** translucent tab bar + active state,
  "More" sheet animation, no overflow/clipping on Dashboard / Payments / Jobs.
- **Marketing visual verification (desktop 1440×900 + mobile):** all pages render
  cleanly — real photos load, no emojis, no text overflow, no overlap.
- **Payments money math:** `claudedocs/payments-release/payments-logic.test.mts`
  (run with `node --experimental-strip-types`).
- **QA screenshots:** `claudedocs/payments-release/qa-*.png` (hub, invoice, pay
  link, modal, public pages — desktop + iOS).

### Suggested pre-prod manual QA
1. Connect a test merchant; confirm hub flips to "Live".
2. Create a pay link **with tipping on** → pay as a customer with a tip → confirm
   merchant hub shows base + tip, and the connected account receives the full tip.
3. Abandon a checkout → confirm the row returns to `pending` (expired handler).
4. Self-service: schedule a downgrade to Basic → confirm "Downgrading on \<date\>"
   + undo. Admin: cancel at period end + immediate.
5. Refund from `/app/admin/payments` → confirm quote/job returns to pending.

---

## 10. Deploy checklist

- [ ] Apply migrations `040`, `041`, `042` (after confirming `028/036/037/039`).
- [ ] Set Basic price-ID env vars (+ Connect country if non-US).
- [ ] Configure the Stripe webhook with all events in §8 (incl. `checkout.session.expired`).
- [ ] `npm run build` on the deploy target.
- [ ] Deploy; smoke-test `/`, `/features`, `/app`, `/pay/<token>`.
- [ ] Run the manual payments QA in §9.
- [ ] (Optional) Re-render `Dyia_Payments_Release_Guide.pdf` if distributing.

---

## 11. Rollback

- Code: `git revert fb492ab` (single commit) or redeploy the prior build.
- Migrations are **additive** (new nullable/defaulted columns) — safe to leave in
  place even if code is rolled back; `tip_cents`, `allow_tip`,
  `cancel_at_period_end`, and `error_message` are simply unused by older code.
- No destructive schema changes; `BetaBanner.tsx` was the only deletion (replaced
  by `TrialBanner`).

---

## 12. Known gaps / follow-ups (not blockers)

- **Per-request tip opt-out on quote/job pay links** — tips work (default on); the
  merchant toggle exists only for standalone links/invoices (deferred).
- **Merchant-facing refunds** — currently admin-only.
- **`dyia_payments` RLS policy** still compares Clerk subject to a UUID and never
  matches; mitigated because the feed reads through a service-role server route.
- **Admin MRR/ARR** are estimates from list prices, not Stripe Billing actuals.
- **Impersonation API** (`/api/admin/impersonate`) sets a cookie nothing reads —
  remove or finish it.
- **Marketing:** add Open Graph / social-share images, more industry pages, and a
  resources/learn hub. Confirm lawn-care/cleaning "Live" vs waitlist.

---

## 13. File inventory (commit `fb492ab`)

**Added (68)** — highlights:
- Marketing: `src/components/marketing/{icons,sections,templates,MarketingShell,MarketingFooter}.tsx`;
  `src/app/features/page.tsx` + `features/{profit-tracking,quotes,payments,dyia-ai}/page.tsx`;
  `src/app/vs/{jobber,housecall-pro}/page.tsx`; `src/app/for/{junk-removal,lawn-care,cleaning}/page.tsx`;
  `public/marketing/*.png` (8 images).
- Payments/billing: `src/app/api/payments/list/route.ts`, `src/app/api/admin/payments/route.ts`,
  `src/app/api/stripe/subscription/cancel/route.ts`, `src/app/app/admin/payments/page.tsx`,
  `src/lib/{payments,demo-payments,errors}.ts`.
- Migrations: `supabase/migrations/{040,041,042}_*.sql`.
- Docs/QA: `claudedocs/payments-release/{payments-logic.test.mts, qa-*.png}`.
- (Plus 24 `.playwright-mcp/*.yml` browser-session artifacts — safe to gitignore/prune.)

**Modified (64)** — highlights:
- App UI/motion: `src/app/globals.css`, `src/components/app/{Sidebar,Payments,CreatePaymentRequestModal,Assistant,AdminPanel,Settings,Jobs,Quotes,QuoteBuilder,Dashboard,TopBar,Marketing,MassEmail,PendingActionsCard}.tsx`, `src/app/app/page.tsx`.
- Landing/marketing: `src/app/page.tsx`, `src/components/PublicHeader.tsx`, `src/components/landing/BusinessTypes.tsx`.
- Payments/Stripe: `src/app/api/payments/{sync-pending,request,request/custom,public/[token]/*}/route.ts`, `src/app/api/stripe/{webhook,checkout,verify-session,portal,connect/*}/route.ts`, `src/lib/stripe.ts`.
- Admin/subscription: `src/app/app/admin/{layout,page,users/page,users/[id]/page,webhooks/page}.tsx`, `src/app/api/admin/{cancel-subscription,users/[id]}/route.ts`, `src/lib/{admin,subscription}.ts`, `src/hooks/useSubscription.ts`, `src/types/database.ts`.
- Config: `.gitignore`, `eslint.config.mjs`, `tsconfig.json`.

**Removed (1):** `src/components/app/BetaBanner.tsx`.

---

_Generated for the Dyia June 2, 2026 release. Pair with the existing
`claudedocs/payments-release/` guide for the Dyia Pay deep-dive + QA screenshots._
