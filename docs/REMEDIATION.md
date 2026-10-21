# Audit remediation — 20 October 2026

The implementation addresses all 28 findings from [the original audit](../artifacts/audit/AUDIT-2026-10-20.md). This is a source-code and local-verification status, not a certification of an uninspected live deployment.

| Finding | Implemented response | Evidence |
| --- | --- | --- |
| F01 — Unauthenticated API | Owner session checks on all ledger/AI handlers, strict cookies, same-origin mutations, login cooldown | Server and browser authorization tests |
| F02 — Transfer contract mismatch | Canonical validated principal/fee contract, explicit legacy alias mapping | Transfer, round-trip, and browser entry tests |
| F03 — Deleted records return | Versioned complete snapshots include deletions atomically | Server history/deletion round trip |
| F04 — Partial sync and false success | PostgreSQL transaction plus advisory lock; explicit file provider; errors never fall back; truthful status | Real disposable PostgreSQL transaction/conflict test and file outage tests |
| F05 — Unsafe startup/demo/conflicts | No automatic samples; isolated demo with retained personal workspace; pending edits preserved; single editing tab; reviewed conflict resolution | Sync and browser concurrency tests |
| F06 — Incomplete persistence | Entire validated version-2 ledger stores rates, settings, categories, transfers, months, allocations, and reconciliations together | Snapshot/restore tests; additive migration |
| F07 — Currency/account mismatches | Account-currency input and validation, immutable account currency with activity, category/type validation | Invalid currency/reference tests; browser activity save |
| F08 — Dhaka dates | Explicit calendar date/month helpers; no UTC extraction from local month boundaries | Boundary and six-month series tests |
| F09 — Missing transfers/fees | Both principal legs visible in unified ledger/account history; fees derived once; correction/deletion available | Transfer conservation, fee, CSV, browser tests |
| F10 — Mixed budget months | Explicit month selection; descendant rollup; nested totals counted once; unassigned legacy months need an owner decision | Budget isolation tests and browser route checks |
| F11 — Unfunded goal counters | Linked account reservations, funding checks, releases, unverified legacy labels, explicit emergency-reserve designation | Reservation and overfunding tests |
| F12 — Invented runway/health | Up to three complete expense months; no score/runway with missing history; earmarked purchase money excluded | Missing-history and baseline tests |
| F13 — Inconsistent recurring math | Shared cycle normalization and shared income baseline/targets across pages and local engines | Annual/weekly normalization tests |
| F14 — AI minor/major units | Explicit minor-unit API contract and conversion at the prompt boundary; validated responses; no disguised fallback | Request schema tests; explicit-action UI |
| F15 — Duplicate/drifting renewals | Atomic payment/period identity, explicit anchor day, month-end recurrence, weekly support, sorted upcoming bills | Duplicate period and recurrence tests |
| F16 — Unstable/mislabeled reports | Saved reporting FX rates, original currencies, weighted after-fee forward conversion rate, actual report ranges | Historical FX stability and CSV tests |
| F17 — Name-based buckets | Configurable category groups and personal targets; deficits remain negative | Shared report/insight calculations |
| F18 — Missing modals | Shared portal dialog, focus entry/trap/return, Escape, background inert state, visible scrolling | Browser dialog entry/Escape tests |
| F19 — Mobile overflow | Responsive dashboard grids, smaller phone gutters, wrapping controls, bounded cards/tables | Ten pages × three viewport widths |
| F20 — Poor readability | Warm image default, translucent glass cards, graded shading for legible text and controls | Screenshots and automated accessibility checks |
| F21 — False privacy claims | Accurate copy, browser-only default, owner-only server access, explicit AI allow switch/consent/action | No-upload/no-AI browser startup test |
| F22 — Stale page after pull | Observable ledger version subscriptions and reactive derived views | Browser/cloud updates use the same store event path |
| F23 — Silent storage failure | Atomic local write, propagated failures, forms remain open, recovery for invalid data | Quota failure and failed-import tests |
| F24 — No restore/unsafe CSV | Previewed validated restore, pre-restore recovery copy, complete JSON, escaped and formula-safe CSV | Restore and CSV tests |
| F25 — Reset/demo promises | Empty reset without reseed; isolated deterministic demo; cloud reset uses revision-checked save and retains history | Demo isolation tests; no destructive DELETE endpoint |
| F26 — Invalid account history | Archive accounts; block deleting referenced accounts; reject currency reinterpretation; statement comparison history | Account immutability and reconciliation tests |
| F27 — Accessibility/feedback | Dialog primitive, labeled forms, larger touch controls, keyboard preset/check controls, announced errors/status | Browser interactions plus automated WCAG AA scans |
| F28 — Hydration errors | Consistent browser-data hydration gate; removed broad warning/error suppression | Production browser run records zero page runtime errors |

Strict TypeScript, ESLint, reproducible unit/browser tests, Node 24 LTS configuration, additive migration tooling, and CI are included. Dependency overrides replace the vulnerable development esbuild dependency; the full dependency audit reports zero known advisories at verification time.

## Local verification results

Verified on 20 October 2026 using Node 24.22.0 and synthetic records:

