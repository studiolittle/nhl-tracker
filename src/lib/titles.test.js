import test from 'node:test';
import assert from 'node:assert/strict';
import { viewTitle } from './titles.js';

const trade = { date: '2026-10-15', to: { abbrev: 'TOR' }, from: { abbrev: 'VAN' } };

test('each view has its own title, and Home keeps the page title', () => {
  assert.equal(viewTitle({ view: 'Home' }), null);
  assert.equal(viewTitle({ view: 'Trades', tradeTab: 'wire' }), 'NHL Trade Wire and Player Comparisons | Puck Haul');
  assert.equal(viewTitle({ view: 'Trades', tradeTab: 'compare' }), 'Compare NHL Players | Puck Haul');
  assert.equal(viewTitle({ view: 'Standings', seasonLabel: '2026–27' }), 'NHL Standings, 2026–27 | Puck Haul');
});

test('a trade title names the teams and date from the trade', () => {
  assert.equal(viewTitle({ view: 'Trades', tradeTab: 'compare', trade }), 'TOR–VAN Trade, Oct. 15 | Puck Haul');
  assert.equal(viewTitle({ view: 'Trades', tradeTab: 'compare', trade: { ...trade, date: '2026-07-01' } }), 'TOR–VAN Trade, July 1 | Puck Haul');
});

test('missing trade or season details fall back to a plain title', () => {
  assert.equal(viewTitle({ view: 'Trades', tradeTab: 'compare', trade: { ...trade, date: 'soon' } }), 'Compare NHL Players | Puck Haul');
  assert.equal(viewTitle({ view: 'Standings' }), 'NHL Standings | Puck Haul');
});

test('every title stays under 60 characters', () => {
  for (const title of [viewTitle({ view: 'Trades', tradeTab: 'wire' }), viewTitle({ view: 'Trades', tradeTab: 'compare', trade: { ...trade, date: '2026-09-30' } }), viewTitle({ view: 'Standings', seasonLabel: '2026–27' })]) assert.ok(title.length < 60, title);
});
