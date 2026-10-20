import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyWorkspaceReset } from '../src/lib/workspace-reset';

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

test('owner reset clears Ember financial, legacy, recovery and session copies once without erasing new work', () => {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  const generation = '00000000-0000-4000-8000-000000000001';
  for (const key of [
    'ember_ledger_v2',
    'ember_transactions',
    'ember_personal_workspace',
    'ember_recovery_v2',
  ])
    local.setItem(key, 'old financial records');
  local.setItem('other-application', 'keep');
  session.setItem('ember_pending', 'old session records');
  assert.equal(applyWorkspaceReset(null, local, session), false);
  assert.equal(local.getItem('ember_transactions'), 'old financial records');
  assert.equal(applyWorkspaceReset(generation, local, session), true);
  assert.equal(local.getItem('ember_transactions'), null);
  assert.equal(local.getItem('ember_personal_workspace'), null);
  assert.equal(local.getItem('ember_recovery_v2'), null);
  assert.equal(session.getItem('ember_pending'), null);
  assert.equal(local.getItem('other-application'), 'keep');
  local.setItem('ember_ledger_v2', 'new work');
  assert.equal(applyWorkspaceReset(generation, local, session), false);
  assert.equal(local.getItem('ember_ledger_v2'), 'new work');
  assert.equal(applyWorkspaceReset('00000000-0000-4000-8000-000000000002', local, session), true);
  assert.equal(local.getItem('ember_ledger_v2'), null);
});
