export const FAVOURITES_KEY = 'puck-haul-favourites';

export function normalizePreferences(value) {
  return {
    teams: [...new Set(Array.isArray(value?.teams) ? value.teams.filter(team => typeof team === 'string' && /^[A-Z]{2,3}$/.test(team)) : [])].slice(0, 32),
    filter: value?.filter === 'favourites' ? 'favourites' : 'all',
  };
}

export function readPreferences(getStorage) {
  try {
    const raw = getStorage().getItem(FAVOURITES_KEY);
    let value;
    try { value = JSON.parse(raw); } catch { value = null; }
    return { preferences: normalizePreferences(value), unavailable: false };
  } catch {
    return { preferences: normalizePreferences(null), unavailable: true };
  }
}

export function savePreferences(getStorage, preferences) {
  try {
    getStorage().setItem(FAVOURITES_KEY, JSON.stringify(normalizePreferences(preferences)));
    return true;
  } catch { return false; }
}

export function filterFavouriteGames(games, teams) {
  const followed = new Set(teams);
  return games.filter(game => followed.has(game.home?.abbrev) || followed.has(game.away?.abbrev));
}
