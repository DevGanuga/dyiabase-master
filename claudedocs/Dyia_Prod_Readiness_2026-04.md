# Dyia — Prod-Readiness Check

_Date: April 29, 2026 · Branch: `fix/qa-retest-2026-04-round2` (post Round 2 fixes)_

## Build verdict: GO with 2 ops actions

`npm run build` ✓ clean · `tsc --noEmit` ✓ clean · 78/78 static pages generated · zero new lint errors introduced.

Two **mandatory** ops actions before deploy (env vars + migration), plus four recommended hardening items. Details below.

---

## What was actually run

| Check | Command | Result |
| --- | --- | --- |
| Production build | `rm -rf .next && npm run build` | ✓ Compiled in 6.4s · 78 pages · all routes registered including new `/api/payments/public/[token]/verify` |
| TypeScript strict check | `npx tsc --noEmit` | ✓ Zero errors |
| Lint | `npm run lint` | 2 errors (both pre-existing, unrelated to Round 2 fixes) + 66 Tailwind v4 stylistic warnings (also pre-existing) |
| Tests | _none configured_ | No test framework in `package.json`. See "Recommended hardening". |
| Mode | `STRIPE_SECRET_KEY` | TEST mode in `.env.local` — production must rotate to `sk_live_…` |

### Lint errors that pre-exist (not introduced by Round 2)

- `src/app/pricing-calculator/page.tsx:325` — setState in effect
- `src/components/PublicHeader.tsx:18` — setState in effect

Both are `react-hooks/set-state-in-effect` warnings flagged at error severity by the `eslint-config-next` preset. The build passes because these are eslint-only and Next does not gate the build on them by default. They predate this branch and behaviour is unchanged.

---

## MUST DO before prod deploy

### 1. Apply the new migration `036_payment_refund_columns.sql`

The Round 2 webhook handler for `charge.refunded` writes `status='partial_refund'` and `refunded_amount_cents` to `dyia_payments`. Migration 028 only allowed status values `('pending', 'checkout_created', 'paid', 'failed', 'expired', 'refunded')` and did not include `refunded_amount_cents`. **Without this migration, partial refunds will be silently rejected by the CHECK constraint.** Full refunds still work (they use the existing `'refunded'` status), but partial refunds need both columns.

```bash
# Supabase CLI
supabase db push                                                    # picks up 036_payment_refund_columns.sql
# Or via dashboard SQL editor: paste the contents of
# supabase/migrations/036_payment_refund_columns.sql and run.
```

The migration is idempotent and uses `IF NOT EXISTS`, so it is safe to re-run.

### 2. Set the missing required-for-Round-2 env vars in production

`src/lib/env.ts` lists these as "optional" but several are functionally required in prod:

| Env var | Required for | Symptom if missing |
| --- | --- | --- |
| `NEXT_PUBLIC_STRIPE_BASIC_MONTHLY_PRICE_ID` | Webhook `determineTierFromPriceId()` correctly tagging Basic checkouts | All paying subscribers labeled "Pro" — undoes BUG-022 fix |
| `NEXT_PUBLIC_STRIPE_BASIC_ANNUAL_PRICE_ID` | Same as above for annual plan | Same |
| `CRON_SECRET` | Auth on `/api/cron/*` routes (trial reminders, weekly insights, follow-ups, intel monthly) | Cron endpoints reject auth; reminders never fire |
| `NEXT_PUBLIC_SENTRY_DSN` | Activates `withSentryConfig` in `next.config.ts` and ships error events | No client/server error visibility in prod |
| `STRIPE_CONNECT_COUNTRY` | Stripe Connect onboarding default | Defaults to `'US'`. Set explicitly only if launching outside US. |

The base required set (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) must also be present on the prod target. They _are_ present in `.env.local`, but they need to be re-set on the deploy environment with **live** Stripe + Clerk keys.

### 3. Stripe webhook events — confirm all are subscribed in the live dashboard

The platform webhook endpoint must be subscribed to:

