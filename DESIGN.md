---
name: Neutral Game Wiki Framework
description: A source-aware game reference shell ready to adopt a selected title's visual identity.
colors:
  signal-cyan: "hsl(199 89% 48%)"
  signal-gold: "hsl(43 90% 64%)"
  paper: "hsl(220 29% 94%)"
  paper-bright: "hsl(210 40% 98%)"
  ink: "hsl(226 34% 12%)"
  utility-navy: "hsl(229 43% 7%)"
  muted-copy: "hsl(220 12% 38%)"
  rule-line: "hsl(218 20% 82%)"
  white: "hsl(0 0% 100%)"
typography:
  scale:
    micro-8: "8px"
    micro-9: "9px"
    micro-10: "10px"
    micro-11: "11px"
    small-12: "12px"
    small-13: "13px"
    small-14: "14px"
    small-15: "15px"
    body-16: "16px"
    body-17: "17px"
    body-18: "18px"
    body-19: "19px"
    body-20: "20px"
    title-23: "23px"
    title-24: "24px"
    title-27: "27px"
    title-28: "28px"
    display-34: "34px"
    display-36: "36px"
    display-38: "38px"
    display-48: "3rem"
    display-50: "50px"
    display-54: "3.4rem"
    display-58: "3.6rem"
    display-61: "3.8rem"
    display-66: "4.1rem"
    display-68: "68px"
    display-69: "4.3rem"
    display-72: "4.5rem"
    display-74: "74px"
    display-74-fluid: "4.6rem"
    display-77: "4.8rem"
    display-88: "5.5rem"
    display-96: "6rem"
  display:
    fontFamily: "Bebas Neue Local, sans-serif"
    fontSize: "clamp(4.25rem, 6.2vw, 6rem)"
    fontWeight: 400
    lineHeight: 0.9
    letterSpacing: "-0.02em"
  body:
    fontFamily: "IBM Plex Sans Local, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "IBM Plex Sans Local, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.2
rounded:
  none: "0"
  status-circle: "50%"
spacing:
  compact: "10px"
  component: "24px"
  section: "72px"
  desktop-gutter: "40px"
---

# Design System: Neutral Game Wiki Framework

## Overview

**Creative North Star: “The Verified Game Index”**

The blank template should feel intentional without suggesting a specific game genre. It combines editorial clarity, dark utility regions, cool neutral reading surfaces, and restrained cyan/gold signals. Once a game is selected, imagery, type, color, spacing, and layout expression may change while the information framework, responsive behavior, accessibility, and content model remain intact.

## Core rules

- Use cyan for navigation, structure, links, and active states; reserve gold for secondary emphasis.
- Keep content containers flat. Rules, tonal shifts, and image boundaries establish hierarchy instead of soft shadows.
- Use the condensed display face only for page-defining headings and short facts. Body copy stays in IBM Plex Sans.
- Keep controls and content frames square. Circular shapes are limited to compact semantic markers.
- Treat placeholder SVGs as temporary blank-state assets. Replace them with verified, game-relevant media during Phase A.
- Preserve one H1 per page, visible keyboard focus, readable line length, responsive reflow, and existing advertisement positions.

## Layout

The desktop shell is capped at 1320px with 40px side gutters. The homepage can escape the shell for the hero and split-image sections. Feature copy must be allowed to shrink inside the split grid (`min-width: 0`), uses fluid horizontal padding (`clamp(48px, 5vw, 96px)`), and keeps its display heading to `11ch` at `clamp(3.6rem, 4.4vw, 4.8rem)`. Status, facts, feature, release, and archive modules remain independently configurable so unsuitable modules can be hidden or replaced without changing the surrounding framework.

At 860px, navigation and split layouts collapse, and the theme toggle uses automatic left margin to remain right-aligned in the compact header. At 560px, grids become a single column, gutters reduce to 12px, and controls retain touch-friendly dimensions. An empty archive must remain visible in the blank template so the future content destination is clear.

## Theme adaptation

The neutral palette is the starting state, not a permanent brand. For each selected game, derive the site palette and media treatment from official assets, verify contrast in light and dark themes, and document any durable design changes here. Avoid genre clichés unless the chosen game genuinely supports them.

## Components

- **Hero:** Full-width media with a directional readability overlay, one label, one H1, concise context, and only configured actions.
- **Status strip:** Up to four compact facts. Unverified values use explicit pending copy.
- **Facts:** A structural summary of the research and publishing plan in blank state; verified gameplay facts after replacement.
- **Feature modules:** Image/copy splits that may be rethemed, reordered, hidden, or replaced for the selected game; copy must shrink safely without forcing horizontal overflow, and headings stay deliberately narrow.
- **Archive:** A flat source-aware content index. Empty state is informative and never mimics a clickable article.
- **Navigation:** Only shows configured content groups and locales. Blank state does not render empty menus. On compact headers, the theme toggle remains pushed to the right.

## Do and don’t

- Do use official sources and official media at decisive scale when available.
- Do keep unverified or unpublished states visually honest.
- Do adjust fonts and composition when a selected game benefits from a different voice.
- Don’t retain placeholder artwork after real game media is approved.
- Don’t invent release, platform, pricing, gameplay, or community facts.
- Don’t add rounded card shells, decorative gradients, or new color literals without a deliberate theme decision.
