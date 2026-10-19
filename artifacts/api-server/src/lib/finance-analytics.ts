import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  accounts,
  budgets,
  categories,
  coachInsights,
  goals,
  subscriptions,
  transactions,
  transfers,
} from "@workspace/db/schema";
import {
  addMoney,
  currentMonthIso,
  emptyMoneyPair,
  getAccountsWithBalances,
  getTransactionList,
  getUsdToBdtRate,
  getUserSettings,
  monthIso,
  pairAsBdtMinor,
  type CurrencyCode,
  type MoneyPair,
} from "./finance-data";

const minorToMajor = (value: number) => value / 100;
const roundToOne = (value: number) => Math.round(value * 10) / 10;

function monthKey(date: string) {
  return date.slice(0, 7);
}

function offsetMonth(month: string, offset: number) {
  const [year, value] = month.slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(year!, value! - 1 + offset, 1)).toISOString().slice(0, 7);
}

function pairForRows(
  rows: Array<{ amountMinor: number; currency: CurrencyCode }>,
): MoneyPair {
  const pair = emptyMoneyPair();
  for (const row of rows) addMoney(pair, row.amountMinor, row.currency);
  return pair;
}

function toPublicSubscription(row: typeof subscriptions.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    amountMinor: row.amountMinor,
    currency: row.currency,
    billingCycle: row.billingCycle,
    nextBillingDate: row.nextBillingDate,
    categoryId: row.categoryId,
    accountId: row.accountId,
    active: row.active,
  };
}

function toPublicGoal(row: typeof goals.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    targetMinor: row.targetMinor,
    currentMinor: row.currentMinor,
    currency: row.currency,
    deadline: row.deadline,
  };
}

function monthlyEquivalent(
  amountMinor: number,
  cycle: "weekly" | "monthly" | "quarterly" | "yearly",
) {
  switch (cycle) {
    case "weekly":
      return Math.round((amountMinor * 52) / 12);
    case "quarterly":
      return Math.round(amountMinor / 3);
    case "yearly":
      return Math.round(amountMinor / 12);
    default:
      return amountMinor;
  }
}

async function budgetsForMonth(
  userId: string,
  month: string,
  categoryRows: Array<typeof categories.$inferSelect>,
  transactionRows: Array<typeof transactions.$inferSelect>,
) {
  const rows = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.month, `${month.slice(0, 7)}-01`)));
  const categoryMap = new Map(categoryRows.map((category) => [category.id, category.name]));
  return rows.map((row) => ({
    id: row.id,
    categoryId: row.categoryId,
    categoryName: categoryMap.get(row.categoryId) ?? "Category",
    month: row.month,
    limitMinor: row.limitMinor,
    spentMinor: transactionRows
      .filter(
        (transaction) =>
          transaction.type === "expense" &&
          transaction.status === "done" &&
          transaction.categoryId === row.categoryId &&
          transaction.currency === row.currency &&
          monthKey(transaction.date) === month.slice(0, 7),
      )
      .reduce((total, transaction) => total + transaction.amountMinor, 0),
    currency: row.currency,
  }));
}

function conversionSummary(
  transferRows: Array<typeof transfers.$inferSelect>,
  accountRows: Array<typeof accounts.$inferSelect>,
  usdToBdt: number,
  month?: string,
) {
  const accountMap = new Map(accountRows.map((account) => [account.id, account]));
  const periodTransfers = month
    ? transferRows.filter((row) => monthKey(row.date) === month.slice(0, 7))
    : transferRows;
  const rates = periodTransfers
    .map((row) => {
      const from = accountMap.get(row.fromAccountId)?.currency;
      const to = accountMap.get(row.toAccountId)?.currency;
      if (from === "USD" && to === "BDT") return Number(row.exchangeRate);
      if (from === "BDT" && to === "USD") return 1 / Number(row.exchangeRate);
      return null;
    })
    .filter((rate): rate is number => rate !== null && Number.isFinite(rate));
  const totalFees = emptyMoneyPair();
  for (const row of periodTransfers) addMoney(totalFees, row.feeMinor, row.feeCurrency);
  return {
    averageRate: rates.length ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : usdToBdt,
    bestRate: rates.length ? Math.max(...rates) : usdToBdt,
    worstRate: rates.length ? Math.min(...rates) : usdToBdt,
    totalFees,
    transfersCount: periodTransfers.length,
  };
}

