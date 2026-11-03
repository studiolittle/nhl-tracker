import test from 'node:test';
import assert from 'node:assert/strict';
import { searchText, matchesSearch } from './search.js';

const trade = 'Toronto Maple Leafs Vancouver Canucks forward Aatu Räty Montréal Canadiens';

test('accents and case do not change a match in either direction', () => {
  assert.ok(matchesSearch(trade, 'raty'));
  assert.ok(matchesSearch(trade, 'RÄTY'));
  assert.ok(matchesSearch(trade, 'montreal'));
  assert.ok(matchesSearch('Montreal Canadiens', 'montréal'));
});

test('an empty or blank search matches everything and a miss still misses', () => {
  assert.ok(matchesSearch(trade, ''));
  assert.ok(matchesSearch(trade, '  '));
  assert.ok(!matchesSearch(trade, 'boston'));
});

test('missing text is treated as empty rather than throwing', () => {
  assert.equal(searchText(undefined), '');
  assert.ok(!matchesSearch(null, 'raty'));
});
