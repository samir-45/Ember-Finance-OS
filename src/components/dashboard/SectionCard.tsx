'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cardVariants } from './cardVariants';

interface SectionCardProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  index?: number;
}

export function SectionCard({ title, action, children, index = 0 }: SectionCardProps) {
  return (
    <motion.div
      className="ember-glass-static"
      style={{ padding: '24px' }}
      custom={index + 4}
      initial="hidden"
      animate="visible"
      variants={cardVariants}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{title}</h3>
        {action}
      </div>
      {children}
    </motion.div>
  );
}
