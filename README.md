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

- Confirmed trades from the current season's official NHL trade tracker, with complete trade packages and original article links. Search by player or team.
- All 32 teams' regular-season standings, including points, games played, wins, losses, and overtime losses. Filter by conference.
- Searchable player comparisons with regular-season statistics from the same selected season. Stats combine all NHL team stints. Goalies use goalie metrics; missing stats are explicitly labeled.
- Open a trade to compare its first players and view statistics for all named players in both packages. Draft picks and future considerations retain their source descriptions.
- Dark mode by default, a persistent light/dark switch, and responsive mobile navigation.
- Automatic five-minute refresh, loading/error states, and clearly marked stale data if a previously successful upstream request fails.

## Data sources and limits

- Trades: https://www.nhl.com/news/topic/trade-coverage/ (the seasonal tracker URL rolls over July 1).
- Standings: https://api-web.nhle.com/v1/standings/now
- Players: NHL player landing endpoints and NHL player search.

The NHL endpoints are public but are not a contractual API: schemas, page markup, availability, and rate limits can change. Trade parsing fails visibly if the page cannot be read. Sources are fetched on the server to avoid browser CORS issues. Data is cached in memory for five minutes (15 minutes for player stats), and concurrent requests are coalesced. Refresh checks these caches; it does not bypass upstream TTLs. No fabricated or sample data is used as a fallback. A restart clears cached data.

The trade tracker covers completed trades since July 1, rather than a full trade-history database. Comparisons default to the previous season, which is more useful during preseason. Current team and selected stats season are labeled separately. The trade view preserves source wording for pick conditions; open the linked announcement for full legal conditions and retained-salary terms.

The app is deployed on Vercel. It has no accounts, notifications, or persistent ingestion. NHL marks and player images belong to their owners. This is an independent dashboard.

## Name and search metadata

The product name is Puck Haul. The plain-text header intentionally has no logo. The existing repository and Vercel project keep their technical names.

The public origin is https://nhl-tracker-alpha.vercel.app/. Titles, descriptions, canonical URL, Open Graph and Twitter cards, and WebSite JSON-LD are in index.html. The sharing image is public/puck-haul-social.png. public/robots.txt references public/sitemap.xml.

After connecting a custom domain, update all public-origin references in index.html, public/robots.txt, public/sitemap.xml, and this README together. Do not point canonical or sharing URLs at an unregistered domain. The old theme storage key is read only to migrate existing visitors’ preferences.
