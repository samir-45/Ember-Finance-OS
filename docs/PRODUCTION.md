# Production setup and recovery

## Deployment

Use Node 24 LTS and HTTPS. Configure a unique owner password (at least 16 characters; prefer a randomly generated password), a random session secret, and the canonical origin in `EMBER_PUBLIC_URL`. Secure cookies are enabled in production. No server financial data is accessible until authentication is configured.

The default browser workspace remains usable without a server. Data stays in browser storage until the owner explicitly connects server storage in Settings. This is a personal, single-owner product; it is not a multi-tenant service.

Use deployment-level distributed rate limiting on `/api/auth/session` and `/api/ai/*`. Application cooldowns are process-local and do not replace a shared rate limiter across multiple server instances. Never log financial request bodies, cookies, database URLs, or API keys.

Choose one server storage provider:

- PostgreSQL: configure `DATABASE_URL`, use verified TLS and provider pooling, and apply the additive migration. Enable and verify provider backups/PITR separately from the application's retained revisions.
- File vault: explicitly set `EMBER_STORAGE_DRIVER=file` and `EMBER_VAULT_PATH` to a private durable filesystem path. Use a single persistent Node deployment with a filesystem that provides exclusive-create locking and atomic rename. The app does not support a shared file vault over arbitrary network filesystems. If a process dies while holding a `.lock` file, verify no writer is running before removing that stale lock. Keep volume backups independent of the host.

The file provider is not suitable for ordinary ephemeral serverless function storage. Database outages return failure; they do not switch providers.

## Additive schema migration

With the deployment environment loaded:

```sh
npm run db:migrate
```

This executes `drizzle/0001_versioned_ledger.sql`. It creates the canonical snapshot and history tables and does not drop or edit legacy tables. Existing normalized legacy records block an empty canonical ledger from being silently created over them.

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

1. Verify anonymous requests to `/api/db` and `/api/ai/*` return 401.
2. Sign in on the canonical HTTPS origin and verify the session cookie is Secure, HTTP-only, and SameSite Strict. Check cross-origin mutation rejection.
3. Using a separate test workspace/database, record income, an actual cross-currency transfer, its fee, a bill payment, a reservation, and a goal. Reopen and compare the resulting balances.
4. Delete a test transaction and confirm it stays deleted after refresh and reconnect.
5. Edit from a second browser to verify conflicts preserve both copies and do not silently overwrite pending edits. A second tab in one browser is intentionally prevented from editing concurrently.
6. Simulate storage unavailability and confirm no cloud-success message appears; the browser retains edits.
7. Export JSON, restore into a separate browser, and compare accounts, transaction IDs, transfer amounts, budget months, goals, allocations, reconciliations, and preferences.
8. Exercise provider backup/PITR recovery into a separate database and document the restore point, owner, and retention policy.

## Operational recovery

The latest canonical PostgreSQL snapshot is in `ledger_snapshots` for owner ID `owner`; earlier revisions are in `ledger_history`. File storage retains `.revision-N.json` archives beside the current vault. Retained application history is not encrypted and is not a substitute for independent backups. Restrict access and define a retention policy appropriate for your own records.

To recover an earlier revision, export its `payload` as a version-2 JSON ledger from a trusted database administration environment, validate it through Settings, inspect the preview, then restore it. That creates a new current revision through normal conflict-checked synchronization. Preserve the current revision before recovery. Do not edit the current revision counter manually.

“Reset active ledger” retains history and local recovery archives. For complete erasure, account for browser legacy keys, personal/demo snapshots, recovery keys, PostgreSQL history/legacy tables, file revisions, and provider backups under the relevant retention policy. The UI does not claim to securely erase those copies.

External AI additionally requires `EMBER_ENABLE_EXTERNAL_AI=true`, a valid provider key/model, both user privacy preferences, and a user request. Provider availability and policy are verified separately. Failure leaves local deterministic insights and manual entry available.

## Explicit full fresh start

For an owner-authorized erasure, `node --env-file=.env --import tsx scripts/reset-data.ts --inspect` reports only application table row counts. `--confirm-erase-all` clears the known Ember tables and retained history in one transaction, keeps the schema, and creates an empty canonical ledger. It does not use `CASCADE` or touch unrelated tables. The tool also removes the explicitly configured/legacy vault and its retained file revisions, then sets a new `EMBER_WORKSPACE_RESET_GENERATION` in the local `.env`.

On the next online workspace load, the app reads this generation from session metadata and removes Ember local/session storage, including legacy records, recovery copies, demo/personal workspace copies, and saved appearance settings. The remembered generation prevents later reloads from deleting newly entered data. Browser-only finance records are not uploaded by this check. Closed or offline browsers are cleared when they next open online against that server; a hosted deployment must receive the same generation configuration before its browser copies can be reset. Exported files outside the project and provider-managed backups are outside the tool's scope.
