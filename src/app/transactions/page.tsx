'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search, Plus, Filter, ArrowUpRight, ArrowDownLeft,
  Trash2, Edit3, ArrowUpDown, Download, Check, Sparkles
} from 'lucide-react';
import { store } from '@/lib/store';
import { formatMoney, dateLabel, convertToUsd, convertToBdt } from '@/lib/finance';
import type { Transaction, Currency, Account, Category } from '@/types';
import { PageGuide } from '@/components/ui/PageGuide';
import { v4 as uuid } from 'uuid';

function TransactionsContent() {
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Filters & Sorting
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');
  const [pageSize, setPageSize] = useState<number>(25);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Form State
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('BDT');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);

  const handleAiParse = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiParsing(true);
    try {
      const res = await fetch('/api/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: aiPrompt,
          accounts,
          categories,
        }),
      });
      const result = await res.json();
      if (result.success && result.data) {
        const d = result.data;
        if (d.merchant) setMerchant(d.merchant);
        if (d.amount) setAmount(String(d.amount));
        if (d.currency) setCurrency(d.currency);
        if (d.type) setType(d.type);
        if (d.accountId) setAccountId(d.accountId);
        if (d.categoryId) setCategoryId(d.categoryId);
        if (d.note) setNote(d.note);
      }
    } catch (err) {
      console.error('AI parse error:', err);
    } finally {
      setIsAiParsing(false);
    }
  };

  const refreshData = () => {
    const txs = store.getTransactions();
    setTransactions(txs);
    const cats = store.getCategories();
    setCategories(cats);
    const accs = store.getAccounts();
    setAccounts(accs);
    if (accs.length > 0 && !accountId) setAccountId(accs[0].id);
    if (cats.length > 0 && !categoryId) setCategoryId(cats[0].id);
  };

  useEffect(() => {
    refreshData();
    if (searchParams.get('quickAdd') === '1') {
      setEditingTx(null);
      setMerchant('');
      setAmount('');
      setNote('');
      setDate(new Date().toISOString().slice(0, 10));
      setShowModal(true);
    }
    const catParam = searchParams.get('categoryId');
    if (catParam) {
      setCategoryFilter(catParam);
    }
  }, [searchParams]);

  // Filtered & Sorted Transactions
  const filteredTransactions = useMemo(() => {
    let result = transactions.filter(t => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (accountFilter !== 'all' && t.accountId !== accountFilter) return false;
      if (categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false;
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

    result.sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortBy === 'date_asc') return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortBy === 'amount_desc') return b.amountMinor - a.amountMinor;
      if (sortBy === 'amount_asc') return a.amountMinor - b.amountMinor;
      return 0;
    });

    return result;
  }, [transactions, typeFilter, accountFilter, categoryFilter, search, sortBy, categories]);

  // Aggregate Metrics for Filtered Selection
  const filteredMetrics = useMemo(() => {
    let incomeBdt = 0;
    let expenseBdt = 0;
    for (const t of filteredTransactions) {
      const bdt = convertToBdt(t.amountMinor, t.currency);
      if (t.type === 'income') incomeBdt += bdt;
      else if (t.type === 'expense') expenseBdt += bdt;
    }
    return {
      incomeBdt,
      expenseBdt,
      netBdt: incomeBdt - expenseBdt,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  // Save Transaction
  const handleSaveTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) return;

    if (editingTx) {
      store.updateTransaction(editingTx.id, {
        merchant,
        type,
        amountMinor: Math.round(amountNum * 100),
        currency,
        accountId,
        categoryId,
        note,
        date: date || new Date().toISOString().slice(0, 10),
      });
      setEditingTx(null);
    } else {
      const newTx: Transaction = {
        id: uuid(),
        accountId,
        categoryId,
        transferId: null,
        type,
        amountMinor: Math.round(amountNum * 100),
        currency,
        note,
        merchant,
        date: date || new Date().toISOString().slice(0, 10),
        tags: [],
        paymentMethod: 'Manual Entry',
        status: 'done',
        createdAt: new Date().toISOString(),
      };
      store.createTransaction(newTx);
    }

    refreshData();
    setShowModal(false);
    setMerchant('');
    setAmount('');
    setNote('');
  };

  // Delete Transaction
  const handleDeleteTransaction = (id: string) => {
    if (confirm('Delete this transaction?')) {
      store.deleteTransaction(id);
      refreshData();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Transactions Ledger</h1>
          <p className="page-subtitle">Granular journal with multi-currency sorting, account filters, and running tallies</p>
        </div>
        <button
          onClick={() => {
            setEditingTx(null);
            setMerchant('');
            setAmount('');
            setNote('');
            setDate(new Date().toISOString().slice(0, 10));
            setShowModal(true);
          }}
          className="btn btn-primary btn-sm"
        >
          <Plus size={15} /> Add Activity
        </button>
      </div>

      {/* Transactions Guide */}
      <PageGuide
        pageTitle="Transactions Ledger"
        tagline="Search, filter, record, and audit your multi-currency income, living expenses, and transfers."
        steps={[
          {
            title: 'Log New Income or Expense',
            description: 'Click "+ Add Activity" (or press N on your keyboard) to record merchant, amount, currency, account, and category.',
          },
          {
            title: 'Filter by Account & Category',
            description: 'Use the dropdown filters to inspect spending for specific accounts (like bKash or Payoneer) or specific categories.',
          },
          {
            title: 'Sort Ledger by Velocity',
            description: 'Toggle sorting between Newest First, Oldest First, or Highest Amount to catch outlier expenses quickly.',
          },
          {
            title: 'Edit or Delete Entries',
            description: 'Click the pencil or trash icon on any row to modify amounts or notes; balances update automatically across the entire OS.',
          },
        ]}
        concept={{
          name: 'Running Selection Tallies',
          explanation: 'The summary cards at the top dynamically calculate the exact Inflow, Outflow, and Net Cash for whatever search query or filter you have active.',
        }}
        proTip="Pressing the 'N' key from any page in the app instantly triggers the quick-add activity modal without touching your mouse."
      />

      {/* Running Ledger Tallies for Current Filter */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="ember-glass" style={{ padding: '20px 24px' }}>
          <span className="label-uppercase">Filtered Inflow</span>
          <p className="text-money" style={{ marginTop: 4, color: 'var(--color-income)' }}>
            +{formatMoney(filteredMetrics.incomeBdt, 'BDT')}
          </p>
        </div>

        <div className="ember-glass" style={{ padding: '20px 24px' }}>
          <span className="label-uppercase">Filtered Outflow</span>
          <p className="text-money" style={{ marginTop: 4, color: 'var(--color-expense)' }}>
            −{formatMoney(filteredMetrics.expenseBdt, 'BDT')}
          </p>
        </div>

        <div className="ember-glass" style={{ padding: '20px 24px' }}>
          <span className="label-uppercase">Net Retained Cash</span>
          <p
            className="text-money"
            style={{
              marginTop: 4,
              color: filteredMetrics.netBdt >= 0 ? 'var(--color-income)' : 'var(--color-expense)',
            }}
          >
            {filteredMetrics.netBdt >= 0 ? '+' : '−'}{formatMoney(Math.abs(filteredMetrics.netBdt), 'BDT')}
          </p>
        </div>

        <div className="ember-glass" style={{ padding: '20px 24px' }}>
          <span className="label-uppercase">Records Count</span>
          <p className="text-money" style={{ marginTop: 4 }}>
            {filteredMetrics.count}
          </p>
        </div>
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
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 220 }}>
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search merchants, categories, or notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input"
            style={{ border: 'none', background: 'transparent', padding: '6px 0' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Account Filter */}
          <select
            value={accountFilter}
            onChange={e => setAccountFilter(e.target.value)}
            className="input"
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8125rem' }}
          >
            <option value="all">All Accounts</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="input"
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8125rem' }}
          >
            <option value="all">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="input"
            style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8125rem' }}
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="amount_desc">Largest Amount</option>
            <option value="amount_asc">Smallest Amount</option>
          </select>

          {/* Type Tab */}
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
                <th style={{ padding: '14px 20px', fontWeight: 500, color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No transactions found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTransactions.slice(0, pageSize).map(tx => {
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
                        {isIncome ? '+' : '−'}{formatMoney(tx.amountMinor, tx.currency)}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          <button
                            onClick={() => {
                              setEditingTx(tx);
                              setMerchant(tx.merchant);
                              setAmount((tx.amountMinor / 100).toString());
                              setCurrency(tx.currency);
                              setType(tx.type === 'income' ? 'income' : 'expense');
                              setAccountId(tx.accountId);
                              setCategoryId(tx.categoryId);
                              setNote(tx.note);
                              setDate(tx.date);
                              setShowModal(true);
                            }}
                            className="btn btn-ghost btn-icon"
                            style={{ padding: 4, width: 24, height: 24 }}
                            title="Edit"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(tx.id)}
                            className="btn btn-ghost btn-icon"
                            style={{ color: 'var(--color-critical)', padding: 4, width: 24, height: 24 }}
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Slice Controller */}
        {filteredTransactions.length > pageSize && (
          <div style={{ padding: '16px 20px', textAlign: 'center', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setPageSize(prev => prev + 25)}
              className="btn btn-secondary btn-sm"
            >
              Load More Records ({filteredTransactions.length - pageSize} remaining)
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Transaction Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 20 }}>
              {editingTx ? 'Edit Transaction' : 'Record Activity'}
            </h2>
            <form onSubmit={handleSaveTransaction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Natural Language AI Entry */}
              {!editingTx && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255, 59, 31, 0.05)',
                    border: '1px solid rgba(255, 59, 31, 0.18)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--color-accent)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Sparkles size={13} /> Natural Language AI Assistant
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      Gemini & Smart Heuristics
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      placeholder='e.g. "groceries 1200 bkash" or "client payment 850 usd payoneer"'
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAiParse();
                        }
                      }}
                      className="input"
                      style={{ fontSize: '0.8125rem', padding: '6px 12px' }}
                    />
                    <button
                      type="button"
                      onClick={handleAiParse}
                      disabled={isAiParsing || !aiPrompt.trim()}
                      className="btn btn-secondary btn-sm"
                      style={{ flexShrink: 0, gap: 6, padding: '0 12px' }}
                    >
                      <Sparkles size={13} className={isAiParsing ? 'animate-spin' : ''} />
                      <span>{isAiParsing ? 'Parsing...' : 'Auto-Fill'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Type</label>
                <div className="tab-bar">
                  <button
                    type="button"
                    className={`tab-item ${type === 'expense' ? 'active' : ''}`}
                    onClick={() => setType('expense')}
                    style={{ flex: 1 }}
                  >
                    Expense
                  </button>
                  <button
                    type="button"
                    className={`tab-item ${type === 'income' ? 'active' : ''}`}
                    onClick={() => setType('income')}
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
                  value={merchant}
                  onChange={e => setMerchant(e.target.value)}
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
                    <option value="BDT" style={{ background: '#111' }}>BDT (৳)</option>
                    <option value="USD" style={{ background: '#111' }}>USD ($)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Account</label>
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
                    {categories
                      .filter(c => c.type === type)
                      .map(c => (
                        <option key={c.id} value={c.id} style={{ background: '#111' }}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Note (Optional)</label>
                <input
                  type="text"
                  placeholder="Additional details..."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingTx ? 'Update Activity' : 'Save Activity'}
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
