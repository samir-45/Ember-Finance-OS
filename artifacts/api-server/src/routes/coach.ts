import { randomUUID } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { and, eq, gte, lte } from "drizzle-orm";
import { Router } from "express";
import {
  CreateCoachReviewBody,
  ParseQuickEntryBody,
} from "@workspace/api-zod";
import {
  accounts,
  categories,
  coachInsights,
  db,
  goals,
  subscriptions,
  transactions,
} from "@workspace/db";
import { getFinanceUserId } from "../lib/auth";
import {
  getCoachInsights,
  getFinanceReport,
} from "../lib/finance-analytics";
import { getUserSettings, todayIso } from "../lib/finance-data";
import type { CurrencyCode } from "../lib/finance-data";
import { dateToIso, parseMoneyMinor, validate } from "./finance-utils";

const router = Router();
const reviewCooldowns = new Map<string, number>();

router.get("/coach/insights", async (_req, res) => {
  res.json(await getCoachInsights(getFinanceUserId(res)));
});

router.post("/coach/review", async (req, res) => {
  const body = validate(CreateCoachReviewBody, req.body, res);
  if (!body) return;
  const userId = getFinanceUserId(res);
  const settings = await getUserSettings(userId);
  if (!settings.aiCoachEnabled) {
    res.status(403).json({ error: "Turn on the AI coach in Settings to request a review" });
    return;
  }
  const month = dateToIso(body.month).slice(0, 7);
  const [existing] = await db
    .select()
    .from(coachInsights)
    .where(
      and(
        eq(coachInsights.userId, userId),
        eq(coachInsights.period, month),
        eq(coachInsights.source, "ai"),
      ),
    )
    .limit(1);
  if (existing) {
    res.json({
      id: existing.id,
      kind: existing.kind,
      title: existing.title,
      body: existing.body,
      createdAt: existing.createdAt.toISOString(),
      source: "ai",
      severity: existing.severity,
    });
    return;
  }
  const now = Date.now();
  const lastRequest = reviewCooldowns.get(userId) ?? 0;
  if (now - lastRequest < 10_000) {
    res.status(429).json({ error: "Please wait a few seconds before requesting another review" });
    return;
  }
  reviewCooldowns.set(userId, now);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "AI reviews are not configured on this server" });
    return;
  }
  const monthStart = `${month}-01`;
  const monthEnd = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
  )
    .toISOString()
    .slice(0, 10);
  const [report, categoryRows, transactionRows, accountRows, goalRows, subscriptionRows] =
    await Promise.all([
      getFinanceReport(userId, { kind: "month", value: month }),
      db.select().from(categories).where(eq(categories.userId, userId)),
      db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.status, "done"),
            gte(transactions.date, monthStart),
            lte(transactions.date, monthEnd),
          ),
        ),
      db.select().from(accounts).where(eq(accounts.userId, userId)),
      db.select().from(goals).where(eq(goals.userId, userId)),
      db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
    ]);
  const categoryNames = new Map(categoryRows.map((category) => [category.id, category.name]));
  const aggregate = {
    period: month,
    income: report.income,
    expenses: report.expenses,
    net: report.net,
    topCategories: report.topCategories.slice(0, 6).map((category) => ({
      name: category.categoryName,
      amounts: category.amounts,
    })),
    recurringMonthlyCost: subscriptionRows
      .filter((subscription) => subscription.active)
      .reduce((totals, subscription) => {
        const normalized =
          subscription.billingCycle === "weekly"
            ? Math.round((subscription.amountMinor * 52) / 12)
            : subscription.billingCycle === "quarterly"
              ? Math.round(subscription.amountMinor / 3)
              : subscription.billingCycle === "yearly"
                ? Math.round(subscription.amountMinor / 12)
                : subscription.amountMinor;
        if (subscription.currency === "USD") totals.usdMinor += normalized;
        else totals.bdtMinor += normalized;
        return totals;
      }, { usdMinor: 0, bdtMinor: 0 }),
    goals: goalRows.map((goal) => ({
      name: goal.name,
      progressPercent: Math.min(100, Math.round((goal.currentMinor / goal.targetMinor) * 100)),
      currency: goal.currency,
    })),
  };
  if (settings.shareAiDetails) {
    Object.assign(aggregate, {
      recentActivity: transactionRows
        .filter((transaction) => transaction.type !== "transfer")
        .slice(0, 20)
        .map((transaction) => ({
          type: transaction.type,
          amountMinor: transaction.amountMinor,
          currency: transaction.currency,
          category: transaction.categoryId
            ? categoryNames.get(transaction.categoryId) ?? null
            : null,
          merchant: transaction.merchant,
          note: transaction.note,
        })),
      accounts: accountRows.map((account) => ({
        type: account.type,
        currency: account.currency,
      })),
    });
  }

  const client = new GoogleGenAI({ apiKey });
  let modelText: string | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await client.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          "You are Ember, a calm and practical personal finance coach for a freelancer who earns in USD and spends in BDT.",
          "Use only the data below. Do not invent facts or give tax, investment, or legal advice.",
          "Return one JSON object only with keys title, body, kind, severity. kind must be review, tip, win, or warning; severity must be an integer from 1 to 5. Keep the body under 100 words, supportive and specific. Explicitly note that amounts remain in their original currencies.",
          `Aggregate financial data: ${JSON.stringify(aggregate)}`,
        ].join("\n\n"),
        config: {
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      });
      modelText = response.text;
      if (!modelText?.trim()) throw new Error("The AI review returned no text");
      break;
    } catch {
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
      }
    }
  }
  if (!modelText) {
    reviewCooldowns.delete(userId);
    res.status(502).json({
      error: "Ember could not prepare the review right now. Please try again shortly.",
    });
    return;
  }
  let parsed: { title?: unknown; body?: unknown; kind?: unknown; severity?: unknown } = {};
  try {
    parsed = JSON.parse(modelText);
  } catch {
    const start = modelText.indexOf("{");
    const end = modelText.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(modelText.slice(start, end + 1));
      } catch {
        parsed = {};
      }
    }
  }
  const kind =
    parsed.kind === "tip" || parsed.kind === "win" || parsed.kind === "warning"
      ? parsed.kind
      : "review";
  const title =
    typeof parsed.title === "string" && parsed.title.trim()
      ? parsed.title.trim().slice(0, 120)
      : `Your ${month} review`;
  const reviewBody =
    typeof parsed.body === "string" && parsed.body.trim()
      ? parsed.body.trim().slice(0, 1200)
      : modelText.trim().slice(0, 1200);
  const severity = Math.min(
    5,
    Math.max(1, Number.isInteger(parsed.severity) ? Number(parsed.severity) : 2),
  );
  const [saved] = await db
    .insert(coachInsights)
    .values({
      id: randomUUID(),
      userId,
      kind,
      title,
      body: reviewBody,
      source: "ai",
      severity,
      period: month,
    })
    .returning();
  res.status(201).json({
    id: saved!.id,
    kind: saved!.kind,
    title: saved!.title,
    body: saved!.body,
    createdAt: saved!.createdAt.toISOString(),
    source: "ai",
    severity: saved!.severity,
  });
});

