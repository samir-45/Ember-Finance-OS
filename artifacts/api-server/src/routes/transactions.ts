import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { Router } from "express";
import {
  BulkUpdateTransactionsBody,
  CreateTransactionBody,
  ImportTransactionsBody,
  UpdateTransactionBody,
} from "@workspace/api-zod";
import { accounts, categories, db, transactions } from "@workspace/db";
import { getFinanceUserId } from "../lib/auth";
import { getTransactionList } from "../lib/finance-data";
import {
  csvDateIsValid,
  parseCsv,
  parseMoneyMinor,
  quoteCsvCell,
  validate,
} from "./finance-utils";

const router = Router();
const statuses = new Set(["planned", "pending", "done"]);
const types = new Set(["income", "expense", "transfer"]);

async function transactionAccountIsValid(
  userId: string,
  accountId: string,
  currency: string,
) {
  const [account] = await db
    .select({ id: accounts.id, currency: accounts.currency })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .limit(1);
  return Boolean(account && account.currency === currency);
}

async function categoryIsValid(
  userId: string,
  categoryId: string | null | undefined,
  type: string,
) {
  if (!categoryId) return true;
  const [category] = await db
    .select({ id: categories.id, type: categories.type })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .limit(1);
  return Boolean(category && category.type === type);
}

router.get("/transactions", async (req, res) => {
  const userId = getFinanceUserId(res);
  const queryValue = (key: string) =>
    typeof req.query[key] === "string" ? String(req.query[key]) : undefined;
  const status = queryValue("status");
  const type = queryValue("type");
  const categoryId = queryValue("categoryId");
  const accountId = queryValue("accountId");
  const search = queryValue("search")?.trim().toLowerCase();
  const tag = queryValue("tag")?.trim().toLowerCase();
  const paymentMethod = queryValue("paymentMethod")?.trim().toLowerCase();
  const from = queryValue("from");
  const to = queryValue("to");
  const limit = Math.min(500, Math.max(1, Number(queryValue("limit")) || 500));
  const offset = Math.max(0, Number(queryValue("offset")) || 0);
  if (status && !statuses.has(status)) {
    res.status(400).json({ error: "Unknown transaction status" });
    return;
  }
  if (type && !types.has(type)) {
    res.status(400).json({ error: "Unknown transaction type" });
    return;
  }
  const all = await getTransactionList(userId);
  const filtered = all.filter((transaction) => {
    if (status && transaction.status !== status) return false;
    if (type && transaction.type !== type) return false;
    if (categoryId && transaction.categoryId !== categoryId) return false;
    if (accountId && transaction.accountId !== accountId) return false;
    if (from && transaction.date < from) return false;
    if (to && transaction.date > to) return false;
    if (tag && !transaction.tags.some((item) => item.toLowerCase() === tag)) return false;
    if (paymentMethod && transaction.paymentMethod.toLowerCase() !== paymentMethod) return false;
    if (
      search &&
      ![
        transaction.note ?? "",
        transaction.merchant ?? "",
        transaction.categoryName ?? "",
        transaction.accountName,
        transaction.paymentMethod,
        ...transaction.tags,
      ].some((value) => value.toLowerCase().includes(search))
    ) {
      return false;
    }
    return true;
  });
  res.json(filtered.slice(offset, offset + limit));
});

router.post("/transactions", async (req, res) => {
  const body = validate(CreateTransactionBody, req.body, res);
  if (!body) return;
  const userId = getFinanceUserId(res);
  if (body.type === "transfer") {
    res.status(400).json({ error: "Use the transfer form for account transfers" });
    return;
  }
  if (!(await transactionAccountIsValid(userId, body.accountId, body.currency))) {
    res.status(400).json({ error: "Choose an account with the same currency" });
    return;
  }
  if (!(await categoryIsValid(userId, body.categoryId, body.type))) {
    res.status(400).json({ error: "Choose a category that matches the transaction type" });
    return;
  }
  const [transaction] = await db
    .insert(transactions)
    .values({
      id: randomUUID(),
      userId,
      accountId: body.accountId,
      categoryId: body.categoryId ?? null,
      type: body.type,
      amountMinor: body.amountMinor,
      currency: body.currency,
      note: body.note ?? null,
      merchant: body.merchant ?? null,
      date: body.date,
      tags: body.tags ?? [],
      paymentMethod: body.paymentMethod ?? "Other",
      status: body.status,
    })
    .returning({ id: transactions.id });
  const response = (await getTransactionList(userId)).find(
    (item) => item.id === transaction!.id,
  );
  res.status(201).json(response);
});