- Production Next.js build, ESLint, and strict TypeScript: passed.
- Unit/server/sync suite: 33 passed, zero failed; the PostgreSQL test was skipped without its dedicated test URL.
- The remaining PostgreSQL integration test: passed separately against a real disposable local database, including additive migration, competing writes, retained history, and invalid-snapshot rejection. The database was stopped and removed afterward.
- Browser suite: all 10 tests passed using the installed Chromium browser. Coverage includes ten pages at 1440, 768, and 390 pixels; entry and transfer forms; funded goals; restore; editing-tab protection; authentication/origin checks; stale revisions; and mounted-page refresh after a server pull.
- Automated axe checks: no detected WCAG 2 A/AA or WCAG 2.1 AA violations on the ten pages and expanded appearance controls.
- Full dependency audit: zero known vulnerabilities. `git diff --check` passed.
- Dashboard data and charts now appear immediately rather than waiting through entrance animations. Updated desktop and phone screenshots were reviewed locally.

The GitHub Actions workflow is included; its hosted execution has not been observed from this workspace.

Follow-up: corrected a tab-lock race during development effect restarts. Lock requests now queue, cleanup aborts pending requests and releases acquired locks, and a waiting tab resumes automatically after the active tab closes. The browser regression test passed against both the Strict Mode development server and the production build, including reload and two-tab handoff. Development browser tests can be run with `EMBER_E2E_DEV=true`; they use a separate `.next-e2e` output directory so an existing local dev server can stay running.

Compatibility follow-up: existing records marked done with future dates no longer block startup, import, or unrelated edits. Snapshot validation preserves their dates and statuses. New or newly future-dated postings are checked at the mutation boundary; a visible review notice explains that pre-existing future postings do not affect balances, spending, budgets, giving totals, or settled transfer reports before their dates. A regression test covers both legacy browser keys and version-2 snapshots without rewriting the source records. The updated unit/server/sync run passed 34 tests with the dedicated PostgreSQL test skipped; the development browser regression passed with the review notice, original records, ledger visibility, and automated accessibility checks.

The future-posting browser regression also passed against the production build, and the updated production layout sweep passed all ten pages at three viewport widths. The 30-navigation layout test has a scoped two-minute budget to accommodate machines also running a development server.

Owner-requested fresh start: the configured PostgreSQL database was cleared after a complete reset rehearsal against a disposable database. Verification found zero rows in all legacy financial/configuration tables and ledger history, with one empty canonical snapshot. The old local vault was removed and the existing development log cleared. A one-time browser reset generation was configured and verified on the running localhost server; existing browser financial/recovery/demo copies clear on their next reload. Tests confirmed that new entries survive subsequent reloads. The updated unit/server/sync suite passed 35 tests with the dedicated PostgreSQL test skipped; the separate real PostgreSQL erasure rehearsal and development browser reset/handoff tests passed.

## What is intentionally not claimed

- No live Neon credentials/data, migrations, deployment settings, or bank statements were exercised. The PostgreSQL integration check used a disposable local database.
- Deployment-level HTTPS, distributed rate limiting, secret configuration, provider backup/PITR retention and recovery, and production migration still need the steps in [PRODUCTION.md](PRODUCTION.md).
- Historical facts that were never stored cannot be reconstructed automatically. Legacy budget months, lost category parents, incorrect currency entries, and historical bank FX rates require original records or a more complete backup.
- Browser-only storage and archives are not application-encrypted. Privacy wording states this explicitly.
- External AI remains off by default. A real provider response and account-specific availability are not part of the local test run.
- Automated accessibility scans do not replace manual assistive-technology and real-device testing.
- No NSave or bank API integration, automatic religious calculation, bank transfer execution, or tax-filing service is implied.

## Reviewable deliverables

- [Deployment/migration/recovery guide](PRODUCTION.md)
- [Unit and integration tests](../tests)
- [Browser tests](../tests/browser/workspace.spec.ts)
- [CI workflow](../.github/workflows/ci.yml)
- [Additive database migration](../drizzle/0001_versioned_ledger.sql)
- [Migration/export/bootstrap tool](../scripts/migrate-ledger.ts)

The original audit screenshots remain historical evidence. New verification screenshots, when generated, are under the ignored `artifacts/verification` directory to keep synthetic test outputs separate from source.

Visual follow-up: restored the original warm TudSa image as the default and brought the dashboard cards back to translucent glass. The overall overlay is lighter, while the title and currency controls have local shading for readable text. Production build, desktop/phone layout checks, and automated WCAG AA scans passed after the visual change.

## Readiness review — 21 October 2026

Reviewed the current workspace without resetting financial records, migrating the configured database, or discarding the existing visual changes.

Additional issues corrected:

