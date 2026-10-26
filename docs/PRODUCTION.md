# Production setup and recovery

## Readiness check before deployment

Use the environment supplied by your deployment host:

```sh
npm run check:production
npm run check:production -- --check-storage
```

For the local `.env`, run `node --env-file=.env --import tsx scripts/check-production.ts --check-storage` using Node 24. This command only reads configuration and, when requested, the current server snapshot. It never migrates, resets, or writes financial records and never prints credentials. A nonzero exit means a required configuration check failed.

The check requires Node 24, an owner password of at least 16 characters, a separate session secret of at least 32 characters, a canonical HTTPS origin, and configured storage. Passing it does not verify host TLS, distributed rate limiting, persistent volumes, or provider backup recovery. Run the functional checks below on the chosen deployment before relying on server storage.

The October 21 review verified the configured database with a read-only snapshot load. Missing local owner credentials were generated in the ignored `.env`; use its `EMBER_OWNER_PASSWORD` value at `/login` after the server reloads its environment. Configure credentials separately in the chosen host's secret settings. The public HTTPS origin and hosting operations remain undecided.

## Before entering your real records

1. Set your manual USD/BDT reference rate in Settings. Until configured, the app explicitly labels the provisional estimate. Reporting rates are saved with entries; changing today's reference does not rewrite history. Enter the actual historical reporting rate when adding an older transaction.
2. Add your real accounts and opening balances at a chosen tracking date. Avoid also importing those same opening amounts as income.
3. Sign in at `/login`; the server ledger loads before finance pages open. Confirm a successful sync in Settings before relying on server persistence. Browser clearing/device loss can remove pending edits that have not synced.
4. Enter and reconcile an initial set against your own NSave/bank statements. Record actual currency conversion amounts and fees separately from income.
5. Export a complete JSON backup and keep it somewhere independent of the browser. Verify restore in a separate browser profile or test environment.

Page shells can be prerendered while financial views remain dynamic: browser hydration reads the current ledger, edits and cloud loads notify mounted views, and date-dependent calculations refresh on the Dhaka day boundary (within 30 seconds while active, or on return to the tab). Month selectors intentionally keep the month selected by the owner. FX, bank records, and religious giving amounts remain manually supplied; no automatic bank feed is implied.

## Deployment

Use Node 24 LTS and HTTPS. Configure a unique owner password (at least 16 characters; prefer a randomly generated password), a random session secret, and the canonical origin in `EMBER_PUBLIC_URL`. Secure cookies are enabled in production. No server financial data is accessible until authentication is configured.

Deploy with a running Next.js server or a host that supports its Proxy and API handlers. Uploading static page files alone does not provide the authentication or database service.

All finance pages require a valid owner session. The Next.js Proxy redirects anonymous and expired sessions to `/login`; ledger and AI APIs continue enforcing their own authorization. Both a 16-character owner password and a separate 32-character session secret are required at runtime. Missing configuration leaves the app locked. There is no public registration.

After sign-in, the client verifies the session and loads the ledger from the database before mounting finance pages. The database is the only copy: nothing financial is written to browser storage. If the database is unavailable, startup shows a retry screen. The client checks the session on focus and periodically, returns to login when its 12-hour session expires, and reloads the ledger from the database when the tab regains focus.

Each change is applied on screen and saved to the database straight away; changes made during a save are sent right after it against the new revision. A rejected or failed save reloads the database copy and reports that the change was not saved. Leaving or signing out while a save is in flight asks for confirmation.

Set `EMBER_PUBLIC_URL` to the exact deployed HTTPS origin. For passkeys, this is also the canonical origin they are registered against. Optionally set `EMBER_WEBAUTHN_RP_ID` to that hostname or a parent domain (for example, `example.com` for `app.example.com`) when you control that domain. Choose the final production domain before registering passkeys: credentials belong to their relying-party domain and cannot be moved to an unrelated domain. Localhost passkeys are for local development only.

Passkey sign-in is available when PostgreSQL and `EMBER_PUBLIC_URL` are configured. Add or remove a passkey from Settings while signed in, confirming the owner password for each change. The passkey prompt may use a fingerprint, face scan, device PIN, or security key depending on the device; biometric material stays with the authenticator. Keep the owner password as recovery. Passkey public keys and one-time, five-minute challenges are stored in separate PostgreSQL tables; no private key or biometric is sent to Ember. Passkey records are not part of the finance ledger or its JSON backups.

Rotate the password or session secret in host secrets and restart all instances to invalidate existing sessions. This is a personal, single-owner product; it is not a multi-tenant service. MFA and externally managed identity are not implemented.

When moving from localhost to your deployed domain, configure the same intended database to load its synced ledger after sign-in. Browser records are tied to their origin and do not move to the new URL automatically. Export a JSON backup before moving; if your current records have not synced, restore the archive on the deployed site and review any server conflict before selecting a replacement.

Use deployment-level distributed rate limiting on `/api/auth/session`, `/api/auth/passkey/*`, `/api/auth/passkeys`, and `/api/ai/*`. Application cooldowns are process-local and do not replace a shared rate limiter across multiple server instances. Never log financial request bodies, cookies, database URLs, or API keys.

Choose one server storage provider:

