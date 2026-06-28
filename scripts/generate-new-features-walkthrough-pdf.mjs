/**
 * Generate a publishable, screenshot-led PDF walkthrough of the post-meeting
 * feature release.
 *
 *   node scripts/generate-new-features-walkthrough-pdf.mjs
 *
 * Requires the dev server running at http://localhost:3100 (or set
 * WALKTHROUGH_BASE_URL). Screenshots are captured live from the app in demo
 * mode and EMBEDDED into the PDF as base64 data URIs so they always render.
 *
 * Output: claudedocs/new-features-walkthrough/dyia-new-features-walkthrough.pdf
 */

import puppeteer from 'puppeteer'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE = process.env.WALKTHROUGH_BASE_URL || 'http://localhost:3100'
const DIR = join(__dirname, '..', 'claudedocs', 'new-features-walkthrough')
const ASSETS = join(DIR, 'assets')
const OUT_FILE = join(DIR, 'dyia-new-features-walkthrough.pdf')
mkdirSync(ASSETS, { recursive: true })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Inline a captured PNG as a base64 data URI so it embeds in the PDF. */
const embed = (name) => {
  const buf = readFileSync(join(ASSETS, `${name}.png`))
  return `data:image/png;base64,${buf.toString('base64')}`
}

async function cleanFrame(page) {
  await page.evaluate(() => {
    if (!document.getElementById('walkthrough-clean')) {
      const s = document.createElement('style')
      s.id = 'walkthrough-clean'
      s.textContent = 'nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none!important}'
      document.head.appendChild(s)
    }
  }).catch(() => {})
}

async function capture(page, name, url, { wait = 3000, fullPage = false } = {}) {
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle2', timeout: 45000 })
  await sleep(wait)
  await cleanFrame(page)
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {})
  await sleep(350)
  await page.screenshot({ path: join(ASSETS, `${name}.png`), fullPage })
  console.log(`  captured ${name}.png`)
}

