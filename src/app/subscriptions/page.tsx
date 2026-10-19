'use client';

import { useState, useEffect } from 'react';
import {
  Repeat2, Plus, Clock, CheckCircle2, PauseCircle,
  Calendar, Trash2, Edit3, DollarSign, Zap, Check
} from 'lucide-react';
import { store } from '@/lib/store';
import {
  formatMoney, dateLabel, computeSubscriptionMetrics,
  getConversionRate, convertToUsd
} from '@/lib/finance';
import type { Subscription, Currency, Account, Category } from '@/types';
import { PageGuide } from '@/components/ui/PageGuide';
import { v4 as uuid } from 'uuid';

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);

  // Form
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [billingCycle, setBillingCycle] = useState<Subscription['billingCycle']>('monthly');
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const refreshData = () => {
    const subs = store.getSubscriptions();
    setSubscriptions(subs);
    const accs = store.getAccounts();
    setAccounts(accs);
    const cats = store.getCategories();
    setCategories(cats);
    if (accs.length > 0 && !accountId) setAccountId(accs[0].id);
    if (cats.length > 0 && !categoryId) setCategoryId(cats[0].id);
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Compute 3-month rolling average monthly income for burden ratio
  const transactions = store.getTransactions();
  const now = new Date();
  let threeMonthIncomeUsd = 0;
  for (let i = -2; i <= 0; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const m = d.toISOString().slice(0, 7);
    const mInc = transactions
      .filter(t => t.date.startsWith(m) && t.type === 'income' && t.status === 'done')
      .reduce((s, t) => s + convertToUsd(t.amountMinor, t.currency), 0);
    threeMonthIncomeUsd += mInc;
  }
  const avgMonthlyIncomeUsd = threeMonthIncomeUsd / 3;

  const metrics = computeSubscriptionMetrics(subscriptions, avgMonthlyIncomeUsd);

  // Toggle Active
  const handleToggle = (id: string) => {
    const sub = subscriptions.find(s => s.id === id);
    if (!sub) return;
    store.updateSubscription(id, { active: !sub.active });
    refreshData();
  };

  // Delete
  const handleDelete = (id: string) => {
    if (confirm('Delete this subscription?')) {
      store.deleteSubscription(id);
      refreshData();
    }
  };

  // Record Payment / Renew
  const handleMarkPaid = (sub: Subscription) => {
    const newTx = {
      id: uuid(),
      accountId: sub.accountId,
      categoryId: sub.categoryId,
      transferId: null,
      type: 'expense' as const,
      amountMinor: sub.amountMinor,
      currency: sub.currency,
      merchant: sub.name,
      note: `Renewal charge for ${sub.name}`,
      date: new Date().toISOString().slice(0, 10),
      tags: ['subscription', 'renewal'],
      paymentMethod: 'Auto Debit',
      status: 'done' as const,
      createdAt: new Date().toISOString(),
    };
    store.createTransaction(newTx);

    // Bump next billing date forward by 1 cycle
    const currentNext = new Date(sub.nextBillingDate);
    if (sub.billingCycle === 'monthly') currentNext.setMonth(currentNext.getMonth() + 1);
    else if (sub.billingCycle === 'yearly') currentNext.setFullYear(currentNext.getFullYear() + 1);
    else if (sub.billingCycle === 'quarterly') currentNext.setMonth(currentNext.getMonth() + 3);

    store.updateSubscription(sub.id, {
      nextBillingDate: currentNext.toISOString().slice(0, 10),
    });
    refreshData();
    alert(`Recorded payment for ${sub.name} and updated next billing cycle.`);
  };

  // Save or Update Subscription
  const handleSaveSub = (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(amount);
    if (!name || !amtNum || amtNum <= 0) return;

    if (editingSub) {
      store.updateSubscription(editingSub.id, {
        name,
        amountMinor: Math.round(amtNum * 100),
        currency,
        billingCycle,
        nextBillingDate: nextBillingDate || new Date().toISOString().slice(0, 10),
        accountId,
        categoryId,
      });
      setEditingSub(null);
    } else {
      store.createSubscription({
        name,
        amountMinor: Math.round(amtNum * 100),
        currency,
        billingCycle,
        nextBillingDate: nextBillingDate || new Date().toISOString().slice(0, 10),
        accountId,
        categoryId,
        active: true,
        createdAt: new Date().toISOString(),
      });
    }

    setShowModal(false);
    setName('');
    setAmount('');
    refreshData();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Subscriptions & Recurring Load</h1>
          <p className="page-subtitle">SaaS licenses, normalized monthly run rates, and renewal audits</p>
        </div>
        <button
          onClick={() => {
            setEditingSub(null);
            setName('');
            setAmount('');
            setNextBillingDate(new Date().toISOString().slice(0, 10));
            setShowModal(true);
          }}
          className="btn btn-primary btn-sm"
        >
          <Plus size={15} /> Add Subscription
        </button>
      </div>

      {/* Subscriptions Guide */}
      <PageGuide
        pageTitle="Subscriptions & Recurring Commitments"
        tagline="Track SaaS licenses, normalize billing frequencies, and audit recurring overhead."
        steps={[
          {
            title: 'Catalog Commitments',
            description: 'Add active recurring services, choosing their billing cycle (monthly, quarterly, or yearly) and source account.',
          },
          {
            title: 'Normalize MRE & ARR',
            description: 'The engine normalizes different billing cycles into standard Monthly Recurring Expense (MRE) and Annual Run Rate (ARR).',
          },
          {
            title: 'Audit Burden Ratio',
            description: 'Monitor the Income Burden Ratio. A healthy benchmark is keeping recurring commitments under 5% of monthly cash flow.',
          },
          {
            title: 'One-Click Renewal Logging',
            description: 'Click "Record Renewal" on any card to instantly log an expense transaction and automatically advance the next billing date by one cycle.',
          },
        ]}
        concept={{
          name: 'Recurring Burden Ratio & MRE Normalization',
          explanation: 'MRE standardizes annual charges (÷12) and quarterly charges (÷3) into monthly burn. Burden Ratio contrasts this against your 3-month rolling average income to identify creep before it impacts savings.',
        }}
        proTip="Toggle any subscription to 'Paused' if you are taking a break from the service—this preserves the record and immediately recalculates your true active monthly burn rate."
      />

      {/* Analytics Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Monthly Recurring Expense</span>
          <p className="text-money" style={{ marginTop: 6 }}>{formatMoney(metrics.mreUsdMinor, 'USD')}</p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
            ≈ {formatMoney(metrics.mreBdtMinor, 'BDT')}/month
          </p>
        </div>

        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Annualized Cost (ARR)</span>
          <p className="text-money" style={{ marginTop: 6, color: 'var(--color-accent)' }}>
            {formatMoney(metrics.arrUsdMinor, 'USD')}
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Normalized over 12 months
          </p>
        </div>

        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Income Burden Ratio</span>
          <p
            className="text-money"
            style={{
              marginTop: 6,
              color: metrics.subToIncomeRatio > 5 ? 'var(--color-warning)' : 'var(--color-income)',
            }}
          >
            {metrics.subToIncomeRatio.toFixed(1)}%
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {metrics.subToIncomeRatio <= 5 ? 'Healthy (under 5% ceiling)' : 'Elevated overhead'}
          </p>
        </div>

        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Subscription Count</span>
          <p className="text-money" style={{ marginTop: 6 }}>{metrics.activeCount}</p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {metrics.pausedCount} paused licenses
          </p>
        </div>
      </div>

      {/* Subscriptions Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {subscriptions.map(s => {
          const acc = accounts.find(a => a.id === s.accountId);
          const cat = categories.find(c => c.id === s.categoryId);

          return (
            <div
              key={s.id}
              className="ember-glass"
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                opacity: s.active ? 1 : 0.6,
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{s.name}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: 2 }}>
                      {s.billingCycle} billing · {acc?.name || 'Account'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => handleToggle(s.id)}
                      className={`btn btn-sm ${s.active ? 'btn-ghost' : 'btn-secondary'}`}
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                    >
                      {s.active ? (
                        <span style={{ color: 'var(--color-income)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={13} /> Active
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <PauseCircle size={13} /> Paused
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="btn btn-ghost btn-icon"
                      style={{ color: 'var(--color-critical)', padding: 4, width: 26, height: 26 }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div style={{ margin: '14px 0' }}>
                  <p className="text-money">{formatMoney(s.amountMinor, s.currency)}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    <Calendar size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    Next renewal: <strong>{dateLabel(s.nextBillingDate)}</strong>
                  </p>
                </div>
              </div>

              <div
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Category: {cat?.name || 'General'}
                </span>
                <button
                  onClick={() => handleMarkPaid(s)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem' }}
                >
                  <Check size={13} /> Record Renewal
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Subscription Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 20 }}>
              {editingSub ? 'Edit Subscription' : 'Track New Subscription'}
            </h2>
            <form onSubmit={handleSaveSub} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Service Name</label>
                <input
                  type="text"
                  placeholder="e.g. GitHub Copilot, Netflix, Notion"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
                <div>
                  <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
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
                    <option value="USD" style={{ background: '#111' }}>USD ($)</option>
                    <option value="BDT" style={{ background: '#111' }}>BDT (৳)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Billing Cycle</label>
                  <select
                    value={billingCycle}
                    onChange={e => setBillingCycle(e.target.value as Subscription['billingCycle'])}
                    className="input"
                  >
                    <option value="monthly" style={{ background: '#111' }}>Monthly</option>
                    <option value="yearly" style={{ background: '#111' }}>Yearly</option>
                    <option value="quarterly" style={{ background: '#111' }}>Quarterly</option>
                    <option value="weekly" style={{ background: '#111' }}>Weekly</option>
                  </select>
                </div>
                <div>
                  <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Next Renewal Date</label>
                  <input
                    type="date"
                    value={nextBillingDate}
                    onChange={e => setNextBillingDate(e.target.value)}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Paid From</label>
                  <select
                    value={accountId}
                    onChange={e => setAccountId(e.target.value)}
                    className="input"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id} style={{ background: '#111' }}>
                        {a.name} ({a.currency})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Category</label>
                  <select
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                    className="input"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id} style={{ background: '#111' }}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
