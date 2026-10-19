'use client';

import { useState, useEffect } from 'react';
import {
  Target, Plus, CheckCircle, Calendar, Trash2, Edit3,
  DollarSign, TrendingUp, AlertTriangle, ArrowUpRight
} from 'lucide-react';
import { store } from '@/lib/store';
import {
  formatMoney, dateLabel, computeSinkingFund,
  convertToBdt, convertToUsd
} from '@/lib/finance';
import type { Goal, Currency } from '@/types';
import { PageGuide } from '@/components/ui/PageGuide';
import { v4 as uuid } from 'uuid';

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState<Goal | null>(null);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // Form
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('BDT');
  const [deadline, setDeadline] = useState('');

  // Contribution Form
  const [contributionAmount, setContributionAmount] = useState('');

  const refreshGoals = () => {
    setGoals(store.getGoals());
  };

  useEffect(() => {
    refreshGoals();
  }, []);

  // Save Goal
  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const targetNum = parseFloat(targetAmount);
    const currNum = parseFloat(currentAmount) || 0;
    if (!name || !targetNum || targetNum <= 0) return;

    if (editingGoal) {
      store.updateGoal(editingGoal.id, {
        name,
        targetMinor: Math.round(targetNum * 100),
        currency,
        deadline: deadline || null,
      });
      setEditingGoal(null);
    } else {
      store.createGoal({
        name,
        targetMinor: Math.round(targetNum * 100),
        currentMinor: Math.round(currNum * 100),
        currency,
        deadline: deadline || null,
        createdAt: new Date().toISOString(),
      });
    }

    setShowModal(false);
    setName('');
    setTargetAmount('');
    setCurrentAmount('');
    refreshGoals();
  };

  // Delete Goal
  const handleDeleteGoal = (id: string) => {
    if (confirm('Delete this goal?')) {
      store.deleteGoal(id);
      refreshGoals();
    }
  };

  // Add Contribution
  const handleContribute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showContributeModal) return;
    const addAmt = parseFloat(contributionAmount);
    if (!addAmt || addAmt <= 0) return;

    const nextCurrent = showContributeModal.currentMinor + Math.round(addAmt * 100);
    store.updateGoal(showContributeModal.id, { currentMinor: nextCurrent });
    setShowContributeModal(null);
    setContributionAmount('');
    refreshGoals();
  };

  // Aggregate Portfolio
  let totalTargetBdt = 0;
  let totalSavedBdt = 0;
  goals.forEach(g => {
    totalTargetBdt += convertToBdt(g.targetMinor, g.currency);
    totalSavedBdt += convertToBdt(g.currentMinor, g.currency);
  });
  const overallPct = totalTargetBdt > 0 ? Math.round((totalSavedBdt / totalTargetBdt) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Goals & Sinking Funds</h1>
          <p className="page-subtitle">Amortized monthly deposit requirements, milestone tracking, and sinking funds</p>
        </div>
        <button
          onClick={() => {
            setEditingGoal(null);
            setName('');
            setTargetAmount('');
            setCurrentAmount('');
            setDeadline(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
            setShowModal(true);
          }}
          className="btn btn-primary btn-sm"
        >
          <Plus size={15} /> Create Goal
        </button>
      </div>

      {/* Goals Guide */}
      <PageGuide
        pageTitle="Financial Goals & Sinking Funds"
        tagline="Plan capital targets with deterministic sinking funds, amortized monthly savings pacing, and milestone tracking."
        steps={[
          {
            title: 'Define Target & Target Date',
            description: 'Create a milestone (e.g. Tax Reserve, Equipment, Emergency Fund) with target balance and target deadline.',
          },
          {
            title: 'Amortized Sinking Fund Math',
            description: 'The engine determines remaining months and calculates the exact monthly deposit needed to reach your target by the deadline without shortfall.',
          },
          {
            title: 'Contribute Capital',
            description: 'Click "+ Contribute" on any goal card to log manual capital injections as you set money aside.',
          },
          {
            title: 'Track Milestone Progress',
            description: 'Progress rings visually identify fully funded goals (100%), active trajectories, or milestones needing timeline recalibration.',
          },
        ]}
        concept={{
          name: 'Sinking Fund Amortization',
          explanation: 'Rather than guessing arbitrary savings amounts, a sinking fund calculates `Remaining Gap ÷ Months Remaining`. This transforms large impending outlays into smooth, predictable monthly cash reservations.',
        }}
        proTip="Set realistic deadlines. If the required monthly deposit exceeds your monthly net surplus from the dashboard, extend the target date outward to keep your pacing realistic."
      />

      {/* Aggregate Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Cumulative Goal Value</span>
          <p className="text-money" style={{ marginTop: 6 }}>{formatMoney(totalTargetBdt, 'BDT')}</p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Across {goals.length} target milestones
          </p>
        </div>

        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Total Reserves Accumulated</span>
          <p className="text-money" style={{ marginTop: 6, color: 'var(--color-income)' }}>
            {formatMoney(totalSavedBdt, 'BDT')}
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {overallPct}% overall funded
          </p>
        </div>

        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Target Capital Gap</span>
          <p className="text-money" style={{ marginTop: 6 }}>
            {formatMoney(Math.max(0, totalTargetBdt - totalSavedBdt), 'BDT')}
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Remaining capital needed
          </p>
        </div>
      </div>

      {/* Goals Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 20 }}>
        {goals.map(g => {
          const sinking = computeSinkingFund(g.targetMinor, g.currentMinor, g.deadline);
          const pct = Math.round((g.currentMinor / Math.max(g.targetMinor, 1)) * 100);
          const isComplete = pct >= 100;

          return (
            <div
              key={g.id}
              className="ember-glass"
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{g.name}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      <Calendar size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                      Target: {g.deadline ? dateLabel(g.deadline) : 'No set deadline'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => {
                        setEditingGoal(g);
                        setName(g.name);
                        setTargetAmount((g.targetMinor / 100).toString());
                        setCurrentAmount((g.currentMinor / 100).toString());
                        setCurrency(g.currency);
                        setDeadline(g.deadline || '');
                        setShowModal(true);
                      }}
                      className="btn btn-ghost btn-icon"
                      style={{ padding: 4, width: 26, height: 26 }}
                      title="Edit Goal"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(g.id)}
                      className="btn btn-ghost btn-icon"
                      style={{ color: 'var(--color-critical)', padding: 4, width: 26, height: 26 }}
                      title="Delete Goal"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div style={{ margin: '14px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <p className="text-money">{formatMoney(g.currentMinor, g.currency)}</p>
                    <span className="ember-number" style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                      {pct}%
                    </span>
                  </div>
                  <div className="progress-bar" style={{ height: 8 }}>
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        background: isComplete ? 'var(--color-income)' : 'var(--color-accent)',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                    <span>Target: {formatMoney(g.targetMinor, g.currency)}</span>
                    <span>Remaining: {formatMoney(sinking.projectedShortfallMinor, g.currency)}</span>
                  </div>
                </div>

                {/* Sinking Fund Diagnostic Box */}
                {!isComplete && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      fontSize: '0.75rem',
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Required monthly pace:</span>
                      <strong className="ember-number" style={{ color: 'var(--color-accent)' }}>
                        {formatMoney(sinking.monthlyDepositMinor, g.currency)}/mo
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Horizon:</span>
                      <span className="ember-number">{sinking.monthsRemaining} months left</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
                {!isComplete ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setShowContributeModal(g)}
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1 }}
                    >
                      <Plus size={14} /> Contribute
                    </button>
                    <button
                      onClick={() => {
                        const quickAmt = g.currency === 'USD' ? 5000 : 500000;
                        store.updateGoal(g.id, { currentMinor: g.currentMinor + quickAmt });
                        refreshGoals();
                      }}
                      className="btn btn-secondary btn-sm"
                    >
                      + {g.currency === 'USD' ? '$50' : '৳5K'}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-income)', fontSize: '0.875rem' }}>
                    <CheckCircle size={16} /> Target Milestone Reached! 🎉
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Goal Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 20 }}>
              {editingGoal ? 'Edit Goal' : 'Create Financial Target'}
            </h2>
            <form onSubmit={handleSaveGoal} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Target Milestone Name</label>
                <input
                  type="text"
                  placeholder="e.g. 6-Month Emergency Runway, New Laptop, Travel"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
                <div>
                  <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Target Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={targetAmount}
                    onChange={e => setTargetAmount(e.target.value)}
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

              {!editingGoal && (
                <div>
                  <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Initial Seeded Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={currentAmount}
                    onChange={e => setCurrentAmount(e.target.value)}
                    className="input"
                  />
                </div>
              )}

              <div>
                <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Target Deadline</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className="input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingGoal ? 'Update Goal' : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contribute Modal */}
      {showContributeModal && (
        <div className="modal-overlay" onClick={() => setShowContributeModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 8 }}>
              Contribute to {showContributeModal.name}
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              Current: {formatMoney(showContributeModal.currentMinor, showContributeModal.currency)} of {formatMoney(showContributeModal.targetMinor, showContributeModal.currency)}
            </p>
            <form onSubmit={handleContribute} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>
                  Deposit Amount ({showContributeModal.currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={contributionAmount}
                  onChange={e => setContributionAmount(e.target.value)}
                  className="input"
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setShowContributeModal(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Deposit Funds
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