function ruleInsights(
  budgetsForCurrentMonth: Array<{
    id: string;
    categoryId: string;
    categoryName: string;
    limitMinor: number;
    spentMinor: number;
    currency: CurrencyCode;
  }>,
  income: MoneyPair,
  expenses: MoneyPair,
  netWorth: MoneyPair,
  rate: number,
  goalsForUser: Array<typeof goals.$inferSelect>,
  month: string,
) {
  const now = new Date().toISOString();
  const insights: Array<{
    id: string;
    kind: "tip" | "warning" | "win";
    title: string;
    body: string;
    createdAt: string;
    source: "rules";
    severity: number;
  }> = [];
  for (const budget of budgetsForCurrentMonth) {
    const ratio = budget.limitMinor > 0 ? budget.spentMinor / budget.limitMinor : 0;
    if (ratio >= 1) {
      insights.push({
        id: `rule-budget-${budget.id}`,
        kind: "warning",
        title: `${budget.categoryName} is over budget`,
        body: `You've spent ${Math.round(ratio * 100)}% of this month's limit. A quick review may help you decide what to adjust.`,
        createdAt: now,
        source: "rules",
        severity: 4,
      });
    } else if (ratio >= 0.8) {
      insights.push({
        id: `rule-budget-${budget.id}`,
        kind: "tip",
        title: `${budget.categoryName} is nearing its limit`,
        body: `${Math.round(ratio * 100)}% of this month's budget is used.`,
        createdAt: now,
        source: "rules",
        severity: 2,
      });
    }
  }
  const incomeBdt = pairAsBdtMinor(income, rate);
  const expensesBdt = pairAsBdtMinor(expenses, rate);
  if (incomeBdt > 0 && expensesBdt < incomeBdt) {
    insights.push({
      id: `rule-savings-${month}`,
      kind: "win",
      title: "You're spending within your income",
      body: `This month, your recorded income is ahead of spending by ${Math.round(((incomeBdt - expensesBdt) / incomeBdt) * 100)}%.`,
      createdAt: now,
      source: "rules",
      severity: 1,
    });
  }
  const activeGoals = goalsForUser.filter((goal) => goal.currentMinor < goal.targetMinor);
  if (activeGoals.length) {
    const nearest = activeGoals.sort(
      (a, b) => b.currentMinor / b.targetMinor - a.currentMinor / a.targetMinor,
    )[0]!;
    const percent = Math.floor((nearest.currentMinor / nearest.targetMinor) * 100);
    if (percent >= 25) {
      insights.push({
        id: `rule-goal-${nearest.id}`,
        kind: "win",
        title: `${percent}% of ${nearest.name}`,
        body: "Your progress is moving in the right direction. Keep contributing at a pace that feels sustainable.",
        createdAt: now,
        source: "rules",
        severity: 1,
      });
    }
  }
  if (netWorth.usdMinor < 0 || netWorth.bdtMinor < 0) {
    insights.push({
      id: `rule-balance-${month}`,
      kind: "warning",
      title: "One account is below zero",
      body: "Review upcoming payments and transfers to keep your balances aligned with your plans.",
      createdAt: now,
      source: "rules",
      severity: 4,
    });
  }
  return insights.sort((a, b) => b.severity - a.severity).slice(0, 4);
}

