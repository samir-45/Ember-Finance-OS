// ============================================================
// EMBER FINANCE OS — Client Data Store (localStorage + SSR safe)
// ============================================================

import { v4 as uuid } from 'uuid';
import { triggerAutoSync } from './sync';
import type {
  Account, Category, Transaction, Transfer, Subscription,
  Budget, Goal, ExchangeRate, CoachInsight, UserSettings,
} from '../types';

const STORAGE_PREFIX = 'ember_';

function getStore<T>(key: string, fallback: T[]): T[] {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setStore<T>(key: string, data: T[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
    triggerAutoSync();
  } catch (err) {
    console.error('Failed to write to localStorage:', err);
  }
}

function defaultSettings(): UserSettings {
  return {
    baseCurrency: 'BDT',
    displayCurrency: 'BDT',
    aiCoachEnabled: true,
    shareAiDetails: false,
    compactMode: false,
  };
}

function getSettings(): UserSettings {
  if (typeof window === 'undefined') return defaultSettings();
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + 'settings');
    return raw ? JSON.parse(raw) : defaultSettings();
  } catch {
    return defaultSettings();
  }
}

function saveSettings(s: UserSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_PREFIX + 'settings', JSON.stringify(s));
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

function createItem<T extends { id: string }>(key: string, item: Omit<T, 'id'> & { id?: string }): T {
  const items = getStore<T>(key, []);
  const newItem = { ...item, id: item.id || uuid() } as T;
  items.push(newItem);
  setStore(key, items);
  return newItem;
}

function updateItem<T extends { id: string }>(key: string, id: string, updates: Partial<T>): T | null {
  const items = getStore<T>(key, []);
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...updates };
  setStore(key, items);
  return items[idx];
}

function deleteItem<T extends { id: string }>(key: string, id: string): boolean {
  const items = getStore<T>(key, []);
  const filtered = items.filter(i => i.id !== id);
  if (filtered.length === items.length) return false;
  setStore(key, filtered);
  return true;
}

