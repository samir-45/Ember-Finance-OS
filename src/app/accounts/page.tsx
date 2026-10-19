'use client';

import { useState, useEffect } from 'react';
import { Wallet, Plus, ArrowLeftRight, Landmark, CreditCard } from 'lucide-react';
import { store } from '@/lib/store';
import { computeAccountBalance, formatMoney, convertToUsd, getConversionRate } from '@/lib/finance';
import type { Account, Currency } from '@/types';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rates, setRates] = useState<number>(121.5);

  useEffect(() => {
    setAccounts(store.getAccounts());
    setRates(getConversionRate());
  }, []);

  const totalUsdNetWorth = accounts.reduce((sum, a) => {
    const bal = computeAccountBalance(a.id);
    return sum + convertToUsd(bal, a.currency);
  }, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounts & Wallets</h1>
          <p className="page-subtitle">Bank accounts, Payoneer, PayPal, bKash, and cash balances</p>
        </div>
      </div>

      {/* Net Worth Summary */}
      <div className="ember-glass" style={{ padding: '24px 28px' }}>
        <span className="label-uppercase">Consolidated Portfolio</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 8 }}>
          <p className="text-money">{formatMoney(totalUsdNetWorth, 'USD')}</p>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
            ≈ {formatMoney(Math.round(totalUsdNetWorth * rates), 'BDT')}
          </span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
          Calculated at current reference rate of {rates.toFixed(2)} BDT/USD
        </p>
      </div>

      {/* Account Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
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
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: a.color,
                }}
              />
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{a.name}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: 2 }}>
                      {a.type} · {a.currency}
                    </p>
                  </div>
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: a.color,
                    }}
                  >
                    <Landmark size={18} />
                  </span>
                </div>

                <div style={{ margin: '16px 0' }}>
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
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                }}
              >
                <span>Opening: {formatMoney(a.openingBalanceMinor, a.currency)}</span>
                <span style={{ textTransform: 'uppercase' }}>{a.currency}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
