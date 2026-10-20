'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, ChevronDown, ChevronUp, Compass, Lightbulb, Sparkles, X } from 'lucide-react';
import { useId, useState } from 'react';

export interface GuideStep {
  title: string;
  description: string;
}

export interface PageGuideProps {
  pageTitle: string;
  tagline: string;
  steps: GuideStep[];
  concept?: {
    name: string;
    explanation: string;
  };
  proTip: string;
  defaultOpen?: boolean;
}

export function PageGuide({
  pageTitle,
  tagline,
  steps,
  concept,
  proTip,
  defaultOpen = false,
}: PageGuideProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div style={{ margin: '4px 0 16px 0' }}>
      {/* Toggle Trigger Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className={`btn btn-sm ${isOpen ? 'btn-primary' : 'btn-secondary'}`}
          style={{
            fontSize: '0.8125rem',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            gap: 8,
          }}
        >
          <Compass size={15} />
          <span>{isOpen ? `Hide ${pageTitle} Guide` : `How to use ${pageTitle}`}</span>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Expandable Guide Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={panelId}
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div
              className="ember-glass"
              style={{
                marginTop: 14,
                padding: '24px 28px',
                borderLeft: '4px solid var(--color-accent)',
                position: 'relative',
              }}
            >
              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                className="btn btn-ghost btn-icon"
                style={{
                  position: 'absolute',
                  top: 14,
                  right: 14,
                  width: 28,
                  height: 28,
                  padding: 4,
                  color: 'var(--text-muted)',
                }}
                aria-label="Close Guide"
              >
                <X size={16} />
              </button>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'rgba(255,59,31,0.15)',
                    color: 'var(--color-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BookOpen size={16} />
                </span>
                <h3 style={{ fontSize: '1.0625rem', fontWeight: 600 }}>Guide: {pageTitle}</h3>
              </div>
              <p
                style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 20 }}
              >
                {tagline}
              </p>

              {/* Step-by-Step Instructions */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
                  gap: 14,
                  marginBottom: 18,
                }}
              >
                {steps.map((step, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: 'rgba(255,255,255,0.08)',
                          color: '#fff',
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {idx + 1}
                      </span>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 600 }}>{step.title}</h4>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Financial Concept & Pro Tip Row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: concept ? '1fr 1fr' : '1fr',
                  gap: 14,
                }}
              >
                {concept && (
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(96,165,250,0.05)',
                      border: '1px solid rgba(96,165,250,0.15)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Sparkles size={14} style={{ color: 'var(--color-info)' }} />
                      <span
                        style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-info)' }}
                      >
                        System Concept: {concept.name}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5,
                      }}
                    >
                      {concept.explanation}
                    </p>
                  </div>
                )}

                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255,106,43,0.06)',
                    border: '1px solid rgba(255,106,43,0.2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Lightbulb size={14} style={{ color: 'var(--ember-orange)' }} />
                    <span
                      style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ember-orange)' }}
                    >
                      Pro Tip
                    </span>
                  </div>
                  <p
                    style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}
                  >
                    {proTip}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
