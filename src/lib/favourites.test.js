import test from 'node:test';
import assert from 'node:assert/strict';
import { FAVOURITES_KEY, normalizePreferences, readPreferences, savePreferences, filterFavouriteGames } from './favourites.js';

test('favourites include home and away games without repeating a shared matchup', () => {
  const games = [
    { id: 1, away: { abbrev: 'OTT' }, home: { abbrev: 'TOR' } },
    { id: 2, away: { abbrev: 'MTL' }, home: { abbrev: 'OTT' } },
    { id: 3, away: { abbrev: 'BOS' }, home: { abbrev: 'NYR' } },
    { id: 4, home: null, away: null },
  ];
  assert.deepEqual(filterFavouriteGames(games, ['OTT', 'TOR']).map(game => game.id), [1, 2]);
  assert.deepEqual(filterFavouriteGames(games, []), []);
  assert.equal(games.length, 4);
});

test('saved preferences discard malformed values and duplicate team codes', () => {
  assert.deepEqual(normalizePreferences({ teams: ['OTT', 'OTT', null, 7, 'ott', 'TOOLONG', 'TOR'], filter: 'favourites' }), { teams: ['OTT', 'TOR'], filter: 'favourites' });
  assert.deepEqual(normalizePreferences({ teams: 'OTT', filter: 'invalid' }), { teams: [], filter: 'all' });
  assert.deepEqual(readPreferences(() => ({ getItem: () => '{broken' })).preferences, { teams: [], filter: 'all' });
});

test('selected teams and schedule mode survive reload, including removing the last team', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  assert.equal(savePreferences(() => storage, { teams: ['TOR', 'OTT'], filter: 'favourites' }), true);
  assert.ok(data.has(FAVOURITES_KEY));
  assert.deepEqual(readPreferences(() => storage).preferences, { teams: ['TOR', 'OTT'], filter: 'favourites' });
  savePreferences(() => storage, { teams: [], filter: 'favourites' });
  assert.deepEqual(readPreferences(() => storage).preferences, { teams: [], filter: 'favourites' });
});

test('blocked storage and exhausted quota return recoverable results', () => {
  const blocked = () => { throw new Error('SecurityError'); };
  assert.deepEqual(readPreferences(blocked), { preferences: { teams: [], filter: 'all' }, unavailable: true });
  assert.equal(savePreferences(blocked, { teams: ['OTT'], filter: 'favourites' }), false);
  assert.equal(savePreferences(() => ({ setItem: () => { throw new Error('QuotaExceededError'); } }), {}), false);
});
