'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, RefreshCw, AlertTriangle, CheckCircle,
  Lightbulb, ArrowRight, ShieldCheck, Gauge, TrendingUp,
  Sliders, ArrowUpRight
} from 'lucide-react';
import { runRulesEngine } from '@/lib/rules-engine';
import { store } from '@/lib/store';
import { formatMoney, convertToUsd, computeAccountBalance } from '@/lib/finance';
import type { CoachInsight } from '@/types';
import { PageGuide } from '@/components/ui/PageGuide';

interface AiReviewData {
  executiveSummary: string;
  nextFocus: {
    title: string;
    explanation: string;
    impact: string;
  };
  leakages: Array<{
    title: string;
    details: string;
    urgency: 'high' | 'medium' | 'low';
  }>;
  opportunities: Array<{
    title: string;
    strategy: string;
  }>;
  status: 'healthy' | 'warning' | 'critical';
}

export default function CoachPage() {
  const router = useRouter();
  const [insights, setInsights] = useState<CoachInsight[]>([]);
  const [evaluating, setEvaluating] = useState(false);
  const [aiReview, setAiReview] = useState<AiReviewData | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const loadInsights = () => {
    const existing = store.getInsights();
    if (existing.length > 0) {
      setInsights(existing);
    } else {
      const generated = runRulesEngine();
      setInsights(generated);
    }
  };

  const fetchAiReview = async (
    incUsd: number,
    expUsd: number,
    savRate: number,
    runway: number,
    subBurden: number,
    topCats: Array<{ name: string; amountUsd: number; percent: number }>
  ) => {
    setLoadingAi(true);
    try {
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incomeUsd: incUsd,
          expenseUsd: expUsd,
          savingsRate: savRate,
          runwayMonths: runway,
          subBurdenPercent: subBurden,
          topCategories: topCats,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAiReview(data.data);
      }
    } catch (err) {
      console.error('Failed to load AI review:', err);
    } finally {
      setLoadingAi(false);
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
      store.clearInsights();
      fresh.forEach(i => store.addInsight(i));
      setEvaluating(false);
    }, 450);
  };

  const handleDismiss = (id: string) => {
    setInsights(prev => prev.filter(i => i.id !== id));
  };

  // 3-Month Category Baseline Computations
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const transactions = store.getTransactions().filter(t => t.status === 'done');
  const categories = store.getCategories().filter(c => c.type === 'expense');

  const categorySpikes = categories.map(cat => {
    const pastMonths: number[] = [];
    for (let i = -3; i < 0; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const m = d.toISOString().slice(0, 7);
      const monthTotal = transactions
        .filter(t => t.date.startsWith(m) && t.type === 'expense' && t.categoryId === cat.id)
        .reduce((sum, t) => sum + convertToUsd(t.amountMinor, t.currency), 0);
      pastMonths.push(monthTotal);
    }
    const avg3MonthUsd = pastMonths.reduce((a, b) => a + b, 0) / Math.max(pastMonths.length, 1);
    const thisMonthUsd = transactions
      .filter(t => t.date.startsWith(currentMonth) && t.type === 'expense' && t.categoryId === cat.id)
      .reduce((sum, t) => sum + convertToUsd(t.amountMinor, t.currency), 0);

    const spikePct = avg3MonthUsd > 0 ? ((thisMonthUsd - avg3MonthUsd) / avg3MonthUsd) * 100 : 0;
    return {
      cat,
      avg3MonthUsd,
      thisMonthUsd,
      spikePct,
    };
  }).filter(c => c.thisMonthUsd > 0 || c.avg3MonthUsd > 0)
    .sort((a, b) => b.spikePct - a.spikePct);

  // Runway Simulation
  const accounts = store.getAccounts();
  let totalNetWorthUsd = 0;
  accounts.forEach(a => {
    totalNetWorthUsd += convertToUsd(computeAccountBalance(a.id), a.currency);
  });

  const allExpenseMonths = new Set(transactions.filter(t => t.type === 'expense').map(t => t.date.slice(0, 7)));
  const totalAllExpenseUsd = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + convertToUsd(t.amountMinor, t.currency), 0);
  const avgMonthlyBurnUsd = allExpenseMonths.size > 0 ? totalAllExpenseUsd / allExpenseMonths.size : 1;

  const currentRunway = totalNetWorthUsd / avgMonthlyBurnUsd;
  const leanRunway = totalNetWorthUsd / (avgMonthlyBurnUsd * 0.7); // 30% cut in discretionary
  const inflationRunway = totalNetWorthUsd / (avgMonthlyBurnUsd * 1.15); // 15% shock

  // Current month totals for AI review
  const thisMonthIncomeUsd = transactions
    .filter(t => t.date.startsWith(currentMonth) && t.type === 'income')
    .reduce((sum, t) => sum + convertToUsd(t.amountMinor, t.currency), 0);
  const thisMonthExpenseUsd = transactions
    .filter(t => t.date.startsWith(currentMonth) && t.type === 'expense')
    .reduce((sum, t) => sum + convertToUsd(t.amountMinor, t.currency), 0);
  const thisMonthSavingsRate = thisMonthIncomeUsd > 0
    ? ((thisMonthIncomeUsd - thisMonthExpenseUsd) / thisMonthIncomeUsd) * 100
    : 0;

  useEffect(() => {
    const subs = store.getSubscriptions().filter(s => s.active);
    const subTotalUsd = subs.reduce((sum, s) => {
      const amt = convertToUsd(s.amountMinor, s.currency);
      if (s.billingCycle === 'yearly') return sum + amt / 12;
      if (s.billingCycle === 'quarterly') return sum + amt / 3;
      return sum + amt;
    }, 0);
    const subBurden = thisMonthIncomeUsd > 0 ? (subTotalUsd / thisMonthIncomeUsd) * 100 : 0;
    const topCats = categorySpikes.slice(0, 3).map(c => ({
      name: c.cat.name,
      amountUsd: Math.round(c.thisMonthUsd),
      percent: Math.round(thisMonthExpenseUsd > 0 ? (c.thisMonthUsd / thisMonthExpenseUsd) * 100 : 0),
    }));

    fetchAiReview(
      thisMonthIncomeUsd,
      thisMonthExpenseUsd,
      thisMonthSavingsRate,
      currentRunway,
      subBurden,
      topCats
    );
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Ember Financial Coach & Scenarios</h1>
          <p className="page-subtitle">Deterministic rules engine detecting category anomalies, runway scenarios, and savings wins</p>
        </div>
        <button onClick={handleReEvaluate} className="btn btn-primary btn-sm">
          <RefreshCw size={14} className={evaluating ? 'animate-spin' : ''} />
          {evaluating ? 'Evaluating Rules...' : 'Re-run Evaluation'}
        </button>
      </div>

      {/* Coach Guide */}
      <PageGuide
        pageTitle="Financial Coach & Scenarios"
        tagline="Deterministic rules engine detecting anomalies, runway stress conditions, and automated tactical advice."
        steps={[
          {
            title: 'Deterministic Rule Evaluation',
            description: 'The algorithmic rules engine analyzes cash flow patterns, low emergency runway, and budget overages to provide clear financial guidance.',
          },
          {
            title: '3-Month Category Baseline',
            description: 'Compares your current month spend against rolling 90-day averages to flag sudden spending spikes before month-end.',
          },
          {
            title: 'Runway Stress-Testing',
            description: 'Simulates survival duration across Baseline Burn, Lean Mode (-30% discretionary reduction), and Inflation Shock (+15% surge).',
          },
          {
            title: 'Direct Remediation Links',
            description: 'Click the action button on any insight card to navigate directly to the relevant screen (e.g. adjust budget or inspect subscriptions).',
          },
        ]}
        concept={{
          name: 'Deterministic Rules & Rolling Baselines',
          explanation: 'Rather than subjective estimations, the engine evaluates mathematical criteria: runway thresholds (< 3 months), category variance (> 25% above 90-day baseline), and recurring commitment burdens.',
        }}
        proTip="Click 'Re-run Evaluation' anytime you log new transactions or adjust budgets to immediately recalculate anomaly scores."
      />

      {/* AI Strategic Advisor & Executive Next Focus (Layer 2) */}
      <div
        className="ember-glass"
        style={{
          padding: '28px',
          borderLeft: '4px solid var(--color-accent)',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'rgba(255, 59, 31, 0.15)',
                  color: 'var(--color-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Sparkles size={16} />
              </span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>AI Financial Advisor & Strategy</h2>
              <span className="badge badge-planned">Gemini & Heuristic Layer</span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Anonymized executive review analyzing cash flow health, emergency runway, and capital allocation
            </p>
          </div>
          <button
            onClick={() => {
              const subs = store.getSubscriptions().filter(s => s.active);
              const subTotalUsd = subs.reduce((sum, s) => {
                const amt = convertToUsd(s.amountMinor, s.currency);
                if (s.billingCycle === 'yearly') return sum + amt / 12;
                if (s.billingCycle === 'quarterly') return sum + amt / 3;
                return sum + amt;
              }, 0);
              const subBurden = thisMonthIncomeUsd > 0 ? (subTotalUsd / thisMonthIncomeUsd) * 100 : 0;
              const topCats = categorySpikes.slice(0, 3).map(c => ({
                name: c.cat.name,
                amountUsd: Math.round(c.thisMonthUsd),
                percent: Math.round(thisMonthExpenseUsd > 0 ? (c.thisMonthUsd / thisMonthExpenseUsd) * 100 : 0),
              }));
              fetchAiReview(
                thisMonthIncomeUsd,
                thisMonthExpenseUsd,
                thisMonthSavingsRate,
                currentRunway,
                subBurden,
                topCats
              );
            }}
            disabled={loadingAi}
            className="btn btn-secondary btn-sm"
          >
            <Sparkles size={14} className={loadingAi ? 'animate-spin' : ''} />
            <span>{loadingAi ? 'Synthesizing...' : 'Re-analyze with AI'}</span>
          </button>
        </div>

        {loadingAi && !aiReview ? (
          <div className="skeleton" style={{ height: 160, borderRadius: 'var(--radius-md)' }} />
        ) : aiReview ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Executive Diagnosis Banner */}
            <p style={{ fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
              {aiReview.executiveSummary}
            </p>

            {/* Next Focus Highlight Card */}
            <div
              style={{
                padding: '16px 20px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 106, 43, 0.08)',
                border: '1px solid rgba(255, 106, 43, 0.25)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className="badge badge-income" style={{ fontSize: '0.6875rem' }}>NEXT STRATEGIC FOCUS</span>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--ember-orange)' }}>
                  {aiReview.nextFocus.title}
                </h4>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 4 }}>
                {aiReview.nextFocus.explanation}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <strong>Strategic Impact:</strong> {aiReview.nextFocus.impact}
              </p>
            </div>

            {/* 2-Column: Leakages & Opportunities */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              {/* Leakages */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span className="label-uppercase" style={{ color: 'var(--color-warning)', display: 'block', marginBottom: 10 }}>
                  Cost Leakages & Anomalies
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {aiReview.leakages.length === 0 ? (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No critical leakages detected.</p>
                  ) : (
                    aiReview.leakages.map((l, idx) => (
                      <div key={idx} style={{ borderLeft: '2px solid var(--color-warning)', paddingLeft: 10 }}>
                        <h5 style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{l.title}</h5>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{l.details}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Opportunities */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span className="label-uppercase" style={{ color: 'var(--color-income)', display: 'block', marginBottom: 10 }}>
                  Capital Allocation Opportunities
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {aiReview.opportunities.map((o, idx) => (
                    <div key={idx} style={{ borderLeft: '2px solid var(--color-income)', paddingLeft: 10 }}>
                      <h5 style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{o.title}</h5>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{o.strategy}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Runway Stress-Testing Simulation Cards */}
      <div className="ember-glass" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, marginBottom: 4 }}>Runway Scenario Simulation</h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 20 }}>
          Stress-testing how long your current portfolio covers expenses across different economic conditions
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          <div
            style={{
              padding: '18px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span className="label-uppercase">Baseline Average Burn</span>
            <p className="text-money" style={{ marginTop: 6 }}>{currentRunway.toFixed(1)} mo</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Burn rate: {formatMoney(Math.round(avgMonthlyBurnUsd), 'USD')}/mo
            </p>
          </div>

          <div
            style={{
              padding: '18px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span className="label-uppercase">Lean Survival Runway (-30% Burn)</span>
            <p className="text-money" style={{ marginTop: 6, color: 'var(--color-income)' }}>
              {leanRunway.toFixed(1)} mo
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Discretionary spend eliminated
            </p>
          </div>

          <div
            style={{
              padding: '18px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span className="label-uppercase">Inflation Shock (+15% Burn)</span>
            <p className="text-money" style={{ marginTop: 6, color: 'var(--color-warning)' }}>
              {inflationRunway.toFixed(1)} mo
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Higher living costs shock test
            </p>
          </div>
        </div>
      </div>

      {/* Actionable Coach Insights */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3 style={{ fontSize: '1.0625rem', fontWeight: 600 }}>Active Heuristic Findings ({insights.length})</h3>

        {insights.length === 0 ? (
          <div className="ember-glass" style={{ padding: '32px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)' }}>All rules passed smoothly! No active warnings or anomalies detected.</p>
          </div>
        ) : (
          insights.map(i => {
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
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
                  <button
                    onClick={() => handleDismiss(i.id)}
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                  >
                    Dismiss
                  </button>
                </div>

                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginLeft: 38 }}>
                  {i.body}
                </p>

                {i.action && (
                  <div style={{ marginTop: 14, marginLeft: 38, display: 'flex', alignItems: 'center', gap: 12 }}>
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
                      Action: <strong>{i.action}</strong>
                    </span>
                    <button
                      onClick={() => {
                        if (i.action?.toLowerCase().includes('budget')) router.push('/budgets');
                        else if (i.action?.toLowerCase().includes('subscription')) router.push('/subscriptions');
                        else if (i.action?.toLowerCase().includes('goal') || i.action?.toLowerCase().includes('fund')) router.push('/goals');
                        else router.push('/transactions');
                      }}
                      className="btn btn-primary btn-sm"
                      style={{ padding: '3px 10px', fontSize: '0.75rem' }}
                    >
                      Take Action <ArrowRight size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Category Spikes Diagnostics Table */}
      <div className="ember-glass" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 14 }}>
          Category Spending vs. 3-Month Rolling Baseline
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>Category</th>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>3-Month Avg</th>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>This Month</th>
                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'right' }}>Anomaly Delta</th>
              </tr>
            </thead>
            <tbody>
              {categorySpikes.slice(0, 8).map(({ cat, avg3MonthUsd, thisMonthUsd, spikePct }) => (
                <tr key={cat.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color }} />
                    <span style={{ fontWeight: 500 }}>{cat.name}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }} className="ember-number">
                    {formatMoney(Math.round(avg3MonthUsd), 'USD')}
                  </td>
                  <td style={{ padding: '12px 16px' }} className="ember-number">
                    {formatMoney(thisMonthUsd, 'USD')}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }} className="ember-number">
                    <span
                      className={`badge badge-${
                        spikePct > 30 ? 'expense' : spikePct > 0 ? 'pending' : 'income'
                      }`}
                    >
                      {spikePct > 0 ? `+${spikePct.toFixed(0)}%` : `${spikePct.toFixed(0)}%`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
