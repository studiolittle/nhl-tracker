import test from 'node:test';
import assert from 'node:assert/strict';
import { pickComparablePair } from './compare.js';

const p = (id, position, name = `P${id}`) => ({ id, name, position });

test('goalie against skater is avoided when another pairing works', () => {
  const [a, b] = pickComparablePair([[p(1, 'G'), p(2, 'C')], [p(3, 'D')]]);
  assert.deepEqual([a.id, b.id], [2, 3]);
});

test('two goalies pair with each other', () => {
  const [a, b] = pickComparablePair([[p(1, 'G')], [p(2, 'D'), p(3, 'G')]]);
  assert.deepEqual([a.id, b.id], [1, 3]);
});

test('the first players are kept when they already match', () => {
  const [a, b] = pickComparablePair([[p(1, 'C'), p(2, 'W')], [p(3, 'D'), p(4, 'C')]]);
  assert.deepEqual([a.id, b.id], [1, 3]);
});

test('with no comparable pair it falls back to the first player on each side', () => {
  const [a, b] = pickComparablePair([[p(1, 'G')], [p(2, 'C')]]);
  assert.deepEqual([a.id, b.id], [1, 2]);
});

test('assets and players without a record never beat a real player', () => {
  const asset = { name: '2nd-round pick', asset: true };
  const [a, b] = pickComparablePair([[asset], [p(3, 'C')]]);
  assert.equal(a, asset); assert.equal(b.id, 3);
  const [c, d] = pickComparablePair([[{ name: 'No Record' }, p(5, 'C')], [p(6, 'W')]]);
  assert.deepEqual([c.id, d.id], [5, 6]);
});

test('players with an unknown position pair with anyone', () => {
  const [a, b] = pickComparablePair([[{ id: 1, name: 'X' }], [p(2, 'G')]]);
  assert.deepEqual([a.id, b.id], [1, 2]);
});