router.patch("/transactions/bulk", async (req, res) => {
  const body = validate(BulkUpdateTransactionsBody, req.body, res);
  if (!body) return;
  const userId = getFinanceUserId(res);
  if (body.status === undefined && body.categoryId === undefined) {
    res.status(400).json({ error: "Choose a status or category update" });
    return;
  }
  const owned = await db
    .select({ id: transactions.id, type: transactions.type })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), inArray(transactions.id, body.ids)));
  if (owned.length !== body.ids.length) {
    res.status(404).json({ error: "One or more transactions were not found" });
    return;
  }
  if (owned.some((item) => item.type === "transfer")) {
    res.status(400).json({ error: "Transfer rows cannot be bulk edited" });
    return;
  }
  if (body.categoryId && !(await categoryIsValid(userId, body.categoryId, "expense"))) {
    const [category] = await db
      .select({ type: categories.type })
      .from(categories)
      .where(and(eq(categories.id, body.categoryId), eq(categories.userId, userId)))
      .limit(1);
    if (!category) {
      res.status(400).json({ error: "Category not found" });
      return;
    }
  }
  await db
    .update(transactions)
    .set({
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
    })
    .where(and(eq(transactions.userId, userId), inArray(transactions.id, body.ids)));
  const idSet = new Set(body.ids);
  res.json((await getTransactionList(userId)).filter((item) => idSet.has(item.id)));
});

