# Non-Roblox Game Wiki Template

A reusable Next.js game-wiki starter for PC, console, mobile, and cross-platform games outside Roblox. The repository ships without a selected game, published articles, external community links, or gameplay claims. Its current homepage framework, localization, MDX loader, SEO metadata, legal pages, advertising positions, and validation tools are ready for a researched replacement.

## Local development

```bash
pnpm install
pnpm dev
```

Set `NEXT_PUBLIC_SITE_URL` in `.env.local` before deployment so canonical URLs, Open Graph metadata, `robots.txt`, and the sitemap use the production origin.

## Start a new game site

The complete Chinese workflow is in `WORKFLOW.md` and enforced by `AGENTS.md`.

1. Provide the game name and domain.
2. Research the game and fill `站点数据采集目录/基础信息.md`, `首页探索模块.json`, and `languages.json`.
3. Replace placeholder identity, verified links, theme, favicon, Hero, optional Story media, and legal/SEO data.
4. Paste manually collected keywords into `站点数据采集目录/原始关键词.txt`.
5. Save the reviewed categories to `站点数据采集目录/关键词分类.json`.
6. Run `pnpm research:prepare` and `pnpm seoscout:run`.
7. Synchronize navigation and locales, then run `pnpm validate:links` and `pnpm validate:all`.

The `content/` directory must remain present even when empty because the MDX loader scans it during compilation.

## SEOScout

SEOScout is installed once at `D:\Web出海\tools\seoscout`. Each game project keeps only its own keys, prompts, collected data, generated articles, and quality report under `seoscout/`.

Copy `seoscout/.env.example` to `seoscout/.env`, add the Serper and OpenAI-compatible LLM keys, then run:

```bash
pnpm seoscout:setup
pnpm seoscout:run
```

Missing articles with insufficient source material are recorded in `seoscout/quality-report.json` instead of being fabricated.
