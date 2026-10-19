import {
  pgTable,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  json,
} from 'drizzle-orm/pg-core';

// ── 1. Accounts Table ──
export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'bank' | 'mobile' | 'cash' | 'investment'
  currency: text('currency').notNull(), // 'BDT' | 'USD'
  initialBalanceMinor: integer('initial_balance_minor').notNull().default(0),
  color: text('color'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── 2. Categories Table ──
export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'income' | 'expense'
  icon: text('icon'),
  color: text('color'),
  isCustom: boolean('is_custom').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── 3. Transactions Table ──
export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  categoryId: text('category_id').notNull(),
  transferId: text('transfer_id'),
  type: text('type').notNull(), // 'income' | 'expense'
  amountMinor: integer('amount_minor').notNull(),
  currency: text('currency').notNull(), // 'BDT' | 'USD'
  merchant: text('merchant').notNull(),
  note: text('note'),
  date: text('date').notNull(), // 'YYYY-MM-DD'
  tags: json('tags').$type<string[]>().default([]),
  paymentMethod: text('payment_method'),
  status: text('status').notNull().default('done'), // 'planned' | 'pending' | 'done'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── 4. Transfers Table (Atomic Foreign Exchange) ──
export const transfers = pgTable('transfers', {
  id: text('id').primaryKey(),
  fromAccountId: text('from_account_id').notNull(),
  toAccountId: text('to_account_id').notNull(),
  fromAmountMinor: integer('from_amount_minor').notNull(),
  toAmountMinor: integer('to_amount_minor').notNull(),
  exchangeRate: numeric('exchange_rate').notNull(),
  feeMinor: integer('fee_minor').notNull().default(0),
  feeCurrency: text('fee_currency').notNull(), // 'BDT' | 'USD'
  date: text('date').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── 5. Subscriptions Table ──
export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  amountMinor: integer('amount_minor').notNull(),
  currency: text('currency').notNull(),
  billingCycle: text('billing_cycle').notNull(), // 'monthly' | 'quarterly' | 'yearly'
  nextBillingDate: text('next_billing_date').notNull(),
  accountId: text('account_id').notNull(),
  categoryId: text('category_id').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── 6. Budgets Table ──
export const budgets = pgTable('budgets', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').notNull(),
  limitMinor: integer('limit_minor').notNull(),
  currency: text('currency').notNull(),
  period: text('period').notNull().default('monthly'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── 7. Goals / Sinking Funds Table ──
export const goals = pgTable('goals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  targetMinor: integer('target_minor').notNull(),
  currentMinor: integer('current_minor').notNull().default(0),
  currency: text('currency').notNull(),
  deadline: text('deadline'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── 8. Exchange Rates Reference Table ──
export const exchangeRates = pgTable('exchange_rates', {
  id: text('id').primaryKey(),
  fromCurrency: text('from_currency').notNull(),
  toCurrency: text('to_currency').notNull(),
  rate: numeric('rate').notNull(),
  date: text('date').notNull(),
});

// ── 9. Coach Insights Table ──
export const coachInsights = pgTable('coach_insights', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(), // 'warning' | 'win' | 'tip'
  severity: text('severity').notNull(), // 'info' | 'warning' | 'critical'
  title: text('title').notNull(),
  body: text('body').notNull(),
  action: text('action'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── 10. User Settings Table ──
export const userSettings = pgTable('user_settings', {
  id: text('id').primaryKey(),
  baseCurrency: text('base_currency').notNull().default('BDT'),
  displayCurrency: text('display_currency').notNull().default('BDT'),
  aiCoachEnabled: boolean('ai_coach_enabled').default(true).notNull(),
  shareAiDetails: boolean('share_ai_details').default(false).notNull(),
  compactMode: boolean('compact_mode').default(false).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
