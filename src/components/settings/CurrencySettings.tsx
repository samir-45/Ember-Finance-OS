'use client';
import { store } from '@/lib/store';
import { useAiAvailable } from '@/lib/use-ai';
import { useLedgerVersion } from '@/lib/use-ledger';
import type { Currency, UserSettings } from '@/types';
import { useState } from 'react';
export function CurrencySettings() {
  useLedgerVersion();
  const settings = store.getSettings();
  const aiAvailable = useAiAvailable();
  const [rate, setRate] = useState(String(store.getReferenceRate()));
  const [givingDraft, setGivingDraft] = useState(String(settings.givingPercent ?? 0));
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
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const value = Number(givingDraft);
          if (givingDraft.trim() === '' || !Number.isFinite(value) || value < 0 || value > 100) {
            setMessage('Enter a giving percentage from 0 to 100.');
            return;
          }
          store.saveSettings({ ...store.getSettings(), givingPercent: value });
          setGivingDraft(String(value));
          setMessage(`Giving suggestion saved at ${value}%.`);
        }}
      >
        <label htmlFor="giving-percent">
          Suggested income giving reserve (%)
          <input
            id="giving-percent"
            className="input"
            type="number"
            min="0"
            max="100"
            step="any"
            required
            value={givingDraft}
            onChange={(e) => setGivingDraft(e.target.value)}
          />
        </label>
        <p>
          Saved suggestion: {settings.givingPercent ?? 0}% of a selected income payment. In
          Allocations & giving, choose a posted income and apply the percentage to fill a
          reservation. Nothing is reserved automatically. This does not calculate zakat obligations.
        </p>
        <button className="btn btn-secondary" type="submit">
          Save giving suggestion
        </button>
      </form>
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
            checked={settings.aiQuickEntry}
            onChange={(e) => update({ aiQuickEntry: e.target.checked })}
          />{' '}
          Quick entry with AI
        </span>
      </label>
      <p>
        Adds a box to Add activity where you type something like “Lunch 350 cash yesterday” and the
        form fills itself. Only the text you type and your account and category names are sent to
        Google Gemini, and only when you press Fill in.
        {!aiAvailable &&
          ' Not set up on this server yet: add GEMINI_API_KEY to the server environment.'}
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
