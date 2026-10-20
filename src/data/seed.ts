import { localDate, localMonth, shiftMonth } from '@/lib/dates';
import { emptyLedger } from '@/lib/ledger';
import { store } from '@/lib/store';
export function seedData() {
  if (store.getLocalState().mode !== 'demo')
    throw new Error('Sample records are available only in an isolated demo workspace');
  const data = emptyLedger();
  const today = localDate();
  data.accounts = [
    {
      id: 'demo-usd',
      name: 'Demo NSave',
      type: 'bank',
      currency: 'USD',
      openingBalanceMinor: 100000,
      color: '#ff9a72',
      createdAt: today,
    },
    {
      id: 'demo-bdt',
      name: 'Demo local bank',
      type: 'bank',
      currency: 'BDT',
      openingBalanceMinor: 5000000,
      color: '#6ee7a8',
      createdAt: today,
    },
  ];
  data.exchangeRates = [
    { id: 'demo-rate', fromCurrency: 'USD', toCurrency: 'BDT', rate: 120, updatedAt: today },
  ];
  for (let i = -5; i <= 0; i++) {
    const date = `${shiftMonth(localMonth(), i)}-01`;
    data.transactions.push({
      id: `demo-income-${i}`,
      accountId: 'demo-usd',
      categoryId: 'client-payment',
      transferId: null,
      type: 'income',
      amountMinor: 150000,
      currency: 'USD',
      merchant: 'Demo client',
      note: 'Sample data',
      date,
      tags: ['demo'],
      paymentMethod: 'Sample',
      status: 'done',
      createdAt: date,
      reportingRate: 120,
    });
    data.transactions.push({
      id: `demo-rent-${i}`,
      accountId: 'demo-bdt',
      categoryId: 'rent',
      transferId: null,
      type: 'expense',
      amountMinor: 1500000,
      currency: 'BDT',
      merchant: 'Demo rent',
      note: 'Sample data',
      date,
      tags: ['demo'],
      paymentMethod: 'Sample',
      status: 'done',
      createdAt: date,
      reportingRate: 120,
    });
    data.transfers.push({
      id: `demo-transfer-${i}`,
      fromAccountId: 'demo-usd',
      toAccountId: 'demo-bdt',
      amountOutMinor: 50000,
      amountInMinor: 6000000,
      exchangeRate: 120,
      feeMinor: 200,
      feeCurrency: 'USD',
      date,
      createdAt: date,
      reportingRate: 120,
    });
  }
  data.budgets = [
    {
      id: 'demo-budget',
      categoryId: 'rent',
      month: localMonth(),
      currency: 'BDT',
      limitMinor: 1600000,
    },
  ];
  data.subscriptions = [
    {
      id: 'demo-tool',
      name: 'Demo work tool',
      amountMinor: 2000,
      currency: 'USD',
      billingCycle: 'monthly',
      nextBillingDate: `${shiftMonth(localMonth(), 1)}-01`,
      accountId: 'demo-usd',
      categoryId: 'work-tools',
      active: true,
      createdAt: today,
      anchorDay: 1,
    },
  ];
  data.goals = [
    {
      id: 'demo-goal',
      name: 'Demo emergency fund',
      isEmergency: true,
      targetMinor: 50000000,
      currentMinor: 10000000,
      currency: 'BDT',
      accountId: 'demo-bdt',
      deadline: `${shiftMonth(localMonth(), 12)}-01`,
      createdAt: today,
    },
  ];
  store.importAll(data);
}
