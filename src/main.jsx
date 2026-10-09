import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, ArrowLeftRight, ArrowUpRight, CircleHelp, LayoutDashboard, CalendarDays, MoveRight, Sun, Moon, Menu, RefreshCw, Search, ShieldCheck, Trophy, X } from 'lucide-react';
import './styles.css';

const teamColors = { ANA: '#f47a38', BOS: '#efb92b', BUF: '#3688dc', CAR: '#e14755', CBJ: '#507bbb', CGY: '#eb5358', CHI: '#e04f55', COL: '#a2597b', DAL: '#35ad83', DET: '#ec4c59', EDM: '#f58a42', FLA: '#d19757', LAK: '#a5abb5', MIN: '#55a68c', MTL: '#e45b71', NJD: '#e44e59', NSH: '#e3b538', NYI: '#f47f43', NYR: '#468cdd', OTT: '#de615c', PHI: '#f88146', PIT: '#e4c552', SEA: '#62b5c7', SJS: '#40b2b0', STL: '#5599e4', TBL: '#5698e8', TOR: '#4d8dda', UTA: '#79b8d2', VAN: '#55a0d4', VGK: '#bfaa79', WPG: '#6d9ec7', WSH: '#dc5c6b' };
const teamStyle = team => ({ '--team-color': teamColors[team?.abbrev] || '#8b9aa8' });
const pickCount = text => (text.match(/round pick/gi) || []).length;
const sidePlayers = (trade, side) => side === 'to' ? trade.receivedPlayers ?? tradePlayerNames(trade.received) : trade.sentPlayers ?? tradePlayerNames(trade.sent);
function haulParts(text, players) {
  const parts = [];
  if (players.length) parts.push(`${players.length} ${players.length > 1 ? 'players' : 'player'}`);
  const picks = pickCount(text);
  if (picks) parts.push(`${picks} ${picks > 1 ? 'picks' : 'pick'}`);
  if (/consideration/i.test(text)) parts.push('considerations');
  return parts.length ? parts : ['other assets'];
}
const currentYear = new Date().getUTCFullYear() - (new Date().getUTCMonth() < 6 ? 1 : 0);
const seasonLabel = year => `${year}–${String(year + 1).slice(-2)}`;
const dateLabel = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
async function getJson(url, signal) {
  const response = await fetch(url, { signal });
  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(response.ok ? 'The source returned an unexpected response. Please try again.' : `The data request failed (${response.status}). Please try again.`);
  }
  if (!response.ok) throw new Error(data.error || 'Unable to load data. Try again.');
  return data;
}
function useData(url, version = 0) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    if (!url) {
      setState({ data: null, loading: false, error: '' });
      return () => controller.abort();
    }
    setState({ data: null, loading: true, error: '' });
    getJson(url, controller.signal).then(data => setState({ data, loading: false, error: '' })).catch(error => {
      if (error.name !== 'AbortError') setState({ data: null, loading: false, error: error.message });
    });
    return () => controller.abort();
  }, [url, version]);
  return state;
}
function usePlayersData(players, season, version = 0) {
  const ids = players.map(player => player?.id || '').join(',');
  const requestKey = `${ids}:${season}:${version}`;
  const [state, setState] = useState({ players: [], loading: false, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    const validPlayers = players.filter(player => player?.id);
    if (!validPlayers.length) {
      setState({ requestKey, players: [], loading: false, error: '', stale: false });
      return () => controller.abort();
    }
    setState({ requestKey, players: [], loading: true, error: '', stale: false });
    Promise.allSettled(validPlayers.map(player => getJson(`/api/players/${player.id}?season=${season}`, controller.signal)))
      .then(results => {
        if (controller.signal.aborted) return;
        const loaded = results.filter(result => result.status === 'fulfilled').map(result => result.value);
        const failed = results.flatMap((result, index) => result.status === 'rejected' ? [validPlayers[index].name] : []);
        setState({ requestKey, players: loaded.map(data => data.player), loading: false, stale: loaded.some(data => data.stale), error: failed.length ? `Stats unavailable for ${failed.join(', ')}. Please try again.` : '' });
      });
    return () => controller.abort();
  }, [ids, season, version]);
  return state.requestKey === requestKey ? state : { players: [], loading: Boolean(ids), error: '', stale: false };
}
function Logo({ team, size = 32, eager }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="team-fallback" style={{ width: size }}>{team.abbrev}</span> : <img className="team-logo" src={team.logo || `https://assets.nhle.com/logos/nhl/svg/${team.abbrev}_light.svg`} alt="" width={size} height={size} loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(true)} />;
}
function Status({ state, children }) {
  if (state.loading) return <div className="empty-state" role="status"><RefreshCw className="spin" size={19} /> Loading official NHL data…</div>;
  if (state.error) return <div className="empty-state error" role="alert"><CircleHelp size={21} /><span>{state.error}</span></div>;
  return <>{state.data?.stale && <div className="notice">Showing saved data from {new Date(state.data.fetchedAt).toLocaleString()}. The source is temporarily unavailable.</div>}{children}</>;
}
function PlayerPicker({ label, selected, onSelect, autoFocus }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setStatus(''); return; }
    const controller = new AbortController();
    setStatus('Searching…');
    const timer = setTimeout(() => {
      getJson(`/api/players/search?q=${encodeURIComponent(query.trim())}`, controller.signal).then(data => {
        setResults(data.players); setStatus(data.players.length ? '' : 'No players found.');
      }).catch(error => { if (error.name !== 'AbortError') setStatus('Search unavailable. Please try again.'); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  return <div className="player-picker"><label>{label}<div className="search-field"><Search size={15}/><input aria-label={label} autoFocus={autoFocus} value={query} placeholder={selected?.name || 'Search any NHL player'} onChange={e => setQuery(e.target.value)}/>{query && <button aria-label="Clear player search" onClick={() => setQuery('')}><X size={14}/></button>}</div></label>
    {query.trim().length >= 2 && <div className="search-results">{status && <p role="status">{status}</p>}{results.map(player => <button key={player.id} onClick={() => { onSelect(player); setQuery(''); setResults([]); }}><span>{player.name}</span><small>{player.team || 'NHL'} · {player.position}</small></button>)}</div>}
  </div>;
}
function tradePlayerNames(text = '') {
  let value = text.replace(/\.$/, '').trim();
  if (!value || /future considerations/i.test(value)) return [];
  value = value.split(/\s+and\s+(?:a|an)\s+(?:conditional\s+)?\d+(?:st|nd|rd|th)-round pick/i)[0];
  value = value.split(/\s*,?\s+(?:a|an)\s+(?:conditional\s+)?\d+(?:st|nd|rd|th)-round pick/i)[0];
  return value.replace(/\b(?:forwards?|defensemen?|defenseman|goaltenders?|goalies?|centers?|centre)\b/gi, '|').split('|')
    .flatMap(group => group.split(/\s+and\s+/i))
    .map(name => name.replace(/^(?:a|an)\s+/i, '').replace(/[\s,]+$/, '').trim())
    .filter(name => name && !/round pick|future considerations|consideration/i.test(name));
}
const skaterMetrics = [['gamesPlayed', 'Games played'], ['goals', 'Goals'], ['assists', 'Assists'], ['points', 'Points']];
const goalieMetrics = [['gamesPlayed', 'Games played'], ['wins', 'Wins'], ['savePct', 'Save percentage']];
const formatStat = (player, key) => !player?.hasStats || player[key] == null ? '—' : key === 'savePct' ? player[key].toFixed(3) : player[key];
function Comparison({ selectedTrade, version, onReset, onBrowseTrades, season, setSeason, focusPicker }) {
  const [shown, setShown] = useState(season);
  useEffect(() => setShown(season), [season]);
  const [chosen, setChosen] = useState(() => selectedTrade ? [selectedTrade.received, selectedTrade.sent].map(text => ({ name: tradePlayerNames(text)[0] || text, asset: !tradePlayerNames(text).length })) : [null, null]);
  const [packages, setPackages] = useState([[], []]);
  const [resolving, setResolving] = useState(Boolean(selectedTrade));
  const [resolveError, setResolveError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!selectedTrade) return;
    const controller = new AbortController();
    const texts = [selectedTrade.received, selectedTrade.sent];
    const names = [selectedTrade.receivedPlayers ?? tradePlayerNames(texts[0]), selectedTrade.sentPlayers ?? tradePlayerNames(texts[1])];
    const placeholders = names.map((side, index) => side.length ? side.map(name => ({ name })) : [{ name: texts[index] || 'Trade asset not specified', asset: true }]);
    setChosen(placeholders.map(side => side[0]));
    setPackages(placeholders);
    setResolving(true);
    setResolveError('');
    const normalize = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    Promise.all(placeholders.map(side => Promise.all(side.map(async player => {
      if (player.asset) return player;
      try {
        const data = await getJson('/api/players/search?q=' + encodeURIComponent(player.name), controller.signal);
        return data.players.find(p => normalize(p.name) === normalize(player.name)) || player;
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        return { ...player, searchError: true };
      }
    })))).then(sides => {
      if (controller.signal.aborted) return;
      setPackages(sides);
      setChosen(sides.map(side => side[0]));
      setResolving(false);
      if (sides.flat().some(p => p.searchError)) setResolveError('Some players could not be loaded.');
    }).catch(error => { if (error.name !== 'AbortError') { setResolving(false); setResolveError('Player search is unavailable.'); } });
    return () => controller.abort();
  }, [selectedTrade, attempt, version]);
  const allPlayers = [...chosen, ...packages.flat()];
  const uniquePlayers = [...new Map(allPlayers.filter(p => p?.id).map(p => [p.id, p])).values()];
  const stats = usePlayersData(uniquePlayers, shown, `${version}:${attempt}`);
  const statsById = new Map(stats.players.map(p => [String(p.id), p]));
  const players = chosen.map(p => p?.id ? statsById.get(String(p.id)) : null);
  const busy = resolving || stats.loading;
  useEffect(() => {
    if (!busy && stats.players.length && stats.players.every(p => !p.hasStats) && shown > currentYear - 2) setShown(shown - 1);
  }, [busy, stats.players, shown]);
  const mixed = players.every(Boolean) && players.some(p => p.position === 'G') && !players.every(p => p.position === 'G');
  const metrics = players.filter(Boolean).length && players.filter(Boolean).every(p => p.position === 'G') ? goalieMetrics : skaterMetrics;
  const sideTeams = selectedTrade ? [selectedTrade.to, selectedTrade.from] : players.map(p => ({ abbrev: p?.team }));
  const sideNames = selectedTrade ? [selectedTrade.to.name, selectedTrade.from.name] : ['Player one', 'Player two'];
  const needsPick = !selectedTrade && chosen.some(p => !p?.id);
  const skaterPoints = selectedTrade ? packages.map(side => { const found = side.map(p => statsById.get(String(p.id))).filter(p => p?.hasStats && p.position !== 'G'); return found.length ? found.reduce((sum, p) => sum + p.points, 0) : null; }) : [];
  const verdict = selectedTrade && !busy ? (() => {
    const [a, b] = skaterPoints;
    const [ta, tb] = [selectedTrade.to.abbrev, selectedTrade.from.abbrev];
    const haul = `${ta} get ${haulParts(selectedTrade.received, sidePlayers(selectedTrade, 'to')).join(' + ')}; ${tb} get ${haulParts(selectedTrade.sent, sidePlayers(selectedTrade, 'from')).join(' + ')}.`;
    if (a == null || b == null) return haul;
    return `${haul} ${a === b ? `Even on points, ${a} each` : `${a > b ? ta : tb} side leads on points, ${Math.max(a, b)} to ${Math.min(a, b)}`} in ${seasonLabel(shown)}.`;
  })() : '';
  return <section className="panel comparison" id="compare" aria-busy={busy}>
    <div className="section-heading"><div className="heading-icon"><ArrowLeftRight/><h2>Compare</h2></div><div className="comparison-actions">{selectedTrade && <button className="text-button" onClick={onReset}>Clear trade</button>}<label className="season-select"><span>Stats season</span><select aria-label="Player stats season" value={season} onChange={e => setSeason(Number(e.target.value))}>{[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{seasonLabel(y)}</option>)}</select></label></div></div>
    {selectedTrade ? <div className="trade-context"><button className="text-button back-link" onClick={onBrowseTrades}><ArrowLeft size={16}/>Trade wire</button><span><CalendarDays size={16}/>{dateLabel(selectedTrade.date)} trade</span><a href={selectedTrade.source} target="_blank" rel="noreferrer">View announcement <ArrowUpRight size={16}/></a></div> : <p className="section-description">Search for two players, or open a trade from the wire.</p>}
    {verdict && <p className="verdict">{verdict}</p>}
    <div className="comparison-layout"><div className="matchup-workspace">
      <div className="picker-row">{chosen.map((player, index) => <PlayerPicker key={index} autoFocus={focusPicker && !selectedTrade && index === 0} label={index === 0 ? 'Player one' : 'Player two'} selected={player} onSelect={p => setChosen(old => old.map((value, i) => i === index ? p : value))}/>)}</div>
      <div className="player-matchup">{chosen.map((player, index) => <div className={'player-profile' + (player?.asset ? ' asset-profile' : '')} key={index} style={teamStyle(sideTeams[index])}>
        <div className="player-details"><span>{player?.asset ? 'Trade return' : players[index]?.team ? `${players[index].team} / ${players[index].position}` : resolving ? 'Finding player…' : player?.id ? 'NHL player' : selectedTrade ? 'Player record unavailable' : 'Choose a player'}</span><h3>{player?.name || '—'}</h3><small>{player?.asset ? 'Non-player asset' : players[index]?.team ? 'Current team' : 'Selected player'}</small></div>
        {players[index]?.headshot && !busy ? <img className="headshot" src={players[index].headshot} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden'; }}/> : <div className="profile-symbol" aria-hidden="true"><ArrowLeftRight size={32}/></div>}
      </div>)}<span className="versus">vs</span></div>
      {needsPick ? <div className="empty-state compact" role="status">Pick both players above to compare their {seasonLabel(season)} numbers.</div> : busy ? <div className="empty-state compact" role="status"><RefreshCw className="spin" size={18}/>Loading player stats…</div> : mixed ? <div className="notice">Choose two skaters or two goalies to compare the same statistics.{selectedTrade ? ' Individual numbers are shown in the trade package.' : ''}</div> : <div className="stat-comparison">{metrics.map(([key, label]) => {
        const values = players.map(p => p?.hasStats ? p[key] : null);
        const comparable = values.every(v => v != null);
        const max = Math.max(...values.filter(v => v != null), 1);
        return <div className="stat-row" key={key}><div className="stat-value left" style={teamStyle(sideTeams[0])}><strong className={comparable && values[0] > values[1] ? 'stat-winner' : ''}>{formatStat(players[0], key)}{comparable && values[0] > values[1] && <span className="sr-only"> (higher)</span>}</strong><i aria-hidden="true" style={{ width: `${(values[0] ?? 0) / max * 100}%` }}/></div><span>{label}</span><div className="stat-value right" style={teamStyle(sideTeams[1])}><strong className={comparable && values[1] > values[0] ? 'stat-winner' : ''}>{formatStat(players[1], key)}{comparable && values[1] > values[0] && <span className="sr-only"> (higher)</span>}</strong><i aria-hidden="true" style={{ width: `${(values[1] ?? 0) / max * 100}%` }}/></div></div>;
      })}</div>}
      {!busy && shown !== season && <p className="comparison-message">No NHL games recorded in {seasonLabel(season)} for these players, so this shows {seasonLabel(shown)}.</p>}
      {!busy && !needsPick && players.some(p => p && !p.hasStats) && <p className="comparison-message">No NHL regular-season stats for {players.filter(p => p && !p.hasStats).map(p => p.name).join(' and ')} in {seasonLabel(shown)}. Prospects, new signings and non-NHL players show “—”.</p>}
    </div><div className="package-workspace"><h3>{selectedTrade ? 'The complete trade' : 'How it works'}</h3>{selectedTrade ? <>
      {packages.map((side, index) => <div className="trade-package" key={index} style={teamStyle(index === 0 ? selectedTrade.to : selectedTrade.from)}><div className="package-team"><Logo team={index === 0 ? selectedTrade.to : selectedTrade.from} size={30}/><h4>{sideNames[index]}<span>gets</span></h4></div><HaulBadges text={index === 0 ? selectedTrade.received : selectedTrade.sent} players={sidePlayers(selectedTrade, index === 0 ? 'to' : 'from')}/><p className="package-description">{index === 0 ? selectedTrade.received : selectedTrade.sent}</p>{side.filter(p => !p.asset).map(player => {
        const stat = statsById.get(String(player.id));
        const metrics = stat?.position === 'G' ? [['gamesPlayed', 'GP'], ['wins', 'W'], ['savePct', 'SV%']] : [['gamesPlayed', 'GP'], ['goals', 'G'], ['assists', 'A'], ['points', 'PTS']];
        return <article className="trade-player-card" key={player.name}><strong>{player.name}</strong>{player.id ? <div className="trade-player-card-stats">{metrics.map(([key, label]) => <span key={key}><b>{busy ? '…' : formatStat(stat, key)}</b>{label}</span>)}</div> : <small>{resolving ? 'Finding player…' : 'No NHL player record available'}</small>}</article>;
      })}</div>)}
    </> : <div className="comparison-guide"><ArrowLeftRight size={40}/><p>Every player. Both sides.</p><span>Open a trade from the wire to see every player’s numbers, draft picks and other assets in one place.</span><button className="text-button" onClick={onBrowseTrades}>Browse the trade wire <MoveRight size={18}/></button></div>}</div></div>
    {resolveError && <div className="notice" role="alert">{resolveError}<button className="text-button" onClick={() => setAttempt(v => v + 1)}>Try again</button></div>}
    {stats.error && <div className="notice" role="alert">{stats.error}<button className="text-button" onClick={() => setAttempt(v => v + 1)}>Try again</button></div>}
    {stats.stale && <div className="notice">Saved player stats shown; NHL is temporarily unavailable.</div>}
    <div className="panel-foot"><span>Regular season · All teams combined</span>{selectedTrade ? <button className="text-button" onClick={onBrowseTrades}>Compare another trade <MoveRight size={15}/></button> : <a href="https://www.nhl.com/stats/" target="_blank" rel="noreferrer">NHL stats <ArrowUpRight size={15}/></a>}</div>
  </section>;
}
function HaulBadges({ text, players }) {
  return <ul className="haul" aria-label="Assets">{haulParts(text, players).map(part => <li key={part}>{part}</li>)}</ul>;
}
function TradeSide({ team, text, players, large }) {
  return <div className="trade-side" style={teamStyle(team)}><div className="trade-team"><Logo team={team} size={large ? 64 : 40} eager={large}/><div><span className="gets-label">gets</span><h3>{team.name}</h3></div></div><HaulBadges text={text} players={players}/><p>{text}</p></div>;
}
function LatestTrade({ trade, onCompare }) {
  return <section className="panel latest-trade"><h2 className="sr-only">Latest trade</h2><div className="latest-head"><span>Latest trade · <time dateTime={trade.date}>{dateLabel(trade.date)}</time></span><a href={trade.source} target="_blank" rel="noreferrer">NHL.com <ArrowUpRight size={14}/></a></div>
    <div className="trade-sides large"><TradeSide large team={trade.to} text={trade.received} players={sidePlayers(trade, 'to')}/><TradeSide large team={trade.from} text={trade.sent} players={sidePlayers(trade, 'from')}/><span className="trade-direction" aria-hidden="true"><ArrowLeftRight size={20}/></span></div>
    <div className="latest-foot"><button className="primary-button" onClick={() => onCompare(trade)}>Compare this trade<MoveRight size={18}/></button></div></section>;
}
function TradeWire({ trades, filtered, query, setQuery, selectedTrade, onCompare, full, onViewAll, skipFirst }) {
  const list = skipFirst ? filtered.slice(1) : filtered;
  const visible = full ? list : list.slice(0, 4);
  return <section className="panel trades-panel" id="trade-wire"><div className="section-heading"><div className="heading-icon"><h2>Trade wire</h2>{trades.data && <span className="count">{filtered.length} since July 1</span>}</div><span className="verified-label" title="Every trade is read from the official NHL.com trade tracker."><ShieldCheck size={15}/>Official NHL tracker</span></div>
    <div className="trade-toolbar"><div className="search-field"><Search size={18}/><input aria-label="Search trades" placeholder="Search players or teams" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button aria-label="Clear trade search" onClick={() => setQuery('')}><X size={18}/></button>}</div><span className="sort-label">Newest first</span></div>
    <div className="trade-feed"><Status state={trades}>{filtered.length === 0 && !trades.loading && <div className="empty-state">No trades match this search.<button className="text-button" onClick={() => setQuery('')}>Clear search</button></div>}
      {visible.map(trade => <article className={'trade-item' + (selectedTrade?.id === trade.id ? ' selected' : '')} key={trade.id}><div className="trade-meta"><time dateTime={trade.date}>{dateLabel(trade.date)}</time><a href={trade.source} target="_blank" rel="noreferrer">NHL.com <ArrowUpRight size={14}/></a></div>
        <div className="trade-sides"><TradeSide team={trade.to} text={trade.received} players={sidePlayers(trade, 'to')}/><TradeSide team={trade.from} text={trade.sent} players={sidePlayers(trade, 'from')}/><span className="trade-direction" aria-hidden="true"><ArrowLeftRight size={18}/></span></div>
        <button className="compare-link" aria-current={selectedTrade?.id === trade.id ? 'true' : undefined} onClick={() => onCompare(trade)}>Compare trade<MoveRight size={18}/></button></article>)}
    </Status></div>
    {!full && list.length > 4 && <button className="show-more" onClick={onViewAll}>View all {filtered.length} trades<MoveRight size={16}/></button>}
    <div className="panel-foot"><span>Updates every 5 minutes</span><a href={trades.data?.source || 'https://www.nhl.com/news/topic/trade-coverage/'} target="_blank" rel="noreferrer">Trade tracker<ArrowUpRight size={15}/></a></div>
  </section>;
}
function StandingsPanel({ standings, teams, rows, conference, setConference, full, onViewAll }) {
  return <section className="panel standings-panel" id="league-standings"><div className="section-heading"><div className="heading-icon"><h2>Standings</h2></div><span className="quiet-label">{standings.data?.season ? seasonLabel(Math.floor(standings.data.season / 10000)) : seasonLabel(currentYear)}</span></div>
    <div className="segmented" aria-label="Standings conference">{['All', 'Eastern', 'Western'].map(c => <button aria-pressed={conference === c} className={conference === c ? 'selected' : ''} key={c} onClick={() => setConference(c)}>{c === 'All' ? 'League' : c}</button>)}</div>
    {teams.length > 0 && teams.every(t => t.gamesPlayed === 0) && <p className="preseason-note">Regular-season points start at zero.</p>}
    <Status state={standings}><div className="standings-scroll" tabIndex="0" role="region" aria-label="Scrollable league standings"><table><caption className="sr-only">{conference === 'All' ? 'League' : conference} standings: games played, wins, losses, overtime losses, and points.</caption><thead><tr><th scope="col">#</th><th scope="col">Team</th><th scope="col">GP<span className="sr-only"> (games played)</span></th><th scope="col">W–L–OT</th><th scope="col">PTS<span className="sr-only"> (points)</span></th></tr></thead><tbody>{rows.map((t, i) => <tr key={t.abbrev}><td>{i + 1}</td><th scope="row"><Logo team={t} size={28}/><span aria-hidden="true">{t.abbrev}</span><span className="sr-only">{t.name}</span></th><td>{t.gamesPlayed}</td><td>{t.wins}–{t.losses}–{t.otLosses}</td><td className="points">{t.points}</td></tr>)}</tbody></table></div></Status>
    <div className="panel-foot">{!full && <button className="text-button" onClick={onViewAll}>View standings <MoveRight size={15}/></button>}<span>{standings.data?.date ? `As of ${dateLabel(standings.data.date)}` : 'Regular season'}</span><a href="https://www.nhl.com/standings" target="_blank" rel="noreferrer">NHL.com<ArrowUpRight size={15}/></a></div>
  </section>;
}
const viewFromHash = () => window.location.hash.startsWith('#trades') ? 'Trades' : window.location.hash === '#standings' ? 'Standings' : 'Home';
const tradeTabFromHash = () => window.location.hash.startsWith('#trades/') ? 'compare' : 'wire';
const tradeIdFromHash = () => { const match = window.location.hash.match(/^#trades\/(.+)$/); return match && match[1] !== 'compare' ? decodeURIComponent(match[1]) : null; };
function App() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#141517' : '#f4f5f6');
    try { localStorage.setItem('puck-haul-theme', theme); } catch { /* Theme still works when storage is unavailable. */ }
  }, [theme]);
  const [version, setVersion] = useState(0);
  const [season, setSeason] = useState(currentYear);
  const trades = useData('/api/trades', version);
  const standings = useData('/api/standings', version);
  const [query, setQuery] = useState('');
  const [conference, setConference] = useState('All');
  const [selectedId, setSelectedId] = useState(tradeIdFromHash);
  const [active, setActive] = useState(viewFromHash);
  const [tradeTab, setTradeTab] = useState(tradeTabFromHash);
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusPicker, setFocusPicker] = useState(false);
  useEffect(() => { const timer = setInterval(() => setVersion(v => v + 1), 300_000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const onHashChange = () => { setActive(viewFromHash()); setTradeTab(tradeTabFromHash()); if (window.location.hash.startsWith('#trades/')) setSelectedId(tradeIdFromHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => {
    const escape = e => { if (e.key === 'Escape') { setMenuOpen(false); document.querySelector('.menu-toggle')?.focus(); } };
    if (menuOpen) window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [menuOpen]);
  const teams = standings.data?.teams || [];
  const allTrades = trades.data?.trades || [];
  const selectedTrade = selectedId ? allTrades.find(t => t.id === selectedId) || null : null;
  const filtered = allTrades.filter(t => `${t.to.name} ${t.from.name} ${t.received} ${t.sent}`.toLowerCase().includes(query.toLowerCase()));
  const rows = teams.filter(t => conference === 'All' || t.conference === conference);
  const navigate = (name, tab = 'wire', id = null, focus = false) => {
    setFocusPicker(focus);
    setActive(name); setTradeTab(tab); setMenuOpen(false);
    if (tab === 'compare') setSelectedId(id);
    window.location.hash = name === 'Home' ? 'home' : name === 'Trades' && tab === 'compare' ? (id ? `trades/${encodeURIComponent(id)}` : 'trades/compare') : name.toLowerCase();
    window.scrollTo(0, 0);
  };
  const navItems = [['Home', LayoutDashboard], ['Trades', ArrowLeftRight], ['Standings', Trophy]];
  const compareTrade = trade => navigate('Trades', 'compare', trade.id);
  const loading = trades.loading || standings.loading;
  const healthy = trades.data && standings.data && !trades.data.stale && !standings.data.stale;
  const checked = trades.data?.fetchedAt ? new Date(trades.data.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  const comparison = <Comparison key={selectedTrade?.id || 'manual'} selectedTrade={selectedTrade} version={version} season={season} setSeason={setSeason} focusPicker={focusPicker} onReset={() => navigate('Trades', 'compare', null)} onBrowseTrades={() => navigate('Trades')}/>;
  const pendingTrade = tradeTab === 'compare' && selectedId && !selectedTrade;
  return <div className="app-shell"><a className="skip-link" href="#dashboard">Skip to dashboard</a><header className="topbar">
    <a className="brand" href="#home" aria-label="Puck Haul home (alpha)" onClick={e => { e.preventDefault(); navigate('Home'); }}>puck haul<span className="alpha-tag" title="Puck Haul is in alpha. Features and data may change.">Alpha</span></a>
    <button className="menu-toggle" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-controls="main-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X/> : <Menu/>}</button>
    <nav id="main-navigation" className={menuOpen ? 'mobile-open' : ''} aria-label="Main navigation">{navItems.map(([name, Icon]) => <button key={name} aria-current={active === name ? 'page' : undefined} className={active === name ? 'active' : ''} onClick={() => navigate(name)}><Icon size={20}/>{name}</button>)}</nav>
    <button className="theme-toggle" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}<span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button>
  </header><main id="dashboard"><div className="workspace-bar"><span>NHL / {seasonLabel(currentYear)}</span><span className={'sync-status' + (healthy ? ' healthy' : '')}><i/>{loading ? 'Checking sources' : healthy ? `Data up to date${checked ? ` · checked ${checked}` : ''}` : 'Check source status'}</span></div>
    <div className="page-heading"><h1>{active === 'Home' ? 'The trade desk.' : active}</h1><button className="refresh-button" onClick={() => setVersion(v => v + 1)} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''}/>Refresh data</button></div>
    {active === 'Home' && <>
      {allTrades[0] && <LatestTrade trade={allTrades[0]} onCompare={compareTrade}/>}
      <div className="dashboard-grid"><TradeWire trades={trades} filtered={filtered} query={query} setQuery={setQuery} selectedTrade={selectedTrade} onCompare={compareTrade} skipFirst={!query && allTrades.length > 0} onViewAll={() => navigate('Trades')}/><StandingsPanel standings={standings} teams={teams} rows={rows} conference={conference} setConference={setConference} onViewAll={() => navigate('Standings')}/></div>
    </>}
    {active === 'Trades' && <div className="trades-page"><div className="trade-tabs" aria-label="Trades views"><button aria-pressed={tradeTab === 'wire'} className={tradeTab === 'wire' ? 'selected' : ''} onClick={() => navigate('Trades')}>Trade wire</button><button aria-pressed={tradeTab === 'compare'} className={tradeTab === 'compare' ? 'selected' : ''} onClick={() => navigate('Trades', 'compare', selectedId, true)}>Compare</button></div>{tradeTab === 'wire' ? <TradeWire trades={trades} filtered={filtered} query={query} setQuery={setQuery} selectedTrade={selectedTrade} onCompare={compareTrade} full/> : pendingTrade && trades.loading ? <div className="panel"><Status state={trades}/></div> : <>{pendingTrade && <div className="notice" role="status">That trade is no longer on the wire. You can still compare any two players.</div>}{comparison}</>}</div>}
    {active === 'Standings' && <div className="standings-page"><StandingsPanel standings={standings} teams={teams} rows={rows} conference={conference} setConference={setConference} full/></div>}
    <footer><span>Built by Jesse Little · Puck Haul is in alpha, so features and data may change.</span><a href="https://studiolittle.ca" target="_blank" rel="noreferrer">studiolittle.ca <ArrowUpRight size={15}/></a></footer>
  </main></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
