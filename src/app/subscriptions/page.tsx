'use client';
import { localDate } from '@/lib/dates';
import { useLedgerVersion } from '@/lib/use-ledger';

import { Dialog } from '@/components/ui/Dialog';
import { PageGuide } from '@/components/ui/PageGuide';
import {
  computeIncomeBaseline,
  computeSubscriptionMetrics,
  dateLabel,
  formatMoney,
  toMinor,
} from '@/lib/finance';
import { store } from '@/lib/store';
import type { Account, Category, Currency, Subscription } from '@/types';
import { Calendar, Check, CheckCircle2, PauseCircle, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function SubscriptionsPage() {
  const ledgerVersion = useLedgerVersion();
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
    const subs = [...store.getSubscriptions()].sort((a, b) =>
      a.nextBillingDate.localeCompare(b.nextBillingDate),
    );
    setSubscriptions(subs);
    const accs = store.getAccounts().filter((a) => !a.archived);
    setAccounts(accs);
    const cats = store.getCategories().filter((c) => c.type === 'expense');
    setCategories(cats);
    if (accs.length > 0 && !accountId) {
      setAccountId(accs[0].id);
      setCurrency(accs[0].currency);
    }
    if (cats.length > 0 && !categoryId) setCategoryId(cats[0].id);
  };

  useEffect(() => {
    refreshData();
  }, [ledgerVersion]);

  const incomeBaseline = computeIncomeBaseline();
  const recurringTarget = store.getSettings().subscriptionLimitPercent ?? 5;
  const metrics = computeSubscriptionMetrics(subscriptions, incomeBaseline);

  // Toggle Active
  const handleToggle = (id: string) => {
    const sub = subscriptions.find((s) => s.id === id);
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
    store.recordSubscriptionPayment(sub.id, sub.nextBillingDate);
    refreshData();
    alert(`Recorded payment for ${sub.name} and updated next billing cycle.`);
  };

  // Save or Update Subscription
  const handleSaveSub = (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(amount);
    if (!name.trim() || !Number.isFinite(amtNum) || amtNum <= 0)
      throw new Error('Enter a name and positive bill amount');
    if (!accountId || !categoryId) throw new Error('Choose a funding account and expense category');

    if (editingSub) {
      store.updateSubscription(editingSub.id, {
        name,
        amountMinor: toMinor(amount),
        currency,
        billingCycle,
        nextBillingDate: nextBillingDate || localDate(),
        anchorDay: Number((nextBillingDate || localDate()).slice(8)),
        accountId,
        categoryId,
      });
      setEditingSub(null);
    } else {
      store.createSubscription({
        name,
        amountMinor: toMinor(amount),
        currency,
        billingCycle,
        nextBillingDate: nextBillingDate || localDate(),
        anchorDay: Number((nextBillingDate || localDate()).slice(8)),
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
          <h1 className="page-title">Bills & subscriptions</h1>
          <p className="page-subtitle">Upcoming commitments and confirmed payments</p>
        </div>
        <button
          onClick={() => {
            setEditingSub(null);
            setName('');
            setAmount('');
            setNextBillingDate(localDate());
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
            description:
              'Add active recurring services, choosing their billing cycle (monthly, quarterly, or yearly) and source account.',
          },
          {
            title: 'Normalize MRE & ARR',
            description:
              'The engine normalizes different billing cycles into standard Monthly Recurring Expense (MRE) and Annual Run Rate (ARR).',
          },
          {
            title: 'Audit Burden Ratio',
            description:
              'Compare normalized recurring costs with your chosen target in Settings. Essential work tools and living bills can require different personal limits.',
          },
          {
            title: 'One-Click Renewal Logging',
            description:
              'Click "Record Renewal" on any card to instantly log an expense transaction and automatically advance the next billing date by one cycle.',
          },
        ]}
        concept={{
          name: 'Recurring Burden Ratio & MRE Normalization',
          explanation:
            'Monthly cost standardizes annual, quarterly, and weekly charges. The burden ratio uses up to three complete income months, or current income when no complete history exists.',
        }}
        proTip="Toggle any subscription to 'Paused' if you are taking a break from the service—this preserves the record and immediately recalculates your true active monthly burn rate."
      />

      {/* Analytics Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
          gap: 16,
        }}
      >
        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Monthly Recurring Expense</span>
          <p className="text-money" style={{ marginTop: 6 }}>
            {formatMoney(metrics.mreUsdMinor, 'USD')}
          </p>
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
              color:
                incomeBaseline <= 0
                  ? 'var(--text-secondary)'
                  : metrics.subToIncomeRatio > recurringTarget
                    ? 'var(--color-warning)'
                    : 'var(--color-income)',
            }}
          >
            {incomeBaseline > 0 ? `${metrics.subToIncomeRatio.toFixed(1)}%` : 'No income baseline'}
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {incomeBaseline > 0
              ? `Your chosen target: ${recurringTarget}%`
              : 'Add settled income to calculate a ratio'}
          </p>
        </div>

        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Subscription Count</span>
          <p className="text-money" style={{ marginTop: 6 }}>
            {metrics.activeCount}
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {metrics.pausedCount} paused licenses
          </p>
        </div>
      </div>

      {/* Subscriptions Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: 20,
        }}
      >
        {subscriptions.map((s) => {
          const acc = accounts.find((a) => a.id === s.accountId);
          const cat = categories.find((c) => c.id === s.categoryId);

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
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{s.name}</h3>
                    <p
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        textTransform: 'capitalize',
                        marginTop: 2,
                      }}
                    >
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
                        <span
                          style={{
                            color: 'var(--color-income)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <CheckCircle2 size={13} /> Active
                        </span>
                      ) : (
                        <span
                          style={{
                            color: 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
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
                    <Calendar
                      size={12}
                      style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }}
                    />
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
                  disabled={!s.active}
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
        <Dialog
          title={editingSub ? 'Edit Subscription' : 'Track New Subscription'}
          onClose={() => setShowModal(false)}
        >
          <form
            onSubmit={handleSaveSub}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div>
              <label
                htmlFor="subscriptions-field-0"
                className="label-uppercase"
                style={{ display: 'block', marginBottom: 6 }}
              >
                Service Name
              </label>
              <input
                id="subscriptions-field-0"
                type="text"
                placeholder="e.g. GitHub Copilot, Netflix, Notion"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
              <div>
                <label
                  htmlFor="subscriptions-field-1"
                  className="label-uppercase"
                  style={{ display: 'block', marginBottom: 6 }}
                >
                  Cost
                </label>
                <input
                  id="subscriptions-field-1"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="subscriptions-field-2"
                  className="label-uppercase"
                  style={{ display: 'block', marginBottom: 6 }}
                >
                  Currency
                </label>
                <select id="subscriptions-field-2" value={currency} disabled className="input">
                  <option value="USD" style={{ background: '#111' }}>
                    USD ($)
                  </option>
                  <option value="BDT" style={{ background: '#111' }}>
                    BDT (৳)
                  </option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label
                  htmlFor="subscriptions-field-3"
                  className="label-uppercase"
                  style={{ display: 'block', marginBottom: 6 }}
                >
                  Billing Cycle
                </label>
                <select
                  id="subscriptions-field-3"
                  value={billingCycle}
                  onChange={(e) => setBillingCycle(e.target.value as Subscription['billingCycle'])}
                  className="input"
                >
                  <option value="monthly" style={{ background: '#111' }}>
                    Monthly
                  </option>
                  <option value="yearly" style={{ background: '#111' }}>
                    Yearly
                  </option>
                  <option value="quarterly" style={{ background: '#111' }}>
                    Quarterly
                  </option>
                  <option value="weekly" style={{ background: '#111' }}>
                    Weekly
                  </option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="subscriptions-field-4"
                  className="label-uppercase"
                  style={{ display: 'block', marginBottom: 6 }}
                >
                  Next Renewal Date
                </label>
                <input
                  id="subscriptions-field-4"
                  type="date"
                  value={nextBillingDate}
                  onChange={(e) => setNextBillingDate(e.target.value)}
                  className="input"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label
                  htmlFor="subscriptions-field-5"
                  className="label-uppercase"
                  style={{ display: 'block', marginBottom: 6 }}
                >
                  Paid From
                </label>
                <select
                  id="subscriptions-field-5"
                  value={accountId}
                  onChange={(e) => {
                    setAccountId(e.target.value);
                    setCurrency(accounts.find((a) => a.id === e.target.value)!.currency);
                  }}
                  className="input"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} style={{ background: '#111' }}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </select>
                {!accounts.length && (
                  <Link href="/accounts" style={{ fontSize: '0.75rem' }}>
                    Add an account first
                  </Link>
                )}
              </div>
              <div>
                <label
                  htmlFor="subscriptions-field-6"
                  className="label-uppercase"
                  style={{ display: 'block', marginBottom: 6 }}
                >
                  Category
                </label>
                <select
                  id="subscriptions-field-6"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="input"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} style={{ background: '#111' }}>
                      {c.name}
                    </option>
                  ))}
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
                Save Subscription
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
