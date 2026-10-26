'use client';
import { PasskeyManager } from '@/components/auth/PasskeyManager';
import { BackgroundCustomizer } from '@/components/settings/BackgroundCustomizer';
import { CategorySettings } from '@/components/settings/CategorySettings';
import { DataManagement, SignOutRow } from '@/components/settings/DataManagement';
import {
  FeatureSettings,
  MoneySettings,
  TargetSettings,
} from '@/components/settings/PreferenceSettings';
import { SettingsGroup } from '@/components/settings/SettingsUI';
import { SystemManual } from '@/components/settings/SystemManual';
import { ChevronDown } from 'lucide-react';

const SECTIONS = [
  ['money', 'Money'],
  ['targets', 'Targets'],
  ['categories', 'Categories'],
  ['features', 'Features'],
  ['appearance', 'Appearance'],
  ['security', 'Security'],
  ['data', 'Your data'],
] as const;

export default function SettingsPage() {
  return (
    <div className="settings-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
        </div>
      </div>
      <nav className="settings-nav" aria-label="Settings sections">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>
      <MoneySettings />
      <TargetSettings />
      <div id="categories" className="settings-anchor">
        <CategorySettings />
      </div>
      <FeatureSettings />
      <SettingsGroup id="appearance" title="Appearance">
        <details className="appearance-section">
          <summary className="setting-row appearance-summary">
            <span className="setting-row-text">
              <span className="setting-row-title">Background & appearance</span>
              <span className="setting-row-description">Choose a preset or your own photo.</span>
            </span>
            <ChevronDown size={20} aria-hidden="true" className="appearance-chevron" />
          </summary>
          <BackgroundCustomizer />
        </details>
      </SettingsGroup>
      <SettingsGroup id="security" title="Sign-in & security">
        <PasskeyManager />
        <SignOutRow />
      </SettingsGroup>
      <DataManagement />
      <SystemManual />
    </div>
  );
}
