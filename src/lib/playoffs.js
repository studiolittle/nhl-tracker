const validWins = value => Number.isInteger(value) && value >= 0 && value <= 4;
const validRound = value => Number.isInteger(value) && value >= 1 && value <= 4;
const confirmedTeam = team => team && Number.isInteger(team.id) && team.id > 0;
const teamLabel = team => team?.name || team?.abbrev || 'Team';

function winnerOf(series) {
  const teams = [series?.topSeedTeam, series?.bottomSeedTeam];
  const officialWinner = teams.find(team => confirmedTeam(team) && team.id === series?.winningTeamId);
  if (officialWinner) return officialWinner;
  const top = series?.topSeedWins;
  const bottom = series?.bottomSeedWins;
  if (!validWins(top) || !validWins(bottom)) return null;
  // Four wins settles a best-of-seven series even if the feed has not yet
  // populated winningTeamId. Conflicting or incomplete totals stay pending.
  if (top === 4 && bottom < 4 && confirmedTeam(teams[0])) return teams[0];
  if (bottom === 4 && top < 4 && confirmedTeam(teams[1])) return teams[1];
  return null;
}

export function selectPlayoffSeries(series) {
  const confirmed = (Array.isArray(series) ? series : []).filter(item =>
    validRound(item?.round) && confirmedTeam(item.topSeedTeam) && confirmedTeam(item.bottomSeedTeam));
  const unfinished = confirmed.filter(item => !winnerOf(item));
  const latestRound = Math.max(0, ...confirmed.map(item => item.round));
  const selected = unfinished.length ? unfinished : confirmed.filter(item => item.round === latestRound);
  return [...selected].sort((a, b) => a.round - b.round || String(a.id ?? '').localeCompare(String(b.id ?? '')));
}

export function playoffRoundLabel(round) {
  return { 1: 'First round', 2: 'Second round', 3: 'Conference finals', 4: 'Stanley Cup Final' }[round] || 'Stanley Cup Playoffs';
}

export function playoffSeriesStatus(series) {
  const winner = winnerOf(series);
  if (winner) return `${teamLabel(winner)} ${series.round === 4 ? 'wins the Stanley Cup' : 'advances'}`;
  const top = series?.topSeedWins;
  const bottom = series?.bottomSeedWins;
  if (!validWins(top) || !validWins(bottom) || (top === 4 && bottom === 4)) return 'Series result pending';
  if (top === 0 && bottom === 0) return 'Series not started';
  if (top === bottom) return `Series tied ${top}–${bottom}`;
  const leader = top > bottom ? series.topSeedTeam : series.bottomSeedTeam;
  if (!confirmedTeam(leader)) return 'Series result pending';
  return `${leader.abbrev || teamLabel(leader)} leads ${Math.max(top, bottom)}–${Math.min(top, bottom)}`;
}
