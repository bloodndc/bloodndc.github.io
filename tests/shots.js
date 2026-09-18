/* Capture full-page screenshots of every page at desktop + mobile widths. */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const { chromiumPath } = require('/home/user/blood-donate-ndc/tests/serve');

const BASE = 'http://127.0.0.1:8080';
const OUT = '/home/user/shots';
fs.mkdirSync(OUT, { recursive: true });

const PAGES = ['index.html', 'donors.html', 'register.html', 'emergency.html', 'about.html', 'faq.html', 'privacy.html', 'admin.html', 'my-donor.html'];

(async () => {
  const exe = chromiumPath();
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-dev-shm-usage'] });

  for (const [label, vp] of [['desktop', { width: 1366, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    await ctx.route('**://*.googleapis.com/**', (r) => r.abort());
    await ctx.route('**://*.firebaseapp.com/**', (r) => r.abort());
    await ctx.route('**://*.gstatic.com/**', (r) => r.abort());
    const page = await ctx.newPage();
    for (const p of PAGES) {
      await page.goto(`${BASE}/${p}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      const name = p.replace('.html', '');
      await page.screenshot({ path: `${OUT}/${label}-${name}-top.png` });
      await page.screenshot({ path: `${OUT}/${label}-${name}-full.png`, fullPage: true });
    }
    await ctx.close();
  }
  await browser.close();
  console.log('shots written to', OUT);
})();
