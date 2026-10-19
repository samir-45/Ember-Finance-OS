import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { Router } from "express";
import { CreateTransferBody } from "@workspace/api-zod";
import {
  accounts,
  categories,
  db,
  exchangeRates,
  transactions,
  transfers,
} from "@workspace/db";
import { getFinanceUserId } from "../lib/auth";
import { getTransferList } from "../lib/finance-data";
import { dateToIso, validate } from "./finance-utils";

const router = Router();

router.get("/transfers", async (_req, res) => {
  res.json(await getTransferList(getFinanceUserId(res)));
});

router.post("/transfers", async (req, res) => {
  const body = validate(CreateTransferBody, req.body, res);
  if (!body) return;
  const userId = getFinanceUserId(res);
  const [from, to] = await Promise.all([
    db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, body.fromAccountId), eq(accounts.userId, userId)))
      .limit(1)
      .then(([row]) => row),
    db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, body.toAccountId), eq(accounts.userId, userId)))
      .limit(1)
      .then(([row]) => row),
  ]);
  if (!from || !to || from.id === to.id) {
    res.status(400).json({ error: "Choose two different accounts that you own" });
    return;
  }
  if (!Number.isFinite(body.exchangeRate) || body.exchangeRate <= 0) {
    res.status(400).json({ error: "Exchange rate must be greater than zero" });
    return;
  }
  const feeCurrency = body.feeCurrency ?? from.currency;
  const feeAccount =
    from.currency === feeCurrency
      ? from
      : to.currency === feeCurrency
        ? to
        : null;
  if (!feeAccount) {
    res.status(400).json({ error: "Fee currency must match one of the transfer accounts" });
    return;
  }
  const [feeCategory] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        eq(categories.name, "Transfer fees"),
        eq(categories.type, "expense"),
      ),
    )
    .limit(1);
  const transferId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(transfers).values({
      id: transferId,
      userId,
      fromAccountId: from.id,
      toAccountId: to.id,
      amountOutMinor: body.amountOutMinor,
      amountInMinor: body.amountInMinor,
      exchangeRate: body.exchangeRate.toFixed(6),
      feeMinor: body.feeMinor ?? 0,
      feeCurrency,
      date: dateToIso(body.date),
    });
    await tx.insert(transactions).values([
      {
        id: randomUUID(),
        userId,
        accountId: from.id,
        categoryId: null,
        transferId,
        type: "transfer",
        amountMinor: body.amountOutMinor,
        currency: from.currency,
        note: `Transfer to ${to.name}`,
        merchant: "Internal transfer",
        date: dateToIso(body.date),
        tags: ["transfer"],
        paymentMethod: "Transfer",
        status: "done",
      },
      {
        id: randomUUID(),
        userId,
        accountId: to.id,
        categoryId: null,
        transferId,
        type: "transfer",
        amountMinor: body.amountInMinor,
        currency: to.currency,
        note: `Transfer from ${from.name}`,
        merchant: "Internal transfer",
        date: dateToIso(body.date),
        tags: ["transfer"],
        paymentMethod: "Transfer",
        status: "done",
      },
      ...(body.feeMinor && body.feeMinor > 0
        ? [
            {
              id: randomUUID(),
              userId,
              accountId: feeAccount.id,
              categoryId: feeCategory?.id ?? null,
              transferId,
              type: "expense" as const,
              amountMinor: body.feeMinor,
              currency: feeCurrency,
              note: "Transfer fee",
              merchant: "Transfer provider",
              date: dateToIso(body.date),
              tags: ["fee", "transfer"],
              paymentMethod: "Transfer",
              status: "done" as const,
            },
          ]
        : []),
    ]);
    if (from.currency === "USD" && to.currency === "BDT") {
      await tx
        .insert(exchangeRates)
        .values({
          id: randomUUID(),
          fromCurrency: "USD",
          toCurrency: "BDT",
          rate: body.exchangeRate.toFixed(6),
        })
        .onConflictDoUpdate({
          target: [exchangeRates.fromCurrency, exchangeRates.toCurrency],
          set: { rate: body.exchangeRate.toFixed(6), updatedAt: new Date() },
        });
      await tx
        .insert(exchangeRates)
        .values({
          id: randomUUID(),
          fromCurrency: "BDT",
          toCurrency: "USD",
          rate: (1 / body.exchangeRate).toFixed(6),
        })
        .onConflictDoUpdate({
          target: [exchangeRates.fromCurrency, exchangeRates.toCurrency],
          set: { rate: (1 / body.exchangeRate).toFixed(6), updatedAt: new Date() },
        });
    }
  });
  const response = (await getTransferList(userId)).find(
    (transfer) => transfer.id === transferId,
  );
  res.status(201).json(response);
});

export default router;
