# QA Reference — Subscription State Matrix (Round 4 fixes)

**For:** Hanna (QA)
**Re:** BUG-022, payment-failed access, missing email
**Round 4 fix landed:** all subscription state now flows through a single source of truth (`computeSubscriptionState` in `src/lib/subscription.ts`).

---

## Why this round was different from Round 2

Round 2 patched individual symptoms in three different files. The bugs you found in Round 4 (Pro user sees "Unlock AI insights", Basic plan shows FREE badge, +101 has Pro features but Basic badge) all turned out to be the **same underlying problem**: three different components were each computing "is this user Pro?" from slightly different fields and could disagree.

Round 4 collapses all of them onto one function. Now if `isPro` is `true` anywhere, it is `true` everywhere, and vice versa.

---

## What changed

| Area | Round 2 behavior | Round 4 behavior |
|---|---|---|
| `isPro` computation | 3 places: `app/page.tsx` (status only), `useSubscription` (status + cancel grace), `Settings.tsx` (status only) | 1 place: `computeSubscriptionState()` consumed by all |
| Failed payment | Status flipped to `past_due` → Pro features locked instantly OR retained depending on which gate read it | 7-day dunning grace window: keep Pro for 7 days, then lock |
| Failed payment email | None | Sent on first failure via Resend |
| Pro user sees "Unlock AI insights" | Possible if `subscription_status` was anything other than `active` or `trialing` | Cannot happen — `DyiaInsight` reads from the same `isPro` as `<ProFeature>` |
| **Active Basic user gets Pro features unlocked** | **Yes — `isPro=true` for any active subscription regardless of tier (this is the +101 bug)** | **No — `isPro` now requires `subscription_tier='pro'` (or trial). Basic = AI/marketing/email blasts locked.** |
| Basic paid user shows "Pro" tier in sidebar | Possible — sidebar derived tier from `isPro` only | Sidebar reads `subState.tier` which respects `subscription_tier='basic'` |
| Legacy Pro users with `subscription_tier='basic'` | Stuck — webhook never updated tier on subscription updates, only on checkout | Self-heal — `handleSubscriptionUpdate` now writes tier from price ID on every subscription event |
| Admin tier swap (Pro ↔ Basic) | Not possible — admin panel only had Grant Pro / Revoke / Trial | New endpoint `POST /api/admin/switch-plan` + buttons on user detail page |
| Brand-new user sees app | Same — redirected to pricing first | **Unchanged** (this is a product decision, see §4 below) |

---

## 1. Plan badge & banner — final expected behavior

| Scenario | Settings badge | Sidebar tier | TrialBanner | DyiaInsight on Quotes |
|---|---|---|---|---|
| **Brand-new user (no Stripe history)** | FREE | basic | "Try Pro free for 14 days" | Locked → upsell |
| **Active Trial (Pro tier)** | PRO + Free Trial chip | trial | "Pro active — N days left in your free trial" | Unlocked |
| **Active Trial (Basic tier)** | PRO + Free Trial (Basic plan) | trial | "Pro active — N days left" | Unlocked (during trial) |
| **Active Pro (paid)** | PRO + Annual/Monthly chip | pro | None | Unlocked |
| **Active Basic (paid)** | BASIC + Annual/Monthly chip | basic | None (no upsell — they paid) | Locked → upsell |
| **Past_due Pro, day 1–7 (dunning)** | PRO + dunning copy | pro | Red banner: "Payment failed — N days remaining. Update Payment" (cannot dismiss) | Unlocked |
| **Past_due Pro, day 8+ (grace expired)** | PRO badge + "subscription is currently inactive" copy | basic | Red banner: "Update Payment" | Locked → upsell |
| **Past_due Basic, day 1–7** | BASIC + dunning copy | basic | Red banner | Locked (Basic never had Pro features) |
| **Canceled with time remaining** | PRO + countdown | trial | Amber: "Plan canceled — N days of Pro access remaining" | Unlocked |
| **Canceled, expired** | PRO badge + "currently inactive" copy | basic | Red: "Free trial has ended" | Locked |
| **Admin user** | PRO + admin copy | pro | None | Unlocked |
| **Demo mode** | PRO | pro | None | Unlocked |

---

## 2. Failed payment — full lifecycle

The dunning behavior is documented as a **7-day grace window** during which Stripe retries the card. After the window, Pro features lock automatically — no manual revocation needed.

