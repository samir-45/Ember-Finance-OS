'use client';

import { useState, useEffect } from 'react';
import {
  Download, FileSpreadsheet, PieChart, TrendingUp,
  TrendingDown, DollarSign, ArrowLeftRight, CheckCircle2,
  Calendar, Layers, ShieldCheck
} from 'lucide-react';
import { store } from '@/lib/store';
import {
  exportTransactionsCsv, computeDashboard, formatMoney,
  compute503020Analysis, convertToBdt, convertToUsd,
  getConversionRate, dateLabel
} from '@/lib/finance';
import type { DashboardData, Currency, Transaction, Transfer } from '@/types';
import { PageGuide } from '@/components/ui/PageGuide';

export default function ReportsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [currency, setCurrency] = useState<Currency>('BDT');
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | 'all'>('6m');
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  useEffect(() => {
    setData(computeDashboard());
    setTransfers(store.getTransfers());
  }, []);

  const handleDownloadCsv = () => {
    const csvContent = exportTransactionsCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ember_transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!data) return <div className="skeleton" style={{ height: 400 }} />;

  const transactions = store.getTransactions().filter(t => t.status === 'done');
  const categories = store.getCategories();
  const rate = getConversionRate();

  // 50/30/20 Analysis for current month
  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonthTx = transactions.filter(t => t.date.startsWith(currentMonth));
  const bucketAnalysis = compute503020Analysis(thisMonthTx, categories, rate);

  // FX Audit Calculations
  const totalFeesPaidUsd = transfers.reduce(
    (sum, t) => sum + convertToUsd(t.feeMinor, t.feeCurrency),
    0
  );
  const avgRealizedRate = transfers.length > 0
    ? transfers.reduce((sum, t) => sum + t.exchangeRate, 0) / transfers.length
    : rate;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Intelligence Reports</h1>
          <p className="page-subtitle">Multi-currency cash flow statements, 50/30/20 variance, and FX conversion audits</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="tab-bar">
            {(['BDT', 'USD'] as const).map(c => (
              <button
                key={c}
                className={`tab-item ${currency === c ? 'active' : ''}`}
                onClick={() => setCurrency(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <button onClick={handleDownloadCsv} className="btn btn-primary btn-sm">
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* Reports Guide */}
      <PageGuide
        pageTitle="Financial Intelligence & Reports"
        tagline="Multi-currency statements, 50/30/20 standard budget allocation audits, and FX transaction ledgers."
        steps={[
          {
            title: 'Select Reporting Currency',
            description: 'Switch between BDT and USD at the top to evaluate metrics in your base operational currency.',
          },
          {
            title: 'Audit 50/30/20 Allocation',
            description: 'Inspect your monthly distribution against classic macro benchmarks: Needs (50%), Wants (30%), and Savings (20%).',
          },
          {
            title: 'Review FX Conversion Ledger',
            description: 'Audit international currency conversions, realized exchange rates, and total conversion fee leakages.',
          },
          {
            title: 'Export Raw Ledger CSV',
            description: 'Click "Export CSV" to generate a standardized comma-separated export of all recorded transactions for tax or spreadsheet analysis.',
          },
        ]}
        concept={{
          name: '50/30/20 Rule & Realized FX Variance',
          explanation: 'The 50/30/20 framework splits outgoings into essentials (Needs), discretionary lifestyle (Wants), and future wealth (Savings). Realized FX audits ensure hidden banking spread markups do not erode cross-border earnings.',
        }}
        proTip="If your 'Wants' category exceeds 30%, inspect your category budget bars in the Budgets section to set hard limits before month-end."
      />

      {/* High-level KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Net Savings Rate</span>
          <p className="text-money" style={{ marginTop: 6, color: 'var(--color-income)' }}>
            {data.savingsRatePercent.toFixed(1)}%
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Benchmark: ≥ 20.0%
          </p>
        </div>

        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Runway Coverage</span>
          <p className="text-money" style={{ marginTop: 6 }}>
            {data.runwayMonths.toFixed(1)} mo
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Liquid cash at rolling burn
          </p>
        </div>

        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Total FX Conversion Fees</span>
          <p className="text-money" style={{ marginTop: 6, color: 'var(--color-warning)' }}>
            {formatMoney(totalFeesPaidUsd, 'USD')}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Paid across {transfers.length} transfers
          </p>
        </div>

        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Average Realized Rate</span>
          <p className="text-money" style={{ marginTop: 6 }}>
            {avgRealizedRate.toFixed(2)}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            BDT per USD converted
          </p>
        </div>
      </div>

      {/* 50/30/20 Standard Budget Analysis */}
      <div className="ember-glass" style={{ padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 600 }}>50/30/20 Allocation Variance Audit</h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Needs (50%), Discretionary Wants (30%), and Retained Savings (20%)
            </p>
          </div>
          <span className="badge badge-planned">This Month</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {[bucketAnalysis.needs, bucketAnalysis.wants, bucketAnalysis.savings].map(bucket => {
            const isOverTarget = bucket.name !== 'Savings' && bucket.actualPct > bucket.targetPct;
            const isUnderSavings = bucket.name === 'Savings' && bucket.actualPct < bucket.targetPct;
            const hasIssue = isOverTarget || isUnderSavings;

            return (
              <div
                key={bucket.name}
                style={{
                  padding: '18px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{bucket.name}</span>
                  <span
                    className={`badge badge-${hasIssue ? 'pending' : 'income'}`}
                  >
                    Target: {bucket.targetPct}%
                  </span>
                </div>

                <div className="progress-bar" style={{ height: 8, margin: '12px 0' }}>
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${Math.min(bucket.actualPct, 100)}%`,
                      background: hasIssue ? 'var(--color-warning)' : 'var(--color-income)',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Actual: <strong className="ember-number">{bucket.actualPct.toFixed(1)}%</strong>
                  </span>
                  <span className="ember-number" style={{ color: 'var(--text-muted)' }}>
                    {formatMoney(currency === 'USD' ? bucket.amountUsdMinor : bucket.amountBdtMinor, currency)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historical Monthly Cash Flow Statement */}
      <div className="ember-glass" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Historical Cash Flow Statement</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>Month</th>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>Gross Inflow</th>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>Total Outflow</th>
                <th style={{ padding: '12px 16px', fontWeight: 500 }}>Retained Surplus</th>
                <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'right' }}>Savings Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.cashFlow.map(p => {
                const inc = currency === 'USD' ? p.income.usdMinor : p.income.bdtMinor;
                const exp = currency === 'USD' ? p.expenses.usdMinor : p.expenses.bdtMinor;
                const net = inc - exp;
                const ratePct = inc > 0 ? (net / inc) * 100 : 0;

                return (
                  <tr key={p.month} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }}>{p.month}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--color-income)' }} className="ember-number">
                      +{formatMoney(inc, currency)}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--color-expense)' }} className="ember-number">
                      −{formatMoney(exp, currency)}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontWeight: 600,
                        color: net >= 0 ? 'var(--color-income)' : 'var(--color-expense)',
                      }}
                      className="ember-number"
                    >
                      {net >= 0 ? '+' : '−'}{formatMoney(Math.abs(net), currency)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }} className="ember-number">
                      <span className={`badge badge-${ratePct >= 20 ? 'income' : 'pending'}`}>
                        {ratePct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* FX Conversion Transfers Audit */}
      <div className="ember-glass" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Currency Conversion Audit Log</h3>
        {transfers.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
            No international transfers recorded yet.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Date</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Outflow (USD)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Inflow (BDT)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500 }}>Realized Rate</th>
                  <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'right' }}>Transfer Fee</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map(tr => (
                  <tr key={tr.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{dateLabel(tr.date)}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 500 }} className="ember-number">
                      ${(tr.amountOutMinor / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--color-income)' }} className="ember-number">
                      ৳{(tr.amountInMinor / 100).toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px' }} className="ember-number">
                      {tr.exchangeRate.toFixed(2)} BDT/USD
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--color-warning)' }} className="ember-number">
                      ${(tr.feeMinor / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
