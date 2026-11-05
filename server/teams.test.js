import test from 'node:test';
import assert from 'node:assert/strict';
import { NHL_TEAMS } from './teams.js';
import { parseTrades } from './nhl.js';

test('the table holds 32 clubs with unique names and three-letter abbreviations', () => {
  assert.equal(NHL_TEAMS.length, 32);
  assert.equal(new Set(NHL_TEAMS.map(team => team.abbrev)).size, 32);
  assert.equal(new Set(NHL_TEAMS.map(team => team.name)).size, 32);
  for (const team of NHL_TEAMS) assert.match(team.abbrev, /^[A-Z]{3}$/);
});

test('trades read with only the static table get the right abbreviations, including accents and punctuation', () => {
  const html = '<p>OCTOBER 15: Toronto Maple Leafs acquired forward Aatu Räty from Vancouver Canucks for a 5th-round pick in the 2027 NHL Draft.</p>'
    + '<p>OCTOBER 14: Montreal Canadiens acquire forward Jane Roe from St. Louis Blues for forward John Doe.</p>';
  const trades = parseTrades(html, 2026, NHL_TEAMS);
  assert.deepEqual(trades.map(trade => [trade.to.abbrev, trade.from.abbrev]), [['TOR', 'VAN'], ['MTL', 'STL']]);
});
