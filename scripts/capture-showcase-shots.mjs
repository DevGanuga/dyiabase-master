/**
 * Capture fresh UI screenshots of the dyia platform (demo mode) for the
 * AI SaaS Platform Technical Showcase PDF.
 *
 *   node scripts/capture-showcase-shots.mjs
 *
 * Requires the dev server running (NODE_ENV=development) and DEMO_PASSWORD set,
 * so /api/test/enable-demo can issue the demo bypass cookies. Demo mode loads
 * static demo data only — no real customers, secrets, or tokens.
 *
 * Output: claudedocs/ai-showcase/assets/*.png
 */

import puppeteer from 'puppeteer'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE = process.env.SHOWCASE_BASE_URL || 'http://localhost:3100'
const OUT = join(__dirname, '..', 'claudedocs', 'ai-showcase', 'assets')
mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Desktop product views (rendered inside the /app SPA shell).
const DESKTOP_VIEWS = [
  { name: 'landing', url: '/', wait: 3500 },
  { name: 'dashboard', url: '/app', wait: 4000 },
  { name: 'jobs', url: '/app?view=jobs', wait: 3500 },
  { name: 'quotes', url: '/app?view=quotes', wait: 3500 },
  { name: 'quoteBuilder', url: '/app?view=quoteBuilder', wait: 3500 },
  { name: 'followUps', url: '/app?view=followUps', wait: 3500 },
  { name: 'calendar', url: '/app?view=calendar', wait: 3500 },
  { name: 'customers', url: '/app?view=customers', wait: 3500 },
  { name: 'payments', url: '/app?view=payments', wait: 3500 },
  { name: 'reports', url: '/app?view=reports', wait: 4000 },
  { name: 'marketing', url: '/app?view=marketing', wait: 3500 },
  { name: 'assistant', url: '/app?view=assistant', wait: 4000 },
  { name: 'settings', url: '/app?view=settings', wait: 3500 },
  { name: 'maps', url: '/app?view=maps', wait: 4500 },
  { name: 'intel', url: '/app?view=intel', wait: 3500 },
]

const MOBILE_VIEWS = [
  { name: 'mobile-dashboard', url: '/app', wait: 4000 },
  { name: 'mobile-assistant', url: '/app?view=assistant', wait: 4000 },
  { name: 'mobile-jobs', url: '/app?view=jobs', wait: 3500 },
]

async function enableDemo(page) {
  // Hitting the dev-only endpoint sets the demo bypass + indicator cookies
  // (dyia_demo_access httpOnly for middleware, dyia_demo_active for the client).
  const res = await page.goto(`${BASE}/api/test/enable-demo`, { waitUntil: 'networkidle2' })
  const status = res?.status()
  const body = await page.evaluate(() => document.body.innerText).catch(() => '')
  if (status !== 200) {
    throw new Error(`enable-demo returned ${status}: ${body.slice(0, 200)}`)
  }
  console.log('  demo mode enabled:', body.slice(0, 80))
}

async function capture(page, view, { fullPage = false } = {}) {
  const target = `${BASE}${view.url}`
  try {
    await page.goto(target, { waitUntil: 'networkidle2', timeout: 45000 })
    await sleep(view.wait)
    // Hide the Next.js dev-tools indicator so screenshots look production-clean.
    await page.evaluate(() => {
      if (!document.getElementById('hide-next-devtools')) {
        const s = document.createElement('style')
        s.id = 'hide-next-devtools'
        s.textContent = 'nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none!important}'
        document.head.appendChild(s)
      }
      // Collapse the AI "Loading insight…" placeholder (insight can't fetch in demo,
      // since it requires a Pro/credit-backed model call). Hiding it keeps frames clean.
      for (const el of Array.from(document.querySelectorAll('div'))) {
        if (el.childElementCount === 0 && /^Loading insight/.test((el.textContent || '').trim())) {
          el.style.display = 'none'
        }
      }
    }).catch(() => {})
    // Nudge lazy content / charts into view, then return to top for a clean frame.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {})
    await sleep(600)
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {})
    await sleep(400)
    const path = join(OUT, `${view.name}.png`)
    await page.screenshot({ path, fullPage })
    console.log(`  ✓ ${view.name}.png`)
    return true
  } catch (err) {
    console.warn(`  ✗ ${view.name} failed: ${err.message}`)
    return false
  }
}

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

try {
  // ---- Desktop ----
  const desktop = await browser.newPage()
  await desktop.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
  console.log('Enabling demo mode...')
  await enableDemo(desktop)

  console.log('Capturing desktop views...')
  for (const view of DESKTOP_VIEWS) {
    await capture(desktop, view)
  }
  // A couple of long, full-page captures useful as detail figures.
  await capture(desktop, { name: 'reports-full', url: '/app?view=reports', wait: 4000 }, { fullPage: true })
  await capture(desktop, { name: 'settings-account', url: '/app?view=settings&tab=account', wait: 3500 })
  await desktop.close()

  // ---- Mobile ----
  const mobile = await browser.newPage()
  await mobile.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
  await enableDemo(mobile)
  console.log('Capturing mobile views...')
  for (const view of MOBILE_VIEWS) {
    await capture(mobile, view)
  }
  await mobile.close()
} finally {
  await browser.close()
}

console.log('Done. Screenshots in', OUT)
