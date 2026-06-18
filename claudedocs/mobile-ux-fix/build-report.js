const fs = require('fs')
const path = require('path')

const dir = __dirname
const shots = path.join(dir, 'shots')
const b64 = (p) => 'data:image/png;base64,' + fs.readFileSync(p).toString('base64')

// The before/after screenshots are embedded as data URIs. Prefer the original
// PNGs in shots/ when present; otherwise recover them from the previously
// generated report.html so this script stays runnable after the raw PNGs are
// cleaned up. The freshly written report.html re-embeds them, keeping re-runs
// idempotent.
function loadShots() {
  const beforePng = path.join(shots, 'before_expenses_dark.png')
  const afterPng = path.join(shots, 'after_expenses_dark.png')
  if (fs.existsSync(beforePng) && fs.existsSync(afterPng)) {
    return { beforeImg: b64(beforePng), afterImg: b64(afterPng) }
  }
  const prev = path.join(dir, 'report.html')
  if (fs.existsSync(prev)) {
    const html = fs.readFileSync(prev, 'utf8')
    const matches = [...html.matchAll(/data:image\/png;base64,[A-Za-z0-9+/=]+/g)].map((m) => m[0])
    if (matches.length >= 2) return { beforeImg: matches[0], afterImg: matches[1] }
  }
  throw new Error('Could not find before/after screenshots in shots/ or report.html')
}

