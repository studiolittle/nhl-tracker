import test from 'node:test';
import assert from 'node:assert/strict';
import { conferenceRows, divisionGroups, gamesDiffer, seedLabel, wildCardGroups } from './standings.js';

// A trimmed East in the shape of the NHL feed on 2026-11-02: wildcardSequence 0, 1, 2, then 3 and up.
const team = (abbrev, division, divisionSequence, conferenceSequence, wildcardSequence, extra = {}) => ({ abbrev, name: abbrev, conference: 'Eastern', division, divisionSequence, conferenceSequence, wildcardSequence, gamesPlayed: 15, ...extra });
const east = [
  team('CAR', 'Metropolitan', 1, 1, 0), team('BOS', 'Atlantic', 1, 2, 0), team('MTL', 'Atlantic', 2, 3, 0), team('OTT', 'Atlantic', 3, 4, 0),
  team('TBL', 'Atlantic', 4, 5, 1), team('NJD', 'Metropolitan', 2, 6, 0), team('FLA', 'Atlantic', 5, 7, 2), team('TOR', 'Atlantic', 6, 8, 3),
  team('WSH', 'Metropolitan', 3, 11, 0), team('NYI', 'Metropolitan', 4, 12, 6),
];
const west = [team('EDM', 'Pacific', 1, 1, 0, { conference: 'Western' })];
const abbrevs = group => group.entries.map(entry => entry.team.abbrev);

test('every row gets a text tag and a full phrase for screen readers', () => {
  assert.deepEqual(seedLabel(east[1]), { group: 'division', tag: 'A1', phrase: 'first in the Atlantic Division' });
  assert.deepEqual(seedLabel(east[8]), { group: 'division', tag: 'M3', phrase: 'third in the Metropolitan Division' });
  assert.deepEqual(seedLabel(east[4]), { group: 'wildcard', tag: 'WC1', phrase: 'first wild card' });
  assert.deepEqual(seedLabel(east[6]), { group: 'wildcard', tag: 'WC2', phrase: 'second wild card' });
  assert.deepEqual(seedLabel(east[7]), { group: 'out', tag: '', phrase: 'outside the playoff places' });
});

test('wild card view groups each division top three, then the wild cards, then the rest', () => {
  const groups = wildCardGroups([...east, ...west], 'Eastern');
  assert.deepEqual(groups.map(group => group.label), ['Atlantic Division', 'Metropolitan Division', 'Wild card', 'Out']);
  assert.deepEqual(abbrevs(groups[0]), ['BOS', 'MTL', 'OTT']);
  assert.deepEqual(abbrevs(groups[1]), ['CAR', 'NJD', 'WSH']);
  assert.deepEqual(abbrevs(groups[2]), ['TBL', 'FLA']);
  assert.deepEqual(abbrevs(groups[3]), ['TOR', 'NYI']);
});

test('a team ranked 11th in the conference still sits with its division leaders when it holds a top-three place', () => {
  const groups = wildCardGroups(east, 'Eastern');
  assert.ok(groups.find(group => group.key === 'Metropolitan').entries.some(entry => entry.team.abbrev === 'WSH'));
  assert.equal(conferenceRows(east, 'Eastern').findIndex(t => t.abbrev === 'WSH'), 7, 'conference order puts the playoff places first');
});

test('teams with the same sequence keep the order the NHL sent them in', () => {
  const tied = [team('AAA', 'Atlantic', 1, 1, 0), team('BBB', 'Atlantic', 1, 2, 0), team('CCC', 'Atlantic', 2, 3, 1), team('DDD', 'Atlantic', 3, 4, 1)];
  const groups = wildCardGroups(tied, 'Eastern');
  assert.deepEqual(abbrevs(groups[0]), ['AAA', 'BBB']);
  assert.deepEqual(abbrevs(groups[1]), ['CCC', 'DDD']);
});

test('the League view has no wild card groups, only a conference does', () => {
  assert.equal(wildCardGroups([...east, ...west], 'All'), null);
  assert.equal(divisionGroups([...east, ...west], 'All'), null);
  assert.deepEqual(conferenceRows([...east, ...west], 'All').map(t => t.abbrev), [...east, ...west].map(t => t.abbrev));
});

test('no markers before any games are played', () => {
  const zero = east.map(t => ({ ...t, gamesPlayed: 0 }));
  assert.equal(wildCardGroups(zero, 'Eastern'), null);
  assert.equal(divisionGroups(zero, 'Eastern'), null);
});

test('a missing or invalid sequence shows no markers at all', () => {
  const missing = east.map((t, i) => i === 3 ? { ...t, wildcardSequence: undefined } : t);
  assert.equal(wildCardGroups(missing, 'Eastern'), null);
  assert.equal(divisionGroups(missing, 'Eastern'), null);
  assert.equal(wildCardGroups(east.map(t => ({ ...t, wildcardSequence: -1 })), 'Eastern'), null);
  assert.equal(wildCardGroups(east.map(t => ({ ...t, divisionSequence: undefined })), 'Eastern'), null);
  assert.equal(wildCardGroups([], 'Eastern'), null);
});

test('division view lists every team under its division, with wild cards still marked', () => {
  const groups = divisionGroups(east, 'Eastern');
  assert.deepEqual(groups.map(group => group.label), ['Atlantic Division', 'Metropolitan Division']);
  assert.deepEqual(abbrevs(groups[0]), ['BOS', 'MTL', 'OTT', 'TBL', 'FLA', 'TOR']);
  assert.deepEqual(groups[0].entries.map(entry => entry.seed.tag), ['A1', 'A2', 'A3', 'WC1', 'WC2', '']);
});

test('games in hand are flagged only when teams have played different numbers of games', () => {
  assert.equal(gamesDiffer(east), false);
  assert.equal(gamesDiffer([...east, team('ZZZ', 'Atlantic', 7, 20, 9, { gamesPlayed: 14 })]), true);
});
