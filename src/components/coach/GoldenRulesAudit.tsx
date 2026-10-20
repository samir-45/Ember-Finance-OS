'use client';

import { auditGoldenRules, type RuleStatus } from '@/lib/golden-rules';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Scale,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

export function GoldenRulesAudit() {
  const audit = useMemo(() => auditGoldenRules(), []);
  const [filter, setFilter] = useState<'all' | 'pass' | 'attention'>('all');
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  const filteredRules = audit.rules.filter((r) => {
    if (filter === 'pass') return r.status === 'pass';
    if (filter === 'attention') return r.status === 'warning' || r.status === 'fail';
    return true;
  });

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'var(--color-income)';
      case 'B':
        return '#60a5fa'; // Blue
      case 'C':
        return 'var(--color-warning)';
      default:
        return 'var(--color-critical)';
    }
  };

  const getStatusBadge = (status: RuleStatus) => {
    switch (status) {
      case 'pass':
        return {
          bg: 'rgba(110, 231, 168, 0.1)',
          border: 'rgba(110, 231, 168, 0.3)',
          color: 'var(--color-income)',
          icon: <CheckCircle2 size={13} />,
          text: 'PASS',
        };
      case 'warning':
        return {
          bg: 'rgba(251, 191, 36, 0.1)',
          border: 'rgba(251, 191, 36, 0.3)',
          color: 'var(--color-warning)',
          icon: <AlertTriangle size={13} />,
          text: 'ATTENTION',
        };
      case 'fail':
        return {
          bg: 'rgba(239, 68, 68, 0.1)',
          border: 'rgba(239, 68, 68, 0.3)',
          color: 'var(--color-critical)',
          icon: <XCircle size={13} />,
          text: 'ACTION NEEDED',
        };
    }
  };

  return (
    <div className="ember-glass" style={{ padding: '28px', position: 'relative' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'rgba(255, 106, 43, 0.15)',
                color: 'var(--ember-orange)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Scale size={18} />
            </span>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Your personal plan checks</h2>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '3px 8px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              Local calculations
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', maxWidth: 720 }}>
            Review your recorded cash flow, personal targets, funding, and statement comparisons.
          </p>
        </div>

        {/* Financial Grade Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              border: `2px solid ${getGradeColor(audit.letterGrade)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.375rem',
              fontWeight: 700,
              color: getGradeColor(audit.letterGrade),
              boxShadow: `0 0 16px ${getGradeColor(audit.letterGrade)}22`,
            }}
          >
            {audit.letterGrade}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{audit.gradeTitle}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {audit.letterGrade === '—'
                  ? '(insufficient history)'
                  : `(${audit.compositeScore}/100)`}
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
              {audit.passedCount} Passed · {audit.warningCount} Caution · {audit.failCount} Critical
            </p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20,
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: 14,
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setFilter('all')}
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.75rem', padding: '5px 12px' }}
          >
            All 7 Rules ({audit.rules.length})
          </button>
          <button
            onClick={() => setFilter('attention')}
            className={`btn btn-sm ${filter === 'attention' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.75rem', padding: '5px 12px' }}
          >
            Attention Needed ({audit.warningCount + audit.failCount})
          </button>
          <button
            onClick={() => setFilter('pass')}
            className={`btn btn-sm ${filter === 'pass' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.75rem', padding: '5px 12px' }}
          >
            Passed ({audit.passedCount})
          </button>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Click any rule to reveal the mathematical breakdown and financial advisor prescription
        </p>
      </div>

      {/* Rules Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredRules.map((rule) => {
          const badge = getStatusBadge(rule.status);
          const isExpanded = expandedRule === rule.id;

          return (
            <div
              key={rule.id}
              style={{
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                borderLeft: `4px solid ${badge.color}`,
                overflow: 'hidden',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Row Header (Clickable) */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-controls={`rule-detail-${rule.id}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setExpandedRule(isExpanded ? null : rule.id);
                  }
                }}
                onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                    }}
                  >
                    #{rule.number}
                  </span>
                  <div>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                    >
                      <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{rule.name}</h3>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          background: badge.bg,
                          border: `1px solid ${badge.border}`,
                          color: badge.color,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontWeight: 600,
                        }}
                      >
                        {badge.icon}
                        {badge.text}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {rule.principle}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ textAlign: 'right' }}>
                    <p
                      style={{
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {rule.currentValueFormatted}
                    </p>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                      Target: {rule.benchmark}
                    </p>
                  </div>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </div>
              </div>

              {/* Expanded Diagnostic Detail */}
              {isExpanded && (
                <div
                  id={`rule-detail-${rule.id}`}
                  style={{
                    padding: '16px 20px',
                    borderTop: '1px solid var(--border-subtle)',
                    background: 'rgba(0, 0, 0, 0.15)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Algorithmic Observation
                    </span>
                    <p
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5,
                      }}
                    >
                      {rule.explanation}
                    </p>
                  </div>

                  {/* Advisor Prescription */}
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(255, 106, 43, 0.06)',
                      border: '1px solid rgba(255, 106, 43, 0.2)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}
                      >
                        <TrendingUp size={13} style={{ color: 'var(--ember-orange)' }} />
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: 'var(--ember-orange)',
                          }}
                        >
                          Financial Advisor Prescription
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-primary)',
                          lineHeight: 1.4,
                        }}
                      >
                        {rule.advisorPrescription}
                      </p>
                    </div>

                    {rule.actionUrl && (
                      <Link
                        href={rule.actionUrl}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '4px 10px', gap: 6 }}
                      >
                        <span>{rule.actionLabel || 'Take Action'}</span>
                        <ArrowRight size={12} />
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
