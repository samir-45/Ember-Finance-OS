import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  accounts,
  budgets,
  categories,
  coachInsights,
  exchangeRates,
  goals,
  subscriptions,
  transactions,
  transfers,
  userProfiles,
} from "@workspace/db/schema";

type InsertClient = Pick<typeof db, "insert">;

export type CurrencyCode = "USD" | "BDT";
export type MoneyPair = { usdMinor: number; bdtMinor: number };

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export function todayIso(): string {
  return isoDate(new Date());
}

export function currentMonthIso(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function monthIso(monthOffset = 0): string {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + monthOffset);
  return isoDate(date);
}

export function dateInMonth(month: string, day: number): string {
  const safeDay = Math.min(Math.max(day, 1), 28);
  return `${month.slice(0, 7)}-${String(safeDay).padStart(2, "0")}`;
}

export function addMoney(pair: MoneyPair, amountMinor: number, currency: CurrencyCode) {
  if (currency === "USD") pair.usdMinor += amountMinor;
  else pair.bdtMinor += amountMinor;
}

export function emptyMoneyPair(): MoneyPair {
  return { usdMinor: 0, bdtMinor: 0 };
}

export function toBdtMinor(amountMinor: number, currency: CurrencyCode, usdToBdt: number) {
  return Math.round(currency === "USD" ? amountMinor * usdToBdt : amountMinor);
}

export function pairAsBdtMinor(pair: MoneyPair, usdToBdt: number) {
  return pair.bdtMinor + Math.round(pair.usdMinor * usdToBdt);
}

