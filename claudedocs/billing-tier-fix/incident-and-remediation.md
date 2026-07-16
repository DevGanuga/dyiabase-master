# Billing Tier Mismatch — Incident, Root Cause & Remediation

**Status:** Code fix committed (`28de891`); config + customer remediation in progress.
**Owner:** Kenneth (PM)
**Last updated:** July 15, 2026

Single source of truth for the "Basic plan in the app but billed the Pro price ($29.99)" incident, first reported by Marco for user Gerardo (`gp6981@yahoo.com`).

---

## 1. Summary

Several customers were shown as **Basic** in the app while Stripe billed them the **Pro $29.99/mo** price. Tier was written from checkout metadata rather than the actual billed price, and the Stripe price configuration is inconsistent with the live account. The code side is fixed; customer refunds and Stripe/env config still need to be completed.

## 2. Symptom & trigger

- **Reported:** Gerardo (`gp6981@yahoo.com`) on Basic in-app, charged $29.99/mo.
- **Confirmed live:** app `subscription_tier = basic`, Stripe subscription on price `price_1T0r9qCYy1nVZfhMmPD64p4L` = $29.99/mo (Pro).

## 3. Root cause

Three compounding issues:

1. **Tier trusted checkout metadata over the billed price.** `checkout.session.completed` and `verify-session` used `session.metadata.subscription_tier` (set client-side) ahead of the actual price. When they disagreed, the app recorded the wrong tier and never self-corrected.
2. **Stripe price IDs in env point at a different/dead account.** Configured Pro IDs (`price_1Srt50EEyJcQEdsw…`, `…5REEyJcQEdsw…`) return `resource_missing`; real customers are billed on `…CYy1nVZfhM…` prices. Two different Stripe accounts.
3. **No real Basic price exists** in the live account, yet users are tagged Basic. `NEXT_PUBLIC_STRIPE_BASIC_*` are unset.

## 4. Blast radius (live audit, July 11 2026)

**Owed refunds — actually paid the overcharge** (assumes Basic = **$19.99**; unconfirmed):

| Customer | Months @ $29.99 | Gross | Already refunded | Still owed |
|---|---|---|---|---|
| gp6981@yahoo.com | 3 | $30 | $10 | $20 |
| brayancarranza02@gmail.com | 3 | $30 | $0 | $30 |
| katelynndelaney57@gmail.com | 1 | $10 | $0 | $10 |
| **Total** | | | | **$60** |

**Fix before trial converts** (tagged Basic, on $29.99 price, $0 paid yet): `hisiyin209@esyline.com`, `rochesternyjunkremoval@gmail.com`, `owen@jubileejunkremoval.com`.

**Manual check — customer id from the other Stripe account** (`resource_missing`, cannot audit automatically): `martinvar95@gmail.com` + 2 others.

> Numbers scale with the Basic price. At $9.99 Basic the per-month overcharge is $20 and totals roughly double. Confirm the intended Basic price before issuing refunds.

## 5. Code fix (done — commit `28de891`)

- **Price is authoritative for tier.** `src/app/api/stripe/webhook/route.ts` and `src/app/api/stripe/verify-session/route.ts` now derive tier from the billed price via `determineTierFromPriceId(...)`; checkout metadata is no longer trusted.
- **Config guard.** `src/lib/env.ts` logs a loud error if a Basic price ID equals a Pro price ID.
- Verified: lint clean, 53 tests pass, production build passes. (Not yet deployed as of this writing — confirm.)

## 6. Config fixes still required

1. Create a real **Basic** recurring price in the **live** account (`…CYy1nVZfhM…`).
2. Set `NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID` / `_ANNUAL_` to it.
3. **Fix the Pro price IDs** — point `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID` / `_ANNUAL_` at the real live prices (monthly Pro = `price_1T0r9qCYy1nVZfhMmPD64p4L`).
4. Deploy the committed code fix.

## 7. Remediation game plan

1. **Confirm the intended Basic price** with Marco (unblocks all refund amounts).
2. **Config + deploy** (section 6) — stops new/recurring mismatches.
3. **Migrate mislabeled subscriptions to Basic** — especially the 3 trial users *before* they convert.
4. **Issue refunds** (section 4) and resolve the 3 other-account customers by hand.
5. **Reconcile stale tiers** to match the billed price (script `--fix` mode, dry-run first).
6. **Re-run the sweep → 0 mismatches**; send Marco the refund table as proof.
7. **Email affected customers** (acknowledge error + months overcharged + refund + corrected plan).

## 8. Tools (read-only unless noted)

- `scripts/reconcile-subscription-tiers.mjs` — compares every subscriber's app tier vs. the billed Stripe price; flags mismatches; counts unreachable subs as UNVERIFIED (never a false all-clear).
  - `node scripts/reconcile-subscription-tiers.mjs` (full sweep) / `… gp6981@yahoo.com` (one user)
- `scripts/audit-overcharges.mjs` — for Basic-tagged users on the Pro price, counts paid $29.99 months, subtracts refunds, computes refund owed.
  - `node scripts/audit-overcharges.mjs` (Basic=$19.99) / `node scripts/audit-overcharges.mjs 9.99`
- Both auto-load `.env.local` and require a real `sk_/rk_` `STRIPE_SECRET_KEY`.

## 9. Open decisions

- **Intended Basic price** ($19.99 vs $9.99 vs other) — blocks refund amounts.
- Whether the 3 "other Stripe account" customers are in scope.
- Deploy timing for the code + config fix.

## 10. Proof for Marco (definition of done)

- All affected subscriptions on the correct price; refunds issued.
- `reconcile-subscription-tiers.mjs` full sweep reports **0 mismatch(es), 0 UNVERIFIED**.
- Affected customers emailed.
- Marco sent the final refund table + clean sweep output.
