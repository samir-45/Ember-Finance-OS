import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { Router } from "express";
import {
  CreateAccountBody,
  UpdateAccountBody,
} from "@workspace/api-zod";
import { accounts, subscriptions, transactions, transfers, db } from "@workspace/db";
import { getAccountsWithBalances } from "../lib/finance-data";
import { getFinanceUserId } from "../lib/auth";
import { validate } from "./finance-utils";

const router = Router();

router.get("/accounts", async (_req, res) => {
  res.json(await getAccountsWithBalances(getFinanceUserId(res)));
});

router.post("/accounts", async (req, res) => {
  const body = validate(CreateAccountBody, req.body, res);
  if (!body) return;
  const userId = getFinanceUserId(res);
  const [account] = await db
    .insert(accounts)
    .values({
      id: randomUUID(),
      userId,
      name: body.name.trim(),
      type: body.type,
      currency: body.currency,
      openingBalanceMinor: body.openingBalanceMinor,
      color: body.color ?? "#ff3b1f",
    })
    .returning();
  const accountView = (await getAccountsWithBalances(userId)).find(
    (item) => item.id === account!.id,
  );
  res.status(201).json(accountView);
});

router.patch("/accounts/:id", async (req, res) => {
  const body = validate(UpdateAccountBody, req.body, res);
  if (!body) return;
  const userId = getFinanceUserId(res);
  const [updated] = await db
    .update(accounts)
    .set(body)
    .where(and(eq(accounts.id, req.params.id), eq(accounts.userId, userId)))
    .returning({ id: accounts.id });
  if (!updated) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  const account = (await getAccountsWithBalances(userId)).find(
    (item) => item.id === updated.id,
  );
  res.json(account);
});

router.delete("/accounts/:id", async (req, res) => {
  const userId = getFinanceUserId(res);
  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, req.params.id), eq(accounts.userId, userId)))
    .limit(1);
  if (!account) {
    res.status(404).json({ error: "Account not found" });
    return;
  }
  const [transaction] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.accountId, account.id), eq(transactions.userId, userId)))
    .limit(1);
  const [transfer] = await db
    .select({ id: transfers.id })
    .from(transfers)
    .where(
      and(
        eq(transfers.userId, userId),
        eq(transfers.fromAccountId, account.id),
      ),
    )
    .limit(1);
  const [incomingTransfer] = await db
    .select({ id: transfers.id })
    .from(transfers)
    .where(
      and(
        eq(transfers.userId, userId),
        eq(transfers.toAccountId, account.id),
      ),
    )
    .limit(1);
  if (transaction || transfer || incomingTransfer) {
    res.status(409).json({
      error: "Move or remove this account's transactions and transfers first",
    });
    return;
  }
  await db
    .update(subscriptions)
    .set({ accountId: null })
    .where(
      and(
        eq(subscriptions.accountId, account.id),
        eq(subscriptions.userId, userId),
      ),
    );
  await db.delete(accounts).where(eq(accounts.id, account.id));
  res.status(204).send();
});

export default router;
