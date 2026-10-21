'use client';
import { store } from '@/lib/store';
import { useLedgerVersion } from '@/lib/use-ledger';
import type { Category } from '@/types';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

const groups = [
  { id: 'needs', label: 'Needs', description: 'Essentials and commitments' },
  { id: 'wants', label: 'Wants', description: 'Flexible spending' },
  { id: 'giving', label: 'Giving', description: 'Charity and contributions' },
  { id: 'income', label: 'Income', description: 'Money coming in' },
] as const;

export function CategorySettings() {
  useLedgerVersion();
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [group, setGroup] = useState<Category['budgetGroup']>('needs');
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);
  const categories = store.getCategories();

  const showError = (error: unknown, fallback: string) =>
    setFeedback({ text: error instanceof Error ? error.message : fallback, error: true });

  const handleDelete = (category: Category) => {
    if (!confirm(`Delete ${category.name}? Categories used by records cannot be deleted.`)) return;
    try {
      store.deleteCategory(category.id);
      setFeedback({ text: `${category.name} deleted.`, error: false });
    } catch (error) {
      showError(error, 'Could not delete this category.');
    }
  };

  return (
    <section className="ember-glass settings-card category-settings settings-stack">
      <div className="category-settings-heading">
        <div>
          <h2>Categories & budget groups</h2>
          <p>Organize your entries so budgets and reports reflect how you use your money.</p>
        </div>
        <span className="category-total">
          {categories.length} {categories.length === 1 ? 'category' : 'categories'}
        </span>
      </div>

      <form
        className="category-create"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmedName = name.trim();
          if (!trimmedName) {
            setFeedback({ text: 'Enter a category name.', error: true });
            return;
          }
          try {
            store.createCategory({
              name: trimmedName,
              type,
              parentId: null,
              color: '#ff9a72',
              icon: 'wallet',
              budgetGroup: type === 'expense' ? group : undefined,
            });
            setName('');
            setFeedback({ text: `${trimmedName} added.`, error: false });
          } catch (error) {
            showError(error, 'Could not add this category.');
          }
        }}
      >
        <div className="category-create-heading">
          <h3>Add a category</h3>
          <span>For transactions and budget planning</span>
        </div>
        <div className="category-create-fields">
          <label htmlFor="category-name">
            Category name
            <input
              id="category-name"
              className="input"
              value={name}
              required
              maxLength={100}
              placeholder="e.g. Internet"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label htmlFor="category-type">
            Type
            <select
              id="category-type"
              className="input"
              value={type}
              onChange={(event) => setType(event.target.value as 'income' | 'expense')}
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
              onChange={(event) => setGroup(event.target.value as Category['budgetGroup'])}
            >
              <option value="needs">Needs</option>
              <option value="wants">Wants</option>
              <option value="giving">Giving</option>
            </select>
          </label>
          <button className="btn btn-primary" type="submit">
            <Plus size={16} aria-hidden="true" />
            Add category
          </button>
        </div>
      </form>

      {feedback && (
        <p
          className={feedback.error ? 'form-error' : 'form-success'}
          role={feedback.error ? 'alert' : 'status'}
        >
          {feedback.text}
        </p>
      )}

      <div className="category-groups" role="group" aria-label="Existing categories">
        {groups.map((section) => {
          const items = categories.filter((category) =>
            section.id === 'income'
              ? category.type === 'income'
              : category.type === 'expense' && (category.budgetGroup ?? 'wants') === section.id,
          );
          return (
            <section key={section.id} className={`category-group category-group-${section.id}`}>
              <div className="category-group-heading">
                <div>
                  <h3>{section.label}</h3>
                  <p>{section.description}</p>
                </div>
                <span className="category-count">{items.length}</span>
              </div>
              <div className="category-rows">
                {items.length === 0 && <p className="category-empty">No categories yet</p>}
                {items.map((category) => (
                  <div className="category-row" key={category.id}>
                    <span className="category-name" title={category.name}>
                      {category.name}
                    </span>
                    {category.type === 'expense' && (
                      <label className="category-row-group">
                        <span className="sr-only">Budget group for {category.name}</span>
                        <select
                          className="input"
                          value={category.budgetGroup ?? 'wants'}
                          onChange={(event) => {
                            try {
                              store.updateCategory(category.id, {
                                budgetGroup: event.target.value as Category['budgetGroup'],
                              });
                              setFeedback({
                                text: `${category.name} moved to ${event.target.selectedOptions[0].text}.`,
                                error: false,
                              });
                            } catch (error) {
                              showError(error, 'Could not update this category.');
                            }
                          }}
                        >
                          <option value="needs">Needs</option>
                          <option value="wants">Wants</option>
                          <option value="giving">Giving</option>
                        </select>
                      </label>
                    )}
                    <button
                      className="category-delete"
                      type="button"
                      aria-label={`Delete ${category.name}`}
                      title={`Delete ${category.name}`}
                      onClick={() => handleDelete(category)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
