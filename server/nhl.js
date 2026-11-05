import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import { easternDate } from './home.js';

// The season (and its trade tracker) turns over on July 1, Eastern time.
export function seasonStart(date = new Date()) {
  const [year, month] = easternDate(date).split('-').map(Number);
  return month >= 7 ? year : year - 1;
}
export function trackerUrl(year = seasonStart()) {
  return `https://www.nhl.com/news/topic/trade-coverage/${year}-${String(year + 1).slice(-2)}-nhl-trades`;
}

export function extractTradePlayers(text = '') {
  const value = text.replace(/\.$/, '').trim();
  // Role and draft-status labels separate players. Every list item is then checked
  // on its own, so a pick or other asset cannot take a player out with it.
  const groups = value.replace(/\b(?:forwards?|defensemen?|defenseman|goaltenders?|goalies?|centers?|centre|unsigned draft choice)\b/gi, '|').split('|');
  return groups.flatMap(group => group.split(/,|\s+and\s+/i))
    .map(name => name.replace(/^\s*(?:a|an)\s+/i, '').trim())
    // Names start with a capital; picks, cash and "the rights to" do not.
    .filter(name => /^\p{Lu}/u.test(name) && !/round pick|consideration/i.test(name));
}

// A trade's id comes from what the tracker says, not where it sits on the page, so adding a
// trade or fixing the parser never renumbers older links. Players are not part of the hash.
const idText = text => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
export function tradeId(date, to, from, received, sent) {
  return `${date}-${createHash('sha1').update([to, from, received, sent].map(idText).join('|')).digest('hex').slice(0, 8)}`;
}

export function parseTrades(html, year, teams) {
  const $ = cheerio.load(html);
  const trades = [];
  const seen = new Map();
  $('p').each((_, element) => {
    const text = $(element).text().replace(/\s+/g, ' ').trim();
    const match = text.match(/^([A-Z]+) (\d{1,2}):\s*(.+?) acquired? (.+?) from (?:the )?(.+?) (?:for|in exchange for) (.+?)(?:\s*\||$)/);
    if (!match) return;
    const [, month, day, to, received, from, sent] = match;
    const monthIndex = new Date(`${month} 1, 2000`).getMonth();
    if (!Number.isFinite(monthIndex)) return;
    const date = new Date(Date.UTC(monthIndex >= 6 ? year : year + 1, monthIndex, Number(day))).toISOString().slice(0, 10);
    const normalize = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const findTeam = name => teams.find(t => normalize(t.name) === normalize(name)) || { name, abbrev: name.split(' ').map(w => w[0]).join('') };
    const link = $(element).find('a[href]').first().attr('href');
    let source = trackerUrl(year);
    try { const url = new URL(link, source); if (url.protocol === 'https:' && url.hostname === 'www.nhl.com') source = url.href; } catch { /* Use tracker source. */ }
    const cleanReceived = received.replace(/\.$/, '');
    const cleanSent = sent.replace(/\.$/, '');
    // An identical paragraph listed twice gets -2, -3 in tracker order.
    const base = tradeId(date, to, from, cleanReceived, cleanSent);
    const count = (seen.get(base) || 0) + 1; seen.set(base, count);
    trades.push({ id: count > 1 ? `${base}-${count}` : base, date, to: findTeam(to), from: findTeam(from), received: cleanReceived, sent: cleanSent, receivedPlayers: extractTradePlayers(cleanReceived), sentPlayers: extractTradePlayers(cleanSent), source });
  });
  return trades.sort((a, b) => b.date.localeCompare(a.date));
}

// A new tracker can be missing or empty for weeks after July 1, and the draft-week trades stay in the
// previous one. Through October an empty result is a normal quiet stretch; after that it is a fault.
const QUIET_MONTHS = [7, 8, 9, 10];
const CARRYOVER_FROM = '06-01';
// Eastern calendar month of the quiet offseason stretch, when the previous tracker is still read.
export const isQuietPeriod = (now = new Date()) => QUIET_MONTHS.includes(Number(easternDate(now).slice(5, 7)));
const entryPattern = /^[A-Z]+ \d{1,2}:/;
export function trackerEntryCount(html) {
  const $ = cheerio.load(html);
  return $('p').toArray().filter(element => entryPattern.test($(element).text().replace(/\s+/g, ' ').trim())).length;
}

