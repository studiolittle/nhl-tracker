# Tape to Tape

A small NHL dashboard built with React, Vite, and Express. No API keys or database required.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:3000. Requires Node.js 22.12+ (tested on Node 24). Set `PORT` to use a different port.

```sh
npm test
npm run build
npm start
```

`npm start` serves the production build and API together. The server binds to localhost by default.

## What works

- Confirmed trades from the current season's official NHL trade tracker, with complete trade packages and original article links. Search by player/team or filter by team.
- All 32 teams' regular-season standings, including points, games played, wins, losses, and overtime losses. Filter by conference.
- Searchable player comparisons with regular-season statistics from the same selected season. Stats combine all NHL team stints. Goalies use goalie metrics; missing stats are explicitly labeled.
- Click a trade to look up the first named player in each package. Picks and players without NHL records require a manual comparison choice.
- Elliotte Friedman's official X timeline, loaded on demand, with a permanent direct profile link. X controls availability and ordering; this is not an authenticated streaming X API integration.
- Automatic five-minute refresh, loading/error states, and clearly marked stale data if a previously successful upstream request fails.

## Data sources and limits

- Trades: https://www.nhl.com/news/topic/trade-coverage/ (the seasonal tracker URL rolls over July 1).
- Standings: https://api-web.nhle.com/v1/standings/now
- Players: NHL player landing endpoints and NHL player search.
- X: https://help.x.com/en/using-x/embed-x-feed and https://x.com/FriedgeHNIC

The NHL endpoints are public but are not a contractual API: schemas, page markup, availability, and rate limits can change. Trade parsing fails visibly if the page cannot be read. Sources are fetched on the server to avoid browser CORS issues. Data is cached in memory for five minutes (15 minutes for player stats), and concurrent requests are coalesced. Refresh checks these caches; it does not bypass upstream TTLs. No fabricated or sample data is used as a fallback. A restart clears cached data.

The trade tracker covers completed trades since July 1, rather than a full trade-history database. Comparisons default to the previous season, which is more useful during preseason. Current team and selected stats season are labeled separately. The trade view preserves source wording for pick conditions; open the linked announcement for full legal conditions and retained-salary terms.

This first version has no accounts, notifications, persistent ingestion, or deployment configuration. Keep the local server private; before hosting publicly, add appropriate rate limits and operational monitoring. NHL marks and player images belong to their owners. This is an independent dashboard.
