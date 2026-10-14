# Pushup

Every rep counts. A mobile-first, offline push-up journal built with React, TypeScript, Vite, Tailwind CSS, Recharts, and Dexie. Install it on Android and keep your workout history entirely on your device.

## Run locally

Requires Node.js **24 LTS** (minimum 22.12) and npm. No API keys or environment secrets are needed.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Development mode does not register a service worker. To test offline behavior, use the production preview:

```sh
npm run build
npm run preview
```

Visit the preview once online and wait for “Ready to go offline.” Then turn off the network and reload. The app, charts, icons, and saved sessions remain available. Installation requires HTTPS in production; localhost is permitted for development.

## Use the app

- **Track:** add individual reps or use +5, +10, and +20. Save creates one session. Saving is disabled at zero and while persistence is in progress. The counter resets only after IndexedDB commits successfully. A failed save keeps your count for retry.
- **Progress:** today, Monday-start week, calendar month, and all-time totals and session counts; average reps; best session and day; current and longest streaks; daily, weekly, and monthly charts; a rolling year of daily activity. Every chart includes an exact-value data table.
- **History:** sessions grouped by local date, newest first, with rep editing and confirmed deletion. Use **Add session** to log a missed workout with its date, local time, and rep count. The form defaults to yesterday and prevents future or invalid local times. Backdated entries update totals, charts, streaks, and the heatmap immediately, including in other open tabs. Edits preserve the original ID and timestamp.
- **Settings and backups:** JSON export, validated merge import, optional browser storage protection, and installation help.

The unsaved counter remains intact when switching views. Refreshing the page discards unsaved reps; save before refreshing or closing. The app update prompt disables updating while reps are unsaved.

## Calendar rules

All grouping uses the device’s current local timezone. Changing timezone reinterprets saved timestamps in that timezone. Days run from local midnight to the next local midnight. Weeks start Monday, including weeks spanning two calendar years; chart details use ISO week numbers and week years. Months follow the local calendar. Day arithmetic uses calendar dates and handles daylight-saving changes and leap years.

The current streak ends today when today has activity, or yesterday when today has none. It becomes zero after a full missed day. Multiple sessions in one day count as one active day. The longest streak counts consecutive active calendar days in the complete history. Tied best days show the most recent day. Daily charts show seven days; weekly and monthly charts show twelve periods, including the current partial period. The heatmap shows at least the last 365 days, aligned to a Monday.

## Local data and backups

The app makes no account, analytics, advertising, or workout upload requests. Sessions live in the browser’s IndexedDB database `pushup-tracker`, schema version 1, with UUID primary keys and an indexed timestamp. A session contains only `id`, `createdAt` (Unix milliseconds), and `reps`.

Data survives refreshes, browser restarts, and app updates. It is tied to the browser profile and origin. Clearing site data, uninstalling with data removal, private browsing, or browser storage eviction can remove it. Export regular backups and before changing device, domain, or browser. “Request storage protection” asks the browser to reduce automatic eviction; backups remain the reliable way to transfer and recover data. Installing the app on another device does not sync data.

Backup shape:

```json
{
  "app": "pushup-tracker",
  "version": 1,
  "exportedAt": "2026-10-14T12:00:00.000Z",
  "sessions": []
}
```

Import checks the entire file before writing: recognized app and schema version, valid export date, at most 100,000 sessions, a 10 MB file limit, valid UUIDs, integer timestamps from 1970 through 9999, and integer reps from 1 to 1,000,000. Unknown fields are discarded. UUID case is normalized.

Imports **merge**, never replace. Identical IDs and contents are skipped, including repeats inside a file. If the same ID has different reps or a different timestamp, the entire import fails atomically with an explanation; existing data stays intact. Export a fresh backup from the device containing the version you want to keep rather than overwriting an edited session with an older backup.

## Verify

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Or run all four with `npm run check`.

Production browser tests use desktop and Android-sized Chromium viewports, a real IndexedDB database, the built service worker, and a `/Pushups/` project path:

