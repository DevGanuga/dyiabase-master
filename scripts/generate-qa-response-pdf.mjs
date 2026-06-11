/**
 * Generate the QA Round 5 developer response PDF.
 *   node scripts/generate-qa-response-pdf.mjs
 * Output: claudedocs/qa-round5-response/Dyia_QA_Round5_Dev_Response.pdf
 */

import puppeteer from 'puppeteer'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'claudedocs', 'qa-round5-response')
const OUT_FILE = join(OUT_DIR, 'Dyia_QA_Round5_Dev_Response.pdf')

const css = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #1e293b; font-size: 11px; line-height: 1.55; margin: 0; }
  h1 { font-size: 21px; margin: 0 0 2px; color: #0f172a; }
  h2 { font-size: 14px; margin: 22px 0 8px; color: #c2410c; border-bottom: 2px solid #fed7aa; padding-bottom: 4px; }
  h3 { font-size: 12px; margin: 14px 0 5px; color: #0f172a; }
  p { margin: 5px 0; }
  .sub { color: #64748b; font-size: 10.5px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 10px; }
  th { background: #fff7ed; color: #9a3412; text-align: left; padding: 6px 7px; border: 1px solid #fdba74; }
  td { padding: 6px 7px; border: 1px solid #e2e8f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  code { background: #f1f5f9; border-radius: 3px; padding: 0 3px; font-size: 9.5px; font-family: Menlo, monospace; }
  .pill { display: inline-block; border-radius: 9px; padding: 1px 8px; font-size: 9px; font-weight: 700; }
  .fixed { background: #dcfce7; color: #166534; }
  .action { background: #fef9c3; color: #854d0e; }
  .decision { background: #fee2e2; color: #991b1b; }
  .box { border: 1px solid #e2e8f0; border-left: 4px solid #f97316; background: #fffbf7; padding: 8px 12px; margin: 8px 0; border-radius: 4px; }
  ul, ol { margin: 5px 0; padding-left: 18px; }
  li { margin: 3px 0; }
  .footer { margin-top: 26px; padding-top: 8px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 9px; }
`

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>

<h1>Dyia QA Round 5 — Developer Response &amp; Fix Report</h1>
<p class="sub">Issued June 11, 2026 &nbsp;·&nbsp; Responds to: "DYIA QA – Test Round 5, v2" (May 18, updated Jun 10, 2026)</p>

<h2>1. Executive Summary</h2>
<p>All BUG-022 findings in Round 5 trace back to <b>one systemic root cause</b>: QA/branch test environments ran with <b>test-mode Stripe keys while writing to the production database</b>. This poisoned user rows with test-mode customer/subscription IDs that the live key cannot resolve, producing the "No such customer … exists in test mode" errors, the "You already have a subscription" dead-ends, and several of the inconsistent tier displays.</p>
<p>We shipped: <b>(a)</b> self-healing billing routes, <b>(b)</b> a live/test <b>mode guard</b> that prevents this class of corruption permanently, <b>(c)</b> a fix for a state-machine hole that granted indefinite Pro access to expired trials, <b>(d)</b> aligned tier displays, and <b>(e)</b> a full reset of all 18 QA accounts so the subscription lifecycle can be re-tested cleanly. One item remains a <b>product decision</b> (Section 6).</p>

<h2>2. Root Causes</h2>
<table>
  <tr><th style="width:24%">Root cause</th><th>Mechanism</th><th style="width:30%">Permanent fix shipped</th></tr>
  <tr><td><b>RC-1: Test/live mode mixing</b></td><td>Test-mode checkouts (QA branch envs) stored <code>cus_…</code>/<code>sub_…</code> ids from Stripe test mode in the shared DB; live-mode prod cannot read them. Test-mode <b>webhook events</b> could also rewrite rows matched by <code>stripe_customer_id</code>.</td><td>New <code>stripe_livemode</code> column stamps which mode created stored ids; all billing routes ignore wrong-mode ids; webhook drops events whose <code>livemode</code> doesn't match the server key. (Migration 044)</td></tr>
  <tr><td><b>RC-2: DB-only subscription checks</b></td><td>Checkout blocked on the DB <code>subscription_status</code> field alone; portal used the stored customer id blindly. Stale/poisoned rows dead-ended users with no path to pay.</td><td>Stripe is now the source of truth: routes verify against live Stripe and self-heal stale pointers (clear + recreate / email re-link).</td></tr>
  <tr><td><b>RC-3: Fail-open trial state</b></td><td>An expired trial <i>with</i> a subscription id on file stayed "trialing" forever if the trial-end webhook never landed → indefinite free Pro (account +102).</td><td><code>computeSubscriptionState</code> now fails closed 24h after trial end when no status transition arrived.</td></tr>
</table>

<h2>3. Finding-by-Finding Response</h2>
<table>
  <tr><th style="width:13%">Account / Finding</th><th style="width:30%">Reported symptom (Jun 10)</th><th style="width:34%">Diagnosis</th><th>Status</th></tr>
  <tr><td>+101, +106, +107</td><td>"No such customer: 'cus_…'; a similar object exists in test mode, but a live mode key was used"</td><td>RC-1: row carried a test-mode customer id. Portal call with live key is guaranteed to fail.</td><td><span class="pill fixed">FIXED</span> self-heal + mode guard; accounts reset</td></tr>
  <tr><td>+103, +104</td><td>"You already have a subscription. Please manage your existing billing…" when trying to upgrade</td><td>RC-2: DB said active/past_due but no live-mode subscription existed; route blocked without consulting Stripe.</td><td><span class="pill fixed">FIXED</span> Stripe-verified check; accounts reset</td></tr>
  <tr><td>+102</td><td>Trial ended Apr 24; no payment ever made; still has Pro features on Jun 10</td><td>RC-3: fail-open trial state when the trial-end webhook never arrived.</td><td><span class="pill fixed">FIXED</span> fails closed after 24h grace; unit-tested</td></tr>
  <tr><td>+103, +105, +107</td><td>"Pro" in Account → Subscription but "Basic" in header dropdown</td><td>Settings showed the <i>registered plan</i> (PRO) while the header showed <i>effective access</i> (Basic). Internally consistent but reads as a contradiction.</td><td><span class="pill fixed">FIXED</span> Settings now shows an explicit INACTIVE chip beside the plan badge</td></tr>
  <tr><td>+100, +105</td><td>"Automatically updated to Basic with no payment" after failed payment</td><td>Working as designed: failed payment → 7-day dunning grace → Stripe auto-cancels → account downgrades to the free Basic experience. Not a defect; see Section 6 for the open product question.</td><td><span class="pill decision">BY DESIGN</span></td></tr>
  <tr><td>Main concern</td><td>"Why pay for Basic if it remains available after a failed payment?"</td><td>Valid product gap: the post-failure fallback experience and the paid Basic plan are currently the same feature set.</td><td><span class="pill decision">PRODUCT DECISION</span> (Section 6)</td></tr>
  <tr><td>BUG-011, dunning emails</td><td>Pass</td><td>—</td><td><span class="pill fixed">CLOSED</span></td></tr>
</table>

<h2>4. Changes Shipped (code)</h2>
<ul>
  <li><b>Mode guard</b> — <code>src/lib/stripe-mode.ts</code> (new), migration <code>044_stripe_livemode_guard.sql</code>: stores which Stripe mode created the ids on each user row; checkout/portal/verify-session ignore wrong-mode ids; the webhook drops events whose <code>event.livemode</code> mismatches the server key and logs them to the admin webhook log.</li>
  <li><b>Self-healing portal</b> — <code>api/stripe/portal</code>: verifies the customer exists in the current mode, re-links by email when possible, otherwise clears poisoned pointers and returns a clear, actionable message instead of a raw Stripe error.</li>
  <li><b>Stripe-verified checkout</b> — <code>api/stripe/checkout</code>: "already subscribed" is now decided by live Stripe state, not the DB field; stale subscription pointers are cleared automatically (<code>resource_missing</code> → status reset to inactive).</li>
  <li><b>Trial fail-closed</b> — <code>src/lib/subscription.ts</code>: expired trials lose access 24h after trial end when no Stripe transition arrived (webhook-lag buffer prevents blips for legitimate conversions).</li>
  <li><b>Display alignment</b> — <code>Settings.tsx</code>: INACTIVE chip whenever a registered plan isn't currently paid/trialing, so Account and header agree.</li>
  <li><b>Tests</b> — 21 new unit tests covering the full QA matrix (dunning in/after grace, expired trials with/without subscription, canceled-with-time, scheduled downgrade, admin, Basic-not-Pro, AI credits) plus the mode-guard logic. Suite: 53 passing.</li>
</ul>

<h2>5. QA Accounts Reset</h2>
<p>All <b>18</b> <code>maliarchuk.ann*</code> accounts were reset on Jun 11 to a clean never-subscribed state (Stripe pointers cleared, plan/status cleared, trial eligibility restored, dunning stamps removed). Rows are intact — jobs/quotes/data untouched. Re-runnable via <code>scripts/reset-qa-billing.mjs --apply</code>.</p>
<div class="box"><b>Heads-up for Round 6:</b> please run billing tests against an environment whose Stripe mode matches its database (see Ops actions below). Testing test-mode checkouts against the production DB will re-create the corruption this round found.</div>

<h2>6. Open Product Decision — post-failure Basic access</h2>
<p>Today, a user whose payment fails (after the 7-day grace) keeps the full free Basic experience indefinitely, which makes the <i>paid</i> Basic plan economically equivalent to not paying. Options:</p>
<ol>
  <li><b>Hard lock</b> after dunning grace: read-only access (view data, export) until payment resumes.</li>
  <li><b>Free tier split</b>: define a genuinely limited free tier (e.g., caps on jobs/quotes per month); paid Basic lifts the caps.</li>
  <li><b>Status quo</b>, treated as a deliberate retention/win-back funnel.</li>
</ol>
<p>Engineering is ready to implement any of the three; awaiting product direction.</p>

<h2>7. Ops Actions Required</h2>
<table>
  <tr><th style="width:8%">#</th><th>Action</th><th style="width:18%">Owner</th><th style="width:14%">Status</th></tr>
  <tr><td>1</td><td>Run <code>claudedocs/qa-round5-response/APPLY_qa_round5_migration.sql</code> in the Supabase SQL editor (adds <code>stripe_livemode</code>; idempotent). Code is backward-compatible either way; the guard fully engages once applied.</td><td>Founder</td><td><span class="pill action">TO DO</span></td></tr>
  <tr><td>2</td><td>Deploy the fixes to production (merge + redeploy).</td><td>Founder</td><td><span class="pill action">TO DO</span></td></tr>
  <tr><td>3</td><td>Give QA/branch environments their own database (separate Supabase project) OR ensure any environment pointing at the prod DB uses the <b>live</b> Stripe key. The new mode guard contains the damage either way, but isolation is the real fix.</td><td>Founder</td><td><span class="pill action">RECOMMENDED</span></td></tr>
  <tr><td>4</td><td>In the Stripe dashboard, confirm only ONE webhook endpoint per mode points at production (<code>/api/stripe/webhook</code>), with the matching <code>whsec_…</code> in Vercel Production env.</td><td>Founder</td><td><span class="pill action">VERIFY</span></td></tr>
</table>

<h2>8. Round 6 Re-test Checklist</h2>
<ol>
  <li><b>Fresh subscribe (Basic + Pro, monthly + annual)</b>: each reset account → Settings → Account → Upgrade. Expect Stripe checkout with 14-day trial; tier badge + header agree after return.</li>
  <li><b>Portal</b>: "Manage Billing &amp; Invoices" opens for every subscribed account — the test-mode customer error must not occur.</li>
  <li><b>Re-upgrade after failure/cancel</b>: cancel → wait for lapse (or failed card) → upgrade again. The "already have a subscription" dead-end must not occur unless Stripe really has a live subscription.</li>
  <li><b>Dunning</b>: fail a payment (Stripe test clocks or a declining card) → expect: failure email, banner countdown, Pro retained 7 days, locked after, INACTIVE chip in Settings.</li>
  <li><b>Trial expiry edge</b>: simulate webhook loss if possible — access must end ~24h after trial end regardless.</li>
  <li><b>Maps (new feature)</b>: Maps tab visible in sidebar (Work group); pins render; pin detail panel (Open in Jobs / Directions / Call); Today-Week-Custom filters (Week/Custom are Pro); address autocomplete on the Job form stores a pin.</li>
</ol>

<div class="footer">Dyia engineering — generated June 11, 2026. Companion files: <code>claudedocs/qa-round5-response/</code> (this PDF + migration), <code>scripts/reset-qa-billing.mjs</code>, <code>claudedocs/billing-help/</code> (user-facing upgrade/downgrade screenshots).</div>

</body></html>`

mkdirSync(OUT_DIR, { recursive: true })
const browser = await puppeteer.launch()
const page = await browser.newPage()
await page.setContent(html, { waitUntil: 'load' })
await page.pdf({
  path: OUT_FILE,
  format: 'A4',
  margin: { top: '14mm', right: '12mm', bottom: '14mm', left: '12mm' },
  printBackground: true,
})
await browser.close()
console.log(`PDF written: ${OUT_FILE}`)
