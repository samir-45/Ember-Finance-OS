import path from 'node:path';
import { closeDb, isDatabaseConfigured } from '../src/lib/db';
import { loadSnapshot } from '../src/lib/server/persistence';

// Read-only: never migrates, resets, writes snapshots, or prints credentials.
let failures = 0;
function check(ok: boolean, message: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`);
  if (!ok) failures++;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--check-storage'))
    throw new Error('Usage: check-production.ts [--check-storage]');
  check(Number(process.versions.node.split('.')[0]) === 24, 'Run production on Node 24 LTS');
  check(
    (process.env.EMBER_OWNER_PASSWORD?.length ?? 0) >= 16,
    'Owner password has at least 16 characters',
  );
  check(
    (process.env.EMBER_SESSION_SECRET?.length ?? 0) >= 32,
    'Independent session secret has at least 32 characters',
  );
  let canonical = false;
  try {
    const url = new URL(process.env.EMBER_PUBLIC_URL || '');
    canonical =
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === '/' &&
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    /* Invalid or absent URL is reported below without its contents. */
  }
  check(canonical, 'Canonical public URL is an HTTPS origin');

  const database = isDatabaseConfigured();
  const vault = process.env.EMBER_VAULT_PATH || '';
  const file = process.env.EMBER_STORAGE_DRIVER === 'file' && path.isAbsolute(vault);
  check(database || file, 'PostgreSQL or an explicit absolute file-vault path is configured');
  if (file && !database) {
    const relative = path.relative(path.resolve('public'), path.resolve(vault));
    check(
      relative.startsWith('..' + path.sep) || path.isAbsolute(relative),
      'File vault is outside public assets',
    );
    console.log(
      'MANUAL Confirm a persistent private volume, one Node host, and independent volume backups.',
    );
  }
  if (process.env.EMBER_ENABLE_EXTERNAL_AI === 'true') {
    check(Boolean(process.env.GEMINI_API_KEY), 'External AI has a provider credential');
    check(Boolean(process.env.GEMINI_MODEL), 'External AI model is explicitly configured');
    console.log(
      'MANUAL Verify provider/model availability and sharing consent before requesting AI.',
    );
  }

  if (args.includes('--check-storage') && (database || file)) {
    try {
      const snapshot = await loadSnapshot();
      check(true, 'Configured storage is reachable and its current snapshot validates (read-only)');
      if (!snapshot.revision)
        console.log('INFO No canonical snapshot yet; the first approved save creates it.');
    } catch (error) {
      check(
        false,
        'Storage read/validation failed; inspect connectivity, TLS, and additive migration status',
      );
      if (error instanceof Error && /timeout/i.test(error.message))
        console.log('INFO Storage connection timed out; no records were written.');
    } finally {
      await closeDb();
    }
  }
  console.log(
    'MANUAL Verify HTTPS/cookies, deployment rate limiting, and an independent backup restore on the selected host.',
  );
  console.log(
    failures
      ? `${failures} configuration check(s) need attention.`
      : 'Configuration checks passed; deployment operations still require verification.',
  );
  process.exitCode = failures ? 1 : 0;
}

void main().catch(() => {
  console.error(
    'Preflight could not finish. Check command arguments and environment configuration.',
  );
  process.exitCode = 1;
});
