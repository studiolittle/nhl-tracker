import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTradePlayers, hasRecentNhlGames, parseTrades, playerStats, readTrackers, seasonStart, trackerEntryCount } from './nhl.js';

test('trade assets expose every named player while excluding draft picks', () => {
  assert.deepEqual(extractTradePlayers('forwards Dylan Cozens and Dennis Gilbert and a 2nd-round pick in the 2026 NHL Draft'), ['Dylan Cozens', 'Dennis Gilbert']);
  assert.deepEqual(extractTradePlayers('forwards Kirill Marchenko and Miles Wood and goalie Elvis Merzlikins'), ['Kirill Marchenko', 'Miles Wood', 'Elvis Merzlikins']);
  assert.deepEqual(extractTradePlayers('defenseman Sean Durzi, forward Cole Beaudoin and a 3rd-round pick in the 2027 NHL Draft'), ['Sean Durzi', 'Cole Beaudoin']);
  assert.deepEqual(extractTradePlayers('future considerations'), []);
});

test('player names survive picks without an article, draft-status labels and comma lists', () => {
  assert.deepEqual(extractTradePlayers('forward Dawson Mercer, goalie Nicolas Daws, forward Nick Bjugstad, Unsigned Draft Choice forward Alexander Command, 2nd-round pick in the 2029 NHL Draft and a 7th-round pick in the 2027 NHL Draft'), ['Dawson Mercer', 'Nicolas Daws', 'Nick Bjugstad', 'Alexander Command']);
  assert.deepEqual(extractTradePlayers('forward Jane Doe, a conditional 3rd-round pick in the 2027 NHL Draft'), ['Jane Doe']);
  assert.deepEqual(extractTradePlayers('forwards Al One, Bo Two and Cy Three'), ['Al One', 'Bo Two', 'Cy Three']);
  assert.deepEqual(extractTradePlayers('forward Jane Doe and future considerations'), ['Jane Doe']);
  assert.deepEqual(extractTradePlayers('forward Jane Doe and cash'), ['Jane Doe']);
  assert.deepEqual(extractTradePlayers('the rights to forward Jane Doe'), ['Jane Doe']);
  assert.deepEqual(extractTradePlayers('a 2nd- and a 3rd-round pick in the 2027 NHL Draft'), []);
  assert.deepEqual(extractTradePlayers('7th round pick in the 2028 NHL Draft'), []);
});

