import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeftRight, ArrowUpRight, Check, ChevronDown, CircleHelp, ExternalLink, ListFilter, RefreshCw, Search, ShieldCheck, Trophy, X } from 'lucide-react';
import './styles.css';

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
    setState({ data: null, loading: true, error: '' });
    getJson(url, controller.signal).then(data => setState({ data, loading: false, error: '' })).catch(error => {
      if (error.name !== 'AbortError') setState({ data: null, loading: false, error: error.message });
    });
    return () => controller.abort();
  }, [url, version]);
  return state;
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
function Comparison({ selectedTrade, version }) {
  const [season, setSeason] = useState(currentYear - 1);
  const [left, setLeft] = useState({ id: 8478420, name: 'Mikko Rantanen' });
  const [right, setRight] = useState({ id: 8482702, name: 'Logan Stankoven' });
  const [tradeMessage, setTradeMessage] = useState('');
  useEffect(() => {
    if (!selectedTrade) return;
    const controller = new AbortController();
    // Use the first named player in each package; draft picks have no player stats.
    const nameFrom = text => text.replace(/^(?:forwards?|defensemen|defenseman|goaltenders?|goalies?|centers?|centre)\s+/i, '').split(/,| and | with /)[0].trim();
    const names = [nameFrom(selectedTrade.received), nameFrom(selectedTrade.sent)];
    setTradeMessage('Finding players in this trade…');
    Promise.all(names.map(name => /^\d|future considerations/i.test(name) ? Promise.resolve(null) : getJson(`/api/players/search?q=${encodeURIComponent(name)}`, controller.signal).then(data => data.players.find(p => p.name.toLowerCase() === name.toLowerCase()) || null)))
      .then(([a, b]) => { if (a) setLeft(a); if (b) setRight(b); setTradeMessage(a && b ? 'First player from each trade package selected. Full packages are listed in the trade feed.' : 'Some assets have no NHL player stats. Search below to choose a comparison.'); })
      .catch(error => { if (error.name !== 'AbortError') setTradeMessage('Player search is unavailable. Your previous comparison is shown.'); });
    return () => controller.abort();
  }, [selectedTrade]);
  const a = useData(`/api/players/${left.id}?season=${season}`, version);
  const b = useData(`/api/players/${right.id}?season=${season}`, version);
  const players = [a.data?.player, b.data?.player];
  const goalies = players.every(p => p?.position === 'G');
  const mixed = players.every(Boolean) && players[0].position !== players[1].position && players.some(p => p.position === 'G');
  const metrics = goalies ? [['gamesPlayed', 'Games played'], ['wins', 'Wins'], ['savePct', 'Save percentage']] : [['gamesPlayed', 'Games played'], ['goals', 'Goals'], ['assists', 'Assists'], ['points', 'Points']];
  return <section className="panel comparison" id="compare"><div className="section-heading"><div className="heading-icon"><ArrowLeftRight size={18}/><h2>Player comparison</h2></div><select aria-label="Player stats season" value={season} onChange={e => setSeason(Number(e.target.value))}>{[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{seasonLabel(y)}</option>)}</select></div>
    <p className="section-description">Two players. The numbers side by side.</p>
    {tradeMessage && <p className="comparison-message" role="status">{tradeMessage}</p>}
    <div className="picker-row"><PlayerPicker label="Player one" selected={left} onSelect={setLeft}/><PlayerPicker label="Player two" selected={right} onSelect={setRight}/></div>
    <div className="player-matchup">{[a, b].map((state, index) => <div className={`player-profile player-${index}`} key={index}>{state.data?.player?.headshot ? <img className="headshot" src={state.data.player.headshot} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden'; }}/>: <div className="headshot silhouette"/>}<div className="player-details"><span>{state.data?.player?.team || 'NHL'} <span className="position">{state.data?.player?.position || '—'}</span></span><h3>{(index === 0 ? left : right).name}</h3><small>Current team</small></div></div>)}<span className="versus">vs</span></div>
    {(a.loading || b.loading) ? <div className="empty-state compact">Loading player stats…</div> : (a.error || b.error) ? <div className="notice error">{a.error || b.error}</div> : mixed ? <div className="notice">Choose two skaters or two goalies for a like-for-like comparison.</div> : <div className="stat-comparison">{metrics.map(([key, label]) => {
      const values = players.map(p => p?.hasStats ? p[key] : null);
      return <div className="stat-row" key={key}><strong className={values[0] > values[1] ? 'stat-winner' : ''}>{values[0] == null ? '—' : key === 'savePct' ? values[0].toFixed(3) : values[0]}</strong><span>{label}</span><strong className={values[1] > values[0] ? 'stat-winner' : ''}>{values[1] == null ? '—' : key === 'savePct' ? values[1].toFixed(3) : values[1]}</strong></div>;
    })}</div>}
    {players.some(p => p && !p.hasStats) && <p className="notice">No NHL regular-season stats available for one or both players in {seasonLabel(season)}.</p>}
    {(a.data?.stale || b.data?.stale) && <p className="notice">Saved player stats shown; NHL is temporarily unavailable.</p>}
    <div className="panel-foot"><span>Regular season · All teams combined</span><a href="https://www.nhl.com/stats/" target="_blank" rel="noreferrer">NHL stats <ArrowUpRight size={13}/></a></div>
  </section>;
}
function FriedmanFeed() {
  const container = useRef(null);
  const [status, setStatus] = useState('idle');
  useEffect(() => {
    if (status !== 'loading') return;
    let disposed = false;
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js'; script.async = true;
    const fail = () => { if (!disposed) setStatus('unavailable'); };
    script.onerror = fail;
    script.onload = () => {
      if (disposed) return;
      if (!window.twttr?.widgets) { fail(); return; }
      window.twttr.widgets.createTimeline({ sourceType: 'profile', screenName: 'FriedgeHNIC' }, container.current, { height: 430, chrome: 'noheader nofooter noborders', dnt: true }).then(el => { if (!disposed) setStatus(el ? 'ready' : 'unavailable'); }).catch(fail);
    };
    document.body.appendChild(script);
    const timeout = setTimeout(fail, 15_000);
    return () => { disposed = true; clearTimeout(timeout); script.remove(); };
  }, [status === 'loading']);
  return <section className="panel insider" id="insider"><div className="section-heading"><div className="heading-icon"><span className="x-mark">𝕏</span><h2>From the insider</h2></div><ExternalLink size={15}/></div><div className="insider-profile"><div className="avatar">EF</div><div><h3>Elliotte Friedman <span className="verified"><Check size={10}/></span></h3><a href="https://x.com/FriedgeHNIC" target="_blank" rel="noreferrer">@FriedgeHNIC</a></div></div><div ref={container} className="timeline-container"/>
    {status !== 'ready' && <div className="embed-placeholder"><span className="large-x">𝕏</span><h3>The latest, straight from the source.</h3><p>Reporting and updates from Elliotte Friedman on X.</p><button className="primary-button" disabled={status === 'loading'} onClick={() => setStatus('loading')}>{status === 'loading' ? 'Connecting to X…' : status === 'unavailable' ? 'Try loading again' : 'Load X timeline'}<ArrowUpRight size={15}/></button><small>{status === 'unavailable' ? 'X could not display the timeline here. Open the profile below for updates.' : 'Loads content from X. Availability depends on X and your browser settings.'}</small></div>}
    <div className="panel-foot"><span>Reporter updates · Not trade confirmation</span><a href="https://x.com/FriedgeHNIC" target="_blank" rel="noreferrer">Open X <ArrowUpRight size={13}/></a></div></section>;
}
function App() {
  const [version, setVersion] = useState(0);
  const trades = useData('/api/trades', version);
  const standings = useData('/api/standings', version);
  const [team, setTeam] = useState('all');
  const [query, setQuery] = useState('');
  const [conference, setConference] = useState('All');
  const [expanded, setExpanded] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [active, setActive] = useState('Dashboard');
  useEffect(() => { const timer = setInterval(() => setVersion(v => v + 1), 300_000); return () => clearInterval(timer); }, []);
  const teams = standings.data?.teams || [];
  const filtered = (trades.data?.trades || []).filter(t => (team === 'all' || t.to.abbrev === team || t.from.abbrev === team) && `${t.to.name} ${t.from.name} ${t.received} ${t.sent}`.toLowerCase().includes(query.toLowerCase()));
  const rows = teams.filter(t => conference === 'All' || t.conference === conference);
  const navigate = (name, id) => { setActive(name); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const refresh = () => setVersion(v => v + 1);
  return <><header className="topbar"><a className="brand" href="#dashboard" onClick={() => setActive('Dashboard')}><img src="/tape-to-tape.svg" width="56" height="56" alt=""/><span><span className="brand-name">Tape to Tape</span><small>NHL trade tracker</small></span></a><nav aria-label="Main navigation">{[['Dashboard', 'dashboard'], ['Trades', 'trades'], ['Standings', 'standings']].map(([name, id]) => <button key={name} className={active === name ? 'active' : ''} onClick={() => navigate(name, id)}>{name}</button>)}</nav><div className="season-badge"><span className="status-dot"/>{seasonLabel(currentYear)} season</div></header>
    <main id="dashboard"><div className="page-heading"><div><div className="page-kicker"><span className="blue-dash"/>Around the league</div><h1>The trade desk.</h1><p>Follow the moves. Compare the players. See the bigger picture.</p></div><button className="refresh-button" onClick={refresh} disabled={trades.loading || standings.loading}><RefreshCw size={15} className={trades.loading || standings.loading ? 'spin' : ''}/>Refresh data</button></div>
    <div className="overview-strip"><div><span className="overview-icon"><ArrowLeftRight size={19}/></span><div><strong>{trades.data?.trades.length ?? '—'}</strong><span>Confirmed trades</span></div><small>Since July 1, {currentYear}</small></div><div><span className="overview-icon"><Trophy size={19}/></span><div><strong>{teams.length || '—'}</strong><span>Teams in the race</span></div><small>{teams.length && teams.every(t => t.gamesPlayed === 0) ? 'Regular season starts soon' : 'NHL regular season'}</small></div><div><span className="overview-icon"><ShieldCheck size={20}/></span><div><strong className="text-stat">Official sources</strong><span>Every trade linked to NHL.com</span></div><span className="source-pill">Verified source</span></div></div>
    <div className="dashboard-grid"><div className="main-column"><section className="panel trades-panel" id="trades"><div className="section-heading"><div className="heading-icon"><ArrowLeftRight size={18}/><h2>Trade wire</h2><span className="count">{filtered.length}</span></div><span className="quiet-label">Confirmed deals only</span></div><div className="trade-toolbar"><div className="search-field"><Search size={16}/><input aria-label="Search trades" placeholder="Search players or teams…" value={query} onChange={e => { setQuery(e.target.value); setExpanded(false); }}/>{query && <button aria-label="Clear trade search" onClick={() => setQuery('')}><X size={14}/></button>}</div><div className="team-select"><ListFilter size={15}/><select aria-label="Filter trades by team" value={team} onChange={e => { setTeam(e.target.value); setExpanded(false); }}><option value="all">All teams</option>{[...teams].sort((a, b) => a.name.localeCompare(b.name)).map(t => <option key={t.abbrev} value={t.abbrev}>{t.name}</option>)}</select></div></div>
      <Status state={trades}>{filtered.length === 0 && !trades.loading && <div className="empty-state">No trades match these filters.<button className="text-button" onClick={() => { setQuery(''); setTeam('all'); }}>Clear filters</button></div>}
      {filtered.slice(0, expanded ? undefined : 4).map((trade, index) => <article className={`trade-item ${selectedTrade?.id === trade.id ? 'selected' : ''}`} key={trade.id}><div className="trade-meta"><time dateTime={trade.date}>{dateLabel(trade.date)}</time>{index === 0 && !query && team === 'all' && <span className="latest-tag">Latest</span>}<a href={trade.source} target="_blank" rel="noreferrer"><ShieldCheck size={12}/>NHL.com<ArrowUpRight size={12}/></a></div><div className="trade-teams"><div><Logo team={trade.to}/><h3>{trade.to.name}</h3></div><ArrowLeftRight size={17}/><div><Logo team={trade.from}/><h3>{trade.from.name}</h3></div></div><div className="trade-assets"><div><span>Receive</span><p>{trade.received}</p></div><div><span>Receive</span><p>{trade.sent}</p></div></div><button className="compare-link" onClick={() => { setSelectedTrade(trade); document.getElementById('compare')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Compare players<ArrowUpRight size={13}/></button></article>)}</Status>
      {filtered.length > 4 && <button className="show-more" onClick={() => setExpanded(!expanded)}>{expanded ? 'Show fewer trades' : `View all ${filtered.length} trades`}<ChevronDown size={15} className={expanded ? 'rotated' : ''}/></button>}
      <div className="panel-foot"><span>Checked {trades.data?.fetchedAt ? new Date(trades.data.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—'} · Refreshes every 5 min</span><a href={trades.data?.source || 'https://www.nhl.com/news/topic/trade-coverage/'} target="_blank" rel="noreferrer">Official tracker<ArrowUpRight size={13}/></a></div></section>
      <Comparison selectedTrade={selectedTrade} version={version}/></div>
      <aside className="side-column"><section className="panel standings-panel" id="standings"><div className="section-heading"><div className="heading-icon"><Trophy size={18}/><h2>League standings</h2></div><span className="quiet-label">{standings.data?.season ? seasonLabel(Math.floor(standings.data.season / 10000)) : seasonLabel(currentYear)}</span></div><div className="segmented" aria-label="Standings conference">{['All', 'Eastern', 'Western'].map(c => <button aria-pressed={conference === c} className={conference === c ? 'selected' : ''} key={c} onClick={() => setConference(c)}>{c === 'All' ? 'League' : c === 'Eastern' ? 'Eastern' : 'Western'}</button>)}</div>{teams.length > 0 && teams.every(t => t.gamesPlayed === 0) && <p className="preseason-note">Preseason · Regular-season points start at zero.</p>}<Status state={standings}><div className="standings-scroll"><table><thead><tr><th scope="col">#</th><th scope="col">Team</th><th scope="col">GP</th><th scope="col">W–L–OT</th><th scope="col">PTS</th></tr></thead><tbody>{rows.map((t, i) => <tr key={t.abbrev}><td>{i + 1}</td><th scope="row"><Logo team={t} size={27}/><span title={t.name}>{t.abbrev}</span></th><td>{t.gamesPlayed}</td><td>{t.wins}–{t.losses}–{t.otLosses}</td><td className="points">{t.points}</td></tr>)}</tbody></table></div></Status><div className="panel-foot"><span>{standings.data?.date ? `As of ${dateLabel(standings.data.date)}` : 'Official NHL standings'}</span><a href="https://www.nhl.com/standings" target="_blank" rel="noreferrer">NHL.com<ArrowUpRight size={13}/></a></div></section><FriedmanFeed/><div className="source-note"><ShieldCheck size={18}/><p><strong>A little less noise.</strong><br/>Trades come from the NHL’s official tracker. Insider updates stay separate, so a report never looks like a confirmed deal.</p></div></aside></div>
    <footer><a className="footer-brand" href="#dashboard"><img src="/tape-to-tape.svg" width="36" height="36" alt=""/>Tape to Tape</a><span>An independent hockey dashboard. Not affiliated with the NHL.</span><a href="https://www.nhl.com/news/topic/trade-coverage/" target="_blank" rel="noreferrer">Built around the game<ArrowUpRight size={13}/></a></footer></main></>;
}

createRoot(document.getElementById('root')).render(<App/>);
