import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowLeftRight, ArrowUpRight } from 'lucide-react';
import { getBroadcasts, broadcastGuide, outOfMarketGuide } from './lib/broadcasts.js';
import { selectPlayoffSeries, playoffRoundLabel, playoffSeriesStatus } from './lib/playoffs.js';
import FavouriteTeams, { useFavouriteTeams } from './FavouriteTeams.jsx';
import { filterFavouriteGames } from './lib/favourites.js';
import './SeasonHome.css';

export function useHomeFeed(url, version = 0, interval = 0) {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ url, data: null, loading: Boolean(url), error: '' });
  useEffect(() => { if (!interval || !url) return; const timer = setInterval(() => { if (!document.hidden) setTick(t => t + 1); }, interval); return () => clearInterval(timer); }, [url, interval]);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    setState(old => ({url, data:old.url === url ? old.data : null, loading:true,error:''}));
    fetch(url,{signal:controller.signal}).then(async r => { const data=await r.json();if(!r.ok || data.error) throw new Error(data.error || 'The NHL feed is unavailable.'); return data; })
      .then(data=>setState({url,data,loading:false,error:''}))
      .catch(error=>{if(error.name!=='AbortError')setState(old=>({...old,loading:false,error:'The NHL feed is temporarily unavailable.'}));});
    return ()=>controller.abort();
  }, [url,version,tick]);
  return { ...(state.url === url ? state : {data:null,loading:Boolean(url),error:''}), retry:()=>setTick(t=>t+1) };
}
const dateLabel = date => date ? new Date(`${date}T12:00:00Z`).toLocaleDateString('en-CA',{month:'short',day:'numeric'}) : '';
const fullDate = date => date ? new Date(`${date}T12:00:00Z`).toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'}) : '';
const shiftDate = (date, amount) => {const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+amount);return d.toISOString().slice(0,10);};
const etDate = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const startTime = time => time ? new Date(time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/Toronto'}) : 'Time TBD';
const liveStates = new Set(['LIVE','CRIT']);
function TeamLogo({team}) { return team?.logo ? <img className="team-logo" src={team.logo} width="34" height="34" alt="" loading="lazy"/> : null; }
function NetworkLogo({name}) {
  const brand=/^TSN/.test(name)?'tsn':/^Sportsnet/.test(name)?'sportsnet':/^Prime/.test(name)?'prime-video':/^TVA/.test(name)?'tva-sports':/^RDS/.test(name)?'rds':null;
  return brand?<img className="network-logo" src={`/networks/${brand}.svg`} alt="" width="72" height="36"/>:null;
}
function FeedMessage({feed,empty}) {
  if(feed.loading&&!feed.data)return <p className="home-feed-message" role="status">Loading from NHL.com…</p>;
  if(feed.error)return <p className="home-feed-message" role="status">{feed.data?'Showing the last available update. ':''}{feed.error} <button className="text-button" onClick={feed.retry}>Try again</button></p>;
  if(feed.data?.stale)return <p className="home-feed-message" role="status">Showing saved data from {new Date(feed.data.fetchedAt).toLocaleString()}. NHL.com is temporarily unavailable.</p>;
  return empty ? <p className="home-feed-message">{empty}</p> : null;
}
function GameStatus({game}) {
  if(game.scheduleState==='PPD'||game.state==='PPD')return <span>Postponed</span>;
  if(game.scheduleState==='CNCL'||game.state==='CANC')return <span>Cancelled</span>;
  if(['FINAL','OFF'].includes(game.state))return <span>Final{game.periodType==='OT'?' / OT':game.periodType==='SO'?' / SO':''}</span>;
  if(liveStates.has(game.state))return <span className="game-live"><span>Live · {game.periodType==='OT'?'OT':game.periodType==='SO'?'SO':`P${game.period || 1}`}</span>{(game.clock?.inIntermission||game.clock?.timeRemaining)&&<span className="game-clock">{game.clock.inIntermission?'Intermission':game.clock.timeRemaining}</span>}</span>;
  return <time dateTime={game.startTime}>{startTime(game.startTime)}<span className="sr-only"> Eastern Time</span></time>;
}
function WhereToWatch({game,region}) {
  const watch = getBroadcasts(game,region);
  return <div className="watch-block"><p className="watch-label">Where to watch</p><div className="watch-guide">
    {watch.exclusivePrime ? <div className="watch-channel"><NetworkLogo name="Prime Video"/><div><strong>Prime Video</strong><span>Streaming exclusive</span></div></div> : watch.channels.length ? <>
      {watch.channels.map(channel=><div className="watch-channel" key={channel.name} title={`${channel.streaming?'Streaming':'TV'}${channel.french?' · French':''}${!channel.national?' · regional':''}`}><NetworkLogo name={channel.name}/><div><strong>{channel.name}</strong><span className="sr-only">{channel.streaming?'Streaming':'TV'}{channel.french?' · French':''}{!channel.national?' · regional':''}</span></div></div>)}
      {watch.onlyStreaming&&<p className="watch-note">No TV channel listed.</p>}
      {watch.regional&&region!=='ottawa'&&<p className="watch-note">Regional blackouts apply.</p>}
    </> : <div className="watch-unavailable"><span>{watch.outOfMarket?'Out of market':'Not yet confirmed'}</span><a className="watch-coverage" href={watch.outOfMarket?outOfMarketGuide:broadcastGuide} target="_blank" rel="noreferrer">{watch.outOfMarket?'Check options':'Check listings'} <ArrowUpRight size={13}/></a></div>}
  </div></div>;
}
function Scores({version,teamsFeed,onRetryTeams}) {
  const [date,setDate]=useState('now');
  const favourites=useFavouriteTeams();
  const [pickerOpen,setPickerOpen]=useState(false);
  const region='ottawa';
  const feed=useHomeFeed(`/api/scores${date==='now'?'':`?date=${date}`}`,version,30_000);
  const day=feed.data?.date || (date==='now'?etDate():date);
  const games=feed.data?.games||[];
  const favouritesOnly=favourites.preferences.filter==='favourites';
  const shownGames=favouritesOnly?filterFavouriteGames(games,favourites.preferences.teams):games;
  const now=etDate();
  return <section className="panel score-panel" aria-labelledby="scores-heading">
    <div className="score-toolbar">
      <div className="score-date-actions">
        <div className="game-date-controls" role="group" aria-label="Browse game dates">
          <button aria-label="Previous day" onClick={()=>setDate(shiftDate(day,-1))} disabled={day<=shiftDate(now,-365)}><ArrowLeft size={18} aria-hidden="true"/></button>
          <button className={day===now?'selected':''} aria-current={day===now?'date':undefined} onClick={()=>setDate('now')}>Today</button>
          <button aria-label="Next day" onClick={()=>setDate(shiftDate(day,1))} disabled={day>=shiftDate(now,365)}><ArrowRight size={18} aria-hidden="true"/></button>
        </div>
        <div className="game-date-picker"><label className="sr-only" htmlFor="game-date">Choose a date</label><input type="date" id="game-date" min={shiftDate(now,-365)} max={shiftDate(now,365)} value={day} onChange={e=>{if(e.target.value)setDate(e.target.value);}}/></div>
      </div>
      <div className="score-day-strip" role="group" aria-label="Quick game dates">{[-3,-2,-1,0,1,2,3].map(offset=>{const value=shiftDate(day,offset);const parsed=new Date(`${value}T12:00:00Z`);return <button key={offset} className={offset===0?'selected':''} aria-label={fullDate(value)} aria-pressed={offset===0} disabled={value<shiftDate(now,-365)||value>shiftDate(now,365)} onClick={()=>setDate(value===now?'now':value)}><span>{parsed.toLocaleDateString('en-CA',{weekday:'short'})}</span><strong>{parsed.getUTCDate()}</strong></button>;})}</div>
      <FavouriteTeams favourites={favourites} teamsFeed={teamsFeed} onRetry={onRetryTeams} open={pickerOpen} setOpen={setPickerOpen}/>
      <div className="score-date-summary"><h2 id="scores-heading" aria-live="polite">{fullDate(day)}</h2><span className="score-meta" role="status">{feed.data?`${favouritesOnly?`${shownGames.length} of ${games.length}`:games.length} ${games.length===1?'game':'games'} · ET`:'Times in ET'}</span></div>
    </div>
    <FeedMessage feed={feed}/>
    {favouritesOnly&&!favourites.preferences.teams.length?<div className="no-games"><h3>Follow a team to get started.</h3><p>Choose your favourite teams to see their games here.</p><button className="text-button" onClick={()=>setPickerOpen(true)}>Choose teams <ArrowRight size={16}/></button></div>:feed.data&&shownGames.length===0&&!feed.error&&<div className="no-games"><h3>{favouritesOnly?'Your teams aren’t playing on this date.':`No games scheduled${day===now?' today':''}.`}</h3><p>Browse another date for scores and viewing information.</p>{favouritesOnly?<button className="text-button" onClick={()=>favourites.setPreferences(previous=>({...previous,filter:'all'}))}>Show all games <ArrowRight size={16}/></button>:<button className="text-button" onClick={()=>setDate(shiftDate(day,1))}>See tomorrow <ArrowRight size={16}/></button>}</div>}
    <ol className="game-list">{shownGames.map(game=><li className="game-row" key={game.id}>
      <div className="game-status-tab"><GameStatus game={game}/>{game.gameType===3&&<span>Playoffs</span>}{game.gameType===1&&<span>Preseason</span>}</div>
      <div className="game-matchup">
        {[game.away,game.home].map((team,index)=><div key={index} className="score-team" role="group" aria-label={`${team?.name || team?.abbrev || 'To be determined'}${team?.score!=null?`, ${team.score}`:''}${index===0?', away':', home'}`}>
            <TeamLogo team={team}/>
            <span className="score-team-name" aria-hidden="true">{team?.name || team?.abbrev || 'To be determined'}{index===0&&<span className="matchup-at"> @</span>}</span>
            {team?.score!=null&&<strong className="team-score" aria-hidden="true">{team.score}</strong>}
          </div>)}
      </div>
      <WhereToWatch game={game} region={region}/>
    </li>)}</ol>
    <div className="broadcast-footnote">{region==='ottawa'?'Ottawa listings exclude other teams’ regional feeds. ':'Regional blackouts may apply. '}Channel numbers depend on your TV provider. <a href={broadcastGuide} target="_blank" rel="noreferrer">Broadcast guide <ArrowUpRight size={13}/></a></div>
    <div className="panel-foot"><span>{feed.data?.fetchedAt?`Checked ${new Date(feed.data.fetchedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})} · updates every 30 seconds`:'Scores update every 30 seconds'}</span><a href="https://www.nhl.com/scores" target="_blank" rel="noreferrer">NHL.com <ArrowUpRight size={14}/></a></div>
  </section>;
}
function LeagueUpdates({version}) {
  const feed=useHomeFeed('/api/updates',version,300_000);
  return <section className="panel league-updates"><div className="section-heading"><div><h2>Injuries & lineup news</h2></div></div><FeedMessage feed={feed} empty={feed.data&&!feed.data.updates?.length?'No recent injury or lineup reports in the current feed. Check NHL.com for team news.':null}/><ul className="news-list">{feed.data?.updates?.map(item=><li key={item.url}><a href={item.url} target="_blank" rel="noreferrer"><span><time dateTime={item.date}>{dateLabel(item.date.slice(0,10))}</time> · NHL.com</span><strong>{item.title}</strong><ArrowUpRight size={16}/></a></li>)}</ul><div className="panel-foot"><span>Dated reports, not a complete injury list</span><a href="https://www.nhl.com/news/" target="_blank" rel="noreferrer">All NHL news <ArrowUpRight size={14}/></a></div></section>;
}
function PlayoffSeries({version}) {
  const feed=useHomeFeed('/api/playoffs',version,60_000);
  const shown=selectPlayoffSeries(feed.data?.series||[]);
  const rounds=new Set(shown.map(s=>s.round));
  return <section className="panel playoff-panel"><div className="section-heading"><h2>{rounds.size===1?playoffRoundLabel(shown[0].round):'Playoff series'}</h2></div><FeedMessage feed={feed} empty={feed.data&&!shown.length?'Playoff matchups will appear when the NHL confirms them.':null}/><ul className="series-list">{shown.map(s=><li key={s.id}><a href={s.seriesUrl||'https://www.nhl.com/stanley-cup-playoffs'} target="_blank" rel="noreferrer">{rounds.size>1&&<p className="series-round">{playoffRoundLabel(s.round)}</p>}{[[s.topSeedTeam,s.topSeedWins],[s.bottomSeedTeam,s.bottomSeedWins]].map(([team,wins],i)=><div className="series-team" key={i}><TeamLogo team={team}/><span>{team?.name||'To be determined'}</span><strong>{wins??'—'}</strong></div>)}<span className="series-status">{playoffSeriesStatus(s)} <ArrowUpRight size={14}/></span></a></li>)}</ul></section>;
}
export default function SeasonHome({calendar,version,standingsPanel,teamsFeed,onRetryTeams,trades,onCompare,onBrowseTrades,offseasonTrade}) {
  const phase=calendar.data?.phase||'unknown';
  const offseason=phase==='offseason';
  const today=etDate();
  const busyMarket=(trades.data?.trades||[]).filter(t=>t.date>=shiftDate(today,-7)&&t.date<=today).length>=10;
  const lastTrades=(trades.data?.trades||[]).slice(0,busyMarket?5:3);
  return <div className="season-home">

    {calendar.error&&<p className="home-feed-message">Season details are unavailable. Scores and news remain available below.</p>}
    {offseason&&offseasonTrade}
    {phase==='preseason'&&<p className="season-note">Preseason hockey · Regular season begins {dateLabel(calendar.data.dates.regularSeasonStartDate)}.</p>}
    <div className="season-layout"><div className="season-main">{phase==='playoffs'&&<PlayoffSeries version={version}/>}<Scores version={version} teamsFeed={teamsFeed} onRetryTeams={onRetryTeams}/><LeagueUpdates version={version}/></div><div className="season-sidebar">{standingsPanel}<section className={'panel home-trades'+(busyMarket?' market-active':'')}><div className="section-heading"><div><h2>Latest trades</h2></div></div>{trades.loading&&!trades.data?<p className="home-feed-message">Loading trades…</p>:trades.error&&!trades.data?<p className="home-feed-message">Trade updates are temporarily unavailable.</p>:!lastTrades.length?<p className="home-feed-message">No trades are available in the current feed.</p>:<ul>{lastTrades.map(t=><li key={t.id}><button onClick={()=>onCompare(t)}><time dateTime={t.date}>{dateLabel(t.date)}</time><strong>{t.to.abbrev} <ArrowLeftRight size={13} aria-hidden="true"/> {t.from.abbrev}</strong><span>{t.received}</span><ArrowRight size={16}/></button></li>)}</ul>}<div className="panel-foot"><button className="text-button" onClick={onBrowseTrades}>All trades & comparisons <ArrowRight size={15}/></button></div></section></div></div>
  </div>;
}
