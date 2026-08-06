/**
 * Render the customer refund emails to a clean PDF for Marco.
 *   node scripts/generate-refund-emails-pdf.mjs
 * Output: claudedocs/billing-tier-fix/customer-refund-emails.pdf
 */
import puppeteer from 'puppeteer'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { writeFileSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIR = join(__dirname, '..', 'claudedocs', 'billing-tier-fix')
const OUT = join(DIR, 'customer-refund-emails.pdf')

const emails = [
  {
    to: 'Brayan Carranza — brayancarranza02@gmail.com', refund: '$30',
    subject: 'You were right — refund on the way',
    body: `Hi Brayan,

First off, I owe you an apology. When you flagged the billing problem, we asked you for proof of a double charge and basically put it back on you — that was the wrong call, and I'm sorry for the runaround.

I dug into it properly and you were right. You were on our Basic plan but the system was charging you the Pro rate ($29.99 instead of $19.99). That's a mistake on our end, not yours.

Here's what I'm doing about it: I'm refunding you $30 for the overcharge, and I've already fixed your plan so you're paying the correct $19.99 going forward. The refund should land back on your card within 5–10 business days.

Thanks for your patience with this, and sorry again for the hassle. If anything still looks off, just reply here and it comes straight to me.

Marco
dyia`,
  },
  {
    to: 'Gerardo — gp6981@yahoo.com', refund: '$20 (already refunded $10)',
    subject: 'The rest of your refund',
    body: `Hi Gerardo,

Following up on the billing issue you reported. You were on Basic but getting charged the Pro rate ($29.99 instead of $19.99), which was our mistake.

I sent back $10 already, and I've now refunded the remaining $20 for the other months you were overcharged. I also corrected your plan so it bills the right $19.99 from here on out. The refund should show up on your card within 5–10 business days.

Really appreciate you flagging it — it helped us catch the same problem for a few other people. Anything else looks wrong, just reply and I'll sort it.

Marco
dyia`,
  },
  {
    to: 'Katelynn Delaney — katelynndelaney57@gmail.com', refund: '$10',
    subject: 'We overcharged you — refund on the way',
    body: `Hi Katelynn,

Quick heads up and an apology. We found a billing mistake on our side: you were on the Basic plan but got charged the Pro rate ($29.99 instead of $19.99) for a month.

I've refunded you the $10 difference and fixed your plan so it charges the correct $19.99 going forward. The refund should be back on your card within 5–10 business days.

Sorry for the mix-up — that one's on us. If you spot anything else, just reply here.

Marco
dyia`,
  },
  {
    to: 'Blank template (any other affected customer)', refund: '$[amount]',
    subject: 'We overcharged you — refund on the way',
    body: `Hi [First name],

I want to flag a billing mistake on our end and make it right. You were on the Basic plan but were charged the Pro rate ($29.99 instead of $19.99)[ for [N] months].

I've refunded you $[amount] and corrected your plan so it bills the right $19.99 going forward. The refund should be back on your card within 5–10 business days.

Sorry for the trouble — that one's on us. Reply here if anything still looks off and it comes straight to me.

Marco
dyia`,
  },
]

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const css = `
  * { box-sizing: border-box; }
  body { margin: 0; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 12px; line-height: 1.6; }
  .head { padding: 26px 30px; background: linear-gradient(135deg,#0f172a,#7c2d12); color: #fff; border-radius: 12px; margin-bottom: 22px; }
  .head h1 { margin: 0 0 4px; font-size: 22px; letter-spacing: -.3px; }
  .head p { margin: 0; color: #cbd5e1; font-size: 11px; }
  .email { border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; page-break-inside: avoid; box-shadow: 0 2px 10px rgba(15,23,42,.05); }
  .to { font-size: 11px; font-weight: 700; color: #c2410c; text-transform: uppercase; letter-spacing: .05em; }
  .refund { float: right; font-size: 10px; font-weight: 700; color: #166534; background: #dcfce7; padding: 2px 9px; border-radius: 999px; }
  .subject { font-size: 14px; font-weight: 700; color: #0f172a; margin: 8px 0 10px; padding-bottom: 8px; border-bottom: 1px solid #eef2f6; }
  .subject span { color: #64748b; font-weight: 600; font-size: 11px; }
  .body { white-space: pre-wrap; color: #334155; }
`

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
  <div class="head">
    <h1>Customer Refund Emails</h1>
    <p>Copy-ready messages for the Basic-billed-as-Pro overcharges. Refunds via Stripe (5–10 business days). Send from the dyia support address.</p>
  </div>
  ${emails.map((e) => `
    <div class="email">
      <span class="refund">Refund: ${esc(e.refund)}</span>
      <div class="to">${esc(e.to)}</div>
      <div class="subject"><span>Subject:</span> ${esc(e.subject)}</div>
      <div class="body">${esc(e.body)}</div>
    </div>`).join('')}
</body></html>`

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] })
try {
  const page = await browser.newPage()
  writeFileSync(join(DIR, 'customer-refund-emails.rendered.html'), html)
  await page.setContent(html, { waitUntil: 'load' })
  await page.pdf({ path: OUT, format: 'A4', printBackground: true, margin: { top: '14mm', right: '14mm', bottom: '14mm', left: '14mm' } })
  await page.close()
  console.log('PDF written:', OUT)
} finally {
  await browser.close()
}