async function seedDemoData(tx: InsertClient, userId: string) {
  const categoryDefinitions = [
    { key: "income", name: "Income", type: "income", color: "#b4e6c1", icon: "arrow-down-left" },
    { key: "consulting", name: "Consulting", parent: "income", type: "income", color: "#b4e6c1", icon: "briefcase" },
    { key: "housing", name: "Home", type: "expense", color: "#ff6a2b", icon: "house" },
    { key: "rent", name: "Rent", parent: "housing", type: "expense", color: "#ff6a2b", icon: "key-round" },
    { key: "food", name: "Food & groceries", type: "expense", color: "#f3ad65", icon: "utensils" },
    { key: "software", name: "Software", type: "expense", color: "#ff3b1f", icon: "laptop" },
    { key: "transport", name: "Transport", type: "expense", color: "#e0aa74", icon: "car-front" },
    { key: "utilities", name: "Utilities", type: "expense", color: "#b7a9ff", icon: "plug-zap" },
    { key: "fees", name: "Transfer fees", type: "expense", color: "#d16b5a", icon: "arrow-left-right" },
  ];
  const categoryIds = new Map<string, string>();
  const categoryRows = categoryDefinitions.map((definition) => {
    const id = randomUUID();
    categoryIds.set(definition.key, id);
    return {
      id,
      userId,
      name: definition.name,
      parentId: definition.parent ? categoryIds.get(definition.parent) ?? null : null,
      type: definition.type,
      color: definition.color,
      icon: definition.icon,
    };
  });
  await tx.insert(categories).values(categoryRows);

  const accountIds = {
    usd: randomUUID(),
    bdt: randomUUID(),
    savings: randomUUID(),
  };
  const accountRows = [
    {
      id: accountIds.usd,
      userId,
      name: "USD checking",
      type: "checking",
      currency: "USD" as const,
      openingBalanceMinor: 425000,
      color: "#ff6a2b",
    },
    {
      id: accountIds.bdt,
      userId,
      name: "BDT everyday",
      type: "bank",
      currency: "BDT" as const,
      openingBalanceMinor: 6200000,
      color: "#ff3b1f",
    },
    {
      id: accountIds.savings,
      userId,
      name: "BDT reserve",
      type: "savings",
      currency: "BDT" as const,
      openingBalanceMinor: 18500000,
      color: "#b4e6c1",
    },
  ];
  await tx.insert(accounts).values(accountRows);

  const transactionRows: Array<typeof transactions.$inferInsert> = [];
  const transferRows: Array<typeof transfers.$inferInsert> = [];
  for (let offset = -5; offset <= 0; offset += 1) {
    const month = monthIso(offset);
    const date = (day: number) => dateInMonth(month, day);
    const transferId = randomUUID();
    const rate = 119.25 + (offset + 5) * 0.25;
    const amountOutMinor = 100000;
    const amountInMinor = Math.round(amountOutMinor * rate);
    transferRows.push({
      id: transferId,
      userId,
      fromAccountId: accountIds.usd,
      toAccountId: accountIds.bdt,
      amountOutMinor,
      amountInMinor,
      exchangeRate: rate.toFixed(6),
      feeMinor: 250,
      feeCurrency: "USD",
      date: date(9),
    });
    transactionRows.push(
      {
        id: randomUUID(),
        userId,
        accountId: accountIds.usd,
        categoryId: null,
        transferId,
        type: "transfer",
        amountMinor: amountOutMinor,
        currency: "USD",
        note: "Monthly USD to BDT transfer",
        merchant: "Wise",
        date: date(9),
        tags: ["conversion"],
        paymentMethod: "Wise",
        status: "done",
      },
      {
        id: randomUUID(),
        userId,
        accountId: accountIds.bdt,
        categoryId: null,
        transferId,
        type: "transfer",
        amountMinor: amountInMinor,
        currency: "BDT",
        note: "Monthly USD to BDT transfer",
        merchant: "Wise",
        date: date(9),
        tags: ["conversion"],
        paymentMethod: "Bank transfer",
        status: "done",
      },
      {
        id: randomUUID(),
        userId,
        accountId: accountIds.usd,
        categoryId: categoryIds.get("consulting")!,
        type: "income",
        amountMinor: 320000,
        currency: "USD",
        note: "Monthly client retainer",
        merchant: "Northstar Studio",
        date: date(5),
        tags: ["client", "retainer"],
        paymentMethod: "Bank transfer",
        status: "done",
      },
      {
        id: randomUUID(),
        userId,
        accountId: accountIds.usd,
        categoryId: categoryIds.get("software")!,
        type: "expense",
        amountMinor: 4999,
        currency: "USD",
        note: "Design and cloud tools",
        merchant: "Design suite",
        date: date(14),
        tags: ["work", "recurring"],
        paymentMethod: "Card",
        status: "done",
      },
      {
        id: randomUUID(),
        userId,
        accountId: accountIds.usd,
        categoryId: categoryIds.get("fees")!,
        type: "expense",
        amountMinor: 250,
        currency: "USD",
        note: "Transfer fee",
        merchant: "Wise",
        date: date(9),
        tags: ["fee"],
        paymentMethod: "Wise",
        status: "done",
      },
      {
        id: randomUUID(),
        userId,
        accountId: accountIds.bdt,
        categoryId: categoryIds.get("rent")!,
        type: "expense",
        amountMinor: 7500000,
        currency: "BDT",
        note: "Monthly rent",
        merchant: "Home",
        date: date(3),
        tags: ["fixed"],
        paymentMethod: "Bank transfer",
        status: "done",
      },
      {
        id: randomUUID(),
        userId,
        accountId: accountIds.bdt,
        categoryId: categoryIds.get("food")!,
        type: "expense",
        amountMinor: 3150000 + Math.max(0, offset) * 180000,
        currency: "BDT",
        note: "Market and meals",
        merchant: "Local market",
        date: date(17),
        tags: ["everyday"],
        paymentMethod: "Mobile banking",
        status: "done",
      },
      {
        id: randomUUID(),
        userId,
        accountId: accountIds.bdt,
        categoryId: categoryIds.get("transport")!,
        type: "expense",
        amountMinor: 850000,
        currency: "BDT",
        note: "Rides and commute",
        merchant: "Transit",
        date: date(20),
        tags: ["everyday"],
        paymentMethod: "Mobile banking",
        status: "done",
      },
      {
        id: randomUUID(),
        userId,
        accountId: accountIds.bdt,
        categoryId: categoryIds.get("utilities")!,
        type: "expense",
        amountMinor: 1600000,
        currency: "BDT",
        note: "Internet and utilities",
        merchant: "Home services",
        date: date(24),
        tags: ["fixed"],
        paymentMethod: "Bank transfer",
        status: "done",
      },
    );
  }
  await tx.insert(transfers).values(transferRows);
  await tx.insert(transactions).values(transactionRows);

  const nextDate = isoDate(new Date(Date.now() + 12 * 24 * 60 * 60 * 1000));
  await tx.insert(subscriptions).values([
    {
      id: randomUUID(),
      userId,
      name: "Design suite",
      amountMinor: 4999,
      currency: "USD",
      billingCycle: "monthly",
      nextBillingDate: nextDate,
      categoryId: categoryIds.get("software"),
      accountId: accountIds.usd,
      active: true,
    },
    {
      id: randomUUID(),
      userId,
      name: "Cloud storage",
      amountMinor: 1199,
      currency: "USD",
      billingCycle: "monthly",
      nextBillingDate: nextDate,
      categoryId: categoryIds.get("software"),
      accountId: accountIds.usd,
      active: true,
    },
    {
      id: randomUUID(),
      userId,
      name: "Home fiber",
      amountMinor: 150000,
      currency: "BDT",
      billingCycle: "monthly",
      nextBillingDate: nextDate,
      categoryId: categoryIds.get("utilities"),
      accountId: accountIds.bdt,
      active: true,
    },
  ]);

  const month = currentMonthIso();
  await tx.insert(budgets).values([
    {
      id: randomUUID(),
      userId,
      categoryId: categoryIds.get("rent")!,
      month,
      limitMinor: 9000000,
      currency: "BDT",
    },
    {
      id: randomUUID(),
      userId,
      categoryId: categoryIds.get("food")!,
      month,
      limitMinor: 4000000,
      currency: "BDT",
    },
    {
      id: randomUUID(),
      userId,
      categoryId: categoryIds.get("software")!,
      month,
      limitMinor: 12000,
      currency: "USD",
    },
  ]);

  await tx.insert(goals).values([
    {
      id: randomUUID(),
      userId,
      name: "Emergency reserve",
      targetMinor: 1000000,
      currentMinor: 430000,
      currency: "USD",
      deadline: null,
    },
    {
      id: randomUUID(),
      userId,
      name: "Studio equipment",
      targetMinor: 18000000,
      currentMinor: 7200000,
      currency: "BDT",
      deadline: null,
    },
  ]);

  await tx.insert(exchangeRates).values([
    {
      id: randomUUID(),
      fromCurrency: "USD",
      toCurrency: "BDT",
      rate: "120.500000",
    },
    {
      id: randomUUID(),
      fromCurrency: "BDT",
      toCurrency: "USD",
      rate: "0.008299",
    },
  ]).onConflictDoNothing();
}

