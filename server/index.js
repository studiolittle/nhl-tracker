import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { seasonStart, trackerUrl, parseTrades, playerStats } from './nhl.js';

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
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'BlueLine-NHL-Dashboard/0.1', Accept: json ? 'application/json' : 'text/html' } });
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
      rank: t.leagueSequence, goalDifferential: t.goalDifferential,
    })).sort((a, b) => a.rank - b.rank) };
  });
}
const route = fn => async (req, res) => { try { res.json(await fn(req)); } catch (error) { console.error(error.message); res.status(502).json({ error: 'The NHL source is temporarily unavailable. Please try again.' }); } };
app.get('/api/standings', route(() => standings()));
app.get('/api/trades', route(async () => {
  const year = seasonStart();
  return cached(`trades-${year}`, async () => {
    const [html, table] = await Promise.all([fetchNhl(trackerUrl(year), false), standings()]);
    const trades = parseTrades(html, year, table.teams);
    if (!trades.length) throw new Error('No trades could be read from the official tracker');
    return { season: `${year}–${String(year + 1).slice(-2)}`, trades, source: trackerUrl(year) };
  });
}));
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
if (!process.env.VERCEL) app.listen(port, '127.0.0.1', () => console.log(`Blue Line is running at http://localhost:${port}`));
