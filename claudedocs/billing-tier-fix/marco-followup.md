# Follow-up for Marco

_Covers his three open threads: demo access, the "founders" discount, and the Stripe billing issue. Verified against live Stripe on July 16, 2026._

---

## Slack message (ready to send)

Hey Marco — did the full sweep with Ken. Here's where everything landed on all three:

**1. Demo account access.** Password is **`test-demo-2026`**. Go to the sign-in page, use the "Marketing demo" box, and it opens a fully loaded sample account (sample data only — safe to record). No login needed.

**2. "Founders" discount.** Confirmed the `FOUNDERS` code works — it takes **$10/mo off, forever** ($29.99 → $19.99). One gap we caught and fixed: anyone arriving through an auto founders *link* wasn't getting the discount attached (only people who typed `FOUNDERS` at checkout did). The code has only been used twice so far, so impact is tiny — we're double-checking those two to be sure no founder paid full price.

**3. The Stripe billing issue (Gerardo + others).** Found the real root cause: the app was pointed at prices from an old Stripe setup instead of the live account, and the Basic plan + founders discount weren't wired to the live prices. That's why some people showed "Basic" in the app but got charged the $29.99 Pro rate. Fixed at the source — the plan now always follows the real price.

Customers who were actually overcharged (Basic is $19.99, so $10/mo difference) and what we're refunding:
- Gerardo — 3 months, $10 already back, **$20 remaining**
- Brayan Carranza — 3 months, **$30**
- Katelynn Delaney — 1 month, **$10**

We'll move each onto the correct $19.99 Basic plan (so it stops recurring, not just a one-time credit), refund the difference, and email each of them to explain. I'm also reviewing a few older accounts left over from the previous Stripe setup to make sure none slipped through.

One correction on our end: the earlier email to Brayan asked him to prove a double-charge — he was genuinely overcharged, so we'll just refund him and apologize rather than make him send screenshots.

Target: refunds + emails done by [DATE]. I'll send you a final confirmation once every customer is squared away.

Thanks,
Dev

---

## Internal checklist (not for Marco)

- [x] Root cause confirmed: env price IDs pointed at account `…EEyJcQEdsw`; live billing account is `…CYy1nVZfhM`.
- [x] Correct live price IDs identified and set in `.env.local` (Pro $29.99 `price_1T0r9q…`, Pro yr `…1T0rBC…`, Basic $19.99 `price_1T0rBu…`, Basic yr `…1T0rCt…`).
- [x] Founders coupon identified: `zJr4WWoa` ($10 off forever); set `STRIPE_FOUNDERS_COUPON_ID` locally.
- [x] Code fix committed (`28de891`): tier follows billed price + config guard.
- [ ] **Mirror the corrected env vars in Vercel/production** and deploy (local `.env.local` is fixed; prod is the one that matters).
- [ ] Move the 3 overcharged subs to `price_1T0rBu…` (Basic $19.99); refund $20 / $30 / $10.
- [ ] Verify the 3 "other account" customers (`martinvar95@gmail.com` + 2) and the 2 FOUNDERS redemptions.
- [ ] Reconcile stale `subscription_tier` values; re-run `reconcile-subscription-tiers.mjs` → target `0 mismatch(es)`.
- [ ] Email each affected customer.