export async function ensureFinanceUser(userId: string) {
  await db.transaction(async (tx) => {
    await tx.insert(userProfiles).values({ id: userId }).onConflictDoNothing();
    const [profile] = await tx
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .for("update");
    if (!profile) throw new Error("Could not initialize finance profile");
    if (!profile.demoSeeded) {
      await seedDemoData(tx, userId);
      await tx
        .update(userProfiles)
        .set({ demoSeeded: true, updatedAt: new Date() })
        .where(eq(userProfiles.id, userId));
    }
  });
  return getUserSettings(userId);
}

export async function getUserSettings(userId: string) {
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1);
  if (!profile) throw new Error("Finance profile was not initialized");
  return {
    baseCurrency: profile.baseCurrency,
    displayCurrency: profile.displayCurrency,
    aiCoachEnabled: profile.aiCoachEnabled,
    shareAiDetails: profile.shareAiDetails,
    compactMode: profile.compactMode,
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export async function getUsdToBdtRate(): Promise<number> {
  const [row] = await db
    .select()
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.fromCurrency, "USD"),
        eq(exchangeRates.toCurrency, "BDT"),
      ),
    )
    .orderBy(desc(exchangeRates.updatedAt))
    .limit(1);
  return row ? Number(row.rate) : 120.5;
}

