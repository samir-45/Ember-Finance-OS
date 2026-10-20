import { z } from 'zod';
export const aiConsent = z.object({ enabled: z.literal(true), share: z.literal(true) });
export const coachInput = z.object({
  consent: aiConsent,
  incomeBaselineUsdMinor: z.number().int().safe().nonnegative().default(0),
  incomeUsdMinor: z.number().int().safe().nonnegative(),
  expenseUsdMinor: z.number().int().safe().nonnegative(),
  savingsRate: z.number().finite(),
  runwayMonths: z.number().nonnegative().finite(),
  hasExpenseHistory: z.boolean(),
  subBurdenPercent: z.number().nonnegative().finite(),
  topCategories: z
    .array(
      z.object({
        name: z.string().max(100),
        amountUsdMinor: z.number().int().safe().nonnegative(),
        percent: z.number().min(0).max(100),
      }),
    )
    .max(10),
});
export const coachOutput = z.object({
  executiveSummary: z.string().max(3000),
  nextFocus: z.object({
    title: z.string().max(200),
    explanation: z.string().max(2000),
    impact: z.string().max(1000),
  }),
  leakages: z
    .array(
      z.object({
        title: z.string().max(200),
        details: z.string().max(2000),
        urgency: z.enum(['high', 'medium', 'low']),
      }),
    )
    .max(10),
  opportunities: z
    .array(z.object({ title: z.string().max(200), strategy: z.string().max(2000) }))
    .max(10),
  status: z.enum(['healthy', 'warning', 'critical']),
});
export const parseInput = z.object({
  consent: aiConsent,
  text: z.string().trim().min(1).max(4000),
  accounts: z
    .array(
      z.object({ id: z.string(), name: z.string().max(160), currency: z.enum(['USD', 'BDT']) }),
    )
    .max(100),
  categories: z
    .array(
      z.object({ id: z.string(), name: z.string().max(160), type: z.enum(['income', 'expense']) }),
    )
    .max(200),
});
export const parseOutput = z.object({
  merchant: z.string().max(200),
  amount: z.number().finite().positive(),
  currency: z.enum(['BDT', 'USD']),
  type: z.enum(['income', 'expense']),
  accountId: z.string(),
  categoryId: z.string(),
  note: z.string().max(4000),
});
