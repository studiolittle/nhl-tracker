import test from 'node:test';
import assert from 'node:assert/strict';
import { easternDate, getSeasonContext, normalizeGame, normalizeGames, normalizePlayoffSeries, parsePlayerNews } from './home.js';

const calendar = {
  preSeasonStartDate: '2026-09-19', regularSeasonStartDate: '2026-09-29',
  regularSeasonEndDate: '2027-04-10', playoffEndDate: '2027-06-10',
};
const now = new Date('2026-10-10T01:00:00Z');
const game = {
  id: 2026020066, season: 20262027, gameType: 2, gameDate: '2026-10-09',
  startTimeUTC: '2026-10-09T23:00:00Z', gameState: 'LIVE', gameScheduleState: 'OK',
  homeTeam: { id: 17, abbrev: 'DET', name: { default: 'Red Wings' }, score: 2, logo: 'https://assets.nhle.com/logos/nhl/svg/DET_light.svg' },
  awayTeam: { id: 55, abbrev: 'SEA', placeName: { default: 'Seattle' }, commonName: { default: 'Kraken' }, score: 0 },
  periodDescriptor: { number: 2, periodType: 'REG' },
  clock: { timeRemaining: '13:24', secondsRemaining: 804, running: true, inIntermission: false },
  gameCenterLink: '/gamecenter/sea-vs-det/2026/10/09/2026020066',
  tvBroadcasts: [
    { network: 'SN', countryCode: 'CA', market: 'N' },
    { network: 'TSN5', countryCode: 'CA', market: 'H' },
    { network: 'TSN5', countryCode: 'CA', market: 'H' },
    { network: 'Prime Video', countryCode: 'US', market: 'A' },
  ],
};

test('home date uses Eastern time across midnight and daylight saving changes', () => {
  assert.equal(easternDate('2026-10-10T01:00:00Z'), '2026-10-09');
  assert.equal(easternDate('2027-01-10T04:59:00Z'), '2027-01-09');
  assert.equal(easternDate('2027-01-10T05:00:00Z'), '2027-01-10');
  assert.equal(easternDate('invalid'), null);
});

test('season context follows supplied boundaries even on days with no games', () => {
  for (const [date, phase] of [
    ['2026-09-18', 'offseason'], ['2026-09-19', 'preseason'], ['2026-09-28', 'preseason'],
    ['2026-09-29', 'regular'], ['2026-12-25', 'regular'], ['2027-04-10', 'regular'],
    ['2027-04-11', 'playoffs'], ['2027-06-10', 'playoffs'], ['2027-06-11', 'offseason'],
  ]) assert.equal(getSeasonContext(calendar, `${date}T12:00:00Z`).phase, phase, date);
  const result = getSeasonContext(calendar, '2026-09-29T02:00:00Z');
  assert.equal(result.phase, 'preseason');
  assert.equal(result.season, 20262027);
  assert.equal(result.seasonLabel, '2026–27');
  assert.equal(result.playoffYear, 2027);
});

test('missing, impossible, or reversed calendar dates produce unknown rather than a guessed season', () => {
  for (const schedule of [null, {}, { ...calendar, playoffEndDate: null },
    { ...calendar, regularSeasonStartDate: '2026-02-30' },
    { ...calendar, regularSeasonEndDate: '2026-09-01' },
  ]) {
    assert.equal(getSeasonContext(schedule, now).phase, 'unknown');
    assert.equal(getSeasonContext(schedule, now).season, null);
  }
});

test('game normalization preserves score zero, period and each broadcast market without inventing access', () => {
  const result = normalizeGame(game, { now, teams: [{ abbrev: 'DET', name: 'Detroit Red Wings' }] });
  assert.equal(result.home.name, 'Detroit Red Wings');
  assert.equal(result.away.name, 'Seattle Kraken');
  assert.equal(result.home.score, 2);
  assert.equal(result.away.score, 0);
  assert.equal(result.period, 2);
  assert.equal(result.clock.timeRemaining, '13:24');
  assert.deepEqual(result.tvBroadcasts, [game.tvBroadcasts[0], game.tvBroadcasts[1], game.tvBroadcasts[3]]);
  assert.equal(result.gameCenterLink, 'https://www.nhl.com/gamecenter/sea-vs-det/2026/10/09/2026020066');
});

test('future, pregame and postponed fixtures do not expose initialized or stale scores', () => {
  const future = normalizeGame({ ...game, startTimeUTC: '2026-10-10T23:00:00Z' }, { now });
  assert.equal(future.state, 'FUT');
  assert.equal(future.home.score, null);
  assert.equal(future.period, null);
  assert.equal(future.clock, null);
  for (const update of [{ gameState: 'FUT' }, { gameState: 'PRE' }, { gameScheduleState: 'PPD' }]) {
    assert.equal(normalizeGame({ ...game, ...update }, { now }).home.score, null);
  }
  assert.equal(normalizeGame({ ...game, startTimeUTC: 'invalid' }, { now }).away.score, null);
});

test('unconfirmed start times remain unknown instead of becoming an epoch time or a started game', () => {
  for (const startTimeUTC of [null, undefined, '', '   ']) {
    const result = normalizeGame({ ...game, gameDate: '2027-04-13', startTimeUTC }, { now });
    assert.equal(result.startTime, null);
    assert.equal(result.date, '2027-04-13');
    assert.equal(result.state, 'FUT');
    assert.equal(result.home.score, null);
    assert.equal(result.away.score, null);
    assert.equal(result.clock, null);
  }
});

