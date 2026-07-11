# Release Note — Billing Tier Fix

**Area:** Subscriptions / Stripe · **Type:** Bug fix + hardening

## Symptom

A user (Gerardo, `gp6981@yahoo.com`) showed as **Basic** in the app but was being **billed $29.99 (the Pro price)** in Stripe. The app's plan and the actual charge disagreed.

## Root cause

Subscription tier was written from the **checkout session metadata** (`subscription_tier`), which is set client-side, and only fell back to the real price:

```
// before
const subscriptionTier = session.metadata?.subscription_tier || determineTierFromPriceId(price)
```

So if a checkout stamped `tier: 'basic'` while the line item used a Pro price, the app recorded **Basic** while Stripe billed **Pro**. The synchronous `verify-session` path had the same metadata-first logic. Nothing reconciled the two, so the mismatch persisted.

## How we solved it

The **billed Stripe price is now the single source of truth** for tier — checkout metadata is never trusted for it.

- `src/app/api/stripe/webhook/route.ts` — `checkout.session.completed` derives tier from the subscription item's price (`determineTierFromPriceId`). The subscription-update handler already did this.
- `src/app/api/stripe/verify-session/route.ts` — same change on the immediate post-checkout activation path.
- Net effect: the plan shown in the app can no longer drift from what the customer is actually charged.

## Prevention

- **Config guard** (`src/lib/env.ts`): on boot, logs a loud error if a Basic price ID equals a Pro price ID — the most likely way this gets misconfigured — so it surfaces in logs instead of silently overcharging. Non-fatal, so a bad env never takes prod down.
- **Read-only reconciliation script** (`scripts/reconcile-subscription-tiers.mjs`): compares every subscribed user's app tier against the actual Stripe price, flags mismatches, and refuses to run (or report a false "0 mismatches") when the Stripe key is invalid.

## Verification

- Code: grep confirms all authoritative tier writes derive from price; lint clean; 53 tests pass; production build passes.
- Live data: run `node scripts/reconcile-subscription-tiers.mjs` with a real `sk_…` key and the Basic price IDs; target `0 UNVERIFIED, 0 mismatch(es)`.

## Still required (account remediation — not covered by code)

The fix makes the data honest on the next Stripe event, but it does **not** refund. For Gerardo specifically:
1. Confirm his Stripe price vs. intended plan.
2. If he should be Basic: ensure a real Basic price exists, switch his subscription, and refund/credit the overcharge.
3. Re-run the reconciliation sweep to confirm no other users are affected.
