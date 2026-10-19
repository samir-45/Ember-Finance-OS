import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { Router } from "express";
import {
  CreateGoalBody,
  CreateSubscriptionBody,
  UpdateGoalBody,
  UpdateSubscriptionBody,
  UpsertBudgetBody,
} from "@workspace/api-zod";
import {
  accounts,
  budgets,
  categories,
  db,
  goals,
  subscriptions,
  transactions,
} from "@workspace/db";
import { getFinanceUserId } from "../lib/auth";
import { dateToIso, validate } from "./finance-utils";

const router = Router();

async function validateSubscriptionLinks(
  userId: string,
  accountId: string | null | undefined,
  categoryId: string | null | undefined,
  currency: string,
) {
  if (accountId) {
    const [account] = await db
      .select({ currency: accounts.currency })
      .from(accounts)
      .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
      .limit(1);
    if (!account || account.currency !== currency) return false;
  }
  if (categoryId) {
    const [category] = await db
      .select({ type: categories.type })
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
      .limit(1);
    if (!category || category.type !== "expense") return false;
  }
  return true;
}

router.get("/subscriptions", async (_req, res) => {
  const userId = getFinanceUserId(res);
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));
  res.json(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      amountMinor: row.amountMinor,
      currency: row.currency,
      billingCycle: row.billingCycle,
      nextBillingDate: row.nextBillingDate,
      categoryId: row.categoryId,
      accountId: row.accountId,
      active: row.active,
    })),
  );
});

router.post("/subscriptions", async (req, res) => {
  const body = validate(CreateSubscriptionBody, req.body, res);
  if (!body) return;
  const userId = getFinanceUserId(res);
  if (
    !(await validateSubscriptionLinks(
      userId,
      body.accountId,
      body.categoryId,
      body.currency,
    ))
  ) {
    res.status(400).json({ error: "Account and category must belong to you and match this subscription" });
    return;
  }
  const [row] = await db
    .insert(subscriptions)
    .values({
      id: randomUUID(),
      userId,
      name: body.name.trim(),
      amountMinor: body.amountMinor,
      currency: body.currency,
      billingCycle: body.billingCycle,
      nextBillingDate: dateToIso(body.nextBillingDate),
      categoryId: body.categoryId ?? null,
      accountId: body.accountId ?? null,
      active: body.active ?? true,
    })
    .returning();
  res.status(201).json({
    id: row!.id,
    name: row!.name,
    amountMinor: row!.amountMinor,
    currency: row!.currency,
    billingCycle: row!.billingCycle,
    nextBillingDate: row!.nextBillingDate,
    categoryId: row!.categoryId,
    accountId: row!.accountId,
    active: row!.active,
  });
});

router.patch("/subscriptions/:id", async (req, res) => {
  const body = validate(UpdateSubscriptionBody, req.body, res);
  if (!body) return;
  const userId = getFinanceUserId(res);
  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.id, req.params.id), eq(subscriptions.userId, userId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Subscription not found" });
    return;
  }
  const currency = body.currency ?? existing.currency;
  const accountId = body.accountId === undefined ? existing.accountId : body.accountId;
  const categoryId = body.categoryId === undefined ? existing.categoryId : body.categoryId;
  if (!(await validateSubscriptionLinks(userId, accountId, categoryId, currency))) {
    res.status(400).json({ error: "Account and category must belong to you and match this subscription" });
    return;
  }
  const [row] = await db
    .update(subscriptions)
    .set({
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.amountMinor !== undefined ? { amountMinor: body.amountMinor } : {}),
      ...(body.currency !== undefined ? { currency: body.currency } : {}),
      ...(body.billingCycle !== undefined ? { billingCycle: body.billingCycle } : {}),
      ...(body.nextBillingDate !== undefined
        ? { nextBillingDate: dateToIso(body.nextBillingDate) }
        : {}),
      ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
      ...(body.accountId !== undefined ? { accountId: body.accountId } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    })
    .where(and(eq(subscriptions.id, existing.id), eq(subscriptions.userId, userId)))
    .returning();
  res.json({
    id: row!.id,
    name: row!.name,
    amountMinor: row!.amountMinor,
    currency: row!.currency,
    billingCycle: row!.billingCycle,
    nextBillingDate: row!.nextBillingDate,
    categoryId: row!.categoryId,
    accountId: row!.accountId,
    active: row!.active,
  });
});

router.delete("/subscriptions/:id", async (req, res) => {
  const userId = getFinanceUserId(res);
  const [deleted] = await db
    .delete(subscriptions)
    .where(and(eq(subscriptions.id, req.params.id), eq(subscriptions.userId, userId)))
    .returning({ id: subscriptions.id });
  if (!deleted) {
    res.status(404).json({ error: "Subscription not found" });
    return;
  }
  res.status(204).send();
});

function normalizedMonth(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const day = Number(match[3] ?? 1);
  const date = new Date(Date.UTC(Number(match[1]), month - 1, day));
  if (date.getUTCDate() !== day) return null;
  return `${match[1]}-${match[2]}-01`;
}

