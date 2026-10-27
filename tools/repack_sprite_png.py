#!/usr/bin/env python3
"""
public/sprites 의 PNG 를 **무손실 팔레트 PNG** 로 다시 쓴다 (r311, OPTIMIZATION-2026-10-27 A4).

    python3 tools/repack_sprite_png.py              # public/sprites 전부 — 작아지는 것만 바꾼다
    python3 tools/repack_sprite_png.py --dry-run    # 바꾸지 않고 몇 개 · 몇 바이트가 줄지만 찍는다
    python3 tools/repack_sprite_png.py <폴더|파일>…

뽑기 도구(`decode_pzx.py` · `apply_mpl.py`)는 PNG 를 모두 8비트 RGBA 로 쓴다. 그림 대부분(99.8%)이 색 256개 이하라서
색표(PLTE) + 투명표(tRNS) 로 쓰면 작아진다. r311 첫 적용: 9,025장 중 4,978장을 바꿨고 그 파일들이 5.47MB → 4.20MB(−23.3%).

**픽셀이 같다**: RGBA 네 값이 다른 색마다 색표 칸 하나를 주므로 디코드한 RGBA 가 바이트 단위로 같다.
- 투명(알파 < 255) 색을 색표 앞에 두어 tRNS 를 짧게 한다. 알파 0 이라도 RGB 가 다르면 다른 칸이다.
- 바꾼 뒤 Pillow 로 다시 풀어 RGBA 를 원래와 대조하고, 하나라도 다르면 그 파일은 그대로 둔다.
- IHDR · PLTE · tRNS · IDAT · IEND 외의 덩이(gAMA · iCCP · sRGB · cHRM · tEXt …)가 생기면 그 파일도 그대로 둔다
  — 색 관리 덩이가 붙으면 브라우저가 색을 바꿀 수 있다.
- 색이 256개를 넘거나, 다시 써도 작아지지 않으면 그대로 둔다. 그래서 **멱등**이다(두 번째부터는 바뀌는 것이 없다).
- 브라우저 대조(chromium · webkit `drawImage` → `getImageData`)는 `e2e/png-rgba.mjs` 로 한다.

자산을 다시 뽑는 도구(`prune_sprites.py` · `apply_mpl.py` · `generate_management_sprites.py`) 끝에서 이 단계를 부른다.
`decode_pzx.py -o public/sprites` 로 직접 뽑았으면 `apply_mpl.py` 를 돌리거나 이 도구를 한 번 돌린다.
"""

from __future__ import annotations

import argparse
import io
import struct
import sys
from pathlib import Path

from PIL import Image

PUBLIC = Path('public/sprites')
ALLOWED_CHUNKS = {b'IHDR', b'PLTE', b'tRNS', b'IDAT', b'IEND'}


def chunk_types(data: bytes) -> list[bytes]:
    types = []
    at = 8
    while at < len(data):
        length = struct.unpack_from('>I', data, at)[0]
        types.append(data[at + 4:at + 8])
        at += 12 + length
    return types


def pixels_of(image: Image.Image) -> list:
    flattened = getattr(image, 'get_flattened_data', None)
    return list(flattened() if flattened is not None else image.getdata())


def encode_palette(rgba: Image.Image, pixels: list, unique: list, optimize: bool) -> bytes:
    index_of = {color: index for index, color in enumerate(unique)}
    indexed = Image.new('P', rgba.size)
    indexed.putdata([index_of[pixel] for pixel in pixels])
    indexed.putpalette([channel for color in unique for channel in color[:3]], rawmode='RGB')
    alphas = bytes(color[3] for color in unique if color[3] != 255)
    out = io.BytesIO()
    options = {'optimize': optimize, 'compress_level': 9}
    if alphas:
        options['transparency'] = alphas
    indexed.save(out, format='PNG', **options)
    return out.getvalue()


def palette_png(rgba: Image.Image) -> bytes | None:
    """
    색 256개 이하면 무손실 팔레트 PNG 바이트(가장 작은 것), 아니면 None.
    색표 차례 두 가지(색 값 차례 · 많이 쓴 차례, 둘 다 투명 색이 앞) × Pillow optimize 켬 · 끔 넷 중 가장 작은 것을 고른다.
    """
    colors = rgba.getcolors(256)
    if colors is None:
        return None
    pixels = pixels_of(rgba)
    by_value = sorted({color for _, color in colors}, key=lambda color: (color[3] == 255, color))
    by_count = [color for _, color in sorted(colors, key=lambda item: (item[1][3] == 255, -item[0], item[1]))]
    candidates = [encode_palette(rgba, pixels, order, optimize) for order in (by_value, by_count) for optimize in (True, False)]
    return min(candidates, key=len)


def repack_file(path: Path, dry_run: bool) -> int:
    """줄어든 바이트 수 (바꾸지 않으면 0)"""
    original = path.read_bytes()
    with Image.open(io.BytesIO(original)) as opened:
        rgba = opened.convert('RGBA')
    packed = palette_png(rgba)
    if packed is None or len(packed) >= len(original):
        return 0
    if not set(chunk_types(packed)) <= ALLOWED_CHUNKS:
        return 0
    with Image.open(io.BytesIO(packed)) as reopened:
        if reopened.convert('RGBA').tobytes() != rgba.tobytes():
            return 0
    if not dry_run:
        path.write_bytes(packed)
    return len(original) - len(packed)


def repack(targets: list[Path], dry_run: bool = False) -> tuple[int, int, int]:
    """(본 PNG 수, 바꾼 수, 줄어든 바이트)"""
    files = sorted(file for target in targets for file in ([target] if target.is_file() else target.rglob('*.png')))
    changed = 0
    saved = 0
    for file in files:
        delta = repack_file(file, dry_run)
        if delta > 0:
            changed += 1
            saved += delta
    return len(files), changed, saved


def report(targets: list[Path], dry_run: bool = False) -> None:
    """뽑기 도구 끝에서 부른다"""
    seen, changed, saved = repack(targets, dry_run)
    verb = '바꿀' if dry_run else '바꾼'
    print(f'팔레트 PNG 다시 쓰기: {seen:,}장 중 {verb} 것 {changed:,}장 · −{saved / 1024 / 1024:.2f}MB')


def main() -> int:
    parser = argparse.ArgumentParser(description='스프라이트 PNG 를 무손실 팔레트 PNG 로 다시 쓴다')
    parser.add_argument('targets', nargs='*', type=Path, default=[PUBLIC])
    parser.add_argument('--dry-run', action='store_true')
    arguments = parser.parse_args()
    missing = [target for target in arguments.targets if not target.exists()]
    if missing:
        print(f'없다: {", ".join(map(str, missing))}', file=sys.stderr)
        return 1
    report(arguments.targets, arguments.dry_run)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