// currentHtml / previousHtml are null when NHL.com has not published that season's tracker page.
export function readTrackers({ year, currentHtml, previousHtml, teams, now = new Date() }) {
  const published = currentHtml != null;
  const quiet = isQuietPeriod(now);
  const entries = (published ? trackerEntryCount(currentHtml) : 0) + (previousHtml != null && (!published || quiet) ? trackerEntryCount(previousHtml) : 0);
  const current = published ? parseTrades(currentHtml, year, teams) : [];
  let previous = [];
  let parsed = current.length;
  if (previousHtml != null && (!published || quiet)) {
    previous = parseTrades(previousHtml, year - 1, teams);
    parsed += previous.length;
    // With the new tracker published, only the run-up to July 1 carries over.
    if (published) previous = previous.filter(trade => trade.date >= `${year}-${CARRYOVER_FROM}`);
  }
  const seen = new Set();
  const trades = [...current, ...previous].filter(trade => !seen.has(trade.id) && seen.add(trade.id)).sort((a, b) => b.date.localeCompare(a.date));
  const readYear = published ? year : year - 1;
  // Entries that all fail to parse mean the page changed, which must not look like a quiet day.
  if (entries > 0 && !parsed) throw new Error('The official tracker has entries but none could be read');
  if (!entries && !published && previousHtml == null) throw new Error('No official trade tracker is available');
  if (!entries && !quiet) throw new Error('The official tracker has no entries');
  return { season: `${readYear}–${String(readYear + 1).slice(-2)}`, trades, entries, skipped: Math.max(0, entries - parsed), fallback: !published, quiet, source: trackerUrl(readYear) };
}

export function playerStats(player, season) {
  const rows = (player.seasonTotals || []).filter(row => row.leagueAbbrev === 'NHL' && row.gameTypeId === 2 && row.season === season);
  const total = rows.find(row => ['TOT', 'Total'].includes(row.teamName?.default) || row.teamAbbrev === 'TOT');
  const stats = total || rows.reduce((sum, row) => {
    for (const key of ['gamesPlayed', 'goals', 'assists', 'points', 'wins', 'saves', 'shotsAgainst', 'goalsAgainst']) sum[key] = (sum[key] || 0) + (row[key] || 0);
    return sum;
  }, {});
  const goalieRows = total ? [total] : rows;
  const hasSaveTotals = goalieRows.length > 0 && goalieRows.every(row => Number.isFinite(row.shotsAgainst) && (Number.isFinite(row.saves) || Number.isFinite(row.goalsAgainst)));
  const shotsAgainst = goalieRows.reduce((sum, row) => sum + (row.shotsAgainst || 0), 0);
  const saves = goalieRows.reduce((sum, row) => sum + (row.saves ?? (row.shotsAgainst - row.goalsAgainst)), 0);
  const savePct = (goalieRows.length === 1 ? goalieRows[0].savePctg : null) ?? (hasSaveTotals && shotsAgainst > 0 ? saves / shotsAgainst : null);
  return {
    id: player.playerId, name: `${player.firstName.default} ${player.lastName.default}`, position: player.position,
    headshot: player.headshot, team: player.currentTeamAbbrev, season, hasStats: rows.length > 0,
    gamesPlayed: stats.gamesPlayed || 0, goals: stats.goals || 0, assists: stats.assists || 0, points: stats.points || 0,
    wins: stats.wins || 0, savePct,
  };
}

// A player counts as an NHL player when he has appeared in NHL regular-season or
// playoff games in the previous or current season, which covers players who are
// on an NHL roster and players who were just assigned to the minors.
export function hasRecentNhlGames(player, year = seasonStart()) {
  const earliest = (year - 1) * 10000 + year;
  return (player.seasonTotals || []).some(row => row.leagueAbbrev === 'NHL' && row.season >= earliest && (row.gamesPlayed || 0) > 0);
}
