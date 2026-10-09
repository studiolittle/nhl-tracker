import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { seasonStart, trackerUrl, parseTrades, playerStats, hasRecentNhlGames } from './nhl.js';
import { easternDate, getSeasonContext, normalizeGames, normalizePlayoffSeries, parsePlayerNews } from './home.js';

const app = express();
export default app;
const root = fileURLToPath(new URL('../', import.meta.url));
const cache = new Map();
const pending = new Map();
async function cached(key, loader, ttl = 300_000) {
  const old = cache.get(key);
  if (old && Date.now() - old.time < ttl) return { ...old.value, stale: false, fetchedAt: new Date(old.time).toISOString() };
  if (pending.has(key)) return pending.get(key);
  const request = (async () => {
    try {
      const value = await loader(); const time = Date.now(); cache.set(key, { value, time });
      return { ...value, stale: false, fetchedAt: new Date(time).toISOString() };
    } catch (error) {
      if (old) return { ...old.value, stale: true, fetchedAt: new Date(old.time).toISOString() };
      throw error;
    } finally { pending.delete(key); }
  })();
  pending.set(key, request);
  return request;
}
async function fetchNhl(url, json = true) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'PuckHaul-NHL-Dashboard/0.1', Accept: json ? 'application/json' : 'text/html' } });
  if (!response.ok) throw new Error(`NHL returned ${response.status}`);
  return json ? response.json() : response.text();
}
async function standings() {
  return cached('standings', async () => {
    const data = await fetchNhl('https://api-web.nhle.com/v1/standings/now');
    if (!data.standings?.length) throw new Error('NHL standings unavailable');
    return { date: data.standings[0].date, season: data.standings[0].seasonId, teams: data.standings.map(t => ({
      name: t.teamName.default, abbrev: t.teamAbbrev.default, logo: t.teamLogo,
      conference: t.conferenceName, division: t.divisionName, gamesPlayed: t.gamesPlayed,
      wins: t.wins, losses: t.losses, otLosses: t.otLosses, points: t.points,
      rank: t.leagueSequence, conferenceSequence: t.conferenceSequence, wildcardSequence: t.wildcardSequence, goalDifferential: t.goalDifferential,
    })).sort((a, b) => a.rank - b.rank) };
  });
}
const route = (fn, cacheControl) => async (req, res) => { try { const body = await fn(req); if (cacheControl && !body.stale) res.set('Cache-Control', cacheControl); res.json(body); } catch (error) { console.error(error.message); res.status(502).json({ error: 'The NHL source is temporarily unavailable. Please try again.' }); } };
app.get('/api/standings', route(() => standings()));
async function seasonCalendar() {
  return cached('season-calendar', () => fetchNhl('https://api-web.nhle.com/v1/schedule/now'), 3_600_000);
}
app.get('/api/season', route(async () => {
  const calendar = await seasonCalendar();
  return { ...getSeasonContext(calendar), stale: calendar.stale, fetchedAt: calendar.fetchedAt };
}));
app.get('/api/scores', route(async req => {
  const requested = String(req.query.date || 'now');
  const today = easternDate();
  if (requested !== 'now' && (!/^\d{4}-\d{2}-\d{2}$/.test(requested) || !Number.isFinite(Date.parse(requested)) || Math.abs(Date.parse(requested) - Date.parse(today)) > 370 * 86_400_000 || new Date(requested).toISOString().slice(0, 10) !== requested)) {
    return { error: 'Choose a valid game date within one year of today.', games: [] };
  }
  // Date-bounded cache keys; current scores expire after 30 seconds.
  return cached(`scores-${requested === 'now' ? today : requested}`, async () => {
    const targetDate = requested === 'now' ? today : requested;
    const [score, table] = await Promise.all([fetchNhl(`https://api-web.nhle.com/v1/score/${targetDate}`), standings().catch(() => ({ teams: [] }))]);
    if (!Array.isArray(score.games) || score.currentDate !== targetDate) throw new Error('NHL scores unavailable for the requested date');
    return { date: score.currentDate, today, games: normalizeGames(score, { date: score.currentDate, teams: table.teams }), source: 'https://www.nhl.com/scores',
      days: (score.gameWeek || []).map(day => ({ date: day.date, numberOfGames: day.numberOfGames })) };
  }, 30_000);
}));
app.get('/api/playoffs', route(async () => {
  const calendar = await seasonCalendar();
  const context = getSeasonContext(calendar);
  if (context.phase !== 'playoffs') return { series: [], season: context.season, phase: context.phase };
  return cached(`playoffs-${context.playoffYear}`, async () => {
    const data = await fetchNhl(`https://api-web.nhle.com/v1/playoff-bracket/${context.playoffYear}`);
    if (!Array.isArray(data.series)) throw new Error('NHL playoff series unavailable');
    return { series: normalizePlayoffSeries(data), season: context.season, source: 'https://www.nhl.com/stanley-cup-playoffs' };
  }, 60_000);
}));
app.get('/api/updates', route(() => cached('player-updates', async () => {
  const html = await fetchNhl('https://www.nhl.com/news/', false);
  const updates = parsePlayerNews(html);
  return { updates, source: 'https://www.nhl.com/news/' };
}, 300_000)));
const normalizeName = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// Resolves to true/false, or null when the NHL lookup failed (callers keep the trade in that case).
async function isNhlPlayer(name, year) {
  try {
    const { isNhl } = await cached(`nhl-status-${year}-${normalizeName(name)}`, async () => {
      const results = await fetchNhl(`https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=100&q=${encodeURIComponent(name.split(/\s+/).at(-1))}`);
      const matches = results.filter(p => normalizeName(p.name) === normalizeName(name)).sort((a, b) => Number(b.active) - Number(a.active));
      if (!matches.length) return { isNhl: false };
      const landings = await Promise.all(matches.slice(0, 3).map(p => fetchNhl(`https://api-web.nhle.com/v1/player/${p.playerId}/landing`)));
      return { isNhl: landings.some(player => hasRecentNhlGames(player, year)) };
    }, 86_400_000);
    return isNhl;
  } catch { return null; }
}
// Lookups past the deadline stay unknown (null), so slow cold starts show the trade rather than time out.
async function onlyNhlTrades(trades, year, budgetMs = 7000) {
  const names = [...new Set(trades.flatMap(t => [...t.receivedPlayers, ...t.sentPlayers]))];
  const status = new Map();
  const lookups = (async () => {
    for (let i = 0; i < names.length; i += 12) {
      await Promise.all(names.slice(i, i + 12).map(async name => status.set(name, await isNhlPlayer(name, year))));
    }
  })();
  await Promise.race([lookups, new Promise(resolve => setTimeout(resolve, budgetMs))]);
  return trades.filter(t => [...t.receivedPlayers, ...t.sentPlayers].some(name => status.get(name) !== false));
}
app.get('/api/trades', route(async () => {
  const year = seasonStart();
  return cached(`trades-${year}`, async () => {
    const [html, table] = await Promise.all([fetchNhl(trackerUrl(year), false), standings()]);
    const trades = await onlyNhlTrades(parseTrades(html, year, table.teams), year);
    if (!trades.length) throw new Error('No trades could be read from the official tracker');
    return { season: `${year}–${String(year + 1).slice(-2)}`, trades, source: trackerUrl(year) };
  });
}, 'public, s-maxage=300, stale-while-revalidate=3600'));
app.get('/api/players/search', route(async req => {
  const query = String(req.query.q || '').trim().slice(0, 80);
  if (query.length < 2) return { players: [] };
  // Search is deliberately uncached so arbitrary user queries cannot grow server memory.
  const searchTerm = query.split(/\s+/).at(-1);
  const players = await fetchNhl(`https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=100&q=${encodeURIComponent(searchTerm)}`);
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const tokens = normalize(query).split(/\s+/);
  return { players: players.filter(p => tokens.every(token => normalize(p.name).includes(token))).sort((a, b) => Number(b.active) - Number(a.active)).slice(0, 8).map(p => ({ id: p.playerId, name: p.name, team: p.teamAbbrev, position: p.positionCode })) };
}));
app.get('/api/players/:id', route(async req => {
  if (!/^\d{7}$/.test(req.params.id)) throw new Error('Invalid player ID');
  const start = Number(req.query.season || seasonStart() - 1);
  if (!Number.isInteger(start) || start < 1917 || start > seasonStart()) throw new Error('Invalid season');
  return cached(`player-${req.params.id}-${start}`, async () => {
    const player = await fetchNhl(`https://api-web.nhle.com/v1/player/${req.params.id}/landing`);
    return { player: playerStats(player, start * 10000 + start + 1) };
  }, 900_000);
}));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route' }));
if (process.env.VERCEL || process.argv.includes('--production')) {
  app.use(express.static(path.join(root, 'dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'dist/index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 3000);
if (!process.env.VERCEL) app.listen(port, '127.0.0.1', () => console.log(`Puck Haul is running at http://localhost:${port}`));
