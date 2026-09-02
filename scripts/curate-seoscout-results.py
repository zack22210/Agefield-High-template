#!/usr/bin/env python3
"""Filter competitor/risky domains and select the strongest SEOScout sources."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.parse import urlparse


def hostname(value: str) -> str:
    host = (urlparse(value).hostname or value or "").lower()
    return host.removeprefix("www.")


def domain_matches(host: str, domains: set[str]) -> bool:
    return any(host == domain or host.endswith(f".{domain}") for domain in domains)


def score(item: dict, official: set[str], trusted: set[str]) -> int:
    host = hostname(item.get("url", item.get("domain", "")))
    if domain_matches(host, official):
        return 100
    if domain_matches(host, trusted):
        return 70
    url = item.get("url", "")
    if url.startswith("https://"):
        return 30
    if url.startswith("http://"):
        return 20
    return 0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("results", type=Path)
    parser.add_argument("--policy", type=Path, required=True)
    parser.add_argument("--top-k", type=int, default=2)
    args = parser.parse_args()

    data = json.loads(args.results.read_text(encoding="utf-8"))
    policy = json.loads(args.policy.read_text(encoding="utf-8"))
    official = {hostname(value) for value in policy.get("official_domains", [])}
    trusted = {hostname(value) for value in policy.get("trusted_domains", [])}
    blocked = {hostname(value) for value in policy.get("blocked_domains", [])}
    selected_total = 0
    blocked_total = 0

    for entry in data.get("keywords", []):
        items = entry.setdefault("web", {}).setdefault("items", [])
        allowed = []
        for item in items:
            host = hostname(item.get("url", item.get("domain", "")))
            is_blocked = domain_matches(host, blocked)
            item["selected"] = False
            if is_blocked:
                item["blocked_by_policy"] = True
                blocked_total += 1
            else:
                item.pop("blocked_by_policy", None)
                allowed.append(item)

        allowed.sort(key=lambda item: score(item, official, trusted), reverse=True)
        for item in allowed[: max(args.top_k, 1)]:
            item["selected"] = True
            selected_total += 1
        items.sort(key=lambda item: (not item.get("selected", False), -score(item, official, trusted)))
        entry["web"]["count"] = len(items)

    args.results.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Curated {len(data.get('keywords', []))} keywords: selected {selected_total}, blocked {blocked_total} sources.")


if __name__ == "__main__":
    main()
