// The 32 NHL clubs for 2026-27, so trade names and abbreviations do not depend on the standings feed.
// Names match the NHL's own (Montréal has its accent; parseTrades compares names without accents). Update when a club is added or renamed.
export const NHL_TEAMS = [
  ['ANA', 'Anaheim Ducks'], ['BOS', 'Boston Bruins'], ['BUF', 'Buffalo Sabres'], ['CAR', 'Carolina Hurricanes'],
  ['CBJ', 'Columbus Blue Jackets'], ['CGY', 'Calgary Flames'], ['CHI', 'Chicago Blackhawks'], ['COL', 'Colorado Avalanche'],
  ['DAL', 'Dallas Stars'], ['DET', 'Detroit Red Wings'], ['EDM', 'Edmonton Oilers'], ['FLA', 'Florida Panthers'],
  ['LAK', 'Los Angeles Kings'], ['MIN', 'Minnesota Wild'], ['MTL', 'Montréal Canadiens'], ['NJD', 'New Jersey Devils'],
  ['NSH', 'Nashville Predators'], ['NYI', 'New York Islanders'], ['NYR', 'New York Rangers'], ['OTT', 'Ottawa Senators'],
  ['PHI', 'Philadelphia Flyers'], ['PIT', 'Pittsburgh Penguins'], ['SEA', 'Seattle Kraken'], ['SJS', 'San Jose Sharks'],
  ['STL', 'St. Louis Blues'], ['TBL', 'Tampa Bay Lightning'], ['TOR', 'Toronto Maple Leafs'], ['UTA', 'Utah Mammoth'],
  ['VAN', 'Vancouver Canucks'], ['VGK', 'Vegas Golden Knights'], ['WPG', 'Winnipeg Jets'], ['WSH', 'Washington Capitals'],
].map(([abbrev, name]) => ({ abbrev, name }));
