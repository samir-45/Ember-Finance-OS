'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { store } from '@/lib/store';
import { getConversionRate } from '@/lib/finance';
import type { Currency } from '@/types';

export function CurrencySettings() {
  const [userSettings, setUserSettings] = useState(() => store.getSettings());
  const [usdRate, setUsdRate] = useState(() => getConversionRate());
  const [rateSaved, setRateSaved] = useState(false);

  const handleUpdateSettings = (updates: Partial<typeof userSettings>) => {
    const next = { ...userSettings, ...updates };
    setUserSettings(next);
    store.saveSettings(next);
  };

  const handleSaveRate = () => {
    const num = Number(usdRate);
    if (!num || num <= 0) return;
    store.setExchangeRate({
      fromCurrency: 'USD',
      toCurrency: 'BDT',
      rate: num,
      updatedAt: new Date().toISOString(),
    });
    setRateSaved(true);
    setTimeout(() => setRateSaved(false), 2000);
  };

  return (
    <div className="ember-glass" style={{ padding: '28px' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 20 }}>Currencies & Conversion Rates</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
        {/* Base Currency */}
        <div>
          <label className="label-uppercase" style={{ display: 'block', marginBottom: 8 }}>
            Primary Base Currency
          </label>
          <select
            value={userSettings.baseCurrency}
            onChange={(e) => handleUpdateSettings({ baseCurrency: e.target.value as Currency })}
            className="input"
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              border: '1px solid var(--border-default)',
              outline: 'none',
            }}
          >
            <option value="BDT" style={{ background: '#111' }}>
              BDT (Bangladeshi Taka ৳)
            </option>
            <option value="USD" style={{ background: '#111' }}>
              USD (United States Dollar $)
            </option>
          </select>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
            Default currency for your consolidated net worth & runway computation.
          </p>
        </div>

        {/* USD to BDT Conversion Rate */}
        <div>
          <label className="label-uppercase" style={{ display: 'block', marginBottom: 8 }}>
            USD to BDT Exchange Rate
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: 11,
                  fontSize: '0.875rem',
                  color: 'var(--text-muted)',
                }}
              >
                ৳
              </span>
              <input
                type="number"
                step="0.1"
                value={usdRate}
                onChange={(e) => setUsdRate(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 30px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  border: '1px solid var(--border-default)',
                  outline: 'none',
                }}
              />
            </div>
            <button onClick={handleSaveRate} className="btn btn-primary btn-sm">
              {rateSaved ? <Check size={16} /> : 'Save Rate'}
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
            1 USD converts to approx. {usdRate} BDT across Payoneer & bank transfers.
          </p>
        </div>
      </div>
    </div>
  );
}