```sh
npx playwright install chromium
npm run test:e2e
```

On Windows the tests use installed Google Chrome. On Linux and CI they use Playwright Chromium. The test runner builds into `.e2e-dist/` and starts and stops its own production server on port 4173; no development server is needed. Tests cover responsive empty states, automated WCAG accessibility checks, the manifest and icons, duplicate taps, reload persistence, history changes, backups, cross-tab updates, and fully offline reloads and navigation. Browser test data is isolated from your normal browser profile. Reports and screenshots are under `playwright-report/` and `test-results/`.

Unit and integration tests cover statistics, local calendar and DST boundaries, leap days, ISO week years, session creation and mutations, save failure recovery, import validation, duplicate handling, transaction atomicity, and database reopen persistence. Tests run in the Europe/Bucharest timezone to exercise non-UTC local dates.

## Create a GitHub repository and deploy

1. Sign in to GitHub and [create a new repository](https://github.com/new), for example `pushup-tracker`. Choose public for GitHub Pages on a free account. Leave README, license, and `.gitignore` initialization unchecked because this project already contains files.
2. From this project directory, run the following, replacing `YOUR_USERNAME` and the repository name:

   ```sh
   git init -b main
   git add .
   git commit -m "Build offline push-up tracker PWA"
   git remote add origin https://github.com/YOUR_USERNAME/pushup-tracker.git
   git push -u origin main
   ```

3. In the repository, open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
4. Open **Actions → Check and deploy Pushup**. If the first run started before Pages was enabled, rerun it after enabling Pages.
5. The deployment job publishes the URL, normally `https://YOUR_USERNAME.github.io/pushup-tracker/`. Each later push to `main` checks, builds, and deploys automatically. Pull requests run the checks without publishing.

The workflow uses GitHub’s built-in token with scoped Pages permissions. No manually created token is needed. It runs lint, TypeScript, unit/integration tests, browser tests, and a final production build before deploying.

### Base paths

`vite.config.ts` automatically derives the project base path from `GITHUB_REPOSITORY` in GitHub Actions. A repository `name/Pushups` produces `/Pushups/`; a `name.github.io` repository produces `/`. This same base is used by the manifest, app icons, service worker scope, and offline navigation fallback. The UI uses in-page views, so there are no deep routes for GitHub Pages to rewrite.

For a local project-path build, set `VITE_BASE_PATH` before running build:

```powershell
$env:VITE_BASE_PATH = '/pushup-tracker/'
npm run build
npm run preview
```

On macOS/Linux:

```sh
VITE_BASE_PATH=/pushup-tracker/ npm run build
VITE_BASE_PATH=/pushup-tracker/ npm run preview
```

For a custom domain, set the repository Actions variable `VITE_BASE_PATH` to `/` and configure the domain in Pages. The workflow passes this optional variable to the final build. Keep deployments on the same origin to preserve access to local sessions.

## Install on Android

1. Open the deployed HTTPS URL in **Chrome** on Android.
2. Wait for the offline-ready notice on the first visit.
3. Tap **Install app** in the header when available, or Chrome’s **⋮ → Add to Home screen → Install**. The browser decides when an installation prompt is available; Settings includes manual instructions.
4. Launch **Pushup** from your home screen. It opens as a standalone app and works offline.

App updates are offered with an explicit Update action. Save any current reps first. Saved IndexedDB sessions are retained across updates. Export/import JSON to move history to another device.

## Source layout

```text
src/domain/        Session rules, calendar math, statistics, backup schema
src/data/          IndexedDB schema and transactional session operations
src/hooks/         Reactive data subscription, local clock, installation
src/components/    Counter, history, charts, heatmap, dialogs, PWA notices
src/test/          Browser API adapters for unit tests
e2e/               Real-browser production and offline tests
public/icons/      Install and maskable PNG icons
.github/workflows/ Quality gates and GitHub Pages deployment
```

Icons are included in the repository. Run `npm run icons` after changing the SVG mark. No external fonts or image services are required.
