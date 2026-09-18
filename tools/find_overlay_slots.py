#!/usr/bin/env python3
"""
배경 그림에 뚫린 투명 구멍의 크기·위치를 찾아, 그 크기와 정확히 맞는 스프라이트를 짝지어 준다.

    python3 tools/find_overlay_slots.py

원작은 배경 위에 다른 스프라이트를 겹쳐 그리는데, 겹쳐질 자리를 배경에서 투명하게
비워 둔다. 그래서 **구멍 크기 == 겹칠 그림 크기**이면 그 좌표가 곧 원작의 배치다.
타이틀 화면에서 이 방법으로 로고(137×114)와 선수(87×241) 위치를 정확히 복원했다.
"""

from __future__ import annotations

import struct
import zlib
from collections import deque
from pathlib import Path

SPRITE_ROOT = Path('public/sprites')

# 이보다 작은 구멍은 배경의 비어있는 부분일 뿐 자리로 보지 않는다.
MINIMUM_HOLE_PIXELS = 400
# 배경으로 볼 최소 크기
MINIMUM_BACKGROUND_SIDE = 120


def read_png(path: Path):
    raw = path.read_bytes()
    width, height = struct.unpack_from('>II', raw, 16)
    data = b''
    position = 8
    while position < len(raw):
        length = struct.unpack_from('>I', raw, position)[0]
        if raw[position + 4:position + 8] == b'IDAT':
            data += raw[position + 8:position + 8 + length]
        position += 12 + length
    plain = zlib.decompress(data)
    stride = width * 4
    rows = [plain[y * (stride + 1) + 1:y * (stride + 1) + 1 + stride] for y in range(height)]
    return width, height, rows


def find_holes(width: int, height: int, rows) -> list[tuple[int, int, int, int]]:
    """투명 영역을 덩어리로 묶어 경계 상자를 돌려준다."""
    seen = [[False] * width for _ in range(height)]
    holes = []

    for startY in range(height):
        for startX in range(width):
            if rows[startY][startX * 4 + 3] != 0 or seen[startY][startX]:
                continue
            queue = deque([(startX, startY)])
            seen[startY][startX] = True
            points = []
            while queue:
                x, y = queue.popleft()
                points.append((x, y))
                for stepX, stepY in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nextX, nextY = x + stepX, y + stepY
                    if (0 <= nextX < width and 0 <= nextY < height
                            and not seen[nextY][nextX]
                            and rows[nextY][nextX * 4 + 3] == 0):
                        seen[nextY][nextX] = True
                        queue.append((nextX, nextY))
            if len(points) < MINIMUM_HOLE_PIXELS:
                continue
            xs = [p[0] for p in points]
            ys = [p[1] for p in points]
            holes.append((min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1))
    return holes


def main() -> int:
    # 폴더별 스프라이트 크기 색인
    sizes: dict[tuple[int, int], list[str]] = {}
    backgrounds = []
    for path in SPRITE_ROOT.rglob('*.png'):
        if 'frames' in path.parts:
            continue
        raw = path.read_bytes()
        width, height = struct.unpack_from('>II', raw, 16)
        sizes.setdefault((width, height), []).append(str(path.relative_to(SPRITE_ROOT)))
        if width >= MINIMUM_BACKGROUND_SIDE and height >= MINIMUM_BACKGROUND_SIDE:
            backgrounds.append((path, width, height))

    print(f'배경 후보 {len(backgrounds)}장 검사\n')
    for path, width, height in sorted(backgrounds, key=lambda item: -item[1] * item[2]):
        _w, _h, rows = read_png(path)
        holes = find_holes(width, height, rows)
        matched = [(hole, sizes.get((hole[2], hole[3]), [])) for hole in holes]
        matched = [(hole, names) for hole, names in matched if names]
        if not matched:
            continue

        print(f'{path.relative_to(SPRITE_ROOT)} ({width}×{height})')
        for (x, y, holeWidth, holeHeight), names in matched:
            others = [n for n in names if not n.endswith(path.name) or path.parent.name not in n]
            print(f'  구멍 {holeWidth}×{holeHeight} @({x},{y})  →  ' + ', '.join(others[:4]))
        print()
    return 0


raise SystemExit(main())
