const path = require('path')
const puppeteer = require('puppeteer')

;(async () => {
  const htmlPath = path.join(__dirname, 'report.html')
  const out = path.join(__dirname, 'dyia-roadmap-response.pdf')
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0' })
    await page.pdf({
      path: out,
      width: '8.5in',
      height: '11in',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    console.log('PDF written:', out)
  } finally {
    await browser.close()
  }
})().catch((e) => { console.error(e); process.exit(1) })
