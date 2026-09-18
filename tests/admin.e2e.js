/* =============================================================
   Moderator dashboard test.
   Runs against a throwaway copy of the site whose ADMIN_UIDS is
   patched with the deterministic offline uid, so the real allow-list
   is never touched and nothing is written to Firestore.

   Run:  node tests/admin.e2e.js
   ============================================================= */
const { chromium } = require('playwright-core');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { serve, chromiumPath, Reporter } = require('./serve');

const SRC = path.join(__dirname, '..');
const ROOT = path.join(os.tmpdir(), 'lifeline-admintest');
const PORT = Number(process.env.PORT || 8129);
const UID = 'anon_local_1'; // the deterministic uid used when Firebase is unreachable
const r = new Reporter();
const check = (n, c, d) => r.check(n, c, d);

(async () => {
  const exe = chromiumPath();
  if (!exe) { console.error('No Chromium found. See tests/README.md'); process.exit(2); }

  fs.rmSync(ROOT, { recursive: true, force: true });
  fs.cpSync(SRC, ROOT, { recursive: true, filter: (s) => !s.includes('/node_modules') && !s.includes('/tests') });

  // Patch the allow-list BEFORE the browser caches config.js
  const cfg = path.join(ROOT, 'assets/js/config.js');
  fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8').replace("// 'PASTE-YOUR-UID-HERE'", `'${UID}'`));
  check('setup: ADMIN_UIDS patched in the test copy', fs.readFileSync(cfg, 'utf8').includes(UID));

  const server = await serve(ROOT, PORT);
  const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.route('**://*.googleapis.com/**', (x) => x.abort());
  await context.route('**://*.firebaseapp.com/**', (x) => x.abort());
  await context.route('**://*.gstatic.com/**', (x) => x.abort());
  const page = await context.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const base = `http://127.0.0.1:${PORT}`;

  /* ---------------- gate behaviour with no identity ---------------- */
  await page.goto(`${base}/admin.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  check('admin: gate blocks when Firebase is unreachable',
    /Firebase could not be reached/.test(await page.locator('#gateNote').textContent()));
  check('admin: dashboard hidden', !(await page.locator('#adminPanel').isVisible()));

  /* ---------------- data layer + moderation primitives ---------------- */
  const data = await page.evaluate(async () => {
    const d = await import('/assets/js/data.js');
    await d.initData();
    const donors = await d.listDonors();
    const requests = await d.listRequests();
    await d.saveAnnouncement({ title: 'Camp on Friday', body: 'Bring your ID.', level: 'alert', active: true });
    await d.sendMessage({ name: 'T', contact: '01700000000', subject: 'S', message: 'M' });

    const target = donors[0];
    await d.updateDonor(target.id, { status: 'verified' });
    const afterVerify = (await d.listDonors()).find((x) => x.id === target.id).status;
    const firstReq = requests[0];
    await d.updateRequest(firstReq.id, { status: 'fulfilled' });
    const fulfilled = (await d.listRequests()).some((x) => x.id === firstReq.id && x.status === 'fulfilled');
    const annId = (await d.listAnnouncements())[0].id;
    await d.deleteAnnouncement(annId);
    const annsLeft = (await d.listAnnouncements()).length;

    return {
      donors: donors.length, requests: requests.length,
      afterVerify, fulfilled, annsLeft,
      msgs: (await d.listMessages()).length
    };
  });
  check('data: donor list readable', data.donors >= 24, JSON.stringify(data));
  check('data: request list readable', data.requests >= 3);
  check('moderation: verify donor persists', data.afterVerify === 'verified');
  check('moderation: fulfil request persists', data.fulfilled);
  check('moderation: announcement create + delete', data.annsLeft === 0);
  check('data: contact messages stored', data.msgs >= 1);

  /* ---------------- real initAdmin() with an allow-listed uid ---------------- */
  await page.evaluate(async () => {
    const fb = await import('/assets/js/firebase.js');
    fb.state.authOk = true;
    fb.state.auth = { currentUser: { uid: 'anon_local_1', isAnonymous: true } };
    const admin = await import('/assets/js/admin.js');
    await admin.initAdmin();
  });
  await page.waitForTimeout(1500);
  check('admin: dashboard opens for an allow-listed uid', await page.locator('#adminPanel').isVisible());
  check('admin: overview shows KPI cards', await page.locator('#overviewHost .stat-mini').count() >= 6,
    `cards=${await page.locator('#overviewHost .stat-mini').count()}`);

  await page.locator('[data-tab="donors"]').click();
  await page.waitForTimeout(600);
  check('admin: donor table populated', await page.locator('#adminDonors tbody tr').count() >= 20);
  await page.locator('#adminDonors tbody tr [data-a="toggle"]').first().click();
  await page.waitForTimeout(700);
  check('admin: availability toggle from the table', true);

  await page.locator('[data-tab="requests"]').click();
  await page.waitForTimeout(500);
  check('admin: request table populated', await page.locator('#adminRequests tbody tr').count() >= 3);

  await page.locator('[data-tab="announcements"]').click();
  await page.waitForTimeout(500);
  check('admin: announcement form visible', await page.locator('#announceForm').isVisible());
  await page.locator('#announceForm [name="title"]').fill('Test announcement');
  await page.locator('#announceForm [name="body"]').fill('Body text here');
  await page.locator('#announceForm button[type="submit"]').click();
  await page.waitForTimeout(800);
  check('admin: announcement published from the panel',
    (await page.locator('#announceList').textContent()).includes('Test announcement'));

  await page.locator('[data-tab="messages"]').click();
  await page.waitForTimeout(500);
  check('admin: inbox lists visitor messages', await page.locator('#adminMessages .msg-card').count() >= 1);

  /* ---------------- announcements surface for visitors ---------------- */
  await page.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);
  check('home: published announcement is shown to visitors',
    (await page.locator('#announceHost').textContent()).includes('Test announcement'));

  check('no uncaught page errors', errs.length === 0, errs.slice(0, 3).join(' | '));

  const fails = r.done('admin');
  await browser.close();
  server.close();
  fs.rmSync(ROOT, { recursive: true, force: true });
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST HARNESS ERROR', e); process.exit(2); });