| Event | Why |
| --- | --- |
| `checkout.session.completed` | Subscriptions + customer payments (existing) |
| `payment_intent.succeeded` | **NEW (BUG-031)** — backup path for customer payment reconciliation when checkout.session metadata is misrouted |
| `charge.refunded` | **NEW (BUG-031)** — refund reflection (STR-010) |
| `customer.subscription.updated` | Trial→active transitions, plan changes (existing) |
| `customer.subscription.deleted` | Cancellation (existing) |
| `invoice.paid` | Trial-to-paid + recurring (existing) |
| `invoice.payment_failed` | Dunning (existing) |

Without `payment_intent.succeeded` and `charge.refunded` subscribed in Stripe, two of the four Round 2 reconciliation paths for BUG-031 are inert.

---

## SHOULD DO before prod (recommended hardening)

1. **Apply migration `034_trial_consumed_at.sql`** if not already applied — it is the prerequisite that lets the new webhook code (BUG-022 part 2) stamp `trial_consumed_at`. Without it, the webhook UPDATE will throw on the unknown column.
2. **Migration numbering collision**: `032_intel_research_report.sql` and `032_subscription_tier.sql` share the same prefix. Pre-existing, but consider rolling forward to a new sequence to avoid order-of-application surprises in fresh environments.
3. **Rename `src/middleware.ts` → `src/proxy.ts`**. Next.js 16.1.4 prints `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` on every build. Functionality is unchanged today; the convention is being removed in a future major.
4. **Wire a smoke-test job (Playwright/E2E) for the critical paths**: AI confirm-and-update flow (BUG-011), Stripe payment reconciliation (BUG-031), payment link copy (UX gap). The repo has `puppeteer` installed but no scripts; one CI job covering happy-path sign-in → log job → request payment → verify webhook would catch all three Round 2 regressions with one run.

---

## Production smoke-test checklist (manual)

After deploy, do these in order in the live environment:

1. **Sign in with a real Clerk user.** Confirm dashboard loads without errors in the browser console.
2. **Create a job, then ask Dyia "update that job, change revenue to 500".** Should succeed without a `get_user_context` round-trip (BUG-011).
3. **Settings → Subscription card.** With a paid Basic user, confirm badge says **BASIC**, not FREE (BUG-022 part 1).
4. **Mobile viewport.** TopBar logo readable in dark mode (BUG-020); trial banner shows full text on narrow widths (BUG-018); long Jobs list — open Log Daily Expenses on the last row, modal centers in viewport (BUG-016); Source/Revenue dropdowns show full label (BUG-015).
5. **Request Payment from a quote.** PaymentLinkReadyModal opens with auto-selected URL. Click Copy → "Copied" feedback within 100ms.
6. **Run a real Stripe Checkout** in test mode in prod env (toggle key temporarily). After Stripe redirects back to `/pay/[token]?checkout=success&session_id=…`, the page should show "Confirming your payment…" briefly then flip to "This payment has been received." even if the webhook hasn't fired yet — this proves BUG-031 part 4 (verify route).
7. **In Stripe dashboard, refund the test charge.** Within ~30s the linked quote/job in Dyia should flip back to `pending` (BUG-031 part 2).
8. **Check `dyia_admin_webhook_logs`** for the new event types. Expect to see successful `payment_intent.succeeded` and `charge.refunded` rows.

If any step fails, roll back the deploy and consult the Round 2 retest report (`Dyia_QA_Retest_Response_2026-04_round2.pdf`) for the root-cause locations.

---

## Items NOT changed (intentional)

- **No upgrade of `next` from 16.1.4**, no upgrade of any dep. Round 2 was scoped to bug fixes; lockfile unchanged.
- **No commit / push.** Per repo policy in `CLAUDE.md`, this batch produces working-tree edits only — push and commit are separate explicit user actions.
- **No reformat of pre-existing Tailwind v4 warnings.** Touching the 313 stylistic warnings would inflate the diff and obscure the Round 2 functional changes.

---

## Files added in this prod-readiness pass

- `supabase/migrations/036_payment_refund_columns.sql` — required for the Round 2 refund handler
- `src/types/database.ts` — widened `PaymentRecordStatus` union to include `'partial_refund'`
- `src/components/app/Payments.tsx` — added `partial_refund` style entry to `STATUS_STYLES` so the badge renders correctly

All three are zero-impact for users with no partial refunds; they unblock the partial-refund branch of `charge.refunded` whenever the Stripe dashboard does a partial refund.
