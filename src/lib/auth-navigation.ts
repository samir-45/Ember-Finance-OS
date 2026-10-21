const workspaceRoots = new Set([
  'dashboard',
  'accounts',
  'transactions',
  'allocations',
  'subscriptions',
  'budgets',
  'goals',
  'reports',
  'coach',
  'settings',
]);

// Only finance pages on this origin may be a post-login destination.
export function safeReturnPath(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    Array.from(value).some((character) => character.charCodeAt(0) < 32)
  )
    return '/dashboard';
  try {
    const url = new URL(value, 'https://ember.invalid');
    if (url.origin !== 'https://ember.invalid' || !workspaceRoots.has(url.pathname.split('/')[1]))
      return '/dashboard';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/dashboard';
  }
}

export function signInPath(returnTo: string): string {
  return `/login?next=${encodeURIComponent(safeReturnPath(returnTo))}`;
}