export async function getAccountsWithBalances(userId: string) {
  const [accountRows, transactionRows, transferRows] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)),
    db.select().from(transfers).where(eq(transfers.userId, userId)),
  ]);
  const transferMap = new Map(transferRows.map((row) => [row.id, row]));
  return accountRows.map((account) => {
    let balanceMinor = account.openingBalanceMinor;
    for (const transaction of transactionRows) {
      if (transaction.accountId !== account.id || transaction.status !== "done") continue;
      if (transaction.type === "income") balanceMinor += transaction.amountMinor;
      if (transaction.type === "expense") balanceMinor -= transaction.amountMinor;
      if (transaction.type === "transfer") {
        const transfer = transaction.transferId
          ? transferMap.get(transaction.transferId)
          : undefined;
        if (transfer?.fromAccountId === account.id) balanceMinor -= transaction.amountMinor;
        else if (transfer?.toAccountId === account.id) balanceMinor += transaction.amountMinor;
      }
    }
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      openingBalanceMinor: account.openingBalanceMinor,
      balanceMinor,
      color: account.color,
      createdAt: account.createdAt.toISOString(),
    };
  });
}

export async function getTransactionList(userId: string) {
  const [rows, accountRows, categoryRows] = await Promise.all([
    db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.date), desc(transactions.createdAt)),
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(categories).where(eq(categories.userId, userId)),
  ]);
  const accountMap = new Map(accountRows.map((account) => [account.id, account.name]));
  const categoryMap = new Map(categoryRows.map((category) => [category.id, category.name]));
  return rows.map((row) => ({
    id: row.id,
    accountId: row.accountId,
    accountName: accountMap.get(row.accountId) ?? "Account",
    categoryId: row.categoryId,
    categoryName: row.categoryId ? categoryMap.get(row.categoryId) ?? null : null,
    type: row.type,
    amountMinor: row.amountMinor,
    currency: row.currency,
    note: row.note,
    merchant: row.merchant,
    date: row.date,
    tags: row.tags,
    paymentMethod: row.paymentMethod,
    status: row.status,
    transferId: row.transferId,
  }));
}

export async function getTransferList(userId: string) {
  const [rows, accountRows] = await Promise.all([
    db.select().from(transfers).where(eq(transfers.userId, userId)).orderBy(desc(transfers.date)),
    db.select().from(accounts).where(eq(accounts.userId, userId)),
  ]);
  const accountMap = new Map(accountRows.map((account) => [account.id, account]));
  return rows.map((row) => ({
    id: row.id,
    fromAccountId: row.fromAccountId,
    fromAccountName: accountMap.get(row.fromAccountId)?.name ?? "Account",
    toAccountId: row.toAccountId,
    toAccountName: accountMap.get(row.toAccountId)?.name ?? "Account",
    amountOutMinor: row.amountOutMinor,
    amountInMinor: row.amountInMinor,
    fromCurrency: accountMap.get(row.fromAccountId)?.currency ?? "USD",
    toCurrency: accountMap.get(row.toAccountId)?.currency ?? "BDT",
    exchangeRate: Number(row.exchangeRate),
    feeMinor: row.feeMinor,
    feeCurrency: row.feeCurrency,
    date: row.date,
  }));
}
