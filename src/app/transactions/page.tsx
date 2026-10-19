'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Plus, Filter, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { store } from '@/lib/store';
import { formatMoney, dateLabel } from '@/lib/finance';
import type { Transaction, Currency, Account, Category } from '@/types';
import { v4 as uuid } from 'uuid';

function TransactionsContent() {
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // New Transaction Form State
  const [newMerchant, setNewMerchant] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCurrency, setNewCurrency] = useState<Currency>('BDT');
  const [newType, setNewType] = useState<'income' | 'expense'>('expense');
  const [newAccountId, setNewAccountId] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newNote, setNewNote] = useState('');

  const refreshData = () => {
    const txs = store.getTransactions().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTransactions(txs);
    const cats = store.getCategories();
    setCategories(cats);
    const accs = store.getAccounts();
    setAccounts(accs);
    if (accs.length > 0 && !newAccountId) {
      setNewAccountId(accs[0].id);
    }
    if (cats.length > 0 && !newCategoryId) {
      setNewCategoryId(cats[0].id);
    }
  };

  useEffect(() => {
    refreshData();
    if (searchParams.get('quickAdd') === '1') {
      setShowAddModal(true);
    }
  }, [searchParams]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchesMerchant = t.merchant?.toLowerCase().includes(q);
        const matchesNote = t.note?.toLowerCase().includes(q);
        const cat = categories.find(c => c.id === t.categoryId)?.name.toLowerCase();
        const matchesCat = cat?.includes(q);
        if (!matchesMerchant && !matchesNote && !matchesCat) return false;
      }
      return true;
    });
  }, [transactions, typeFilter, search, categories]);

  const handleCreateTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(newAmount);
    if (!amountNum || amountNum <= 0) return;

    const newTx: Transaction = {
      id: uuid(),
      accountId: newAccountId,
      categoryId: newCategoryId,
      transferId: null,
      type: newType,
      amountMinor: Math.round(amountNum * 100),
      currency: newCurrency,
      note: newNote,
      merchant: newMerchant,
      date: new Date().toISOString().slice(0, 10),
      tags: [],
      paymentMethod: 'Manual Entry',
      status: 'done',
      createdAt: new Date().toISOString(),
    };

    store.createTransaction(newTx);
    refreshData();
    setShowAddModal(false);
    setNewMerchant('');
    setNewAmount('');
    setNewNote('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Transactions Ledger</h1>
          <p className="page-subtitle">Track every income, expense, and currency transfer with precision</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
          <Plus size={16} /> Add Activity
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="ember-glass"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 260 }}>
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search merchants, categories, or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input"
            style={{ border: 'none', background: 'transparent', padding: '6px 0' }}
          />
        </div>

        <div className="tab-bar">
          {(['all', 'income', 'expense'] as const).map(tab => (
            <button
              key={tab}
              className={`tab-item ${typeFilter === tab ? 'active' : ''}`}
              onClick={() => setTypeFilter(tab)}
              style={{ textTransform: 'capitalize' }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="ember-glass" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '14px 20px', fontWeight: 500, color: 'var(--text-muted)' }}>Date</th>
                <th style={{ padding: '14px 20px', fontWeight: 500, color: 'var(--text-muted)' }}>Merchant / Note</th>
                <th style={{ padding: '14px 20px', fontWeight: 500, color: 'var(--text-muted)' }}>Category</th>
                <th style={{ padding: '14px 20px', fontWeight: 500, color: 'var(--text-muted)' }}>Account</th>
                <th style={{ padding: '14px 20px', fontWeight: 500, color: 'var(--text-muted)' }}>Status</th>
                <th style={{ padding: '14px 20px', fontWeight: 500, color: 'var(--text-muted)', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No transactions found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTransactions.slice(0, 50).map((tx) => {
                  const cat = categories.find(c => c.id === tx.categoryId);
                  const acc = accounts.find(a => a.id === tx.accountId);
                  const isIncome = tx.type === 'income';

                  return (
                    <tr
                      key={tx.id}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        transition: 'background 150ms ease',
                      }}
                    >
                      <td style={{ padding: '14px 20px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {dateLabel(tx.date)}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: isIncome ? 'rgba(110,231,168,0.1)' : 'rgba(255,59,31,0.1)',
                              color: isIncome ? 'var(--color-income)' : 'var(--color-expense)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {isIncome ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                          </span>
                          <div>
                            <p style={{ fontWeight: 500 }}>{tx.merchant || tx.note || 'Transaction'}</p>
                            {tx.note && tx.merchant && (
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tx.note}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: cat?.color || 'var(--text-muted)',
                            }}
                          />
                          {cat?.name || 'Uncategorized'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', color: 'var(--text-secondary)' }}>
                        {acc?.name || 'Account'}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span className={`badge badge-${tx.status}`}>{tx.status}</span>
                      </td>
                      <td
                        style={{
                          padding: '14px 20px',
                          textAlign: 'right',
                          fontWeight: 500,
                          color: isIncome ? 'var(--color-income)' : 'var(--text-primary)',
                        }}
                        className="ember-number"
                      >
                        {isIncome ? '+' : '−'}
                        {formatMoney(tx.amountMinor, tx.currency)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 20 }}>Record New Activity</h2>
            <form onSubmit={handleCreateTransaction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Type</label>
                <div className="tab-bar">
                  <button
                    type="button"
                    className={`tab-item ${newType === 'expense' ? 'active' : ''}`}
                    onClick={() => setNewType('expense')}
                    style={{ flex: 1 }}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    className={`tab-item ${newType === 'income' ? 'active' : ''}`}
                    onClick={() => setNewType('income')}
                    style={{ flex: 1 }}
                  >
                    Income
                  </button>
                </div>
              </div>

              <div>
                <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Merchant / Payee</label>
                <input
                  type="text"
                  placeholder="e.g. Upwork, Agora, Figma"
                  value={newMerchant}
                  onChange={(e) => setNewMerchant(e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
                <div>
                  <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Currency</label>
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value as Currency)}
                    className="input"
                  >
                    <option value="BDT" style={{ background: '#111' }}>BDT</option>
                    <option value="USD" style={{ background: '#111' }}>USD</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Account</label>
                  <select
                    value={newAccountId}
                    onChange={(e) => setNewAccountId(e.target.value)}
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
                    value={newCategoryId}
                    onChange={(e) => setNewCategoryId(e.target.value)}
                    className="input"
                  >
                    {categories
                      .filter(c => c.type === newType)
                      .map(c => (
                        <option key={c.id} value={c.id} style={{ background: '#111' }}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Note (Optional)</label>
                <input
                  type="text"
                  placeholder="Additional details..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Activity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 400 }} />}>
      <TransactionsContent />
    </Suspense>
  );
}