router.patch("/transactions/:id", async (req, res) => {
  const body = validate(UpdateTransactionBody, req.body, res);
  if (!body) return;
  const userId = getFinanceUserId(res);
  const [existing] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, req.params.id), eq(transactions.userId, userId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  if (existing.type === "transfer" || body.type === "transfer") {
    res.status(400).json({ error: "Edit transfers from the transfer flow" });
    return;
  }
  const accountId = body.accountId ?? existing.accountId;
  const currency = body.currency ?? existing.currency;
  const type = body.type ?? existing.type;
  const categoryId = body.categoryId === undefined ? existing.categoryId : body.categoryId;
  if (!(await transactionAccountIsValid(userId, accountId, currency))) {
    res.status(400).json({ error: "Choose an account with the same currency" });
    return;
  }
  if (!(await categoryIsValid(userId, categoryId, type))) {
    res.status(400).json({ error: "Choose a category that matches the transaction type" });
    return;
  }
  const [updated] = await db
    .update(transactions)
    .set({
      ...(body.accountId !== undefined ? { accountId: body.accountId } : {}),
      ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
      ...(body.type !== undefined ? { type: body.type } : {}),
      ...(body.amountMinor !== undefined ? { amountMinor: body.amountMinor } : {}),
      ...(body.currency !== undefined ? { currency: body.currency } : {}),
      ...(body.note !== undefined ? { note: body.note } : {}),
      ...(body.merchant !== undefined ? { merchant: body.merchant } : {}),
      ...(body.date !== undefined ? { date: body.date } : {}),
      ...(body.tags !== undefined ? { tags: body.tags } : {}),
      ...(body.paymentMethod !== undefined ? { paymentMethod: body.paymentMethod } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    })
    .where(and(eq(transactions.id, existing.id), eq(transactions.userId, userId)))
    .returning({ id: transactions.id });
  const response = (await getTransactionList(userId)).find(
    (item) => item.id === updated!.id,
  );
  res.json(response);
});

router.delete("/transactions/:id", async (req, res) => {
  const userId = getFinanceUserId(res);
  const [transaction] = await db
    .select({ id: transactions.id, transferId: transactions.transferId })
    .from(transactions)
    .where(and(eq(transactions.id, req.params.id), eq(transactions.userId, userId)))
    .limit(1);
  if (!transaction) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  if (transaction.transferId) {
    res.status(409).json({ error: "Remove this row from the transfer history" });
    return;
  }
  await db
    .delete(transactions)
    .where(and(eq(transactions.id, transaction.id), eq(transactions.userId, userId)));
  res.status(204).send();
});

router.post("/transactions/import", async (req, res) => {
  const body = validate(ImportTransactionsBody, req.body, res);
  if (!body) return;
  const userId = getFinanceUserId(res);
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, body.accountId), eq(accounts.userId, userId)))
    .limit(1);
  if (!account) {
    res.status(400).json({ error: "Choose one of your accounts" });
    return;
  }
  const rows = parseCsv(body.csv);
  if (rows.length < 2) {
    res.status(400).json({ error: "CSV needs a header and at least one data row" });
    return;
  }
  const headers = rows[0]!.map((header) => header.trim().toLowerCase());
  const column = (name: string) => headers.indexOf(name);
  if (column("date") < 0 || (column("amount") < 0 && column("amountminor") < 0)) {
    res.status(400).json({ error: "CSV must include date and amount columns" });
    return;
  }
  const [oldRows, categoryRows] = await Promise.all([
    db.select().from(transactions).where(eq(transactions.userId, userId)),
    db.select().from(categories).where(eq(categories.userId, userId)),
  ]);
  const fingerprint = (row: {
    date: string;
    amountMinor: number;
    currency: string;
    type: string;
    merchant?: string | null;
    note?: string | null;
  }) =>
    [
      row.date,
      row.amountMinor,
      row.currency,
      row.type,
      row.merchant?.trim().toLowerCase() ?? "",
      row.note?.trim().toLowerCase() ?? "",
    ].join("|");
  const seen = new Set(oldRows.map(fingerprint));
  const categoryMap = new Map(
    categoryRows.map((category) => [
      `${category.type}:${category.name.toLowerCase()}`,
      category.id,
    ]),
  );
  const inserts: Array<typeof transactions.$inferInsert> = [];
  const errors: string[] = [];
  let skipped = 0;
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index]!;
    const cell = (name: string) => (column(name) >= 0 ? row[column(name)]?.trim() ?? "" : "");
    const date = cell("date");
    const currency = (cell("currency") || account.currency) as CurrencyCode;
    const type = cell("type");
    const amountMinor = column("amountminor") >= 0
      ? Number(cell("amountminor"))
      : parseMoneyMinor(cell("amount"));
    const note = cell("note");
    const merchant = cell("merchant");
    if (!csvDateIsValid(date)) {
      errors.push(`Row ${index + 1}: invalid date`);
      continue;
    }
    if (!["USD", "BDT"].includes(currency) || currency !== account.currency) {
      errors.push(`Row ${index + 1}: currency must match the selected account`);
      continue;
    }
    if (type !== "income" && type !== "expense") {
      errors.push(`Row ${index + 1}: type must be income or expense`);
      continue;
    }
    if (!Number.isSafeInteger(amountMinor) || Number(amountMinor) <= 0) {
      errors.push(`Row ${index + 1}: amount must be a positive value with at most two decimals`);
      continue;
    }
    const statusValue = cell("status") || "done";
    if (!statuses.has(statusValue)) {
      errors.push(`Row ${index + 1}: unknown status`);
      continue;
    }
    const categoryName = cell("category");
    const categoryId = categoryMap.get(`${type}:${categoryName.toLowerCase()}`) ?? null;
    const tags = cell("tags")
      .split(/[|;]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    const candidate = {
      date,
      amountMinor: Number(amountMinor),
      currency,
      type,
      merchant: merchant || null,
      note: note || null,
    };
    const key = fingerprint(candidate);
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    inserts.push({
      id: randomUUID(),
      userId,
      accountId: account.id,
      categoryId,
      type,
      amountMinor: Number(amountMinor),
      currency,
      note: note || null,
      merchant: merchant || null,
      date,
      tags,
      paymentMethod: cell("paymentmethod") || "Other",
      status: statusValue,
    });
  }
  if (inserts.length) await db.insert(transactions).values(inserts);
  res.json({ imported: inserts.length, skipped, errors });
});

router.get("/transactions/export", async (_req, res) => {
  const userId = getFinanceUserId(res);
  const rows = await getTransactionList(userId);
  const header = [
    "date",
    "type",
    "amount",
    "currency",
    "category",
    "merchant",
    "note",
    "paymentMethod",
    "status",
    "tags",
    "account",
  ];
  const output = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.date,
        row.type,
        (row.amountMinor / 100).toFixed(2),
        row.currency,
        row.categoryName,
        row.merchant,
        row.note,
        row.paymentMethod,
        row.status,
        row.tags.join("|"),
        row.accountName,
      ]
        .map(quoteCsvCell)
        .join(","),
    ),
  ].join("\r\n");
  res
    .status(200)
    .setHeader("Content-Type", "text/csv; charset=utf-8")
    .setHeader("Content-Disposition", 'attachment; filename="ember-transactions.csv"')
    .send(`\uFEFF${output}`);
});

export default router;
