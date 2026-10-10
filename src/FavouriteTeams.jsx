import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, Star } from 'lucide-react';
import { readPreferences, savePreferences } from './lib/favourites.js';

const getStorage = () => window.localStorage;

export function useFavouriteTeams() {
  const [initial] = useState(() => readPreferences(getStorage));
  const [preferences, setPreferences] = useState(initial.preferences);
  const [unavailable, setUnavailable] = useState(initial.unavailable);
  useEffect(() => {
    setUnavailable(!savePreferences(getStorage, preferences));
  }, [preferences]);
  return { preferences, setPreferences, unavailable };
}

export default function FavouriteTeams({ favourites, teamsFeed, onRetry, open, setOpen }) {
  const [query, setQuery] = useState('');
  const manageButton = useRef(null);
  const searchText = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const { preferences, setPreferences, unavailable } = favourites;
  const teams = (teamsFeed.data?.teams || []).toSorted((a, b) => a.name.localeCompare(b.name));
  const shown = teams.filter(team => searchText(`${team.name} ${team.abbrev}`).includes(searchText(query.trim())));
  const toggle = abbrev => setPreferences(previous => ({
    filter: 'favourites',
    teams: previous.teams.includes(abbrev) ? previous.teams.filter(team => team !== abbrev) : [...previous.teams, abbrev],
  }));
  return <div className="schedule-favourites">
    <div className="schedule-filter-bar">
      <div className="schedule-filter-tabs" role="group" aria-label="Filter schedule">
        <button aria-pressed={preferences.filter === 'all'} onClick={() => setPreferences(previous => ({ ...previous, filter: 'all' }))}>All games</button>
        <button aria-pressed={preferences.filter === 'favourites'} onClick={() => {
          setPreferences(previous => ({ ...previous, filter: 'favourites' }));
          if (!preferences.teams.length) setOpen(true);
        }}><Star size={15} aria-hidden="true"/> Favourites{preferences.teams.length > 0 && <span className="favourite-count">{preferences.teams.length}</span>}</button>
      </div>
      <button ref={manageButton} className="manage-teams" aria-expanded={open} aria-controls="favourite-team-picker" onClick={() => setOpen(value => !value)}>Teams <ChevronDown size={15} aria-hidden="true"/></button>
    </div>
    {open && <div id="favourite-team-picker" className="favourite-team-picker">
      <div className="favourite-picker-heading"><h3>Follow your teams</h3><span>{unavailable ? 'Saved for this visit only' : 'Saved on this device'}</span></div>
      <label className="favourite-team-search"><Search size={17} aria-hidden="true"/><span className="sr-only">Find a team</span><input type="search" placeholder="Find a team" value={query} onChange={event => setQuery(event.target.value)}/></label>
      {!teams.length ? <p className="favourite-picker-message" role="status">{teamsFeed.loading ? 'Loading teams…' : <>Team names are unavailable. <button className="text-button" onClick={onRetry}>Try again</button></>}</p> : shown.length ? <ul className="favourite-team-list">{shown.map(team => {
        const selected = preferences.teams.includes(team.abbrev);
        return <li key={team.abbrev}><button aria-pressed={selected} onClick={() => toggle(team.abbrev)}>
          {team.logo && <img src={team.logo} width="24" height="24" alt="" loading="lazy"/>}<span>{team.name}</span><Star size={17} fill={selected ? 'currentColor' : 'none'} aria-hidden="true"/>
        </button></li>;
      })}</ul> : <p className="favourite-picker-message" role="status">No teams match “{query}”. Try another name.</p>}
      <div className="favourite-picker-foot"><span role="status">{preferences.teams.length} {preferences.teams.length === 1 ? 'team' : 'teams'} followed</span><button className="text-button" onClick={() => { setOpen(false); manageButton.current?.focus(); }}>Done</button></div>
    </div>}
    {unavailable && <p className="favourite-storage-message" role="status">Your browser couldn’t save favourites. They’ll stay selected until you leave this page.</p>}
  </div>;
}
