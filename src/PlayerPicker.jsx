import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import './PlayerPicker.css';

const emptySearch = { term: '', players: [], loading: false, error: '' };

async function searchPlayers(term, signal) {
  const response = await fetch(`/api/players/search?q=${encodeURIComponent(term)}`, { signal });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Player search returned an unexpected response. Please try again.');
  }
  if (!response.ok || !Array.isArray(data?.players)) {
    throw new Error('Player search is unavailable. Please try again.');
  }
  return data.players;
}

export default function PlayerPicker({ label, selected, onSelect, autoFocus, inputRef }) {
  const id = useId();
  const inputId = `${id}-input`;
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const rootRef = useRef(null);
  const localInputRef = useRef(null);
  const requestRef = useRef(null);
  const requestVersion = useRef(0);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState(emptySearch);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectionMessage, setSelectionMessage] = useState('');
  const term = query.trim();
  const eligible = term.length >= 2;
  const currentSearch = search.term === term ? search : null;
  const results = currentSearch?.players ?? [];
  const loading = eligible && (!currentSearch || currentSearch.loading);
  const error = currentSearch?.error || '';
  const expanded = open && eligible;
  const activePlayer = expanded ? results[activeIndex] : null;
  const optionId = player => `${id}-option-${player.id}`;

  const setInputRef = useCallback(node => {
    localInputRef.current = node;
    if (typeof inputRef === 'function') inputRef(node);
    else if (inputRef) inputRef.current = node;
  }, [inputRef]);

  useEffect(() => {
    const version = ++requestVersion.current;
    if (!eligible) {
      setSearch({ ...emptySearch, term });
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setSearch({ term, players: [], loading: true, error: '' });
    const timer = setTimeout(async () => {
      try {
        const players = await searchPlayers(term, controller.signal);
        if (controller.signal.aborted || version !== requestVersion.current) return;
        setSearch({ term, players, loading: false, error: '' });
        setActiveIndex(-1);
      } catch (searchError) {
        if (controller.signal.aborted || version !== requestVersion.current) return;
        setSearch({ term, players: [], loading: false, error: searchError.message?.startsWith('Player search') ? searchError.message : 'Player search is unavailable. Please try again.' });
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
      if (requestRef.current === controller) requestRef.current = null;
    };
  }, [query, term, eligible]);

  useEffect(() => {
    const dismissOutside = event => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, []);

  useEffect(() => {
    if (activePlayer) document.getElementById(optionId(activePlayer))?.scrollIntoView({ block: 'nearest' });
  }, [activePlayer, id]);

  function invalidateSearch() {
    // Invalidate synchronously: a response can settle before effect cleanup runs.
    requestVersion.current += 1;
    requestRef.current?.abort();
  }

  function updateQuery(value) {
    invalidateSearch();
    setQuery(value);
    setSearch(emptySearch);
    setActiveIndex(-1);
    setSelectionMessage('');
    setOpen(value.trim().length >= 2);
  }

  function clearSearch() {
    localInputRef.current?.focus();
    updateQuery('');
  }

  function choosePlayer(player) {
    invalidateSearch();
    localInputRef.current?.focus();
    setQuery('');
    setSearch(emptySearch);
    setOpen(false);
    setActiveIndex(-1);
    setSelectionMessage(`${player.name} selected for ${label.toLowerCase()}.`);
    onSelect(player);
  }

  function handleKeyDown(event) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!eligible) return;
      event.preventDefault();
      setOpen(true);
      if (!results.length) return;
      setActiveIndex(index => {
        if (!expanded || index < 0) return event.key === 'ArrowDown' ? 0 : results.length - 1;
        return (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      });
    } else if (event.key === 'Enter' && activePlayer) {
      event.preventDefault();
      choosePlayer(activePlayer);
    } else if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setActiveIndex(-1);
    } else if (event.key === 'Tab') {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const resultMessage = loading
    ? 'Searching players…'
    : error || (results.length
      ? `${results.length} ${results.length === 1 ? 'player' : 'players'} found for ${term}. Use the up and down arrow keys to choose a player, then press Enter.`
      : `No players found for ${term}. Try another name.`);

  return <div className="player-picker" ref={rootRef} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setOpen(false);
      setActiveIndex(-1);
    }
  }}>
    <label htmlFor={inputId}>{label}</label>
    <div className="search-field">
      <Search size={15} aria-hidden="true" />
      <input
        ref={setInputRef}
        id={inputId}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={activePlayer ? optionId(activePlayer) : undefined}
        aria-describedby={hintId}
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        value={query}
        placeholder={selected?.id ? 'Search to change player' : 'Search any NHL player'}
        onChange={event => updateQuery(event.target.value)}
        onFocus={() => setOpen(eligible)}
        onKeyDown={handleKeyDown}
      />
      {query && <button type="button" aria-label={`Clear ${label.toLowerCase()} search`} onClick={clearSearch}><X size={14} aria-hidden="true" /></button>}
    </div>
    <span className="sr-only" id={hintId}>Type at least two characters to search NHL players. Use the up and down arrow keys to review results, Enter to select, and Escape to close.{selected?.id ? ` Current selection: ${selected.name}.` : ''}</span>
    <div className="search-results" hidden={!expanded}>
      {(loading || error || !results.length) && <p>{loading ? 'Searching…' : error || 'No players found. Try another name.'}</p>}
      <ul id={listId} role="listbox" aria-label={`${label} search results`} aria-busy={loading}>
        {results.map((player, index) => <li
          key={player.id}
          id={optionId(player)}
          role="option"
          aria-selected={index === activeIndex}
          className={`player-option${index === activeIndex ? ' is-active' : ''}`}
          onPointerDown={event => event.preventDefault()}
          onPointerMove={event => { if (event.pointerType === 'mouse') setActiveIndex(index); }}
          onClick={() => choosePlayer(player)}
        ><span>{player.name}</span><small>{player.team || 'NHL'} · {player.position}</small></li>)}
      </ul>
    </div>
    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{selectionMessage || (expanded ? resultMessage : '')}</span>
  </div>;
}