const { beforeImg, afterImg } = loadShots()

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  @page { size: Letter; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; }
  .page { width: 8.5in; min-height: 11in; padding: 0.7in 0.75in; page-break-after: always; position: relative; }
  .page:last-child { page-break-after: auto; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .brand .logo { width: 30px; height: 30px; border-radius: 8px; background: linear-gradient(135deg,#f97316,#fbbf24); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:17px; }
  .brand .name { font-size: 19px; font-weight: 800; letter-spacing: -0.02em; }
  .kicker { color:#f97316; font-weight:700; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; margin: 26px 0 6px; }
  h1 { font-size: 30px; line-height:1.1; letter-spacing:-0.02em; margin: 0 0 10px; }
  h2 { font-size: 18px; letter-spacing:-0.01em; margin: 24px 0 10px; padding-bottom:7px; border-bottom: 2px solid #f1f1f1; }
  h3 { font-size: 14px; margin: 16px 0 6px; }
  p { font-size: 13.5px; line-height: 1.6; color:#333; margin: 0 0 10px; }
  .meta { font-size: 12px; color:#888; margin-top: 4px; }
  .lede { font-size: 14.5px; color:#444; }
  .grid2 { display:flex; gap: 26px; margin-top: 8px; }
  .col { flex:1; }
  .shotwrap { border-radius: 18px; overflow:hidden; border:1px solid #e5e5e5; box-shadow: 0 8px 24px rgba(0,0,0,0.10); background:#000; }
  .shotwrap img { display:block; width:100%; }
  .tag { display:inline-flex; align-items:center; gap:7px; font-weight:700; font-size:13px; padding:5px 12px; border-radius: 999px; margin-bottom:10px; }
  .tag.bad { background:#fdeaea; color:#c0362c; }
  .tag.good { background:#e7f6ed; color:#1a7f44; }
  .dot { width:8px; height:8px; border-radius:50%; }
  .dot.bad{ background:#c0362c;} .dot.good{ background:#1a7f44;}
  .caption { font-size:12px; color:#666; margin-top:10px; line-height:1.5; }
  ul.clean { list-style:none; padding:0; margin: 6px 0; }
  ul.clean li { font-size:13.5px; line-height:1.55; padding:9px 0 9px 26px; position:relative; border-bottom:1px solid #f3f3f3; }
  ul.clean li:before { content:""; position:absolute; left:4px; top:14px; width:9px; height:9px; border-radius:3px; background:#f97316; }
  .callout { background:#fff7ed; border:1px solid #fed7aa; border-radius:12px; padding:14px 16px; margin:14px 0; }
  .callout .t { font-weight:700; font-size:13px; color:#9a3412; margin-bottom:4px; }
  .callout p { color:#7c2d12; margin:0; font-size:13px; }
  table { width:100%; border-collapse:collapse; font-size:12.5px; margin-top:6px; }
  th, td { text-align:left; padding:9px 10px; border-bottom:1px solid #eee; vertical-align:top; }
  th { font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#888; }
  td.file { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:11.5px; color:#0a5; white-space:nowrap; }
  .foot { position:absolute; bottom:0.45in; left:0.75in; right:0.75in; display:flex; justify-content:space-between; font-size:10.5px; color:#aaa; border-top:1px solid #eee; padding-top:8px; }
  .pill-row{ display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;}
  .pill{ font-size:11.5px; background:#f4f4f5; border:1px solid #e4e4e7; color:#444; border-radius:999px; padding:4px 11px; font-weight:600;}
  .status { display:inline-block; font-size:10.5px; font-weight:700; padding:2px 9px; border-radius:999px; letter-spacing:0.03em; text-transform:uppercase; }
  .status.done { background:#e7f6ed; color:#1a7f44; }
  .status.plan { background:#eef2ff; color:#4338ca; }
  .roadmap { width:100%; border-collapse:collapse; margin-top:10px; }
  .roadmap td { padding:12px 10px; border-bottom:1px solid #eee; vertical-align:top; }
  .roadmap .item { font-weight:700; font-size:13.5px; }
  .roadmap .desc { font-size:12.5px; color:#555; line-height:1.5; }
</style>
</head>
<body>

<!-- PAGE 1 — Cover / roadmap overview -->
<section class="page">
  <div class="brand"><div class="logo">d</div><div class="name">dyia</div></div>
  <div class="kicker">Roadmap Feedback · Engineering Response</div>
  <h1>Marco's roadmap feedback,<br/>addressed end to end</h1>
  <p class="lede">A single update covering everything raised in the last review: the mobile expense flow that was hard to use, the leftover "free estimate" option, making quotes work for trades beyond junk removal, and the gaps in Dyia Intel. Each item below is either shipped or has a concrete, low-risk plan.</p>
  <div class="meta">Prepared June 18, 2026 · From: Engineering · Re: product roadmap review</div>

  <h2>At a glance</h2>
  <table class="roadmap">
    <tr>
      <td><span class="status done">Shipped</span></td>
      <td><div class="item">Mobile expenses flow</div><div class="desc">Closing out the day on a phone now opens a native bottom sheet — no scrolling to reach the form or the primary action. Also fixed an app-wide modal bug.</div></td>
    </tr>
    <tr>
      <td><span class="status done">Shipped</span></td>
      <td><div class="item">"Free estimate" option removed</div><div class="desc">Retired the redundant scheduling option; scheduling is now simply Scheduled Job or Estimate. Existing records migrated automatically.</div></td>
    </tr>
    <tr>
      <td><span class="status done">Shipped</span></td>
      <td><div class="item">Quotes — multi-vertical foundation</div><div class="desc">Business type is now a first-class setting and the quote builder is trade-agnostic: lawn care and cleaning can define their own pricing categories.</div></td>
    </tr>
    <tr>
      <td><span class="status done">Shipped</span></td>
      <td><div class="item">Dyia Intel — gaps closed</div><div class="desc">Monthly refresh now actually runs, the full research report is saved and shown, and basic-tier users get a clear upgrade path instead of a dead end.</div></td>
    </tr>
  </table>

  <div class="pill-row">
    <span class="pill">Next.js 16 · React 19</span>
    <span class="pill">Tailwind CSS 4</span>
    <span class="pill">Supabase</span>
    <span class="pill">OpenAI deep research</span>
  </div>

  <div class="foot"><span>dyia — Your Day, Decoded</span><span>Roadmap Response · 1 / 6</span></div>
</section>

<!-- PAGE 2 — Mobile expenses problem -->
<section class="page">
  <div class="brand"><div class="logo">d</div><div class="name">dyia</div></div>
  <div class="kicker">Item 1 · Mobile UX</div>
  <h1 style="font-size:26px;">Closing out the day on mobile,<br/>now in one clean sheet</h1>
  <p class="lede">Logging daily expenses on a phone was confusing: the form opened in a panel you had to scroll through, and the primary action could end up hidden behind the bottom navigation bar. This update reworks expense entry into a native-style bottom sheet and fixes the underlying bug that affected every modal in the app on mobile.</p>
  <div class="meta">Area: Jobs › Log daily expenses · Scope: app-wide modal behavior on phones</div>

  <h2>The problem</h2>
  <p>When a user finished their day and tapped <strong>Log / Edit daily expenses</strong> on a phone, the dialog did not behave like a proper overlay. The expense inputs and the <strong>Apply &amp; calculate</strong> button were pushed below the fold, so users had to scroll inside the dialog to finish — and on longer job lists the dialog could open partly off-screen. The action buttons could also collide with the bottom tab bar.</p>

  <div class="callout">
    <div class="t">Root cause (why it affected the whole app)</div>
    <p>Two page wrappers (<code>&lt;main&gt;</code> and the view container) used CSS entrance animations with <code>animation-fill-mode: both</code>. A <em>filling</em> transform animation always resolves to a matrix — even the identity matrix from the <code>transform: none</code> end frame. That stray transform turns the wrapper into a containing block <em>and</em> a stacking context, which trapped every <code>position: fixed</code> modal inside the tall, scrolled page instead of pinning it to the screen — and let the <code>z-40</code> tab bar paint over the <code>z-50</code> modal.</p>
  </div>

  <div class="pill-row">
    <span class="pill">iOS-style bottom sheet</span>
    <span class="pill">Safe-area aware</span>
    <span class="pill">Sticky header + footer</span>
  </div>

  <div class="foot"><span>dyia — Your Day, Decoded</span><span>Roadmap Response · 2 / 6</span></div>
</section>

<!-- PAGE 3 — Before & After -->
<section class="page">
  <div class="brand"><div class="logo">d</div><div class="name">dyia</div></div>
  <div class="kicker">Item 1 · Before &amp; After</div>
  <h2 style="margin-top:14px;">Log daily expenses — iPhone</h2>

  <div class="grid2">
    <div class="col">
      <span class="tag bad"><span class="dot bad"></span>Before</span>
      <div class="shotwrap"><img src="${beforeImg}" alt="Before" /></div>
      <p class="caption"><strong>Cancel / Apply &amp; calculate are obscured by the bottom navigation bar</strong>, and the dialog wasn't a true overlay — on longer lists it opened off-screen, forcing users to scroll to reach the inputs and submit.</p>
    </div>
    <div class="col">
      <span class="tag good"><span class="dot good"></span>After</span>
      <div class="shotwrap"><img src="${afterImg}" alt="After" /></div>
      <p class="caption"><strong>A docked bottom sheet</strong> with a sticky header and a sticky footer. Every expense field and the primary action are visible at once, sitting safely above the tab bar — no scrolling to finish.</p>
    </div>
  </div>

  <h2>What changed</h2>
  <ul class="clean">
    <li><strong>Root fix (app-wide):</strong> switched the page wrappers' entrance animations from <code>both</code> to <code>backwards</code> fill so finished views no longer trap fixed overlays. Every modal now pins to the viewport and renders above the tab bar.</li>
    <li><strong>Log daily expenses → bottom sheet:</strong> sticky header + sticky action footer; only the form body scrolls, so the inputs and <em>Apply &amp; calculate</em> are always reachable.</li>
    <li><strong>Consistent mobile sheets:</strong> standard modals, "Save as template", and the marketing "Edit spend" dialog now dock to the bottom on phones and center on desktop, with home-indicator safe-area padding.</li>
  </ul>

  <div class="foot"><span>dyia — Your Day, Decoded</span><span>Roadmap Response · 3 / 6</span></div>
</section>

<!-- PAGE 4 — Free estimate removal -->
<section class="page">
  <div class="brand"><div class="logo">d</div><div class="name">dyia</div></div>
  <div class="kicker">Item 2 · Scheduling</div>
  <h1 style="font-size:26px;">The redundant "free estimate"<br/>option is gone <span class="status done" style="vertical-align:middle;">Shipped</span></h1>
  <p class="lede">You flagged that scheduling offered three choices — Scheduled Job, Estimate, and Free Estimate — where the last one only added confusion. A "free estimate" is just an estimate visit; carrying it as a separate type meant extra branches everywhere and an inconsistent label on the map and previews.</p>

  <h2>What we did</h2>
  <ul class="clean">
    <li><strong>One fewer choice:</strong> the appointment type is now just <em>Scheduled Job</em> or <em>Estimate</em>. The estimate option already supports an optional price range, which covers the "free estimate" use case.</li>
    <li><strong>Removed everywhere:</strong> the dropdown option, the helper text, the sticky-preview label, the map pin label, and the AI "route for the day" handling were all collapsed to the two-state model.</li>
    <li><strong>No data loss:</strong> a database migration backfills any existing <code>free_estimate</code> appointments to <code>estimate</code>, then tightens the constraint so only the two valid values are accepted going forward.</li>
  </ul>

  <h2>Files touched</h2>
  <table>
    <tr><th>File</th><th>Change</th></tr>
    <tr><td class="file">components/app/Jobs.tsx</td><td>removed the Free Estimate option, helper-text branch, and preview label</td></tr>
    <tr><td class="file">types/database.ts</td><td><code>ScheduledJobKind</code> → <code>'job' | 'estimate'</code></td></tr>
    <tr><td class="file">lib/maps/jobs.ts · Maps.tsx</td><td>estimate detection + pin label simplified</td></tr>
    <tr><td class="file">lib/openai/handlers.ts</td><td>"route for the day" treats legacy values as estimate</td></tr>
    <tr><td class="file">supabase/migrations/045_drop_free_estimate.sql</td><td>backfill rows + tighten CHECK constraint</td></tr>
  </table>

  <div class="foot"><span>dyia — Your Day, Decoded</span><span>Roadmap Response · 4 / 6</span></div>
</section>

<!-- PAGE 5 — Dyia Intel -->
<section class="page">
  <div class="brand"><div class="logo">d</div><div class="name">dyia</div></div>
  <div class="kicker">Item 3 · Dyia Intel</div>
  <h1 style="font-size:26px;">Dyia Intel: the gaps you noticed,<br/>closed <span class="status done" style="vertical-align:middle;">Shipped</span></h1>
  <p class="lede">Intel generates a monthly competitive-intelligence report — verified competitor reviews, keyword gaps, ad spend, and a prioritized action plan. The engine was solid, but several things kept it from delivering reliably. Here's what was wrong and what we fixed.</p>

  <h2>Gaps found &amp; fixes</h2>
  <ul class="clean">
    <li><strong>The monthly refresh never ran in production.</strong> The cron endpoint existed but wasn't scheduled — so reports only updated when manually triggered. Added it to the cron schedule (1st of each month).</li>
    <li><strong>The full narrative report was generated but thrown away.</strong> The CRM paths saved the metrics and sources but not the written analysis. Now the report is persisted and rendered in-app as a "Full Research Report" section.</li>
    <li><strong>The agent re-guessed numbers it had already verified.</strong> We now feed the verified Google Places data (target + competitor review counts) into the research prompt as ground truth, so it stops re-estimating.</li>
    <li><strong>Basic-tier users hit a silent dead end.</strong> They now see a clear "Intel is a Pro feature" upgrade prompt instead of a failed request, and the previously dead "Learn about Pro" button now opens a contact email.</li>
  </ul>

  <h2>Files touched</h2>
  <table>
    <tr><th>File</th><th>Change</th></tr>
    <tr><td class="file">vercel.json</td><td>scheduled the monthly Intel cron</td></tr>
    <tr><td class="file">api/intel/refresh · api/cron/intel-monthly</td><td>persist <code>research_report</code></td></tr>
    <tr><td class="file">components/app/Intel.tsx</td><td>render report, upgrade prompt, fixed dead button</td></tr>
    <tr><td class="file">lib/intel/agent.ts</td><td>verified Places data in the research prompt</td></tr>
  </table>

  <div class="foot"><span>dyia — Your Day, Decoded</span><span>Roadmap Response · 5 / 6</span></div>
</section>

<!-- PAGE 6 — Quotes multi-vertical -->
<section class="page">
  <div class="brand"><div class="logo">d</div><div class="name">dyia</div></div>
  <div class="kicker">Item 4 · Quotes</div>
  <h1 style="font-size:26px;">Quotes that fit every trade,<br/>not just junk removal <span class="status done" style="vertical-align:middle;">Phase 1 shipped</span></h1>
  <p class="lede">You pointed out the mismatch: we advertise lawn care and cleaning, but the quote builder was hard-wired for junk removal — load sizes, haul-away surcharges, hot tubs. This phase makes quotes trade-agnostic so any vertical can price their own way, with deeper per-industry AI pricing as a fast follow.</p>

  <h2>What shipped now</h2>
  <ul class="clean">
    <li><strong>Business type is first-class.</strong> It's a real setting in Settings → Business (and read from onboarding), so the app knows whether you're lawn care, cleaning, moving, etc.</li>
    <li><strong>Templates drive the quote, not hard-coded junk fields.</strong> Pricing templates now carry user-defined line items (label + price). The quote builder fills from those, so a cleaning business sees "Standard clean / Deep clean", not "1/4 load".</li>
    <li><strong>Trade-appropriate starter categories.</strong> New templates seed sensible defaults per business type; junk-removal users keep their familiar load-tier editor unchanged.</li>
    <li><strong>Backward compatible.</strong> Existing junk-removal templates and quotes work exactly as before — the legacy fields are still honored when no custom items are set.</li>
  </ul>

  <h2>Phased plan (next)</h2>
  <table>
    <tr><th>Phase</th><th>Scope</th></tr>
    <tr><td><span class="status done">Done</span></td><td>Trade-agnostic templates + business type setting (this update)</td></tr>
    <tr><td><span class="status plan">Next</span></td><td>Per-industry field sets &amp; units (e.g. sq ft, # rooms, yard size)</td></tr>
    <tr><td><span class="status plan">Next</span></td><td>Industry-aware AI pricing in <code>suggest_quote_price</code> using each trade's job history</td></tr>
  </table>

  <p class="caption" style="margin-top:14px;">Net effect: a lawn-care or cleaning operator can now build a quote that reflects how they actually price, today — and the foundation is in place to make AI pricing genuinely vertical-aware next.</p>

  <div class="foot"><span>dyia — Your Day, Decoded</span><span>Roadmap Response · 6 / 6</span></div>
</section>

</body>
</html>`

fs.writeFileSync(path.join(dir, 'report.html'), html)
console.log('report.html written:', html.length, 'bytes')
