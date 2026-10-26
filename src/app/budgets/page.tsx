'use client';
import { localMonth } from '@/lib/dates';
import { useLedgerVersion } from '@/lib/use-ledger';

import { Dialog } from '@/components/ui/Dialog';
import {
  categoryContains,
  computeBudgetPacing,
  convertToBdt,
  formatMoney,
  getFinancialTransactions,
  reportingBdt,
  reportingUsd,
  toMinor,
} from '@/lib/finance';
import { store } from '@/lib/store';
import { isSettled } from '@/lib/ledger';
import type { Budget, Category, Currency, Transaction } from '@/types';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function BudgetsPage() {
  const ledgerVersion = useLedgerVersion();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [limit, setLimit] = useState('');
  const [currency, setCurrency] = useState<Currency>('BDT');

  const [currentMonth, setCurrentMonth] = useState(localMonth());

  const refreshData = () => {
    setBudgets(store.getBudgets().filter((b) => b.month === currentMonth));
    const cats = store.getCategories().filter((c) => c.type === 'expense');
    setCategories(cats);
    setTransactions(getFinancialTransactions());
    if (cats.length > 0 && !selectedCatId) {
      setSelectedCatId(cats[0].id);
    }
  };

  useEffect(() => {
    refreshData();
  }, [ledgerVersion, currentMonth]);

  // Save or Update Budget
  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const limitNum = parseFloat(limit);
    if (!Number.isFinite(limitNum) || limitNum <= 0 || !selectedCatId)
      throw new Error('Choose an expense category and positive budget limit');

    store.setBudget({
      categoryId: selectedCatId,
      month: currentMonth,
      limitMinor: toMinor(limit),
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
  const currentMonthTx = transactions.filter(
    (t) => t.date.startsWith(currentMonth) && t.type === 'expense' && isSettled(t),
  );

  let totalBudgetedBdt = 0;
  let totalSpentBdt = 0;

  const summaryBudgets = budgets.filter(
    (b) =>
      !budgets.some(
        (parent) => parent.id !== b.id && categoryContains(parent.categoryId, b.categoryId),
      ),
  );
  summaryBudgets.forEach((b) => {
    totalBudgetedBdt += convertToBdt(b.limitMinor, b.currency);
    const spent = currentMonthTx
      .filter((t) => categoryContains(b.categoryId, t.categoryId))
      .reduce((s, t) => s + reportingBdt(t), 0);
    totalSpentBdt += spent;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Budgets</h1>
          <p className="page-subtitle">
            Category limits and estimated pacing for variable spending
          </p>
        </div>
        <label className="month-picker">
          Month
          <input
            aria-label="Budget month"
            type="month"
            value={currentMonth}
            onChange={(e) => setCurrentMonth(e.target.value || localMonth())}
          />
        </label>
        <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
          <Plus size={15} /> Set Budget
        </button>
      </div>

      {store.getBudgets().some((b) => b.month === 'unassigned') && (
        <section className="ember-glass settings-card">
          <h2>Legacy budgets need a month</h2>
          <p>
            These records had no saved calendar month. Assign them explicitly instead of guessing.
          </p>
          {store
            .getBudgets()
            .filter((b) => b.month === 'unassigned')
            .map((b) => (
              <div key={b.id} className="action-row">
                <span>
                  {categories.find((c) => c.id === b.categoryId)?.name} ·{' '}
                  {formatMoney(b.limitMinor, b.currency)}
                </span>
                <button
                  className="btn btn-secondary"
                  onClick={() => store.updateBudget(b.id, { month: currentMonth })}
                >
                  Assign to selected month
                </button>
                <button className="btn btn-danger" onClick={() => handleDeleteBudget(b.id)}>
                  Delete
                </button>
              </div>
            ))}
        </section>
      )}
      <p className="page-subtitle">
        Daily amounts assume even spending through the month, so they suit groceries or transport
        better than rent paid on the 1st.
      </p>
      {/* High-level Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
          gap: 16,
        }}
      >
        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Budgeted</span>
          <p className="text-money" style={{ marginTop: 6 }}>
            {formatMoney(totalBudgetedBdt, 'BDT')}
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Across {budgets.length} budgeted categories
          </p>
        </div>

        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Spent so far</span>
          <p
            className="text-money"
            style={{
              marginTop: 6,
              color:
                totalSpentBdt > totalBudgetedBdt ? 'var(--color-critical)' : 'var(--text-primary)',
            }}
          >
            {formatMoney(totalSpentBdt, 'BDT')}
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {totalBudgetedBdt > 0
              ? `${((totalSpentBdt / totalBudgetedBdt) * 100).toFixed(0)}% of limit consumed`
              : 'No limits set'}
          </p>
        </div>

        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Left to spend</span>
          <p className="text-money" style={{ marginTop: 6, color: 'var(--color-income)' }}>
            {formatMoney(Math.max(0, totalBudgetedBdt - totalSpentBdt), 'BDT')}
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
            For the rest of the month
          </p>
        </div>
      </div>

      {/* Budgets Grid with Pacing Diagnostics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: 20,
        }}
      >
        {budgets.map((b) => {
          const cat = categories.find((c) => c.id === b.categoryId);
          const spentThisMonth = currentMonthTx
            .filter((t) => categoryContains(b.categoryId, t.categoryId))
            .reduce((sum, t) => {
              if (t.currency === b.currency) return sum + t.amountMinor;
              if (b.currency === 'USD') return sum + reportingUsd(t);
              return sum + reportingBdt(t);
            }, 0);

          const pacingDate =
            currentMonth === localMonth()
              ? new Date()
              : new Date(
                  currentMonth + (currentMonth < localMonth() ? '-28T12:00:00Z' : '-01T12:00:00Z'),
                );
          const pacing = computeBudgetPacing(spentThisMonth, b.limitMinor, pacingDate);
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
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: cat?.color || '#fff',
                      }}
                    />
                    <h3 style={{ fontSize: '1.0625rem', fontWeight: 600 }}>
                      {cat?.name || 'Category'}
                    </h3>
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
                          ? 'Spending fast'
                          : pacing.status === 'under'
                            ? 'Under budget'
                            : 'On Track'}
                    </span>
                    <button
                      onClick={() => handleDeleteBudget(b.id)}
                      className="btn btn-ghost btn-icon"
                      style={{ color: 'var(--color-critical)' }}
                      title="Remove budget"
                      aria-label={`Remove ${cat?.name ?? 'this'} budget`}
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

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.875rem',
                    marginBottom: 16,
                  }}
                >
                  <span>
                    Spent:{' '}
                    <strong className="ember-number">
                      {formatMoney(spentThisMonth, b.currency)}
                    </strong>
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
                    <span style={{ color: 'var(--text-muted)' }}>You can spend per day:</span>
                    <span className="ember-number" style={{ fontWeight: 600 }}>
                      {formatMoney(pacing.dailyAllowanceMinor, b.currency)}/day
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>At this pace, month end:</span>
                    <span
                      className="ember-number"
                      style={{
                        fontWeight: 600,
                        color:
                          pacing.projectedMonthEndMinor > b.limitMinor
                            ? 'var(--color-critical)'
                            : 'inherit',
                      }}
                    >
                      {formatMoney(pacing.projectedMonthEndMinor, b.currency)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Days left:</span>
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
        <Dialog title="Configure Category Budget" onClose={() => setShowModal(false)}>
          <form
            onSubmit={handleSaveBudget}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div>
              <label
                htmlFor="budgets-field-0"
                className="label-uppercase"
                style={{ display: 'block', marginBottom: 6 }}
              >
                Category
              </label>
              <select
                id="budgets-field-0"
                value={selectedCatId}
                onChange={(e) => setSelectedCatId(e.target.value)}
                className="input"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id} style={{ background: '#111' }}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
              <div>
                <label
                  htmlFor="budgets-field-1"
                  className="label-uppercase"
                  style={{ display: 'block', marginBottom: 6 }}
                >
                  Monthly Limit
                </label>
                <input
                  id="budgets-field-1"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 5000"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="budgets-field-2"
                  className="label-uppercase"
                  style={{ display: 'block', marginBottom: 6 }}
                >
                  Currency
                </label>
                <select
                  id="budgets-field-2"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  className="input"
                >
                  <option value="BDT" style={{ background: '#111' }}>
                    BDT (৳)
                  </option>
                  <option value="USD" style={{ background: '#111' }}>
                    USD ($)
                  </option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Budget
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
