import * as cheerio from 'cheerio';

const DATE_FIELDS = ['preSeasonStartDate', 'regularSeasonStartDate', 'regularSeasonEndDate', 'playoffEndDate'];
const SCORING_STATES = new Set(['LIVE', 'CRIT', 'FINAL', 'OFF']);
const cleanText = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
const localized = value => cleanText(typeof value === 'string' ? value : value?.default);
const positiveInteger = value => Number.isInteger(value) && value > 0 ? value : null;
const nonnegativeInteger = value => Number.isInteger(value) && value >= 0 ? value : null;

function dateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

export function easternDate(now = new Date()) {
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function getSeasonContext(schedule, now = new Date()) {
  const date = easternDate(now);
  const dates = Object.fromEntries(DATE_FIELDS.map(key => [key, dateOnly(schedule?.[key])]));
  const [preseason, start, end, playoffsEnd] = DATE_FIELDS.map(key => dates[key]);
  const valid = date && preseason && start && end && playoffsEnd && preseason < start && start <= end && end < playoffsEnd;
  if (!valid) return { date, phase: 'unknown', season: null, seasonLabel: null, playoffYear: null, dates };
  const startYear = Number(start.slice(0, 4));
  const endYear = Number(end.slice(0, 4));
  const phase = date < preseason || date > playoffsEnd ? 'offseason'
    : date < start ? 'preseason' : date <= end ? 'regular' : 'playoffs';
  return { date, phase, season: startYear * 10000 + endYear, seasonLabel: `${startYear}–${String(endYear).slice(-2)}`, playoffYear: endYear, dates };
}

function trustedUrl(value, { asset = false, prefix = '/' } = {}) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, 'https://www.nhl.com');
    const hosts = asset ? ['assets.nhle.com'] : ['www.nhl.com', 'nhl.com'];
    if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || url.username || url.password || url.port || !url.pathname.startsWith(prefix)) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}

function normalizeTeam(team, showScore = false, teams = []) {
  if (!team || typeof team !== 'object') return null;
  const known = (Array.isArray(teams) ? teams : []).find(item => (positiveInteger(team.id) && item?.id === team.id) || (cleanText(team.abbrev) && item?.abbrev === team.abbrev));
  const place = localized(team.placeName) || localized(team.placeNameWithPreposition);
  const name = localized(known?.name) || [place, localized(team.commonName)].filter(Boolean).join(' ') || localized(team.name) || cleanText(team.abbrev);
  return {
    id: positiveInteger(team.id), abbrev: cleanText(team.abbrev), name,
    logo: trustedUrl(team.logo || known?.logo, { asset: true }), darkLogo: trustedUrl(team.darkLogo || known?.darkLogo, { asset: true }),
    score: showScore ? nonnegativeInteger(team.score) : null,
  };
}

function normalizeBroadcasts(broadcasts) {
  const seen = new Set();
  return (Array.isArray(broadcasts) ? broadcasts : []).flatMap(item => {
    const network = cleanText(item?.network);
    if (!network) return [];
    const countryCode = cleanText(item.countryCode) || null;
    const market = cleanText(item.market) || null;
    const key = JSON.stringify([network, countryCode, market]);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ network, countryCode, market }];
  });
}

export function normalizeGame(game, { date, now = new Date(), teams = [] } = {}) {
  if (!game || !positiveInteger(game.id)) return null;
  const rawStart = cleanText(game.startTimeUTC);
  const start = new Date(rawStart || NaN);
  const startTime = Number.isFinite(start.getTime()) ? start.toISOString() : null;
  const gameDate = dateOnly(game.gameDate) || dateOnly(date) || (startTime ? easternDate(start) : null);
  const nowTime = new Date(now).getTime();
  let state = cleanText(game.gameState) || 'UNKNOWN';
  const scheduleState = cleanText(game.gameScheduleState) || 'UNKNOWN';
  // NHL feeds may initialize period/score fields before puck drop. Never turn
  // tomorrow's scheduled game or a postponed fixture into a live 0–0 score.
  const hasStarted = startTime && Number.isFinite(nowTime) && start.getTime() <= nowTime;
  if (!hasStarted && SCORING_STATES.has(state)) state = 'FUT';
  const showScore = hasStarted && SCORING_STATES.has(state) && !['PPD', 'CNCL', 'CANCELLED', 'POSTPONED'].includes(scheduleState);
  const period = showScore ? positiveInteger(game.periodDescriptor?.number ?? game.period) : null;
  const rawClock = game.clock;
  const clock = showScore && rawClock && typeof rawClock === 'object' ? {
    timeRemaining: cleanText(rawClock.timeRemaining) || null,
    secondsRemaining: nonnegativeInteger(rawClock.secondsRemaining),
    running: typeof rawClock.running === 'boolean' ? rawClock.running : null,
    inIntermission: typeof rawClock.inIntermission === 'boolean' ? rawClock.inIntermission : null,
  } : null;
  return {
    id: game.id, date: gameDate, season: positiveInteger(game.season), gameType: positiveInteger(game.gameType),
    state, scheduleState, startTime, period, periodType: showScore ? cleanText(game.periodDescriptor?.periodType) || null : null, clock,
    home: normalizeTeam(game.homeTeam, showScore, teams), away: normalizeTeam(game.awayTeam, showScore, teams),
    gameCenterLink: trustedUrl(game.gameCenterLink, { prefix: '/gamecenter/' }),
    tvBroadcasts: normalizeBroadcasts(game.tvBroadcasts),
  };
}

