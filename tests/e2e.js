/* =============================================================
   One Drop — end-to-end smoke test (headless Chromium)
   Run:  node tests/e2e.js        (from the project root)
   Requires: playwright-core + a Chromium build (see tests/README.md).

   All Firebase / Google hosts are blocked, so the test exercises the
   offline + local-cache path deterministically and never writes to the
   real Firestore project.
   ============================================================= */
const { chromium } = require('playwright-core');
const path = require('path');
const { serve, chromiumPath, Reporter } = require('./serve');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT || 8123);
const r = new Reporter();
const check = (n, c, d) => r.check(n, c, d);

(async () => {
  const exe = chromiumPath();
  if (!exe) { console.error('No Chromium found. See tests/README.md'); process.exit(2); }

  const server = await serve(ROOT, PORT);
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    permissions: ['geolocation', 'notifications'],
    geolocation: { latitude: 23.7806, longitude: 90.4066 } // Banani, Dhaka
  });
  await context.route('**://*.googleapis.com/**', (x) => x.abort());
  await context.route('**://*.firebaseapp.com/**', (x) => x.abort());
  await context.route('**://*.gstatic.com/**', (x) => x.abort());

  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(e.message));
  const base = `http://127.0.0.1:${PORT}`;

  /* ------------------------------------------------- home */
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  check('home: header brand rendered', /One ?Drop/.test(await page.locator('.site-header .brand-text strong').textContent()));
  const credits = await page.locator('.footer-credits').textContent();
  check('home: footer credits Foysal Mahmud', credits.includes('Foysal Mahmud'));
  check('home: footer credits Group 11', credits.includes('Group 11'));
  check('home: emergency CTA in bottom bar', await page.locator('.bottom-bar .bb-urgent').count() === 1);
  check('home: 4 stat cards', await page.locator('#statsHost .stat-card').count() === 4);
  check('home: donor total counted from seed',
    Number(await page.locator('#statsHost .stat-card .stat-value').first().textContent()) >= 20,
    await page.locator('#statsHost .stat-card .stat-value').first().textContent());
  check('home: 8 blood-group bars', await page.locator('#statsHost .bar-row').count() === 8);
  check('home: emergency feed populated', await page.locator('#homeRequests .req-card').count() >= 1);
  check('home: compatibility widget rendered', await page.locator('#compatHost #compatSelect').count() === 1);
  check('home: scroll progress bar mounted', await page.locator('#scrollProgress').count() === 1);
  check('home: ambient drops mounted', await page.locator('.float-drops i').count() === 7);

  /* eligibility checker */
  await page.locator('#eligibility').scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  check('home: eligibility widget rendered', await page.locator('#eligibilityHost #eligGroup').count() === 1);
  await page.locator('#eligDate').fill('2026-08-01');
  await page.locator('#eligBtn').click();
  await page.waitForTimeout(300);
  const eligNum = (await page.locator('#eligNum').textContent()).trim();
  check('home: eligibility shows cooling-off days', /^\d+$/.test(eligNum) && Number(eligNum) > 0 && Number(eligNum) <= 56, eligNum);
  await page.locator('#eligDate').fill('2026-01-01');
  await page.locator('#eligBtn').click();
  await page.waitForTimeout(300);
  check('home: eligible after full gap', (await page.locator('#eligNum').textContent()).trim() === 'GO');

  const sel = page.locator('#compatHost #compatSelect');
  await sel.selectOption('AB+'); await page.waitForTimeout(200);
  check('home: AB+ receives from all 8 groups', await page.locator('#compatHost .chip-static.yes').count() === 8);
  await sel.selectOption('O-'); await page.waitForTimeout(200);
  check('home: O- receives only from O-', await page.locator('#compatHost .chip-static.yes').count() === 1);

  /* ---------------------------------------------- donors */
  await page.goto(`${base}/donors.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.donor-card:not(.skeleton)', { timeout: 8000 });
  check('donors: cards rendered', await page.locator('.donor-card').count() > 10);
  check('donors: phone numbers never in the DOM', !(await page.locator('#donorGrid').textContent()).includes('0171'));

  await page.locator('[data-group-chip="O-"]').click();
  await page.waitForTimeout(400);
  const groups = await page.locator('.donor-card .badge-blood').allTextContents();
  check('donors: group filter narrows to O-', groups.length > 0 && groups.every((g) => g.trim() === 'O-'),
    `cards=${groups.length}`);

  await page.locator('[data-group-chip="ALL"]').click();
  await page.waitForTimeout(300);
  await page.locator('#donorSearch').fill('mirpur');
  await page.waitForTimeout(500);
  check('donors: text search works', (await page.locator('#donorGrid').textContent()).toLowerCase().includes('mirpur'),
    await page.locator('#resultCount').textContent());
  await page.locator('#donorSearch').fill('');
  await page.waitForTimeout(400);
  check('donors: clearing search restores the list', await page.locator('.donor-card').count() > 10);

  await page.locator('#sortBy').selectOption('nearest');
  await page.waitForTimeout(1000);
  const dist = await page.locator('.tag-dist').allTextContents();
  const km = dist.map((t) => (/m away/.test(t) && !/km/.test(t)) ? parseFloat(t.replace(/[^\d.]/g, '')) / 1000 : parseFloat(t.replace(/[^\d.]/g, '')));
  check('donors: distances shown after geolocation', dist.length > 3 && /away/.test(dist[0]), `first=${dist[0]} n=${dist.length}`);
  check('donors: sorted by distance ascending', km.every((n, i) => i === 0 || n >= km[i - 1] - 0.001), JSON.stringify(km.slice(0, 6)));

  await page.locator('.donor-card [data-act="reveal"]').first().click();
  await page.waitForSelector('.reveal-num');
  const revealed = (await page.locator('.reveal-num').textContent()).trim();
  check('donors: reveal shows a formatted number', /^\+880 1\d{3}-\d{3}-\d{3}$/.test(revealed), revealed);
  await page.locator('.modal [data-ok]').click();

  await page.locator('.donor-card [data-act="share"]').first().click();
  await page.waitForSelector('.share-row');
  check('donors: share sheet offers channels', await page.locator('.share-row').count() >= 3);
  await page.locator('.modal [data-ok]').click();

  /* -------------------------------------------- register */
  await page.goto(`${base}/register.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.locator('#f-name').fill('Test Automation');
  await page.locator('#f-phone').fill('01999');
  await page.locator('#f-phone').blur();
  await page.waitForTimeout(200);
  check('register: invalid phone rejected',
    await page.locator('#f-phone').evaluate((el) => el.closest('.field').classList.contains('is-invalid')));

  await page.locator('#f-phone').fill('01712345678');
  await page.locator('#f-phone').blur();
  await page.locator('#f-blood').selectOption('O-');
  await page.locator('#f-district').selectOption('Dhaka');
  await page.locator('#f-area').fill('Banani');
  await page.locator('#f-age').fill('21');
  await page.locator('#f-last').fill('2026-08-01');
  await page.locator('#f-note').fill('Automation test donor.');
  await page.waitForTimeout(200);
  check('register: badge preview appears', await page.locator('#badgePreview .badge-blood').count() === 1);

  await page.locator('#donorForm button[type="submit"]').click();
  await page.waitForTimeout(400);
  check('register: consent is required', await page.locator('#successPanel').isHidden());
  await page.locator('[name="consent"]').check();
  await page.locator('#btnUseLocation').click();
  await page.waitForTimeout(700);
  check('register: geolocation captured', await page.locator('.loc-ok').count() === 1);
  await page.locator('#donorForm button[type="submit"]').click();
  await page.waitForSelector('#successPanel .success-inner', { timeout: 8000 });
  check('register: success panel shown', (await page.locator('#successPanel').textContent()).includes('Test Automation'));

  const cached = await page.evaluate(() => JSON.parse(localStorage.getItem('lifeline:cache:donors') || '[]'));
  const mine = cached.find((d) => d.name === 'Test Automation');
  check('register: donor persisted with normalised phone',
    !!mine && mine.phone === '+8801712345678' && mine.bloodGroup === 'O-',
    JSON.stringify(mine && { phone: mine.phone, bg: mine.bloodGroup, lat: mine.lat }));
  check('register: last donation stored', !!mine && String(mine.lastDonation).startsWith('2026-08-01'));

  /* ------------------------------------------- emergency */
  await page.goto(`${base}/emergency.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.req-card', { timeout: 8000 });
  check('emergency: seeded requests listed', await page.locator('#requestFeed .req-card').count() >= 3);
  check('emergency: countdown is running', /\d/.test(await page.locator('.req-count').first().textContent()));

  await page.locator('#requestFeed .req-card [data-act="contact"]').first().click();
  await page.waitForTimeout(700);
  check('emergency: offer dialog shows attendant contact',
    (await page.locator('.offer-attendant [data-rev]').count()) === 1);
  await page.locator('.offer-attendant [data-rev]').click();
  await page.waitForTimeout(500);
  check('emergency: attendant number revealed with call + whatsapp',
    (await page.locator('.modal .reveal-num').count()) >= 1 &&
    (await page.locator('.modal a[href^="tel:"]').count()) >= 1);
  await page.locator('.modal [data-ok]').last().click(); // close reveal dialog
  await page.waitForTimeout(300);
  await page.locator('.modal [data-ok]').last().click(); // close offer dialog
  await page.waitForTimeout(400);

  const activeBefore = await page.locator('#requestFeed .req-card:not(.is-closed)').count();
  await page.locator('#requestFeed .req-card:not(.is-closed) [data-act="done"]').first().click();
  await page.waitForTimeout(400);
  await page.locator('.modal [data-ok]').first().click(); // confirm fulfilled
  await page.waitForTimeout(900);
  const activeAfter = await page.locator('#requestFeed .req-card:not(.is-closed)').count();
  check('emergency: fulfilled request leaves the active list', activeAfter === activeBefore - 1,
    `before=${activeBefore} after=${activeAfter}`);
  check('emergency: fulfilled request listed under closed',
    /Closed/.test(await page.locator('.closed-wrap summary').textContent()));

  await page.locator('#r-patient').fill('E2E Patient (40)');
  await page.locator('#r-group').selectOption('B-');
  await page.locator('#r-units').fill('2');
  await page.locator('#r-hospital').fill('Test General Hospital');
  await page.locator('#r-district').selectOption('Dhaka');
  await page.locator('#r-contact').fill('E2E Attendant');
  await page.locator('#r-phone').fill('01812345678');
  await page.locator('#r-note').fill('Automation request.');
  await page.locator('#requestForm button[type="submit"]').click();
  await page.waitForTimeout(900);
  const reqs = await page.evaluate(() => JSON.parse(localStorage.getItem('lifeline:cache:requests') || '[]'));
  const nr = reqs.find((x) => x.patient === 'E2E Patient (40)');
  check('emergency: request saved correctly',
    !!nr && nr.bloodGroup === 'B-' && nr.units === 2 && nr.phone === '+8801812345678' && !!nr.neededBy,
    JSON.stringify(nr && { bg: nr.bloodGroup, u: nr.units, p: nr.phone }));
  check('emergency: share dialog offered', await page.locator('.modal-card').count() >= 1);
  await page.locator('.modal [data-ok]').click(); // "Share on WhatsApp" → opens the share sheet
  await page.waitForTimeout(400);
  check('emergency: share sheet includes poster option', await page.locator('.modal [data-share="poster"]').count() === 1);
  check('emergency: share sheet offers channels', await page.locator('.modal [data-share="whatsapp"]').count() === 1);
  if (await page.locator('.modal-card').count()) await page.locator('.modal [data-ok]').click();
  await page.waitForTimeout(600);
  check('emergency: new request on the live board', (await page.locator('#requestFeed').textContent()).includes('E2E Patient'));

  /* -------------------------------------------- my donor */
  await page.goto(`${base}/my-donor.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.my-card', { timeout: 8000 });
  check('my-donor: profile found on this device', (await page.locator('.my-card').textContent()).includes('Test Automation'));
  await page.locator('#btnLogDonation').click();
  await page.locator('.modal [data-ok]').click();
  await page.waitForTimeout(1400);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('lifeline:cache:donors') || '[]'))
    .then((rows) => rows.find((d) => d.name === 'Test Automation'));
  check('my-donor: donation logged and listing paused', after.available === false && after.donations >= 1,
    JSON.stringify({ available: after.available, donations: after.donations }));

  /* ----------------------------------------------- admin */
  await page.goto(`${base}/admin.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  check('admin: gate shown when identity unavailable', await page.locator('#adminGate').isVisible());
  check('admin: dashboard stays hidden', !(await page.locator('#adminPanel').isVisible()));

  /* ------------------------------------------ other pages */
  for (const p of ['about.html', 'faq.html', 'privacy.html', 'offline.html']) {
    await page.goto(`${base}/${p}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);
    check(`${p}: renders with footer`, await page.locator('.site-footer').count() === 1);
  }
  await page.goto(`${base}/about.html`, { waitUntil: 'networkidle' });
  check('about: compatibility table has 8 rows', await page.locator('#compatTable tr').count() === 8);

  /* ------------------------------------------ contact form */
  await page.goto(`${base}/privacy.html`, { waitUntil: 'networkidle' });
  await page.locator('#c-name').fill('Tester');
  await page.locator('#c-contact').fill('01700000000');
  await page.locator('#c-subject').fill('E2E subject');
  await page.locator('#c-message').fill('Automated message body.');
  await page.locator('#contactForm button[type="submit"]').click();
  await page.waitForTimeout(700);
  const msgs = await page.evaluate(() => JSON.parse(localStorage.getItem('lifeline:cache:messages') || '[]'));
  check('privacy: contact message stored', msgs.some((m) => m.subject === 'E2E subject'));

  /* ---------------------------------------------- PWA bits */
  const manifest = await page.goto(`${base}/manifest.webmanifest`);
  const body = JSON.parse(await manifest.text());
  check('manifest: valid with icons', body.name.includes('One Drop') && body.icons.length >= 3 && body.display === 'standalone');
  const sw = await page.goto(`${base}/service-worker.js`);
  check('service worker: served as javascript', (sw.headers()['content-type'] || '').includes('javascript'));

  /* ------------------------------------------ mobile layout */
  const mob = await context.newPage();
  await mob.setViewportSize({ width: 390, height: 844 });
  for (const p of ['index.html', 'donors.html', 'register.html', 'emergency.html']) {
    await mob.goto(`${base}/${p}`, { waitUntil: 'networkidle' });
    if (p === 'donors.html') await mob.waitForSelector('.donor-card:not(.skeleton)', { timeout: 8000 });
    await mob.waitForTimeout(500);
    const over = await mob.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`mobile 390px: no horizontal overflow on ${p}`, over <= 1, `overflow=${over}px`);
  }
  check('mobile: bottom bar visible', await mob.locator('.bottom-bar').isVisible());

  /* ----------------------------------------- console health */
  const ignore = /googleapis|firebaseapp|gstatic|net::ERR|Failed to fetch|favicon/i;
  const real = consoleErrors.filter((e) => !ignore.test(e));
  check('no unexpected console errors', real.length === 0, real.slice(0, 5).join(' | '));
  check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 5).join(' | '));

  const fails = r.done('e2e');
  await browser.close();
  server.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST HARNESS ERROR', e); process.exit(2); });