export async function getFinanceDashboard(userId: string) {
  const [transactionRows, accountRows, categoryRows, subscriptionRows, goalRows, transferRows, settings, rate] =
    await Promise.all([
      db.select().from(transactions).where(eq(transactions.userId, userId)),
      db.select().from(accounts).where(eq(accounts.userId, userId)),
      db.select().from(categories).where(eq(categories.userId, userId)),
      db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
      db.select().from(goals).where(eq(goals.userId, userId)),
      db.select().from(transfers).where(eq(transfers.userId, userId)),
      getUserSettings(userId),
      getUsdToBdtRate(),
    ]);
  const month = currentMonthIso();
  const completed = transactionRows.filter((row) => row.status === "done");
  const realActivity = completed.filter((row) => row.type !== "transfer");
  const monthActivity = realActivity.filter((row) => monthKey(row.date) === month.slice(0, 7));
  const incomeRows = monthActivity.filter((row) => row.type === "income");
  const expenseRows = monthActivity.filter((row) => row.type === "expense");
  const income = pairForRows(incomeRows);
  const expenses = pairForRows(expenseRows);
  const netWorth = emptyMoneyPair();
  const accountsWithBalances = await getAccountsWithBalances(userId);
  for (const account of accountsWithBalances) addMoney(netWorth, account.balanceMinor, account.currency);
  const budgetViews = await budgetsForMonth(userId, month, categoryRows, transactionRows);

  const months = Array.from({ length: 6 }, (_, index) => offsetMonth(month, index - 5));
  const cashFlow = months.map((monthName) => {
    const rows = realActivity.filter(
      (row) => row.status === "done" && monthKey(row.date) === monthName,
    );
    return {
      month: monthName,
      income: pairForRows(rows.filter((row) => row.type === "income")),
      expenses: pairForRows(rows.filter((row) => row.type === "expense")),
    };
  });

  const categoryMap = new Map(categoryRows.map((category) => [category.id, category]));
  const categoryTotals = new Map<string, MoneyPair>();
  for (const row of expenseRows) {
    const id = row.categoryId ?? "uncategorized";
    const pair = categoryTotals.get(id) ?? emptyMoneyPair();
    addMoney(pair, row.amountMinor, row.currency);
    categoryTotals.set(id, pair);
  }
  const totalCategoryBdt = [...categoryTotals.values()].reduce(
    (total, pair) => total + pairAsBdtMinor(pair, rate),
    0,
  );
  const categorySpending = [...categoryTotals.entries()]
    .map(([categoryId, amounts]) => {
      const category = categoryMap.get(categoryId);
      return {
        categoryId,
        categoryName: category?.name ?? "Uncategorized",
        color: category?.color ?? "#a3a3a3",
        amounts,
        percentage: totalCategoryBdt
          ? (pairAsBdtMinor(amounts, rate) / totalCategoryBdt) * 100
          : 0,
      };
    })
    .sort((a, b) => pairAsBdtMinor(b.amounts, rate) - pairAsBdtMinor(a.amounts, rate))
    .slice(0, 8);

  const methodTotals = new Map<string, MoneyPair>();
  for (const row of expenseRows) {
    const pair = methodTotals.get(row.paymentMethod) ?? emptyMoneyPair();
    addMoney(pair, row.amountMinor, row.currency);
    methodTotals.set(row.paymentMethod, pair);
  }
  const paymentMethods = [...methodTotals.entries()].map(([method, amounts]) => ({
    method,
    amounts,
    percentage: totalCategoryBdt
      ? (pairAsBdtMinor(amounts, rate) / totalCategoryBdt) * 100
      : 0,
  }));
  const subscriptionMonthlyCost = emptyMoneyPair();
  const activeSubscriptions = subscriptionRows.filter((row) => row.active);
  for (const row of activeSubscriptions) {
    addMoney(
      subscriptionMonthlyCost,
      monthlyEquivalent(row.amountMinor, row.billingCycle),
      row.currency,
    );
  }
  const healthScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        50 +
          (pairAsBdtMinor(income, rate) > 0
            ? ((pairAsBdtMinor(income, rate) - pairAsBdtMinor(expenses, rate)) /
                pairAsBdtMinor(income, rate)) *
              35
            : 0) +
          (accountsWithBalances.every((account) => account.balanceMinor >= 0) ? 10 : -20) +
          (budgetViews.every((budget) => budget.spentMinor <= budget.limitMinor) ? 5 : -8),
      ),
    ),
  );
  const averageMonthlyExpenseBdt =
    months.reduce((sum, monthName) => {
      const point = cashFlow.find((entry) => entry.month === monthName)!;
      return sum + pairAsBdtMinor(point.expenses, rate);
    }, 0) / months.length;
  const recent = await getTransactionList(userId);
  const storedInsights = await db
    .select()
    .from(coachInsights)
    .where(eq(coachInsights.userId, userId));
  const localRules = ruleInsights(
    budgetViews,
    income,
    expenses,
    netWorth,
    rate,
    goalRows,
    month,
  );
  const coachInsightList = [
    ...localRules,
    ...storedInsights
      .filter((item) => item.source === "ai")
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        title: item.title,
        body: item.body,
        createdAt: item.createdAt.toISOString(),
        source: "ai" as const,
        severity: item.severity,
      })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);

  return {
    selectedMonth: month.slice(0, 7),
    selectedCurrency: settings.displayCurrency,
    conversionRate: rate,
    netWorth,
    incomeThisMonth: income,
    expensesThisMonth: expenses,
    savingsRatePercent: pairAsBdtMinor(income, rate)
      ? roundToOne(
          ((pairAsBdtMinor(income, rate) - pairAsBdtMinor(expenses, rate)) /
            pairAsBdtMinor(income, rate)) *
            100,
        )
      : 0,
    runwayMonths: averageMonthlyExpenseBdt > 0
      ? Math.max(0, pairAsBdtMinor(netWorth, rate) / averageMonthlyExpenseBdt)
      : 0,
    healthScore,
    cashFlow,
    categorySpending,
    paymentMethods,
    accounts: accountsWithBalances,
    subscriptions: subscriptionRows.map(toPublicSubscription),
    subscriptionMonthlyCost,
    budgets: budgetViews,
    goals: goalRows.map(toPublicGoal),
    conversionSummary: conversionSummary(transferRows, accountRows, rate),
    coachInsights: coachInsightList,
    recentTransactions: recent.slice(0, 8),
  };
}

