'use client';
import { dateLabel } from '@/lib/finance';
import { store } from '@/lib/store';
import { useAiAvailable } from '@/lib/use-ai';
import { useLedgerVersion } from '@/lib/use-ledger';
import type { Currency, UserSettings } from '@/types';
import { NumberSetting, SettingRow, SettingsGroup, Switch } from './SettingsUI';

const save = (values: Partial<UserSettings>) =>
  store.saveSettings({ ...store.getSettings(), ...values });

export function MoneySettings() {
  useLedgerVersion();
  const settings = store.getSettings();
  const rate = store
    .getExchangeRates()
    .find((r) => r.fromCurrency === 'USD' && r.toCurrency === 'BDT');
  return (
    <SettingsGroup id="money" title="Money">
      <SettingRow
        title="Show amounts in"
        description="Used for totals on the dashboard and in reports."
      >
        <div className="segmented" role="group" aria-label="Show amounts in">
          {(['BDT', 'USD'] as Currency[]).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={settings.baseCurrency === c}
              onClick={() => save({ baseCurrency: c, displayCurrency: c })}
            >
              {c}
            </button>
          ))}
        </div>
      </SettingRow>
      <SettingRow
        title="Exchange rate"
        htmlFor="reference-rate"
        description={
          rate
            ? `Taka per $1, for estimates only. Updated ${dateLabel(rate.updatedAt)}. Saved entries keep the rate they were made with.`
            : 'Taka per $1, for estimates only. Set it once so totals use your rate instead of the default.'
        }
      >
        <NumberSetting
          id="reference-rate"
          value={store.getReferenceRate()}
          min={1}
          max={100000}
          onSave={(value) =>
            store.setExchangeRate({
              fromCurrency: 'USD',
              toCurrency: 'BDT',
              rate: value,
              updatedAt: new Date().toISOString(),
            })
          }
        />
      </SettingRow>
    </SettingsGroup>
  );
}

export function TargetSettings() {
  useLedgerVersion();
  const settings = store.getSettings();
  return (
    <SettingsGroup
      id="targets"
      title="Targets"
      description="Your personal goals. Ember Coach checks your month against them."
    >
      <SettingRow
        title="Savings goal"
        htmlFor="savings-target"
        description="Share of income you want left over each month."
      >
        <NumberSetting
          id="savings-target"
          value={settings.savingsTargetPercent ?? 20}
          min={0}
          max={100}
          suffix="%"
          onSave={(value) => save({ savingsTargetPercent: value })}
        />
      </SettingRow>
      <SettingRow
        title="Bills & subscriptions limit"
        htmlFor="subscription-target"
        description="Highest share of income you're comfortable spending on recurring bills."
      >
        <NumberSetting
          id="subscription-target"
          value={settings.subscriptionLimitPercent ?? 5}
          min={0}
          max={100}
          suffix="%"
          onSave={(value) => save({ subscriptionLimitPercent: value })}
        />
      </SettingRow>
      <SettingRow
        title="Giving suggestion"
        htmlFor="giving-percent"
        description="Pre-fills a giving reserve from an income payment in Allocations. Nothing is set aside automatically, and it doesn't calculate zakat."
      >
        <NumberSetting
          id="giving-percent"
          value={settings.givingPercent ?? 0}
          min={0}
          max={100}
          suffix="%"
          onSave={(value) => save({ givingPercent: value })}
        />
      </SettingRow>
    </SettingsGroup>
  );
}

export function FeatureSettings() {
  useLedgerVersion();
  const settings = store.getSettings();
  const aiAvailable = useAiAvailable();
  return (
    <SettingsGroup id="features" title="Features">
      <SettingRow
        title="Quick entry with AI"
        htmlFor="ai-quick-entry"
        description={
          <>
            Type “Lunch 350 cash yesterday” in Add activity and the form fills itself. Only that
            text and your account and category names go to Google Gemini, when you press Fill in.
            {!aiAvailable && (
              <strong className="setting-row-warning">
                {' '}
                Not set up on the server yet: add GEMINI_API_KEY.
              </strong>
            )}
          </>
        }
      >
        <Switch
          id="ai-quick-entry"
          checked={settings.aiQuickEntry}
          onChange={(checked) => save({ aiQuickEntry: checked })}
        />
      </SettingRow>
      <SettingRow
        title="Compact layout"
        htmlFor="compact-mode"
        description="Less spacing so more fits on screen."
      >
        <Switch
          id="compact-mode"
          checked={settings.compactMode}
          onChange={(checked) => save({ compactMode: checked })}
        />
      </SettingRow>
    </SettingsGroup>
  );
}
