'use client';
import { GoldenRulesAudit } from '@/components/coach/GoldenRulesAudit';
import { runRulesEngine } from '@/lib/rules-engine';
import { useLedgerVersion } from '@/lib/use-ledger';
import { useMemo } from 'react';
export default function CoachPage() {
  const version = useLedgerVersion();
  const insights = useMemo(() => runRulesEngine(), [version]);
  return (
    <div className="settings-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Your money review</h1>
          <p className="page-subtitle">
            Checks against your recorded activity and personal targets
          </p>
        </div>
      </div>
      <section className="ember-glass settings-card">
        <h2>Current observations</h2>
        <div className="settings-stack">
          {insights.map((i) => (
            <article key={i.id}>
              <p>
                <strong>{i.title}</strong>
              </p>
              <p>{i.body}</p>
            </article>
          ))}
        </div>
      </section>
      <GoldenRulesAudit key={version} />
    </div>
  );
}
