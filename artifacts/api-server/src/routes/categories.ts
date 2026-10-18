import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { Router } from "express";
import {
  CreateCategoryBody,
  UpdateCategoryBody,
} from "@workspace/api-zod";
import { budgets, categories, db, transactions } from "@workspace/db";
import { getFinanceUserId } from "../lib/auth";
import { validate } from "./finance-utils";

const router = Router();

router.get("/categories", async (_req, res) => {
  const userId = getFinanceUserId(res);
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));
  res.json(rows);
});

router.post("/categories", async (req, res) => {
  const body = validate(CreateCategoryBody, req.body, res);
  if (!body) return;
  const userId = getFinanceUserId(res);
  if (body.parentId) {
    const [parent] = await db
      .select({ id: categories.id, type: categories.type })
      .from(categories)
      .where(and(eq(categories.id, body.parentId), eq(categories.userId, userId)))
      .limit(1);
    if (!parent || parent.type !== body.type) {
      res.status(400).json({ error: "Choose a parent category of the same type" });
      return;
    }
  }
  const [category] = await db
    .insert(categories)
    .values({
      id: randomUUID(),
      userId,
      name: body.name.trim(),
      parentId: body.parentId ?? null,
      type: body.type,
      color: body.color,
      icon: body.icon,
    })
    .returning();
  res.status(201).json(category);
});

router.patch("/categories/:id", async (req, res) => {
  const body = validate(UpdateCategoryBody, req.body, res);
  if (!body) return;
  const userId = getFinanceUserId(res);
  if (body.parentId) {
    const [parent] = await db
      .select({ id: categories.id, type: categories.type })
      .from(categories)
      .where(and(eq(categories.id, body.parentId), eq(categories.userId, userId)))
      .limit(1);
    if (!parent || (body.type && parent.type !== body.type)) {
      res.status(400).json({ error: "Choose a parent category of the same type" });
      return;
    }
  }
  const updates = {
    ...(body.name !== undefined ? { name: body.name.trim() } : {}),
    ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
    ...(body.type !== undefined ? { type: body.type } : {}),
    ...(body.color !== undefined ? { color: body.color } : {}),
    ...(body.icon !== undefined ? { icon: body.icon } : {}),
  };
  const [category] = await db
    .update(categories)
    .set(updates)
    .where(and(eq(categories.id, req.params.id), eq(categories.userId, userId)))
    .returning();
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  res.json(category);
});

router.delete("/categories/:id", async (req, res) => {
  const userId = getFinanceUserId(res);
  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, req.params.id), eq(categories.userId, userId)))
    .limit(1);
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }
  const [transaction] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.categoryId, category.id),
        eq(transactions.userId, userId),
      ),
    )
    .limit(1);
  const [budget] = await db
    .select({ id: budgets.id })
    .from(budgets)
    .where(
      and(eq(budgets.categoryId, category.id), eq(budgets.userId, userId)),
    )
    .limit(1);
  if (transaction || budget) {
    res.status(409).json({
      error: "Reassign this category's transactions and budgets first",
    });
    return;
  }
  await db
    .update(categories)
    .set({ parentId: null })
    .where(
      and(eq(categories.parentId, category.id), eq(categories.userId, userId)),
    );
  await db.delete(categories).where(eq(categories.id, category.id));
  res.status(204).send();
});

export default router;