export function normalizeGames(payload, { now = new Date(), date = easternDate(now), teams = [] } = {}) {
  if (!dateOnly(date)) return [];
  let rows = [];
  if (Array.isArray(payload?.games)) {
    // score/now can still contain yesterday's slate around midnight. Its date
    // is authoritative; an empty requested slate must stay empty.
    rows = payload.games.filter(game => (dateOnly(game?.gameDate) || dateOnly(payload.currentDate)) === date);
  } else if (Array.isArray(payload?.gameWeek)) {
    rows = payload.gameWeek.filter(day => day?.date === date).flatMap(day => Array.isArray(day.games) ? day.games : []);
  }
  const seen = new Set();
  return rows.map(game => normalizeGame(game, { date, now, teams })).filter(game => {
    if (!game || game.date !== date || seen.has(game.id)) return false;
    seen.add(game.id);
    return true;
  }).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '') || a.id - b.id);
}

export function normalizePlayoffSeries(payload) {
  const seen = new Set();
  return (Array.isArray(payload?.series) ? payload.series : []).flatMap(series => {
    const round = positiveInteger(series?.playoffRound);
    const id = cleanText(series?.seriesLetter);
    if (!id || !round || round > 4 || seen.has(id)) return [];
    seen.add(id);
    const topSeedTeam = normalizeTeam(series.topSeedTeam);
    const bottomSeedTeam = normalizeTeam(series.bottomSeedTeam);
    const winningTeamId = positiveInteger(series.winningTeamId);
    const wins = value => Number.isInteger(value) && value >= 0 && value <= 4 ? value : null;
    return [{
      id, round, title: cleanText(series.seriesTitle), topSeedTeam, bottomSeedTeam,
      topSeedWins: wins(series.topSeedWins), bottomSeedWins: wins(series.bottomSeedWins),
      winningTeamId: winningTeamId && [topSeedTeam?.id, bottomSeedTeam?.id].includes(winningTeamId) ? winningTeamId : null,
      seriesUrl: trustedUrl(series.seriesUrl, { prefix: '/schedule/playoff-series/' }),
    }];
  }).sort((a, b) => a.round - b.round || a.id.localeCompare(b.id));
}

export function parsePlayerNews(html, { now = new Date(), limit = 6 } = {}) {
  const $ = cheerio.load(typeof html === 'string' ? html : '');
  const today = easternDate(now);
  const nowTime = new Date(now).getTime();
  if (!today || !Number.isFinite(nowTime)) return [];
  const minimumDate = new Date(`${today}T12:00:00Z`);
  minimumDate.setUTCDate(minimumDate.getUTCDate() - 7);
  const oldest = minimumDate.toISOString().slice(0, 10);
  const seen = new Set();
  const stories = [];
  $('.nhl-c-card-wrap').each((_, element) => {
    const card = $(element);
    const heading = card.find('h3').first();
    const title = cleanText(heading.text());
    const link = heading.closest('a[href]').attr('href') || heading.find('a[href]').first().attr('href') || card.find('a[href]').first().attr('href');
    const url = trustedUrl(link);
    if (!title || !url || !new URL(url).pathname.includes('/news/') || !/(?:injur|status[- ]report|line[- ]?up)/i.test(`${title} ${new URL(url).pathname}`)) return;
    const rawDate = card.find('time[datetime]').first().attr('datetime');
    if (!rawDate) return;
    // NHL news dates currently omit a timezone. Preserve their published
    // calendar date rather than interpreting it in this server's timezone.
    const unzoned = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/.test(rawDate);
    const publishedDate = dateOnly(rawDate.slice(0, 10));
    if (!publishedDate) return;
    const timestamp = unzoned ? null : new Date(rawDate);
    if (!unzoned && (!Number.isFinite(timestamp.getTime()) || timestamp.getTime() > nowTime)) return;
    const date = unzoned ? publishedDate : easternDate(timestamp);
    if (!date || date < oldest || date > today) return;
    const identity = new URL(url);
    identity.search = '';
    if (seen.has(identity.href)) return;
    seen.add(identity.href);
    stories.push({ title, date, url: identity.href });
  });
  return stories.sort((a, b) => b.date.localeCompare(a.date)).slice(0, Math.min(6, Math.max(0, Number.isInteger(limit) ? limit : 6)));
}
