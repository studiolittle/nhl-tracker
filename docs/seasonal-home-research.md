# Seasonal Home: research and display rules

Checked October 9, 2026. Home is a working scoreboard, with no promotional introduction or explanatory season banner. Scores and broadcasts are the main task; standings, injury/lineup reporting, and trades remain available.

## Trade timing

Official NHL counts show concentrated activity around the deadline: 23 trades on March 8, 2024; 24 on March 7, 2025; and 20 trades involving 33 players on March 6, 2026.

- [2026 NHL trade deadline statistics pack](https://media.nhl.com/site/vasset/public/attachments/2026/02/19549/NHLStatsPack-2026NHLTradeDeadline.pdf)
- [NHL Morning Skate, March 7, 2026](https://media.nhl.com/site/vasset/public/attachments/2026/03/19594/MorningSkate_030726FINAL.pdf)

The official seasonal trackers also show a draft-weekend concentration. Manual counts, including pick-only swaps: 25 entries on June 27–28, 2025 (6 + 19), and 34 on June 26–27, 2026 (13 + 21).

- [2024–25 trade tracker](https://www.nhl.com/news/2024-25-nhl-trades)
- [2025–26 trade tracker](https://www.nhl.com/news/topic/trade-coverage/2025-26-nhl-trades)

These are two useful peaks for product planning, not a claim that a measured majority of all annual trades occurs on those dates. No unconfirmed future deadline is hardcoded.

## Home ordering

- Determine preseason, regular season, playoffs, and offseason from the NHL schedule response's season boundary dates in Eastern time. Missing/invalid bounds leave the phase unknown and keep scores/news available.
- Regular season: scores and broadcasts first, current standings alongside, followed by dated lineup/injury reporting and a compact trade list.
- Playoffs: current series first, including unfinished series from overlapping rounds, then daily games and broadcasts.
- Offseason: latest trade leads; scores/date navigation, news, standings, and trade history remain available.
- At least ten confirmed trades in the past seven days moves the compact trade list above standings and expands it from three entries to five. This threshold is a design choice, not a research statistic. Games remain the main column.

The [official 2026–27 schedule announcement](https://www.nhl.com/news/nhl-announces-2026-27-regular-season-schedule) places the regular season between September 29 and April 10. The implementation reads boundaries from the feed so dates are not coupled to this season.

## Broadcasts for Ottawa, Ontario

Use the game's NHL `tvBroadcasts` records rather than infer a broadcaster from the day of the week. Display the network/app logo, name, and TV/streaming medium beside the game clock or start time in a wrapping row directly below the matchup and score, without a disclosure control. Show unknown coverage honestly. Do not invent a provider-specific channel number.

- Keep national Canadian listings and home/away regional listings for Ottawa or Montreal. Broader Canada/US selections show those countries' listings with regional-blackout qualification.
- Exclude Sportsnet+ when an Ottawa/Montreal game also has regional Canadian coverage, since a nominal country-wide streaming record does not override local blackouts.
- If the only Canadian records are national Prime Video records within the confirmed 2026–2038 rights period, label Prime Video as a “Streaming exclusive.” A US regional Prime listing never triggers this label. Other streaming-only listings say no TV channel is listed, without claiming exclusivity.
- If no usable Ottawa listing exists for a nonlocal game, point to out-of-market coverage for checking availability. This is not a guarantee of carriage.

Sources:

- [Amazon: NHL on Prime Video in Canada](https://advertising.amazon.com/en-ca/library/news/nhl-prime-video-canada/) — national Wednesday hockey beginning in 2026–27 and select playoff coverage.
- [NHL: Prime's Canadian Wednesday agreement](https://www.nhl.com/news/prime-video-becomes-long-term-home-of-nhl-in-canada-for-wednesday-night-hockey)
- [Senators extend TSN broadcast deal](https://www.nhl.com/senators/news/senators-extend-broadcast-deal-with-tsn) — TSN5 regional coverage.
- [NHL broadcast and blackout lookup](https://www.nhl.com/info/watch-nhl-zipcode-blackout-lookup)
- [Sportsnet: regional blackouts](https://support.sportsnetplus.ca/hc/en-gb/articles/46382278933780-Are-there-NHL-regional-blackouts-on-Sportsnet)

## Freshness and uncertainty

Scores poll every 30 seconds while visible; series every minute; lineup reports, standings and trades every five minutes. Season boundaries are cached for one hour. Cached responses retain their timestamp and show a saved-data notice after a failed update.

Injury/lineup content is at most six linked NHL.com reports from the past seven days, selected from dated news cards. Headlines remain source wording; this is not a complete structured injury roster and does not assert that every reported injury remains active. Empty feeds, missing teams, missing scores, unconfirmed broadcasts, and unknown playoff results are explicit states.