export async function getCoachInsights(userId: string, month = currentMonthIso()) {
  const [transactionRows, categoryRows, goalRows, accountRows, transferRows, stored] =
    await Promise.all([
      db.select().from(transactions).where(eq(transactions.userId, userId)),
      db.select().from(categories).where(eq(categories.userId, userId)),
      db.select().from(goals).where(eq(goals.userId, userId)),
      db.select().from(accounts).where(eq(accounts.userId, userId)),
      db.select().from(transfers).where(eq(transfers.userId, userId)),
      db.select().from(coachInsights).where(eq(coachInsights.userId, userId)),
    ]);
  const [incomeRows, expenseRows] = [
    transactionRows.filter(
      (row) =>
        row.status === "done" &&
        row.type === "income" &&
        monthKey(row.date) === month.slice(0, 7),
    ),
    transactionRows.filter(
      (row) =>
        row.status === "done" &&
        row.type === "expense" &&
        monthKey(row.date) === month.slice(0, 7),
    ),
  ];
  const [rate, accountBalanceRows] = await Promise.all([
    getUsdToBdtRate(),
    getAccountsWithBalances(userId),
  ]);
  const netWorth = emptyMoneyPair();
  for (const account of accountBalanceRows) addMoney(netWorth, account.balanceMinor, account.currency);
  const budgetsForCurrentMonth = await budgetsForMonth(
    userId,
    month,
    categoryRows,
    transactionRows,
  );
  const rules = ruleInsights(
    budgetsForCurrentMonth,
    pairForRows(incomeRows),
    pairForRows(expenseRows),
    netWorth,
    rate,
    goalRows,
    month,
  );
  const ai = stored
    .filter((row) => row.source === "ai")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      source: "ai" as const,
      severity: row.severity,
    }));
  const conversion = conversionSummary(transferRows, accountRows, rate, month);
  const result = [...rules, ...ai].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return result.length
    ? result
    : [
        {
          id: "rule-first-review",
          kind: "tip" as const,
          title: "Your money patterns are private",
          body: `Ember's coach uses your account totals, budgets, and goals. It does not send merchant names or notes. ${conversion.transfersCount ? "Your transfer history is included only as totals." : "Add activity to get more useful observations."}`,
          createdAt: new Date().toISOString(),
          source: "rules" as const,
          severity: 1,
        },
      ];
}

