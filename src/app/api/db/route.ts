import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb, isDatabaseConfigured, schema } from '@/lib/db';

const DB_DIR = path.join(process.cwd(), '.data');
const DB_FILE = path.join(DB_DIR, 'ember_vault.json');

function ensureDbExists() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

// ── GET: Read from PostgreSQL (or Local File Vault) ──
export async function GET() {
  try {
    const db = getDb();

    if (db && isDatabaseConfigured()) {
      try {
        const [
          allAccounts,
          allCategories,
          allTransactions,
          allTransfers,
          allSubscriptions,
          allBudgets,
          allGoals,
          allExchangeRates,
        ] = await Promise.all([
          db.select().from(schema.accounts),
          db.select().from(schema.categories),
          db.select().from(schema.transactions),
          db.select().from(schema.transfers),
          db.select().from(schema.subscriptions),
          db.select().from(schema.budgets),
          db.select().from(schema.goals),
          db.select().from(schema.exchangeRates),
        ]);

        return NextResponse.json({
          exists: true,
          provider: 'postgresql_drizzle',
          data: {
            accounts: allAccounts,
            categories: allCategories,
            transactions: allTransactions,
            transfers: allTransfers,
            subscriptions: allSubscriptions,
            budgets: allBudgets,
            goals: allGoals,
            exchangeRates: allExchangeRates,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (dbErr: any) {
        console.warn('PostgreSQL query error, falling back to local file vault:', dbErr.message);
      }
    }

    // Local Vault Fallback
    ensureDbExists();
    if (!fs.existsSync(DB_FILE)) {
      return NextResponse.json({
        exists: false,
        provider: 'local_vault',
        message: 'No server snapshot found. Client localStorage is the active ledger.',
        timestamp: new Date().toISOString(),
      });
    }

    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json({
      exists: true,
      provider: 'local_vault',
      data,
      timestamp: data.savedAt || new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── POST: Sync/Upsert to PostgreSQL (or Local File Vault) ──
export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const db = getDb();

    if (db && isDatabaseConfigured()) {
      try {
        // Upsert into PostgreSQL tables in sequence
        if (payload.accounts && payload.accounts.length > 0) {
          for (const a of payload.accounts) {
            await db
              .insert(schema.accounts)
              .values({
                id: a.id,
                name: a.name,
                type: a.type,
                currency: a.currency,
                initialBalanceMinor: a.initialBalanceMinor || 0,
                color: a.color || null,
              })
              .onConflictDoUpdate({
                target: schema.accounts.id,
                set: {
                  name: a.name,
                  type: a.type,
                  currency: a.currency,
                  initialBalanceMinor: a.initialBalanceMinor || 0,
                  updatedAt: new Date(),
                },
              });
          }
        }

        if (payload.categories && payload.categories.length > 0) {
          for (const c of payload.categories) {
            await db
              .insert(schema.categories)
              .values({
                id: c.id,
                name: c.name,
                type: c.type,
                icon: c.icon || null,
                color: c.color || null,
                isCustom: Boolean(c.isCustom),
              })
              .onConflictDoUpdate({
                target: schema.categories.id,
                set: {
                  name: c.name,
                  type: c.type,
                  icon: c.icon || null,
                  color: c.color || null,
                },
              });
          }
        }

        if (payload.transactions && payload.transactions.length > 0) {
          for (const t of payload.transactions) {
            await db
              .insert(schema.transactions)
              .values({
                id: t.id,
                accountId: t.accountId,
                categoryId: t.categoryId,
                transferId: t.transferId || null,
                type: t.type,
                amountMinor: t.amountMinor,
                currency: t.currency,
                merchant: t.merchant,
                note: t.note || null,
                date: t.date,
                tags: t.tags || [],
                paymentMethod: t.paymentMethod || null,
                status: t.status || 'done',
              })
              .onConflictDoUpdate({
                target: schema.transactions.id,
                set: {
                  accountId: t.accountId,
                  categoryId: t.categoryId,
                  transferId: t.transferId || null,
                  type: t.type,
                  amountMinor: t.amountMinor,
                  currency: t.currency,
                  merchant: t.merchant,
                  note: t.note || null,
                  date: t.date,
                  tags: t.tags || [],
                  status: t.status || 'done',
                },
              });
          }
        }

        if (payload.transfers && payload.transfers.length > 0) {
          for (const tr of payload.transfers) {
            await db
              .insert(schema.transfers)
              .values({
                id: tr.id,
                fromAccountId: tr.fromAccountId,
                toAccountId: tr.toAccountId,
                fromAmountMinor: tr.fromAmountMinor,
                toAmountMinor: tr.toAmountMinor,
                exchangeRate: String(tr.exchangeRate),
                feeMinor: tr.feeMinor || 0,
                feeCurrency: tr.feeCurrency,
                date: tr.date,
                note: tr.note || null,
              })
              .onConflictDoUpdate({
                target: schema.transfers.id,
                set: {
                  fromAmountMinor: tr.fromAmountMinor,
                  toAmountMinor: tr.toAmountMinor,
                  exchangeRate: String(tr.exchangeRate),
                  feeMinor: tr.feeMinor || 0,
                  feeCurrency: tr.feeCurrency,
                  date: tr.date,
                  note: tr.note || null,
                },
              });
          }
        }

        if (payload.subscriptions && payload.subscriptions.length > 0) {
          for (const s of payload.subscriptions) {
            await db
              .insert(schema.subscriptions)
              .values({
                id: s.id,
                name: s.name,
                amountMinor: s.amountMinor,
                currency: s.currency,
                billingCycle: s.billingCycle,
                nextBillingDate: s.nextBillingDate,
                accountId: s.accountId,
                categoryId: s.categoryId,
                active: s.active ?? true,
              })
              .onConflictDoUpdate({
                target: schema.subscriptions.id,
                set: {
                  name: s.name,
                  amountMinor: s.amountMinor,
                  currency: s.currency,
                  billingCycle: s.billingCycle,
                  nextBillingDate: s.nextBillingDate,
                  active: s.active ?? true,
                },
              });
          }
        }

        if (payload.budgets && payload.budgets.length > 0) {
          for (const b of payload.budgets) {
            await db
              .insert(schema.budgets)
              .values({
                id: b.id,
                categoryId: b.categoryId,
                limitMinor: b.limitMinor,
                currency: b.currency,
                period: b.period || 'monthly',
              })
              .onConflictDoUpdate({
                target: schema.budgets.id,
                set: {
                  limitMinor: b.limitMinor,
                  currency: b.currency,
                  period: b.period || 'monthly',
                },
              });
          }
        }

        if (payload.goals && payload.goals.length > 0) {
          for (const g of payload.goals) {
            await db
              .insert(schema.goals)
              .values({
                id: g.id,
                name: g.name,
                targetMinor: g.targetMinor,
                currentMinor: g.currentMinor || 0,
                currency: g.currency,
                deadline: g.deadline || null,
              })
              .onConflictDoUpdate({
                target: schema.goals.id,
                set: {
                  name: g.name,
                  targetMinor: g.targetMinor,
                  currentMinor: g.currentMinor || 0,
                  currency: g.currency,
                  deadline: g.deadline || null,
                },
              });
          }
        }

        return NextResponse.json({
          success: true,
          provider: 'postgresql_drizzle',
          message: 'Synchronized successfully to PostgreSQL database',
          savedAt: new Date().toISOString(),
        });
      } catch (dbErr: any) {
        console.warn('PostgreSQL write error, persisting to local file vault:', dbErr.message);
      }
    }

    // Local Vault Backup
    ensureDbExists();
    const snapshot = {
      ...payload,
      savedAt: new Date().toISOString(),
      version: '1.0.0',
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(snapshot, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      provider: 'local_vault',
      message: 'Server vault snapshot saved successfully',
      savedAt: snapshot.savedAt,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── DELETE: Clear Data ──
export async function DELETE() {
  try {
    const db = getDb();
    if (db && isDatabaseConfigured()) {
      try {
        await Promise.all([
          db.delete(schema.transactions),
          db.delete(schema.transfers),
          db.delete(schema.subscriptions),
          db.delete(schema.budgets),
          db.delete(schema.goals),
          db.delete(schema.accounts),
          db.delete(schema.categories),
        ]);
      } catch (e) {
        console.warn('Failed clearing PostgreSQL tables:', e);
      }
    }

    if (fs.existsSync(DB_FILE)) {
      fs.unlinkSync(DB_FILE);
    }

    return NextResponse.json({
      success: true,
      message: 'Database ledger wiped cleanly',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
