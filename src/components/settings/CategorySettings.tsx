'use client';
import { store } from '@/lib/store';
import { useLedgerVersion } from '@/lib/use-ledger';
import type { Category } from '@/types';
import { useState } from 'react';
export function CategorySettings() {
  useLedgerVersion();
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [group, setGroup] = useState<Category['budgetGroup']>('needs');
  return (
    <section className="ember-glass settings-card settings-stack">
      <h2>Categories & budget groups</h2>
      <p>
        Classify essential work tools, family commitments, and discretionary spending according to
        your own plan.
      </p>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          store.createCategory({
            name: name.trim(),
            type,
            parentId: null,
            color: '#ff9a72',
            icon: 'wallet',
            budgetGroup: type === 'expense' ? group : undefined,
          });
          setName('');
        }}
      >
        <label htmlFor="category-name">
          New category name
          <input
            id="category-name"
            className="input"
            value={name}
            required
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="action-row">
          <label htmlFor="category-type">
            Type
            <select
              id="category-type"
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value as 'income' | 'expense')}
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </label>
          <label htmlFor="category-group">
            Budget group
            <select
              id="category-group"
              className="input"
              value={group}
              disabled={type === 'income'}
              onChange={(e) => setGroup(e.target.value as Category['budgetGroup'])}
            >
              <option value="needs">Needs</option>
              <option value="wants">Wants</option>
              <option value="giving">Giving</option>
            </select>
          </label>
          <button className="btn btn-primary">Add category</button>
        </div>
      </form>
      <div className="category-list">
        {store
          .getCategories()
          .filter((c) => c.type === 'expense')
          .map((c) => (
            <div key={c.id} className="action-row">
              <label htmlFor={`group-${c.id}`}>
                {c.name}
                <select
                  id={`group-${c.id}`}
                  className="input"
                  value={c.budgetGroup ?? 'wants'}
                  onChange={(e) =>
                    store.updateCategory(c.id, {
                      budgetGroup: e.target.value as Category['budgetGroup'],
                    })
                  }
                >
                  <option value="needs">Needs</option>
                  <option value="wants">Wants</option>
                  <option value="giving">Giving</option>
                </select>
              </label>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  if (
                    confirm(`Delete ${c.name}? Categories referenced by records cannot be deleted.`)
                  )
                    store.deleteCategory(c.id);
                }}
              >
                Delete
              </button>
            </div>
          ))}
      </div>
    </section>
  );
}
