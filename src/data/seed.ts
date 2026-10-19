// ============================================================
// EMBER FINANCE OS — Seed Data (6 months of realistic data)
// A freelancer earning in USD, converting to BDT, spending in both
// ============================================================

import { v4 as uuid } from 'uuid';
import { store } from '@/lib/store';
import type {
  Account, Category, Transaction, Transfer, Subscription,
  Budget, Goal, CoachInsight
} from '@/types';

const today = new Date();
const currentMonth = today.toISOString().slice(0, 7);

function dateStr(offset: number, day: number): string {
  const d = new Date(today.getFullYear(), today.getMonth() + offset, day);
  return d.toISOString().slice(0, 10);
}

function rng(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function seedData() {
  if (store.isSeeded()) return;

  // ── Accounts ──
  const accounts: Account[] = [
    { id: uuid(), name: 'Payoneer', type: 'payoneer', currency: 'USD', openingBalanceMinor: 0, color: '#ff6a2b', createdAt: dateStr(-6, 1) },
    { id: uuid(), name: 'DBBL Bank', type: 'bank', currency: 'BDT', openingBalanceMinor: 5000000, color: '#6ee7a8', createdAt: dateStr(-6, 1) },
    { id: uuid(), name: 'bKash', type: 'wallet', currency: 'BDT', openingBalanceMinor: 800000, color: '#f472b6', createdAt: dateStr(-6, 1) },
    { id: uuid(), name: 'Cash', type: 'cash', currency: 'BDT', openingBalanceMinor: 300000, color: '#a78bfa', createdAt: dateStr(-6, 1) },
    { id: uuid(), name: 'PayPal', type: 'paypal', currency: 'USD', openingBalanceMinor: 0, color: '#60a5fa', createdAt: dateStr(-6, 1) },
  ];
  accounts.forEach(a => store.createAccount(a));

  // ── Categories ──
  const expenseCategories: Omit<Category, 'id'>[] = [
    { name: 'Groceries', parentId: null, type: 'expense', color: '#34d399', icon: 'shopping-cart' },
    { name: 'Vegetables', parentId: null, type: 'expense', color: '#34d399', icon: 'leaf' },
    { name: 'Meat & Fish', parentId: null, type: 'expense', color: '#f87171', icon: 'beef' },
    { name: 'Snacks', parentId: null, type: 'expense', color: '#fbbf24', icon: 'cookie' },
    { name: 'Household', parentId: null, type: 'expense', color: '#60a5fa', icon: 'home' },
    { name: 'Rent', parentId: null, type: 'expense', color: '#ef4444', icon: 'building' },
    { name: 'Utilities', parentId: null, type: 'expense', color: '#f59e0b', icon: 'zap' },
    { name: 'Transport', parentId: null, type: 'expense', color: '#8b5cf6', icon: 'car' },
    { name: 'Subscriptions', parentId: null, type: 'expense', color: '#ec4899', icon: 'repeat' },
    { name: 'Dining', parentId: null, type: 'expense', color: '#f97316', icon: 'utensils' },
    { name: 'Health', parentId: null, type: 'expense', color: '#10b981', icon: 'heart' },
    { name: 'Education', parentId: null, type: 'expense', color: '#3b82f6', icon: 'book' },
    { name: 'Family', parentId: null, type: 'expense', color: '#e879f9', icon: 'users' },
    { name: 'Shopping', parentId: null, type: 'expense', color: '#f43f5e', icon: 'shopping-bag' },
    { name: 'Savings', parentId: null, type: 'expense', color: '#22d3ee', icon: 'piggy-bank' },
    { name: 'Taxes & Fees', parentId: null, type: 'expense', color: '#64748b', icon: 'file-text' },
    { name: 'Other', parentId: null, type: 'expense', color: '#94a3b8', icon: 'more-horizontal' },
  ];

  const incomeCategories: Omit<Category, 'id'>[] = [
    { name: 'Freelance Work', parentId: null, type: 'income', color: '#6ee7a8', icon: 'briefcase' },
    { name: 'Client Payment', parentId: null, type: 'income', color: '#34d399', icon: 'dollar-sign' },
    { name: 'Side Project', parentId: null, type: 'income', color: '#a78bfa', icon: 'code' },
    { name: 'Investments', parentId: null, type: 'income', color: '#fbbf24', icon: 'trending-up' },
  ];

  const allCats = [...expenseCategories, ...incomeCategories];
  const categories: Category[] = allCats.map(c => {
    const cat = store.createCategory(c);
    return cat;
  });

  // Set Vegetables, Meat & Fish, Snacks as children of Groceries
  const groceriesId = categories.find(c => c.name === 'Groceries')?.id;
  if (groceriesId) {
    ['Vegetables', 'Meat & Fish', 'Snacks', 'Household'].forEach(name => {
      const cat = categories.find(c => c.name === name);
      if (cat) store.updateCategory(cat.id, { parentId: groceriesId });
    });
  }

  const catByName = (name: string) => categories.find(c => c.name === name)?.id || categories[0].id;

  // ── Transactions — 6 months of data ──
  const merchants = {
    'Groceries': ['Agora', 'Shwapno', 'Meena Bazar', 'Daily Shopping'],
    'Vegetables': ['Karwan Bazar', 'Local Market', 'Shwapno'],
    'Meat & Fish': ['Meat House', 'Fresh Fish Market', 'Kazi Farms'],
    'Snacks': ['Chillox', 'Sultan Dine', 'Star Cineplex'],
    'Dining': ['Pizza Hut', 'KFC', 'Star Kabab', 'Takeout', 'Cafe Mango'],
    'Transport': ['Uber', 'Pathao', 'CNG', 'Bus'],
    'Shopping': ['Daraz', 'Amazon', 'Aarong'],
    'Health': ['Square Hospital', 'Pharmacy', 'Lab Tests'],
    'Utilities': ['DESCO', 'WASA', 'Titas Gas', 'Internet'],
    'Education': ['Udemy', 'Coursera', 'Books'],
    'Family': ['Mom', 'Family support', 'Gift'],
  };

  const transactions: Transaction[] = [];
  const transfers: Transfer[] = [];

  for (let m = -5; m <= 0; m++) {
    // Income — freelance payments (USD)
    const paymentAmounts = [80000, 120000, 150000, 200000, 250000]; // $800-$2500
    const numPayments = rng(2, 4);
    for (let p = 0; p < numPayments; p++) {
      const amt = paymentAmounts[rng(0, paymentAmounts.length - 1)];
      const day = rng(1, 28);
      const isPayoneer = rng(0, 1) === 0;
      transactions.push({
        id: uuid(),
        accountId: isPayoneer ? accounts[0].id : accounts[4].id,
        categoryId: rng(0, 1) === 0 ? catByName('Freelance Work') : catByName('Client Payment'),
        transferId: null,
        type: 'income',
        amountMinor: amt,
        currency: 'USD',
        note: ['Upwork project', 'Direct client', 'Fiverr gig', 'Monthly retainer', 'Web design project'][rng(0, 4)],
        merchant: ['TechCorp', 'DesignLab', 'StartupXYZ', 'Agency Co', 'Remote Works'][rng(0, 4)],
        date: dateStr(m, day),
        tags: ['freelance'],
        paymentMethod: isPayoneer ? 'Payoneer' : 'PayPal',
        status: 'done',
        createdAt: dateStr(m, day),
      });
    }

    // USD → BDT transfers
    const numTransfers = rng(1, 2);
    for (let t = 0; t < numTransfers; t++) {
      const usdAmount = rng(40000, 180000); // $400-$1800
      const rate = 121 + rng(-200, 400) / 100; // 119-125 BDT/USD
      const bdtAmount = Math.round(usdAmount * rate);
      const fee = rng(200, 1500); // $2-$15 fee
      const day = rng(5, 25);

      const transfer: Transfer = {
        id: uuid(),
        fromAccountId: accounts[0].id,
        toAccountId: accounts[1].id,
        amountOutMinor: usdAmount,
        amountInMinor: bdtAmount,
        exchangeRate: rate,
        feeMinor: fee,
        feeCurrency: 'USD',
        date: dateStr(m, day),
        createdAt: dateStr(m, day),
      };
      transfers.push(transfer);
    }

    // BDT expenses
    const expenseData = [
      { cat: 'Rent', amount: 2500000, count: 1 },        // 25,000 BDT
      { cat: 'Utilities', amount: rng(300000, 600000), count: rng(2, 3) },
      { cat: 'Groceries', amount: rng(150000, 400000), count: rng(4, 8) },
      { cat: 'Vegetables', amount: rng(50000, 150000), count: rng(3, 6) },
      { cat: 'Meat & Fish', amount: rng(80000, 200000), count: rng(2, 4) },
      { cat: 'Snacks', amount: rng(30000, 80000), count: rng(1, 3) },
      { cat: 'Dining', amount: rng(80000, 200000), count: rng(3, 6) },
      { cat: 'Transport', amount: rng(60000, 150000), count: rng(5, 12) },
      { cat: 'Health', amount: rng(50000, 150000), count: rng(0, 2) },
      { cat: 'Education', amount: rng(30000, 100000), count: rng(0, 2) },
      { cat: 'Family', amount: rng(200000, 500000), count: rng(0, 2) },
      { cat: 'Shopping', amount: rng(100000, 300000), count: rng(1, 3) },
      { cat: 'Taxes & Fees', amount: rng(20000, 80000), count: rng(0, 1) },
    ];

    for (const { cat, amount, count } of expenseData) {
      for (let i = 0; i < count; i++) {
        const perTx = Math.round(amount / count) + rng(-10000, 10000);
        const day = rng(1, 28);
        const accountIdx = rng(1, 3); // BDT accounts
        const mList = merchants[cat as keyof typeof merchants] || ['General'];
        transactions.push({
          id: uuid(),
          accountId: accounts[accountIdx].id,
          categoryId: catByName(cat),
          transferId: null,
          type: 'expense',
          amountMinor: Math.abs(perTx),
          currency: 'BDT',
          note: '',
          merchant: mList[rng(0, mList.length - 1)],
          date: dateStr(m, day),
          tags: [],
          paymentMethod: ['bKash', 'Cash', 'Card', 'Bank Transfer'][rng(0, 3)],
          status: m === 0 && day > today.getDate() ? (rng(0, 1) === 0 ? 'planned' : 'pending') : 'done',
          createdAt: dateStr(m, day),
        });
      }
    }

    // Some USD expenses (subscriptions paid in USD)
    if (m === 0 || m === -1) {
      ['ChatGPT Plus', 'GitHub Copilot', 'Figma'].forEach(name => {
        transactions.push({
          id: uuid(),
          accountId: accounts[0].id,
          categoryId: catByName('Subscriptions'),
          transferId: null,
          type: 'expense',
          amountMinor: name === 'ChatGPT Plus' ? 2000 : name === 'GitHub Copilot' ? 1000 : 1200,
          currency: 'USD',
          note: `${name} subscription`,
          merchant: name,
          date: dateStr(m, 5),
          tags: ['subscription'],
          paymentMethod: 'Payoneer',
          status: 'done',
          createdAt: dateStr(m, 5),
        });
      });
    }
  }

  transactions.forEach(t => store.createTransaction(t));
  transfers.forEach(t => store.createTransfer(t));

  // ── Subscriptions ──
  const subs: Omit<Subscription, 'id'>[] = [
    { name: 'ChatGPT Plus', amountMinor: 2000, currency: 'USD', billingCycle: 'monthly', nextBillingDate: dateStr(1, 5), categoryId: catByName('Subscriptions'), accountId: accounts[0].id, active: true, createdAt: dateStr(-6, 1) },
    { name: 'GitHub Copilot', amountMinor: 1000, currency: 'USD', billingCycle: 'monthly', nextBillingDate: dateStr(1, 5), categoryId: catByName('Subscriptions'), accountId: accounts[0].id, active: true, createdAt: dateStr(-6, 1) },
    { name: 'Figma Pro', amountMinor: 1200, currency: 'USD', billingCycle: 'monthly', nextBillingDate: dateStr(1, 5), categoryId: catByName('Subscriptions'), accountId: accounts[0].id, active: true, createdAt: dateStr(-6, 1) },
    { name: 'Netflix', amountMinor: 50000, currency: 'BDT', billingCycle: 'monthly', nextBillingDate: dateStr(1, 15), categoryId: catByName('Subscriptions'), accountId: accounts[2].id, active: true, createdAt: dateStr(-6, 1) },
    { name: 'Spotify', amountMinor: 30000, currency: 'BDT', billingCycle: 'monthly', nextBillingDate: dateStr(1, 10), categoryId: catByName('Subscriptions'), accountId: accounts[2].id, active: true, createdAt: dateStr(-6, 1) },
    { name: 'YouTube Premium', amountMinor: 25000, currency: 'BDT', billingCycle: 'monthly', nextBillingDate: dateStr(1, 20), categoryId: catByName('Subscriptions'), accountId: accounts[2].id, active: false, createdAt: dateStr(-6, 1) },
    { name: 'Domain Renewal', amountMinor: 1500, currency: 'USD', billingCycle: 'yearly', nextBillingDate: dateStr(3, 1), categoryId: catByName('Subscriptions'), accountId: accounts[0].id, active: true, createdAt: dateStr(-6, 1) },
  ];
  subs.forEach(s => store.createSubscription(s));

  // ── Budgets (current month) ──
  const budgetData: Omit<Budget, 'id'>[] = [
    { categoryId: catByName('Groceries'), month: currentMonth, limitMinor: 800000, currency: 'BDT' },
    { categoryId: catByName('Dining'), month: currentMonth, limitMinor: 300000, currency: 'BDT' },
    { categoryId: catByName('Transport'), month: currentMonth, limitMinor: 250000, currency: 'BDT' },
    { categoryId: catByName('Shopping'), month: currentMonth, limitMinor: 400000, currency: 'BDT' },
    { categoryId: catByName('Health'), month: currentMonth, limitMinor: 200000, currency: 'BDT' },
    { categoryId: catByName('Subscriptions'), month: currentMonth, limitMinor: 5000, currency: 'USD' },
  ];
  budgetData.forEach(b => store.upsertBudget(b));

  // ── Goals ──
  const goalData: Omit<Goal, 'id'>[] = [
    { name: 'Emergency Fund', targetMinor: 30000000, currentMinor: 18500000, currency: 'BDT', deadline: dateStr(6, 1), createdAt: dateStr(-6, 1) },
    { name: 'New MacBook Pro', targetMinor: 250000, currentMinor: 165000, currency: 'USD', deadline: dateStr(3, 1), createdAt: dateStr(-4, 1) },
    { name: 'Family Vacation', targetMinor: 10000000, currentMinor: 3200000, currency: 'BDT', deadline: dateStr(8, 1), createdAt: dateStr(-3, 1) },
  ];
  goalData.forEach(g => store.createGoal(g));

  // ── Exchange Rate ──
  store.setExchangeRate({
    fromCurrency: 'USD',
    toCurrency: 'BDT',
    rate: 121.5,
    updatedAt: new Date().toISOString(),
  });

  // ── Coach Insights ──
  const insights: Omit<CoachInsight, 'id'>[] = [
    {
      kind: 'win',
      severity: 'info',
      title: 'Savings rate above 20%!',
      body: 'Your savings rate this month is 24.3% — well above the recommended 20% target. You\'re building real financial resilience.',
      action: 'Keep this pace going',
      period: currentMonth,
      createdAt: new Date().toISOString(),
    },
    {
      kind: 'warning',
      severity: 'warning',
      title: 'Dining spending spiked 35%',
      body: 'Your dining expenses are 35% above your 3-month average. Consider meal prepping a few days a week to bring this down.',
      action: 'Set a dining budget of ৳3,000',
      period: currentMonth,
      createdAt: new Date().toISOString(),
    },
    {
      kind: 'tip',
      severity: 'info',
      title: 'You converted at a below-average rate',
      body: 'Your last conversion was at 119.8 BDT/USD — below your average of 121.5. Try to time conversions when the rate is more favorable.',
      period: currentMonth,
      createdAt: new Date().toISOString(),
    },
    {
      kind: 'review',
      severity: 'info',
      title: 'Subscription load is healthy',
      body: 'Your subscriptions cost $42/month — about 2.8% of income. This is well within the recommended 5% ceiling.',
      period: currentMonth,
      createdAt: new Date().toISOString(),
    },
  ];
  insights.forEach(i => store.addInsight(i));

  store.markSeeded();
}
