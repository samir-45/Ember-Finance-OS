'use client';

import { BackgroundCustomizer } from '@/components/settings/BackgroundCustomizer';
import { CurrencySettings } from '@/components/settings/CurrencySettings';
import { DataManagement } from '@/components/settings/DataManagement';
import { SystemManual } from '@/components/settings/SystemManual';
import { PageGuide } from '@/components/ui/PageGuide';

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

      {/* Interactive Page Guide */}
      <PageGuide
        pageTitle="Settings & Atmosphere"
        tagline="Manage visual themes, reference conversion rates, and full JSON data portability."
        steps={[
          {
            title: 'Choose Background Preset',
            description: 'Select between Molten Ember (TudSa), Tactile Roaring Fire, Subtle Obsidian Hearth, Living Plasma, Cosmic Stardust, or click Custom Photo to upload your own picture.',
          },
          {
            title: 'Tune Atmosphere Controls',
            description: 'Adjust the brightness slider, apply soft blur, and toggle floating ember particles for your ideal look.',
          },
          {
            title: 'Configure Reference FX Rate',
            description: 'Set your primary base currency (BDT/USD) and the baseline BDT per USD exchange rate used in portfolio totals.',
          },
          {
            title: 'Cloud Sync & Offline Backups',
            description: 'Your changes sync automatically with your private Neon PostgreSQL database. Export an offline JSON snapshot anytime or manage demo data.',
          },
        ]}
        concept={{
          name: 'Hybrid Local-First Architecture',
          explanation: 'All interactions are instantaneously saved to your local storage and silently synced to your private Neon PostgreSQL database in the background.',
        }}
        proTip="You can upload any desktop wallpaper or personal photo. Ember automatically compresses it locally to ensure smooth rendering and rapid loading."
      />

      {/* Complete User Guide & Documentation Manual */}
      <SystemManual />

      {/* Background & Atmosphere Customizer */}
      <BackgroundCustomizer />

      {/* Currency & Conversion Rates */}
      <CurrencySettings />

      {/* Data Management & Backup */}
      <DataManagement />
    </div>
  );
}