export async function getFinanceReport(
  userId: string,
  period: { kind: "month"; value: string } | { kind: "year"; value: number },
) {
  const [transactionRows, categoryRows, transferRows, accountRows, subscriptionRows] =
    await Promise.all([
      db.select().from(transactions).where(eq(transactions.userId, userId)),
      db.select().from(categories).where(eq(categories.userId, userId)),
      db.select().from(transfers).where(eq(transfers.userId, userId)),
      db.select().from(accounts).where(eq(accounts.userId, userId)),
      db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
    ]);
  const startMonth =
    period.kind === "month"
      ? period.value.slice(0, 7)
      : `${period.value}-01`;
  const count = period.kind === "month" ? 6 : 12;
  const firstMonth = period.kind === "month" ? offsetMonth(startMonth, -(count - 1)) : startMonth;
  const endMonth =
    period.kind === "month"
      ? startMonth
      : `${period.value}-12`;
  const included = transactionRows.filter(
    (row) =>
      row.status === "done" &&
      row.type !== "transfer" &&
      monthKey(row.date) >= firstMonth &&
      monthKey(row.date) <= endMonth,
  );
  const selectedRows = included.filter((row) =>
    period.kind === "month"
      ? monthKey(row.date) === startMonth
      : row.date.startsWith(`${period.value}-`),
  );
  const incomeRows = selectedRows.filter((row) => row.type === "income");
  const expenseRows = selectedRows.filter((row) => row.type === "expense");
  const income = pairForRows(incomeRows);
  const expenses = pairForRows(expenseRows);
  const net = {
    usdMinor: income.usdMinor - expenses.usdMinor,
    bdtMinor: income.bdtMinor - expenses.bdtMinor,
  };
  const rate = await getUsdToBdtRate();
  const categoryMap = new Map(categoryRows.map((category) => [category.id, category]));
  const categoryTotals = new Map<string, MoneyPair>();
  for (const row of expenseRows) {
    const id = row.categoryId ?? "uncategorized";
    const pair = categoryTotals.get(id) ?? emptyMoneyPair();
    addMoney(pair, row.amountMinor, row.currency);
    categoryTotals.set(id, pair);
  }
  const expensesBdt = pairAsBdtMinor(expenses, rate);
  const topCategories = [...categoryTotals.entries()]
    .map(([categoryId, amounts]) => {
      const category = categoryMap.get(categoryId);
      return {
        categoryId,
        categoryName: category?.name ?? "Uncategorized",
        color: category?.color ?? "#a3a3a3",
        amounts,
        percentage: expensesBdt
          ? (pairAsBdtMinor(amounts, rate) / expensesBdt) * 100
          : 0,
      };
    })
    .sort((a, b) => pairAsBdtMinor(b.amounts, rate) - pairAsBdtMinor(a.amounts, rate))
    .slice(0, 8);
  const seriesMonths = Array.from({ length: count }, (_, index) =>
    period.kind === "month"
      ? offsetMonth(startMonth, index - count + 1)
      : offsetMonth(`${period.value}-01`, index),
  );
  const monthlySeries = seriesMonths.map((month) => {
    const rows = included.filter((row) => monthKey(row.date) === month);
    return {
      month,
      income: pairForRows(rows.filter((row) => row.type === "income")),
      expenses: pairForRows(rows.filter((row) => row.type === "expense")),
    };
  });
  let previousExpenseBdt = 0;
  if (period.kind === "month") {
    const previousMonth = offsetMonth(startMonth, -1);
    previousExpenseBdt = pairAsBdtMinor(
      pairForRows(
        transactionRows.filter(
          (row) =>
            row.status === "done" &&
            row.type === "expense" &&
            monthKey(row.date) === previousMonth,
        ),
      ),
      rate,
    );
  }
  const changePercent = period.kind === "month" && previousExpenseBdt
    ? ((expensesBdt - previousExpenseBdt) / previousExpenseBdt) * 100
    : 0;
  const subscriptionTotal = emptyMoneyPair();
  for (const row of subscriptionRows.filter((subscription) => subscription.active)) {
    addMoney(
      subscriptionTotal,
      monthlyEquivalent(row.amountMinor, row.billingCycle),
      row.currency,
    );
  }
  return {
    period:
      period.kind === "month"
        ? startMonth
        : String(period.value),
    income,
    expenses,
    net,
    changePercent,
    topCategories,
    monthlySeries,
    subscriptionTotal,
    conversionSummary: conversionSummary(
      transferRows,
      accountRows,
      rate,
      period.kind === "month" ? startMonth : undefined,
    ),
  };
}

