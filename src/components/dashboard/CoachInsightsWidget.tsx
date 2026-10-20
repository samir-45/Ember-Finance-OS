'use client';

import { EmptyState } from '@/components/ui/EmptyState';
import type { CoachInsight } from '@/types';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { SectionCard } from './SectionCard';

interface CoachInsightsWidgetProps {
  insights: CoachInsight[];
}

export function CoachInsightsWidget({ insights }: CoachInsightsWidgetProps) {
  const router = useRouter();

  return (
    <SectionCard
      title="A note from Ember"
      action={<Sparkles size={16} style={{ color: 'var(--color-accent)' }} />}
      index={4}
    >
      {insights.length === 0 ? (
        <EmptyState text="Your patterns and useful nudges will find a home here." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {insights.slice(0, 3).map((insight) => (
            <div
              key={insight.id}
              style={{
                padding: 16,
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span
                  className={`badge badge-${
                    insight.severity === 'warning'
                      ? 'pending'
                      : insight.kind === 'win'
                        ? 'income'
                        : 'planned'
                  }`}
                >
                  {insight.kind}
                </span>
              </div>
              <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>{insight.title}</p>
              <p
                style={{
                  fontSize: '0.8125rem',
                  color: 'var(--text-muted)',
                  marginTop: 4,
                  lineHeight: 1.5,
                }}
              >
                {insight.body}
              </p>
            </div>
          ))}
          <button
            onClick={() => router.push('/coach')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: 0,
              fontFamily: 'var(--font-sans)',
            }}
          >
            Explore all insights <ArrowRight size={14} />
          </button>
        </div>
      )}
    </SectionCard>
  );
}
