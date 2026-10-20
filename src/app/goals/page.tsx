'use client';
import { Dialog } from '@/components/ui/Dialog';
import { computeSinkingFund, dateLabel, formatMoney, toMinor } from '@/lib/finance';
import { store } from '@/lib/store';
import { useLedgerVersion } from '@/lib/use-ledger';
import type { Currency, Goal } from '@/types';
import { useState } from 'react';
export default function GoalsPage() {
  useLedgerVersion();
  const s = store.getSnapshot();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('0');
  const [currency, setCurrency] = useState<Currency>('BDT');
  const [accountId, setAccountId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const show = (g?: Goal) => {
    setEditing(g ?? null);
    setIsEmergency(g?.isEmergency ?? false);
    setName(g?.name ?? '');
    setTarget(g ? String(g.targetMinor / 100) : '');
    setCurrent(g ? String(g.currentMinor / 100) : '0');
    setCurrency(g?.currency ?? 'BDT');
    setAccountId(g?.accountId ?? '');
    setDeadline(g?.deadline ?? '');
    setError('');
    setOpen(true);
  };
  return (
    <div className="settings-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Savings goals</h1>
          <p className="page-subtitle">
            Reserve existing money for the things you are building toward
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => show()}>
          Create goal
        </button>
      </div>
      <p className="page-subtitle">
        A funded goal reserves money in its linked account. Adding to a goal does not create income
        or move money between accounts. Record actual transfers in Accounts.
      </p>
      <div className="account-grid">
        {s.goals.map((g) => {
          const plan = computeSinkingFund(g.targetMinor, g.currentMinor, g.deadline);
          return (
            <section className="ember-glass settings-card settings-stack" key={g.id}>
              <div>
                <h2>{g.name}</h2>
                <p>
                  {g.accountId
                    ? `Held in ${s.accounts.find((a) => a.id === g.accountId)?.name}`
                    : 'Unverified legacy amount — link an account to confirm funding'}
                </p>
              </div>
              <p className="text-money">{formatMoney(g.currentMinor, g.currency)}</p>
              <p>
                Target {formatMoney(g.targetMinor, g.currency)} ·{' '}
                {Math.round((g.currentMinor / g.targetMinor) * 100)}%
              </p>
              <progress
                aria-label={`${g.name} progress`}
                max={g.targetMinor}
                value={Math.min(g.currentMinor, g.targetMinor)}
              />
              <p>{g.deadline ? `Target date: ${dateLabel(g.deadline)}` : 'No target date set'}</p>
              {!plan.isCompleted && (
                <p>
                  {plan.isBehind
                    ? 'Target date has passed. Review your plan.'
                    : `Suggested reservation: ${formatMoney(plan.monthlyDepositMinor, g.currency)} each month${g.deadline ? '' : ' over an assumed 12 months'}.`}
                </p>
              )}
              <div className="action-row">
                <button className="btn btn-primary" onClick={() => show(g)}>
                  Update reserved amount
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    if (
                      confirm(
                        'Remove this goal and release its reservation? Account balances will stay unchanged.',
                      )
                    )
                      store.deleteGoal(g.id);
                  }}
                >
                  Remove goal
                </button>
              </div>
            </section>
          );
        })}
      </div>
      {!s.goals.length && (
        <section className="ember-glass settings-card">
          <p>
            Create an emergency reserve, equipment fund, or another savings goal. Link an account
            holding the money to keep the reservation funded.
          </p>
        </section>
      )}
      {open && (
        <Dialog
          title={editing ? 'Update savings goal' : 'Create savings goal'}
          onClose={() => setOpen(false)}
        >
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              try {
                const values = {
                  name: name.trim(),
                  targetMinor: toMinor(target),
                  currentMinor: toMinor(current),
                  currency,
                  accountId: accountId || null,
                  deadline: deadline || null,
                  isEmergency,
                };
                if (editing) store.updateGoal(editing.id, values);
                else store.createGoal({ ...values, createdAt: new Date().toISOString() });
                setOpen(false);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not save goal');
              }
            }}
          >
            <label htmlFor="goal-name">
              Goal name
              <input
                id="goal-name"
                className="input"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label htmlFor="goal-currency">
              Currency
              <select
                id="goal-currency"
                className="input"
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value as Currency);
                  setAccountId('');
                }}
              >
                <option>BDT</option>
                <option>USD</option>
              </select>
            </label>
            <label htmlFor="goal-account">
              Account holding the reserved money
              <select
                id="goal-account"
                className="input"
                required={Number(current) > 0}
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                <option value="">Choose funding account</option>
                {s.accounts
                  .filter((a) => a.currency === currency && (!a.archived || a.id === accountId))
                  .map((a) => (
                    <option value={a.id} key={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
            <label htmlFor="goal-target">
              Target amount
              <input
                id="goal-target"
                className="input"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </label>
            <label htmlFor="goal-current">
              Total amount to reserve now
              <input
                id="goal-current"
                className="input"
                type="number"
                min="0"
                step="0.01"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
            <p>
              Enter the total reservation, not an additional contribution. Lowering it releases
              money for other uses. Funding is checked against unreserved account money.
            </p>
            <label>
              <span>
                <input
                  type="checkbox"
                  checked={isEmergency}
                  onChange={(e) => setIsEmergency(e.target.checked)}
                />{' '}
                Emergency reserve (included in estimated runway)
              </span>
            </label>
            <label htmlFor="goal-deadline">
              Target date (optional)
              <input
                id="goal-deadline"
                className="input"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="btn btn-primary">Save goal</button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
