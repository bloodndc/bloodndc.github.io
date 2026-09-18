# Test harness

Two headless-Chromium suites. They serve the project over a local HTTP
server, drive the real pages, and assert on real DOM + real localStorage.

Nothing is written to the live Firestore project: every request to
`*.googleapis.com`, `*.firebaseapp.com` and `*.gstatic.com` is aborted, so
the app runs in its offline / local-cache path.

## One-time setup

```bash
npm install                                  # playwright-core
npx playwright@latest install chromium       # browser binary
```

On a minimal Linux image the browser also needs system libraries:

```bash
sudo apt-get install -y libnss3 libnspr4 libatk1.0-0t64 libatk-bridge2.0-0t64 \
  libatspi2.0-0t64 libcups2t64 libxdamage1 libxkbcommon0 libasound2t64 \
  libxcomposite1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2
```

## Run

```bash
npm test            # both suites
npm run test:smoke  # tests/e2e.js       — 51 checks
npm run test:admin  # tests/admin.e2e.js — 19 checks
```

Set `CHROME_BIN=/path/to/chrome` to use a specific browser binary, or
`PORT=9000` if 8123/8129 are busy.

## What is covered

| Area | Checks |
| --- | --- |
| Home | shell + credits, stat counters, per-group bars, live request feed, compatibility widget (AB+ → 8 groups, O− → 1) |
| Donors | card render, phone masking, group filter, text search, reset, geolocation distance sort (ascending), click-to-reveal format, share sheet |
| Register | invalid phone rejection, badge preview, consent gate, GPS capture, success panel, normalised phone persisted, last-donation stored |
| Emergency | seeded list, countdown timer, request save (group/units/normalised phone/deadline), share dialog, live board update |
| My donor | profile found, donation logged → listing paused |
| Admin | gate blocks anonymous/offline, data layer CRUD, verify/fulfil/announcement actions, dashboard renders for an allow-listed UID, tables, announcement publish → appears on home, message inbox |
| Static | manifest JSON, service worker MIME |
| Responsive | no horizontal overflow at 390 px on 4 pages |
| Health | no unexpected console errors, no uncaught page errors |