router.post("/coach/parse-entry", async (req, res) => {
  const body = validate(ParseQuickEntryBody, req.body, res);
  if (!body) return;
  const userId = getFinanceUserId(res);
  const text = body.text.trim();
  const settings = await getUserSettings(userId);
  const explicitDate = text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  const date = explicitDate
    ? explicitDate
    : /\byesterday\b/i.test(text)
      ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      : todayIso();
  const withoutDate = text
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b(today|yesterday)\b/gi, " ");
  const amountMatch = withoutDate.match(
    /(?:\$|৳|tk\.?\s*|usd\s*|bdt\s*)?(\d[\d,]*(?:\.\d{1,2})?)(?:\s*(?:usd|bdt|taka|dollars?))?/i,
  );
  const amountToken = amountMatch?.[0] ?? "";
  const amountMinor = amountMatch ? parseMoneyMinor(amountMatch[1]!) : null;
  if (!amountMinor || amountMinor <= 0) {
    res.status(400).json({ error: "Include a positive amount, such as $45 or 3,200 BDT" });
    return;
  }
  const currency: CurrencyCode =
    /\$|\busd\b|dollars?/i.test(withoutDate)
      ? "USD"
      : /৳|\bbdt\b|\btaka\b|\btk\.?/i.test(withoutDate)
        ? "BDT"
        : settings.baseCurrency;
  const type =
    /\b(earned|income|received|client|salary|retainer|invoice|payment from)\b/i.test(text)
      ? "income"
      : "expense";
  const normalizedText = withoutDate
    .replace(amountToken, " ")
    .replace(/\b(spent|paid|bought|purchase|received|earned|income|expense|for|on|at|from|with|using)\b/gi, " ")
    .replace(/[$৳,]/g, " ")
    .replace(/\b(usd|bdt|taka|tk|dollars?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const categoryRows = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId));
  const matchingCategory = categoryRows.find(
    (category) =>
      category.type === type &&
      normalizedText.toLowerCase().includes(category.name.toLowerCase()),
  );
  res.json({
    type,
    amountMinor,
    currency,
    date,
    note: normalizedText || (type === "income" ? "Income" : "Expense"),
    categoryId: matchingCategory?.id ?? null,
    confidence:
      0.45 +
      0.35 +
      (explicitDate || /\b(today|yesterday)\b/i.test(text) ? 0.1 : 0) +
      (matchingCategory ? 0.1 : 0),
  });
});

export default router;
