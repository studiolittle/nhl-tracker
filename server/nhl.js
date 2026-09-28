import * as cheerio from 'cheerio';

export function seasonStart(date = new Date()) {
  return date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}
export function trackerUrl(year = seasonStart()) {
  return `https://www.nhl.com/news/topic/trade-coverage/${year}-${String(year + 1).slice(-2)}-nhl-trades`;
}

export function parseTrades(html, year, teams) {
  const $ = cheerio.load(html);
  const trades = [];
  $('p').each((_, element) => {
    const text = $(element).text().replace(/\s+/g, ' ').trim();
    const match = text.match(/^([A-Z]+) (\d{1,2}):\s*(.+?) acquire (.+?) from (?:the )?(.+?) (?:for|in exchange for) (.+?)(?:\s*\||$)/);
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
    trades.push({ id: `${date}-${trades.length}`, date, to: findTeam(to), from: findTeam(from), received, sent: sent.replace(/\.$/, ''), source });
  });
  return trades.sort((a, b) => b.date.localeCompare(a.date));
}

export function playerStats(player, season) {
  const rows = (player.seasonTotals || []).filter(row => row.leagueAbbrev === 'NHL' && row.gameTypeId === 2 && row.season === season);
  const total = rows.find(row => ['TOT', 'Total'].includes(row.teamName?.default) || row.teamAbbrev === 'TOT');
  const stats = total || rows.reduce((sum, row) => {
    for (const key of ['gamesPlayed', 'goals', 'assists', 'points', 'wins', 'saves', 'shotsAgainst', 'goalsAgainst']) sum[key] = (sum[key] || 0) + (row[key] || 0);
    return sum;
  }, {});
  return {
    id: player.playerId, name: `${player.firstName.default} ${player.lastName.default}`, position: player.position,
    headshot: player.headshot, team: player.currentTeamAbbrev, season, hasStats: rows.length > 0,
    gamesPlayed: stats.gamesPlayed || 0, goals: stats.goals || 0, assists: stats.assists || 0, points: stats.points || 0,
    wins: stats.wins || 0, savePct: stats.savePctg ?? (stats.shotsAgainst ? stats.saves / stats.shotsAgainst : null),
  };
}
