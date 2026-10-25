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
  reportingBdt,
  toMinor,
  type LedgerEntry,
} from '@/lib/finance';
import { store } from '@/lib/store';
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
  const filtered = getLedgerEntries()
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
      if (!s.settings.aiCoachEnabled || !s.settings.shareAiDetails)
        throw new Error('Enable AI and sharing consent in Settings first');
      const res = await fetch('/api/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent: { enabled: true, share: true },
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
      setAccountId(d.accountId);
      setCategoryId(d.categoryId);
      setNote(d.note);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not autofill');
    } finally {
      setParsing(false);
    }
  };
  const remove = (tx: LedgerEntry) => {
    setError('');
    try {
      if (tx.transferId) {
        if (confirm('Delete the entire linked transfer, both principal legs, and its fee?'))
          store.deleteTransfer(tx.transferId);
      } else if (confirm('Delete this transaction?')) store.deleteTransaction(tx.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cannot delete transaction');
    }
  };
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
      <div className="report-buckets">
        {[
          ['Settled income', income],
          ['Settled spending', expense],
          ['Recorded surplus', income - expense],
        ].map(([label, value]) => (
          <section className="ember-glass settings-card" key={label}>
            <p>{label}</p>
            <p className="text-money">{formatMoney(Number(value), 'BDT')}</p>
          </section>
        ))}
      </div>
      <p className="page-subtitle">
        Totals reflect the current filters, saved reporting rates, and settled entries. Transfer
        principal is excluded from income and spending.
      </p>
      <section className="ember-glass settings-card action-row">
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
            <option value="largest">Largest BDT equivalent</option>
          </select>
        </label>
      </section>
      {error && !open && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <section className="ember-glass settings-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Payee / activity</th>
                <th>Account</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, pageSize).map((t) => (
                <tr key={t.id}>
                  <td>{dateLabel(t.date)}</td>
                  <td>
                    {t.merchant}
                    <p>
                      {t.type === 'transfer'
                        ? 'Internal transfer'
                        : (s.categories.find((c) => c.id === t.categoryId)?.name ??
                          'Uncategorized')}
                    </p>
                    {t.note && <p className="page-subtitle">{t.note}</p>}
                  </td>
                  <td>{s.accounts.find((a) => a.id === t.accountId)?.name}</td>
                  <td>
                    {t.status === 'done'
                      ? 'Settled'
                      : t.status === 'pending'
                        ? 'Pending'
                        : 'Planned'}
                  </td>
                  <td className="ember-number">
                    {t.type === 'income' || t.direction === 'in' ? '+' : '−'}
                    {formatMoney(t.amountMinor, t.currency)}
                  </td>
                  <td>
                    <div className="action-row">
                      {t.transferId ? (
                        <Link className="btn btn-secondary" href="/accounts">
                          Manage transfer
                        </Link>
                      ) : (
                        <button className="btn btn-secondary" onClick={() => show(t)}>
                          Edit
                        </button>
                      )}
                      <button className="btn btn-danger" onClick={() => remove(t)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={6}>
                    No matching activity. Add an account and record your first payment or expense.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
            {s.settings.aiCoachEnabled && s.settings.shareAiDetails && !editing && (
              <div className="form-stack">
                <label htmlFor="entry-ai-text">
                  Optional AI autofill
                  <input
                    id="entry-ai-text"
                    className="input"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    maxLength={4000}
                    placeholder="Describe one income or expense"
                  />
                </label>
                <p>
                  Your text and account/category labels will be sent to Google. Review every filled
                  field before saving.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={parsing || !aiPrompt.trim()}
                  onClick={() => void autofill()}
                >
                  {parsing ? 'Requesting autofill…' : 'Request AI autofill'}
                </button>
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
            <button className="btn btn-primary">Save activity</button>
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
