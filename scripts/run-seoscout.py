from __future__ import annotations

import os
from pathlib import Path
import sys


def _configure_stdio() -> None:
    os.environ.setdefault("PYTHONUTF8", "1")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="replace")


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit("usage: run-seoscout.py SOURCE_PATH PROJECT_DATA_DIR [ARGS...]")

    source_path = Path(sys.argv[1]).resolve(strict=True)
    project_data_dir = Path(sys.argv[2]).resolve(strict=True)
    sys.path.insert(0, str(source_path))
    os.chdir(project_data_dir)
    _configure_stdio()
    try:
        from dotenv import load_dotenv
        load_dotenv(project_data_dir / ".env", override=True, encoding="utf-8-sig")
    except ImportError:
        pass
    sys.argv = ["seoscout", *sys.argv[3:]]

    from seoscout.cli import main as seoscout_main

    seoscout_main()


if __name__ == "__main__":
    main()
