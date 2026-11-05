# Puck Haul team handbook

Shared briefing for the agents in `.claude/agents/`. Written November 2, 2026 from a full read of the code and docs, the live site at https://puckhaul.app/, and the NHL.com trade tracker.

Code beats this document. If they disagree, trust the code, then update this file.

## What Puck Haul is

A free NHL dashboard for fans who want a quick answer on a phone: who plays, when, where to watch, where the standings sit, what trade just happened. It has no accounts, ads, API keys or database. It is in alpha (the header shows an Alpha tag) and built by Jesse Little of Studio Little. Listings are for Ottawa, in Eastern time.

The product rules live in `PRODUCT.md`. The ones that matter most:

- Never show fabricated, sample or guessed data. Missing data is labelled as missing.
- Failures and stale data are shown, not hidden.
- Never guess a channel number. Blackouts are the provider's to confirm.
- No usage numbers or testimonials exist. Do not invent any.
- The home screen follows the NHL calendar.

## What a visitor sees

Three destinations, always visible, including on phones: **Home**, **Trades**, **Standings**. Scores live inside Home. Compare is a tab inside Trades. `PRODUCT.md` lists them as separate views, but they are not separate pages.

| Route | Shows |
|---|---|
| `#home` | Heading changes by season phase. Scores, Injuries & lineup news, Standings (top 8), Latest trades. |
| `#trades` | Trade wire: search, and a count labelled "since July 1". |
| `#trades/compare` | Compare any two players. |
| `#trades/<id>` | Compare a trade: head to head, package totals, a takeaway, the complete trade. |
| `#standings` | League, Eastern and Western. Conference views draw a playoff line. |

Home by phase, from `getSeasonContext`:

- **Preseason:** adds a note giving the regular-season start date.
- **Regular season:** scores first, standings beside them.
- **Playoffs:** series panel first, then scores. Polled every minute.
- **Offseason:** latest trade leads.
- **Unknown:** used when calendar dates are missing or invalid. Scores and news stay available.

At least 10 trades in the past 7 days moves the trade list above standings and grows it from 3 to 5. That threshold is a design choice, not a statistic.

Compare rules, in `Comparison` in `src/main.jsx`:

- Skaters use GP, G, A and PTS. Goalies use GP, W and SV%.
- A skater and a goalie cannot be compared.
- Package totals count skaters only, and compare points per game.
- No verdict appears under 30 combined games.
- Stats are regular season, NHL only, with all team stints combined.
- The season picker offers the current season and the two before it.

## How it is built

React 19, Vite 7, Express 5, cheerio and lucide-react. Plain JavaScript and CSS, with no TypeScript, CSS framework, router or state library. Dense one-line JSX is the house style in `src/main.jsx` and `src/SeasonHome.jsx`. Match it rather than reformatting.

| File | Role |
|---|---|
| `server/index.js` | Express app: routes, `cached()`, `fetchNhl()`, the NHL-only trade filter |
| `server/nhl.js` | Trade parsing, `playerStats`, `seasonStart`, `hasRecentNhlGames` |
| `server/home.js` | Season phase, game and playoff normalization, news parsing, `trustedUrl` |
| `src/main.jsx` | App shell, hash routing, Trades, Compare, Standings |
| `src/SeasonHome.jsx` | Home, Scores, Where to Watch, news, playoffs, `useHomeFeed` |
| `src/PlayerPicker.jsx` | Accessible player search combobox |
| `src/FavouriteTeams.jsx`, `src/lib/favourites.js` | Favourites, stored on the device |
| `src/lib/broadcasts.js` | Ottawa broadcast rules |
| `src/lib/playoffs.js` | Series selection and status text |
| `src/styles.css`, `src/SeasonHome.css`, `src/PlayerPicker.css` | Styles. Later rules in `styles.css` override earlier ones, so read to the end of the file. |
| `api/*`, `server.js` | Thin re-exports of the Express app for Vercel |
| `index.html` | All SEO metadata, JSON-LD and the noscript content |
| `DESIGN.md` | Design system record |
| `docs/seasonal-home-research.md` | Display rules and rights sources |
| `docs/network-logo-sources.md` | Provenance of the network logos |

API routes: `/api/standings`, `/season`, `/scores?date=`, `/playoffs`, `/updates`, `/trades`, `/players/search?q=`, `/players/:id?season=`.

