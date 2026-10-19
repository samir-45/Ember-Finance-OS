'use client';

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { SectionCard } from './SectionCard';
import { formatMoney } from '@/lib/finance';
import type { Currency } from '@/types';

interface CashFlowItem {
  month: string;
  income: number;
  expenses: number;
}

interface CashFlowChartProps {
  data: CashFlowItem[];
  currency: Currency;
}

export function CashFlowChart({ data, currency }: CashFlowChartProps) {
  return (
    <SectionCard
      title="Your cash flow"
      action={<span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last 6 months</span>}
      index={0}
    >
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6ee7a8" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#6ee7a8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff3b1f" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ff3b1f" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: 'rgba(15,15,15,0.95)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
              }}
              formatter={(value: any) => [formatMoney(Math.round(Number(value) * 100), currency), '']}
            />
            <Area type="monotone" dataKey="income" stroke="#6ee7a8" fill="url(#incomeGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="expenses" stroke="#ff3b1f" fill="url(#expenseGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', gap: 20, borderTop: '1px solid var(--border-subtle)', paddingTop: 12, marginTop: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6ee7a8' }} />
          Income
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff3b1f' }} />
          Expenses
        </span>
      </div>
    </SectionCard>
  );
}
