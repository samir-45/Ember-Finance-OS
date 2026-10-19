import { eq } from "drizzle-orm";
import { Router } from "express";
import {
  DeleteUserDataBody,
  UpdateSettingsBody,
} from "@workspace/api-zod";
import {
  accounts,
  budgets,
  categories,
  coachInsights,
  db,
  goals,
  subscriptions,
  transactions,
  transfers,
  userProfiles,
} from "@workspace/db";
import { getFinanceUserId } from "../lib/auth";
import {
  getAccountsWithBalances,
  getTransferList,
  getUserSettings,
} from "../lib/finance-data";
import { validate } from "./finance-utils";

const router = Router();

router.get("/settings", async (_req, res) => {
  res.json(await getUserSettings(getFinanceUserId(res)));
});

router.patch("/settings", async (req, res) => {
  const body = validate(UpdateSettingsBody, req.body, res);
  if (!body) return;
  const userId = getFinanceUserId(res);
  await db
    .update(userProfiles)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(userProfiles.id, userId));
  res.json(await getUserSettings(userId));
});

router.get("/settings/export", async (_req, res) => {
  const userId = getFinanceUserId(res);
  const [
    settings,
    accountRows,
    categoryRows,
    transactionRows,
    transferRows,
    subscriptionRows,
    budgetRows,
    goalRows,
  ] = await Promise.all([
    getUserSettings(userId),
    getAccountsWithBalances(userId),
    db.select().from(categories).where(eq(categories.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)),
    getTransferList(userId),
    db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
    db.select().from(budgets).where(eq(budgets.userId, userId)),
    db.select().from(goals).where(eq(goals.userId, userId)),
  ]);
  const categoryMap = new Map(categoryRows.map((category) => [category.id, category.name]));
  const exportBudgets = budgetRows.map((budget) => ({
    id: budget.id,
    categoryId: budget.categoryId,
    categoryName: categoryMap.get(budget.categoryId) ?? "Category",
    month: budget.month,
    limitMinor: budget.limitMinor,
    spentMinor: transactionRows
      .filter(
        (transaction) =>
          transaction.type === "expense" &&
          transaction.status === "done" &&
          transaction.categoryId === budget.categoryId &&
          transaction.currency === budget.currency &&
          transaction.date.startsWith(budget.month.slice(0, 7)),
      )
      .reduce((sum, transaction) => sum + transaction.amountMinor, 0),
    currency: budget.currency,
  }));
  res.json({
    exportedAt: new Date().toISOString(),
    settings,
    accounts: accountRows,
    categories: categoryRows.map((category) => ({
      id: category.id,
      name: category.name,
      parentId: category.parentId,
      type: category.type,
      color: category.color,
      icon: category.icon,
    })),
    transactions: transactionRows.map((transaction) => ({
      id: transaction.id,
      accountId: transaction.accountId,
      accountName: accountRows.find((account) => account.id === transaction.accountId)?.name ?? "Account",
      categoryId: transaction.categoryId,
      categoryName: transaction.categoryId
        ? categoryMap.get(transaction.categoryId) ?? null
        : null,
      type: transaction.type,
      amountMinor: transaction.amountMinor,
      currency: transaction.currency,
      note: transaction.note,
      merchant: transaction.merchant,
      date: transaction.date,
      tags: transaction.tags,
      paymentMethod: transaction.paymentMethod,
      status: transaction.status,
      transferId: transaction.transferId,
    })),
    transfers: transferRows,
    subscriptions: subscriptionRows.map((subscription) => ({
      id: subscription.id,
      name: subscription.name,
      amountMinor: subscription.amountMinor,
      currency: subscription.currency,
      billingCycle: subscription.billingCycle,
      nextBillingDate: subscription.nextBillingDate,
      categoryId: subscription.categoryId,
      accountId: subscription.accountId,
      active: subscription.active,
    })),
    budgets: exportBudgets,
    goals: goalRows.map((goal) => ({
      id: goal.id,
      name: goal.name,
      targetMinor: goal.targetMinor,
      currentMinor: goal.currentMinor,
      currency: goal.currency,
      deadline: goal.deadline,
    })),
  });
});

router.delete("/settings/data", async (req, res) => {
  const body = validate(DeleteUserDataBody, req.body, res);
  if (!body) return;
  const userId = getFinanceUserId(res);
  await db.transaction(async (tx) => {
    await tx.delete(transactions).where(eq(transactions.userId, userId));
    await tx.delete(transfers).where(eq(transfers.userId, userId));
    await tx.delete(budgets).where(eq(budgets.userId, userId));
    await tx.delete(subscriptions).where(eq(subscriptions.userId, userId));
    await tx.delete(goals).where(eq(goals.userId, userId));
    await tx.delete(coachInsights).where(eq(coachInsights.userId, userId));
    await tx.delete(categories).where(eq(categories.userId, userId));
    await tx.delete(accounts).where(eq(accounts.userId, userId));
    await tx
      .update(userProfiles)
      .set({
        baseCurrency: "USD",
        displayCurrency: "original",
        aiCoachEnabled: true,
        shareAiDetails: false,
        compactMode: false,
        demoSeeded: true,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.id, userId));
  });
  res.status(204).send();
});

export default router;