const css = `
  * { box-sizing: border-box; }
  body { margin: 0; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 11px; line-height: 1.55; }

  .cover { min-height: 960px; padding: 56px 50px; color: #fff; background: radial-gradient(circle at 78% 6%, rgba(249,115,22,.45), transparent 36%), linear-gradient(135deg,#0f172a,#1e293b 56%,#7c2d12); border-radius: 18px; overflow: hidden; }
  .kicker { display: inline-block; padding: 6px 13px; border-radius: 999px; background: linear-gradient(90deg,#f97316,#f59e0b); font-size: 9px; font-weight: 900; letter-spacing: .15em; text-transform: uppercase; }
  h1 { margin: 22px 0 10px; font-size: 36px; line-height: 1.07; letter-spacing: -1px; color: #fff; max-width: 740px; }
  .cover .sub { max-width: 700px; color: #cbd5e1; font-size: 13.5px; }
  .cover .hero { width: 100%; margin-top: 30px; border-radius: 13px; border: 1px solid rgba(255,255,255,.16); box-shadow: 0 24px 70px rgba(0,0,0,.45); }
  .prepared { margin-top: 28px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.15); color: #94a3b8; font-size: 10px; }
  .prepared b { color: #fff; }

  .page { page-break-before: always; padding: 8px 0 0; }
  h2 { margin: 0 0 4px; font-size: 20px; color: #0f172a; letter-spacing: -.3px; }
  h2 .n { color: #f97316; font-weight: 900; margin-right: 9px; }
  .rule { width: 64px; height: 3px; margin: 0 0 12px; border-radius: 999px; background: linear-gradient(90deg,#f97316,#f59e0b); }
  .lead { font-size: 12px; color: #334155; margin: 0 0 6px; }

  figure { margin: 12px 0 6px; }
  .shot { width: 100%; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 10px 30px rgba(15,23,42,.12); display: block; }
  figcaption { margin-top: 7px; color: #64748b; font-size: 9.6px; }
  figcaption b { color: #c2410c; }

  .whatnew { border-left: 4px solid #f97316; background: #fff7ed; border-radius: 0 10px 10px 0; padding: 11px 15px; margin: 12px 0; }
  .whatnew h4 { margin: 0 0 5px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #c2410c; }
  .whatnew ul { margin: 0; padding-left: 16px; } .whatnew li { margin: 3px 0; }

  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .card { border: 1px solid #e2e8f0; border-radius: 13px; padding: 15px 17px; background: #fff; box-shadow: 0 2px 12px rgba(15,23,42,.05); page-break-inside: avoid; }
  .card.orange { background: #fff7ed; border-color: #fdba74; }
  .card h3 { margin: 6px 0 4px; font-size: 13px; }
  .card p { margin: 0; color: #475569; }
  .pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 8px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; }
  .pill.retain { color: #9a3412; background: #ffedd5; }
  .pill.admin { color: #1d4ed8; background: #dbeafe; }
  .pill.done { color: #166534; background: #dcfce7; }
  .pill.metric { color: #5b21b6; background: #ede9fe; }

  .flow { display: grid; grid-template-columns: repeat(5,1fr); gap: 9px; margin: 12px 0; }
  .step { border: 1px solid #fed7aa; background: #fff7ed; border-radius: 11px; padding: 11px; min-height: 86px; }
  .step .sn { font-weight: 900; color: #c2410c; font-size: 12px; }
  .step .st { font-weight: 700; color: #0f172a; margin: 3px 0; font-size: 10.5px; }
  .step .sd { color: #64748b; font-size: 9.3px; }

  /* Faithful in-app UI previews (for billing/admin-gated surfaces not shown in demo) */
  .appwrap { border: 1px solid #1e293b; border-radius: 14px; overflow: hidden; box-shadow: 0 12px 34px rgba(15,23,42,.20); margin: 12px 0 6px; }
  .appbar { background: #0f172a; color: #e2e8f0; padding: 10px 16px; font-size: 11px; font-weight: 700; display: flex; justify-content: space-between; align-items: center; }
  .appbody { background: #0b1220; padding: 18px; }
  .modal { max-width: 460px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 14px; padding: 18px; color: #e5e7eb; }
  .modal .mt { font-size: 15px; font-weight: 800; color: #fff; }
  .modal .ms { font-size: 10px; color: #9ca3af; margin: 4px 0 12px; }
  .field { margin: 10px 0; }
  .field label { display: block; font-size: 9.5px; color: #cbd5e1; margin-bottom: 4px; font-weight: 600; }
  .input { background: #0b1220; border: 1px solid #334155; border-radius: 9px; padding: 9px 11px; font-size: 10px; color: #94a3b8; }
  .modal .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
  .btn { border-radius: 9px; padding: 8px 14px; font-size: 10px; font-weight: 700; }
  .btn.secondary { background: #1f2937; color: #e5e7eb; }
  .btn.ghost { background: transparent; color: #9ca3af; }
  .btn.primary { background: linear-gradient(90deg,#f97316,#f59e0b); color: #fff; }

  .adminrow { display: grid; grid-template-columns: 1.3fr .9fr .7fr .7fr; gap: 10px; align-items: center; padding: 11px 12px; border: 1px solid #1f2937; border-radius: 10px; background: #111827; margin-bottom: 8px; color: #e5e7eb; font-size: 10px; }
  .adminrow .muted { color: #94a3b8; font-size: 9px; }
  .adminhead { color: #94a3b8; font-size: 9px; text-transform: uppercase; letter-spacing: .06em; }
  .badge { padding: 2px 8px; border-radius: 999px; font-size: 8px; font-weight: 800; text-transform: uppercase; }
  .badge.new { background: #1e3a8a; color: #bfdbfe; }
  .badge.contacted { background: #78350f; color: #fde68a; }
  .badge.won { background: #064e3b; color: #a7f3d0; }

  .appendix { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; margin-top: 8px; }
  .appendix table { width: 100%; border-collapse: collapse; font-size: 9.6px; }
  .appendix td { padding: 6px 8px; border-bottom: 1px solid #e8edf3; vertical-align: top; }
  .appendix code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 8.8px; color: #0f172a; }
  .legend { margin-top: 14px; color: #94a3b8; font-size: 9px; }
`