test('a score slate cannot leak into a no-game day or the next Eastern date', () => {
  const payload = { currentDate: '2026-10-09', games: [game], gameWeek: [{ date: '2026-10-09', numberOfGames: 1 }] };
  assert.equal(normalizeGames(payload, { now }).length, 1);
  assert.deepEqual(normalizeGames(payload, { date: '2026-10-10', now }), []);
  assert.deepEqual(normalizeGames(payload, { now: '2026-10-10T05:00:00Z' }), []);
  assert.deepEqual(normalizeGames({ currentDate: '2026-10-09', games: [] }, { now }), []);
});

test('schedule slates use their date, retain all games, and eliminate duplicate records', () => {
  const scheduleGame = { ...game }; delete scheduleGame.gameDate;
  const payload = { gameWeek: [
    { date: '2026-10-09', games: [scheduleGame, scheduleGame, { ...scheduleGame, id: 2026020067 }] },
    { date: '2026-10-10', games: [] },
  ] };
  const result = normalizeGames(payload, { now });
  assert.equal(result.length, 2);
  assert.equal(result[0].date, '2026-10-09');
  assert.deepEqual(normalizeGames(payload, { now, date: '2026-10-10' }), []);
});

test('outbound game links and images are restricted to official HTTPS hosts', () => {
  for (const url of ['https://evil.example/gamecenter/1', '//evil.example/gamecenter/1', 'javascript:alert(1)', 'https://www.nhl.com@evil.example/gamecenter/1', 'https://www.nhl.com/news/article']) {
    assert.equal(normalizeGame({ ...game, gameCenterLink: url }, { now }).gameCenterLink, null);
  }
  assert.equal(normalizeGame({ ...game, homeTeam: { ...game.homeTeam, logo: 'https://evil.example/logo.svg' } }, { now }).home.logo, null);
});

test('playoff series preserve seeds and official results while unfilled matchups remain unknown', () => {
  const result = normalizePlayoffSeries({ series: [
    { seriesLetter: 'O', playoffRound: 4, seriesTitle: 'Stanley Cup Final', topSeedTeam: { ...game.homeTeam, name: { default: 'Detroit Red Wings' } }, bottomSeedTeam: game.awayTeam, topSeedWins: 4, bottomSeedWins: 2, winningTeamId: 17, seriesUrl: '/schedule/playoff-series/2027/series-o' },
    { seriesLetter: 'A', playoffRound: 1, seriesTitle: '1st Round', topSeedWins: 0, bottomSeedWins: 0, winningTeamId: 99 },
  ] });
  assert.equal(result[0].id, 'A');
  assert.equal(result[0].topSeedTeam, null);
  assert.equal(result[0].winningTeamId, null);
  assert.equal(result[1].topSeedTeam.name, 'Detroit Red Wings');
  assert.equal(result[1].winningTeamId, 17);
  assert.equal(result[1].bottomSeedWins, 2);
});

const card = (href, title, date) => `<a class="nhl-c-card-wrap" href="${href}"><article><h3 class="fa-text__title">${title}</h3><time datetime="${date}" data-plugin="client-date">Date</time></article></a>`;

test('NHL player news reads article cards and published dates, deduplicating repeated URLs', () => {
  const result = parsePlayerNews([
    card('/news/nhl-status-report-news-and-notes-october-9-2026', 'Status Report: Tavares out for Leafs after birth of son', '2026-10-09T21:35:00'),
    card('/news/nhl-status-report-news-and-notes-october-9-2026?source=home', 'Shorter status report headline', '2026-10-09T21:35:00'),
    card('/news/test-injury-status-update-october-8', 'Player injury status update', '2026-10-08T12:00:00'),
    card('/news/nhl-lineup-projections-2026-27-season', 'NHL lineup projections', '2026-10-09'),
  ].join(''), { now });
  assert.equal(result.length, 3);
  assert.equal(result[0].title, 'Status Report: Tavares out for Leafs after birth of son');
  assert.equal(result[0].date, '2026-10-09');
  assert.equal(result[2].date, '2026-10-08');
  assert.equal(result[0].url, 'https://www.nhl.com/news/nhl-status-report-news-and-notes-october-9-2026');
  assert.deepEqual(Object.keys(result[0]), ['title', 'date', 'url']);
});

test('player news excludes stale, future, undated and unrelated stories', () => {
  const html = [
    card('/news/injury-old', 'Old injury report', '2026-10-01T18:00:00'),
    card('/news/injury-future', 'Future injury report', '2026-10-10T01:00:00'),
    card('/news/injury-later', 'Later injury report', '2026-10-10T23:00:00Z'),
    card('/news/injury-no-date', 'Undated injury report', ''),
    card('/news/injury-bad-date', 'Invalid injury report', '2026-02-30'),
    card('/news/hockey-feature', 'A great night of hockey', '2026-10-09'),
    card('/news/injury-boundary', 'Recent injury report', '2026-10-02T22:00:00'),
  ].join('');
  assert.deepEqual(parsePlayerNews(html, { now }).map(item => item.title), ['Recent injury report']);
});

test('player news rejects malicious URLs and caps the list at six real articles', () => {
  const invalid = ['https://evil.example/news/injury-update', '//evil.example/news/injury-update', 'javascript:alert(1)', 'http://www.nhl.com/news/injury-update', 'https://www.nhl.com@evil.example/news/injury-update', 'https://www.nhl.com:444/news/injury-update'];
  const html = [...invalid.map(url => card(url, 'Injury report', '2026-10-09')), ...Array.from({ length: 8 }, (_, index) => card(`/news/injury-${index}`, `Injury report ${index}`, '2026-10-09'))].join('');
  const result = parsePlayerNews(html, { now, limit: 20 });
  assert.equal(result.length, 6);
  assert.equal(result[0].title, 'Injury report 0');
  assert.deepEqual(parsePlayerNews(html, { now, limit: 0 }), []);
});
