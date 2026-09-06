from __future__ import annotations

import os
from pathlib import Path
import sys


def main() -> None:
    if len(sys.argv) < 3:
        raise SystemExit("usage: run-seoscout.py SOURCE_PATH PROJECT_DATA_DIR [ARGS...]")

    source_path = Path(sys.argv[1]).resolve(strict=True)
    project_data_dir = Path(sys.argv[2]).resolve(strict=True)
    sys.path.insert(0, str(source_path))
    os.chdir(project_data_dir)
    sys.argv = ["seoscout", *sys.argv[3:]]

    from seoscout.cli import main as seoscout_main

    seoscout_main()


if __name__ == "__main__":
    main()
