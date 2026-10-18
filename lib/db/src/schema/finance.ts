import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const currencyEnum = pgEnum("finance_currency", ["USD", "BDT"]);
export const transactionTypeEnum = pgEnum("finance_transaction_type", [
  "income",
  "expense",
  "transfer",
]);
export const transactionStatusEnum = pgEnum("finance_transaction_status", [
  "planned",
  "pending",
  "done",
]);
export const billingCycleEnum = pgEnum("finance_billing_cycle", [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
]);
export const coachInsightKindEnum = pgEnum("finance_coach_insight_kind", [
  "tip",
  "warning",
  "win",
  "review",
]);

export const userProfiles = pgTable("finance_user_profiles", {
  id: text("id").primaryKey(),
  baseCurrency: currencyEnum("base_currency").notNull().default("USD"),
  displayCurrency: text("display_currency").notNull().default("original"),
  aiCoachEnabled: boolean("ai_coach_enabled").notNull().default(true),
  shareAiDetails: boolean("share_ai_details").notNull().default(false),
  compactMode: boolean("compact_mode").notNull().default(false),
  demoSeeded: boolean("demo_seeded").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const accounts = pgTable(
  "finance_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    currency: currencyEnum("currency").notNull(),
    openingBalanceMinor: integer("opening_balance_minor").notNull().default(0),
    color: text("color").notNull().default("#ff3b1f"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("finance_accounts_user_id_idx").on(table.userId)],
);

export const categories = pgTable(
  "finance_categories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    parentId: text("parent_id"),
    type: text("type").notNull(),
    color: text("color").notNull().default("#ff3b1f"),
    icon: text("icon").notNull().default("circle"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("finance_categories_user_id_idx").on(table.userId)],
);

export const transfers = pgTable(
  "finance_transfers",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    fromAccountId: text("from_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    toAccountId: text("to_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    amountOutMinor: integer("amount_out_minor").notNull(),
    amountInMinor: integer("amount_in_minor").notNull(),
    exchangeRate: numeric("exchange_rate", {
      precision: 12,
      scale: 6,
    }).notNull(),
    feeMinor: integer("fee_minor").notNull().default(0),
    feeCurrency: currencyEnum("fee_currency").notNull().default("USD"),
    date: date("date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("finance_transfers_user_date_idx").on(table.userId, table.date)],
);

export const transactions = pgTable(
  "finance_transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    transferId: text("transfer_id").references(() => transfers.id, {
      onDelete: "cascade",
    }),
    type: transactionTypeEnum("type").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: currencyEnum("currency").notNull(),
    note: text("note"),
    merchant: text("merchant"),
    date: date("date", { mode: "string" }).notNull(),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    paymentMethod: text("payment_method").notNull().default("Other"),
    status: transactionStatusEnum("status").notNull().default("done"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("finance_transactions_user_date_idx").on(table.userId, table.date),
    index("finance_transactions_user_status_idx").on(
      table.userId,
      table.status,
    ),
    index("finance_transactions_account_idx").on(table.accountId),
  ],
);

export const subscriptions = pgTable(
  "finance_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: currencyEnum("currency").notNull(),
    billingCycle: billingCycleEnum("billing_cycle").notNull(),
    nextBillingDate: date("next_billing_date", { mode: "string" }).notNull(),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    accountId: text("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("finance_subscriptions_user_id_idx").on(table.userId)],
);

export const budgets = pgTable(
  "finance_budgets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    month: date("month", { mode: "string" }).notNull(),
    limitMinor: integer("limit_minor").notNull(),
    currency: currencyEnum("currency").notNull(),
  },
  (table) => [
    uniqueIndex("finance_budgets_user_category_month_uq").on(
      table.userId,
      table.categoryId,
      table.month,
    ),
  ],
);

export const goals = pgTable(
  "finance_goals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    targetMinor: integer("target_minor").notNull(),
    currentMinor: integer("current_minor").notNull().default(0),
    currency: currencyEnum("currency").notNull(),
    deadline: date("deadline", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("finance_goals_user_id_idx").on(table.userId)],
);

export const exchangeRates = pgTable(
  "finance_exchange_rates",
  {
    id: text("id").primaryKey(),
    fromCurrency: currencyEnum("from_currency").notNull(),
    toCurrency: currencyEnum("to_currency").notNull(),
    rate: numeric("rate", { precision: 12, scale: 6 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("finance_exchange_rates_pair_uq").on(
      table.fromCurrency,
      table.toCurrency,
    ),
  ],
);

export const coachInsights = pgTable(
  "finance_coach_insights",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    kind: coachInsightKindEnum("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    source: text("source").notNull(),
    severity: integer("severity").notNull().default(2),
    period: text("period").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("finance_insights_user_created_idx").on(table.userId, table.createdAt)],
);
