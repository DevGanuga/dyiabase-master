# Release Note — Subscription Billing Tier Fix

**Date:** July 11, 2026
**Trigger:** Support report from Marco — user **Gerardo (`gp6981@yahoo.com`)** on the Basic plan in the app but billed the Pro price ($29.99/mo).
**Commit:** `28de891` — _Fix subscription tier to follow the billed Stripe price, not checkout metadata_

---

## The problem

A customer's plan in the app (`subscription_tier = basic`) did not match what Stripe was actually charging (the $29.99 Pro price). The app said one thing; the invoice said another.

## Root cause

Tier was written from the **checkout session metadata** instead of the **actual billed price**. Two paths trusted `session.metadata.subscription_tier`:

- `src/app/api/stripe/webhook/route.ts` — `checkout.session.completed`
- `src/app/api/stripe/verify-session/route.ts` — synchronous post-checkout activation

Because metadata is set client-side (`subscription_tier: tier || 'pro'`), it could disagree with the price the subscription was actually created on. When it did, the app recorded "Basic" while Stripe billed "Pro" — and it never self-corrected, since the metadata was trusted ahead of the price.

## How we solved it

1. **Price is now the single source of truth for tier.** Both the webhook and verify-session derive tier from the actual subscription price via `determineTierFromPriceId(...)`. Checkout metadata is no longer trusted for tier, so the app can never again show a tier that differs from what Stripe charges.
2. **Config guard.** On startup (`src/lib/env.ts`), if a Basic price ID equals a Pro price ID, we log a loud error — that misconfiguration would bill Basic customers the Pro amount. Non-fatal, so it surfaces in logs/monitoring without taking prod down.
3. **Read-only reconciliation tool** (`scripts/reconcile-subscription-tiers.mjs`): compares every subscribed user's app tier against the real Stripe price, flags mismatches, and highlights any single user. It refuses to run with an invalid Stripe key and reports unreachable subscriptions as **UNVERIFIED** (never a false "all clear").

## Verification status

- **Code:** verified — lint clean, 53 tests pass, production build passes; all authoritative tier writes derive from price.
- **Live data:** still to be run where a real `sk_live_…` key is available. (Local `.env.local` currently holds a `whsec_…` value in `STRIPE_SECRET_KEY`, so the script cannot reach Stripe from this machine.)

To finish, run where the live key exists:

```bash
node scripts/reconcile-subscription-tiers.mjs               # full sweep
node scripts/reconcile-subscription-tiers.mjs gp6981@yahoo.com
```

Target result: `X verified, 0 UNVERIFIED, 0 mismatch(es)`.

## Still required for Gerardo (account, not code)

The code fix makes the data honest going forward, but on his next Stripe event it will set him to **Pro** (matching the $29.99 he's billed). If he should be **Basic**, that's a separate account action:

1. Ensure a correctly-priced Basic price exists in Stripe and the `NEXT_PUBLIC_STRIPE_BASIC_*` env vars point at it.
2. Move his subscription to Basic (admin **Switch Plan → Basic**, which prorates).
3. Refund/credit the overcharge.

---

## Short version for Marco (Slack)

> Found it — Gerardo's plan in the app wasn't reading from what Stripe actually bills, so it showed Basic while charging the Pro price. We've fixed that at the source: the plan now always follows the real Stripe price, and we added a safeguard so a mismatched price can't slip through again. Next we'll confirm Gerardo's exact charge and get him onto the right plan with a refund for the difference — I'll follow up once that's done.
