// Rights references and Ottawa territory notes: docs/seasonal-home-research.md.
const networkNames = { SN: 'Sportsnet', SNE: 'Sportsnet East', SNO: 'Sportsnet Ontario', SNW: 'Sportsnet West', SNP: 'Sportsnet Pacific', SN1: 'Sportsnet One', SN360: 'Sportsnet 360', 'SN+': 'Sportsnet+', TVAS: 'TVA Sports', TVAS2: 'TVA Sports 2', RDSI: 'RDS Info', NHLN: 'NHL Network', Prime: 'Prime Video', PRIME: 'Prime Video', 'Amazon Prime': 'Prime Video' };
const streaming = new Set(['Prime', 'PRIME', 'Prime Video', 'Amazon Prime', 'SN+', 'Sportsnet+', 'ESPN+', 'Hulu', 'Victory+', 'MNMT+']);
const ottawaTeams = new Set(['OTT', 'MTL']);
export const broadcastGuide = 'https://www.nhl.com/info/watch-nhl-zipcode-blackout-lookup';
export const outOfMarketGuide = 'https://support.sportsnetplus.ca/hc/en-gb/articles/46382278933780-Are-there-NHL-regional-blackouts-on-Sportsnet';
export function getBroadcasts(game, region = 'ottawa') {
  const country = region === 'us' ? 'US' : 'CA';
  const listings = (game.tvBroadcasts || []).filter(b => b.countryCode === country);
  const localGame = [game.home?.abbrev, game.away?.abbrev].some(t => ottawaTeams.has(t));
  const hasRegional = listings.some(b => b.market === 'H' || b.market === 'A');
  const accepted = listings.filter(b => region !== 'ottawa' || (
    (b.market === 'N' && !(localGame && hasRegional && ['SN+', 'Sportsnet+'].includes(b.network))) ||
    (b.market === 'H' && ottawaTeams.has(game.home?.abbrev)) ||
    (b.market === 'A' && ottawaTeams.has(game.away?.abbrev))
  ));
  const channels = [...new Map(accepted.map(b => {
    const name = networkNames[b.network] || b.network;
    return [name, { name, streaming: streaming.has(b.network), french: /^(RDS|TVAS)/.test(b.network), national: b.market === 'N' }];
  })).values()];
  // A US regional Prime feed is NOT a Canadian exclusive. Require the national
  // Canadian listing and the confirmed 2026–2038 Canadian rights period.
  const exclusivePrime = country === 'CA' && game.season >= 20262027 && game.season <= 20372038 && listings.length > 0 && listings.every(b => b.market === 'N' && /^(Prime|PRIME|Prime Video|Amazon Prime)$/.test(b.network));
  const onlyStreaming = channels.length > 0 && channels.every(c => c.streaming);
  return { channels, exclusivePrime, onlyStreaming, regional: channels.some(c => !c.national),
    unavailable: !channels.length,
    outOfMarket: region === 'ottawa' && !localGame && !channels.length,
    excludedRegional: region === 'ottawa' && accepted.length < listings.length,
  };
}
