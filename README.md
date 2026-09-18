# One Drop — A Drop of Life

A production-ready, installable blood donor community website. Search verified
donors by blood group and distance, post emergency blood requests that alert
the whole network, and moderate everything from a small dashboard.

**Idea & initiative:** Students of Notre Dame College, Batch 27 — Group 11
**Developed by:** [Foysal Mahmud](https://foysalcyber.github.io/)

---

## Stack

| Layer | Choice |
| --- | --- |
| Front-end | Plain HTML + CSS + ES modules. No framework, no build step, no trackers. |
| Auth | Firebase Authentication — anonymous sessions (no email, no password) |
| Database | Cloud Firestore, real-time listeners |
| Hosting | GitHub Pages (any static host works) |
| Offline / install | Service worker + web app manifest (PWA) |

The app degrades gracefully: if Firebase cannot be reached it keeps working
from a local cache, and a first-time visitor sees a clearly-marked demo
dataset instead of an empty page.

---

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Hero, live emergency board, statistics, blood-group quick picker, compatibility tool, how-it-works |
| `donors.html` | Donor directory: search, blood-group chips, district filter, availability toggle, sort by newest / nearest / group / name |
| `register.html` | Donor registration + profile editing, live validation, optional GPS, consent |
| `emergency.html` | Post an emergency request, live board with countdowns, share, matching donors |
| `my-donor.html` | Donor self-service: edit, pause, log a donation, remove listing |
| `about.html` | Mission, compatibility matrix, credits |
| `faq.html` | Donation eligibility + product FAQ (FAQPage schema) |
| `privacy.html` | Privacy policy, terms, contact form |
| `admin.html` | Moderator dashboard (email + password sign-in) |
| `offline.html` | Offline fallback served by the service worker |

---

## Setup (about 10 minutes)

### 1. Firebase console

Project: `blood-donate-ndc`

1. **Authentication → Sign-in method → Anonymous → Enable.**
2. **Firestore Database → Create database** (start in *production mode*).
3. **Firestore → Rules** → paste the contents of [`firestore.rules`](firestore.rules) → **Publish**.
   Without this step every read returns *Missing or insufficient permissions*
   and the site silently falls back to local demo data.

### 2. Moderator access (email + password)

1. In the Firebase console open **Authentication → Sign-in method** and enable **Email/Password**.
2. Open **Authentication → Users → Add user** and create the moderator account
   (email + a strong password). Only accounts created here can moderate.
3. Publish [`firestore.rules`](firestore.rules) — it grants moderator writes to
   Email/Password accounts only (the app itself can never register one).
4. Open the deployed `admin.html` and sign in with that email and password.
   The session stays signed in on the device; use **Sign out** when done.

### 3. Deploy to GitHub Pages

The site is configured for **https://onedropndc.github.io** (repo `onedropndc.github.io`).

```bash
git init && git add -A && git commit -m "One Drop v1.0"
git branch -M main
git remote add origin https://github.com/onedropndc/onedropndc.github.io.git
git push -u origin main
```

Then **Settings → Pages → Source: GitHub Actions**. The workflow in
`.github/workflows/deploy.yml` publishes on every push to `main`.
(`.gitignore` keeps `node_modules/` out of the repo; the `tests/` folder is
harmless on Pages.)

---

## Collections

| Collection | Written by | Notes |
| --- | --- | --- |
| `donors` | any signed-in user, own record only | `uid` ties a listing to its anonymous session |
| `requests` | any signed-in user | `status`: `active` / `fulfilled` / `cancelled` / `expired` |
| `announcements` | moderators | shown as a banner on the home page |
| `messages` | visitors (contact form) | read in the admin inbox |
| `analytics` | everyone (1 write/visitor/day) | daily counters: `visits`, `requests_posted`, `donations_registered` |
| `audit` | moderators | optional trail for moderation actions |

---

## Privacy model

- Donor phone numbers are **never rendered** in the directory markup.
- A requester must click *Show contact*; each browser is limited to
  **25 reveals per hour**.
- Coordinates are optional. The public UI shows only an approximate distance;
  without GPS the district centroid is used.
- No third-party analytics, no ads, no cookies.
- Donors can edit or delete their own listing from `my-donor.html`.

---

## Local development

```bash
npm start          # http://localhost:8080
```

A service worker is registered, so hard-reload (or bump the `VERSION`
constant in `service-worker.js`) after changing cached assets.

## Tests

```bash
npm install
npx playwright@latest install chromium
npm test
```

`npm test` runs both suites (51 + 19 checks) against a local server with all
Google hosts blocked, so nothing touches the live project. Details in
[`tests/README.md`](tests/README.md).

---

## Optional: real push notifications

The app already shows in-app + browser alerts while it is open. To get alerts
when it is closed:

1. Firebase console → **Project settings → Cloud Messaging → Web Push certificates → Generate key pair**.
2. Paste the public key into `VAPID_KEY` in `assets/js/config.js`.
3. `admin.html` → Overview → **Subscribe to push** copies an FCM token.

---

## Roadmap ideas

- Phone OTP verification for donor numbers (`firebase-auth` `signInWithPhoneNumber`).
- Blood-group-specific push topics so O− donors only get O− alerts.
- Donation camp calendar with reminders.
- Bangla language toggle.

---

## Licence

Free to use and adapt for non-commercial, voluntary blood-donation work.
Please keep the credits in the footer and on the About page.