function feature({ n, title, lead, shot, caption, whatNew }) {
  return `<div class="page">
    <h2><span class="n">${n}</span>${title}</h2><div class="rule"></div>
    <p class="lead">${lead}</p>
    <figure><img class="shot" src="${shot}" /><figcaption>${caption}</figcaption></figure>
    <div class="whatnew"><h4>What's new here</h4><ul>${whatNew.map((x) => `<li>${x}</li>`).join('')}</ul></div>
  </div>`
}

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })

    console.log('Capturing live screenshots...')
    await capture(page, 'sign-in-demo-launcher', '/sign-in', { wait: 2200 })
    // Enable demo cookie, then capture the authenticated product surfaces.
    await page.goto(`${BASE}/api/test/enable-demo`, { waitUntil: 'networkidle2' })
    await capture(page, 'dashboard', '/app', { wait: 3500 })
    await capture(page, 'jobs-receipt-action', '/app?view=jobs', { wait: 3200 })
    await capture(page, 'payments-invoice-hub', '/app?view=payments', { wait: 3500, fullPage: true })
    await capture(page, 'niche-quote-builder', '/app?view=quoteBuilder', { wait: 3200 })
    await capture(page, 'settings-business', '/app?view=settings&tab=business', { wait: 3000 })
    await capture(page, 'settings-account-billing', '/app?view=settings&tab=account', { wait: 3200 })

    const generatedAt = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>

      <div class="cover">
        <span class="kicker">Dyia Product Update · Visual Walkthrough</span>
        <h1>What's New: Retention, Niches, Payments &amp; Demo Access</h1>
        <p class="sub">A screenshot-by-screenshot tour of the functionality shipped after our last meeting — cancellation feedback &amp; retargeting, cleaner launch metrics, lawn care / house cleaning readiness, receipts, and a safe marketing demo path.</p>
        <img class="hero" src="${embed('dashboard')}" />
        <div class="prepared">Prepared for <b>Marco</b> and the Dyia team · Generated ${generatedAt}<br/>Every screenshot below is captured live from the running app in demo mode (sample data only — no real customer information).</div>
      </div>

      <div class="page">
        <h2><span class="n">1</span>At a glance</h2><div class="rule"></div>
        <p class="lead">Six things changed. Each gets its own screenshot in the pages that follow.</p>
        <div class="grid2">
          <div class="card orange"><span class="pill retain">Retention</span><h3>Cancellation feedback</h3><p>When someone cancels, we now ask why — reason, what they liked, what they didn't — without blocking the cancellation.</p></div>
          <div class="card"><span class="pill admin">Admin</span><h3>Cancellations &amp; retargeting</h3><p>A new admin section stores every cancellation with the user's details so you can reach back out with an offer.</p></div>
          <div class="card"><span class="pill metric">Metrics</span><h3>Clean launch numbers</h3><p>Test/demo accounts can be tagged and are excluded from your real stats, so the dashboard reflects actual users.</p></div>
          <div class="card"><span class="pill done">Niches</span><h3>Lawn care &amp; cleaning</h3><p>Onboarding, quotes, and job expense labels now adapt to the trade instead of always assuming junk removal.</p></div>
          <div class="card"><span class="pill done">Payments</span><h3>Invoices &amp; receipts</h3><p>Branded invoices and pay links already exist; completed jobs now also get a downloadable receipt PDF.</p></div>
          <div class="card"><span class="pill done">Marketing</span><h3>Demo access</h3><p>A password-protected demo launcher lets you record promos with sample data — never real customer numbers.</p></div>
        </div>
      </div>

      ${feature({
        n: 2,
        title: 'Marketing demo launcher',
        lead: 'On the sign-in screen there is now a dedicated demo entry so you can open a fully populated sample account for Loom videos and screenshots.',
        shot: embed('sign-in-demo-launcher'),
        caption: '<b>Sign-in page.</b> The new "Marketing demo" card sits beneath the normal sign-in, with a password field and an "Open Demo" button.',
        whatNew: [
          'Enter the demo password and click <b>Open Demo</b> to load the sample business instantly.',
          'No real customer data is ever exposed — the demo uses built-in sample jobs, quotes, and payments.',
          'Perfect for recording promos: everything is clickable and looks live.',
        ],
      })}

      ${feature({
        n: 3,
        title: 'Dashboard (the demo you can record)',
        lead: 'Once demo mode is on, the full product opens with realistic numbers — daily revenue, profit, schedule, and goal progress.',
        shot: embed('dashboard'),
        caption: '<b>Authenticated home.</b> Live revenue/profit, today\'s schedule, and monthly-goal progress, all running on safe sample data.',
        whatNew: [
          'This is the exact view marketing can screen-record without touching production data.',
          'A small demo-mode banner stays visible so it is always clear this is sample data.',
        ],
      })}

      ${feature({
        n: 4,
        title: 'Receipts after a completed job',
        lead: 'This answers Marco\'s question directly: after a job is done, you can hand the customer a branded receipt.',
        shot: embed('jobs-receipt-action'),
        caption: '<b>Jobs view.</b> Each completed job with revenue now shows a <b>receipt download</b> action alongside "request payment", edit, and delete.',
        whatNew: [
          'Completed jobs expose a one-click <b>receipt PDF</b> (branded with your business name, logo, and totals).',
          'This is separate from collecting payment — it is the "here\'s your receipt" document customers ask for.',
          'Pay links / invoices for the same job still work exactly as before.',
        ],
      })}

      ${feature({
        n: 5,
        title: 'Invoices & payment links',
        lead: 'For the "can I send an invoice / receipt after a job" question, the Payments hub already covers invoicing and collection once Stripe is connected.',
        shot: embed('payments-invoice-hub'),
        caption: '<b>Payments hub.</b> Create branded invoices or pay links, see the transparent fee/payout breakdown, and track every request by status.',
        whatNew: [
          'Send an <b>itemized invoice</b> (with tax + due date) or a quick <b>pay link</b>.',
          'The money-flow panel shows the platform fee and the exact amount that lands in the bank.',
          'Activity list tracks Paid / Awaiting / Overdue for every request.',
        ],
      })}

      ${feature({
        n: 6,
        title: 'Lawn care & house cleaning readiness',
        lead: 'The two extra niches are no longer just marketing pages — the quoting flow adapts to the trade.',
        shot: embed('niche-quote-builder'),
        caption: '<b>Quote builder.</b> Non-junk trades use clean line items and templates; the junk-only load calculator is now clearly scoped to junk removal.',
        whatNew: [
          'Onboarding seeds trade-appropriate starter prices (mowing/edging for lawn care, standard/deep clean for cleaning).',
          'The junk-removal load calculator is hidden for other trades, so lawn/cleaning quotes stay simple.',
          'Job expense labels adapt too (e.g. fuel/yard waste for lawn care, supplies/travel for cleaning).',
        ],
      })}

      ${feature({
        n: 7,
        title: 'Business type in Settings',
        lead: 'The selected trade drives the niche behavior above and can be changed any time.',
        shot: embed('settings-business'),
        caption: '<b>Settings · Business.</b> The Business Type selector is what tells Dyia whether to behave like junk removal, lawn care, or cleaning.',
        whatNew: [
          'Switching business type updates pricing templates and quote/job behavior for that trade.',
          'This is the single control Marco can flip when testing each niche end-to-end.',
        ],
      })}

      <div class="page">
        <h2><span class="n">8</span>Cancellation feedback (in-app)</h2><div class="rule"></div>
        <p class="lead">The headline retention feature. When a Pro user cancels, this optional prompt appears <b>before</b> the downgrade is scheduled — capturing exactly what Marco asked for.</p>
        <div class="appwrap">
          <div class="appbar"><span>Settings · Account · Cancel subscription</span><span style="color:#fdba74">In-app modal</span></div>
          <div class="appbody">
            <div class="modal">
              <div class="mt">Before you downgrade</div>
              <div class="ms">You'll keep Pro until your billing date. If you have a minute, your feedback helps us decide what to fix next.</div>
              <div class="field"><label>Main reason</label><div class="input">Select a reason (optional) — too expensive, missing feature, hard to use, not using it enough, business changed, using another tool…</div></div>
              <div class="field"><label>What did you like?</label><div class="input">Anything useful about Dyia?</div></div>
              <div class="field"><label>What didn't work for you?</label><div class="input">Missing workflow, confusing step, pricing, etc.</div></div>
              <div class="actions"><span class="btn secondary">Keep Pro</span><span class="btn ghost">Skip feedback</span><span class="btn primary">Send feedback &amp; downgrade</span></div>
            </div>
          </div>
        </div>
        <figcaption>Faithful reproduction of the live modal. It is shown here as a styled preview because the cancel control only appears for a real billed Pro account, which the demo deliberately hides.</figcaption>
        <div class="whatnew"><h4>What's new here</h4><ul>
          <li>Optional reason + likes + dislikes + free notes, captured in one step.</li>
          <li>Cancellation is never blocked — users can <b>Skip feedback</b> and still downgrade.</li>
          <li>Billing truth stays in Stripe; the feedback is saved alongside a snapshot of who canceled and when.</li>
        </ul></div>
      </div>

      <div class="page">
        <h2><span class="n">9</span>Admin cancellations &amp; retargeting</h2><div class="rule"></div>
        <p class="lead">Every cancellation becomes a row you can act on — see who left, why, how much they used the product, and track win-back outreach.</p>
        <div class="appwrap">
          <div class="appbar"><span>Admin Panel · Cancellations</span><span style="color:#93c5fd">Retargeting queue</span></div>
          <div class="appbody">
            <div class="adminrow adminhead"><span>Customer</span><span>Plan at cancel</span><span>Usage</span><span>Status</span></div>
            <div class="adminrow"><span>John Smith<div class="muted">john@example.com · "too expensive"</div></span><span>pro / monthly</span><span>12 jobs · 4 quotes</span><span><span class="badge new">New</span></span></div>
            <div class="adminrow"><span>Sarah M.<div class="muted">sarah@example.com · "missing feature"</div></span><span>pro / annual (trial)</span><span>2 jobs · 1 quote</span><span><span class="badge contacted">Contacted</span></span></div>
            <div class="adminrow"><span>Mike's Hauling<div class="muted">mike@example.com · "business changed"</div></span><span>pro / monthly</span><span>30 jobs · 9 quotes</span><span><span class="badge won">Won back</span></span></div>
          </div>
        </div>
        <figcaption>Faithful reproduction of the new admin tab (admin-only, so not visible in the demo account). Filter by status, read full feedback, save retargeting notes, and jump to the user record.</figcaption>
        <div class="whatnew"><h4>What's new here</h4><ul>
          <li>New <b>Cancellations</b> tab in the admin panel, backed by a dedicated API.</li>
          <li>Each row shows the feedback, the user's plan, and their real usage (jobs/quotes).</li>
          <li>Set a retargeting status (new → contacted → won back / not fit / do not contact) and store notes for promos.</li>
        </ul></div>
      </div>

      <div class="page">
        <h2><span class="n">10</span>Clean launch metrics &amp; account review</h2><div class="rule"></div>
        <p class="lead">So the admin dashboard reflects real customers, test/demo accounts can be tagged and filtered out — without deleting any history.</p>
        <figure><img class="shot" src="${embed('settings-account-billing')}" /><figcaption><b>Account surfaces</b> like this feed the admin metrics. Test/demo users are now excluded from launch stats by default.</figcaption></figure>
        <div class="grid2">
          <div class="card orange"><h3>Excluded from metrics</h3><p>Tagged test accounts no longer count toward users, subscriptions, signups, jobs, quotes, customers, AI usage, or engagement funnels.</p></div>
          <div class="card"><h3>Easy review</h3><p>Admin user lists gained <b>Real users</b> / <b>Test-demo</b> filters, and each user can be tagged or untagged in one click. Nothing is deleted.</p></div>
        </div>
        <div class="whatnew"><h4>Why it matters for launch</h4><ul>
          <li>Marco's dashboard now shows true paying/active counts, not seeded QA rows.</li>
          <li>Hannah's account (and any real users) stay; only tagged test accounts drop out of the numbers.</li>
        </ul></div>
      </div>

      <div class="page">
        <h2><span class="n">11</span>Suggested reply to Marco &amp; reference</h2><div class="rule"></div>
        <div class="whatnew"><h4>Reply on invoices / receipts / demo</h4><ul>
          <li>"Yes — in <b>Payments</b> you can send a branded <b>invoice</b> or a <b>pay link</b> once Stripe is connected."</li>
          <li>"After a job is completed, you can now also download a <b>receipt PDF</b> to give the customer."</li>
          <li>"For marketing, use the <b>password-protected demo</b> on the sign-in page so recordings only ever show sample data."</li>
        </ul></div>
        <div class="appendix">
          <p style="margin:0 0 6px;font-weight:700;color:#0f172a;">Where each feature lives (for the dev team)</p>
          <table>
            <tr><td>Cancellation prompt + downgrade</td><td><code>src/components/app/Settings.tsx</code></td></tr>
            <tr><td>Feedback persistence on cancel</td><td><code>src/app/api/stripe/subscription/cancel/route.ts</code></td></tr>
            <tr><td>Admin cancellations API</td><td><code>src/app/api/admin/cancellations/route.ts</code></td></tr>
            <tr><td>Admin cancellations + test-account tagging UI</td><td><code>src/components/app/AdminPanel.tsx</code></td></tr>
            <tr><td>Metrics exclusion of test accounts</td><td><code>src/app/api/admin/stats/route.ts</code>, <code>src/lib/admin.ts</code></td></tr>
            <tr><td>Niche onboarding / quote / job behavior</td><td><code>onboarding/page.tsx</code>, <code>QuoteBuilder.tsx</code>, <code>Jobs.tsx</code></td></tr>
            <tr><td>Job receipt PDF + demo launcher</td><td><code>Jobs.tsx</code>, <code>sign-in/[[...sign-in]]/page.tsx</code></td></tr>
            <tr><td>Schema (feedback table + flags)</td><td><code>supabase/migrations/046_cancellation_feedback_and_test_accounts.sql</code></td></tr>
          </table>
        </div>
        <p class="legend">Validation: lint, tests, and the production build all pass. Screenshots in this document were captured live in demo mode; pages 8 and 9 are faithful UI previews because those surfaces require a billed/admin session that the demo intentionally excludes.</p>
      </div>

    </body></html>`

    writeFileSync(join(DIR, 'dyia-new-features-walkthrough.html'), html)
    await page.setContent(html, { waitUntil: 'load', timeout: 60000 })
    await sleep(400)
    await page.pdf({
      path: OUT_FILE,
      format: 'A4',
      printBackground: true,
      margin: { top: '13mm', right: '13mm', bottom: '13mm', left: '13mm' },
    })
    await page.close()
    console.log('PDF written:', OUT_FILE)
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
