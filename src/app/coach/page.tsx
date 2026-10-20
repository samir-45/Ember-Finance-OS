'use client';
import { GoldenRulesAudit } from '@/components/coach/GoldenRulesAudit';
import { coachOutput } from '@/lib/ai-contracts';
import {
  computeDashboard,
  computeIncomeBaseline,
  computeSubscriptionMetrics,
  formatMoney,
} from '@/lib/finance';
import { runRulesEngine } from '@/lib/rules-engine';
import { store } from '@/lib/store';
import { useLedgerVersion } from '@/lib/use-ledger';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { z } from 'zod';
export default function CoachPage() {
  const version = useLedgerVersion();
  const data = useMemo(() => computeDashboard(), [version]);
  const insights = useMemo(() => runRulesEngine(), [version]);
  const [review, setReview] = useState<z.infer<typeof coachOutput> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const settings = store.getSettings();
  const enabled = settings.aiCoachEnabled && settings.shareAiDetails;
  const request = async () => {
    setBusy(true);
    setError('');
    try {
      if (!enabled) throw new Error('Enable external AI and sharing consent in Settings first');
      const input = {
        consent: { enabled: true, share: true },
        incomeBaselineUsdMinor: Math.round(computeIncomeBaseline()),
        incomeUsdMinor: data.incomeThisMonth.usdMinor,
        expenseUsdMinor: data.expensesThisMonth.usdMinor,
        savingsRate: data.savingsRatePercent,
        runwayMonths: data.runwayMonths,
        hasExpenseHistory: data.hasExpenseHistory,
        subBurdenPercent: computeSubscriptionMetrics(
          store.getSubscriptions(),
          computeIncomeBaseline(),
        ).subToIncomeRatio,
        topCategories: data.categorySpending.slice(0, 3).map((c) => ({
          name: c.categoryName,
          amountUsdMinor: c.amounts.usdMinor,
          percent: c.percentage,
        })),
      };
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'AI review failed');
      setReview(coachOutput.parse(body.data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI review unavailable');
    } finally {
      setBusy(false);
    }
  };
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
      <section className="ember-glass settings-card settings-stack">
        <h2>Optional AI review</h2>
        <p>
          Local insights above use the same calculations as your dashboard and reports. Requesting
          an AI review sends this month's income, expenses, category totals, and runway estimate to
          Google. Owner sign-in and explicit sharing consent are required.
        </p>
        <p>
          Income {formatMoney(data.incomeThisMonth.usdMinor, 'USD')} · Expenses{' '}
          {formatMoney(data.expensesThisMonth.usdMinor, 'USD')}
        </p>
        {!enabled && <Link href="/settings">Review AI privacy settings</Link>}
        <button
          className="btn btn-primary"
          disabled={!enabled || busy}
          onClick={() => void request()}
        >
          {busy ? 'Requesting review…' : 'Request AI review'}
        </button>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {review && (
          <div className="settings-stack">
            <p className="label-uppercase">Google Gemini · requested review</p>
            <p>{review.executiveSummary}</p>
            <h3>{review.nextFocus.title}</h3>
            <p>{review.nextFocus.explanation}</p>
            <p>{review.nextFocus.impact}</p>
            {review.leakages.map((item, i) => (
              <article key={i}>
                <strong>{item.title}</strong>
                <p>{item.details}</p>
              </article>
            ))}
            {review.opportunities.map((item, i) => (
              <article key={i}>
                <strong>{item.title}</strong>
                <p>{item.strategy}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
