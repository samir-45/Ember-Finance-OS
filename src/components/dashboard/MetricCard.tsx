'use client';

import { motion } from 'framer-motion';
import { cardVariants } from './cardVariants';

interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: 'income' | 'expense';
  index: number;
}

export function MetricCard({ label, value, hint, tone, index }: MetricCardProps) {
  return (
    <motion.div
      className="ember-glass"
      style={{ padding: '20px 24px' }}
      custom={index}
      initial="hidden"
      animate="visible"
      variants={cardVariants}
    >
      <span className="label-uppercase">{label}</span>
      <p
        className="text-money"
        style={{
          marginTop: 8,
          color:
            tone === 'income'
              ? 'var(--color-income)'
              : tone === 'expense'
              ? 'var(--color-expense)'
              : 'var(--text-primary)',
        }}
      >
        {value}
      </p>
      {hint && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>{hint}</p>}
    </motion.div>
  );
}
