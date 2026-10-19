'use client';

import { BackgroundCustomizer } from '@/components/settings/BackgroundCustomizer';
import { CurrencySettings } from '@/components/settings/CurrencySettings';
import { DataManagement } from '@/components/settings/DataManagement';

export default function SettingsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, paddingBottom: 60 }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings & Atmosphere</h1>
          <p className="page-subtitle">
            Personalize your background, active currencies, conversion rates, and data
          </p>
        </div>
      </div>

      {/* Background & Atmosphere Customizer */}
      <BackgroundCustomizer />

      {/* Currency & Conversion Rates */}
      <CurrencySettings />

      {/* Data Management & Backup */}
      <DataManagement />
    </div>
  );
}
