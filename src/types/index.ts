// ============================================================
// EMBER FINANCE OS — Type Definitions
// All amounts stored as integers in minor units (cents / poisha)
// ============================================================

export type Currency = 'USD' | 'BDT';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionStatus = 'planned' | 'pending' | 'done';
export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type InsightKind = 'tip' | 'warning' | 'win' | 'review';
export type InsightSeverity = 'info' | 'warning' | 'critical';
export type AccountType = 'bank' | 'wallet' | 'cash' | 'card' | 'payoneer' | 'paypal';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  openingBalanceMinor: number;
  color: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  type: 'income' | 'expense';
  color: string;
  icon: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  transferId: string | null;
  type: TransactionType;
  amountMinor: number;
  currency: Currency;
  note: string;
  merchant: string;
  date: string;
  tags: string[];
  paymentMethod: string;
  status: TransactionStatus;
  createdAt: string;
}

export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amountOutMinor: number;
  amountInMinor: number;
  exchangeRate: number;
  feeMinor: number;
  feeCurrency: Currency;
  date: string;
  createdAt: string;
}

export interface Subscription {
  id: string;
  name: string;
  amountMinor: number;
  currency: Currency;
  billingCycle: BillingCycle;
  nextBillingDate: string;
  categoryId: string | null;
  accountId: string | null;
  active: boolean;
  createdAt: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  month: string; // YYYY-MM
  limitMinor: number;
  currency: Currency;
}

export interface Goal {
  id: string;
  name: string;
  targetMinor: number;
  currentMinor: number;
  currency: Currency;
  deadline: string | null;
  createdAt: string;
}

export interface ExchangeRate {
  id: string;
  fromCurrency: Currency;
  toCurrency: Currency;
  rate: number;
  updatedAt: string;
}

export interface CoachInsight {
  id: string;
  kind: InsightKind;
  severity: InsightSeverity;
  title: string;
  body: string;
  action?: string;
  period: string;
  createdAt: string;
}

export interface UserSettings {
  baseCurrency: Currency;
  displayCurrency: 'USD' | 'BDT' | 'original';
  aiCoachEnabled: boolean;
  shareAiDetails: boolean;
  compactMode: boolean;
}

export interface MoneyPair {
  usdMinor: number;
  bdtMinor: number;
}

export interface CashFlowPoint {
  month: string;
  income: MoneyPair;
  expenses: MoneyPair;
}

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  color: string;
  amounts: MoneyPair;
  percentage: number;
}

export type AccountBalance = Account & { balanceMinor: number };

export interface DashboardData {
  netWorth: MoneyPair;
  incomeThisMonth: MoneyPair;
  expensesThisMonth: MoneyPair;
  savingsRatePercent: number;
  runwayMonths: number;
  healthScore: number;
  conversionRate: number;
  cashFlow: CashFlowPoint[];
  categorySpending: CategorySpending[];
  accounts: AccountBalance[];
  subscriptions: Subscription[];
  goals: Goal[];
  recentTransactions: (Transaction & { categoryName: string; accountName: string })[];
  coachInsights: CoachInsight[];
  budgets: (Budget & { spentMinor: number; categoryName: string })[];
}
