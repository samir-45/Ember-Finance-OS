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
| F20 — Poor readability | Quiet default background, dark scrim, opaque surfaces, stronger text contrast, legible primary controls | Screenshots and automated accessibility checks |
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
