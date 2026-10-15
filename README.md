# Pushup

Every rep counts. A mobile-first, offline push-up journal built with React, TypeScript, Vite, Tailwind CSS, Recharts, and Dexie. Install it on Android, track locally, or sign in to sync privately between your devices through Dexie Cloud.

## Run locally

Requires Node.js **24 LTS** (minimum 22.12) and npm. No API keys or environment secrets are needed.

```sh
npm ci
VITE_CLOUD_ENABLED=false npm run dev
```

Open the URL printed by Vite. Development mode does not register a service worker. To test offline behavior, use the production preview:

In PowerShell, set `$env:VITE_CLOUD_ENABLED = 'false'` before `npm run dev` for local-only development. Cloud access requires an origin approved in your Dexie Cloud database. The deployed app uses the configured production database; local test runs disable cloud access and never touch production workouts.

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
- **Account:** sign in with an approved email and a one-time email code. Use the same email on your PC and Android phone. Saved sessions, past sessions, edits and deletions sync automatically while the app is open and online. The account banner shows pending, syncing, synced, offline, or error status. Offline saves commit locally first and sync when you reopen the app online. The app pulls again on reconnect or resume and retries interrupted live connections every 30 seconds while visible. Initial sign-in requires a connection.
- **Friends:** opt in to sharing your history with the other approved accounts. Choose a display name and recipients, then use **Share and invite**. Each friend accepts in their own Friends view. View shared daily, weekly and monthly charts, totals, streaks, personal records, calendar heatmap and dated sessions. **This week together** compares your effort without combining anyone’s personal totals. Friend histories have no editing or deletion controls.

The unsaved counter remains intact when switching views. Refreshing the page discards unsaved reps; save before refreshing or closing. The app update prompt disables updating while reps are unsaved.

## Calendar rules

All grouping uses the device’s current local timezone. Changing timezone reinterprets saved timestamps in that timezone. Days run from local midnight to the next local midnight. Weeks start Monday, including weeks spanning two calendar years; chart details use ISO week numbers and week years. Months follow the local calendar. Day arithmetic uses calendar dates and handles daylight-saving changes and leap years.

The current streak ends today when today has activity, or yesterday when today has none. It becomes zero after a full missed day. Multiple sessions in one day count as one active day. The longest streak counts consecutive active calendar days in the complete history. Tied best days show the most recent day. Daily charts show seven days; weekly and monthly charts show twelve periods, including the current partial period. The heatmap shows at least the last 365 days, aligned to a Monday.

## Accounts, cost and existing history

