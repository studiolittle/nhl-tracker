import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, ArrowLeftRight, ArrowUpRight, CircleHelp, LayoutDashboard, CalendarDays, ChevronDown, MoveRight, Sun, Moon, Menu, RefreshCw, Search, ShieldCheck, Trophy, X } from 'lucide-react';
import './styles.css';
import PlayerPicker from './PlayerPicker.jsx';
import SeasonHome, { useHomeFeed } from './SeasonHome.jsx';

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
const perGame = ({ pts, gp }) => gp ? pts / gp : 0;
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return matches;
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
    setState(previous => ({ ...previous, loading: true, error: '' }));
    getJson(url, controller.signal).then(data => setState({ data, loading: false, error: '' })).catch(error => {
      if (error.name !== 'AbortError') setState(previous => ({ ...previous, loading: false, error: error.message }));
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
      setChosen(previous => sides.map((side, index) => side.find(player => player.name === previous[index]?.name) || (previous[index]?.id ? previous[index] : side[0])));
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
  const sideTeams = selectedTrade ? [selectedTrade.to, selectedTrade.from] : players.map(p => ({ abbrev: p?.team }));
  const sideNames = selectedTrade ? [selectedTrade.to.name, selectedTrade.from.name] : ['Player one', 'Player two'];
  const needsPick = !selectedTrade && chosen.some(p => !p?.id);
  const totals = selectedTrade ? packages.map(side => { const found = side.map(p => statsById.get(String(p.id))).filter(p => p?.hasStats && p.position !== 'G'); return found.length ? { gp: found.reduce((sum, p) => sum + p.gamesPlayed, 0), pts: found.reduce((sum, p) => sum + p.points, 0), count: found.length, named: side.filter(p => !p.asset).length } : null; }) : [];
  const namedCounts = packages.map(side => side.filter(p => !p.asset).length);
  const takeaway = (() => {
    const [a, b] = totals;
    if (!a || !b) return 'Not enough NHL skater stats to compare these packages yet.';
    if (a.count < a.named || b.count < b.named) return 'Some players are not included in the skater totals. Review the coverage before comparing.';
    if (a.gp + b.gp < 30) return `Too early to call: the named skaters have only ${a.gp + b.gp} games between them.`;
    const [pa, pb] = [perGame(a), perGame(b)];
    if (Math.abs(pa - pb) < 0.05) return 'Even on points per game.';
    return `${(pa > pb ? selectedTrade.to : selectedTrade.from).abbrev}’s players lead on points per game, ${Math.max(pa, pb).toFixed(2)} to ${Math.min(pa, pb).toFixed(2)}.`;
  })();
  const compact = useMediaQuery('(max-width: 900px)');
  const [packageOpen, setPackageOpen] = useState(!compact);
  const packageRef = useRef(null);
  const seasonRef = useRef(null);
  const matchupRef = useRef(null);
  useEffect(() => setPackageOpen(!compact), [compact]);
  const packageChoices = packages.map(side => side.filter(player => player.id));
  const canSwitchPlayers = packageChoices.some((side, index) => side.length > 1 || side.some(player => player.id !== chosen[index]?.id));
  const incomplete = selectedTrade && (totals.some(total => !total || total.count < total.named) || totals.reduce((sum, total) => sum + (total?.gp || 0), 0) < 30);
  const canTryEarlier = season > currentYear - 2 && namedCounts.every(count => count > 0);
  const changeStatsSeason = nextSeason => {
    setSeason(nextSeason);
    seasonRef.current?.focus({ preventScroll: true });
  };
  const revealPackage = () => {
    setPackageOpen(true);
    requestAnimationFrame(() => {
      const summary = packageRef.current?.querySelector('summary');
      summary?.focus({ preventScroll: true });
      summary?.scrollIntoView({ block: 'start', behavior: 'auto' });
    });
  };
  const selectPackagePlayer = (index, player, returnToMatchup = false) => {
    const next = chosen.map((value, i) => i === index ? player : value);
    const controlsWillClose = canSwitchPlayers && !packageChoices.some((side, i) => side.length > 1 || side.some(option => option.id !== next[i]?.id));
    setChosen(next);
    if (returnToMatchup || controlsWillClose) requestAnimationFrame(() => {
      matchupRef.current?.focus({ preventScroll: true });
      matchupRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
    });
  };
  const [showPickers, setShowPickers] = useState(!selectedTrade);
  const pickers = <div className="picker-row">{chosen.map((player, index) => <PlayerPicker key={index} autoFocus={(selectedTrade ? showPickers : focusPicker) && index === 0} label={index === 0 ? 'Player one' : 'Player two'} selected={player} onSelect={p => setChosen(old => old.map((value, i) => i === index ? p : value))}/>)}</div>;
  return <section className="panel comparison" id="compare" aria-busy={busy}>
    <div className="section-heading"><div className="heading-icon"><ArrowLeftRight/><h2>Compare</h2></div><div className="comparison-actions">{selectedTrade && <button className="text-button nowrap" onClick={onReset}>Clear trade</button>}<label className="season-select"><span>Season</span><select ref={seasonRef} aria-label="Player stats season" value={season} onChange={e => setSeason(Number(e.target.value))}>{[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{seasonLabel(y)}</option>)}</select></label></div></div>
    {selectedTrade ? <div className="trade-context"><button className="text-button back-link" onClick={onBrowseTrades}><ArrowLeft size={16}/>Trade wire</button><span><CalendarDays size={16}/>{dateLabel(selectedTrade.date)} trade</span><a href={selectedTrade.source} target="_blank" rel="noreferrer">Announcement <ArrowUpRight size={16}/></a></div> : <p className="section-description">Search for two players, or open a trade from the wire.</p>}
    <div className="comparison-layout"><div className="matchup-workspace">
      {!selectedTrade && pickers}
      <div className="matchup-heading"><h3 ref={matchupRef} tabIndex="-1">Head to head</h3><span>{seasonLabel(season)}</span>{selectedTrade && <button className="text-button" aria-expanded={showPickers} aria-controls="comparison-player-search" onClick={() => setShowPickers(v => !v)}>{showPickers ? 'Hide search' : 'Change players'}</button>}</div>
      {selectedTrade && canSwitchPlayers && <div className="package-selectors">{packageChoices.map((choices, index) => <label key={index}><span>{sideTeams[index].abbrev} player</span><select aria-label={`${sideTeams[index].name} player`} value={chosen[index]?.id || ''} disabled={choices.length === 0 || (choices.length === 1 && choices.some(player => player.id === chosen[index]?.id))} onChange={event => selectPackagePlayer(index, choices.find(player => String(player.id) === event.target.value))}>
        {!choices.some(player => player.id === chosen[index]?.id) && <option value={chosen[index]?.id || ''}>{chosen[index]?.name || 'No player available'}</option>}
        {choices.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}
      </select></label>)}</div>}
      {selectedTrade && <div id="comparison-player-search" hidden={!showPickers}>{showPickers && pickers}</div>}
      <div className="player-matchup">{chosen.map((player, index) => <div className={'player-profile' + (player?.asset ? ' asset-profile' : '')} key={index} style={teamStyle(sideTeams[index])}>
        <div className="player-details"><span>{player?.asset ? 'Trade return' : players[index]?.team ? `${players[index].team} / ${players[index].position}` : resolving ? 'Finding player…' : player?.id ? 'NHL player' : selectedTrade ? 'Player record unavailable' : 'Choose a player'}</span><h3>{player?.name || '—'}</h3>{(player?.asset || players[index]?.team) && <small>{player?.asset ? 'Non-player asset' : 'Current team'}</small>}</div>
        {players[index]?.headshot && !busy ? <img className="headshot" src={players[index].headshot} alt="" onError={e => { e.currentTarget.style.visibility = 'hidden'; }}/> : <div className="profile-symbol" aria-hidden="true"><ArrowLeftRight size={32}/></div>}
      </div>)}<span className="versus">vs</span></div>
      {compact && selectedTrade && !busy && incomplete && <div className="matchup-recovery"><p>Some package stats are missing or limited this season.</p><div className="comparison-next-actions">{canTryEarlier && <button className="refresh-button" onClick={() => changeStatsSeason(season - 1)}>Try {seasonLabel(season - 1)} stats</button>}<button className="text-button" onClick={revealPackage}>View trade assets <MoveRight size={16}/></button></div></div>}
      {needsPick ? <div className="empty-state compact" role="status">Pick both players above to compare their {seasonLabel(season)} numbers.</div> : busy ? <div className="empty-state compact" role="status"><RefreshCw className="spin" size={18}/>Loading player stats…</div> : mixed ? <div className="notice">Choose two skaters or two goalies to compare the same statistics.{selectedTrade ? ' Individual numbers are shown in the trade package.' : ''}</div> : <div className="stat-comparison">{metrics.map(([key, label]) => {
        const values = players.map(p => p?.hasStats ? p[key] : null);
        const comparable = key !== 'gamesPlayed' && values.every(v => v != null) && values[0] !== values[1];
        const max = Math.max(...values.filter(v => v != null), 1);
        const cell = index => { const lead = comparable && values[index] > values[1 - index]; return <div className={'stat-value ' + (index === 0 ? 'left' : 'right')} style={teamStyle(sideTeams[index])}><strong className={lead ? 'stat-winner' : comparable ? 'stat-loser' : ''}>{formatStat(players[index], key)}{lead && <span className="sr-only"> (higher)</span>}</strong><i aria-hidden="true" style={{ width: `${(values[index] ?? 0) / max * 100}%` }}/></div>; };
        return <div className="stat-row" key={key}>{cell(0)}<span>{label}</span>{cell(1)}</div>;
      })}</div>}
      {!busy && !needsPick && players.some(p => p && !p.hasStats) && <p className="comparison-message">No NHL regular-season stats for {players.filter(p => p && !p.hasStats).map(p => p.name).join(' and ')} in {seasonLabel(season)}. Prospects, new signings and non-NHL players show “—”.</p>}
    </div><div className="package-workspace">{selectedTrade && !busy && <div className="comparison-summary">
      <p className="takeaway" role="status" aria-live="polite" aria-atomic="true">{takeaway}</p>
      <p className="summary-context">{seasonLabel(season)} regular season · Skaters only. Picks and goalies excluded.</p>
      {incomplete && <div className="comparison-next-actions">{canTryEarlier && <button className="refresh-button" onClick={() => changeStatsSeason(season - 1)}>Try {seasonLabel(season - 1)} stats</button>}<button className="text-button" onClick={revealPackage}>View trade assets <MoveRight size={16}/></button></div>}
      <details className="comparison-method"><summary>Package totals and method <ChevronDown size={16}/></summary>
      <div className="totals-sides">{totals.map((total, index) => { const team = index === 0 ? selectedTrade.to : selectedTrade.from; return <div className="totals-side" key={index} style={teamStyle(sideTeams[index])}><span className="totals-team">{team.abbrev} gets {haulParts(index === 0 ? selectedTrade.received : selectedTrade.sent, sidePlayers(selectedTrade, index === 0 ? 'to' : 'from')).join(' + ')}</span>{total ? <><strong>{total.pts}<small> pts</small></strong><span className="totals-detail">in {total.gp} games · {perGame(total).toFixed(2)} per game</span><span className="totals-coverage">Counts {total.count} of {total.named} {total.named === 1 ? 'player' : 'players'}</span></> : <><span className="totals-detail">No NHL skater stats in {seasonLabel(season)}</span><span className="totals-coverage">Counts 0 of {namedCounts[index]} {namedCounts[index] === 1 ? 'player' : 'players'}</span></>}</div>; })}</div>
      <p className="totals-note">How this works: we add up points and games for the skaters named in the trade ({seasonLabel(season)} regular season) and compare points per game. Goalies, draft picks and players without NHL games aren’t counted, and we won’t call it before the two sides have played 30 games combined.</p>
      </details>
    </div>}{selectedTrade ? <details className="package-disclosure" ref={packageRef} open={packageOpen} onToggle={event => setPackageOpen(event.currentTarget.open)}><summary>The complete trade <ChevronDown size={18}/></summary><div className="package-body">
      {packages.map((side, index) => <div className="trade-package" key={index} style={teamStyle(sideTeams[index])}><div className="package-team"><Logo team={index === 0 ? selectedTrade.to : selectedTrade.from} size={30}/><h4>{sideNames[index]} <span>gets</span></h4></div><p className="package-description">{index === 0 ? selectedTrade.received : selectedTrade.sent}</p>{side.filter(p => !p.asset).map(player => {
        const stat = statsById.get(String(player.id));
        const metrics = stat?.position === 'G' ? [['gamesPlayed', 'GP'], ['wins', 'W'], ['savePct', 'SV%']] : [['gamesPlayed', 'GP'], ['goals', 'G'], ['assists', 'A'], ['points', 'PTS']];
        const reason = !player.id ? 'No NHL player record found' : stat?.position === 'G' ? 'Goalie: not counted in point totals' : stat && !stat.hasStats ? `No NHL games in ${seasonLabel(season)}` : '';
        const inner = <><strong>{player.name}</strong>{player.id ? <div className="trade-player-card-stats">{metrics.map(([key, label]) => <span key={key}><b>{busy ? '…' : formatStat(stat, key)}</b>{label}</span>)}</div> : <small>{resolving ? 'Finding player…' : 'No NHL player record found'}</small>}{player.id && !busy && reason && <small className="card-reason">{reason}</small>}</>;
        return player.id && canSwitchPlayers ? <button className="trade-player-card pickable" key={player.name} aria-pressed={chosen[index]?.id === player.id} onClick={() => selectPackagePlayer(index, player, true)}>{inner}</button> : <article className="trade-player-card" key={player.name}>{inner}</article>;
      })}</div>)}
    </div></details> : <div className="comparison-guide"><h3>How it works</h3><ArrowLeftRight size={40}/><p>Every player. Both sides.</p><span>Open a trade from the wire to see every player’s numbers, draft picks and other assets in one place.</span><button className="text-button" onClick={onBrowseTrades}>Browse the trade wire <MoveRight size={18}/></button></div>}</div></div>
    {resolveError && <div className="notice" role="alert">{resolveError}<button className="text-button" onClick={() => setAttempt(v => v + 1)}>Try again</button></div>}
    {stats.error && <div className="notice" role="alert">{stats.error}<button className="text-button" onClick={() => setAttempt(v => v + 1)}>Try again</button></div>}
    {stats.stale && <div className="notice">Saved player stats shown; NHL is temporarily unavailable.</div>}
    <div className="panel-foot"><span>Regular season · All teams combined</span>{selectedTrade ? <button className="text-button" onClick={onBrowseTrades}>Compare another trade <MoveRight size={15}/></button> : <a href="https://www.nhl.com/stats/" target="_blank" rel="noreferrer">NHL stats <ArrowUpRight size={15}/></a>}</div>
  </section>;
}
function CompactSide({ team, text, players }) {
  return <span className="row-side" style={teamStyle(team)}><Logo team={team} size={32}/><span className="row-copy"><span className="row-team"><b>{team.abbrev}</b> gets <span className="row-haul">{haulParts(text, players).join(' + ')}</span></span><span className="row-text">{text}</span></span></span>;
}
const roleLabels = { forward: 'Forward', forwards: 'Forward', defenseman: 'Defenseman', defensemen: 'Defenseman', goaltender: 'Goalie', goaltenders: 'Goalie', goalie: 'Goalie', goalies: 'Goalie', center: 'Center', centers: 'Center', centre: 'Center' };
function playerRoles(text, names) {
  const roles = [...text.matchAll(/\b(forwards?|defensemen|defenseman|goaltenders?|goalies?|centers?|centre)\b/gi)];
  return names.map(name => { const at = text.indexOf(name); const role = roles.filter(r => r.index < at).at(-1); return role ? roleLabels[role[1].toLowerCase()] : ''; });
}
function otherAssets(text) {
  const picks = [...text.matchAll(/(?:conditional\s+)?\d+(?:st|nd|rd|th)-round pick(?:\s+in\s+(?:the\s+)?\d{4}(?:\s+NHL Draft)?)?/gi)].map(m => m[0].replace(/\s+in\s+(?:the\s+)?(\d{4}).*$/i, ' · $1').replace(/^./, c => c.toUpperCase()));
  return /consideration/i.test(text) ? [...picks, 'Future considerations'] : picks;
}
function HeroSide({ team, text, players }) {
  const roles = playerRoles(text, players);
  const shown = players.slice(0, 3);
  const assets = otherAssets(text);
  return <div className="trade-side" style={teamStyle(team)}><div className="trade-team"><Logo team={team} size={40} eager/><h3>{team.name} <span>gets</span></h3></div>
    {shown.length ? <ul className="hero-players">{shown.map((name, i) => <li key={name}><strong>{name}</strong>{roles[i] && <small>{roles[i]}</small>}</li>)}{players.length > 3 && <li className="hero-more">+ {players.length - 3} more</li>}</ul> : !assets.length && <p>{text}</p>}
    {assets.length > 0 && <ul className="hero-assets" aria-label="Other assets">{assets.map(asset => <li key={asset}>{asset}</li>)}</ul>}</div>;
}
function LatestTrade({ trade, onCompare }) {
  return <section className="panel latest-trade"><h2 className="sr-only">Latest trade</h2><div className="latest-head"><span>Latest trade · <time dateTime={trade.date}>{dateLabel(trade.date)}</time></span><span className="latest-actions"><a href={trade.source} target="_blank" rel="noreferrer">NHL.com <ArrowUpRight size={14}/></a><button className="primary-button" onClick={() => onCompare(trade)}>Compare this trade<MoveRight size={18}/></button></span></div>
    <div className="trade-sides large"><HeroSide team={trade.to} text={trade.received} players={sidePlayers(trade, 'to')}/><HeroSide team={trade.from} text={trade.sent} players={sidePlayers(trade, 'from')}/><span className="trade-direction" aria-hidden="true"><ArrowLeftRight size={20}/></span></div></section>;
}
function TradeWire({ trades, filtered, query, setQuery, selectedTrade, onCompare, full, onViewAll, skipFirst }) {
  const list = skipFirst ? filtered.slice(1) : filtered;
  const visible = full ? list : list.slice(0, 4);
  return <section className="panel trades-panel" id="trade-wire"><div className="section-heading"><div className="heading-icon"><h2>Trade wire</h2>{trades.data && <span className="count">{filtered.length} since July 1</span>}</div><span className="verified-label" title="Every trade is read from the official NHL.com trade tracker."><ShieldCheck size={15}/>Official NHL tracker</span></div>
    <div className="trade-toolbar"><div className="search-field"><Search size={18}/><input aria-label="Search trades" placeholder="Search players or teams" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button aria-label="Clear trade search" onClick={() => setQuery('')}><X size={18}/></button>}</div><span className="sort-label">Newest first</span></div>
    <div className="trade-feed"><Status state={trades}>{filtered.length === 0 && !trades.loading && <div className="empty-state">No trades match this search.<button className="text-button" onClick={() => setQuery('')}>Clear search</button></div>}
      {visible.map(trade => <article className={'trade-item' + (selectedTrade?.id === trade.id ? ' selected' : '')} key={trade.id}><button className="trade-row" aria-current={selectedTrade?.id === trade.id ? 'true' : undefined} aria-label={`Compare trade from ${dateLabel(trade.date)}: ${trade.to.name} get ${trade.received}; ${trade.from.name} get ${trade.sent}`} onClick={() => onCompare(trade)}><time dateTime={trade.date}>{dateLabel(trade.date)}</time><span className="row-sides"><CompactSide team={trade.to} text={trade.received} players={sidePlayers(trade, 'to')}/><CompactSide team={trade.from} text={trade.sent} players={sidePlayers(trade, 'from')}/></span><MoveRight className="row-go" size={18}/></button></article>)}
    </Status></div>
    {!full && list.length > 4 && <button className="show-more" onClick={onViewAll}>View all {filtered.length} trades<MoveRight size={16}/></button>}
    <div className="panel-foot"><span>Updates every 5 minutes</span><a href={trades.data?.source || 'https://www.nhl.com/news/topic/trade-coverage/'} target="_blank" rel="noreferrer">Trade tracker<ArrowUpRight size={15}/></a></div>
  </section>;
}
const confRows = (teams, conference) => {
  const rows = teams.filter(t => conference === 'All' || t.conference === conference);
  const inPlayoffs = t => t.wildcardSequence <= 2;
  return conference === 'All' ? rows : [...rows].sort((x, y) => Number(!inPlayoffs(x)) - Number(!inPlayoffs(y)) || x.conferenceSequence - y.conferenceSequence);
};
function StandingsPanel({ standings, teams, rows, conference, setConference, full, onViewAll, title = 'Standings' }) {
  const shown = full ? rows : rows.slice(0, 8);
  const preseason = teams.length > 0 && teams.every(t => t.gamesPlayed === 0);
  const showPlayoffs = conference !== 'All' && !preseason;
  return <section className="panel standings-panel" id={`standings-${conference}`}><div className="section-heading"><div className="heading-icon"><h2>{title}</h2></div><span className="quiet-label">{standings.data?.season ? seasonLabel(Math.floor(standings.data.season / 10000)) : seasonLabel(currentYear)}</span></div>
    {setConference && <div className="segmented" aria-label="Standings conference">{['All', 'Eastern', 'Western'].map(c => <button aria-pressed={conference === c} className={conference === c ? 'selected' : ''} key={c} onClick={() => setConference(c)}>{c === 'All' ? 'League' : c}</button>)}</div>}
    {preseason && <p className="preseason-note">Regular-season points start at zero.</p>}
    {showPlayoffs && <p className="preseason-note">Teams above the line are in a playoff position.</p>}
    <Status state={standings}><div className="standings-scroll" tabIndex="0" role="region" aria-label={`Scrollable ${title.toLowerCase()}`}><table><caption className="sr-only">{conference === 'All' ? 'League' : conference} standings: games played, wins, losses, overtime losses, and points.</caption><thead><tr><th scope="col">#</th><th scope="col">Team</th><th scope="col">GP<span className="sr-only"> (games played)</span></th><th scope="col">W–L–OT</th><th scope="col">PTS<span className="sr-only"> (points)</span></th></tr></thead><tbody>{shown.map((t, i) => <React.Fragment key={t.abbrev}><tr style={teamStyle(t)}><td>{i + 1}</td><th scope="row"><Logo team={t} size={28}/><span className="abbr" aria-hidden="true">{t.abbrev}</span><span className="team-name">{t.name}</span>{showPlayoffs && t.wildcardSequence <= 2 && <span className="sr-only"> (in a playoff position)</span>}</th><td>{t.gamesPlayed}</td><td>{t.wins}–{t.losses}–{t.otLosses}</td><td className="points">{t.points}</td></tr>{showPlayoffs && t.wildcardSequence <= 2 && shown[i + 1] && shown[i + 1].wildcardSequence > 2 && <tr className="cut-row" aria-hidden="true"><td colSpan="5"><span>Playoff line</span></td></tr>}</React.Fragment>)}</tbody></table></div></Status>
    <div className="panel-foot">{!full && <button className="text-button" onClick={onViewAll}>View all {rows.length} teams <MoveRight size={15}/></button>}<span>{standings.data?.date ? `As of ${dateLabel(standings.data.date)}` : 'Regular season'}</span><a href="https://www.nhl.com/standings" target="_blank" rel="noreferrer">NHL.com<ArrowUpRight size={15}/></a></div>
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
  const calendar = useHomeFeed('/api/season', version);
  const [query, setQuery] = useState('');
  const [conference, setConference] = useState('All');
  const [selectedId, setSelectedId] = useState(tradeIdFromHash);
  const [active, setActive] = useState(viewFromHash);
  const [tradeTab, setTradeTab] = useState(tradeTabFromHash);
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusPicker, setFocusPicker] = useState(false);
  const mainRef = useRef(null);
  const headingRef = useRef(null);
  const viewKey = `${active}:${tradeTab}:${selectedId || ''}`;
  const previousView = useRef(viewKey);
  useEffect(() => {
    if (previousView.current === viewKey) return;
    previousView.current = viewKey;
    const target = active === 'Trades' && tradeTab === 'compare' && !selectedId
      ? document.querySelector('.player-picker input') || headingRef.current
      : headingRef.current;
    target?.focus({ preventScroll: true });
  }, [viewKey, active, tradeTab, selectedId]);
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
  const rows = confRows(teams, conference);
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
  const healthy = trades.data && standings.data && !trades.error && !standings.error && !trades.data.stale && !standings.data.stale;
  const checked = trades.data?.fetchedAt ? new Date(trades.data.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  const comparison = <Comparison key={selectedTrade?.id || 'manual'} selectedTrade={selectedTrade} version={version} season={season} setSeason={setSeason} focusPicker={focusPicker} onReset={() => navigate('Trades', 'compare', null)} onBrowseTrades={() => navigate('Trades')}/>;
  const pendingTrade = tradeTab === 'compare' && selectedId && !selectedTrade;
  return <div className="app-shell"><a className="skip-link" href="#dashboard" onClick={event => { event.preventDefault(); mainRef.current?.focus({ preventScroll: true }); mainRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' }); }}>Skip to dashboard</a><header className="topbar">
    <a className="brand" href="#home" aria-label="Puck Haul home (alpha)" onClick={e => { e.preventDefault(); navigate('Home'); }}>puck<b>haul</b><span className="alpha-tag" title="Puck Haul is in alpha. Features and data may change.">Alpha</span></a>
    <button className="menu-toggle" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-controls="main-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X/> : <Menu/>}</button>
    <nav id="main-navigation" className={menuOpen ? 'mobile-open' : ''} aria-label="Main navigation">{navItems.map(([name, Icon]) => <button key={name} aria-current={active === name ? 'page' : undefined} className={active === name ? 'active' : ''} onClick={() => navigate(name)}><Icon size={20}/>{name}</button>)}</nav>
    <button className="theme-toggle" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={20}/> : <Moon size={20}/>}<span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button>
  </header><main id="dashboard" ref={mainRef} tabIndex="-1"><div className="workspace-bar"><span>NHL / {seasonLabel(currentYear)}</span><span role="status" aria-live="polite" aria-atomic="true" className={'sync-status' + (active !== 'Home' && healthy ? ' healthy' : '')}><i/>{active === 'Home' ? 'Updates automatically' : loading ? 'Checking sources' : healthy ? `Data up to date${checked ? ` · checked ${checked}` : ''}` : 'Check source status'}</span></div>
    <div className="page-heading"><div><h1 ref={headingRef} tabIndex="-1">{active === 'Home' ? calendar.data?.phase === 'playoffs' ? 'Stanley Cup Playoffs' : calendar.data?.phase === 'offseason' ? 'NHL offseason' : 'NHL scores & where to watch' : active}</h1></div></div>
    {active === 'Home' && <SeasonHome calendar={calendar} version={version} trades={trades} onCompare={compareTrade} onBrowseTrades={() => navigate('Trades')} offseasonTrade={allTrades[0] && <LatestTrade trade={allTrades[0]} onCompare={compareTrade}/>} standingsPanel={<StandingsPanel standings={standings} teams={teams} rows={rows} conference={conference} setConference={setConference} onViewAll={() => navigate('Standings')}/>}/>}
    {active === 'Trades' && <div className="trades-page"><div className="trade-tabs" aria-label="Trades views"><button aria-pressed={tradeTab === 'wire'} className={tradeTab === 'wire' ? 'selected' : ''} onClick={() => navigate('Trades')}>Trade wire</button><button aria-pressed={tradeTab === 'compare'} className={tradeTab === 'compare' ? 'selected' : ''} onClick={() => navigate('Trades', 'compare', selectedId, true)}>Compare</button></div>{tradeTab === 'wire' ? <TradeWire trades={trades} filtered={filtered} query={query} setQuery={setQuery} selectedTrade={selectedTrade} onCompare={compareTrade} full/> : pendingTrade && trades.loading ? <div className="panel"><Status state={trades}/></div> : <>{pendingTrade && <div className="notice" role="status">That trade is no longer on the wire. You can still compare any two players.</div>}{comparison}</>}</div>}
    {active === 'Standings' && <div className="standings-page"><StandingsPanel standings={standings} teams={teams} rows={rows} conference={conference} setConference={setConference} full/></div>}
    <footer><span>Built by Jesse Little · Puck Haul is in alpha, so features and data may change.</span><a href="https://studiolittle.ca" target="_blank" rel="noreferrer">studiolittle.ca <ArrowUpRight size={15}/></a></footer>
  </main></div>;
}
createRoot(document.getElementById('root')).render(<App/>);
