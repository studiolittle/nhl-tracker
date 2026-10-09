import test from 'node:test';
import assert from 'node:assert/strict';
import { playoffRoundLabel, playoffSeriesStatus, selectPlayoffSeries } from './playoffs.js';

const tor = { id: 10, name: 'Toronto Maple Leafs', abbrev: 'TOR' };
const ott = { id: 9, name: 'Ottawa Senators', abbrev: 'OTT' };
const series = (id, round, topSeedWins, bottomSeedWins, winningTeamId = null) => ({
  id, round, topSeedTeam: tor, bottomSeedTeam: ott, topSeedWins, bottomSeedWins, winningTeamId,
});

test('overlapping rounds keep every confirmed unfinished matchup visible', () => {
  const rows = [series('J', 2, 0, 0), series('A', 1, 4, 1, 10), series('D', 1, 3, 3), series('I', 2, 1, 0)];
  const original = rows.map(item => item.id);
  assert.deepEqual(selectPlayoffSeries(rows).map(item => item.id), ['D', 'I', 'J']);
  assert.deepEqual(rows.map(item => item.id), original, 'selection must not sort the input array');
});

test('completed bracket falls back to the latest completed round and ignores future placeholders', () => {
  const rows = [series('A', 1, 4, 1, 10), series('N', 3, 1, 4, 9), series('M', 3, 4, 2, 10),
    { ...series('O', 4, 0, 0), bottomSeedTeam: null }];
  assert.deepEqual(selectPlayoffSeries(rows).map(item => item.id), ['M', 'N']);
  assert.deepEqual(selectPlayoffSeries([...rows, series('O', 4, 4, 3, 10)]).map(item => item.id), ['O']);
});

test('unfilled or malformed bracket entries never masquerade as confirmed games', () => {
  assert.deepEqual(selectPlayoffSeries(undefined), []);
  assert.deepEqual(selectPlayoffSeries([null, { round: 1 }, { ...series('A', 1, 0, 0), topSeedTeam: { id: null, name: '' } }, series('X', 5, 0, 0)]), []);
});

test('unavailable win totals remain pending while a real zero-zero matchup is not started', () => {
  assert.equal(playoffSeriesStatus(series('A', 1, null, null)), 'Series result pending');
  assert.equal(playoffSeriesStatus(series('A', 1, 2, null)), 'Series result pending');
  assert.equal(playoffSeriesStatus(series('A', 1, -1, 2)), 'Series result pending');
  assert.equal(playoffSeriesStatus(series('A', 1, 4, 4)), 'Series result pending');
  assert.equal(playoffSeriesStatus(series('A', 1, 0, 0)), 'Series not started');
});

test('series status reports tied and leading results from actual totals', () => {
  assert.equal(playoffSeriesStatus(series('A', 1, 2, 2)), 'Series tied 2–2');
  assert.equal(playoffSeriesStatus(series('A', 1, 3, 1)), 'TOR leads 3–1');
  assert.equal(playoffSeriesStatus(series('A', 1, 1, 3)), 'OTT leads 3–1');
});

test('official winner takes precedence and Final winners are distinguished from advancement', () => {
  assert.equal(playoffSeriesStatus(series('A', 1, 4, 2, 10)), 'Toronto Maple Leafs advances');
  assert.equal(playoffSeriesStatus(series('O', 4, 2, 4, 9)), 'Ottawa Senators wins the Stanley Cup');
  assert.equal(playoffSeriesStatus(series('O', 4, null, null, 9)), 'Ottawa Senators wins the Stanley Cup');
  assert.equal(playoffSeriesStatus(series('A', 1, 2, 1, 99)), 'TOR leads 2–1');
});

test('four confirmed wins settle a series while its winner field is pending', () => {
  const finished = series('A', 1, 4, 2);
  assert.equal(playoffSeriesStatus(finished), 'Toronto Maple Leafs advances');
  assert.deepEqual(selectPlayoffSeries([finished, series('B', 1, 3, 2)]).map(item => item.id), ['B']);
  assert.equal(playoffSeriesStatus(series('O', 4, 3, 4)), 'Ottawa Senators wins the Stanley Cup');
});

test('round labels match playoff stages without inventing a round for missing data', () => {
  assert.equal(playoffRoundLabel(1), 'First round');
  assert.equal(playoffRoundLabel(2), 'Second round');
  assert.equal(playoffRoundLabel(3), 'Conference finals');
  assert.equal(playoffRoundLabel(4), 'Stanley Cup Final');
  assert.equal(playoffRoundLabel(null), 'Stanley Cup Playoffs');
});
