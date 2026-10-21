'use client';
import { signInPath } from '@/lib/auth-navigation';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { AppShell } from './AppShell';
import { Workspace } from './Workspace';
import { WorkspaceOpening } from './WorkspaceOpening';

interface OwnerSession {
  expiresAt: number;
  workspaceResetGeneration: unknown;
}

export function OwnerWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/login') return children;
  return <SignedInWorkspace>{children}</SignedInWorkspace>;
}

function SignedInWorkspace({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<OwnerSession | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let disposed = false;
    let redirecting = false;
    let verified: OwnerSession | null = null;
    let checking = false;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const lock = () => {
      if (disposed || redirecting) return;
      redirecting = true;
      verified = null;
      setSession(null);
      window.location.replace(signInPath(window.location.pathname + window.location.search));
    };
    const check = async () => {
      if (disposed || checking || redirecting) return;
      checking = true;
      try {
        const response = await fetch('/api/auth/session', {
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        });
        if (!response.ok) throw new Error('Session unavailable');
        const result = await response.json();
        if (disposed || redirecting) return;
        if (result.authenticated !== true) {
          lock();
          return;
        }
        if (!Number.isFinite(result.expiresAt) || result.expiresAt <= Date.now()) {
          lock();
          return;
        }
        verified = {
          expiresAt: result.expiresAt,
          workspaceResetGeneration: result.workspaceResetGeneration,
        };
        setSession(verified);
        setUnavailable(false);
        clearTimeout(expiryTimer);
        expiryTimer = setTimeout(lock, Math.max(0, verified.expiresAt - Date.now()));
      } catch {
        if (!disposed && !redirecting && !verified) setUnavailable(true);
        // A previously verified, unexpired session can retain offline edits.
        // Its expiry timer remains active even when the server is unreachable.
      } finally {
        checking = false;
      }
    };
    const resume = () => {
      if (verified && verified.expiresAt <= Date.now()) lock();
      else if (document.visibilityState === 'visible') void check();
    };
    const restored = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      verified = null;
      setSession(null);
      void check();
    };
    void check();
    const interval = setInterval(resume, 60000);
    window.addEventListener('focus', resume);
    window.addEventListener('pageshow', restored);
    window.addEventListener('ember-owner-session-expired', lock);
    document.addEventListener('visibilitychange', resume);
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(expiryTimer);
      clearInterval(interval);
      window.removeEventListener('focus', resume);
      window.removeEventListener('pageshow', restored);
      window.removeEventListener('ember-owner-session-expired', lock);
      document.removeEventListener('visibilitychange', resume);
    };
  }, []);
  if (unavailable && !session)
    return (
      <main className="workspace-opening">
        <div className="workspace-opening-card settings-stack">
          <h1>Could not verify sign-in</h1>
          <p>Check your connection and try again to open your workspace.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </main>
    );
  if (!session) return <WorkspaceOpening />;
  return (
    <Workspace resetGeneration={session.workspaceResetGeneration}>
      <AppShell>{children}</AppShell>
    </Workspace>
  );
}