**Day 0 — Stripe `invoice.payment_failed` arrives**
- Webhook stamps `dyia_users.payment_failed_at = NOW()` (only if currently null — Smart Retries don't reset the clock)
- Webhook flips `subscription_status = 'past_due'`
- Webhook sends `paymentFailedEmail` via Resend (one email — Stripe handles its own retry cadence after that)
- User keeps Pro access. Settings + TopBar show dunning banner with countdown.

**Day 1–7 — grace window**
- Pro features remain unlocked (`isPro = true` because `isInDunning = true`)
- Banner persists, cannot be dismissed
- If Stripe successfully retries (`invoice.paid` event), webhook clears `payment_failed_at` and the banner disappears immediately
- If user updates card via Stripe portal and pays manually, same recovery path

**Day 8+ — grace expired**
- `isPro = false` automatically (no webhook needed — it's a time check)
- Pro features lock (`<ProFeature>` shows upsell, AI insights show "Unlock AI insights")
- Banner stays red and reads "Update Payment"
- User remains in the app on Basic-equivalent access until they fix billing

**Recovery (any day)**
- Stripe `invoice.paid` → webhook calls `handleSubscriptionUpdate` → status returns to `active`, `payment_failed_at = null`
- All UI returns to normal Pro state on next page load (or immediately for the live-hook-driven banner)

---

## 3. QA verification steps for each affected user

### +100 — failed-payment user
1. Confirm `dyia_users.payment_failed_at` is now populated for this user (run a follow-up event from Stripe Dashboard if needed to trigger the new webhook code path).
2. Within 7 days of `payment_failed_at`: she should see the **red dunning banner**, keep Pro access, and have received the `paymentFailedEmail`.
3. After day 7: Pro features should lock automatically. Reload Quotes — "Unlock AI insights" should appear.
4. Trigger an `invoice.paid` event via Stripe Dashboard — banner should clear, `payment_failed_at` should null out, Pro features unlock.

### +101 — Basic plan, ambiguous Pro features
1. Confirm DB row: `subscription_status` and `subscription_tier` columns. Settings badge will now match `subscription_tier` exactly.
2. If `subscription_tier='basic'` and `subscription_status='active'`: badge = BASIC, AI insights LOCKED, Email Blast LOCKED, Marketing LOCKED. **Identical** behavior across all gates.
3. If you previously saw Pro features unlocked, that was a 3-source-of-truth drift bug. Should no longer be possible.

### +102 — Active Pro user
1. `subscription_tier='pro'`, `subscription_status='active'`: every Pro gate unlocked. AI insights on Quotes shows real insight content (or loading), never the "Unlock AI insights" upsell.
2. Sidebar shows PRO badge. No "Upgrade to Pro" button. No trial banner.

### +104 — Active Basic
1. `subscription_tier='basic'`, `subscription_status='active'`: badge reads BASIC. "Upgrade to Pro" CTA visible in Settings. **No "Try Pro free" banner** (paid users never see it).
2. AI insights, Email Blast, Marketing locked with upsell.

### Brand-new user
1. **Currently still redirected to `/#pricing` before app access.** This is unchanged — it's a product flow, not a bug. See §4.
2. Once they pick a plan and complete checkout, they fall into one of the trial states above.

---

## 4. The brand-new-user case — product decision needed

You correctly noted: *"Currently, there is no option for a user to proceed to the Dyia app / Dashboard page without purchasing a subscription."*

This is enforced by `src/app/app/page.tsx` (line ~588). It's intentional product behavior, not a bug. To test the QA spec ("brand-new user sees FREE badge + trial banner inside the app"), one of the following needs to be decided by the founder:

- **(A)** Keep current flow → the FREE badge state inside the app is unreachable from sign-up. Remove that test case from the QA spec.
- **(B)** Allow new users to land in the app on a Free/Basic state without picking a plan first. This is a meaningful product change (different conversion funnel) and requires a separate scope.

Until that's decided, no further code change addresses this case.

---

## 5. Customer support flows — what's possible today

This section is for Marco. When a customer emails support asking to change card / switch plan / cancel, this is what we can do without engineering.

### "I want to change the card I'm being billed to"
**Customer self-serves.** No admin action required.
- Tell them: *Settings → Account → Subscription → "Manage Billing"*. That opens the Stripe Customer Portal where they update payment method, view invoices, and cancel.
- If they can't access the portal (rare auth issue), admin can also update the card by opening the customer in the Stripe Dashboard directly. We don't expose card editing in our admin UI on purpose — PCI scope.

### "I want to switch from Pro to Basic" (or vice versa, or change billing interval)
**Now possible from admin panel** as of Round 4 fix.
- Admin → Users → [user] → "Switch Plan" section → click target tier+interval.
- Hits Stripe directly (`POST /api/admin/switch-plan`), swaps the price on the live subscription with prorated credit/charge.
- The `customer.subscription.updated` webhook fires immediately and syncs tier + status + plan in our DB. Customer sees the new badge on next page load.
- Disabled (greyed-out) on whichever button matches their current state, so an admin can't accidentally no-op.

### "I want to cancel"
- Admin → Users → [user] → use existing `/api/admin/cancel-subscription` (immediate or end-of-period). No change Round 4.

### "I had a failed payment, why can I still use Pro?"
- That's the dunning grace window — see §2. Direct them to update card via Manage Billing; recovery is automatic.

### "I had a failed payment but got locked out"
- Their `payment_failed_at` is older than 7 days. Same fix: update card via Manage Billing → `invoice.paid` webhook → instant unlock. If they need an extension while they sort out their bank, an admin can null out `payment_failed_at` directly via the user PATCH endpoint or just toggle their status to `active` until they pay.

---

## 6. Files touched (for review)

| File | Purpose |
|---|---|
| `src/lib/subscription.ts` (new) | `computeSubscriptionState()` — single source of truth. **Round 4.1: `isPro` now requires Pro tier or trial; Active Basic correctly returns `isPro=false`.** |
| `supabase/migrations/037_payment_failed_grace.sql` (new) | `payment_failed_at` column |
| `src/hooks/useSubscription.ts` | Refactored to delegate to the pure function |
| `src/app/app/page.tsx` | Replaced inline `isPro` computation; demo data now sets `subscription_tier='pro'` |
| `src/components/app/Settings.tsx` | Badge logic now reads `productTier` from unified state |
| `src/components/app/TrialBanner.tsx` | Adds dunning banner mode + dismissal block |
| `src/lib/resend/templates.ts` | New `paymentFailedEmail` |
| `src/app/api/stripe/webhook/route.ts` | Stamps `payment_failed_at` on first failure, sends email, clears on recovery. **Round 4.1: also self-heals `subscription_tier` from price ID on every subscription update.** |
| `src/app/api/admin/switch-plan/route.ts` (new) | **Round 4.1**: Admin endpoint to swap Stripe subscription tier/interval (Pro↔Basic, monthly↔annual) with proration. |
| `src/app/app/admin/users/[id]/page.tsx` | **Round 4.1**: Adds "Switch Plan" button grid + tier display. |
| `src/app/api/ai/chat/route.ts` | AI gate via `userHasProAccess` |
| `src/app/api/ai/chat/confirm/route.ts` | Same |
| `src/app/api/ai/insights/route.ts` | Same |
| `src/app/api/ai/suggest-quote-price/route.ts` | Same |
| `src/types/database.ts` | `payment_failed_at` field added to `UserProfile` |

---

## 7. What deploy needs

1. Run migration: `037_payment_failed_grace.sql`
2. Deploy code
3. **Spot-check legacy Pro users** — anyone created before migration 032 added `subscription_tier` may have `subscription_tier='basic'` even though they pay for Pro. Round 4.1's webhook fix self-heals on the next subscription event (renewal, plan change, payment), but until that fires they'll see Basic gating. Two options:
   - **Wait for natural events** — most users renew monthly, so the column heals within a billing cycle.
   - **One-shot reconcile** — for any user with `subscription_status='active'` and a `stripe_subscription_id`, you can write a small script that fetches their Stripe subscription, reads the price ID, and writes `subscription_tier` to match. Or just resend a no-op `customer.subscription.updated` event from the Stripe Dashboard for each affected user — webhook will heal them. There are likely fewer than 50 such users, manageable by hand.
4. (Optional) For users currently stuck in a bad state (+100, +101, +102), spot-check their DB row after deploy and reconcile manually if their `subscription_status` and `subscription_tier` don't match Stripe truth — the unified gate now respects those columns precisely.

No env-var changes required. No Stripe Dashboard changes required (the new webhook code uses events Stripe already sends).

The `NEXT_PUBLIC_STRIPE_BASIC_*_PRICE_ID` env vars must be set for the new admin Switch-Plan endpoint to work — they already exist for checkout, so this is just confirming.
