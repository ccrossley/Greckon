#!/usr/bin/env python3
"""Split a horizontal triplet sprite sheet into per-unit PNGs."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def split_triplet(src: Path, unit_ids: list[str], out_dir: Path) -> list[Path]:
    img = Image.open(src).convert("RGBA")
    width, height = img.size
    count = len(unit_ids)
    out_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []

    if count == 1:
        dest = out_dir / f"{unit_ids[0]}.png"
        img.save(dest)
        written.append(dest)
        return written

    slice_w = width // count
    for index, unit_id in enumerate(unit_ids):
        left = index * slice_w
        right = width if index == count - 1 else left + slice_w
        crop = img.crop((left, 0, right, height))
        dest = out_dir / f"{unit_id}.png"
        crop.save(dest)
        written.append(dest)
    return written


def main() -> None:
    if len(sys.argv) < 3:
        print(
            "usage: split-triplet-sprites.py <triplet.png> <unitId> [unitId2 unitId3]",
            file=sys.stderr,
        )
        sys.exit(1)

    src = Path(sys.argv[1])
    unit_ids = sys.argv[2:]
    out_dir = Path(__file__).resolve().parent.parent / "assets" / "paper-dolls"
    for path in split_triplet(src, unit_ids, out_dir):
        print(path)


if __name__ == "__main__":
    main()