- Cloud conflict detection now preserves settings-only changes and deletion of the last account. A delayed pull cannot reconnect a paused browser workspace or replace a newer acknowledged save. A missing/older server snapshot requires review instead of silently replacing the local ledger.
- Mounted financial views refresh on changes to the Dhaka calendar date, including tab focus/visibility and an active-tab 30-second check. The coach's personal plan audit now recalculates when the ledger changes.
- Opening browser records is no longer held indefinitely by a stalled session endpoint. Authentication requests and conflict-copy reads have timeouts; a failed sign-out remains an error rather than claiming success.
- A missing USD/BDT reference rate is explicitly labeled provisional and prompts the owner to configure it before entering activity. Actual transfers and saved historical reporting rates remain independent of today's estimate.
- Added `npm run check:production`, with an optional read-only `--check-storage` probe. It reports missing deployment configuration without printing secrets or changing records. Generated the missing local owner password and independent session secret in ignored `.env`; the database URL and reset generation were preserved.

Verification using Node 24:

- Production build, TypeScript, and ESLint passed.
- Unit/server/sync suite: 39 passed, zero failed; one PostgreSQL write-integration case skipped because no disposable test database was supplied. The configured real database was only read, never used as a write-test target.
- All 16 browser cases passed across the full run and focused reruns. Coverage includes ten pages at desktop/tablet/phone widths, finance forms, restore, tab handoff, API authorization/conflicts, mounted cloud updates, month rollover, live coach updates, a hung session service, and failed sign-out.
- Automated WCAG A/AA scans passed on the ten pages and the expanded appearance controls. The expanded-controls scan is scoped to the opened section; offscreen page headers over the fixed background image are checked separately at the top of the page. Automated contrast analysis cannot certify HONK's multicolor glyph rendering or replace manual accessibility review.
- Dependency audit: zero reported advisories.
- The real configured database snapshot validated on read. One subsequent probe failed and a retry succeeded; the underlying transient connectivity cause was not established. Reliable hosting connectivity and provider recovery still need deployment verification.

Production configuration is not yet complete: no host/canonical HTTPS origin has been selected. Provider backup/PITR restore, deployment rate limits, HTTPS/cookie checks on the final domain, and the disposable PostgreSQL write test remain release gates. External AI/provider availability and bank integrations are not certified. See [PRODUCTION.md](PRODUCTION.md) for the preflight command and initial data-entry workflow.

First-connection follow-up: a read-only inspection confirmed the reset database held an untouched default ledger at revision 1. This initial snapshot now accepts a first-time browser upload using the normal revision-checked save, rather than reporting a false conflict. Customized server settings, later empty revisions, previously connected workspaces, and competing writes still require conflict review. All nine sync regression cases, TypeScript, and targeted ESLint passed. No server financial records were changed by the inspection.

## Private owner access for the deployed workspace

All finance routes now require owner sign-in. Next.js Proxy redirects anonymous, forged, expired, and unconfigured sessions to `/login`; the database and AI APIs retain their own server authorization checks. Runtime configuration requires a 16-character owner password and an independent 32-character session secret. The login page provides password visibility controls, error feedback, and a restricted return destination. There is no public registration.

The workspace verifies the session before loading cached financial records, rechecks on focus and periodically, and closes at the 12-hour expiry or an API authorization failure. A failed initial verification keeps cached records and recovery tools hidden. After sign-in, server sync connects automatically through the existing revision and conflict safeguards. Sign-out pauses uploads and returns to login while preserving pending edits and recovery copies. Browser-only entry controls were removed from Settings; compatibility protections for earlier demo workspaces remain.

Verification uses synthetic browser records and a temporary file vault. No configured production database writes, data reset, credential rotation, or reset-generation changes were performed. The final hosting origin, distributed rate limiting, provider backup recovery, and disposable PostgreSQL integration check remain deployment requirements as described in PRODUCTION.md.

Validation with Node 24: production build, TypeScript, and ESLint passed. The unit/server/sync suite passed 48 tests with the disposable PostgreSQL integration case skipped. All 24 browser cases passed across the full run and focused reruns, including eight authentication cases (anonymous access, incorrect/correct password, automatic vault connection, sign-out, pending-edit preservation, focus revalidation, timed expiry, unavailable verification, and accessible login layouts). Ten finance pages were checked at desktop/tablet/mobile widths and with automated WCAG A/AA scans. Older browser fixtures were updated for mandatory sign-in and automatic cloud loading; fixtures that edit local snapshots now wait for the initial server read. Login screenshots are retained in `artifacts/verification/screenshots/login-390.png` and `login-1440.png`. These local checks do not certify the final deployment or manual accessibility.

New-device startup follow-up: sign-in previously selected cloud mode but mounted the workspace before the server ledger finished loading, so a fresh browser briefly appeared empty and relied on a later Settings pull. Startup now awaits the versioned server read before rendering finance pages. A failed read shows retry instead of an empty workspace; an existing cached copy can be opened explicitly with a visible storage warning. Conflicting offline edits remain intact and show a review notice. This change did not reset records or alter credentials. The Node 24 production build, TypeScript, targeted ESLint, nine sync cases, and all 27 browser cases passed using synthetic records and a temporary file vault.

Immediate background sync follow-up: local edits now queue server uploads on the next event loop turn instead of waiting for a 1.2-second debounce. Edits made while an upload is active are sent after it completes; pending changes retry on network reconnection or browser focus. The manual Settings action is labeled as a retry. Local save and server acknowledgement remain distinct. Per owner request, no tests or build checks were run for this follow-up.