Commands: `npm run dev` (port 3000, Node 22.12+), `npm test`, `npm run build`, `npm start`.

Tests use `node --test`. There are 41, all passing on November 2, 2026, in `server/*.test.js` and `src/lib/*.test.js`. Nothing tests the React components, and nothing runs end to end. A new data rule needs a test beside the existing ones.

There is no `vercel.json`. `.github/workflows/ci.yml` runs `npm test` and `npm run build` on pull requests and pushes to main.

## How data flows

| Data | Upstream | Server cache | Client refresh |
|---|---|---|---|
| Scores and broadcasts | `api-web.nhle.com/v1/score/{date}` | 30 s | 30 s, paused while the tab is hidden |
| Playoff series | `api-web.nhle.com/v1/playoff-bracket/{year}` | 1 min | 1 min, paused while hidden |
| Standings | `api-web.nhle.com/v1/standings/now` | 5 min | 5 min |
| Season calendar | `api-web.nhle.com/v1/schedule/now` | 1 h | 5 min |
| Injury and lineup news | Cards scraped from `nhl.com/news/` | 5 min | 5 min |
| Trades | Paragraphs scraped from the seasonal tracker | 5 min, plus CDN | 5 min |
| Player stats | `api-web.nhle.com/v1/player/{id}/landing` | 15 min | On demand |
| NHL-player status | Search plus player landing | 24 h | Server only |
| Player search | `search.d3.nhle.com` | None, on purpose | 300 ms debounce |

