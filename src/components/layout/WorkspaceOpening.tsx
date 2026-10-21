'use client';
import { Flame } from 'lucide-react';
import { useEffect, useState } from 'react';

export function WorkspaceOpening() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 180);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <main className="workspace-opening" role="status" aria-live="polite">
      <div className="workspace-opening-card">
        <div className="workspace-opening-brand">
          <span className="workspace-opening-icon" aria-hidden="true">
            <Flame size={22} />
          </span>
          <span>Ember</span>
        </div>
        <h1>Opening your workspace</h1>
        <p>Checking your saved records and sign-in.</p>
        <div className="workspace-opening-track" aria-hidden="true">
          <span />
        </div>
      </div>
    </main>
  );
}
