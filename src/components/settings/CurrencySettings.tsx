'use client';
import { store } from '@/lib/store';
import { useLedgerVersion } from '@/lib/use-ledger';
import type { Currency, UserSettings } from '@/types';
import { useState } from 'react';
export function CurrencySettings() {
  useLedgerVersion();
  const settings = store.getSettings();
  const [rate, setRate] = useState(String(store.getReferenceRate()));
  const [message, setMessage] = useState('');
  const update = (values: Partial<UserSettings>) => {
    store.saveSettings({ ...store.getSettings(), ...values });
    setMessage('Preference saved');
  };
  return (
    <section className="ember-glass settings-card settings-stack">
      <h2>Currencies, targets & privacy</h2>
      <label htmlFor="base-currency">
        Preferred display currency
        <select
          id="base-currency"
          className="input"
          value={settings.baseCurrency}
          onChange={(e) =>
            update({
              baseCurrency: e.target.value as Currency,
              displayCurrency: e.target.value as Currency,
            })
          }
        >
          <option value="BDT">BDT — Bangladeshi taka</option>
          <option value="USD">USD — US dollar</option>
        </select>
      </label>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const value = Number(rate);
          if (!Number.isFinite(value) || value <= 0)
            throw new Error('Enter a positive exchange rate');
          store.setExchangeRate({
            fromCurrency: 'USD',
            toCurrency: 'BDT',
            rate: value,
            updatedAt: new Date().toISOString(),
          });
          setMessage('Reference rate saved');
        }}
      >
        <label htmlFor="reference-rate">
          Reference BDT per USD
          <input
            id="reference-rate"
            type="number"
            min="0.000001"
            step="any"
            required
            className="input"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </label>
        <p>
          This manual rate estimates current portfolio value. Posted entries retain their reporting
          rate; actual transfers retain the amounts received. It is not a live bank quote.
        </p>
        <button className="btn btn-primary">Save reference rate</button>
      </form>
      <label htmlFor="giving-percent">
        Suggested income giving reserve (%)
        <input
          id="giving-percent"
          className="input"
          type="number"
          min="0"
          max="100"
          value={settings.givingPercent ?? 0}
          onChange={(e) => update({ givingPercent: Number(e.target.value) })}
        />
      </label>
      <p>
        This is your personal allocation preference. Zakat and sadaqah are recorded separately in
        Allocations; this percentage does not determine zakat obligations.
      </p>
      <label htmlFor="savings-target">
        Savings target (%)
        <input
          id="savings-target"
          className="input"
          type="number"
          min="0"
          max="100"
          value={settings.savingsTargetPercent ?? 20}
          onChange={(e) => update({ savingsTargetPercent: Number(e.target.value) })}
        />
      </label>
      <label htmlFor="subscription-target">
        Recurring cost target (% of income)
        <input
          id="subscription-target"
          className="input"
          type="number"
          min="0"
          max="100"
          value={settings.subscriptionLimitPercent ?? 5}
          onChange={(e) => update({ subscriptionLimitPercent: Number(e.target.value) })}
        />
      </label>
      <label>
        <span>
          <input
            type="checkbox"
            checked={settings.aiCoachEnabled}
            onChange={(e) =>
              update({
                aiCoachEnabled: e.target.checked,
                shareAiDetails: e.target.checked ? settings.shareAiDetails : false,
              })
            }
          />{' '}
          Enable optional external AI
        </span>
      </label>
      <label>
        <span>
          <input
            type="checkbox"
            disabled={!settings.aiCoachEnabled}
            checked={settings.shareAiDetails}
            onChange={(e) => update({ shareAiDetails: e.target.checked })}
          />{' '}
          Allow sending financial summaries and entry text to Google for AI requests
        </span>
      </label>
      <p>
        AI runs only after you request it, both options are enabled, and you are signed in. Raw
        entry text can contain personal details. Deterministic insights remain available without AI.
      </p>
      <label>
        <span>
          <input
            type="checkbox"
            checked={settings.compactMode}
            onChange={(e) => update({ compactMode: e.target.checked })}
          />{' '}
          Compact workspace spacing
        </span>
      </label>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