- `cached()` holds data in memory, merges concurrent requests, and serves old data marked `stale: true` when a refresh fails. The cache holds at most 1,000 entries, and a failed refresh is remembered for up to 15 seconds (never longer than the entry's own lifetime), so an outage is not retried on every request.
- On Vercel that memory belongs to one function instance and is lost on a cold start.
- CDN headers: `/api/trades` sets `s-maxage=300, stale-while-revalidate=3600`; standings, season, scores, playoffs and updates set `max-age=0, s-maxage=15`; player stats set `s-maxage=300`; player search sets none. Saved (stale) responses are never edge-cached. Before this change, on November 2, every poll reached a function. Not yet confirmed on the live site.
- Broken NHL requests return a 502 with one friendly message. `/api/scores` returns a 200 with an `error` field for an invalid date.
- `trustedUrl` limits outbound links to `nhl.com` and images to `assets.nhle.com`. Keep that for any new link or image taken from upstream data.

The endpoints are public but not contractual. Schemas, markup and rate limits can change without notice.

## Ottawa broadcast rules

From `src/lib/broadcasts.js`:

- Keep Canadian national listings, plus home or away regional listings for `OTT` and `MTL`. Both teams count as local for Ottawa.
- Drop Sportsnet+ when a local game also has regional Canadian coverage, because the national record does not override a blackout.
- Prime Video is a "Streaming exclusive" only when every Canadian listing is national Prime, within the 2026-27 to 2037-38 rights window. A US Prime listing never counts.
- No usable listing means "Out of market" for a non-local game and "Not yet confirmed" for a local one. Neither promises coverage.

On November 2, two of four games were "Out of market". That is expected.

## Trades and the NHL-only filter

`parseTrades` reads `<p>` tags in this format: `MONTH D: Team acquire X from Team for Y`. `onlyNhlTrades` then removes trades where no named player has NHL games this season or last. Lookups have a 7 second budget, and a trade is kept if a lookup fails or runs out of time.

Picks-only trades have no named players, so they are removed too. On November 2 the tracker had 26 dated entries, all 26 parsed, and 19 were shown after the parser fixes. That gap is the filter working as intended, but neither the site nor the README tells visitors about it.

## Copy and language

- Canadian English in prose: favourite, colour. Player positions use NHL source wording.
- Trade text and news headlines stay in source wording.
- Short, plain and specific. Say what happened and what to do next.
- The product is **Puck Haul**. The header renders it as a lowercase wordmark, with no logo.
- Dates and times use Eastern time, labelled "ET" or "Eastern Time".

## Known issues

Status at November 2, 2026. Check that an issue still exists before acting on it. **Confirmed** means reproduced on the live site or with a direct test. **From code** means read in the code but not observed.

### Trades

1. **Fixed in code, check that it is deployed: a trade was missing.** The October 15 Maple Leafs and Canucks trade (Aatu Räty) was skipped because the entry says "acquired". The parser now accepts both wordings.
2. **Fixed in code, check that it is deployed: a player was dropped.** The October 23 trade showed 3 of its 4 named players, because `extractTradePlayers` lost Alexander Command. It now checks each list item on its own.
3. **Fixed in code, check that it is deployed: other name errors.** Comma lists, conditional picks, `cash`, `the rights to` and players listed with future considerations now parse correctly. Each has a test. Names containing a comma, such as `X, Jr.`, would split into two items.
4. **Confirmed: two parsers still disagree.** `tradePlayerNames` in `src/main.jsx` is an older copy of the logic in `extractTradePlayers`. The client prefers the server's result, but `Comparison` still uses the old copy to choose its first players. Remove it.
5. **Confirmed with test input: three-team trades are misread.** The whole phrase "Toronto Maple Leafs and the Boston Bruins" becomes one team, with the abbreviation `TMLatBB`.
6. **Confirmed: trade links are unstable.** Ids are `date-index` and the tracker lists newest first, so each new trade renumbers older ones. Shared `#trades/<id>` links can break. Do not promote them until this is fixed.
7. **From code: possible early-July outage.** The tracker URL rolls over on July 1 at 00:00 UTC, which is 8 p.m. ET on June 30. An empty or missing new tracker makes `/api/trades` fail, with no older data to fall back on, during the offseason when trades lead Home.
8. **Fixed.** `/api/trades` no longer fails when standings fail: it falls back to the 32-club table in `server/teams.js` (update it if a club is added or renamed). Without standings, logos come from the client's `assets.nhle.com` fallback.

### Interface

9. **Fixed (refresh flash).** Data stays on screen during a refresh, and a failed refresh keeps it with a notice and Try again. The 5-minute and 30-second timers pause in hidden tabs and refresh on return (`src/lib/polling.js`).
10. **Confirmed: dead CSS.** No component uses `.mobile-navigation`, `.menu-toggle`, `.segmented`, `.dashboard-grid`, `.verdict` or `.latest-foot`. The full-screen phone menu was replaced by persistent tabs.
11. **Fixed.** The footer and the no-JavaScript page say Puck Haul is an independent fan project, not affiliated with or endorsed by the NHL. "Official NHL tracker" and the shield are now "Source: NHL.com trade tracker", and other "official" wording is gone. `server/wording.test.js` guards it. Legal wording not yet confirmed by a lawyer.
12. **Confirmed: grammar.** Plural team names read "Nashville Predators gets".
13. **Confirmed: date formats differ.** `src/main.jsx` formats dates as en-US and `src/SeasonHome.jsx` as en-CA.

### Docs that no longer match the code

14. The README says Compare defaults to the previous season. The app uses the current one, and only the API default is the previous season.
15. **Fixed.** A visible "Where to watch · Ottawa" label appears once above the game list, and each channel tile shows TV or Streaming. Each game keeps a screen-reader label.

### Search

16. **Confirmed: one indexable page.** Views are hash routes, the sitemap has one URL, and `document.title` now changes per view (`src/lib/titles.js`), which helps tabs and screen readers but not search, since the fragment is ignored. Content renders in the browser, and noscript visitors get a short fallback.
17. **Confirmed: no analytics or error tracking.** There is no data on traffic or how people use the site.

## How the team works

| Agent | Owns |
|---|---|
| `puck` | Team leader: routes work, tracks it, reports to Jesse |
| `fullstack-lead` | Features and app architecture |
| `data-reliability-engineer` | Parsers, feeds, data tests |
| `product-designer` | Interface and design system |
| `qa-accessibility-specialist` | Testing and accessibility findings |
| `hockey-data-editor` | Hockey and broadcast accuracy |
| `content-seo-writer` | Words, metadata, search recommendations |
| `growth-community-lead` | Organic growth plans and drafts |
| `legal-licensing-advisor` | Legal and licensing risk flags |
| `partnerships-manager` | Licensed data research |
| `ops-sre` | Vercel health, load and monitoring |

Everyone follows these rules:

- Read this handbook, then the files for your task. Check facts instead of relying on memory.
- Stay in your lane. Name the right teammate when work belongs to them.
- Separate what you observed from what you suspect.
- Report failures and anything you did not check.
- Never read `.env` or `.env.local`, and never print secrets.
- Never commit, push, deploy, post, send, buy or contact anyone unless Jesse asks for that specific action.
- When you confirm or fix a known issue, update this handbook.
