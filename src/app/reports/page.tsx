'use client';

import { useState, useEffect } from 'react';
import { Download, FileSpreadsheet, PieChart, TrendingUp, TrendingDown } from 'lucide-react';
import { store } from '@/lib/store';
import { exportTransactionsCsv, computeDashboard, formatMoney } from '@/lib/finance';
import type { DashboardData, Currency } from '@/types';

export default function ReportsPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [currency, setCurrency] = useState<Currency>('BDT');

  useEffect(() => {
    setData(computeDashboard());
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Reports</h1>
          <p className="page-subtitle">Exportable ledgers, income statements, and cash flow summaries</p>
        </div>
        <button onClick={handleDownloadCsv} className="btn btn-primary btn-sm">
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Net Savings Rate</span>
          <p className="text-money" style={{ marginTop: 8, color: 'var(--color-income)' }}>
            {data.savingsRatePercent.toFixed(1)}%
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Healthy benchmark: {'>'} 20%
          </p>
        </div>

        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Runway Coverage</span>
          <p className="text-money" style={{ marginTop: 8 }}>
            {data.runwayMonths.toFixed(1)} mo
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Cash reserves at average burn rate
          </p>
        </div>

        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Total Records</span>
          <p className="text-money" style={{ marginTop: 8 }}>
            {data.recentTransactions.length}+
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Tracked across 6 months
          </p>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="ember-glass" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Historical Cash Flow Breakdown</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>Month</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>Income</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>Expenses</th>
              <th style={{ padding: '12px 16px', fontWeight: 500, textAlign: 'right' }}>Net Retained</th>
            </tr>
          </thead>
          <tbody>
            {data.cashFlow.map(p => {
              const inc = p.income.bdtMinor;
              const exp = p.expenses.bdtMinor;
              const net = inc - exp;

              return (
                <tr key={p.month} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>{p.month}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-income)' }} className="ember-number">
                    +{formatMoney(inc, 'BDT')}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-expense)' }} className="ember-number">
                    −{formatMoney(exp, 'BDT')}
                  </td>
                  <td
                    style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: net >= 0 ? 'var(--color-income)' : 'var(--color-expense)',
                    }}
                    className="ember-number"
                  >
                    {net >= 0 ? '+' : '−'}{formatMoney(Math.abs(net), 'BDT')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
