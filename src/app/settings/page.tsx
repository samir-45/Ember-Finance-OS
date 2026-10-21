'use client';
import { BackgroundCustomizer } from '@/components/settings/BackgroundCustomizer';
import { CategorySettings } from '@/components/settings/CategorySettings';
import { CurrencySettings } from '@/components/settings/CurrencySettings';
import { DataManagement } from '@/components/settings/DataManagement';
import { SystemManual } from '@/components/settings/SystemManual';
import { ChevronDown, Palette } from 'lucide-react';
export default function SettingsPage() {
  return (
    <div className="settings-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Storage, privacy, currencies, and personal targets</p>
        </div>
      </div>
      <DataManagement />
      <CurrencySettings />
      <CategorySettings />
      <SystemManual />
      <details className="ember-glass-static appearance-section">
        <summary className="appearance-summary">
          <span className="appearance-icon" aria-hidden="true">
            <Palette size={22} />
          </span>
          <span className="appearance-summary-copy">
            <span className="appearance-summary-title">Background & appearance</span>
            <span className="appearance-summary-description">Presets and custom photos</span>
          </span>
          <span className="appearance-chevron" aria-hidden="true">
            <ChevronDown size={20} />
          </span>
        </summary>
        <BackgroundCustomizer />
      </details>
    </div>
  );
}