export const store = {
  // Accounts
  getAccounts: () => {
    const raw = getStore<Account>('accounts', []);
    return raw.map(a => ({
      ...a,
      openingBalanceMinor: Number(a.openingBalanceMinor ?? (a as any).initialBalanceMinor ?? 0) || 0,
    }));
  },
  createAccount: (a: Omit<Account, 'id'>) => createItem<Account>('accounts', a),
  updateAccount: (id: string, u: Partial<Account>) => updateItem<Account>('accounts', id, u),
  deleteAccount: (id: string) => deleteItem<Account>('accounts', id),

  // Categories
  getCategories: () => getStore<Category>('categories', []),
  createCategory: (c: Omit<Category, 'id'>) => createItem<Category>('categories', c),
  updateCategory: (id: string, u: Partial<Category>) => updateItem<Category>('categories', id, u),
  deleteCategory: (id: string) => deleteItem<Category>('categories', id),

  // Transactions
  getTransactions: () => getStore<Transaction>('transactions', []),
  createTransaction: (t: Omit<Transaction, 'id'>) => createItem<Transaction>('transactions', t),
  updateTransaction: (id: string, u: Partial<Transaction>) => updateItem<Transaction>('transactions', id, u),
  deleteTransaction: (id: string) => deleteItem<Transaction>('transactions', id),
  bulkUpdateTransactions: (ids: string[], updates: Partial<Transaction>) => {
    const items = getStore<Transaction>('transactions', []);
    for (const item of items) {
      if (ids.includes(item.id)) Object.assign(item, updates);
    }
    setStore('transactions', items);
  },

  // Transfers
  getTransfers: () => getStore<Transfer>('transfers', []),
  createTransfer: (t: Omit<Transfer, 'id'>) => createItem<Transfer>('transfers', t),

  // Subscriptions
  getSubscriptions: () => getStore<Subscription>('subscriptions', []),
  createSubscription: (s: Omit<Subscription, 'id'>) => createItem<Subscription>('subscriptions', s),
  updateSubscription: (id: string, u: Partial<Subscription>) => updateItem<Subscription>('subscriptions', id, u),
  deleteSubscription: (id: string) => deleteItem<Subscription>('subscriptions', id),

  // Budgets
  getBudgets: () => getStore<Budget>('budgets', []),
  setBudget: (b: Omit<Budget, 'id'>) => {
    const budgets = getStore<Budget>('budgets', []);
    const existing = budgets.find(x => x.categoryId === b.categoryId && x.month === b.month);
    if (existing) {
      return updateItem<Budget>('budgets', existing.id, b);
    }
    return createItem<Budget>('budgets', b);
  },
  upsertBudget: (b: Omit<Budget, 'id'>) => store.setBudget(b),
  deleteBudget: (id: string) => deleteItem<Budget>('budgets', id),

  // Goals
  getGoals: () => getStore<Goal>('goals', []),
  createGoal: (g: Omit<Goal, 'id'>) => createItem<Goal>('goals', g),
  updateGoal: (id: string, u: Partial<Goal>) => updateItem<Goal>('goals', id, u),
  deleteGoal: (id: string) => deleteItem<Goal>('goals', id),

  // Exchange Rates
  getExchangeRates: () => getStore<ExchangeRate>('exchangeRates', []),
  setExchangeRate: (r: Omit<ExchangeRate, 'id'>) => {
    const rates = getStore<ExchangeRate>('exchangeRates', []);
    const existing = rates.find(x => x.fromCurrency === r.fromCurrency && x.toCurrency === r.toCurrency);
    if (existing) {
      return updateItem<ExchangeRate>('exchangeRates', existing.id, r);
    }
    return createItem<ExchangeRate>('exchangeRates', r);
  },

  // Coach Insights
  getInsights: () => getStore<CoachInsight>('insights', []),
  addInsight: (i: Omit<CoachInsight, 'id'>) => createItem<CoachInsight>('insights', i),
  clearInsights: () => setStore('insights', []),

  // Settings
  getSettings,
  saveSettings,

  // Seed check
  isSeeded: () => typeof window !== 'undefined' && localStorage.getItem(STORAGE_PREFIX + 'seeded') === 'true',
  markSeeded: () => {
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_PREFIX + 'seeded', 'true');
  },

  // Bulk import
  importAll: (data: {
    accounts?: Account[];
    categories?: Category[];
    transactions?: Transaction[];
    subscriptions?: Subscription[];
    budgets?: Budget[];
    goals?: Goal[];
    transfers?: Transfer[];
    exchangeRates?: ExchangeRate[];
    settings?: UserSettings;
  }) => {
    if (typeof window === 'undefined') return;
    if (data.accounts) {
      const normalizedAccounts = data.accounts.map(a => ({
        ...a,
        openingBalanceMinor: Number(a.openingBalanceMinor ?? (a as any).initialBalanceMinor ?? 0) || 0,
      }));
      setStore('accounts', normalizedAccounts);
    }
    if (data.categories) setStore('categories', data.categories);
    if (data.transactions) setStore('transactions', data.transactions);
    if (data.subscriptions) setStore('subscriptions', data.subscriptions);
    if (data.budgets) {
      const normalizedBudgets = data.budgets.map(b => ({
        ...b,
        month: b.month || (b as any).period || new Date().toISOString().slice(0, 7),
      }));
      setStore('budgets', normalizedBudgets);
    }
    if (data.goals) setStore('goals', data.goals);
    if (data.transfers) {
      const normalizedTransfers = data.transfers.map(tr => ({
        ...tr,
        exchangeRate: Number(tr.exchangeRate) || 121.5,
      }));
      setStore('transfers', normalizedTransfers);
    }
    if (data.exchangeRates) {
      const normalizedRates = data.exchangeRates.map(xr => ({
        ...xr,
        rate: Number(xr.rate) || 121.5,
      }));
      setStore('exchangeRates', normalizedRates);
    }
    if (data.settings) saveSettings(data.settings);
  },

  // Reset
  resetAll: () => {
    if (typeof window === 'undefined') return;
    const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  },
};
