# Puck Haul

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

- Home follows the NHL calendar: scores, viewing information and standings during the regular season; series progress during the playoffs; latest trades lead in the offseason.
- Daily scores and start times in Ottawa time, with always-visible TV networks and streaming apps. Listings currently use Ottawa as the viewing region. Compact date controls let visitors browse other days. Confirmed Canadian Prime exclusives are labeled explicitly.
- Dated injury and lineup reports from NHL.com, linked to the original reporting.
- Favourite teams: choose teams from the schedule's Teams picker, then switch between All games and Favourites. Selections and the active filter are saved on this device; games include both home and away appearances.
- Confirmed trades from the current season's official NHL trade tracker, with complete trade packages and original article links. Search by player or team.
- All 32 teams' regular-season standings, including points, games played, wins, losses, and overtime losses. Filter by conference.
- Searchable player comparisons with regular-season statistics from the same selected season. Stats combine all NHL team stints. Goalies use goalie metrics; missing stats are explicitly labeled.
- Open a trade to compare its first players and view statistics for all named players in both packages. Draft picks and future considerations retain their source descriptions.
- Dark mode by default, a persistent light/dark switch, and responsive mobile navigation.
- Automatic updates: scores every 30 seconds, playoff series every minute, other dashboard data every five minutes. Loading/error states and saved-data timestamps remain visible when upstream requests fail.

## Data sources and limits

- Trades: https://www.nhl.com/news/topic/trade-coverage/ (the seasonal tracker URL rolls over July 1).
- Standings: https://api-web.nhle.com/v1/standings/now
- Players: NHL player landing endpoints and NHL player search.
- Scores/broadcasts: `https://api-web.nhle.com/v1/score/YYYY-MM-DD`
- Season calendar: `https://api-web.nhle.com/v1/schedule/now`
- Playoff series: `https://api-web.nhle.com/v1/playoff-bracket/YYYY`
- Injury and lineup reports: `https://www.nhl.com/news/`

The NHL endpoints are public but are not a contractual API: schemas, page markup, availability, and rate limits can change. Trade parsing fails visibly if the page cannot be read. Sources are fetched on the server to avoid browser CORS issues. Data is cached in memory for five minutes, except scores (30 seconds), playoff series (one minute), calendar (one hour), and player stats (15 minutes). Concurrent requests are coalesced. Automatic updates respect these cache lifetimes. No fabricated or sample data is used as a fallback. A restart clears cached data.

Broadcasts use each game's country and national/home/away market metadata. Ottawa listings filter regional coverage to Ottawa and Montreal; other regional feeds are excluded. Channel numbers require a TV provider and are not guessed. Out-of-market availability and blackouts must be checked with the provider. Injury stories are recent dated reports, not a complete live injury list. See [seasonal Home research](docs/seasonal-home-research.md) for sources and the exact display rules.

The trade tracker covers completed trades since July 1, rather than a full trade-history database. Comparisons default to the previous season, which is more useful during preseason. Current team and selected stats season are labeled separately. The trade view preserves source wording for pick conditions; open the linked announcement for full legal conditions and retained-salary terms.

The app is deployed on Vercel. It has no accounts, notifications, or persistent ingestion. NHL marks and player images belong to their owners. This is an independent dashboard.

## Name and search metadata

The product name is Puck Haul. The plain-text header intentionally has no logo. The existing repository and Vercel project keep their technical names.

The public origin is https://puckhaul.app/. Titles, descriptions, canonical URL, Open Graph and Twitter cards, and WebSite JSON-LD are in index.html. The sharing image is public/puck-haul-social.png. public/robots.txt references public/sitemap.xml.

The old theme storage key is read only to migrate existing visitors' preferences.
