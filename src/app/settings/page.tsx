'use client';
import { BackgroundCustomizer } from '@/components/settings/BackgroundCustomizer';
import { CategorySettings } from '@/components/settings/CategorySettings';
import { CurrencySettings } from '@/components/settings/CurrencySettings';
import { DataManagement } from '@/components/settings/DataManagement';
import { SystemManual } from '@/components/settings/SystemManual';
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
      <details>
        <summary>Background & appearance</summary>
        <BackgroundCustomizer />
      </details>
    </div>
  );
}
