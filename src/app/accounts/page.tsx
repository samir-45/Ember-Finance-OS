'use client';
import { Dialog } from '@/components/ui/Dialog';
import { localDate } from '@/lib/dates';
import {
  accountTypeLabel,
  computeAccountBalance,
  dateLabel,
  formatMoney,
  getLedgerEntries,
  toMinor,
} from '@/lib/finance';
import { availableOf, balanceOf } from '@/lib/ledger';
import { store } from '@/lib/store';
import { useLedgerVersion } from '@/lib/use-ledger';
import type { Account, Currency, TransactionStatus, Transfer } from '@/types';
import { useEffect, useState } from 'react';
function previewAmount(value: string): number | null {
  try {
    return toMinor(value);
  } catch {
    return null;
  }
}
export default function AccountsPage() {
  useLedgerVersion();
  const s = store.getSnapshot();
  const accounts = s.accounts;
  const [accountForm, setAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [type, setType] = useState<Account['type']>('bank');
  const [opening, setOpening] = useState('0');
  const [transferForm, setTransferForm] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [out, setOut] = useState('');
  const [received, setReceived] = useState('');
  const [fee, setFee] = useState('0');
  const [feeCurrency, setFeeCurrency] = useState<Currency>('USD');
  const [date, setDate] = useState(localDate());
  const [status, setStatus] = useState<TransactionStatus>('done');
  const [note, setNote] = useState('');
  const [history, setHistory] = useState('');
  const [reconciling, setReconciling] = useState('');
  const [statement, setStatement] = useState('');
  const [error, setError] = useState('');
  const from = accounts.find((a) => a.id === fromId),
    to = accounts.find((a) => a.id === toId);
  const previewOut = previewAmount(out),
    previewIn = previewAmount(received),
    previewFee = previewAmount(fee),
    previewStatement = previewAmount(statement);
  const guard = (fn: () => void) => {
    setError('');
    try {
      fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    }
  };
  const openAccount = (a?: Account) => {
    setError('');
    setEditingAccount(a ?? null);
    setName(a?.name ?? '');
    setCurrency(a?.currency ?? 'USD');
    setType(a?.type ?? 'bank');
    setOpening(String((a?.openingBalanceMinor ?? 0) / 100));
    setAccountForm(true);
  };
  const openTransfer = (t?: Transfer) => {
    setError('');
    const a = accounts.find((a) => a.id === t?.fromAccountId) ?? accounts.find((a) => !a.archived);
    setEditingTransfer(t ?? null);
    setFromId(t?.fromAccountId ?? a?.id ?? '');
    setToId(t?.toAccountId ?? accounts.find((b) => !b.archived && b.id !== a?.id)?.id ?? '');
    setOut(t ? String(t.amountOutMinor / 100) : '');
    setReceived(t ? String(t.amountInMinor / 100) : '');
    setFee(String((t?.feeMinor ?? 0) / 100));
    setFeeCurrency(t?.feeCurrency ?? a?.currency ?? 'USD');
    setDate(t?.date ?? localDate());
    setStatus(t?.status ?? 'done');
    setNote(t?.note ?? '');
    setTransferForm(true);
  };
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('transfer');
    const found = id ? store.getTransfers().find((t) => t.id === id) : undefined;
    if (found) openTransfer(found);
    // Runs once on arrival; later ledger changes must not reopen the dialog.
  }, []);
  const saveTransfer = () => {
    if (!from || !to) throw new Error('Choose both accounts');
    const amountOutMinor = toMinor(out),
      amountInMinor = from.currency === to.currency ? amountOutMinor : toMinor(received),
      feeMinor = toMinor(fee);
    const rate =
      from.currency === to.currency
        ? 1
        : from.currency === 'USD'
          ? amountInMinor / amountOutMinor
          : amountOutMinor / amountInMinor;
    const values = {
      fromAccountId: from.id,
      toAccountId: to.id,
      amountOutMinor,
      amountInMinor,
      exchangeRate: rate,
      feeMinor,
      feeCurrency,
      date,
      status,
      note,
      reportingRate: editingTransfer?.reportingRate ?? store.getReferenceRate(),
    };
    if (editingTransfer) store.updateTransfer(editingTransfer.id, values);
    else store.createTransfer({ ...values, createdAt: new Date().toISOString() });
    setTransferForm(false);
  };
  const ledger = getLedgerEntries().filter((t) => t.accountId === history);
  return (
    <div className="settings-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounts & transfers</h1>
          <p className="page-subtitle">USD earnings, local balances, and statement checks</p>
        </div>
        <div className="action-row">
          <button
            className="btn btn-secondary"
            disabled={accounts.filter((a) => !a.archived).length < 2}
            onClick={() => openTransfer()}
          >
            Transfer / convert
          </button>
          <button className="btn btn-primary" onClick={() => openAccount()}>
            New account
          </button>
        </div>
      </div>
      {!accounts.length && (
        <section className="ember-glass settings-card">
          <h2>Add your real accounts</h2>
          <p>
            Start with NSave in USD, then add your local bank, bKash, or cash in BDT. Use the
            opening balance shown on your statement for the date you start tracking.
          </p>
        </section>
      )}
      <div className="account-grid">
        {accounts.map((a) => (
          <section className="ember-glass settings-card settings-stack" key={a.id}>
            <div>
              <h2>
                {a.name}
                {a.archived ? ' · archived' : ''}
              </h2>
              <p>
                {accountTypeLabel(a.type)} · {a.currency}
              </p>
            </div>
            <div>
              <p className="label-uppercase">
                {a.type === 'receivable' ? 'Still owed to you' : 'Recorded balance'}
              </p>
              <p className="text-money">{formatMoney(balanceOf(s, a.id), a.currency)}</p>
              {a.type === 'receivable' ? (
                <p>Not counted as spendable money. Record repayments as a transfer out.</p>
              ) : (
                availableOf(s, a.id) !== balanceOf(s, a.id) && (
                  <p>Free to use: {formatMoney(availableOf(s, a.id), a.currency)}</p>
                )
              )}
              {a.reconciledAt && <p>Matched statement on {dateLabel(a.reconciledAt)}</p>}
            </div>
            <div className="action-row">
              <button
                className="btn btn-secondary"
                onClick={() => setHistory(history === a.id ? '' : a.id)}
              >
                View ledger
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => openAccount(a)}
                aria-label={`Edit ${a.name}`}
              >
                Edit
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setError('');
                  setReconciling(a.id);
                  setStatement('');
                }}
              >
                Reconcile
              </button>
            </div>
          </section>
        ))}
      </div>
      {history && (
        <section className="ember-glass settings-card">
          <h2>{accounts.find((a) => a.id === history)?.name} ledger</h2>
          {ledger.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Activity</th>
                    <th>Status</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((t) => (
                    <tr key={t.id}>
                      <td>{dateLabel(t.date)}</td>
                      <td>{t.merchant}</td>
                      <td>{t.status}</td>
                      <td>
                        {t.type === 'income' || t.direction === 'in' ? '+' : '−'}
                        {formatMoney(t.amountMinor, t.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No activity yet.</p>
          )}
        </section>
      )}
      <section className="ember-glass settings-card">
        <h2>Transfer history</h2>
        <p>
          Principal amounts and fees are separate. A fee is charged in its selected currency to the
          matching account.
        </p>
        {s.transfers.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Fee</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...s.transfers]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((t) => (
                    <tr key={t.id}>
                      <td>{dateLabel(t.date)}</td>
                      <td>
                        {accounts.find((a) => a.id === t.fromAccountId)?.name}
                        <br />
                        {formatMoney(
                          t.amountOutMinor,
                          accounts.find((a) => a.id === t.fromAccountId)!.currency,
                        )}
                      </td>
                      <td>
                        {accounts.find((a) => a.id === t.toAccountId)?.name}
                        <br />
                        {formatMoney(
                          t.amountInMinor,
                          accounts.find((a) => a.id === t.toAccountId)!.currency,
                        )}
                      </td>
                      <td>{t.feeMinor ? formatMoney(t.feeMinor, t.feeCurrency) : '—'}</td>
                      <td>
                        {(t.status ?? 'done') === 'done'
                          ? 'Settled'
                          : t.status === 'pending'
                            ? 'Pending'
                            : 'Planned'}
                      </td>
                      <td>
                        <div className="action-row">
                          <button className="btn btn-secondary" onClick={() => openTransfer(t)}>
                            Edit transfer
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={() =>
                              guard(() => {
                                if (confirm('Delete both transfer legs and the associated fee?'))
                                  store.deleteTransfer(t.id);
                              })
                            }
                          >
                            Delete transfer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No transfers recorded.</p>
        )}
      </section>
      {error && !accountForm && !transferForm && !reconciling && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {accountForm && (
        <Dialog
          title={editingAccount ? 'Edit account' : 'New account'}
          onClose={() => setAccountForm(false)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              guard(() => {
                const values = { name: name.trim(), currency, type };
                if (editingAccount) store.updateAccount(editingAccount.id, values);
                else
                  store.createAccount({
                    ...values,
                    openingBalanceMinor: toMinor(opening),
                    color: '#ff9a72',
                    createdAt: new Date().toISOString(),
                  });
                setAccountForm(false);
              });
            }}
          >
            <label htmlFor="account-name">
              Account name
              <input
                id="account-name"
                className="input"
                placeholder="NSave, local bank, bKash…"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label htmlFor="account-type">
              Type
              <select
                id="account-type"
                className="input"
                value={type}
                onChange={(e) => setType(e.target.value as Account['type'])}
              >
                {(
                  ['bank', 'wallet', 'cash', 'card', 'payoneer', 'paypal', 'receivable'] as const
                ).map((t) => (
                  <option key={t} value={t}>
                    {accountTypeLabel(t)}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="account-currency">
              Currency
              <select
                id="account-currency"
                className="input"
                value={currency}
                disabled={!!editingAccount}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                <option>USD</option>
                <option>BDT</option>
              </select>
            </label>
            {!editingAccount && (
              <label htmlFor="account-opening">
                Opening balance
                <input
                  id="account-opening"
                  className="input"
                  type="number"
                  step="0.01"
                  required
                  value={opening}
                  onChange={(e) => setOpening(e.target.value)}
                />
              </label>
            )}
            <p>
              Opening balances establish your starting point. Use reconciliation to check later
              balances against statements.
            </p>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="action-row">
              <button className="btn btn-primary">Save account</button>
              {editingAccount && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() =>
                      guard(() => {
                        store.updateAccount(editingAccount.id, {
                          archived: !editingAccount.archived,
                        });
                        setAccountForm(false);
                      })
                    }
                  >
                    {editingAccount.archived ? 'Unarchive' : 'Archive'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() =>
                      guard(() => {
                        if (
                          !confirm(
                            `Delete ${editingAccount.name}? Accounts with history must be archived instead.`,
                          )
                        )
                          return;
                        store.deleteAccount(editingAccount.id);
                        setAccountForm(false);
                      })
                    }
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </form>
        </Dialog>
      )}
      {transferForm && (
        <Dialog
          title={editingTransfer ? 'Correct transfer' : 'Transfer / convert'}
          onClose={() => setTransferForm(false)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              guard(saveTransfer);
            }}
          >
            <label htmlFor="transfer-from">
              From account
              <select
                id="transfer-from"
                className="input"
                required
                value={fromId}
                onChange={(e) => {
                  setFromId(e.target.value);
                  const a = accounts.find((a) => a.id === e.target.value)!;
                  setFeeCurrency(a.currency);
                  if (e.target.value === toId)
                    setToId(accounts.find((b) => b.id !== a.id && !b.archived)?.id ?? '');
                  setReceived('');
                }}
              >
                <option value="">Choose account</option>
                {accounts
                  .filter((a) => !a.archived || a.id === fromId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
              </select>
            </label>
            <label htmlFor="transfer-to">
              To account
              <select
                id="transfer-to"
                className="input"
                required
                value={toId}
                onChange={(e) => {
                  setToId(e.target.value);
                  setReceived('');
                }}
              >
                <option value="">Choose account</option>
                {accounts
                  .filter((a) => a.id !== fromId && (!a.archived || a.id === toId))
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
              </select>
            </label>
            <label htmlFor="transfer-out">
              Principal sent ({from?.currency ?? 'source currency'})
              <input
                id="transfer-out"
                className="input"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                required
                value={out}
                onChange={(e) => setOut(e.target.value)}
              />
            </label>
            {from?.currency !== to?.currency && (
              <label htmlFor="transfer-received">
                Actual principal received before any separately entered fee (
                {to?.currency ?? 'destination currency'})
                <input
                  id="transfer-received"
                  className="input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  required
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                />
              </label>
            )}
            <p>
              Use amounts from your transfer receipt. Fees below are additional: do not enter a fee
              twice if it is already included in the debit or deducted from the credit.
            </p>
            <div className="form-two-grid">
              <label htmlFor="transfer-fee">
                Additional fee
                <input
                  id="transfer-fee"
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                />
              </label>
              <label htmlFor="transfer-fee-currency">
                Fee currency
                <select
                  id="transfer-fee-currency"
                  className="input"
                  value={feeCurrency}
                  onChange={(e) => setFeeCurrency(e.target.value as Currency)}
                >
                  {[...new Set([from?.currency, to?.currency].filter(Boolean))].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <label htmlFor="transfer-date">
              Transfer date
              <input
                id="transfer-date"
                className="input"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label htmlFor="transfer-status">
              Status
              <select
                id="transfer-status"
                className="input"
                value={status}
                onChange={(e) => setStatus(e.target.value as TransactionStatus)}
              >
                <option value="done">Settled</option>
                <option value="pending">Pending</option>
                <option value="planned">Planned</option>
              </select>
            </label>
            <label htmlFor="transfer-note">
              Note
              <input
                id="transfer-note"
                className="input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            {from &&
              to &&
              previewOut !== null &&
              previewOut > 0 &&
              previewFee !== null &&
              (from.currency === to.currency || (previewIn !== null && previewIn > 0)) && (
                <div role="status">
                  <p>
                    {from.name} debit:{' '}
                    {formatMoney(
                      previewOut + (feeCurrency === from.currency ? previewFee : 0),
                      from.currency,
                    )}
                  </p>
                  <p>
                    {to.name} net credit:{' '}
                    {formatMoney(
                      (from.currency === to.currency ? previewOut : previewIn!) -
                        (feeCurrency !== from.currency ? previewFee : 0),
                      to.currency,
                    )}
                  </p>
                  <p>These changes apply to balances only when settled.</p>
                </div>
              )}
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="btn btn-primary">
              {editingTransfer ? 'Save correction' : 'Record transfer'}
            </button>
          </form>
        </Dialog>
      )}
      {reconciling && (
        <Dialog title="Check against a statement" onClose={() => setReconciling('')}>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              guard(() => {
                store.reconcile(reconciling, toMinor(statement));
                setReconciling('');
              });
            }}
          >
            <p>
              Compare the current recorded balance with the current settled balance on your account.
              Pending bank activity may explain differences.
            </p>
            <p>
              Recorded:{' '}
              {formatMoney(
                computeAccountBalance(reconciling),
                accounts.find((a) => a.id === reconciling)!.currency,
              )}
            </p>
            <label htmlFor="statement-balance">
              Current statement balance
              <input
                id="statement-balance"
                className="input"
                type="number"
                step="0.01"
                required
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
              />
            </label>
            {previewStatement !== null && (
              <p role="status">
                Difference:{' '}
                {formatMoney(
                  previewStatement - computeAccountBalance(reconciling),
                  accounts.find((a) => a.id === reconciling)!.currency,
                )}
              </p>
            )}
            <p>
              Saving records the comparison. It does not alter the ledger. Correct missing or
              incorrect entries before recording a match.
            </p>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="btn btn-primary">Save balance comparison</button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
