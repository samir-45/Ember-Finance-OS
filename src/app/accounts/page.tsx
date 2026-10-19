'use client';

import { useState, useEffect } from 'react';
import {
  Wallet, Plus, ArrowLeftRight, Landmark, CreditCard,
  Trash2, Edit3, ArrowRight, DollarSign, CheckCircle2, History
} from 'lucide-react';
import { store } from '@/lib/store';
import {
  computeAccountBalance, formatMoney, convertToUsd,
  convertToBdt, getConversionRate, dateLabel
} from '@/lib/finance';
import type { Account, Currency, Transfer } from '@/types';
import { PageGuide } from '@/components/ui/PageGuide';
import { v4 as uuid } from 'uuid';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rates, setRates] = useState<number>(121.5);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  // New Account Form
  const [name, setName] = useState('');
  const [type, setType] = useState<Account['type']>('bank');
  const [currency, setCurrency] = useState<Currency>('BDT');
  const [openingBalance, setOpeningBalance] = useState('');
  const [color, setColor] = useState('#ff6a2b');

  // Transfer Form
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [transferRate, setTransferRate] = useState(121.5);
  const [transferFee, setTransferFee] = useState('0');

  const refreshAccounts = () => {
    const accs = store.getAccounts();
    setAccounts(accs);
    setRates(getConversionRate());
    if (accs.length >= 2) {
      if (!fromAccountId) setFromAccountId(accs[0].id);
      if (!toAccountId) setToAccountId(accs[1].id);
    }
  };

  useEffect(() => {
    refreshAccounts();
  }, []);

  const totalUsdNetWorth = accounts.reduce((sum, a) => {
    const bal = computeAccountBalance(a.id);
    return sum + convertToUsd(bal, a.currency);
  }, 0);

  // Create or Update Account
  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    if (editingAccount) {
      store.updateAccount(editingAccount.id, {
        name,
        type,
        currency,
        color,
      });
      setEditingAccount(null);
    } else {
      const newAcc: Account = {
        id: uuid(),
        name,
        type,
        currency,
        openingBalanceMinor: Math.round((parseFloat(openingBalance) || 0) * 100),
        color,
        createdAt: new Date().toISOString(),
      };
      store.createAccount(newAcc);
    }

    setName('');
    setOpeningBalance('');
    setShowAddModal(false);
    refreshAccounts();
  };

  // Delete Account
  const handleDeleteAccount = (id: string) => {
    if (confirm('Are you sure you want to delete this account?')) {
      store.deleteAccount(id);
      refreshAccounts();
    }
  };

  // Execute Transfer
  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const fromAcc = accounts.find(a => a.id === fromAccountId);
    const toAcc = accounts.find(a => a.id === toAccountId);
    const amtNum = parseFloat(amountOut);
    const feeNum = parseFloat(transferFee) || 0;

    if (!fromAcc || !toAcc || !amtNum || amtNum <= 0) return;

    const amountOutMinor = Math.round(amtNum * 100);
    const feeMinor = Math.round(feeNum * 100);

    // Calculate destination credit based on currencies
    let amountInMinor = amountOutMinor;
    if (fromAcc.currency === 'USD' && toAcc.currency === 'BDT') {
      amountInMinor = Math.round(amtNum * transferRate * 100);
    } else if (fromAcc.currency === 'BDT' && toAcc.currency === 'USD') {
      amountInMinor = Math.round((amtNum / transferRate) * 100);
    }

    const transfer: Transfer = {
      id: uuid(),
      fromAccountId,
      toAccountId,
      amountOutMinor,
      amountInMinor,
      exchangeRate: transferRate,
      feeMinor,
      feeCurrency: fromAcc.currency,
      date: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };

    store.createTransfer(transfer);
    setShowTransferModal(false);
    setAmountOut('');
    setTransferFee('0');
    refreshAccounts();
  };

  // Selected Account Transactions History
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const accountTransactions = selectedAccountId
    ? store.getTransactions().filter(t => t.accountId === selectedAccountId).slice(0, 15)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounts & Wallets</h1>
          <p className="page-subtitle">Multi-currency liquidity, FX conversions, and balance tracking</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowTransferModal(true)}
            className="btn btn-secondary btn-sm"
          >
            <ArrowLeftRight size={15} /> Transfer / Convert
          </button>
          <button
            onClick={() => {
              setEditingAccount(null);
              setName('');
              setOpeningBalance('');
              setShowAddModal(true);
            }}
            className="btn btn-primary btn-sm"
          >
            <Plus size={15} /> New Account
          </button>
        </div>
      </div>

      {/* Accounts Guide */}
      <PageGuide
        pageTitle="Accounts & Wallets"
        tagline="Manage multi-currency balances, cross-border payouts, and inter-account currency conversions."
        steps={[
          {
            title: 'Add Your Financial Accounts',
            description: 'Click "+ New Account" to add Bank Accounts (DBBL, City), USD Payouts (Payoneer, PayPal), or Mobile Wallets (bKash).',
          },
          {
            title: 'Transfer & Convert Funds',
            description: 'Click "Transfer / Convert" to move money between accounts (e.g., Payoneer USD to DBBL BDT) with custom exchange rate and fee deductions.',
          },
          {
            title: 'Audit Individual Account Ledgers',
            description: 'Click "View Ledger" on any account card to reveal an inline history of recent transactions exclusively tied to that account.',
          },
          {
            title: 'Monitor Liquidity Distribution',
            description: 'Keep track of how much capital is in foreign USD accounts versus readily deployable domestic BDT cash.',
          },
        ]}
        concept={{
          name: 'Atomic Double-Entry Transfers',
          explanation: 'When transferring money between accounts (especially cross-currency), Ember debits the source account and credits the target account simultaneously with accurate fee tracking.',
        }}
        proTip="Always record your actual realized Payoneer-to-Bank conversion rate and fee when transferring. The Reports page uses this to show you if you are beating your historical average rate."
      />

      {/* Portfolio Aggregation Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Consolidated Portfolio</span>
          <p className="text-money" style={{ marginTop: 6 }}>{formatMoney(totalUsdNetWorth, 'USD')}</p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
            ≈ {formatMoney(Math.round(totalUsdNetWorth * rates), 'BDT')}
          </p>
        </div>

        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Foreign Holdings (USD)</span>
          <p className="text-money" style={{ marginTop: 6, color: 'var(--color-income)' }}>
            {formatMoney(
              accounts
                .filter(a => a.currency === 'USD')
                .reduce((s, a) => s + computeAccountBalance(a.id), 0),
              'USD'
            )}
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Across {accounts.filter(a => a.currency === 'USD').length} USD accounts
          </p>
        </div>

        <div className="ember-glass" style={{ padding: '24px' }}>
          <span className="label-uppercase">Domestic Liquidity (BDT)</span>
          <p className="text-money" style={{ marginTop: 6 }}>
            {formatMoney(
              accounts
                .filter(a => a.currency === 'BDT')
                .reduce((s, a) => s + computeAccountBalance(a.id), 0),
              'BDT'
            )}
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Across {accounts.filter(a => a.currency === 'BDT').length} local accounts
          </p>
        </div>
      </div>

      {/* Account Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {accounts.map((a) => {
          const balance = computeAccountBalance(a.id);
          const isUsd = a.currency === 'USD';

          return (
            <div
              key={a.id}
              className="ember-glass"
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: a.color }} />
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{a.name}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: 2 }}>
                      {a.type} · {a.currency}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => {
                        setEditingAccount(a);
                        setName(a.name);
                        setType(a.type);
                        setCurrency(a.currency);
                        setColor(a.color);
                        setShowAddModal(true);
                      }}
                      className="btn btn-ghost btn-icon"
                      title="Edit Account"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteAccount(a.id)}
                      className="btn btn-ghost btn-icon"
                      style={{ color: 'var(--color-critical)' }}
                      title="Delete Account"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div style={{ margin: '14px 0' }}>
                  <span className="label-uppercase">Available Balance</span>
                  <p className="text-money" style={{ marginTop: 4 }}>
                    {formatMoney(balance, a.currency)}
                  </p>
                  {isUsd && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      ≈ {formatMoney(Math.round(balance * rates), 'BDT')}
                    </p>
                  )}
                </div>
              </div>

              <div
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Opening: {formatMoney(a.openingBalanceMinor, a.currency)}
                </span>
                <button
                  onClick={() => setSelectedAccountId(selectedAccountId === a.id ? null : a.id)}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                >
                  <History size={12} /> {selectedAccountId === a.id ? 'Hide History' : 'View Ledger'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Account Ledger Drawer */}
      {selectedAccountId && selectedAccount && (
        <div className="ember-glass" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>
              Recent Ledger — {selectedAccount.name} ({selectedAccount.currency})
            </h3>
            <button onClick={() => setSelectedAccountId(null)} className="btn btn-secondary btn-sm">
              Close Ledger
            </button>
          </div>
          {accountTransactions.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>
              No transactions recorded for this account yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {accountTransactions.map(tx => (
                <div
                  key={tx.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255,255,255,0.02)',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 500 }}>{tx.merchant || tx.note || 'Transaction'}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{dateLabel(tx.date)}</p>
                  </div>
                  <span
                    className="ember-number"
                    style={{
                      fontWeight: 600,
                      color: tx.type === 'income' ? 'var(--color-income)' : 'var(--text-primary)',
                    }}
                  >
                    {tx.type === 'income' ? '+' : '−'}{formatMoney(tx.amountMinor, tx.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Account Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 20 }}>
              {editingAccount ? 'Edit Account' : 'Add New Account'}
            </h2>
            <form onSubmit={handleSaveAccount} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Account Name</label>
                <input
                  type="text"
                  placeholder="e.g. Wise USD, Brac Bank, Payoneer"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Account Type</label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as Account['type'])}
                    className="input"
                  >
                    <option value="bank" style={{ background: '#111' }}>Bank Account</option>
                    <option value="payoneer" style={{ background: '#111' }}>Payoneer</option>
                    <option value="paypal" style={{ background: '#111' }}>PayPal</option>
                    <option value="wallet" style={{ background: '#111' }}>Mobile Wallet (bKash)</option>
                    <option value="cash" style={{ background: '#111' }}>Cash</option>
                    <option value="crypto" style={{ background: '#111' }}>Crypto Wallet</option>
                  </select>
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

              {!editingAccount && (
                <div>
                  <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Opening Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={openingBalance}
                    onChange={e => setOpeningBalance(e.target.value)}
                    className="input"
                  />
                </div>
              )}

              <div>
                <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Accent Color</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {['#ff6a2b', '#6ee7a8', '#f472b6', '#a78bfa', '#60a5fa', '#fbbf24', '#34d399'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      style={{
                        width: 28, height: 28, borderRadius: '50%', background: c,
                        border: color === c ? '2px solid #fff' : 'none', cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingAccount ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer & Convert Modal */}
      {showTransferModal && (
        <div className="modal-overlay" onClick={() => setShowTransferModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ padding: '28px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 20 }}>
              Transfer & Currency Conversion
            </h2>
            <form onSubmit={handleExecuteTransfer} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>From Account</label>
                  <select
                    value={fromAccountId}
                    onChange={e => setFromAccountId(e.target.value)}
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
                  <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>To Account</label>
                  <select
                    value={toAccountId}
                    onChange={e => setToAccountId(e.target.value)}
                    className="input"
                  >
                    {accounts.filter(a => a.id !== fromAccountId).map(a => (
                      <option key={a.id} value={a.id} style={{ background: '#111' }}>
                        {a.name} ({a.currency})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Transfer Amount</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amountOut}
                  onChange={e => setAmountOut(e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Exchange Rate</label>
                  <input
                    type="number"
                    step="0.01"
                    value={transferRate}
                    onChange={e => setTransferRate(Number(e.target.value))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label-uppercase" style={{ display: 'block', marginBottom: 6 }}>Transfer Fee</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={transferFee}
                    onChange={e => setTransferFee(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setShowTransferModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
