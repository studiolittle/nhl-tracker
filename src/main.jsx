import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeftRight, ArrowUpRight, ChevronDown, CircleHelp, LayoutDashboard, CalendarDays, MoveRight, Sun, Moon, Menu, RefreshCw, Search, ShieldCheck, Trophy, X } from 'lucide-react';
import './styles.css';

const teamColors = { ANA: '#f47a38', BOS: '#efb92b', BUF: '#3688dc', CAR: '#e14755', CBJ: '#507bbb', CGY: '#eb5358', CHI: '#e04f55', COL: '#a2597b', DAL: '#35ad83', DET: '#ec4c59', EDM: '#f58a42', FLA: '#d19757', LAK: '#a5abb5', MIN: '#55a68c', MTL: '#e45b71', NJD: '#e44e59', NSH: '#e3b538', NYI: '#f47f43', NYR: '#468cdd', OTT: '#de615c', PHI: '#f88146', PIT: '#e4c552', SEA: '#62b5c7', SJS: '#40b2b0', STL: '#5599e4', TBL: '#5698e8', TOR: '#4d8dda', UTA: '#79b8d2', VAN: '#55a0d4', VGK: '#bfaa79', WPG: '#6d9ec7', WSH: '#dc5c6b' };
const teamStyle = team => ({ '--team-color': teamColors[team?.abbrev] || '#8b9aa8' });
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
function Logo({ team, size = 32 }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="team-fallback" style={{ width: size }}>{team.abbrev}</span> : <img className="team-logo" src={team.logo || `https://assets.nhle.com/logos/nhl/svg/${team.abbrev}_light.svg`} alt="" width={size} height={size} onError={() => setFailed(true)} />;
}
function Status({ state, children }) {
  if (state.loading) return <div className="empty-state"><RefreshCw className="spin" size={19} /> Loading official NHL data…</div>;
  if (state.error) return <div className="empty-state error"><CircleHelp size={21} /><span>{state.error}</span></div>;
  return <>{state.data?.stale && <div className="notice">Showing saved data from {new Date(state.data.fetchedAt).toLocaleString()}. The source is temporarily unavailable.</div>}{children}</>;
}
function PlayerPicker({ label, selected, onSelect }) {
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
  return <div className="player-picker"><label>{label}<div className="search-field"><Search size={15}/><input aria-label={label} value={query} placeholder={selected?.name || 'Search any NHL player'} onChange={e => setQuery(e.target.value)}/>{query && <button aria-label="Clear player search" onClick={() => setQuery('')}><X size={14}/></button>}</div></label>
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
const defaultPlayers = [{ id: 8478420, name: 'Mikko Rantanen' }, { id: 8482702, name: 'Logan Stankoven' }];
const skaterMetrics = [['gamesPlayed', 'Games played'], ['goals', 'Goals'], ['assists', 'Assists'], ['points', 'Points']];
const goalieMetrics = [['gamesPlayed', 'Games played'], ['wins', 'Wins'], ['savePct', 'Save percentage']];
const formatStat = (player, key) => !player?.hasStats || player[key] == null ? '—' : key === 'savePct' ? player[key].toFixed(3) : player[key];
function Comparison({ selectedTrade, version, onReset, season, setSeason }) {
  const [chosen, setChosen] = useState(() => selectedTrade ? [selectedTrade.received, selectedTrade.sent].map(text => ({ name: tradePlayerNames(text)[0] || text, asset: !tradePlayerNames(text).length })) : defaultPlayers);
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
  const stats = usePlayersData(uniquePlayers, season, `${version}:${attempt}`);
  const statsById = new Map(stats.players.map(p => [String(p.id), p]));
  const players = chosen.map(p => p?.id ? statsById.get(String(p.id)) : null);
  const busy = resolving || stats.loading;
  const mixed = players.every(Boolean) && players.some(p => p.position === 'G') && !players.every(p => p.position === 'G');
  const metrics = players.filter(Boolean).length && players.filter(Boolean).every(p => p.position === 'G') ? goalieMetrics : skaterMetrics;
  const sideNames = selectedTrade ? [selectedTrade.to.name, selectedTrade.from.name] : ['Player one', 'Player two'];
  return <section className="panel comparison" id="compare" aria-busy={busy}>
    <div className="section-heading"><div className="heading-icon"><ArrowLeftRight/><h2>Player comparison</h2></div><div className="comparison-actions">{selectedTrade && <button className="text-button" onClick={onReset}>Clear trade</button>}<label className="season-select"><span>Stats season</span><select aria-label="Player stats season" value={season} onChange={e => setSeason(Number(e.target.value))}>{[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{seasonLabel(y)}</option>)}</select></label></div></div>
    {selectedTrade ? <div className="trade-context"><span><CalendarDays size={16}/>{dateLabel(selectedTrade.date)} trade</span><a href={selectedTrade.source} target="_blank" rel="noreferrer">View announcement <ArrowUpRight size={16}/></a></div> : <p className="section-description">Select a trade above or search for two players.</p>}
    <div className="comparison-layout"><div className="matchup-workspace">
      <div className="picker-row">{chosen.map((player, index) => <PlayerPicker key={index} label={index === 0 ? 'Player one' : 'Player two'} selected={player} onSelect={p => setChosen(old => old.map((value, i) => i === index ? p : value))}/>)}</div>
      <div className="player-matchup">{chosen.map((player, index) => <div className={'player-profile' + (player?.asset ? ' asset-profile' : '')} key={index} style={teamStyle(selectedTrade ? index === 0 ? selectedTrade.to : selectedTrade.from : { abbrev: players[index]?.team })}>
        <div className="player-details"><span>{player?.asset ? 'Trade return' : players[index]?.team ? `${players[index].team} / ${players[index].position}` : resolving ? 'Finding player…' : player?.id ? 'NHL player' : 'Player record unavailable'}</span><h3>{player?.name}</h3><small>{player?.asset ? 'Non-player asset' : players[index]?.team ? 'Current team' : 'Selected player'}</small></div>
        {players[index]?.headshot && !busy ? <img className="headshot" src={players[index].headshot} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden'; }}/> : <div className="profile-symbol" aria-hidden="true"><ArrowLeftRight size={32}/></div>}
      </div>)}<span className="versus">vs</span></div>
      {busy ? <div className="empty-state compact" role="status"><RefreshCw className="spin" size={18}/>Loading player stats…</div> : mixed ? <div className="notice">Choose two skaters or two goalies to compare the same statistics.{selectedTrade ? ' Individual numbers are shown in the trade package.' : ''}</div> : <div className="stat-comparison">{metrics.map(([key, label]) => {
        const values = players.map(p => p?.hasStats ? p[key] : null);
        const comparable = values.every(v => v != null);
        const max = Math.max(...values.filter(v => v != null), 1);
        return <div className="stat-row" key={key}><div className="stat-value left"><strong className={comparable && values[0] > values[1] ? 'stat-winner' : ''}>{formatStat(players[0], key)}</strong><i aria-hidden="true" style={{ width: `${(values[0] ?? 0) / max * 100}%` }}/></div><span>{label}</span><div className="stat-value right"><strong className={comparable && values[1] > values[0] ? 'stat-winner' : ''}>{formatStat(players[1], key)}</strong><i aria-hidden="true" style={{ width: `${(values[1] ?? 0) / max * 100}%` }}/></div></div>;
      })}</div>}
      {!busy && players.some(p => p && !p.hasStats) && <p className="comparison-message">No NHL regular-season stats for {players.filter(p => p && !p.hasStats).map(p => p.name).join(' and ')} in {seasonLabel(season)}.</p>}
    </div><div className="package-workspace"><h3>{selectedTrade ? 'The complete trade' : 'Compare the season'}</h3>{selectedTrade ? <>
      {packages.map((side, index) => <div className="trade-package" key={index} style={teamStyle(index === 0 ? selectedTrade.to : selectedTrade.from)}><div className="package-team"><Logo team={index === 0 ? selectedTrade.to : selectedTrade.from} size={30}/><h4>{sideNames[index]}<span>Receive</span></h4></div><p className="package-description">{index === 0 ? selectedTrade.received : selectedTrade.sent}</p>{side.filter(p => !p.asset).map(player => {
        const stat = statsById.get(String(player.id));
        const metrics = stat?.position === 'G' ? [['gamesPlayed', 'GP'], ['wins', 'W'], ['savePct', 'SV%']] : [['gamesPlayed', 'GP'], ['goals', 'G'], ['assists', 'A'], ['points', 'PTS']];
        return <article className="trade-player-card" key={player.name}><strong>{player.name}</strong>{player.id ? <div className="trade-player-card-stats">{metrics.map(([key, label]) => <span key={key}><b>{busy ? '…' : formatStat(stat, key)}</b>{label}</span>)}</div> : <small>{resolving ? 'Finding player…' : 'No NHL player record available'}</small>}</article>;
      })}</div>)}
    </> : <div className="comparison-guide"><ArrowLeftRight size={40}/><p>Every player. Both sides.</p><span>Open a trade to see every player’s numbers, draft picks, and other assets in one place.</span><a href="#trades">Browse the trade wire <MoveRight size={18}/></a></div>}</div></div>
    {resolveError && <div className="notice" role="alert">{resolveError}<button className="text-button" onClick={() => setAttempt(v => v + 1)}>Try again</button></div>}
    {stats.error && <div className="notice" role="alert">{stats.error}<button className="text-button" onClick={() => setAttempt(v => v + 1)}>Try again</button></div>}
    {stats.stale && <div className="notice">Saved player stats shown; NHL is temporarily unavailable.</div>}
    <div className="panel-foot"><span>Regular season · All teams combined</span><a href="https://www.nhl.com/stats/" target="_blank" rel="noreferrer">NHL stats <ArrowUpRight size={15}/></a></div>
  </section>;
}
function App() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#141517' : '#f4f5f6');
    try { localStorage.setItem('tape-theme', theme); } catch { /* Theme still works when storage is unavailable. */ }
  }, [theme]);
  const [version, setVersion] = useState(0);
  const [season, setSeason] = useState(currentYear - 1);
  const trades = useData('/api/trades', version);
  const standings = useData('/api/standings', version);
  const [query, setQuery] = useState('');
  const [conference, setConference] = useState('All');
  const [expanded, setExpanded] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [active, setActive] = useState('Dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { const timer = setInterval(() => setVersion(v => v + 1), 300_000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const escape = e => { if (e.key === 'Escape') { setMenuOpen(false); document.querySelector('.menu-toggle')?.focus(); } };
    if (menuOpen) window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [menuOpen]);
  const teams = standings.data?.teams || [];
  const allTrades = trades.data?.trades || [];
  const filtered = allTrades.filter(t => `${t.to.name} ${t.from.name} ${t.received} ${t.sent}`.toLowerCase().includes(query.toLowerCase()));
  const rows = teams.filter(t => conference === 'All' || t.conference === conference);
  const navigate = (name, id) => { setActive(name); setMenuOpen(false); document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); };
  const navItems = [['Dashboard', 'dashboard', LayoutDashboard], ['Trades', 'trades', ArrowLeftRight], ['Compare', 'compare', MoveRight], ['Standings', 'standings', Trophy]];
  const loading = trades.loading || standings.loading;
  const healthy = trades.data && standings.data && !trades.data.stale && !standings.data.stale;
  const checked = trades.data?.fetchedAt ? new Date(trades.data.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—';
  return <div className="app-shell"><a className="skip-link" href="#dashboard">Skip to dashboard</a><header className="topbar">
    <a className="brand" href="#dashboard" aria-label="Tape to Tape home" onClick={() => { setActive('Dashboard'); setMenuOpen(false); }}><img src="/tape-to-tape.svg" width="58" height="58" alt=""/><span>NHL trade tracker</span></a>
    <button className="menu-toggle" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-controls="main-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X/> : <Menu/>}</button>
    <nav id="main-navigation" className={menuOpen ? 'mobile-open' : ''} aria-label="Main navigation">{navItems.map(([name, id, Icon]) => <button key={name} aria-current={active === name ? 'location' : undefined} className={active === name ? 'active' : ''} onClick={() => navigate(name, id)}><Icon size={20}/>{name}</button>)}</nav>
    <button className="theme-toggle" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}<span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button>
  </header><main id="dashboard"><div className="workspace-bar"><span>NHL / {seasonLabel(currentYear)}</span><span className={'sync-status' + (healthy ? ' healthy' : '')}><i/>{loading ? 'Checking sources' : healthy ? 'Data up to date' : 'Check source status'}</span></div>
    <div className="page-heading"><h1>The trade desk.</h1><button className="refresh-button" onClick={() => setVersion(v => v + 1)} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''}/>Refresh data</button></div>
    <div className="overview-strip"><div><span className="overview-icon"><ArrowLeftRight/></span><div><span>Confirmed trades</span><strong>{trades.data ? allTrades.length : '—'}</strong></div><small>Since July 1</small></div><div><span className="overview-icon"><Trophy/></span><div><span>Teams in the league</span><strong>{teams.length || '—'}</strong></div><small>Regular season</small></div><div><span className="overview-icon"><CalendarDays/></span><div><span>Latest trade</span><strong className="date-stat">{allTrades[0] ? dateLabel(allTrades[0].date) : '—'}</strong></div><small>{allTrades[0] ? `${allTrades[0].to.abbrev} / ${allTrades[0].from.abbrev}` : 'Awaiting source'}</small></div></div>
    <div className="dashboard-grid"><section className="panel trades-panel" id="trades"><div className="section-heading"><div className="heading-icon"><h2>Trade wire</h2><span className="count">{filtered.length}</span></div><span className="verified-label"><ShieldCheck size={15}/>Confirmed</span></div>
      <div className="trade-toolbar"><div className="search-field"><Search size={18}/><input aria-label="Search trades" placeholder="Search players or teams" value={query} onChange={e => { setQuery(e.target.value); setExpanded(false); }}/>{query && <button aria-label="Clear trade search" onClick={() => setQuery('')}><X size={18}/></button>}</div><span className="sort-label">Newest first</span></div>
      <div className="trade-feed"><Status state={trades}>{filtered.length === 0 && !trades.loading && <div className="empty-state">No trades match this search.<button className="text-button" onClick={() => setQuery('')}>Clear search</button></div>}
        {filtered.slice(0, expanded ? undefined : 4).map((trade, index) => <article className={'trade-item' + (selectedTrade?.id === trade.id ? ' selected' : '')} key={trade.id}><div className="trade-meta"><time dateTime={trade.date}>{dateLabel(trade.date)}</time>{index === 0 && !query && <span className="latest-tag">Latest</span>}<a href={trade.source} target="_blank" rel="noreferrer">NHL.com <ArrowUpRight size={14}/></a></div>
          <div className="trade-sides">{[[trade.to, trade.received], [trade.from, trade.sent]].map(([team, assets], i) => <div className="trade-side" key={i} style={teamStyle(team)}><div className="trade-team"><Logo team={team} size={36}/><h3>{team.name}</h3></div><span className="receive-label">Receive</span><p>{assets}</p></div>)}<span className="trade-direction" aria-hidden="true"><ArrowLeftRight size={18}/></span></div>
          <button className="compare-link" onClick={() => { setSelectedTrade({ ...trade }); navigate('Compare', 'compare'); }}>{selectedTrade?.id === trade.id ? 'View comparison' : 'Compare trade'}<MoveRight size={18}/></button></article>)}
      </Status></div>
      {filtered.length > 4 && <button className="show-more" onClick={() => setExpanded(!expanded)}>{expanded ? 'Show fewer trades' : `View all ${filtered.length} trades`}<ChevronDown size={16} className={expanded ? 'rotated' : ''}/></button>}
      <div className="panel-foot"><span>Checked {checked} · Every 5 min</span><a href={trades.data?.source || 'https://www.nhl.com/news/topic/trade-coverage/'} target="_blank" rel="noreferrer">Trade tracker<ArrowUpRight size={15}/></a></div>
    </section>
    <section className="panel standings-panel" id="standings"><div className="section-heading"><div className="heading-icon"><h2>Standings</h2></div><span className="quiet-label">{standings.data?.season ? seasonLabel(Math.floor(standings.data.season / 10000)) : seasonLabel(currentYear)}</span></div>
      <div className="segmented" aria-label="Standings conference">{['All', 'Eastern', 'Western'].map(c => <button aria-pressed={conference === c} className={conference === c ? 'selected' : ''} key={c} onClick={() => setConference(c)}>{c === 'All' ? 'League' : c}</button>)}</div>
      {teams.length > 0 && teams.every(t => t.gamesPlayed === 0) && <p className="preseason-note">Regular-season points start at zero.</p>}
      <Status state={standings}><div className="standings-scroll" tabIndex="0" role="region" aria-label="Scrollable league standings"><table><caption className="sr-only">{conference === 'All' ? 'League' : conference} standings: games played, wins, losses, overtime losses, and points.</caption><thead><tr><th scope="col">#</th><th scope="col">Team</th><th scope="col"><abbr title="Games played">GP</abbr></th><th scope="col">W–L–OT</th><th scope="col"><abbr title="Points">PTS</abbr></th></tr></thead><tbody>{rows.map((t, i) => <tr key={t.abbrev}><td>{i + 1}</td><th scope="row"><Logo team={t} size={28}/><span title={t.name}>{t.abbrev}</span></th><td>{t.gamesPlayed}</td><td>{t.wins}–{t.losses}–{t.otLosses}</td><td className="points">{t.points}</td></tr>)}</tbody></table></div></Status>
      <div className="panel-foot"><span>{standings.data?.date ? `As of ${dateLabel(standings.data.date)}` : 'Regular season'}</span><a href="https://www.nhl.com/standings" target="_blank" rel="noreferrer">NHL.com<ArrowUpRight size={15}/></a></div>
    </section></div>
    <Comparison key={selectedTrade?.id || 'manual'} selectedTrade={selectedTrade} version={version} season={season} setSeason={setSeason} onReset={() => setSelectedTrade(null)}/>
    <footer><span>Built by Jesse Little</span><a href="https://studiolittle.ca" target="_blank" rel="noreferrer">studiolittle.ca <ArrowUpRight size={15}/></a></footer>
  </main></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
