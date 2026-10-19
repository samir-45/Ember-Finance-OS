'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3, Plus, AlertCircle, TrendingUp, CheckCircle,
  Calendar, Trash2, Edit3, DollarSign
} from 'lucide-react';
import { store } from '@/lib/store';
import { formatMoney, computeBudgetPacing, convertToBdt, convertToUsd } from '@/lib/finance';
import type { Budget, Category, Transaction, Currency } from '@/types';
import { PageGuide } from '@/components/ui/PageGuide';
import { v4 as uuid } from 'uuid';

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [limit, setLimit] = useState('');
  const [currency, setCurrency] = useState<Currency>('BDT');

  const currentMonth = new Date().toISOString().slice(0, 7);

  const refreshData = () => {
    setBudgets(store.getBudgets());
    const cats = store.getCategories().filter(c => c.type === 'expense');
    setCategories(cats);
    setTransactions(store.getTransactions());
    if (cats.length > 0 && !selectedCatId) {
      setSelectedCatId(cats[0].id);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Save or Update Budget
  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const limitNum = parseFloat(limit);
    if (!limitNum || limitNum <= 0 || !selectedCatId) return;

    store.setBudget({
      categoryId: selectedCatId,
      month: currentMonth,
      limitMinor: Math.round(limitNum * 100),
      currency,
    });

    setShowModal(false);
    setLimit('');
    refreshData();
  };

  const handleDeleteBudget = (id: string) => {
    if (confirm('Delete this budget limit?')) {
      store.deleteBudget(id);
      refreshData();
    }
  };

  // Aggregated Summary
  const currentMonthTx = transactions.filter(t => t.date.startsWith(currentMonth) && t.type === 'expense' && t.status === 'done');

  let totalBudgetedBdt = 0;
  let totalSpentBdt = 0;

  budgets.forEach(b => {
    totalBudgetedBdt += convertToBdt(b.limitMinor, b.currency);
    const spent = currentMonthTx
      .filter(t => t.categoryId === b.categoryId)
      .reduce((s, t) => s + convertToBdt(t.amountMinor, t.currency), 0);
    totalSpentBdt += spent;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Monthly Budgets & Pacing</h1>
          <p className="page-subtitle">Linear pacing algorithms, safe daily allowances, and overspending projections</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
          <Plus size={15} /> Set Budget
        </button>
      </div>

      {/* Budgets Guide */}
      <PageGuide
        pageTitle="Monthly Budgets & Pacing"
        tagline="Linear pacing algorithms, safe daily allowances, and predictive month-end run-rate projections."
        steps={[
          {
            title: 'Set Monthly Spending Caps',
            description: 'Click "+ Set Budget" to set maximum spending limits on essential or discretionary categories (like Groceries, Dining, Shopping).',
          },
          {
            title: 'Audit Linear Pacing Status',
            description: 'Ember calculates whether your current spending velocity is ahead or behind what is normal for the current day of the month.',
          },
          {
            title: 'Follow Safe Daily Allowances',
            description: 'Check the "Daily safe allowance" line in each card to know exactly how much you can spend per remaining day without breaking your limit.',
          },
          {
            title: 'Inspect Run-Rate Projections',
            description: 'If you keep your current burn rate, Ember forecasts your final month-end bill before the month closes so you can course-correct early.',
          },
        ]}
        concept={{
          name: 'Burn Run-Rate & Linear Pacing',
          explanation: 'Pacing % compares your actual percentage spent against (currentDay ÷ totalDaysInMonth). Over 115% flags as "Pacing Hot", while over 100% of the limit flags as "Exceeded".',
        }}
        proTip="Set realistic budgets for your top 3 highest spending categories first (e.g. Groceries, Rent, Dining). Guarding these three categories alone protects over 70% of your savings rate."
      />

      {/* High-level Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Total Allocated Budget</span>
          <p className="text-money" style={{ marginTop: 6 }}>{formatMoney(totalBudgetedBdt, 'BDT')}</p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Across {budgets.length} budgeted categories
          </p>
        </div>

        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Month-to-Date Spending</span>
          <p className="text-money" style={{ marginTop: 6, color: totalSpentBdt > totalBudgetedBdt ? 'var(--color-critical)' : 'var(--text-primary)' }}>
            {formatMoney(totalSpentBdt, 'BDT')}
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {totalBudgetedBdt > 0 ? `${((totalSpentBdt / totalBudgetedBdt) * 100).toFixed(0)}% of limit consumed` : 'No limits set'}
          </p>
        </div>

        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Remaining Capacity</span>
          <p className="text-money" style={{ marginTop: 6, color: 'var(--color-income)' }}>
            {formatMoney(Math.max(0, totalBudgetedBdt - totalSpentBdt), 'BDT')}
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Safe buffer for remaining days
          </p>
        </div>
      </div>

      {/* Budgets Grid with Pacing Diagnostics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {budgets.map(b => {
          const cat = categories.find(c => c.id === b.categoryId);
          const spentThisMonth = currentMonthTx
            .filter(t => t.categoryId === b.categoryId)
            .reduce((sum, t) => {
              if (t.currency === b.currency) return sum + t.amountMinor;
              if (b.currency === 'USD') return sum + convertToUsd(t.amountMinor, t.currency);
              return sum + convertToBdt(t.amountMinor, t.currency);
            }, 0);

          const pacing = computeBudgetPacing(spentThisMonth, b.limitMinor);
          const percentage = Math.round((spentThisMonth / Math.max(b.limitMinor, 1)) * 100);

          return (
            <div
              key={b.id}
              className="ember-glass"
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: cat?.color || '#fff' }} />
                    <h3 style={{ fontSize: '1.0625rem', fontWeight: 600 }}>{cat?.name || 'Category'}</h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      className={`badge badge-${
                        pacing.status === 'exceeded'
                          ? 'expense'
                          : pacing.status === 'warning'
                          ? 'pending'
                          : 'income'
                      }`}
                    >
                      {pacing.status === 'exceeded'
                        ? 'Exceeded'
                        : pacing.status === 'warning'
                        ? 'Pacing Hot'
                        : pacing.status === 'under'
                        ? 'Pacing Under'
                        : 'On Track'}
                    </span>
                    <button
                      onClick={() => handleDeleteBudget(b.id)}
                      className="btn btn-ghost btn-icon"
                      style={{ color: 'var(--color-critical)', padding: 4, width: 24, height: 24 }}
                      title="Remove Budget"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Progress Meter */}
                <div className="progress-bar" style={{ height: 8, margin: '14px 0' }}>
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${Math.min(percentage, 100)}%`,
                      background:
                        pacing.status === 'exceeded'
                          ? 'var(--color-critical)'
                          : pacing.status === 'warning'
                          ? 'var(--color-warning)'
                          : cat?.color || 'var(--color-accent)',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: 16 }}>
                  <span>
                    Spent: <strong className="ember-number">{formatMoney(spentThisMonth, b.currency)}</strong>
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Limit: {formatMoney(b.limitMinor, b.currency)} ({percentage}%)
                  </span>
                </div>

                {/* Algorithmic Pacing Breakdown */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    fontSize: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Daily safe allowance:</span>
                    <span className="ember-number" style={{ fontWeight: 600 }}>
                      {formatMoney(pacing.dailyAllowanceMinor, b.currency)}/day
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Run-rate projection:</span>
                    <span
                      className="ember-number"
                      style={{
                        fontWeight: 600,
                        color: pacing.projectedMonthEndMinor > b.limitMinor ? 'var(--color-critical)' : 'inherit',
                      }}
                    >
                      {formatMoney(pacing.projectedMonthEndMinor, b.currency)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Days remaining:</span>
                    <span className="ember-number">{pacing.daysRemaining} days</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Set Budget Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 20 }}>Configure Category Budget</h2>
            <form onSubmit={handleSaveBudget} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Category</label>
                <select
                  value={selectedCatId}
                  onChange={e => setSelectedCatId(e.target.value)}
                  className="input"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id} style={{ background: '#111' }}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
                <div>
                  <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Monthly Limit</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 5000"
                    value={limit}
                    onChange={e => setLimit(e.target.value)}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Currency</label>
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value as Currency)}
                    className="input"
                  >
                    <option value="BDT" style={{ background: '#111' }}>BDT (৳)</option>
                    <option value="USD" style={{ background: '#111' }}>USD ($)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
