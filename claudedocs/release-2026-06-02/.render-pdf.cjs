#!/usr/bin/env node
/**
 * Renders guide.html to Dyia_Release_Guide_2026-06-02.pdf using the Chromium
 * that ships with puppeteer. One-shot script; not part of the build.
 *   node claudedocs/release-2026-06-02/.render-pdf.cjs
 */
const path = require('node:path');
const puppeteer = require('puppeteer');

(async () => {
  const dir = __dirname;
  const htmlPath = path.join(dir, 'guide.html');
  const outPath = path.join(dir, 'Dyia_Release_Guide_2026-06-02.pdf');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files'],
  });
  try {
    const page = await browser.newPage();
    await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('print');
    await page.pdf({
      path: outPath,
      width: '8.5in',
      height: '11in',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    console.log('PDF written:', outPath);
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
