import { z } from 'zod';
export const parseInput = z.object({
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
  // YYYY-MM-DD, or '' when the text names no date.
  date: z.string().max(10).default(''),
  note: z.string().max(4000),
});