This deployment uses the Dexie Cloud **Free** plan. No paid subscription, payment card, paid trial, or automatic upgrade is configured. The [current free plan](https://dexie.org/pricing) includes three permanent production seats, 100 MB total storage, and ten simultaneous connections. Two approved email addresses have production seats; the third is unused. These are permanent free seats, not 30-day evaluation accounts. Capacity limits must be handled by staying within the free tier; do not purchase additional seats or storage.

In [Dexie Cloud Manager](https://manager.dexie.cloud), this database’s **Policy for new users** is **Reject all unknown users**. Only explicitly provisioned users can authenticate. This is enforced by the server, not a public JavaScript email list. Do not enable evaluation accounts, domain-based registration, demo users, automatic seat assignment, or billing. To add a third person, add only their exact email as a production user in the manager. Keep this list at three or fewer and keep unknown-user rejection enabled. Administrative access can change this configuration; the browser application cannot create accounts or upgrade the plan.

Accounts have separate private histories. A device’s original local history is preserved in `pushup-tracker`. After first sign-in, open **Settings → Copy device history to this account** to copy it explicitly. The operation is safe to repeat: existing account sessions, newer account edits, and previously deleted sessions are retained. Nothing uploads automatically from the old device journal. Sign out returns to that device journal. Export a backup before changing accounts on a shared device. Signing in or out is disabled while the counter has unsaved reps. Signing out requires an online successful sync; the app never offers to discard pending changes.

### Sharing progress with friends

Sharing starts **off**. In Friends, **Share my progress** opens a review of who will see your complete saved history and future sessions. **Share and invite** creates a read-only invitation through Dexie Cloud; the recipient can accept or decline in Friends. This may also send Dexie’s invitation email. Receiving a friend’s invitation does not share your own history back. Each person opts in separately. Sharing is included in the existing free plan and does not create any new accounts or paid subscriptions.

If a share attempted in version 1.2.0 still shows “Your workouts are private,” update both devices to 1.2.1 and share again. That version sent an empty membership deletion for a new realm, which the server rejected and rolled back. Version 1.2.1 removes that invalid command and checks the sharing state after sync before showing success. The recipient then chooses **Accept invitation** in Friends. Updating does not require clearing browser data or reinstalling.

Shared sessions remain owned by their creator. The app moves active sessions into a private sharing realm and grants the selected friends no write permissions. Dexie Cloud enforces this access on the server. Your personal tracker, statistics, history, and backups continue to include only your own sessions. Changes and new sessions become visible to accepted friends after syncing. Deleted sessions move back to the owner’s private realm as deletion markers, so friends lose access to them and old backups cannot restore them accidentally. Sessions deleted before sharing are never shared.

**Stop sharing my workouts** revokes invitations and memberships and returns your sessions to your private realm. Keep the app online until the change has synced. Friends already offline can retain an earlier cached view until they reconnect; previously viewed or saved copies cannot be recalled. Sharing again creates new invitations. Current clients reconcile the sharing preference after sync so sessions from an older or previously offline device follow the selected sharing state.

The approved friends directory lives in the private `rlm-pushup-friend-directory` realm with read-only memberships for the approved accounts. It contains only names and account identifiers, never workouts, and is not publicly readable. Account emails are not bundled into the app source. For a new deployment, use the database administrator’s REST API or `dexie-cloud import` to provision this directory: `friendDirectory` uses primary key `id`, each entry’s `id` is the exact approved email, and its `name` is the default display name. Set directory entry ownership to `null` and grant approved users accepted directory memberships with empty permissions. Add a directory entry and membership when manually approving the third free account; registration remains closed. Application tables `sharingPreferences` (private owner preference) and the SDK’s `realms`, `members`, and `roles` are included in schema version 2. Never use `rlm-public` for this directory or workout sharing.

The new account database has a separate IndexedDB name and is managed by the Dexie Cloud SDK. Each cloud record has explicit private owner/realm fields and an account-scoped key, so even the same backup UUID can exist safely in two accounts. Deletions leave a private marker so an old backup or offline copy cannot resurrect a removed session. Concurrent edits to the same field follow the SDK’s server-ordered conflict resolution; a deleted session stays deleted when another device edits its rep count. The original UUID, workout timestamp and reps remain unchanged in backups.

The database URL is public configuration, not a credential. Set `VITE_DEXIE_CLOUD_URL` to use another database; GitHub Actions passes the repository variable of that name to the production build. For another deployment, create a free database with `npx dexie-cloud create`, whitelist only your app’s HTTPS origin with `npx dexie-cloud whitelist https://YOUR_USERNAME.github.io`, close registration in the manager, and provision up to three production users. Never commit `dexie-cloud.key`, any `*.key`, or administrative tokens. These files are ignored, and admin credentials are never bundled into the app or sent to GitHub Actions. Keep the locally generated key safe; it grants database administration.

## Local data and backups

There is no analytics or advertising. Signed-out workouts live only in the browser’s IndexedDB database `pushup-tracker`, schema version 1, with UUID primary keys and an indexed timestamp. A session contains only `id`, `createdAt` (Unix milliseconds), and `reps`. When signed in, the app uploads account workouts to Dexie Cloud over HTTPS and retains an offline copy on this device. Cloud records are private to their account until the owner chooses to share with approved friends, under server-enforced access rules. This is not end-to-end encryption; the cloud provider and database administrator can access stored data. Sign-in tokens and friends’ workouts are never included in JSON exports.

Data survives refreshes, browser restarts, and app updates. Local copies are tied to the browser profile and origin. Clearing site data, uninstalling with data removal, private browsing, or browser storage eviction can remove local data, including changes that have not synced. Export regular backups and before changing device, domain, or browser. “Request storage protection” asks the browser to reduce automatic eviction. To sync a new device, sign in with the same approved email. Keep JSON backups independently of cloud sync.

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

Imports **merge**, never replace. Identical IDs and contents are skipped, including repeats inside a file. Account imports also skip previously deleted IDs. If an active session with the same ID has different reps or a different timestamp, the entire import fails atomically with an explanation; existing data stays intact. Export a fresh backup from the device containing the version you want to keep rather than overwriting an edited session with an older backup.

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

Unit and integration tests cover statistics, local calendar and DST boundaries, leap days, ISO week years, session creation and mutations, save failure recovery, import validation, duplicate handling, transaction atomicity, database reopen persistence, private account filtering, account changes during writes, migration deduplication, deletion markers, credential-free backups, sync status, email normalization, invalid-code retries, and safe logout. Tests run in the Europe/Bucharest timezone to exercise non-UTC local dates. CI browser tests run in local-only mode and never use live accounts or administrative keys.

Friends tests cover explicit sharing review, invitation acceptance, read-only progress, recipient validation, duplicate taps, account changes, stopping and restarting sharing, deleted-history privacy, reconciliation of older-device writes, and preserving personal backups. Browser checks include Friends navigation, narrow layouts, accessibility, and retaining the unsaved counter. Before deploying the first sharing release, live checks verified read-only server permissions, private directory access, revocation, and the signed-in review screen for both approved accounts; disposable permission records were removed without reading or changing workouts or sending invitations.

The first-share regression test uses the real Dexie Cloud addon and inspects its outgoing mutation log to prevent empty membership deletions. It fails with the original 1.2.0 implementation. UI tests also simulate a server rollback to ensure it reports an error and keeps the share available for retry. The fix was verified against the live service using disposable realm metadata with invitations disabled; no workout records were changed.

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

App updates are offered with an explicit Update action. Save any current reps first. Saved IndexedDB sessions are retained across updates. Sign in with the same email to sync history, or export/import JSON to transfer it manually.

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
