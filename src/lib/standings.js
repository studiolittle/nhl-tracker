// Playoff seeding labels from the NHL's own sequence fields. Order is never recomputed from points or rank:
// wildcardSequence 0 = top three in a division, 1 and 2 = wild cards, 3 and above = outside the playoff places.
const letters = { Atlantic: 'A', Metropolitan: 'M', Central: 'C', Pacific: 'P' };
const ordinals = ['', 'first', 'second', 'third'];
const wholeNumber = value => Number.isInteger(value) && value >= 0;
const inConference = (teams, conference) => teams.filter(team => conference === 'All' || team.conference === conference);
const bySequence = key => (a, b) => a[key] - b[key]; // Array sort is stable, so equal values keep the feed's order.

export const noGamesYet = teams => teams.length > 0 && teams.every(team => team.gamesPlayed === 0);
export const hasSeeding = teams => teams.length > 0 && teams.every(team => wholeNumber(team.wildcardSequence) && wholeNumber(team.divisionSequence) && team.division);
export const gamesDiffer = teams => new Set(teams.map(team => team.gamesPlayed)).size > 1;

export function seedLabel(team) {
  const { wildcardSequence: wild, divisionSequence: place, division } = team;
  if (wild === 0) return { group: 'division', tag: `${letters[division] || division[0]}${place}`, phrase: `${ordinals[place] || `number ${place}`} in the ${division} Division` };
  if (wild === 1 || wild === 2) return { group: 'wildcard', tag: `WC${wild}`, phrase: `${ordinals[wild]} wild card` };
  return { group: 'out', tag: '', phrase: 'outside the playoff places' };
}

// Conference order with the playoff places first, as the NHL seeds them. League order is the feed's order.
export function conferenceRows(teams, conference) {
  const rows = inConference(teams, conference);
  const inPlayoffs = team => team.wildcardSequence <= 2;
  return conference === 'All' ? rows : [...rows].sort((a, b) => Number(!inPlayoffs(a)) - Number(!inPlayoffs(b)) || a.conferenceSequence - b.conferenceSequence);
}

const divisionNames = rows => [...new Set(rows.map(team => team.division))].sort();
const entry = team => ({ team, seed: seedLabel(team) });

// Wild card view: each division's top three, then the two wild cards, then everyone else.
// Returns null when there is nothing honest to show (League view, no games played, or a missing sequence).
export function wildCardGroups(teams, conference) {
  const rows = inConference(teams, conference);
  if (conference === 'All' || noGamesYet(rows) || !hasSeeding(rows)) return null;
  return [
    ...divisionNames(rows).map(division => ({ key: division, label: `${division} Division`, entries: rows.filter(team => team.division === division && team.wildcardSequence === 0).sort(bySequence('divisionSequence')).map(entry) })),
    { key: 'wildcard', label: 'Wild card', entries: rows.filter(team => team.wildcardSequence === 1 || team.wildcardSequence === 2).sort(bySequence('wildcardSequence')).map(entry) },
    { key: 'out', label: 'Out', entries: rows.filter(team => team.wildcardSequence >= 3).sort(bySequence('wildcardSequence')).map(entry) },
  ].filter(group => group.entries.length);
}

// Division view: every team under its division in division order, wild cards still marked.
export function divisionGroups(teams, conference) {
  const rows = inConference(teams, conference);
  if (conference === 'All' || noGamesYet(rows) || !hasSeeding(rows)) return null;
  return divisionNames(rows).map(division => ({ key: division, label: `${division} Division`, entries: rows.filter(team => team.division === division).sort(bySequence('divisionSequence')).map(entry) }));
}
