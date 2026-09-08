# Project-level SEOScout data

The shared SEOScout checkout and virtual environment live at `D:\Web出海\tools\seoscout`. This directory contains only the current game's configuration, keys, prompts, collected sources, generated MDX, rejected drafts, and reports.

1. Put API keys once in `D:\Web出海\tools\seoscout\keys.env`. First-time machine setup: `pnpm seoscout:setup`.
2. Finish phase A (`基础信息.md`) and phase B (`关键词分类.json`, `languages.json`).
3. Run `pnpm seoscout:run`.

That command prepares `keywords.json`, fills `prompts/generate.md` and `source-policy.json` from researched game data, then runs `seoscout run --keywords keywords.json`. You do not edit `.env`, prompt placeholders, or official domains by hand on each run.

The pipeline uses local Trafilatura extraction and does not use Jina Reader. Generated files are synchronized to `content/` only after the quality gate runs.
