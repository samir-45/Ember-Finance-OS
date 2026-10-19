'use client';

import { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react';
import { runRulesEngine } from '@/lib/rules-engine';
import { store } from '@/lib/store';
import type { CoachInsight } from '@/types';

export default function CoachPage() {
  const [insights, setInsights] = useState<CoachInsight[]>([]);
  const [evaluating, setEvaluating] = useState(false);

  const loadInsights = () => {
    const existing = store.getInsights();
    if (existing.length > 0) {
      setInsights(existing);
    } else {
      const generated = runRulesEngine();
      setInsights(generated);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  const handleReEvaluate = () => {
    setEvaluating(true);
    setTimeout(() => {
      const fresh = runRulesEngine();
      setInsights(fresh);
      setEvaluating(false);
    }, 400);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Ember Financial Coach</h1>
          <p className="page-subtitle">Deterministic rules engine detecting category spikes, emergency runways, and savings wins</p>
        </div>
        <button onClick={handleReEvaluate} className="btn btn-primary btn-sm">
          <RefreshCw size={14} className={evaluating ? 'animate-spin' : ''} />
          {evaluating ? 'Analyzing...' : 'Re-run Evaluation'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {insights.map(i => {
          const isWin = i.kind === 'win';
          const isWarning = i.severity === 'warning' || i.severity === 'critical';

          return (
            <div
              key={i.id}
              className="ember-glass"
              style={{
                padding: '24px',
                borderLeft: isWin
                  ? '4px solid var(--color-income)'
                  : isWarning
                  ? '4px solid var(--color-warning)'
                  : '4px solid var(--color-info)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: isWin
                      ? 'rgba(110,231,168,0.1)'
                      : isWarning
                      ? 'rgba(245,158,11,0.1)'
                      : 'rgba(96,165,250,0.1)',
                    color: isWin
                      ? 'var(--color-income)'
                      : isWarning
                      ? 'var(--color-warning)'
                      : 'var(--color-info)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isWin ? <CheckCircle size={16} /> : isWarning ? <AlertTriangle size={16} /> : <Lightbulb size={16} />}
                </span>
                <h3 style={{ fontSize: '1.0625rem', fontWeight: 600 }}>{i.title}</h3>
                <span className={`badge badge-${i.severity === 'warning' ? 'pending' : isWin ? 'income' : 'planned'}`}>
                  {i.kind}
                </span>
              </div>

              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginLeft: 38 }}>
                {i.body}
              </p>

              {i.action && (
                <div style={{ marginTop: 14, marginLeft: 38 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.75rem',
                      color: 'var(--text-primary)',
                    }}
                  >
                    Recommended action: <strong>{i.action}</strong>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
