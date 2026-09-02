#!/usr/bin/env python3
"""Replace SEOScout's hosted Jina extraction with local Trafilatura."""

from __future__ import annotations

import argparse
import re
import textwrap
from pathlib import Path


IMPORT_OLD = "import asyncio\nimport aiohttp\nimport time\n"
IMPORT_NEW = "import asyncio\nimport aiohttp\nimport os\nimport time\n\nimport trafilatura\n"
LIMITS_OLD = """        semaphore = asyncio.Semaphore(self.config.JINA_CONCURRENCY)
        rate_limiter = TokenBucket(self.config.JINA_RPM)
"""
LIMITS_NEW = """        semaphore = asyncio.Semaphore(
            int(os.getenv("WEB_EXTRACT_CONCURRENCY", "4"))
        )
        rate_limiter = TokenBucket(int(os.getenv("WEB_EXTRACT_RPM", "45")))
"""
FETCH_PATTERN = re.compile(
    r"                # 使用 Jina Reader\n"
    r".*?"
    r"                        cleaned_content = self\.cleaner\.clean\(content\)\n",
    re.DOTALL,
)
FETCH_NEW = """                # Fetch directly and extract the main text locally.
                headers = {
                    "User-Agent": os.getenv(
                        "WEB_EXTRACT_USER_AGENT",
                        "Mozilla/5.0 (compatible; GameWikiResearch/1.0; +https://github.com/libin257/seoscout)",
                    ),
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
                    "Accept-Language": "en-US,en;q=0.8",
                }
                proxy_url = self.config.get_proxy_url_for_stage("extract")
                timeout = aiohttp.ClientTimeout(
                    total=int(os.getenv("WEB_EXTRACT_TIMEOUT", "45"))
                )

                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.get(
                        item.url,
                        headers=headers,
                        proxy=proxy_url,
                        allow_redirects=True,
                    ) as response:
                        if response.status != 200:
                            if attempt < self.config.WEB_EXTRACT_RETRIES - 1:
                                await asyncio.sleep(2 ** attempt)
                                continue
                            return (item, "")

                        content_type = response.headers.get("Content-Type", "").lower()
                        if "text/" not in content_type and "html" not in content_type and "xml" not in content_type:
                            return (item, "")

                        html = await response.text(errors="replace")
                        extracted = await asyncio.to_thread(
                            trafilatura.extract,
                            html,
                            url=str(response.url),
                            output_format="markdown",
                            include_links=True,
                            include_tables=True,
                            favor_precision=True,
                            deduplicate=True,
                        )
                        if not extracted or len(extracted.strip()) < 500:
                            if attempt < self.config.WEB_EXTRACT_RETRIES - 1:
                                await asyncio.sleep(2 ** attempt)
                                continue
                            return (item, "")

                        cleaned_content = self.cleaner.clean(extracted)
"""
JINA_VALIDATION_OLD = """        if not cls.JINA_API_KEY:
            errors.append("JINA_API_KEY not set (optional, but recommended for higher rate limits)")

"""
JINA_VALIDATION_NEW = """        # Web extraction is local (Trafilatura), so no Jina API key is required.

"""


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one {label} block, found {count}; upstream changed and the patch must be reviewed.")
    return text.replace(old, new, 1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    args = parser.parse_args()

    web_file = args.source / "seoscout" / "core" / "web.py"
    text = web_file.read_text(encoding="utf-8")
    text_before_brand_update = text
    text = text.replace("RobloxWikiResearch/1.0", "GameWikiResearch/1.0")
    if "Fetch directly and extract the main text locally" not in text:
        text = replace_once(text, IMPORT_OLD, IMPORT_NEW, "import")
        text = replace_once(text, LIMITS_OLD, LIMITS_NEW, "rate limiter")
        text, count = FETCH_PATTERN.subn(lambda _: textwrap.indent(FETCH_NEW, "    "), text, count=1)
        if count != 1:
            raise RuntimeError("Expected one Jina fetch block; upstream changed and the patch must be reviewed.")
        web_file.write_text(text, encoding="utf-8")
        print(f"Applied local Trafilatura extraction: {web_file}")
    else:
        if text != text_before_brand_update:
            web_file.write_text(text, encoding="utf-8")
            print(f"Updated the shared extraction user agent: {web_file}")
        print(f"Trafilatura extraction already applied: {web_file}")

    translate_file = args.source / "seoscout" / "translate.py"
    translate_text = translate_file.read_text(encoding="utf-8")
    if "'pt-br': 'Portuguese (Brazil)'" not in translate_text:
        anchor = "    'pt': 'Portuguese (Brazil)',\n"
        translate_text = replace_once(
            translate_text,
            anchor,
            anchor + "    'pt-br': 'Portuguese (Brazil)',\n",
            "pt-br locale",
        )
        translate_file.write_text(translate_text, encoding="utf-8")
        print(f"Added standard pt-br locale: {translate_file}")

    config_file = args.source / "seoscout" / "core" / "config.py"
    config_text = config_file.read_text(encoding="utf-8")
    if "Web extraction is local (Trafilatura)" not in config_text:
        config_text = replace_once(
            config_text,
            JINA_VALIDATION_OLD,
            JINA_VALIDATION_NEW,
            "Jina validation",
        )
        config_file.write_text(config_text, encoding="utf-8")
        print(f"Removed obsolete Jina key requirement: {config_file}")


if __name__ == "__main__":
    main()
