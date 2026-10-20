'use client';
import { localMonth, shiftMonth } from '@/lib/dates';
import {
  compute503020Analysis,
  dateLabel,
  downloadFile,
  exportTransactionsCsv,
  formatMoney,
  getFinancialTransactions,
  monthLabel,
  monthlyTotals,
} from '@/lib/finance';
import { store } from '@/lib/store';
import { isSettled } from '@/lib/ledger';
import { useLedgerVersion } from '@/lib/use-ledger';
import type { Currency } from '@/types';
import { useState } from 'react';
export default function ReportsPage() {
  useLedgerVersion();
  const s = store.getSnapshot();
  const [currency, setCurrency] = useState<Currency>(s.settings.baseCurrency);
  const [selectedMonth, setSelectedMonth] = useState(localMonth());
  const [range, setRange] = useState('6');
  const rows = getFinancialTransactions(s).filter((t) => isSettled(t));
  const first = rows.map((t) => t.date.slice(0, 7)).sort()[0] ?? selectedMonth;
  const periods: string[] = [];
  const limit = range === 'all' ? 1200 : Number(range);
  for (let i = 0; i < limit; i++) {
    const m = shiftMonth(selectedMonth, -i);
    if (range === 'all' && m < first) break;
    periods.unshift(m);
  }
  const flows = periods.map((m) => monthlyTotals(m, s));
  const transfers = s.transfers.filter((t) => periods.includes(t.date.slice(0, 7)) && isSettled(t));
  const buckets = compute503020Analysis(
    rows.filter((t) => t.date.startsWith(selectedMonth)),
    s.categories,
  );
  const value = (pair: { usdMinor: number; bdtMinor: number }) =>
    currency === 'USD' ? pair.usdMinor : pair.bdtMinor;
  const forwards = transfers.filter(
    (t) =>
      s.accounts.find((a) => a.id === t.fromAccountId)?.currency === 'USD' &&
      s.accounts.find((a) => a.id === t.toAccountId)?.currency === 'BDT',
  );
  const usdDebited = forwards.reduce(
      (n, t) => n + t.amountOutMinor + (t.feeCurrency === 'USD' ? t.feeMinor : 0),
      0,
    ),
    bdtReceived = forwards.reduce(
      (n, t) => n + t.amountInMinor - (t.feeCurrency === 'BDT' ? t.feeMinor : 0),
      0,
    );
  return (
    <div className="settings-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">
            Cash flow, original-currency transfers, and complete ledger exports
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => downloadFile(exportTransactionsCsv(), 'ember-ledger.csv')}
        >
          Export complete ledger CSV
        </button>
      </div>
      <section className="ember-glass settings-card action-row">
        <label htmlFor="report-month">
          Through month
          <input
            id="report-month"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value || localMonth())}
          />
        </label>
        <label htmlFor="report-range">
          History
          <select
            id="report-range"
            className="input"
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            <option value="3">3 months</option>
            <option value="6">6 months</option>
            <option value="all">All history (up to 100 years)</option>
          </select>
        </label>
        <label htmlFor="report-currency">
          Reporting currency
          <select
            id="report-currency"
            className="input"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
          >
            <option>BDT</option>
            <option>USD</option>
          </select>
        </label>
      </section>
      <p className="page-subtitle">
        Converted entries use their saved reporting rate. Legacy entries use the reference rate
        captured when imported, which may differ from the original bank quote. Principal transfers
        are excluded from cash flow; transfer fees are included once.
      </p>
      <section className="ember-glass settings-card">
        <h2>Monthly cash flow</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Income</th>
                <th>Expenses including fees</th>
                <th>Surplus / deficit</th>
                <th>Savings rate</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((p) => {
                const income = value(p.income),
                  expense = value(p.expenses),
                  net = income - expense;
                return (
                  <tr key={p.month}>
                    <td>{monthLabel(p.month)}</td>
                    <td>{formatMoney(income, currency)}</td>
                    <td>{formatMoney(expense, currency)}</td>
                    <td style={{ color: net < 0 ? 'var(--color-expense)' : 'var(--color-income)' }}>
                      {formatMoney(net, currency)}
                    </td>
                    <td>{income > 0 ? `${((net / income) * 100).toFixed(1)}%` : 'No income'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="ember-glass settings-card">
        <h2>{monthLabel(selectedMonth)} allocation review</h2>
        <p>
          Category groups are configurable in Settings. Giving is included with essential
          commitments in this three-bucket comparison. Negative savings indicates a deficit.
        </p>
        <div className="report-buckets">
          {[buckets.needs, buckets.wants, buckets.savings].map((b) => (
            <article key={b.name}>
              <h3>{b.name}</h3>
              <p>
                {formatMoney(currency === 'USD' ? b.amountUsdMinor : b.amountBdtMinor, currency)}
              </p>
              <p>
                {buckets.totalIncomeUsdMinor > 0
                  ? `${b.actualPct.toFixed(1)}% of income`
                  : 'No income denominator'}{' '}
                · target {b.targetPct}%
              </p>
            </article>
          ))}
        </div>
      </section>
      <section className="ember-glass settings-card">
        <h2>Actual transfers</h2>
        <p>
          {usdDebited > 0
            ? `Weighted effective USD → BDT rate after fees: ${(bdtReceived / usdDebited).toFixed(4)} BDT per USD`
            : 'No settled USD → BDT conversions in this period.'}
        </p>
        {transfers.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>From / principal debit</th>
                  <th>To / principal credit</th>
                  <th>Fee</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => {
                  const from = s.accounts.find((a) => a.id === t.fromAccountId)!,
                    to = s.accounts.find((a) => a.id === t.toAccountId)!;
                  return (
                    <tr key={t.id}>
                      <td>{dateLabel(t.date)}</td>
                      <td>
                        {from.name}
                        <br />
                        {formatMoney(t.amountOutMinor, from.currency)}
                      </td>
                      <td>
                        {to.name}
                        <br />
                        {formatMoney(t.amountInMinor, to.currency)}
                      </td>
                      <td>{formatMoney(t.feeMinor, t.feeCurrency)}</td>
                      <td>{t.status ?? 'done'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No settled transfers for this period.</p>
        )}
      </section>
    </div>
  );
}