- PostgreSQL: configure `DATABASE_URL`, use verified TLS and provider pooling, and apply the additive migration. Enable and verify provider backups/PITR separately from the application's retained revisions.
- File vault: explicitly set `EMBER_STORAGE_DRIVER=file` and `EMBER_VAULT_PATH` to a private durable filesystem path. Use a single persistent Node deployment with a filesystem that provides exclusive-create locking and atomic rename. The app does not support a shared file vault over arbitrary network filesystems. If a process dies while holding a `.lock` file, verify no writer is running before removing that stale lock. Keep volume backups independent of the host.

The file provider is not suitable for ordinary ephemeral serverless function storage. Database outages return failure; they do not switch providers.

## Additive schema migration

With the deployment environment loaded:

```sh
npm run db:migrate
```

This executes `drizzle/0001_versioned_ledger.sql`. It creates the canonical snapshot/history and passkey/challenge tables and does not drop or edit legacy tables or finance records. It removes only expired temporary WebAuthn challenges. Existing normalized legacy records block an empty canonical ledger from being silently created over them.

The documented `db:migrate` command loads `.env`. In a deployment that injects environment variables directly, use:

```sh
node --import tsx scripts/migrate-ledger.ts
```

Run migrations in a build/admin environment containing development dependencies; the app runtime does not need the migration CLI.

## Existing database or server-file records

Before migration, create an independent database/provider backup. Export legacy normalized rows without changing them:

```sh
node --env-file=.env --import tsx scripts/migrate-ledger.ts --export-legacy /private/path/legacy.json
```

Export uses a consistent read-only transaction. Output files are created exclusively so an existing archive is not overwritten. Raw legacy records are always preserved. If validation succeeds, a second `.validated.json` archive is generated. Category relationships that the old server never saved cannot be recovered automatically; restore them from a browser/JSON backup if available.

Check validation messages, currencies, transfer principal/fee amounts, and dates against your own records. A legacy budget with `period=monthly` has no recoverable calendar month; the new app keeps it `unassigned` until you choose a month. A browser archive may be more complete than the old database because settings, exchange rates, and transfer amounts were not reliably persisted there.

The old `.data/ember_vault.json` file is never overwritten by the new persistence layer. Preserve it as a source archive; preview it through Settings to validate and normalize it. Do not point the new versioned file provider at the old snapshot file itself.

After reviewing a valid complete archive, create the first canonical database snapshot explicitly:

```sh
node --env-file=.env --import tsx scripts/migrate-ledger.ts --bootstrap /private/path/reviewed.validated.json
```

Bootstrap refuses to replace an existing canonical snapshot. Legacy tables remain unchanged. Further restores use the application and revision checks.

## Functional verification before relying on the deployment

1. Open `/dashboard`, `/accounts`, and `/settings` in a private browser window and verify they redirect to `/login` without showing financial records. Verify anonymous requests to `/api/db` and `/api/ai/*` return 401.
2. Sign in on the canonical HTTPS origin and verify the session cookie is Secure, HTTP-only, and SameSite Strict. Check cross-origin mutation rejection. Register a passkey on the final domain, sign out, and verify passkey sign-in on the intended laptop and mobile devices. Keep password access available for recovery.
3. Using a separate test workspace/database, record income, an actual cross-currency transfer, its fee, a bill payment, a reservation, and a goal. Reopen and compare the resulting balances.
4. Delete a test transaction and confirm it stays deleted after refresh and reconnect.
5. Edit from a second browser to verify conflicts preserve both copies and do not silently overwrite pending edits. A second tab in one browser is intentionally prevented from editing concurrently.
6. Simulate storage unavailability and confirm no cloud-success message appears; the browser retains edits.
7. Export JSON, restore into a separate browser, and compare accounts, transaction IDs, transfer amounts, budget months, goals, allocations, reconciliations, and preferences.
8. Exercise provider backup/PITR recovery into a separate database and document the restore point, owner, and retention policy.

## Operational recovery

The latest canonical PostgreSQL snapshot is in `ledger_snapshots` for owner ID `owner`; earlier revisions are in `ledger_history`. File storage retains `.revision-N.json` archives beside the current vault. Retained application history is not encrypted and is not a substitute for independent backups. Restrict access and define a retention policy appropriate for your own records.

To recover an earlier revision, export its `payload` as a version-2 JSON ledger from a trusted database administration environment, validate it through Settings, inspect the preview, then restore it. That creates a new current revision through normal conflict-checked synchronization. Preserve the current revision before recovery. Do not edit the current revision counter manually.

For complete erasure, account for PostgreSQL history/legacy tables, file revisions, exported backups and provider backups under the relevant retention policy. Restoring an archive does not securely erase those copies.

AI quick entry requires `GEMINI_API_KEY` (and an explicit `GEMINI_MODEL`), the owner's Settings switch, and a Fill in action. Only the typed entry text and account/category names are sent. Without it, entries are typed manually and every insight still works.

## Explicit full fresh start

For an owner-authorized erasure, `node --env-file=.env --import tsx scripts/reset-data.ts --inspect` reports only application table row counts. `--confirm-erase-all` clears the known Ember tables and retained history in one transaction, keeps the schema, and creates an empty canonical ledger. It does not use `CASCADE` or touch unrelated tables. The tool also removes the explicitly configured/legacy vault and its retained file revisions.

