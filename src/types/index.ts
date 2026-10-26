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
// 'receivable' holds money lent to someone: an asset, but not spendable.
export type AccountType =
  'bank' | 'wallet' | 'cash' | 'card' | 'payoneer' | 'paypal' | 'receivable';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  openingBalanceMinor: number;
  color: string;
  createdAt: string;
  archived?: boolean;
  reconciledAt?: string;
  reconciledBalanceMinor?: number;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  budgetGroup?: 'needs' | 'wants' | 'savings' | 'giving';
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
  reportingRate?: number;
  subscriptionId?: string;
  billingPeriod?: string;
  givingKind?: 'zakat' | 'sadaqah';
  allocationId?: string;
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
  status?: TransactionStatus;
  note?: string;
  reportingRate?: number;
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
  anchorDay?: number;
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
  accountId?: string | null;
  isEmergency?: boolean;
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
  aiQuickEntry: boolean;
  compactMode: boolean;
  givingPercent?: number;
  savingsTargetPercent?: number;
  subscriptionLimitPercent?: number;
}

export interface Allocation {
  id: string;
  accountId: string;
  name: string;
  kind: 'zakat' | 'sadaqah' | 'bills' | 'living' | 'savings';
  amountMinor: number;
  period: string;
  incomeTransactionId?: string;
  createdAt: string;
}
export interface Reconciliation {
  id: string;
  accountId: string;
  date: string;
  statementBalanceMinor: number;
  ledgerBalanceMinor: number;
  differenceMinor: number;
  createdAt: string;
}
export interface LedgerSnapshot {
  version: 2;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  transfers: Transfer[];
  subscriptions: Subscription[];
  budgets: Budget[];
  goals: Goal[];
  exchangeRates: ExchangeRate[];
  insights: CoachInsight[];
  allocations: Allocation[];
  reconciliations: Reconciliation[];
  settings: UserSettings;
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
  hasExpenseHistory: boolean;
  availableBdtMinor: number;
  reservedBdtMinor: number;
  billsDueBdtMinor: number;
  givingReservedBdtMinor: number;
  givingPaidBdtMinor: number;
}
