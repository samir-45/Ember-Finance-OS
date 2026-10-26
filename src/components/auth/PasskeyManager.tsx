'use client';
import { startRegistration } from '@simplewebauthn/browser';
import { Fingerprint, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { SettingRow } from '@/components/settings/SettingsUI';

type Passkey = { id: string; name: string; createdAt: string; lastUsedAt: string | null };
type ListResult = { enabled: boolean; passkeys: Passkey[]; error?: string };

export function PasskeyManager() {
  const [state, setState] = useState<ListResult>({ enabled: true, passkeys: [] });
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    const response = await fetch('/api/auth/passkeys', { cache: 'no-store' });
    const result = (await response.json()) as ListResult;
    if (!response.ok) throw new Error(result.error || 'Could not load passkeys.');
    setState(result);
  }, []);

  useEffect(() => {
    void refresh().catch((cause: unknown) =>
      setError(cause instanceof Error ? cause.message : 'Could not load passkeys.'),
    );
  }, [refresh]);

  const register = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (!window.PublicKeyCredential) throw new Error('This browser does not support passkeys.');
      const response = await fetch('/api/auth/passkey/registration-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not start passkey setup.');
      const credential = await startRegistration({ optionsJSON: result.options });
      const verified = await fetch('/api/auth/passkey/registration-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: credential, challengeId: result.challengeId, name }),
        cache: 'no-store',
      });
      const verifiedResult = await verified.json();
      if (!verified.ok) throw new Error(verifiedResult.error || 'Could not save this passkey.');
      setName('');
      setPassword('');
      setMessage('Passkey added. You can now use your device prompt to sign in.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Passkey setup failed.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const confirmPassword = window.prompt('Enter your owner password to remove this passkey.');
    if (!confirmPassword) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/auth/passkeys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, password: confirmPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not remove this passkey.');
      setMessage('Passkey removed.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove this passkey.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SettingRow
        title="Passkeys"
        description={
          state.enabled
            ? 'Sign in with your fingerprint, face or device PIN instead of typing the password. The password still works as a backup.'
            : 'Sign in with your fingerprint or face instead of the password. Available once Ember runs on its own web address with a PostgreSQL database.'
        }
      />
      {state.enabled &&
        state.passkeys.map((item) => (
          <SettingRow
            key={item.id}
            title={item.name}
            description={`Added ${new Date(item.createdAt).toLocaleDateString()}`}
          >
            <button
              className="btn btn-secondary"
              type="button"
              disabled={busy}
              aria-label={`Remove ${item.name}`}
              onClick={() => void remove(item.id)}
            >
              <Trash2 size={16} aria-hidden="true" /> Remove
            </button>
          </SettingRow>
        ))}
      {state.enabled && (
        <form
          className="setting-row setting-row-stacked passkey-add-form"
          onSubmit={(event) => void register(event)}
        >
          <div className="form-two-grid">
            <label htmlFor="passkey-name">
              Name this device
              <input
                id="passkey-name"
                className="input"
                value={name}
                maxLength={60}
                required
                placeholder="e.g. My laptop"
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label htmlFor="passkey-password">
              Owner password
              <input
                id="passkey-password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                required
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            <Fingerprint size={17} aria-hidden="true" /> {busy ? 'Working…' : 'Add a passkey'}
          </button>
        </form>
      )}
      {error && (
        <p className="form-error setting-feedback" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-success setting-feedback" role="status">
          {message}
        </p>
      )}
    </>
  );
}
