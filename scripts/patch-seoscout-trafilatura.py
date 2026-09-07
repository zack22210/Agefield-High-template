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

    youtube_file = args.source / "seoscout" / "core" / "youtube.py"
    youtube_text = youtube_file.read_text(encoding="utf-8")
    if "async def probe_access(self)" not in youtube_text:
        youtube_text = replace_once(
            youtube_text,
            "    def __init__(self):\n        self.config = Config\n",
            "    def __init__(self):\n        self.config = Config\n        self.blocked = False\n",
            "YouTube blocked flag",
        )
        youtube_text = replace_once(
            youtube_text,
            '    async def extract_batch(self, items: List[YouTubeItem]) -> List[Tuple[YouTubeItem, str]]:',
            textwrap.indent(
                textwrap.dedent(
                    '''
                    async def probe_access(self) -> bool:
                        """Return False quickly when YouTube itself is unreachable."""
                        print("\\n🔎 Probing YouTube access...")
                        loop = asyncio.get_event_loop()
                        try:
                            reachable = await asyncio.wait_for(
                                loop.run_in_executor(None, self._probe_access_sync),
                                timeout=12,
                            )
                        except Exception as error:
                            print(f"  ✗ YouTube unreachable: {error}")
                            self.blocked = True
                            return False
                        if reachable:
                            print("  ✓ YouTube reachable")
                            return True
                        print("  ✗ YouTube unreachable; skipping transcript extraction")
                        self.blocked = True
                        return False

                    def _probe_access_sync(self) -> bool:
                        session = requests.Session()
                        proxy_url = None
                        if self.config.use_proxy_for_stage("extract"):
                            proxy_url = self.config.get_proxy_url_for_stage("extract")
                        if proxy_url:
                            session.proxies.update({"http": proxy_url, "https": proxy_url})
                        response = session.get(
                            "https://www.youtube.com/generate_204",
                            timeout=8,
                            allow_redirects=True,
                        )
                        return response.status_code < 500

                    async def extract_batch(self, items: List[YouTubeItem]) -> List[Tuple[YouTubeItem, str]]:
                    '''
                ).strip(),
                "    ",
            )
            + "\n",
            "YouTube probe_access",
        )
        youtube_text = replace_once(
            youtube_text,
            "        async with semaphore:\n            # 1. 检查缓存\n",
            "        async with semaphore:\n            if self.blocked:\n                return (item, \"\")\n\n            # 1. 检查缓存\n",
            "YouTube extract blocked short-circuit",
        )
        youtube_text = replace_once(
            youtube_text,
            '                is_ip_blocked = error_name in ("RequestBlocked", "IpBlocked", "SSLError", "ProxyError")\n\n                if is_ip_blocked and use_proxy and attempt < max_retries - 1:',
            '                is_ip_blocked = error_name in ("RequestBlocked", "IpBlocked", "SSLError", "ProxyError")\n'
            '                is_unreachable = is_ip_blocked or error_name in (\n'
            '                    "ConnectTimeout", "ConnectionError", "Timeout", "TimeoutError",\n'
            '                    "ChunkedEncodingError", "RemoteDisconnected",\n'
            '                )\n\n'
            '                if is_unreachable and not use_proxy:\n'
            '                    print(f"    ⚠️ {video_id}: {error_name} (YouTube unreachable)")\n'
            '                    self.blocked = True\n'
            '                    return ""\n\n'
            '                if is_ip_blocked and use_proxy and attempt < max_retries - 1:',
            "YouTube unreachable fail-fast",
        )
        youtube_file.write_text(youtube_text, encoding="utf-8")
        print(f"Added YouTube access probe and fail-fast: {youtube_file}")
    else:
        print(f"YouTube access probe already applied: {youtube_file}")

    collect_file = args.source / "seoscout" / "collect.py"
    collect_text = collect_file.read_text(encoding="utf-8")
    if "select_top_viewed_youtube" not in collect_text:
        collect_helpers = '''    return unique_items, url_to_keywords


def select_top_viewed_youtube(items, max_k):
    selected = [item for item in items if item.get("selected", True)]
    ranked = sorted(
        selected,
        key=lambda item: int(item.get("view_count") or 0),
        reverse=True,
    )
    limit = max(3, min(int(max_k or 5), 5))
    return ranked[:limit]


async def run_collect(project: str):
'''
        collect_text = replace_once(
            collect_text,
            "    return unique_items, url_to_keywords\n\n\nasync def run_collect(project: str):\n",
            collect_helpers,
            "YouTube view-count ranking helper",
        )
        collect_text = replace_once(
            collect_text,
            "            yt_items_by_keyword[keyword] = selected_yt[:Config.YOUTUBE_EXTRACT_TOP_K]\n",
            "            yt_items_by_keyword[keyword] = select_top_viewed_youtube(\n"
            "                selected_yt, Config.YOUTUBE_EXTRACT_TOP_K\n"
            "            )\n",
            "rank YouTube videos by view count",
        )
        collect_file.write_text(collect_text, encoding="utf-8")
        print(f"Collect now extracts transcripts for the top 3-5 videos by view count: {collect_file}")
    else:
        print(f"YouTube view-count transcript ranking already applied: {collect_file}")


if __name__ == "__main__":
    main()
