'use client';
import { Dialog } from '@/components/ui/Dialog';
import { parseOutput } from '@/lib/ai-contracts';
import { localDate } from '@/lib/dates';
import {
  categoryContains,
  dateLabel,
  downloadFile,
  exportTransactionsCsv,
  formatMoney,
  getLedgerEntries,
  oneRowPerTransfer,
  reportingBdt,
  toMinor,
  type LedgerEntry,
} from '@/lib/finance';
import { store } from '@/lib/store';
import { useAiAvailable } from '@/lib/use-ai';
import { useLedgerVersion } from '@/lib/use-ledger';
import type { Transaction, TransactionStatus } from '@/types';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
function TransactionsContent() {
  useLedgerVersion();
  const searchParams = useSearchParams();
  const router = useRouter();
  const s = store.getSnapshot();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [pageSize, setPageSize] = useState(25);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(localDate());
  const [status, setStatus] = useState<TransactionStatus>('done');
  const [rate, setRate] = useState(String(store.getReferenceRate()));
  const [error, setError] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [parsing, setParsing] = useState(false);
  const aiReady = useAiAvailable() && s.settings.aiQuickEntry;
  const account = s.accounts.find((a) => a.id === accountId);
  const show = (tx?: Transaction) => {
    const acc =
      s.accounts.find((a) => a.id === tx?.accountId) ??
      s.accounts.find((a) => !a.archived && a.currency === s.settings.baseCurrency) ??
      s.accounts.find((a) => !a.archived);
    setEditing(tx ?? null);
    setMerchant(tx?.merchant ?? '');
    setAmount(tx ? String(tx.amountMinor / 100) : '');
    setType(tx?.type === 'income' ? 'income' : 'expense');
    setAccountId(acc?.id ?? '');
    setCategoryId(tx?.categoryId ?? s.categories.find((c) => c.type === 'expense')?.id ?? '');
    setNote(tx?.note ?? '');
    setDate(tx?.date ?? localDate());
    setStatus(tx?.status ?? 'done');
    setRate(String(tx?.reportingRate ?? store.getReferenceRate()));
    setError('');
    setAiPrompt('');
    setOpen(true);
  };
  useEffect(() => {
    if (searchParams.get('quickAdd') === '1') show();
    if (searchParams.get('categoryId')) setCategoryFilter(searchParams.get('categoryId')!);
  }, [searchParams]);
  const close = () => {
    setOpen(false);
    if (searchParams.get('quickAdd')) router.replace('/transactions', { scroll: false });
  };
  const accountName = (id: string) => s.accounts.find((a) => a.id === id)?.name ?? 'Unknown';
  const entries = getLedgerEntries();
  const filtered = (accountFilter === 'all' ? oneRowPerTransfer(entries) : entries)
    .filter(
      (t) =>
        (typeFilter === 'all' || t.type === typeFilter) &&
        (accountFilter === 'all' || t.accountId === accountFilter) &&
        (categoryFilter === 'all' || categoryContains(categoryFilter, t.categoryId)) &&
        (statusFilter === 'all' || t.status === statusFilter) &&
        (!search ||
          `${t.merchant} ${t.note} ${s.categories.find((c) => c.id === t.categoryId)?.name ?? ''}`
            .toLowerCase()
            .includes(search.toLowerCase())),
    )
    .sort((a, b) =>
      sort === 'oldest'
        ? a.date.localeCompare(b.date)
        : sort === 'largest'
          ? reportingBdt(b) - reportingBdt(a)
          : b.date.localeCompare(a.date),
    );
  const settled = filtered.filter((t) => t.status === 'done' && t.date <= localDate());
  const income = settled
      .filter((t) => t.type === 'income')
      .reduce((n, t) => n + reportingBdt(t), 0),
    expense = settled.filter((t) => t.type === 'expense').reduce((n, t) => n + reportingBdt(t), 0);
  const save = () => {
    if (!account) throw new Error('Create or select a funding account');
    const values = {
      accountId,
      categoryId: categoryId || null,
      type,
      amountMinor: toMinor(amount),
      currency: account.currency,
      merchant: merchant.trim(),
      note,
      date,
      status,
      reportingRate: Number(rate),
    };
    if (editing) store.updateTransaction(editing.id, values);
    else
      store.createTransaction({
        ...values,
        transferId: null,
        tags: [],
        paymentMethod: 'Manual entry',
        createdAt: new Date().toISOString(),
      });
    close();
  };
  const autofill = async () => {
    setParsing(true);
    setError('');
    try {
      const res = await fetch('/api/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: aiPrompt,
          accounts: s.accounts
            .filter((a) => !a.archived)
            .map(({ id, name, currency }) => ({ id, name, currency })),
          categories: s.categories.map(({ id, name, type }) => ({ id, name, type })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      const d = parseOutput.parse(body.data);
      setMerchant(d.merchant);
      setAmount(String(d.amount));
      setType(d.type);
      if (d.accountId) setAccountId(d.accountId);
      setCategoryId(d.categoryId);
      setNote(d.note);
      if (d.date) {
        setDate(d.date);
        setStatus(d.date > localDate() ? 'planned' : 'done');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not autofill');
    } finally {
      setParsing(false);
    }
  };
  const remove = () => {
    if (!editing || !confirm(`Delete "${editing.merchant}"?`)) return;
    try {
      store.deleteTransaction(editing.id);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this entry');
    }
  };
  const rowSign = (t: LedgerEntry) =>
    t.type === 'income' || t.direction === 'in'
      ? 'in'
      : t.type === 'transfer' && !t.direction
        ? 'move'
        : 'out';
  return (
    <div className="settings-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">Income, spending, transfers, and their fees in one ledger</p>
        </div>
        <div className="action-row">
          <button
            className="btn btn-secondary"
            onClick={() => downloadFile(exportTransactionsCsv(), 'ember-ledger.csv')}
          >
            Export CSV
          </button>
          <button className="btn btn-primary" onClick={() => show()}>
            Add activity
          </button>
        </div>
      </div>
      <section className="ember-glass settings-card ledger-summary" aria-label="Totals">
        {[
          ['Income', income],
          ['Spending', expense],
          ['Left over', income - expense],
        ].map(([label, value]) => (
          <div key={label}>
            <p>{label}</p>
            <p className="text-money">{formatMoney(Number(value), 'BDT')}</p>
          </div>
        ))}
        <p className="ledger-summary-note">Settled entries matching your filters, in BDT.</p>
      </section>
      <section className="ember-glass settings-card settings-stack">
        <div className="action-row ledger-filters">
          <label htmlFor="ledger-search">
            Search
            <input
              id="ledger-search"
              className="input"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Payee, category, or note"
            />
          </label>
          <label htmlFor="ledger-type">
            Type
            <select
              id="ledger-type"
              className="input"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All activity</option>
              <option value="income">Income</option>
              <option value="expense">Expenses & fees</option>
              <option value="transfer">Transfers</option>
            </select>
          </label>
          <label htmlFor="ledger-account">
            Account
            <select
              id="ledger-account"
              className="input"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
            >
              <option value="all">All accounts</option>
              {s.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <details
          className="more-filters"
          open={categoryFilter !== 'all' || statusFilter !== 'all' || sort !== 'newest'}
        >
          <summary>More filters</summary>
          <div className="action-row ledger-filters">
            <label htmlFor="ledger-category">
              Category
              <select
                id="ledger-category"
                className="input"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All categories</option>
                {s.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="ledger-status">
              Status
              <select
                id="ledger-status"
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="done">Settled</option>
                <option value="pending">Pending</option>
                <option value="planned">Planned</option>
              </select>
            </label>
            <label htmlFor="ledger-sort">
              Order
              <select
                id="ledger-sort"
                className="input"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="largest">Largest first</option>
              </select>
            </label>
          </div>
        </details>
      </section>
      {error && !open && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <section className="ember-glass settings-card">
        {filtered.length ? (
          <ul className="ledger-list">
            {filtered.slice(0, pageSize).map((t) => {
              const sign = rowSign(t);
              const meta = [
                dateLabel(t.date),
                t.type === 'transfer'
                  ? 'Transfer'
                  : (s.categories.find((c) => c.id === t.categoryId)?.name ?? 'Uncategorized'),
                ...(t.type === 'transfer' && !t.direction ? [] : [accountName(t.accountId)]),
              ].join(' · ');
              const body = (
                <>
                  <span className="ledger-row-text">
                    <span className="ledger-row-title">
                      {t.merchant}
                      {t.status !== 'done' && (
                        <span className={`badge badge-${t.status}`}>
                          {t.status === 'pending' ? 'Pending' : 'Planned'}
                        </span>
                      )}
                    </span>
                    <span className="ledger-row-meta">{meta}</span>
                    {t.note && <span className="ledger-row-meta">{t.note}</span>}
                  </span>
                  <span className={`ledger-row-amount ember-number ${sign}`}>
                    {sign === 'in' ? '+' : sign === 'out' ? '−' : ''}
                    {formatMoney(t.amountMinor, t.currency)}
                  </span>
                </>
              );
              return (
                <li key={t.id}>
                  {t.transferId ? (
                    <Link
                      className="ledger-row"
                      href={`/accounts?transfer=${t.transferId}`}
                      aria-label={`Open transfer: ${t.merchant}`}
                    >
                      {body}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="ledger-row"
                      onClick={() => show(t)}
                      aria-label={`Edit ${t.merchant}`}
                    >
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>No matching activity. Add an account and record your first payment or expense.</p>
        )}
        {filtered.length > pageSize && (
          <button className="btn btn-secondary" onClick={() => setPageSize((n) => n + 25)}>
            Show 25 more
          </button>
        )}
      </section>
      {open && (
        <Dialog title={editing ? 'Edit activity' : 'Record activity'} onClose={close}>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              try {
                save();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not save activity');
              }
            }}
          >
            {aiReady && !editing && (
              <div className="quick-entry">
                <label htmlFor="entry-ai-text">
                  Describe it
                  <span className="quick-entry-row">
                    <input
                      id="entry-ai-text"
                      className="input"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        if (aiPrompt.trim() && !parsing) void autofill();
                      }}
                      maxLength={4000}
                      placeholder="Lunch 350 cash yesterday"
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={parsing || !aiPrompt.trim()}
                      onClick={() => void autofill()}
                    >
                      {parsing ? 'Filling…' : 'Fill in'}
                    </button>
                  </span>
                </label>
                <p className="quick-entry-note">
                  Sent to Google Gemini to fill the form below. Check it before saving.
                </p>
              </div>
            )}
            <label htmlFor="entry-type">
              Type
              <select
                id="entry-type"
                className="input"
                value={type}
                onChange={(e) => {
                  const value = e.target.value as 'income' | 'expense';
                  setType(value);
                  setCategoryId(s.categories.find((c) => c.type === value)?.id ?? '');
                }}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>
            <label htmlFor="entry-account">
              Account
              <select
                id="entry-account"
                className="input"
                required
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">Choose an account</option>
                {s.accounts
                  .filter((a) => !a.archived || a.id === editing?.accountId)
                  .map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
              </select>
            </label>
            <label htmlFor="entry-payee">
              {type === 'income' ? 'Client / payer' : 'Merchant / payee'}
              <input
                id="entry-payee"
                className="input"
                value={merchant}
                required
                maxLength={200}
                onChange={(e) => setMerchant(e.target.value)}
              />
            </label>
            <label htmlFor="entry-amount">
              Amount ({account?.currency ?? 'account currency'})
              <input
                id="entry-amount"
                className="input"
                type="number"
                min="0.01"
                max="90000000000000"
                step="0.01"
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <p>
              Use the actual debit or credit in the selected account's currency. Put any original
              foreign-currency purchase detail in the note.
            </p>
            <label htmlFor="entry-category">
              Category
              <select
                id="entry-category"
                className="input"
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Choose category</option>
                {s.categories
                  .filter((c) => c.type === type)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <label htmlFor="entry-date">
              Date
              <input
                id="entry-date"
                className="input"
                type="date"
                required
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  if (e.target.value > localDate()) setStatus('planned');
                }}
              />
            </label>
            <label htmlFor="entry-status">
              Status
              <select
                id="entry-status"
                className="input"
                value={status}
                onChange={(e) => setStatus(e.target.value as TransactionStatus)}
              >
                <option value="done">Settled</option>
                <option value="pending">Pending</option>
                <option value="planned">Planned</option>
              </select>
            </label>
            <label htmlFor="entry-rate">
              Reporting reference rate (BDT per USD)
              <input
                id="entry-rate"
                className="input"
                type="number"
                min="0.000001"
                step="any"
                required
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </label>
            <label htmlFor="entry-note">
              Note
              <input
                id="entry-note"
                className="input"
                maxLength={4000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="action-row">
              <button className="btn btn-primary">Save activity</button>
              {editing && (
                <button type="button" className="btn btn-danger" onClick={remove}>
                  Delete
                </button>
              )}
            </div>
            {!account && (
              <Link href="/accounts" onClick={close}>
                Add an account first
              </Link>
            )}
          </form>
        </Dialog>
      )}
    </div>
  );
}
export default function TransactionsPage() {
  return (
    <Suspense fallback={<p role="status">Opening ledger…</p>}>
      <TransactionsContent />
    </Suspense>
  );
}
