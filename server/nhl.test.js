import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTradePlayers, parseTrades, playerStats, seasonStart } from './nhl.js';

test('trade assets expose every named player while excluding draft picks', () => {
  assert.deepEqual(extractTradePlayers('forwards Dylan Cozens and Dennis Gilbert and a 2nd-round pick in the 2026 NHL Draft'), ['Dylan Cozens', 'Dennis Gilbert']);
  assert.deepEqual(extractTradePlayers('forwards Kirill Marchenko and Miles Wood and goalie Elvis Merzlikins'), ['Kirill Marchenko', 'Miles Wood', 'Elvis Merzlikins']);
  assert.deepEqual(extractTradePlayers('future considerations'), []);
});

test('NHL trade parsing preserves full packages, source links and season rollover', () => {
  const html = '<p>Not a trade</p><p><strong>JANUARY 2:</strong> Toronto Maple Leafs acquire forward Test Player from the Ottawa Senators for a conditional 2nd-round pick in the 2028 NHL Draft. | <a href="https://www.nhl.com/news/test">Details</a></p><p><strong>JULY 1:</strong> Ottawa Senators acquire goalie Another Player from the Toronto Maple Leafs for future considerations.</p>';
  const result = parseTrades(html, 2026, [{ name: 'Toronto Maple Leafs', abbrev: 'TOR' }]);
  assert.equal(result.length, 2);
  assert.equal(result[0].date, '2027-01-02');
  assert.equal(result[1].date, '2026-07-01');
  assert.equal(result[0].to.abbrev, 'TOR');
  assert.equal(result[0].sent, 'a conditional 2nd-round pick in the 2028 NHL Draft');
  assert.equal(result[0].source, 'https://www.nhl.com/news/test');
});
const player = { playerId: 1234567, firstName: { default: 'Test' }, lastName: { default: 'Player' }, position: 'C', seasonTotals: [
  { season: 20252026, leagueAbbrev: 'NHL', gameTypeId: 2, gamesPlayed: 30, goals: 10, assists: 20, points: 30 },
  { season: 20252026, leagueAbbrev: 'NHL', gameTypeId: 2, gamesPlayed: 20, goals: 5, assists: 10, points: 15 },
  { season: 20252026, leagueAbbrev: 'NHL', gameTypeId: 3, gamesPlayed: 10, goals: 5, points: 15 },
  { season: 20252026, leagueAbbrev: 'AHL', gameTypeId: 2, gamesPlayed: 10, goals: 5, points: 15 },
] };
test('comparisons combine traded-player team stints and exclude playoffs and other leagues', () => {
  const result = playerStats(player, 20252026);
  assert.equal(result.gamesPlayed, 50); assert.equal(result.goals, 15); assert.equal(result.points, 45);
});
test('missing season is represented as unavailable, not invented stats', () => {
  assert.equal(playerStats(player, 20262027).hasStats, false);
});
test('season boundaries follow July 1 trade tracker rollover', () => {
  assert.equal(seasonStart(new Date('2026-06-30T23:00:00Z')), 2025);
  assert.equal(seasonStart(new Date('2026-07-01T00:00:00Z')), 2026);
});
test('team filters match accented NHL team names to tracker names', () => {
  const result = parseTrades('<p>JULY 1: Montreal Canadiens acquire forward Test Player from the Ottawa Senators for future considerations.</p>', 2026, [{ name: 'Montréal Canadiens', abbrev: 'MTL' }]);
  assert.equal(result[0].to.abbrev, 'MTL');
});
