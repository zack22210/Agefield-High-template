# Project-level SEOScout data

The shared SEOScout checkout and virtual environment live at `D:\Web出海\tools\seoscout`. This directory contains only the current game's configuration, keys, prompts, collected sources, generated MDX, rejected drafts, and reports.

1. Copy `.env.example` to `.env` and add the Serper and OpenAI-compatible LLM keys.
2. Fill `站点数据采集目录/关键词分类.json` and `languages.json`.
3. Run `pnpm research:prepare`.
4. Replace the two uppercase placeholders in `prompts/generate.md` with the researched game name and official game URL.
5. Add the game, developer, publisher, and official platform domains to `source-policy.json`.
6. Run `pnpm seoscout:run`.

The pipeline uses local Trafilatura extraction and does not use Jina Reader. Generated files are synchronized to `content/` only after the quality gate runs.
