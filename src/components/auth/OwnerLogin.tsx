'use client';
import { safeReturnPath } from '@/lib/auth-navigation';
import { Eye, EyeOff, Flame, LockKeyhole, ArrowRight } from 'lucide-react';
import { useState } from 'react';

export function OwnerLogin({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <main className="owner-login">
      <section className="owner-login-card" aria-labelledby="login-title">
        <div className="workspace-opening-brand">
          <span className="workspace-opening-icon" aria-hidden="true">
            <Flame size={22} />
          </span>
          <span>Ember</span>
        </div>
        <h1 id="login-title" className="page-title owner-login-title">
          Welcome back
        </h1>
        <p className="owner-login-description">Sign in to open your finance workspace.</p>
        {configured ? (
          <form
            className="form-stack"
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy) return;
              setBusy(true);
              setError('');
              try {
                const response = await fetch('/api/auth/session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ password }),
                  signal: AbortSignal.timeout(15000),
                });
                const result = await response.json();
                if (!response.ok)
                  throw new Error(result.error || 'Could not sign in. Please try again.');
                setPassword('');
                const destination = new URLSearchParams(window.location.search).get('next');
                window.location.replace(safeReturnPath(destination));
              } catch (cause) {
                setError(
                  cause instanceof Error && cause.name !== 'TimeoutError'
                    ? cause.message
                    : 'Could not reach the server. Please try again.',
                );
                setBusy(false);
              }
            }}
          >
            <label htmlFor="owner-password">Owner password</label>
            <div className="owner-password-field">
              <input
                id="owner-password"
                name="password"
                className="input"
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                required
                maxLength={1024}
                value={password}
                aria-describedby={error ? 'login-error' : undefined}
                aria-invalid={!!error}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="owner-password-toggle"
                aria-label={visible ? 'Hide password' : 'Show password'}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? (
                  <EyeOff size={18} aria-hidden="true" />
                ) : (
                  <Eye size={18} aria-hidden="true" />
                )}
              </button>
            </div>
            {error && (
              <p className="form-error" id="login-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn btn-primary owner-sign-in" disabled={busy} type="submit">
              {busy ? 'Signing in…' : 'Sign in'}
              {!busy && <ArrowRight size={17} aria-hidden="true" />}
            </button>
          </form>
        ) : (
          <p className="owner-login-setup" role="status">
            Owner sign-in is not configured for this deployment. Set the owner password and session
            secret in your hosting settings, then restart the app.
          </p>
        )}
        <p className="owner-login-footer">
          <LockKeyhole size={14} aria-hidden="true" />
          Private owner access
        </p>
      </section>
    </main>
  );
}
