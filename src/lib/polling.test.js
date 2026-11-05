import test from 'node:test';
import assert from 'node:assert/strict';
import { dueOnReturn } from './polling.js';

test('a refresh that came due while the tab was hidden runs on return', () => {
  assert.equal(dueOnReturn(0, 300_000, 300_000), true);
  assert.equal(dueOnReturn(0, 3_600_000, 300_000), true);
});

test('coming back early does not trigger an extra refresh', () => {
  assert.equal(dueOnReturn(0, 299_999, 300_000), false);
  assert.equal(dueOnReturn(1_000, 1_001, 30_000), false);
});
