# Ember — Personal Finance

A single-owner workspace for USD client earnings, actual BDT conversions, local spending, bills, giving, and funded savings goals.

## Run locally

Use Node 24 LTS (`.nvmrc`), then:

```sh
npm ci
npm run dev
```

Configure the owner credentials and storage described below, then open `http://localhost:3000`. All finance pages require owner sign-in through `/login`. A new workspace starts with empty accounts and standard categories.

## Your daily workflow

Before recording activity, set your USD/BDT reference rate in Settings. The initial estimate is provisional; past entries keep their saved reporting rate.

1. Add NSave in USD and your real bank/wallet/cash accounts in BDT. Enter opening balances for the point where tracking begins.
2. Record a client payment in its account currency. Use planned/pending status until funds settle.
3. Reserve existing money in **Allocations & giving**. A personal income percentage can suggest a reserve; zakat and sadaqah remain separate records.
4. In **Accounts**, record actual transfer principal sent/received and any additional fee. Review the resulting debit/credit before saving. Pending transfers do not alter balances.
5. Enter local expenses in BDT. Record bill renewals once per billing period.
6. Link savings goals to accounts holding their funds. Reservations do not create money or change net worth.
7. Reconcile current account balances against statements and export regular backups.

## Storage and privacy

- The database is the only copy of your records. Nothing financial is stored in the browser; only appearance settings are kept there. JSON exports are readable financial data; application-level encryption is not implemented.
- Anonymous visitors are redirected to `/login` before finance pages render. Missing owner credentials keep access locked.
- Sign-in loads the ledger from the database before opening finance pages, on every device. If the database is unavailable, a retry screen is shown instead of any stale or empty copy. Returning to an open tab reloads the latest records.
- Each change is saved to the database as you make it; changes made during a save are sent right after it. If a save fails, the app reloads what the database holds and says the change was not saved. Leaving the page while a save is in flight asks first.
- Sessions expire after 12 hours. Open pages return to sign-in at expiry or when the server rejects the session. A fresh page requires successful session verification before loading local records.
- Server synchronization requires the owner password and an HTTP-only session cookie. Every ledger and AI handler verifies authorization and request origin.
- A save replaces one complete, validated ledger atomically, using an expected revision. Previous revisions are retained. A change from a tab or device that is behind is rejected, and that tab reloads the saved records.
- PostgreSQL errors do not silently fall back to files. A file vault must be explicitly configured on durable storage.
- AI quick entry is optional and off by default. It needs `GEMINI_API_KEY` on the server and the Settings switch; it then sends only the text you type in Add activity plus your account and category names to Google Gemini, when you press Fill in. All insights and checks are calculated locally without AI.

## Owner access and server configuration

Copy `.env.example` to your environment configuration; retain any existing credentials. Set a unique random `EMBER_OWNER_PASSWORD` of at least 16 characters, an independent random `EMBER_SESSION_SECRET` of at least 32 characters, and the canonical `EMBER_PUBLIC_URL`. Configure these through your hosting provider's secret settings after deployment. There is no public registration or password reset endpoint; change credentials in the environment and restart the app to rotate access.

For PostgreSQL, configure `DATABASE_URL` and apply the additive migration:

```sh
npm run db:migrate
```

The migration creates `ledger_snapshots` and `ledger_history`; it does not rewrite legacy tables. The PostgreSQL driver verifies remote TLS certificates. A local loopback test database can use a non-TLS connection. See [production and migration instructions](docs/PRODUCTION.md) before connecting an existing database.

Alternatively, on a persistent single Node host, configure `EMBER_STORAGE_DRIVER=file` and an absolute `EMBER_VAULT_PATH` on a private durable volume. Do not put it in `public`, on ephemeral function storage, or in a deployment directory that is replaced on release. File revisions use exclusive locks and atomic replacement. File storage is not a fallback for PostgreSQL.

Then sign in at `/login`. The latest server ledger loads before the workspace opens. Existing local and server copies are preserved when they conflict; inspect and download both in Settings before selecting a replacement.

## Recovery

Settings exports a complete versioned JSON ledger and previews and validates imports. Restoring replaces your records in the database; the replaced version stays in the database history. Restoring an archive does not securely erase historical backups.

CSV export includes income, expenses, both transfer legs, fees, original currencies, IDs, status, and reporting rate. Text fields escape quotes and protect against spreadsheet formula interpretation. JSON is the complete recovery format.

## Financial definitions

- **Balance:** opening balance plus settled income, minus settled expenses, plus/minus settled transfer principal and the fee in its actual currency.
- **Future dates:** new future-dated entries must be planned or pending. Existing archives containing future-dated entries marked done still open; their original records are preserved and a review notice is shown. Those entries do not affect balances, budgets, or spending before their dates.
- **Local available to spend:** BDT balances minus funded goal/earmarked reservations and uncovered upcoming bill amounts. It can be negative when accounts are overcommitted.
- **Historical cash flow:** posted reporting rates remain stable when today's portfolio reference rate changes. Transfer principal is excluded; fees appear once in expenses.
- **Runway:** liquid balances after earmarked obligations divided by average expenses over up to three complete calendar months. A complete expense month is required; missing history does not produce an optimistic score.
- **Recurring costs:** yearly ÷ 12, quarterly ÷ 3, weekly × 52 ÷ 12. All local insights use the shared normalization helper.
- **Budgets:** one limit per category/month; parent limits include descendants. Summaries avoid counting nested limits twice. Pacing is an estimate for variable spending, not a fixed-bill payment schedule.
- **Giving:** reserves and actual payments are distinct. The app records user-determined zakat amounts; an income percentage is not a zakat calculation.

## Verification

```sh
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm audit
npm run check:production -- --check-storage
```

`lint` runs ESLint and strict TypeScript. Tests cover money, calendar boundaries, transfers/fees, recurrence/idempotency, reservations, restore, auth, and revision conflicts. Browser tests use synthetic records and isolated server storage. To use an existing Chromium binary locally, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

Set `TEST_DATABASE_URL` to a **disposable** PostgreSQL database with `test` in its name to run the database integration test. It never uses the normal `DATABASE_URL`. CI supplies a PostgreSQL service and runs the migration, persistence, browser, and dependency checks.

Production deployment, real bank reconciliation, provider backup retention, and external AI provider behavior require verification in the deployment environment. See [remediation status](docs/REMEDIATION.md) for the audit-to-fix mapping.
