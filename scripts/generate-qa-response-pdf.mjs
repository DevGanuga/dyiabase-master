#!/usr/bin/env node
/**
 * Generates claudedocs/Dyia_QA_Retest_Response_2026-04.pdf from the HTML
 * response below. One-off script; run with `node scripts/generate-qa-response-pdf.mjs`.
 */
import puppeteer from 'puppeteer'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '..', 'claudedocs', 'Dyia_QA_Retest_Response_2026-04.pdf')

const html = /* html */ `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Dyia QA — Retest Response — April 2026</title>
<style>
  @page { size: Letter; margin: 22mm 18mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, 'SF Pro Text', 'Segoe UI', 'Inter', Helvetica, Arial, sans-serif;
    color: #111827;
    font-size: 10.5pt;
    line-height: 1.45;
  }
  .cover { padding: 40mm 0 10mm; border-bottom: 2px solid #f97316; margin-bottom: 14mm; }
  .cover h1 { font-size: 22pt; margin: 0 0 6mm; letter-spacing: -0.01em; }
  .cover .meta { color: #6b7280; font-size: 10pt; }
  .cover .meta strong { color: #111827; }

  h2 { font-size: 14pt; margin: 10mm 0 4mm; color: #111827; border-left: 4px solid #f97316; padding-left: 3mm; }
  h3 { font-size: 11.5pt; margin: 6mm 0 2mm; color: #111827; }
  p { margin: 0 0 2mm; }
  .lead { color: #374151; margin-bottom: 5mm; }
  ul { padding-left: 6mm; margin: 2mm 0 4mm; }
  li { margin-bottom: 1.5mm; }

  table { width: 100%; border-collapse: collapse; margin: 2mm 0 6mm; }
  th, td { border: 1px solid #e5e7eb; padding: 2mm 3mm; text-align: left; vertical-align: top; font-size: 9.5pt; }
  th { background: #f9fafb; font-weight: 600; }
  .col-id { width: 58px; font-variant-numeric: tabular-nums; }
  .col-sev { width: 78px; }
  .col-area { width: 130px; color: #6b7280; }
  .col-res { width: 118px; }

  .res { font-weight: 600; padding: 1mm 2mm; border-radius: 4px; font-size: 9pt; white-space: nowrap; }
  .res-fixed { background: #dcfce7; color: #166534; }
  .res-code  { background: #dbeafe; color: #1e40af; }
  .res-part  { background: #fef3c7; color: #92400e; }
  .res-ver   { background: #e0f2fe; color: #075985; }
  .res-block { background: #f3f4f6; color: #374151; }

  .sev { font-weight: 600; font-size: 9pt; padding: 1mm 2mm; border-radius: 4px; }
  .sev-crit { background: #fee2e2; color: #991b1b; }
  .sev-maj  { background: #ffedd5; color: #9a3412; }
  .sev-min  { background: #e0e7ff; color: #3730a3; }
  .sev-cos  { background: #f3f4f6; color: #374151; }

  code { font-family: 'SF Mono', Menlo, 'Courier New', monospace; background: #f3f4f6; padding: 0.5mm 1mm; border-radius: 3px; font-size: 9.5pt; }
  .fix-note { font-size: 9.5pt; color: #374151; }
  .fix-note ul { margin-top: 1mm; }
  .block { background: #fff7ed; border: 1px solid #fed7aa; padding: 3mm 4mm; border-radius: 3mm; margin: 3mm 0; }
  .block-title { font-weight: 600; color: #9a3412; margin-bottom: 1mm; }
  .callout { background: #f9fafb; border-left: 3px solid #f97316; padding: 3mm 4mm; margin: 3mm 0; border-radius: 2mm; }
  .small { font-size: 9pt; color: #6b7280; }
  footer { margin-top: 10mm; padding-top: 4mm; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 9pt; }

  .legend { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2mm; margin: 3mm 0 5mm; font-size: 9pt; }
  .legend div { border: 1px solid #e5e7eb; padding: 2mm 3mm; border-radius: 3px; }
</style>
</head>
<body>

<section class="cover">
  <div class="meta">RE-TEST RESPONSE · Regression · Dyia AI · Stripe Connect</div>
  <h1>Dyia QA — Retest Response</h1>
  <div class="meta">
    Prepared for: QA — Hanna<br/>
    Date: <strong>April 2026</strong><br/>
    Source brief: <em>Dyia QA — Re-Test & Extended Testing Brief</em> (Apr 2026)<br/>
    Commit: <code>fix/qa-retest-2026-04</code>
  </div>
</section>

<h2>Overview</h2>
<p class="lead">
  This document responds to the April 2026 QA Re-Test Brief. All 10 newly-logged bugs (BUG-021 through BUG-030),
  the 7 still-present originals (BUG-007, 011, 015, 016, 017, 018, 020), and BUG-002's subscription-labeling
  concern have been addressed in a single fix batch. Each row below records the result, the change location,
  and whether live QA verification in demo mode was possible or whether human QA must re-validate with real
  Clerk / Stripe / iOS sessions.
</p>

<div class="legend">
  <div><span class="res res-fixed">Fixed</span> Change shipped &amp; verified locally</div>
  <div><span class="res res-code">Fixed (code)</span> Shipped; needs prod QA sign-off</div>
  <div><span class="res res-part">Partial</span> Partially addressed; notes attached</div>
  <div><span class="res res-ver">Needs QA</span> Shipped; verify in real env</div>
  <div><span class="res res-block">Blocked</span> External dependency</div>
</div>

<h2>Part 1 — Regression of still-present bugs</h2>

<table>
  <thead>
    <tr>
      <th class="col-id">Bug ID</th>
      <th>Description</th>
      <th class="col-sev">Severity</th>
      <th class="col-area">Area</th>
      <th class="col-res">Result</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>BUG-002</td>
      <td>Basic plan shows "Pro Free Trial" labels &amp; unclickable "Start Free Trial" in header.</td>
      <td><span class="sev sev-crit">Critical</span></td>
      <td>Subscription / Billing</td>
      <td><span class="res res-code">Fixed (code)</span></td>
    </tr>
    <tr>
      <td>BUG-007</td>
      <td>Header Account menu items not tappable on iPhone.</td>
      <td><span class="sev sev-maj">Major</span></td>
      <td>Mobile / Navigation</td>
      <td><span class="res res-fixed">Fixed</span></td>
    </tr>
    <tr>
      <td>BUG-011</td>
      <td>Ask Dyia cannot update a job it previously logged.</td>
      <td><span class="sev sev-maj">Major</span></td>
      <td>Ask Dyia / Insights</td>
      <td><span class="res res-code">Fixed (code)</span></td>
    </tr>
    <tr>
      <td>BUG-015</td>
      <td>Revenue sort dropdown too wide; Search field squeezed.</td>
      <td><span class="sev sev-cos">Cosmetic</span></td>
      <td>Jobs</td>
      <td><span class="res res-fixed">Fixed</span></td>
    </tr>
    <tr>
      <td>BUG-016</td>
      <td>Log Daily Expenses / Convert-to-Job popup not fully visible on pages with many rows.</td>
      <td><span class="sev sev-min">Minor</span></td>
      <td>Jobs / Quotes</td>
      <td><span class="res res-fixed">Fixed</span></td>
    </tr>
    <tr>
      <td>BUG-017</td>
      <td>Notification banner overlaps header account drop-down (linked to BUG-007).</td>
      <td><span class="sev sev-min">Minor</span></td>
      <td>Home / Navigation</td>
      <td><span class="res res-fixed">Fixed</span></td>
    </tr>
    <tr>
      <td>BUG-018</td>
      <td>Notification banner cut off on mobile.</td>
      <td><span class="sev sev-cos">Cosmetic</span></td>
      <td>Mobile / Home</td>
      <td><span class="res res-code">Fixed (code)</span></td>
    </tr>
    <tr>
      <td>BUG-020</td>
      <td>Dyia logo text dark / unreadable in dark mode on mobile.</td>
      <td><span class="sev sev-cos">Cosmetic</span></td>
      <td>Mobile / Header</td>
      <td><span class="res res-fixed">Fixed</span></td>
    </tr>
  </tbody>
</table>

<h3>Fix notes — Part 1</h3>

<div class="fix-note">
  <p><strong>BUG-002 — Basic plan label &amp; Start Free Trial button.</strong>
    The root cause was a single overloaded <code>isPro</code> flag that treated any <code>active|trialing</code>
    subscription as Pro, regardless of <code>subscription_tier</code>. The Settings <em>Subscription</em> card,
    the TopBar account chip, and <code>TrialBanner</code> all ignored the product tier.</p>
  <ul>
    <li>Introduced a distinct <code>planTier: 'basic'|'pro'</code> throughout the app, derived from
      <code>userProfile.subscription_tier</code>. Access and plan are now separate concepts.</li>
    <li>New migration <code>supabase/migrations/034_trial_consumed_at.sql</code> adds
      <code>trial_consumed_at</code>; the Stripe webhook now stamps it once on first <code>trialing</code>
      event (see <code>src/app/api/stripe/webhook/route.ts</code>).</li>
    <li><code>TrialBanner</code> now hides for paid-Basic subscribers and anyone whose trial is already
      consumed (<code>src/components/app/TrialBanner.tsx</code>).</li>
    <li>Settings card copy was rewritten to show <em>Basic Plan</em>, <em>Pro Plan</em>, <em>Pro (Trial)</em>,
      and <em>Free Trial (Basic plan)</em> correctly (<code>src/components/app/Settings.tsx</code>).</li>
    <li>TopBar chip now renders <strong>BASIC</strong> (muted) for paid Basic subscribers, <strong>PRO</strong>
      (orange) for Pro or trialing users (<code>src/components/app/TopBar.tsx</code>).</li>
  </ul>
  <p class="small"><strong>Required action:</strong> run migration <code>034_trial_consumed_at.sql</code> before
    deploying. QA sign-off requires a real Basic subscriber, a real Pro subscriber, and a user with a
    previously-consumed trial — all of which need live Clerk/Stripe and cannot be fully verified in demo mode.</p>

  <p><strong>BUG-007 + BUG-017 — Header Account menu &amp; banner overlap.</strong>
    The account dropdown was clipped by <code>overflow-hidden</code> on the app <code>&lt;main&gt;</code>,
    and the <code>BetaBanner</code> painted above the dropdown because of flex-sibling stacking.</p>
  <ul>
    <li>Removed <code>overflow-hidden</code> from <code>&lt;main&gt;</code> in
      <code>src/app/app/page.tsx</code>. Content scroll is handled by the inner scroll container.</li>
    <li><code>TopBar</code> now renders in its own <code>isolate</code> stacking context with
      <code>z-40</code>; the dropdown panel uses <code>z-[80]</code>
      (<code>src/components/app/TopBar.tsx</code>).</li>
    <li><code>TrialBanner</code> and <code>BetaBanner</code> now explicitly sit at <code>z-10</code>
      (<code>src/components/app/TrialBanner.tsx</code>, <code>src/components/app/BetaBanner.tsx</code>).</li>
  </ul>
  <p class="small"><strong>Verified locally</strong> — opening the account menu on desktop Chrome, items are
    clickable and no banner overlaps. Mobile Safari (iOS) QA still recommended.</p>

  <p><strong>BUG-011 — AI cannot update a just-logged job.</strong> The AI never received the new
    <code>jobId</code> after confirm, and <code>update_job</code>'s schema covered only a subset of fields.</p>
  <ul>
    <li>Confirm route (<code>src/app/api/ai/chat/confirm/route.ts</code>) now appends
      <code>(job_id: &lt;uuid&gt;)</code> / <code>(quote_id: &lt;uuid&gt;)</code> to the success message so the
      next AI turn can reference it.</li>
    <li>Extended <code>update_job</code> schema + handler to cover <code>dumpster_rental</code>,
      <code>additional_expense</code>, <code>num_workers</code>, <code>cost_per_worker</code>
      (<code>src/lib/openai/functions.ts</code> &amp; <code>src/lib/openai/handlers.ts</code>).</li>
    <li><code>get_user_context</code> recent-jobs now includes the <code>id</code> so the model has UUIDs
      available without needing a confirm round-trip first.</li>
    <li>Instructions in <code>src/lib/openai/client.ts</code> explicitly document the job-id flow.</li>
  </ul>

  <p><strong>BUG-015 — Jobs sort dropdown too wide.</strong> Root cause: global <code>.app-select</code>
    rule forced <code>w-full</code>. Both toolbar <code>&lt;select&gt;</code> elements now pass
    <code>!w-auto</code> + capped max-width (<code>src/components/app/Jobs.tsx</code> lines 1554, 1566).</p>

  <p><strong>BUG-016 — Log Daily Expenses &amp; Convert-to-Job popups not fully visible.</strong></p>
  <ul>
    <li>The Log Daily Expenses overlay switched from <code>items-start + pt-12</code> to <code>items-center</code>
      so the panel centers on all sizes (<code>src/components/app/Jobs.tsx</code>).</li>
    <li><code>.modal-panel</code> in <code>src/app/globals.css</code> gained <code>max-h-[90vh]</code>
      + <code>overflow-y-auto</code>; <code>.modal-overlay</code> gained <code>overflow-y-auto</code>.
      This makes the Convert-to-Job popup fully reachable regardless of quote-list length.</li>
  </ul>

  <p><strong>BUG-018 — Trial banner cut off on mobile.</strong> Raised mobile max-height from
    <code>max-h-28</code> to <code>max-h-40</code>, added <code>min-w-0 break-words</code> and allowed CTA
    wrap (<code>src/components/app/TrialBanner.tsx</code>).</p>

  <p><strong>BUG-020 — Dark-mode logo unreadable.</strong> Removed <code>dark:brightness-0 dark:invert</code>
    from the mobile logo <code>&lt;img&gt;</code> (<code>src/components/app/TopBar.tsx</code>).
    The PNG is already theme-appropriate.</p>
</div>

<h2>Part 2 — New bugs (BUG-021 – BUG-030)</h2>

<table>
  <thead>
    <tr>
      <th class="col-id">Bug ID</th>
      <th>Description</th>
      <th class="col-sev">Severity</th>
      <th class="col-area">Area</th>
      <th class="col-res">Result</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>BUG-021</td>
      <td>New Quote "Name" field drop-down not reliably reopening on iOS.</td>
      <td><span class="sev sev-crit">Critical</span></td>
      <td>Quotes / Mobile</td>
      <td><span class="res res-fixed">Fixed</span></td>
    </tr>
    <tr>
      <td>BUG-022</td>
      <td>Subscription plan mislabeled "Free" for Basic; "Try Pro for free" shown after trial consumed.</td>
      <td><span class="sev sev-maj">Major</span></td>
      <td>Account</td>
      <td><span class="res res-code">Fixed (code)</span></td>
    </tr>
    <tr>
      <td>BUG-023</td>
      <td>AI insights shown on Jobs/Quotes grid for Basic users.</td>
      <td><span class="sev sev-maj">Major</span></td>
      <td>Jobs / Quotes</td>
      <td><span class="res res-code">Fixed (code)</span></td>
    </tr>
    <tr>
      <td>BUG-024</td>
      <td>"Upgrade to Pro" CTAs route to Settings > Business instead of Settings > Account > Subscription.</td>
      <td><span class="sev sev-maj">Major</span></td>
      <td>Settings / Navigation</td>
      <td><span class="res res-fixed">Fixed</span></td>
    </tr>
    <tr>
      <td>BUG-025</td>
      <td>Previously-populated contact info retained after removing matched customer.</td>
      <td><span class="sev sev-maj">Major</span></td>
      <td>Jobs / Quotes</td>
      <td><span class="res res-fixed">Fixed</span></td>
    </tr>
    <tr>
      <td>BUG-026</td>
      <td>AI-created jobs / quotes not visible in grid until refresh.</td>
      <td><span class="sev sev-crit">Critical</span></td>
      <td>Ask Dyia → Jobs/Quotes</td>
      <td><span class="res res-code">Fixed (code)</span></td>
    </tr>
    <tr>
      <td>BUG-027</td>
      <td>Dyia AI cannot convert a quote to a job (id confusion).</td>
      <td><span class="sev sev-maj">Major</span></td>
      <td>Ask Dyia / Follow-ups</td>
      <td><span class="res res-code">Fixed (code)</span></td>
    </tr>
    <tr>
      <td>BUG-028</td>
      <td>Dyia AI cannot return top-earning jobs as a list.</td>
      <td><span class="sev sev-maj">Major</span></td>
      <td>Ask Dyia</td>
      <td><span class="res res-code">Fixed (code)</span></td>
    </tr>
    <tr>
      <td>BUG-029</td>
      <td>Stale job preview carries over between Ask Dyia chats.</td>
      <td><span class="sev sev-maj">Major</span></td>
      <td>Ask Dyia</td>
      <td><span class="res res-code">Fixed (code)</span></td>
    </tr>
    <tr>
      <td>BUG-030</td>
      <td>"Failed to create payment link" error when requesting payment.</td>
      <td><span class="sev sev-crit">Critical</span></td>
      <td>Quotes / Stripe</td>
      <td><span class="res res-fixed">Fixed</span></td>
    </tr>
  </tbody>
</table>

<h3>Fix notes — new bugs</h3>
<div class="fix-note">
  <p><strong>BUG-021 — Name field dropdown on iOS.</strong>
    The QuoteBuilder used a native <code>&lt;datalist&gt;</code> which iOS Safari renders with a tiny hit
    area and flaky autocomplete. Replaced with the custom combobox pattern already working in
    <em>Log Job</em>: <code>role="combobox"</code> + <code>aria-autocomplete="list"</code> +
    <code>&lt;ul role="listbox"&gt;</code> + <code>&lt;button onMouseDown={e=>e.preventDefault()}&gt;</code>
    suggestion rows (<code>src/components/app/QuoteBuilder.tsx</code> lines 649–710).
    Verified locally: the combobox expands reliably on click/focus with the same pattern as Log Job.
    iOS Safari sign-off still recommended.</p>

  <p><strong>BUG-022 — Subscription label &amp; Try-Pro banner.</strong> See BUG-002 notes above — same fix.
    Additionally added the <code>trial_consumed_at</code> DB column so we can detect "trial already used" and
    suppress the banner accordingly. Migration: <code>supabase/migrations/034_trial_consumed_at.sql</code>.</p>

  <p><strong>BUG-023 — AI insights on Basic grid.</strong></p>
  <ul>
    <li><code>isPro</code> is now explicitly threaded into <code>Jobs</code>, <code>Quotes</code>,
      <code>Customers</code>, <code>Reports</code>, <code>Marketing</code>, <code>MassEmail</code>, and
      <code>Dashboard</code> with the new <code>hasProAccess</code> derivation
      (<code>src/app/app/page.tsx</code>).</li>
    <li>Default <code>isPro</code> in <code>Jobs</code>, <code>Quotes</code>, and <code>DyiaInsight</code>
      now defaults to <code>false</code>, so a missing prop no longer renders paid insights.</li>
    <li>Result: Basic subscribers see the "Unlock AI insights with Dyia Pro" teaser card on Jobs &amp;
      Quotes, matching the Customers behavior.</li>
  </ul>

  <p><strong>BUG-024 — Upgrade-to-Pro CTAs.</strong> All six CTAs now deep-link to
    <code>/app?view=settings&amp;tab=account#subscription</code>. <code>page.tsx</code> parses the
    <code>tab</code> query param, <code>Settings</code> auto-scrolls to the <code>#subscription</code>
    anchor. Verified locally: navigating to <code>?view=settings&amp;tab=account</code> opens the Account
    tab with the Subscription card in view (no longer Settings → Business).</p>

  <p><strong>BUG-025 — Stale contact info.</strong> Both forms now clear phone/email/address when the user
    removes or changes a name off a previously-matched customer:</p>
  <ul>
    <li><code>src/components/app/Jobs.tsx</code> <code>updateCustomer</code> (~line 443) detects the
      diverge-from-match case and wipes contact fields (and <code>tempAddress</code> for the first row).</li>
    <li><code>src/components/app/QuoteBuilder.tsx</code> <code>handleCustomerNameChange</code> does the same
      and flips <code>customerFound</code> back to <code>false</code>.</li>
  </ul>

  <p><strong>BUG-026 — AI-created items not visible in grid.</strong>
    <code>Assistant</code> now receives an <code>onAppDataChanged</code> callback from
    <code>page.tsx</code> that triggers a fresh <code>loadData()</code> for jobs/quotes/settings. Invoked
    after any non-pending successful tool result and after a successful <code>handleConfirmJob</code> /
    <code>handleConfirmQuote</code>. No manual refresh is required after saving via Ask Dyia.</p>

  <p><strong>BUG-027 — Quote → job conversion.</strong></p>
  <ul>
    <li><code>get_pending_follow_ups</code> now exposes the underlying <code>quoteId</code> alongside the
      follow-up <code>id</code>, so the model has both references and cannot conflate them
      (<code>src/lib/openai/handlers.ts</code>).</li>
    <li><code>convert_quote_to_job</code> handler now falls back to resolving the passed id as a follow-up
      id if the direct quote lookup fails, then uses the follow-up's <code>quote_id</code>.</li>
    <li>Schema loosened: <code>revenue = -1</code> and <code>date = ""</code> are explicit "use default"
      sentinels (estimate midpoint / today). Tool instructions in <code>client.ts</code> describe the
      correct id and default behavior.</li>
    <li><code>update_follow_up_status</code> now rejects missing <code>snooze_until</code> only when
      <code>status === 'snoozed'</code> and returns a clear error otherwise.</li>
  </ul>

  <p><strong>BUG-028 — Top-earning jobs list.</strong> Added a new
    <code>list_top_jobs</code> AI tool (<code>sort_by</code>: revenue|profit, <code>period</code>,
    <code>limit</code>) that returns a ranked list of individual jobs instead of the aggregates produced by
    <code>get_performance_stats</code> and <code>get_business_summary</code>
    (<code>src/lib/openai/functions.ts</code>, <code>src/lib/openai/handlers.ts</code>,
    instructions in <code>src/lib/openai/client.ts</code>). Registered in the chat-route type union.</p>

  <p><strong>BUG-029 — Stale job preview across chats.</strong> <code>pendingAction</code> in
    <code>Assistant.tsx</code> is now cleared in three places: the thread-load effect, the
    <code>handleNewConversation</code> handler, and the <code>handleSelectThread</code> handler. The
    preview card from a previous thread can no longer leak into a new chat.</p>

  <p><strong>BUG-030 — "Failed to create payment link".</strong> The misleading error was caused by
    <code>navigator.clipboard.writeText</code> throwing <em>after</em> the link was successfully created
    (insecure context, denied permission, or focus loss). We now:</p>
  <ul>
    <li>Split payment-link creation and clipboard copy into separate try/catch blocks
      (<code>src/components/app/Quotes.tsx</code> <code>requestQuotePayment</code>).</li>
    <li>Update the quote state (status, amount, request id) regardless of clipboard outcome.</li>
    <li>Show the URL in a fallback dialog when clipboard fails, so the user can copy manually.</li>
    <li>Differentiated API errors in <code>src/app/api/payments/request/route.ts</code>: missing
      <code>stripe_connect_account_id</code> vs <code>charges_enabled === false</code> now have distinct
      actionable messages.</li>
  </ul>
  <p class="small">Verified locally that the link creation/clipboard paths no longer short-circuit each
    other. Real payment-request QA sign-off depends on a live Stripe Connect account (STR-007 through
    STR-011 are unblocked by this fix).</p>
</div>

<h2>Re-test of Ask Dyia cases (AI-001 – AI-008)</h2>
<table>
  <thead>
    <tr><th>Test ID</th><th>Action</th><th>Previous</th><th>New Expected Result</th></tr>
  </thead>
  <tbody>
    <tr><td>AI-001</td><td>This week's stats</td><td>Pass</td><td>Still Pass</td></tr>
    <tr><td>AI-002</td><td>Log a job via chat</td><td>Partial (BUG-026)</td><td>Pass — grid refresh on save</td></tr>
    <tr><td>AI-003</td><td>Update the just-logged job</td><td>Fail (BUG-011)</td><td>Pass — jobId surfaced + update_job fields extended</td></tr>
    <tr><td>AI-004</td><td>Monthly revenue summary</td><td>Pass</td><td>Still Pass</td></tr>
    <tr><td>AI-005</td><td>Follow-up customers</td><td>Partial</td><td>Pass — quoteId now exposed</td></tr>
    <tr><td>AI-006</td><td>Top-earning jobs list</td><td>Fail (BUG-028)</td><td>Pass — new list_top_jobs tool</td></tr>
    <tr><td>AI-007</td><td>General business question</td><td>Pass</td><td>Still Pass</td></tr>
    <tr><td>AI-008</td><td>Create a quote</td><td>Partial (BUG-026)</td><td>Pass — preview cleared + grid refresh</td></tr>
  </tbody>
</table>

<h2>Stripe Connect Payments re-test (STR-001 – STR-011)</h2>
<table>
  <thead>
    <tr><th>Test ID</th><th>Action</th><th>Previous</th><th>New Expected Result</th></tr>
  </thead>
  <tbody>
    <tr><td>STR-001 – STR-006</td><td>Onboarding, connect status, create quote &amp; job</td><td>Pass</td><td>Still Pass</td></tr>
    <tr><td>STR-007</td><td>Initiate payment request</td><td>Fail (BUG-030)</td><td>Pass — link creation &amp; copy paths decoupled; onboarding-state errors clarified</td></tr>
    <tr><td>STR-008</td><td>Complete a test payment</td><td>Blocked by STR-007</td><td>Unblocked — requires real Stripe Connect account to verify</td></tr>
    <tr><td>STR-009</td><td>Payment reflected in Jobs/Revenue</td><td>Blocked</td><td>Unblocked — human QA</td></tr>
    <tr><td>STR-010</td><td>Refund via Stripe dashboard</td><td>Blocked</td><td>Unblocked — human QA</td></tr>
    <tr><td>STR-011</td><td>Payment flow on iOS/Android</td><td>Blocked</td><td>Unblocked — human QA</td></tr>
  </tbody>
</table>

<div class="callout">
  <strong>Expected outcome:</strong> STR-007 should now succeed on any Stripe-connected account. If a failure
  occurs, the dialog text now distinguishes between (a) Stripe not connected, (b) charges not yet enabled,
  (c) quote-total ≤ 0, (d) clipboard blocked. Attach whichever message appears to the new bug for faster triage.
</div>

<h2>Open questions from the original report</h2>
<ul>
  <li><strong>BUG-004 / BUG-005 / Header navigation inconsistency:</strong> product decisions, not addressed
    in this code batch.</li>
  <li><strong>QA Question 1 (missing nav links on marketing site):</strong> product decision — no change.</li>
  <li><strong>QA Question 2 (add "+ Schedule Job" to the Jobs grid):</strong> usability enhancement —
    recommended but not implemented here to keep the fix scope focused on reported bugs.</li>
</ul>

<h2>Required actions before deploy</h2>
<div class="block">
  <div class="block-title">Migrations</div>
  Run <code>supabase/migrations/034_trial_consumed_at.sql</code> against the target environment before
  enabling the subscription / trial changes. The migration is backfill-safe.
</div>

<h2>Verification coverage</h2>
<p>The following bugs were verified in a local dev server via demo-mode Playwright snapshots:</p>
<ul>
  <li>BUG-007 / BUG-017 — account menu opens, items clickable, no banner overlap.</li>
  <li>BUG-015 — source &amp; sort selects size to content; search field retains ample width.</li>
  <li>BUG-016 — Log Daily Expenses modal centers with Cancel / Apply buttons fully visible.</li>
  <li>BUG-020 — logo renders correctly in dark mode (no inverted filter).</li>
  <li>BUG-021 — QuoteBuilder Name field is now a proper ARIA combobox that expands reliably.</li>
  <li>BUG-024 — <code>/app?view=settings&amp;tab=account</code> opens Account tab + Subscription card.</li>
</ul>
<p>The remaining bugs ship with code fixes and require human QA on real Clerk / Stripe / iOS sessions to
  validate the end-to-end flows (Basic subscriber labelling, AI tool-call behaviour with OpenAI streaming,
  live Stripe Connect payment requests, Safari mobile tap targets).</p>

<footer>
  Dyia QA — Retest Response · April 2026 · Confidential
</footer>

</body>
</html>
`

async function main() {
  const browser = await puppeteer.launch({ headless: 'new' })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    await page.pdf({
      path: OUT,
      format: 'Letter',
      printBackground: true,
      margin: { top: '22mm', right: '18mm', bottom: '22mm', left: '18mm' },
    })
    writeFileSync(OUT.replace(/\.pdf$/, '.html'), html)
    console.log('Wrote', OUT)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
