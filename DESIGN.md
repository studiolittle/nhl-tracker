---
name: Puck Haul
description: Responsive NHL scores, viewing information, standings, trades and comparisons.
colors:
  canvas: "#0d1420"
  surface: "#172231"
  surface-alt: "#233247"
  input: "#111b29"
  text: "#f2f7ff"
  text-secondary: "#c5d5e8"
  muted: "#a1b5cc"
  line: "#2b3c52"
  line-strong: "#4e6581"
  accent: "#7bc6ff"
  selected: "#183953"
  success: "#8bc6a7"
  warning: "#e6bf82"
  warning-bg: "#352e24"
  light-canvas: "#f1f6fc"
  light-surface: "#ffffff"
  light-surface-alt: "#e8f0fa"
  light-input: "#f5f8fd"
  light-text: "#17283f"
  light-text-secondary: "#405771"
  light-muted: "#536c88"
  light-line: "#d8e3f0"
  light-line-strong: "#a3b7cf"
  light-accent: "#1767a5"
  light-selected: "#e0effc"
  light-success: "#307351"
  light-warning: "#815a20"
  light-warning-bg: "#fcf2e2"
typography:
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2.25rem)"
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "-.035em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-.45px"
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.5
  team-name:
    fontFamily: "Manrope, sans-serif"
    fontSize: ".9375rem"
    fontWeight: 650
    lineHeight: 1.4
  score:
    fontFamily: "Manrope, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1.2
  network-label:
    fontFamily: "Manrope, sans-serif"
    fontSize: ".6875rem"
    fontWeight: 700
    lineHeight: 1.4
rounded:
  tag: "4px"
  button: "6px"
  navigation: "8px"
  date: "10px"
  panel: "14px"
spacing:
  space-1: "4px"
  space-2: "8px"
  space-3: "12px"
  space-4: "16px"
  space-5: "24px"
  space-6: "32px"
components:
  button-primary:
    backgroundColor: "{colors.text}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.button}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.accent}"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    padding: "4px 8px"
  date-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.accent}"
    rounded: "{rounded.date}"
    padding: "6px 4px"
  date-input:
    backgroundColor: "{colors.input}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.navigation}"
    padding: "8px"
  network-label:
    backgroundColor: "{colors.surface-alt}"
    textColor: "{colors.text}"
    rounded: "{rounded.tag}"
    padding: "3px 6px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
---

# Design System: Puck Haul

## Overview

This documents the implemented mobile styling refinement of the existing Puck Haul interface. The user selected SportsToday.ca mobile as the visual reference and requested a more modern font. The resulting interface uses Manrope, cool navy surfaces and ice-blue selection states, with compact score rows and visible primary destinations.

The NHL scores, Ottawa broadcast listings, standings, trade wire and player comparisons retain their existing roles. This handoff describes the current implementation; it does not establish a new product identity.

**Key Characteristics:**
- One modern font across the interface.
- Compact stacked team rows with aligned scores and a left status column.
- Persistent Home, Trades and Standings tabs on phones.
- Tonal surfaces, thin dividers and restrained accent use.

## Colors

### Primary

Ice blue is the dark theme accent for selected dates, active navigation and links, reflecting the user’s hockey and ice direction. The selected background supplies a quiet blue fill. Live and healthy status retain a separate muted green success color.

### Neutral

Canvas is the page and sticky header background. Surface holds panels; surface-alt marks hover states and network labels. Input separates fields from surrounding panels. Text, text-secondary and muted form the reading hierarchy; line and line-strong separate content and controls.

The light-prefixed tokens record the corresponding light theme overrides. The theme switch changes the same semantic CSS properties; components should use those properties rather than hard-code the dark palette. Warning and warning-bg identify source or loading notices. Team colors remain contextual to trade and comparison content, with darker team ink on light surfaces.

## Typography

Manrope is self-hosted as variable WOFF2 files (weights 400–800), with a sans-serif fallback, font-display swap and no synthesized weights. The Latin subset is preloaded in index.html.

The frontmatter records desktop roles. At phone widths (≤760px), the page headline uses 1.5rem with 1.25 line-height; section titles retain the 1.25rem scale. At ≤540px, score team names use .8125rem and scores use 1rem. Network labels remain small supporting text. Scores, dates, standings and comparison numbers use tabular figures.

Comparison player names use 2.2rem on larger screens and clamp(.9375rem, 4vw, 1.25rem) at ≤760px, with wrapping and a 1.3 line-height. Comparison statistic values reduce to 1.5rem at that breakpoint.

## Layout

