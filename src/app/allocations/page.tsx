'use client';
import { Dialog } from '@/components/ui/Dialog';
import { localDate, localMonth } from '@/lib/dates';
import { formatMoney, toMinor } from '@/lib/finance';
import { availableOf, isSettled } from '@/lib/ledger';
import { store } from '@/lib/store';
import { useLedgerVersion } from '@/lib/use-ledger';
import type { Allocation } from '@/types';
import { useState } from 'react';
export default function AllocationsPage() {
  useLedgerVersion();
  const s = store.getSnapshot();
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [incomeId, setIncomeId] = useState('');
  const [kind, setKind] = useState<Allocation['kind']>('sadaqah');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [percent, setPercent] = useState(String(s.settings.givingPercent ?? 0));
  const [period, setPeriod] = useState(localMonth());
  const [error, setError] = useState('');
  const [paying, setPaying] = useState<Allocation | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(localDate());
  const [paymentId, setPaymentId] = useState('');
  const [categoryId, setCategoryId] = useState('giving');
  const account = s.accounts.find((a) => a.id === accountId);
  const income = s.transactions.find((t) => t.id === incomeId);
  const grouped = s.allocations.filter((a) => a.period === period);
  return (
    <div className="settings-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Income allocations & giving</h1>
          <p className="page-subtitle">Set money aside, then record actual payments separately</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setError('');
            setAccountId(s.accounts.find((a) => !a.archived)?.id ?? '');
            setIncomeId('');
            setName('');
            setAmount('');
            setOpen(true);
          }}
        >
          Reserve money
        </button>
      </div>
      <section className="ember-glass settings-card settings-stack">
        <label htmlFor="allocation-month">
          Allocation period
          <input
            id="allocation-month"
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value || localMonth())}
          />
        </label>
        <p>
          Giving reserves, bills, and savings reduce unreserved money in their accounts. “Living” is
          a spending plan and stays available for everyday use. Reservations stay earmarked until
          you pay or release them, including after the month ends.
        </p>
        <p>
          Zakat and sadaqah are separate records. Enter the zakat amount you have determined for
          your own review period; the income percentage shortcut does not calculate zakat
          obligations.
        </p>
      </section>
      <div className="account-grid">
        {grouped.map((a) => {
          const acc = s.accounts.find((x) => x.id === a.accountId)!;
          return (
            <section className="ember-glass settings-card settings-stack" key={a.id}>
              <h2>{a.name}</h2>
              <p>
                {a.kind} · {acc.name} · {a.period}
              </p>
              <p className="text-money">{formatMoney(a.amountMinor, acc.currency)}</p>
              {a.incomeTransactionId && (
                <p>
                  Linked to {s.transactions.find((t) => t.id === a.incomeTransactionId)?.merchant}
                </p>
              )}
              <div className="action-row">
                {a.amountMinor > 0 && ['zakat', 'sadaqah', 'bills'].includes(a.kind) && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setError('');
                      setPaying(a);
                      setPaymentId(crypto.randomUUID());
                      setPayAmount(String(a.amountMinor / 100));
                      setPayDate(localDate());
                      setCategoryId(
                        s.categories.find((c) => c.id === 'giving')?.id ??
                          s.categories.find((c) => c.type === 'expense')?.id ??
                          '',
                      );
                    }}
                  >
                    Record payment
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    if (
                      confirm(
                        'Release this reservation? Payments already recorded will remain in the ledger.',
                      )
                    )
                      store.deleteAllocation(a.id);
                  }}
                >
                  Release reservation
                </button>
              </div>
            </section>
          );
        })}
      </div>
      {!grouped.length && (
        <section className="ember-glass settings-card">
          <p>
            No reservations for this period. Record an income payment first or reserve money already
            held in an account.
          </p>
        </section>
      )}
      <section className="ember-glass settings-card">
        <h2>Giving paid in {period}</h2>
        {s.transactions
          .filter((t) => t.givingKind && isSettled(t) && t.date.startsWith(period))
          .map((t) => (
            <p key={t.id}>
              {t.date} · {t.givingKind} · {t.merchant} · {formatMoney(t.amountMinor, t.currency)}
            </p>
          ))}
        <p>
          Payments are expenses. Reservations alone do not change income, spending, or net worth.
        </p>
      </section>
      {open && (
        <Dialog title="Reserve existing money" onClose={() => setOpen(false)}>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              try {
                store.createAllocation({
                  accountId,
                  incomeTransactionId: incomeId || undefined,
                  name: name.trim() || kind,
                  kind,
                  amountMinor: toMinor(amount),
                  period,
                  createdAt: new Date().toISOString(),
                });
                setOpen(false);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not reserve money');
              }
            }}
          >
            <label htmlFor="allocation-account">
              Account
              <select
                id="allocation-account"
                className="input"
                required
                value={accountId}
                onChange={(e) => {
                  setAccountId(e.target.value);
                  setIncomeId('');
                }}
              >
                <option value="">Choose account</option>
                {s.accounts
                  .filter((a) => !a.archived)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
              </select>
            </label>
            {account && (
              <p>Unreserved: {formatMoney(availableOf(s, account.id), account.currency)}</p>
            )}
            <label htmlFor="allocation-income">
              Income payment (optional)
              <select
                id="allocation-income"
                className="input"
                value={incomeId}
                onChange={(e) => setIncomeId(e.target.value)}
              >
                <option value="">Use existing balance</option>
                {s.transactions
                  .filter((t) => t.type === 'income' && isSettled(t) && t.accountId === accountId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.date} · {t.merchant} · {formatMoney(t.amountMinor, t.currency)}
                    </option>
                  ))}
              </select>
            </label>
            <label htmlFor="allocation-kind">
              Purpose
              <select
                id="allocation-kind"
                className="input"
                value={kind}
                onChange={(e) => setKind(e.target.value as Allocation['kind'])}
              >
                <option value="sadaqah">Sadaqah</option>
                <option value="zakat">Zakat (amount determined separately)</option>
                <option value="bills">Upcoming bills</option>
                <option value="savings">Savings</option>
                <option value="living">Everyday living plan</option>
              </select>
            </label>
            <label htmlFor="allocation-name">
              Label
              <input
                id="allocation-name"
                className="input"
                placeholder="Recipient, bill, or purpose"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {income && kind !== 'zakat' && (
              <div className="action-row">
                <label htmlFor="allocation-percent">
                  Percentage of this income
                  <input
                    id="allocation-percent"
                    className="input"
                    type="number"
                    min="0"
                    max="100"
                    value={percent}
                    onChange={(e) => setPercent(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    setAmount(
                      String(Math.round((income.amountMinor * Number(percent)) / 100) / 100),
                    )
                  }
                >
                  Use percentage
                </button>
              </div>
            )}
            <label htmlFor="allocation-amount">
              Amount ({account?.currency ?? 'account currency'})
              <input
                id="allocation-amount"
                className="input"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label htmlFor="allocation-period">
              Review period
              <input
                id="allocation-period"
                type="month"
                required
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn btn-primary">Save reservation</button>
          </form>
        </Dialog>
      )}
      {paying && (
        <Dialog title={`Record ${paying.kind} payment`} onClose={() => setPaying(null)}>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              try {
                store.payAllocation(paying.id, toMinor(payAmount), payDate, categoryId, paymentId);
                setPaying(null);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Payment failed');
              }
            }}
          >
            <p>
              This records an actual expense in{' '}
              {s.accounts.find((a) => a.id === paying.accountId)?.name} and reduces the reservation
              atomically. Confirm the transfer was made outside Ember.
            </p>
            <label htmlFor="allocation-payment">
              Amount
              <input
                id="allocation-payment"
                className="input"
                type="number"
                min="0.01"
                max={paying.amountMinor / 100}
                step="0.01"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </label>
            <label htmlFor="allocation-payment-date">
              Payment date
              <input
                id="allocation-payment-date"
                className="input"
                type="date"
                required
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
            </label>
            <label htmlFor="allocation-payment-category">
              Expense category
              <select
                id="allocation-payment-category"
                className="input"
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {s.categories
                  .filter((c) => c.type === 'expense')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="btn btn-primary">Confirm payment recorded</button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
