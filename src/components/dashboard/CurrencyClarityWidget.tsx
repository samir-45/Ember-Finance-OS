'use client';

import { SectionCard } from './SectionCard';

interface CurrencyClarityWidgetProps {
  conversionRate: number;
}

export function CurrencyClarityWidget({ conversionRate }: CurrencyClarityWidgetProps) {
  return (
    <SectionCard title="Currency clarity" index={2}>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Your reference rate:{' '}
        <strong className="ember-number" style={{ color: 'var(--text-primary)' }}>
          {conversionRate.toFixed(2)} BDT/USD
        </strong>
      </p>
      <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 6 }}>
        USD income, BDT life. Actual transfer rates tracked separately.
      </p>
    </SectionCard>
  );
}
