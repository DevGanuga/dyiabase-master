# Release Note — Post-Meeting Feature Drop

**For:** Kenneth (PM)
**Attach:** `dyia-new-features-walkthrough.pdf`

---

Hey Ken,

Here's the rundown on the release from Marco's meeting action items — all five are shipped and verified. The attached PDF is a screenshot-by-screenshot walkthrough you can forward to Marco as-is.

## What shipped

- **Cancellation feedback (retention).** When a Pro user cancels, an optional prompt captures reason + what they liked/didn't + notes. It's non-blocking — they can skip and still downgrade. Stripe stays the billing source of truth; we just snapshot who/when/why on top.
- **Admin cancellations + retargeting.** New **Cancellations** tab in the admin panel: every cancellation with user details, plan, real usage (jobs/quotes), full feedback, a retargeting status (new → contacted → won back / not fit / do not contact), and notes for win-back promos.
- **Clean launch metrics.** Accounts can be tagged test/demo/internal and are excluded from admin metrics by default (users, subs, signups, jobs, quotes, customers, AI usage, engagement). Added Real / Test-Demo filters. Nothing is deleted — Hannah's and all real accounts stay.
- **Lawn care & house cleaning readiness.** Onboarding seeds trade-appropriate starter pricing, the quote builder is trade-agnostic (junk-only load calculator is now scoped to junk removal), and job expense labels adapt per trade.
- **Invoices/receipts + demo access (Marco's follow-up).** Invoices and pay links already exist in Payments; completed jobs now also get a downloadable receipt PDF. Added a password-gated marketing demo launcher on the sign-in page so promos use sample data only.

## Ops / deploy checklist

- Apply migration **`046_cancellation_feedback_and_test_accounts.sql`** (adds `dyia_cancellation_feedback` table + `is_test_account` / `account_label` / `account_notes` on `dyia_users`).
- Confirm **`DEMO_PASSWORD`** is set in the environment so the marketing demo launcher works.
- After deploy, tag the existing QA/test accounts so launch stats read clean.

## Verified

- `npm run lint`, `npm test` (53 passing), and `npm run build` all green. Remaining warnings are pre-existing (Next `<img>` / Tailwind class style) and unrelated.

## Notes / next phase

- In the PDF, the cancellation modal and admin cancellations tab are shown as faithful UI previews — they require a billed Pro / admin session, which demo mode intentionally hides. I can capture them live from a real session if we want true screenshots before sending to Marco.
- Deeper per-industry AI pricing for lawn care / cleaning is the natural next phase, building on the now trade-agnostic quote flow.

Want me to capture the two live screenshots and finalize, or is the preview version good to send?

Thanks,
Kenneth
