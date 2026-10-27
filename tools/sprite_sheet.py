#!/usr/bin/env python3
"""뽑아낸 PNG를 격자로 이어붙여 한눈에 확인할 시트를 만든다.

    python3 tools/sprite_sheet.py <스프라이트폴더> <출력.png> [--columns N] [--limit N]
"""
import argparse, struct, zlib
from pathlib import Path

BACKGROUND = b'\x22\x2a\x40\xff'
GAP = 3


def read_png(path: Path):
    # RGBA 와 팔레트 PNG(tools/repack_sprite_png.py, r311) 둘 다 — Pillow 로 RGBA 로 푼다
    from PIL import Image
    with Image.open(path) as image:
        rgba = image.convert('RGBA')
    width, height = rgba.size
    plain = rgba.tobytes()
    stride = width * 4
    rows = [bytearray(plain[y * stride:(y + 1) * stride]) for y in range(height)]
    return width, height, rows


def write_png(path: Path, width: int, height: int, rows):
    out = bytearray()
    for row in rows:
        out.append(0)
        out += row

    def chunk(tag, payload):
        return (struct.pack('>I', len(payload)) + tag + payload
                + struct.pack('>I', zlib.crc32(tag + payload) & 0xFFFFFFFF))

    path.write_bytes(b'\x89PNG\r\n\x1a\n'
                     + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
                     + chunk(b'IDAT', zlib.compress(bytes(out), 9))
                     + chunk(b'IEND', b''))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('folder', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--columns', type=int, default=10)
    parser.add_argument('--limit', type=int, default=0)
    arguments = parser.parse_args()

    paths = sorted(arguments.folder.glob('*.png'))
    if arguments.limit:
        paths = paths[:arguments.limit]
    images = [(p.stem, *read_png(p)) for p in paths]
    if not images:
        print('그림이 없습니다')
        return 1

    cell_width = max(w for _, w, _, _ in images) + GAP
    cell_height = max(h for _, _, h, _ in images) + GAP
    columns = min(arguments.columns, len(images))
    rows_count = (len(images) + columns - 1) // columns

    total_width = cell_width * columns
    total_height = cell_height * rows_count
    canvas = [bytearray(BACKGROUND * total_width) for _ in range(total_height)]

    for index, (_name, width, height, rows) in enumerate(images):
        column, row = index % columns, index // columns
        origin_x, origin_y = column * cell_width, row * cell_height
        for y in range(height):
            for x in range(width):
                if rows[y][x * 4 + 3]:
                    target = (origin_x + x) * 4
                    canvas[origin_y + y][target:target + 4] = rows[y][x * 4:x * 4 + 4]

    write_png(arguments.output, total_width, total_height, canvas)
    print(f'{len(images)}장 → {arguments.output} ({total_width}×{total_height}, {columns}열)')
    return 0


raise SystemExit(main())
