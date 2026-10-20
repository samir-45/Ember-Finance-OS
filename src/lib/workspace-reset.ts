const RESET_KEY = 'ember_workspace_reset_generation';

// Only an owner-configured, new reset generation erases data. Remembering it
// keeps subsequent reloads from deleting newly entered records.
export function applyWorkspaceReset(
  generation: unknown,
  local: Storage = localStorage,
  session: Storage = sessionStorage,
): boolean {
  if (typeof generation !== 'string' || !/^[a-f0-9-]{36}$/i.test(generation)) return false;
  if (local.getItem(RESET_KEY) === generation) return false;
  for (const storage of [local, session]) {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
    for (const key of keys) if (key?.startsWith('ember_')) storage.removeItem(key);
  }
  local.setItem(RESET_KEY, generation);
  return true;
}