The main frame is centered with a 1440px maximum width and 28px horizontal padding. Home uses a main/sidebar grid (1.8fr / 1fr, sidebar minimum 320px), a 24px gap and a single column at ≤850px. At ≤1050px the grid becomes 1.5fr / 1fr with a 300px sidebar minimum. Phone main padding becomes 12px at ≤760px; the main and sidebar internal gaps become 20px.

The sticky header shows Home, Trades and Standings in one evenly divided row at ≤760px, below the brand and icon-only theme control. Each tab has a 48px minimum height and the active tab has a ice-blue underline. Desktop tabs use rounded selected fills.

Scores have a left status/time column (92px desktop; 68px at ≤540px) and a flexible matchup column. Away and home teams stack vertically, with logos, full names and right-aligned scores. Viewing labels sit beneath the matchup. The date strip shows seven days on desktop and five at ≤540px by hiding the outer two buttons. Date buttons are at least 44px wide and 60px high. At ≤360px, previous/Today/next controls occupy one full row and the native date input occupies its own row.

Trade and comparison layouts stack as their available width decreases; comparison becomes one column at ≤900px, and player search fields stack at ≤440px. Standings use their own container query at ≤560px to show abbreviations visually while retaining full names for assistive technology.

## Elevation & Depth

Most surfaces rely on tonal layering and thin borders. The search-results popover uses the existing shadow-pop token (0 12px 28px #0004). The sticky header is layered above page content. The latest-trade reveal uses a .7s clip-path animation with ease-out and a .12s stagger; reduced-motion preferences disable this animation and smooth scrolling.

## Shapes

Panels have softly rounded corners. Small network tags use tighter corners; buttons, fields and date tiles step up in radius as recorded above. Phone navigation tabs use square edges and an underline. Game rows share the panel surface and are separated by single dividers instead of individually framed cards.

## Components

- **Primary actions:** light text-colored fill with canvas-colored text; ice blue on hover. The standard action has a 46px minimum height, while the latest-trade action uses 44px.
- **Text actions:** accent text, transparent background, 44px minimum height and underlined hover state.
- **Fields:** input-colored fill, a thin line border and inherited Manrope. Search containers change border to accent on focus-within.
- **Dates:** the selected tile uses a ice-blue border, selected fill and ice-blue text; other tiles use muted labels and bright tabular day numbers. Native date input stays available beside the day controls, or below them on the narrowest phones.
- **Network labels:** small tonal tags with compact network logos and names. Broadcast metadata remains available through accessible text; the current score surface is scoped to Ottawa listings and ET times.
- **Score rows:** status at left, full team names stacked, scores aligned at right, broadcast tags below. Names can wrap; scores remain separate from the name column.
- **Schedule favourites:** All games / Favourites controls use the selected ice-blue surface. Teams opens an inline searchable list, with pressed star buttons and a Done action. The list has two columns on desktop and one on phones, a bounded scroll area, and 48px minimum team targets. Team selections and filter mode persist on the device.
- **Navigation:** the same three destinations persist across breakpoints. Phone tabs remain visible as part of the sticky header.
- **Focus:** interactive elements use a 3px accent outline with 4px offset. Trade rows use an inward outline offset; search inputs defer the treatment to their container.

## Do's and Don'ts

### Do:
- Do use Manrope and semantic theme properties across new UI.
- Do preserve full score team names, wrapping space and separate aligned scores.
- Do keep all three primary phone destinations visible.
- Do keep native date selection usable at narrow widths.
- Do retain visible focus and reduced-motion behavior.

### Don't:
- Don't replace the Puck Haul name or infer a new brand identity from this refinement.
- Don't let compact viewing labels crowd the team-name column.
- Don't apply desktop comparison-name sizes to phones.
- Don't treat synthesized sidecar tonal ramps as implemented theme tokens.

<!-- Extraction: src/styles.css, src/SeasonHome.css, src/SeasonHome.jsx, src/main.jsx and index.html. Final Home review captures: .impeccable/review/mobile.png and desktop.png. -->

## Polish pass · October 10, 2026

Date navigation and schedule filters now have a shared inset surface, while selected trade and standings tabs use the existing ice-blue accent. Live games show the period and clock on separate lines. Standings rows use 14px vertical padding, and mobile trade rows have a single layer of padding so package descriptions retain more room.

Search fields have a visible focus outline and 44px clear controls. Focus rings stay inside scrollable team and trade rows. Trade announcement controls wrap on narrow phones, automatic-update indicators use blue, and disabled controls use a not-allowed cursor. The standings shortcut appears after team data is available.

The date field is 50px high to align with the grouped navigation; the selected date retains a quieter ice-blue border. Empty schedules use centered messaging. Palette, font, content sources and navigation destinations are preserved.