async function getBudgetViews(userId: string, month: string) {
  const [rows, categoryRows, transactionRows] = await Promise.all([
    db.select().from(budgets).where(and(eq(budgets.userId, userId), eq(budgets.month, month))),
    db.select().from(categories).where(eq(categories.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)),
  ]);
  const names = new Map(categoryRows.map((category) => [category.id, category.name]));
  return rows.map((row) => ({
    id: row.id,
    categoryId: row.categoryId,
    categoryName: names.get(row.categoryId) ?? "Category",
    month: row.month,
    limitMinor: row.limitMinor,
    spentMinor: transactionRows
      .filter(
        (transaction) =>
          transaction.type === "expense" &&
          transaction.status === "done" &&
          transaction.categoryId === row.categoryId &&
          transaction.currency === row.currency &&
          transaction.date.startsWith(month.slice(0, 7)),
      )
      .reduce((total, transaction) => total + transaction.amountMinor, 0),
    currency: row.currency,
  }));
}

router.get("/budgets", async (req, res) => {
  const userId = getFinanceUserId(res);
  const requestedMonth = typeof req.query.month === "string" ? req.query.month : new Date().toISOString().slice(0, 7);
  const month = normalizedMonth(requestedMonth);
  if (!month) {
    res.status(400).json({ error: "Month must use YYYY-MM or YYYY-MM-DD" });
    return;
  }
  res.json(await getBudgetViews(userId, month));
});

router.put("/budgets", async (req, res) => {
  const body = validate(UpsertBudgetBody, req.body, res);
  if (!body) return;
  const userId = getFinanceUserId(res);
  const month = dateToIso(body.month);
  const firstOfMonth = normalizedMonth(month);
  const [category] = await db
    .select({ id: categories.id, type: categories.type })
    .from(categories)
    .where(and(eq(categories.id, body.categoryId), eq(categories.userId, userId)))
    .limit(1);
  if (!category || category.type !== "expense" || !firstOfMonth) {
    res.status(400).json({ error: "Choose an expense category and a valid month" });
    return;
  }
  const [row] = await db
    .insert(budgets)
    .values({
      id: randomUUID(),
      userId,
      categoryId: category.id,
      month: firstOfMonth,
      limitMinor: body.limitMinor,
      currency: body.currency,
    })
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.categoryId, budgets.month],
      set: { limitMinor: body.limitMinor, currency: body.currency },
    })
    .returning({ id: budgets.id });
  const view = (await getBudgetViews(userId, firstOfMonth)).find((item) => item.id === row!.id);
  res.json(view);
});

router.get("/goals", async (_req, res) => {
  const userId = getFinanceUserId(res);
  const rows = await db.select().from(goals).where(eq(goals.userId, userId));
  res.json(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      targetMinor: row.targetMinor,
      currentMinor: row.currentMinor,
      currency: row.currency,
      deadline: row.deadline,
    })),
  );
});

router.post("/goals", async (req, res) => {
  const body = validate(CreateGoalBody, req.body, res);
  if (!body) return;
  const userId = getFinanceUserId(res);
  const [row] = await db
    .insert(goals)
    .values({
      id: randomUUID(),
      userId,
      name: body.name.trim(),
      targetMinor: body.targetMinor,
      currentMinor: body.currentMinor ?? 0,
      currency: body.currency,
      deadline: body.deadline ? dateToIso(body.deadline) : null,
    })
    .returning();
  res.status(201).json({
    id: row!.id,
    name: row!.name,
    targetMinor: row!.targetMinor,
    currentMinor: row!.currentMinor,
    currency: row!.currency,
    deadline: row!.deadline,
  });
});

router.patch("/goals/:id", async (req, res) => {
  const body = validate(UpdateGoalBody, req.body, res);
  if (!body) return;
  const userId = getFinanceUserId(res);
  const [row] = await db
    .update(goals)
    .set({
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.targetMinor !== undefined ? { targetMinor: body.targetMinor } : {}),
      ...(body.currentMinor !== undefined ? { currentMinor: body.currentMinor } : {}),
      ...(body.currency !== undefined ? { currency: body.currency } : {}),
      ...(body.deadline !== undefined
        ? { deadline: body.deadline ? dateToIso(body.deadline) : null }
        : {}),
    })
    .where(and(eq(goals.id, req.params.id), eq(goals.userId, userId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  res.json({
    id: row.id,
    name: row.name,
    targetMinor: row.targetMinor,
    currentMinor: row.currentMinor,
    currency: row.currency,
    deadline: row.deadline,
  });
});

router.delete("/goals/:id", async (req, res) => {
  const userId = getFinanceUserId(res);
  const [deleted] = await db
    .delete(goals)
    .where(and(eq(goals.id, req.params.id), eq(goals.userId, userId)))
    .returning({ id: goals.id });
  if (!deleted) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  res.status(204).send();
});

export default router;
