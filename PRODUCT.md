# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 15 App Router, strict TypeScript, next-intl, root-level MDX content, Tailwind CSS, shadcn/ui conventions, and lucide-react.

## Users

Players researching a selected non-Roblox game who want concise, source-aware answers about platforms, release information, systems, progression, and other high-intent questions.

## Product Purpose

A reusable, English-first fan wiki foundation. A new project begins with only a game name and domain, becomes a researched homepage in Phase A, and becomes a multilingual article library after the user supplies keywords in Phase B.

## Positioning

The site separates verified information from unknowns and never invents walkthroughs, codes, rewards, dates, mechanics, prices, or community links.

## Capabilities and Constraints

- The homepage keeps the existing Hero, Status, Facts, Story, Release, and content-index framework.
- Any homepage section may be rewritten or disabled when it does not fit the selected game.
- Visual styling may change per game, including fonts, palette, imagery, spacing, and layout expression, while the routing, content, localization, SEO, legal, advertising, and responsive framework remains intact.
- English uses URLs without an `/en` prefix. A researched site may support up to three additional non-Chinese locales.
- Homepage and shared copy live in locale JSON. Article bodies live in `content/<locale>/<category>/` as MDX.
- Empty templates and homepage-only projects must build without fake articles.
- Categories, navigation, content directories, locale files, and sitemap entries must stay synchronized.
- Advertising positions remain present, but deployment and advertising keys are outside template setup.

## Source Policy

Official game sites, developers, publishers, first-party platform stores, official social channels, and official videos are preferred. Established game media may supplement primary sources. Competitor wikis, aggregation wikis, broken links, piracy, key resellers, unofficial downloads, scripts, cheats, exploits, and automation tools are excluded.

## Product Principles

- Put the verified answer before supporting detail.
- Hide or label unavailable information instead of guessing.
- Keep an empty clone understandable and operational.
- Let the selected game's art direction shape presentation without destabilizing the reusable framework.
- Make source, category, locale, navigation, and sitemap consistency machine-checkable.