test('tracker entries worded "acquired" are read like "acquire"', () => {
  const result = parseTrades('<p>OCTOBER 15: Toronto Maple Leafs acquired forward Aatu Räty from the Vancouver Canucks for forwards Brandon Buhr and Jacob Quillan. | Maple Leafs acquire Raty from Canucks</p>', 2026, [{ name: 'Toronto Maple Leafs', abbrev: 'TOR' }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].date, '2026-10-15');
  assert.deepEqual(result[0].receivedPlayers, ['Aatu Räty']);
  assert.deepEqual(result[0].sentPlayers, ['Brandon Buhr', 'Jacob Quillan']);
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
test('goalie save percentages use official values and weight traded stints by shots', () => {
  const goalie = { ...player, position: 'G', seasonTotals: [
    { season: 20252026, leagueAbbrev: 'NHL', gameTypeId: 2, gamesPlayed: 25, shotsAgainst: 670, goalsAgainst: 78, savePctg: 0.883582 },
  ] };
  assert.equal(playerStats(goalie, 20252026).savePct, 0.883582);
  goalie.seasonTotals.push({ season: 20252026, leagueAbbrev: 'NHL', gameTypeId: 2, gamesPlayed: 10, shotsAgainst: 330, goalsAgainst: 22, savePctg: 0.933333 });
  assert.equal(playerStats(goalie, 20252026).savePct, 0.9);
  delete goalie.seasonTotals[1].goalsAgainst;
  assert.equal(playerStats(goalie, 20252026).savePct, null);
});
test('season boundaries follow the July 1 trade tracker rollover in Eastern time', () => {
  assert.equal(seasonStart(new Date('2026-07-01T03:59:00Z')), 2025);
  assert.equal(seasonStart(new Date('2026-07-01T04:00:00Z')), 2026);
});
test('team filters match accented NHL team names to tracker names', () => {
  const result = parseTrades('<p>JULY 1: Montreal Canadiens acquire forward Test Player from the Ottawa Senators for future considerations.</p>', 2026, [{ name: 'Montréal Canadiens', abbrev: 'MTL' }]);
  assert.equal(result[0].to.abbrev, 'MTL');
});
test('players with recent NHL games count as NHL players, minor-league-only players do not', () => {
  const row = (season, leagueAbbrev, gamesPlayed) => ({ season, leagueAbbrev, gamesPlayed });
  assert.equal(hasRecentNhlGames({ seasonTotals: [row(20252026, 'NHL', 3), row(20252026, 'AHL', 60)] }, 2026), true);
  assert.equal(hasRecentNhlGames({ seasonTotals: [row(20252026, 'AHL', 60), row(20232024, 'NHL', 40)] }, 2026), false);
  assert.equal(hasRecentNhlGames({ seasonTotals: [] }, 2026), false);
});

const paragraph = (date, to, received, from, sent) => `<p><strong>${date}:</strong> ${to} acquire ${received} from the ${from} for ${sent}.</p>`;
const OCT_A = paragraph('OCTOBER 12', 'Buffalo Sabres', 'defensemen Caleb Jones and Daniel Laatsch', 'Pittsburgh Penguins', 'defenseman Ryan Johnson');
const OCT_B = paragraph('OCTOBER 12', 'Nashville Predators', 'defenseman Jayden Struble', 'Montréal Canadiens', 'a 2nd-round pick in the 2027 NHL Draft');
const OCT_C = paragraph('OCTOBER 15', 'Toronto Maple Leafs', 'forward Aatu Räty', 'Vancouver Canucks', 'forwards Brandon Buhr and Jacob Quillan');
const ids = html => parseTrades(html, 2026, []).map(trade => trade.id);

test('trade ids are the date plus a hash of the tracker wording', () => {
  assert.match(ids(OCT_A)[0], /^2026-10-12-[0-9a-f]{8}$/);
  assert.deepEqual(ids(OCT_A + OCT_B + OCT_C), ids(OCT_A + OCT_B + OCT_C));
});
test('a new trade at the top of the tracker does not renumber older trades', () => {
  const before = Object.fromEntries(parseTrades(OCT_A + OCT_B, 2026, []).map(trade => [trade.received, trade.id]));
  for (const trade of parseTrades(OCT_C + OCT_A + OCT_B, 2026, [])) if (trade.received in before) assert.equal(trade.id, before[trade.received]);
});
test('trades on one date get different ids, whatever order the tracker lists them in', () => {
  const [a, b] = ids(OCT_A + OCT_B);
  assert.notEqual(a, b);
  assert.deepEqual(new Set(ids(OCT_B + OCT_A)), new Set([a, b]));
});
test('an identical paragraph listed twice gets -2 in tracker order', () => {
  const [first, second, third] = ids(OCT_A + OCT_A + OCT_A);
  assert.equal(second, `${first}-2`);
  assert.equal(third, `${first}-3`);
});
test('ids come from the wording, not the player parsing', () => {
  const trade = parseTrades(OCT_C, 2026, [])[0];
  assert.notEqual(trade.id, parseTrades(OCT_C.replace('Quillan', 'Quillen'), 2026, [])[0].id);
  // Accents, case and punctuation in the wording are not part of the identity.
  assert.equal(parseTrades(OCT_C.replace('Räty', 'RATY'), 2026, [])[0].id, trade.id);
});

const NOT_FOUND_PAGE = '<html><body><h1>Page not found</h1><p>Try the home page.</p></body></html>';
const EMPTY_TRACKER = '<html><body><h1>2027-28 NHL trades</h1></body></html>';
const OLD_TRACKER = paragraph('JUNE 27', 'Boston Bruins', 'forward Old One', 'Ottawa Senators', 'future considerations') + paragraph('JANUARY 5', 'Boston Bruins', 'forward Old Two', 'Ottawa Senators', 'future considerations');
const JULY_1 = new Date('2027-07-01T16:00:00Z');

test('before the new tracker is published the previous season is read and labelled', () => {
  const read = readTrackers({ year: 2027, currentHtml: null, previousHtml: OLD_TRACKER, teams: [], now: new Date('2027-07-01T05:00:00Z') });
  assert.equal(read.fallback, true);
  assert.equal(read.season, '2026–27');
  assert.equal(read.trades.length, 2);
});
test('a published tracker with no trades yet is empty, not an error, in the quiet offseason', () => {
  const read = readTrackers({ year: 2027, currentHtml: EMPTY_TRACKER, previousHtml: null, teams: [], now: JULY_1 });
  assert.equal(read.trades.length, 0);
  assert.equal(read.fallback, false);
  assert.equal(read.season, '2027–28');
});
test('with the new tracker published, only the run-up to July 1 carries over from the old one', () => {
  const current = paragraph('JULY 1', 'Boston Bruins', 'forward New One', 'Ottawa Senators', 'future considerations');
  const read = readTrackers({ year: 2027, currentHtml: current, previousHtml: OLD_TRACKER, teams: [], now: JULY_1 });
  assert.deepEqual(read.trades.map(trade => trade.date), ['2027-07-01', '2027-06-27']);
  assert.equal(new Set(read.trades.map(trade => trade.id)).size, 2);
});
test('the previous tracker is left out once the season is under way', () => {
  const current = paragraph('NOVEMBER 1', 'Boston Bruins', 'forward New One', 'Ottawa Senators', 'future considerations');
  const read = readTrackers({ year: 2027, currentHtml: current, previousHtml: OLD_TRACKER, teams: [], now: new Date('2027-11-02T15:00:00Z') });
  assert.equal(read.trades.length, 1);
});
test('entries that all fail to parse are an error, not a quiet day', () => {
  const changed = '<p>JULY 1: Boston Bruins got Somebody from Ottawa</p><p>JULY 2: Another line the parser cannot read</p>';
  assert.equal(trackerEntryCount(changed), 2);
  assert.throws(() => readTrackers({ year: 2027, currentHtml: changed, previousHtml: null, teams: [], now: JULY_1 }), /none could be read/);
});
test('an empty tracker in the middle of a season is an error', () => {
  assert.throws(() => readTrackers({ year: 2026, currentHtml: EMPTY_TRACKER, previousHtml: null, teams: [], now: new Date('2027-01-15T15:00:00Z') }), /no entries/);
});
test('no tracker at all is an error', () => {
  assert.throws(() => readTrackers({ year: 2027, currentHtml: null, previousHtml: null, teams: [], now: JULY_1 }), /No official trade tracker/);
});
test('a page that is not a tracker has no entries and is never read as trades', () => {
  assert.equal(trackerEntryCount(NOT_FOUND_PAGE), 0);
});
test('partly unreadable trackers report how many entries were skipped', () => {
  const read = readTrackers({ year: 2026, currentHtml: OCT_C + '<p>OCTOBER 16: Some odd wording nobody parses</p>', previousHtml: null, teams: [], now: new Date('2026-10-20T15:00:00Z') });
  assert.equal(read.entries, 2);
  assert.equal(read.skipped, 1);
});
