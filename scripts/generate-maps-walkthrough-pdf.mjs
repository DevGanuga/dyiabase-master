/**
 * Generate the Dyia Maps feature walkthrough PDF from prod screenshots.
 *   node scripts/generate-maps-walkthrough-pdf.mjs
 * Output: claudedocs/maps-walkthrough/Dyia_Maps_Walkthrough.pdf
 */

import puppeteer from 'puppeteer'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIR = join(__dirname, '..', 'claudedocs', 'maps-walkthrough')
const ASSETS = join(DIR, 'assets')
const OUT_FILE = join(DIR, 'Dyia_Maps_Walkthrough.pdf')

const img = (name) => pathToFileURL(join(ASSETS, name)).href

const css = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #1e293b; font-size: 11.5px; line-height: 1.6; margin: 0; }
  .cover { background: linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #7c2d12 130%); color: #fff; border-radius: 14px; padding: 48px 44px 42px; margin-bottom: 26px; }
  .cover .brand { display: inline-block; background: linear-gradient(90deg, #f97316, #f59e0b); color: #fff; font-weight: 800; letter-spacing: .12em; font-size: 10px; padding: 4px 12px; border-radius: 999px; text-transform: uppercase; }
  .cover h1 { font-size: 30px; margin: 16px 0 6px; color: #fff; letter-spacing: -0.5px; }
  .cover p { color: #cbd5e1; font-size: 13px; max-width: 560px; margin: 4px 0 0; }
  .cover .meta { margin-top: 22px; color: #94a3b8; font-size: 10px; }
  h2 { font-size: 16px; margin: 30px 0 6px; color: #0f172a; letter-spacing: -0.2px; }
  h2 .num { color: #f97316; margin-right: 8px; }
  .rule { height: 3px; width: 56px; background: linear-gradient(90deg, #f97316, #f59e0b); border-radius: 2px; margin: 0 0 12px; }
  p { margin: 6px 0; }
  .shot { width: 100%; border-radius: 10px; border: 1px solid #e2e8f0; box-shadow: 0 4px 18px rgba(15, 23, 42, .10); margin: 10px 0 4px; }
  .shot.narrow { width: 44%; display: block; margin-left: auto; margin-right: auto; }
  .caption { color: #64748b; font-size: 9.5px; text-align: center; margin: 4px 0 0; font-style: italic; }
  .tip { border-left: 4px solid #f97316; background: #fff7ed; border-radius: 0 8px 8px 0; padding: 9px 14px; margin: 12px 0; font-size: 10.5px; }
  .tip b { color: #c2410c; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10.5px; }
  th { background: #0f172a; color: #fff; text-align: left; padding: 7px 10px; }
  th:first-child { border-radius: 6px 0 0 0; } th:last-child { border-radius: 0 6px 0 0; }
  td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  .dot { display: inline-block; width: 9px; height: 9px; border-radius: 99px; margin-right: 6px; vertical-align: baseline; }
  .check { color: #16a34a; font-weight: 700; } .dash { color: #cbd5e1; }
  .toc { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 20px; margin: 0 0 8px; }
  .toc ol { margin: 4px 0; padding-left: 20px; column-count: 2; column-gap: 36px; }
  .toc li { margin: 3px 0; color: #334155; }
  .pagebreak { page-break-before: always; }
  ul, ol { margin: 6px 0; padding-left: 20px; } li { margin: 3px 0; }
  .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 9px; }
  code { background: #f1f5f9; border-radius: 3px; padding: 0 4px; font-size: 10px; }
`

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>

<div class="cover">
  <span class="brand">Dyia &nbsp;·&nbsp; Feature Walkthrough</span>
  <h1>Dyia Maps</h1>
  <p>Every scheduled job, estimate, and completed visit — dropped onto a live map of your service area. Plan the day geographically, jump from pin to job, and open a ready-made route in Google Maps.</p>
  <p class="meta">Captured live from production (dyia.io) in Demo Mode · June 11, 2026</p>
</div>

<div class="toc">
  <b>In this walkthrough</b>
  <ol>
    <li>Opening Maps</li>
    <li>Reading the map: pin colors</li>
    <li>The pin detail panel</li>
    <li>Estimates on the map</li>
    <li>Date ranges &amp; filters (Pro)</li>
    <li>One-tap route planning (Pro)</li>
    <li>Getting there from Calendar &amp; Jobs</li>
    <li>Maps on your phone</li>
    <li>How pins get on the map</li>
    <li>Plan availability</li>
  </ol>
</div>

<h2><span class="num">1</span>Opening Maps</h2>
<div class="rule"></div>
<p>Maps lives in the sidebar under <b>Work</b>, right next to Calendar. Open it and you're looking at today's workload on a map of your service area — the view auto-fits to your pins. The header shows how many jobs are mapped for the selected range.</p>
<img class="shot" src="${img('maps-01-overview.png')}" />
<p class="caption">The Maps tab: today's jobs pinned around the service area, filters up top, and the one-tap route button.</p>

<h2><span class="num">2</span>Reading the map: pin colors</h2>
<div class="rule"></div>
<p>Every pin is color-coded by what it is, and <b>today's pins pulse</b> so the current day's work stands out at a glance. The legend sits on the map itself:</p>
<table>
  <tr><th>Pin</th><th>Meaning</th></tr>
  <tr><td><span class="dot" style="background:#3b82f6"></span><b>Blue</b></td><td>Scheduled job</td></tr>
  <tr><td><span class="dot" style="background:#f97316"></span><b>Orange</b></td><td>Estimate or free estimate visit</td></tr>
  <tr><td><span class="dot" style="background:#22c55e"></span><b>Green</b></td><td>Completed job (within the selected date range)</td></tr>
  <tr><td><span class="dot" style="background:#94a3b8"></span><b>Gray</b></td><td>Cancelled</td></tr>
</table>
<img class="shot" src="${img('maps-02-map-legend.png')}" />
<p class="caption">The on-map legend. Dense days cluster automatically — zoom in and clusters split apart.</p>

<div class="pagebreak"></div>

<h2><span class="num">3</span>The pin detail panel</h2>
<div class="rule"></div>
<p>Click any pin and the panel slides in with everything needed to act on that stop: customer, status, date, time window, revenue or estimate, address, and notes — plus three actions:</p>
<ul>
  <li><b>Open in Jobs</b> — jump straight to the job to edit or complete it</li>
  <li><b>Directions</b> — opens Google Maps navigation to that address</li>
  <li><b>Call</b> — dials the customer (when a phone number is on file)</li>
</ul>
<img class="shot" src="${img('maps-03-pin-detail.png')}" />
<p class="caption">Johnson Family selected: 8:00–10:00am window, address, notes, and one-tap actions.</p>

<h2><span class="num">4</span>Estimates on the map</h2>
<div class="rule"></div>
<p>Estimate visits get orange pins and show their <b>quoted range</b> instead of revenue — so you can see at a glance which stops are billable work and which are sales calls.</p>
<img class="shot" src="${img('maps-04-estimate-detail.png')}" />
<p class="caption">An estimate stop: 11:00am window with a $350–$450 quoted range.</p>

<div class="pagebreak"></div>

<h2><span class="num">5</span>Date ranges &amp; filters <span style="font-size:10px; background:#f97316; color:#fff; border-radius:99px; padding:2px 8px; vertical-align:middle;">PRO</span></h2>
<div class="rule"></div>
<p>Everyone sees <b>Today</b>. Pro unlocks <b>This Week</b> and <b>Custom</b> date ranges — pull a whole week onto the map to plan ahead, including completed work (green) for context. The <b>Jobs</b> / <b>Estimates</b> chips toggle each type on or off instantly.</p>
<img class="shot" src="${img('maps-05-week-view.png')}" />
<p class="caption">This Week view: scheduled (blue), estimates (orange), and the week's completed jobs (green) together.</p>

<h2><span class="num">6</span>One-tap route planning <span style="font-size:10px; background:#f97316; color:#fff; border-radius:99px; padding:2px 8px; vertical-align:middle;">PRO</span></h2>
<div class="rule"></div>
<p><b>Open route in Google Maps</b> (top-right) builds a multi-stop route from every mapped pin in the current view, <b>ordered by appointment time</b>, and opens it directly in Google Maps — ready to navigate. No copying addresses, no re-typing stops.</p>
<div class="tip"><b>Tip:</b> set time windows on your jobs (e.g. "8:00–10:00am") and the route follows your schedule automatically. Stops without a time go to the end.</div>

<h2><span class="num">7</span>Getting there from Calendar &amp; Jobs</h2>
<div class="rule"></div>
<p>Maps is wired into the rest of Dyia — anywhere you see an address, you're one tap from the pin:</p>
<ul>
  <li><b>Calendar</b> — expanding a job in the day panel shows a <b>Map</b> link beside the address; it opens Maps with that exact pin pre-selected.</li>
  <li><b>Jobs</b> — every job card with an address has a pin button in its action row.</li>
  <li><b>Home</b> — the "Your Day" card links straight to today's map.</li>
</ul>
<img class="shot" src="${img('maps-06-calendar-link.png')}" />
<p class="caption">Calendar day panel: the orange "Map" link next to the address jumps to that pin.</p>
<img class="shot" src="${img('maps-07-jobs-link.png')}" />
<p class="caption">Jobs list: the pin icon on each card opens that job on the map.</p>
<img class="shot" src="${img('maps-08-dashboard-link.png')}" />
<p class="caption">Home dashboard: "Your Day" links to Map and Calendar side by side.</p>

<div class="pagebreak"></div>

<h2><span class="num">8</span>Maps on your phone</h2>
<div class="rule"></div>
<p>On mobile the map goes edge-to-edge and the pin details slide up as a <b>bottom sheet</b> — built for checking the next stop from the truck. Directions and Call are thumb-reach buttons.</p>
<img class="shot narrow" src="${img('maps-09-mobile-sheet.png')}" />
<p class="caption">Mobile: tap a pin and the bottom sheet shows the stop with one-tap Directions and Call.</p>

<h2><span class="num">9</span>How pins get on the map</h2>
<div class="rule"></div>
<p>No extra work required — Maps runs on data you already enter:</p>
<ul>
  <li>The <b>Job Address</b> field is now Google-powered. Start typing and pick the real address; Dyia silently saves the exact coordinates with the job.</li>
  <li>Older jobs that were typed in free-form get located automatically the first time you open Maps.</li>
  <li>No address on a job? It simply doesn't pin — the map tells you how many jobs in the range still need one.</li>
</ul>
<div class="tip"><b>Best practice:</b> always pick the address from the dropdown suggestions when logging a job. You'll see a small "Pinned for Maps" confirmation — that job is now instantly mappable forever.</div>

<h2><span class="num">10</span>Plan availability</h2>
<div class="rule"></div>
<table>
  <tr><th>Capability</th><th>Basic</th><th>Trial</th><th>Pro</th></tr>
  <tr><td>Today's jobs on the map, pins &amp; detail panel</td><td class="check">✓</td><td class="check">✓</td><td class="check">✓</td></tr>
  <tr><td>Directions &amp; Call from any pin</td><td class="check">✓</td><td class="check">✓</td><td class="check">✓</td></tr>
  <tr><td>This Week &amp; Custom date ranges</td><td class="dash">—</td><td class="check">✓</td><td class="check">✓</td></tr>
  <tr><td>Multi-stop "Open route in Google Maps"</td><td class="dash">—</td><td class="check">✓</td><td class="check">✓</td></tr>
  <tr><td>Ask Dyia: "what's my route for Friday?"</td><td class="dash">—</td><td class="check">✓</td><td class="check">✓</td></tr>
</table>
<p>The map itself is available on every plan — route planning across days is where Pro earns its keep.</p>

<div class="footer">Dyia Maps walkthrough · screenshots captured live from production (dyia.io, Demo Mode) on June 11, 2026 · Demo data shown — no customer information. Questions: dyia.io.app@gmail.com</div>

</body></html>`

const browser = await puppeteer.launch()
const page = await browser.newPage()
await page.setContent(html, { waitUntil: 'networkidle0' })
await page.pdf({
  path: OUT_FILE,
  format: 'A4',
  margin: { top: '13mm', right: '12mm', bottom: '13mm', left: '12mm' },
  printBackground: true,
})
await browser.close()
console.log(`PDF written: ${OUT_FILE}`)
