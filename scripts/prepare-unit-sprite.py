#!/usr/bin/env python3
"""Trim, clean backgrounds, scale, and publish a single unit sprite PNG."""

from __future__ import annotations

import json
import sys
from collections import deque
from pathlib import Path

from PIL import Image


def trim_sprite(img: Image.Image) -> Image.Image:
    """Crop to non-transparent sprite content."""
    rgba = img.convert("RGBA")
    alpha = rgba.getchannel("A")
    bbox = alpha.getbbox()
    if bbox:
        return rgba.crop(bbox)

    pixels = rgba.load()
    width, height = rgba.size
    min_x, min_y, max_x, max_y = width, height, 0, 0
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a > 16 and (r > 24 or g > 24 or b > 24):
                min_x = min(min_x, x)
                min_y = min(min_y, y)
                max_x = max(max_x, x)
                max_y = max(max_y, y)
    if max_x <= min_x or max_y <= min_y:
        return rgba
    pad = 4
    return rgba.crop(
        (
            max(0, min_x - pad),
            max(0, min_y - pad),
            min(width, max_x + pad + 1),
            min(height, max_y + pad + 1),
        )
    )


def _color_distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def _is_light_background(r: int, g: int, b: int, a: int, tolerance: int) -> bool:
    if a < 16:
        return True
    brightness = (r + g + b) / 3
    spread = max(r, g, b) - min(r, g, b)
    if brightness >= 200 and spread <= tolerance:
        return True
    if brightness >= 235:
        return True
    return False


def remove_light_background(img: Image.Image, tolerance: int = 48) -> Image.Image:
    """Flood-fill from image borders to remove white and light-gray backgrounds."""
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    visited: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque()

    def try_seed(x: int, y: int) -> None:
        if (x, y) in visited:
            return
        r, g, b, a = pixels[x, y]
        if _is_light_background(r, g, b, a, tolerance):
            visited.add((x, y))
            queue.append((x, y))

    for x in range(width):
        try_seed(x, 0)
        try_seed(x, height - 1)
    for y in range(height):
        try_seed(0, y)
        try_seed(width - 1, y)

    while queue:
        x, y = queue.popleft()
        pixels[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= width or ny >= height:
                continue
            if (nx, ny) in visited:
                continue
            r, g, b, a = pixels[nx, ny]
            if _is_light_background(r, g, b, a, tolerance):
                visited.add((nx, ny))
                queue.append((nx, ny))

    return rgba


def remove_corner_background(img: Image.Image, tolerance: int = 36) -> Image.Image:
    """Flood-fill from corners when they share a solid backdrop color."""
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    corners = [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]
    corner_colors = [pixels[x, y][:3] for x, y in corners]
    if len({c for c in corner_colors}) > 2:
        return rgba

    bg_color = corner_colors[0]
    visited: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque()

    for x, y in corners:
        if pixels[x, y][3] < 16:
            continue
        if _color_distance(pixels[x, y][:3], bg_color) <= tolerance:
            queue.append((x, y))
            visited.add((x, y))

    while queue:
        x, y = queue.popleft()
        pixels[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= width or ny >= height:
                continue
            if (nx, ny) in visited:
                continue
            r, g, b, a = pixels[nx, ny]
            if a < 16:
                continue
            if _color_distance((r, g, b), bg_color) <= tolerance:
                visited.add((nx, ny))
                queue.append((nx, ny))

    return rgba


def clean_background(img: Image.Image) -> Image.Image:
    img = remove_light_background(img)
    img = remove_corner_background(img)
    return remove_light_background(img)


def compute_display_bounds(
    sprite: Image.Image, sprite_meta: dict, canvas_size: int
) -> dict[str, float]:
    """Place trimmed sprite on canvas using anchor and return visible bounds."""
    sw, sh = sprite.size
    anchor_x = sprite_meta["anchor"][0]
    anchor_y = sprite_meta["anchor"][1]
    paste_x = int(canvas_size * anchor_x - sw * anchor_x)
    paste_y = int(canvas_size * anchor_y - sh * anchor_y)

    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    canvas.paste(sprite, (paste_x, paste_y), sprite)

    bbox = canvas.getchannel("A").getbbox()
    if not bbox:
        half = canvas_size / 2
        return {
            "x": 0,
            "y": 0,
            "width": canvas_size,
            "height": canvas_size,
            "centerX": half,
            "centerY": half,
        }

    x0, y0, x1, y1 = bbox
    return {
        "x": x0,
        "y": y0,
        "width": x1 - x0,
        "height": y1 - y0,
        "centerX": (x0 + x1) / 2,
        "centerY": (y0 + y1) / 2,
    }


def prepare_sprite(sprite_meta: dict, src_path: Path, out_dir: Path) -> dict:
    unit_id = sprite_meta["id"]
    if not src_path.exists():
        raise FileNotFoundError(f"Missing source sprite: {src_path}")

    img = trim_sprite(Image.open(src_path))
    img = clean_background(img)
    img = trim_sprite(img)

    max_edge = 256
    if max(img.size) > max_edge:
        scale = max_edge / max(img.size)
        new_size = (max(1, int(img.width * scale)), max(1, int(img.height * scale)))
        img = img.resize(new_size, Image.Resampling.LANCZOS)

    display_bounds = compute_display_bounds(img, sprite_meta, sprite_meta["canvasSize"])

    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{unit_id}.png"
    img.save(out_path)

    return {
        "spriteFile": out_path.name,
        "spriteWidth": img.width,
        "spriteHeight": img.height,
        "displayBounds": display_bounds,
    }


def main() -> None:
    if len(sys.argv) != 4:
        print("usage: prepare-unit-sprite.py <sprite.json> <src-png> <out-dir>", file=sys.stderr)
        sys.exit(1)

    sprite_meta = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    src_path = Path(sys.argv[2])
    out_dir = Path(sys.argv[3])
    result = prepare_sprite(sprite_meta, src_path, out_dir)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
