#!/usr/bin/env python3
"""
게임빌 PZX 스프라이트를 PNG로 푼다.

    python3 tools/decode_pzx.py <jar를_푼_디렉터리> -o <출력디렉터리>

해독한 포맷:

  PZX 파일
      'PZX'+버전 | u32 이미지섹션시작 | u32 색상수 | u32 16 | u8×4 플래그
      u16 프레임수 | u32 프레임오프셋(프레임수+1) | u32 압축크기 | zlib(프레임 조립정보)
      이어서 이미지 섹션:
          u8 비트깊이 | u16 이미지수 | u8 ? | u8 팔레트색상수 | u16 RGB565 × 색상수
          u32 압축크기 | zlib(이미지 블록)

  이미지 블록 (압축 해제 후)
      u32 오프셋 × N  (N = 첫 오프셋 / 4)
      이미지 = u16 폭 | u16 높이 | u8 플래그 | 0xCD 0xCD 0xCD | u32 데이터크기 | u32 0
               이어서 행 단위 RLE

  행 RLE
      i16 을 반복해서 읽는다.
        0xFFFF  이미지 끝
        0xFFFE  행 끝
        최상위 비트 1 → (값 & 0x7FFF)개의 u8 팔레트 인덱스가 뒤따른다
        그 외         → 그 수만큼 투명 픽셀을 건너뛴다
      팔레트 0번은 항상 마젠타(#FF00FF)이며 투명색이다.

  .mpl (대체 팔레트) — 같은 이름으로 옆에 있으면 함께 읽는다
      C-create-palette.md C-2 와 같다. 여기서 쓰는 것은 0x40(이미지별 변형) 형뿐이다:
      PZX 파트 효과 `0x05+n` 이 "이 파트 이미지의 n 번째 변형 팔레트" 를 고른다 (binary.mod 0xc8bb4).

  프레임 박스
      프레임 머리의 `u8 파트수 | u8 박스수 | (i16 x,y,w,h) × 박스수`. 원본 0x94a64(out, 프레임, 0, k)
      가 k 번 박스를 돌려주고 화면 배치(정보 판·값 칸 …)가 이 좌표를 쓴다 — `frames/boxes.json` 으로 낸다.
"""

from __future__ import annotations

import argparse
import json
import struct
import zlib
from pathlib import Path

MAGENTA_RGB565 = 0xF81F
IMAGE_HEADER_SIZE = 16
IMAGE_HEADER_MARKER = bytes((0x02, 0xCD, 0xCD, 0xCD))

# 원작은 240×320 화면이다. 이보다 훨씬 큰 값이 나오면 헤더를 잘못 읽은 것이므로
# 그대로 배열을 만들면 메모리가 폭발한다.
MAXIMUM_IMAGE_SIDE = 1024
MAXIMUM_FRAME_SIDE = 1024
ROW_END = 0xFFFE
IMAGE_END = 0xFFFF
LITERAL_FLAG = 0x8000


def rgb565(value: int) -> tuple[int, int, int]:
    red, green, blue = (value >> 11) & 0x1F, (value >> 5) & 0x3F, value & 0x1F
    # 상위 비트를 되풀이해 채워야 최대값이 255가 된다
    return (red << 3) | (red >> 2), (green << 2) | (green >> 4), (blue << 3) | (blue >> 2)


MAGENTA_RGB = rgb565(MAGENTA_RGB565)

# ── .mpl 대체 팔레트 ──────────────────────────────────────
#
# 두 형식뿐이다 (docs/re/C-create-palette.md C-2, 22개 파일 전부 이대로 파싱된다):
#
#   첫 바이트 h — 윗 니블이 종류, 아래 니블 ≠ 0 이면 팔레트 뒤에 u32 하나가 더 붙는다
#                 (실제 파일은 전부 0 이다)
#
#   h>>4 = 2·3 — 통팔레트 (파일 대부분이 0x30)
#       u8 팔레트수 N | u32 절대오프셋 × N | 팔레트 × N
#       팔레트 = u8 색수(0 이면 256) | 색 × 색수     (3 이면 RGB565 u16, 2 면 RGB 3바이트)
#
#   h>>4 = 4 — 이미지별 변형 (ui/game_ui.mpl · ui/mode_ui.mpl 둘뿐)
#       u8 0x40 | u16 개수 N | u16 이미지번호 × N | u32 절대오프셋 × N | 묶음 × N
#       묶음 = u8 변형수 K | (u8 색수 | u16 RGB565 × 색수) × K
BULK_MPL_KINDS = (2, 3)
PER_IMAGE_MPL_KIND = 4


def read_mpl(path: Path) -> dict:
    """.mpl 을 파싱한다. 통팔레트는 {'palettes': [...]}, 0x40 형은 {'per_image': {이미지: [변형…]}}."""
    raw = path.read_bytes()
    head = raw[0]
    kind, has_tail = head >> 4, head & 0x0F

    if kind == PER_IMAGE_MPL_KIND:
        count = struct.unpack_from('<H', raw, 1)[0]
        images = list(struct.unpack_from(f'<{count}H', raw, 3))
        offsets = struct.unpack_from(f'<{count}I', raw, 3 + count * 2)
        variants: dict[int, list[list[tuple[int, int, int]]]] = {}
        for image, offset in zip(images, offsets):
            cursor = offset
            variant_count = raw[cursor]
            cursor += 1
            palettes = []
            for _ in range(variant_count):
                color_count = raw[cursor] or 256
                cursor += 1
                palettes.append([rgb565(struct.unpack_from('<H', raw, cursor + 2 * i)[0])
                                 for i in range(color_count)])
                cursor += color_count * 2
            variants[image] = palettes
        return {'kind': kind, 'per_image': variants}

    if kind not in BULK_MPL_KINDS:
        raise ValueError(f'{path.name}: 모르는 mpl 종류 {head:#04x}')

    count = raw[1]
    offsets = struct.unpack_from(f'<{count}I', raw, 2)
    palettes = []
    for offset in offsets:
        color_count = raw[offset] or 256
        if kind == 3:
            palettes.append([rgb565(struct.unpack_from('<H', raw, offset + 1 + 2 * i)[0])
                             for i in range(color_count)])
        else:  # kind 2 — RGB 3바이트
            palettes.append([tuple(raw[offset + 1 + 3 * i:offset + 4 + 3 * i])
                             for i in range(color_count)])
    return {'kind': kind, 'has_tail': bool(has_tail), 'palettes': palettes}


def read_variant_mpl(pzx_path: Path) -> dict[int, list[list[tuple[int, int, int]]]]:
    """PZX 옆에 같은 이름의 0x40 형 .mpl 이 있으면 이미지별 변형표를 준다. 없으면 빈 표다.

    0x30 형 .mpl (batter_*·pitcher 같은 팀·피부 팔레트)은 파트 효과가 쓰지 않는다 —
    원본도 0x91f0c 가 0 을 돌려준다. img_text.pzx 가 효과 5~7 을 쓰고도 색이 그대로인 이유다.
    """
    mpl = pzx_path.with_suffix('.mpl')
    if not mpl.exists():
        return {}
    parsed = read_mpl(mpl)
    return parsed.get('per_image', {})


def read_image_section(raw: bytes, image_at: int) -> tuple[list[tuple[int, int, int]], bytes]:
    """
    이미지 구간: u8 8 | u16 이미지수 | u8 flag | [flag bit0: u8 색상수(0=256) | u16 RGB565 × 색상수]
                | u32 해제크기 | u32 압축크기 | zlib
    flag bit0 이 0 이면 공용 팔레트가 없고 이미지마다 인라인 팔레트를 단다.
    (한동안 마젠타를 찾아 팔레트를 읽었다 — 색 두 개를 더 읽고, 인라인 팔레트 파일에서는 실패했다.)
    """
    flag = raw[image_at + 3]
    cursor = image_at + 4
    palette: list[tuple[int, int, int]] = []
    if flag & 0x01:
        color_count = raw[cursor] or 256
        palette = [rgb565(struct.unpack_from('<H', raw, cursor + 1 + i * 2)[0]) for i in range(color_count)]
        cursor += 1 + color_count * 2
    uncompressed, compressed = struct.unpack_from('<II', raw, cursor)
    block = zlib.decompress(raw[cursor + 8:cursor + 8 + compressed])
    if len(block) != uncompressed:
        raise ValueError(f'이미지 블록 크기가 맞지 않습니다: {len(block)} != {uncompressed}')
    return palette, block


def is_transparent(index: int, palette) -> bool:
    """RLE 건너뛰기(-1)는 늘 투명이다. 0번 색은 그 색이 마젠타일 때만 투명이다."""
    if index < 0 or index >= len(palette):
        return True
    return palette[index] == MAGENTA_RGB


def read_inline_palette(block: bytes) -> tuple[list[tuple[int, int, int]], int]:
    """
    파일 전체 팔레트가 없는 경우, 이미지마다 자기 팔레트를 앞에 달고 있다.

        u8 색상 수 | u16 RGB565 × 색상 수 | 이어서 보통의 이미지 헤더

    첫 색이 마젠타가 아닌 팔레트도 있다(mode_ui·game_ui). 그래서 팔레트 뒤에 오는
    이미지 헤더의 표식 `02 CD CD CD` 가 제자리에 있는지로 확인한다.
    """
    color_count = block[0]
    header_at = 1 + color_count * 2
    if color_count == 0 or header_at + IMAGE_HEADER_SIZE > len(block):
        return [], 0
    if block[header_at + 4:header_at + 8] != IMAGE_HEADER_MARKER:
        return [], 0

    colors = [
        rgb565(struct.unpack_from('<H', block, 1 + index * 2)[0])
        for index in range(color_count)
    ]
    return colors, header_at


def decode_image(block: bytes, palette: list[tuple[int, int, int]]):
    inline_palette, skip = read_inline_palette(block)
    if skip > 0:
        palette = inline_palette
        block = block[skip:]

    width, height = struct.unpack_from('<HH', block, 0)
    if width > MAXIMUM_IMAGE_SIDE or height > MAXIMUM_IMAGE_SIDE:
        return 0, 0, [], palette
    data = block[IMAGE_HEADER_SIZE:]

    # 인덱스 -1 = 투명
    pixels = [[-1] * width for _ in range(height)]
    cursor = 0
    row = column = 0

    while cursor + 2 <= len(data):
        value = struct.unpack_from('<H', data, cursor)[0]
        cursor += 2

        if value == IMAGE_END:
            break
        if value == ROW_END:
            row += 1
            column = 0
            continue
        if value & LITERAL_FLAG:
            run = value & ~LITERAL_FLAG
            for offset in range(run):
                if row < height and column < width and cursor + offset < len(data):
                    pixels[row][column] = data[cursor + offset]
                column += 1
            cursor += run
        else:
            column += value

    return width, height, pixels, palette


def write_png(path: Path, width: int, height: int, pixels, palette) -> None:
    rows = bytearray()
    for row in pixels:
        rows.append(0)  # 필터 타입 None
        for index in row:
            if is_transparent(index, palette):
                rows += b'\x00\x00\x00\x00'
            else:
                red, green, blue = palette[index]
                rows += bytes((red, green, blue, 255))

    def chunk(tag: bytes, payload: bytes) -> bytes:
        return (struct.pack('>I', len(payload)) + tag + payload
                + struct.pack('>I', zlib.crc32(tag + payload) & 0xFFFFFFFF))

    header = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    path.write_bytes(
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', header)
        + chunk(b'IDAT', zlib.compress(bytes(rows), 9))
        + chunk(b'IEND', b'')
    )


# ── 프레임 · 애니메이션 ────────────────────────────────────
#
# 헤더: 'PZX' ver | u32 이미지구간 | u32 프레임구간 | u32 애니메이션구간(=0x10)
# 구간: u8 flag | u16 count | 본문. flag 맨 아래 비트가 1 이면 zlib 압축이다.
#   압축:   u32 상대 오프셋 × (count+1) | u32 압축크기 | zlib
#   비압축: u32 절대 오프셋 × count | 본문 (마지막 항목은 다음 구간 시작에서 끝난다)
#   count 가 0 이면 3바이트가 전부다.
# 프레임: u8 파트수 | u8 박스수 | 박스 × 8바이트 | 파트 × (u16 이미지 | i16 x | i16 y | u8 효과수 | 효과…)
#   효과: u8 종류, 0x60~0x6F 는 뒤에 u32 값이 붙는다. 0x03 = 좌우 뒤집기(렌더 결과로 확인).
# 애니메이션: u8 개수 | (u16 프레임 | u8 지연 | i16 dx | i16 dy | u8 플래그) × 개수
#   지연 0 은 한 번 갱신에 한 칸이다 (binary.mod 0x93d90 에서 0 을 1 로 올린다).
#   dx/dy 는 그 칸을 그릴 때 더하는 이동이다 — 엔딩 그림이 dx 0→53 으로 흘러가고,
#   수비수는 ±1~2, 메뉴는 dy ±1 로 흔들린다. (u16 지연으로 읽으면 6404 같은 값이 나온다.)
# 파트는 파일 순서대로 겹친다 — 앞 파트가 아래.
#
# 한동안 프레임 개수를 u16 으로 읽고 파트 뒤 바이트 수를 역추적으로 맞췄다. 그 결과
# 파트가 빠지거나(헬멧 반쪽) 겹침 순서가 뒤집히고, 애니메이션 표는 통째로 못 읽었다.

MIRROR_EFFECT = 0x03


def read_section(raw: bytes, at: int, end: int) -> list[bytes]:
    flag = raw[at]
    count = struct.unpack_from('<H', raw, at + 1)[0]
    if count == 0:
        return []
    if flag & 0x01:
        offsets = struct.unpack_from(f'<{count + 1}I', raw, at + 3)
        size_at = at + 3 + 4 * (count + 1)
        size = struct.unpack_from('<I', raw, size_at)[0]
        data = zlib.decompress(raw[size_at + 4:size_at + 4 + size])
        return [data[offsets[i]:offsets[i + 1]] for i in range(count)]
    offsets = list(struct.unpack_from(f'<{count}I', raw, at + 3)) + [end]
    return [raw[offsets[i]:offsets[i + 1]] for i in range(count)]


def parse_frame(block: bytes) -> dict:
    """프레임 한 덩이 → {'boxes': [(x,y,w,h)…], 'parts': [...]}.

    박스는 원본 0x94a64 가 돌려주는 사각형이다. 프레임 좌표 그대로(합성 PNG 의 잘린 좌표가 아니다)
    두어야 화면 배치에 쓸 수 있다 — origins.json 의 x·y 를 빼면 PNG 안 좌표가 된다.
    """
    part_count, box_count = block[0], block[1]
    boxes = [tuple(struct.unpack_from('<4h', block, 2 + 8 * i)) for i in range(box_count)]
    cursor = 2 + 8 * box_count
    parts = []
    for _ in range(part_count):
        image, x, y = struct.unpack_from('<Hhh', block, cursor)
        effect_count = block[cursor + 6]
        cursor += 7
        effects = []
        for _ in range(effect_count):
            kind = block[cursor]
            cursor += 1
            if 0x60 <= kind < 0x70:
                effects.append((kind, struct.unpack_from('<I', block, cursor)[0]))
                cursor += 4
            else:
                effects.append((kind, None))
        parts.append({'image': image, 'x': x, 'y': y, 'effects': effects})
    if cursor != len(block):
        raise ValueError(f'프레임 길이가 맞지 않습니다: {cursor} != {len(block)}')
    return {'boxes': boxes, 'parts': parts}


def parse_animation(block: bytes) -> list[dict]:
    count = block[0]
    if len(block) != 1 + 8 * count:
        raise ValueError(f'애니메이션 길이가 맞지 않습니다: {len(block)} != {1 + 8 * count}')
    entries = []
    for index in range(count):
        frame, delay, dx, dy, flag = struct.unpack_from('<HBhhB', block, 1 + 8 * index)
        entries.append({'frame': frame, 'delay': delay, 'dx': dx, 'dy': dy, 'flag': flag})
    return entries


def write_rgba_png(path: Path, width: int, height: int, canvas) -> None:
    rows = bytearray()
    for row in canvas:
        rows.append(0)
        for pixel in row:
            rows += bytes(pixel) if pixel is not None else b'\x00\x00\x00\x00'

    def chunk(tag: bytes, payload: bytes) -> bytes:
        return (struct.pack('>I', len(payload)) + tag + payload
                + struct.pack('>I', zlib.crc32(tag + payload) & 0xFFFFFFFF))

    header = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    path.write_bytes(
        b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header)
        + chunk(b'IDAT', zlib.compress(bytes(rows), 9)) + chunk(b'IEND', b'')
    )


FLIP_VERTICAL_EFFECT = 0x04
ALPHA_SIXTEENTHS_EFFECT = 0x66
ALPHA_BYTE_EFFECT = 0x67
FILL_EFFECTS = (0x6E, 0x6F)
# 효과 0x05 ~ 0x64 = 붙은 0x40 mpl 의 (효과−5) 번째 변형 팔레트 (binary.mod 0xc8bb4 `subs r2,#5`)
VARIANT_EFFECT_FIRST = 0x05
VARIANT_EFFECT_LAST = 0x64


def _part_style(effects) -> tuple[bool, bool, float, tuple[int, int, int] | None, int | None]:
    """효과 → (좌우, 상하, 불투명도, 채울 색, 팔레트 변형 번호). 0x7E 등 뜻을 모르는 효과는 무시한다."""
    mirror = flip = False
    alpha = 1.0
    fill = None
    variant = None
    for kind, value in effects:
        if kind == MIRROR_EFFECT:
            mirror = True
        elif kind == FLIP_VERTICAL_EFFECT:
            flip = True
        elif kind == ALPHA_SIXTEENTHS_EFFECT and value is not None:
            alpha = min(1.0, value / 16)
        elif kind == ALPHA_BYTE_EFFECT and value is not None:
            alpha = min(1.0, value / 255)
        elif kind in FILL_EFFECTS and value is not None:
            fill = rgb565(value & 0xFFFF)
        elif VARIANT_EFFECT_FIRST <= kind <= VARIANT_EFFECT_LAST:
            variant = kind - VARIANT_EFFECT_FIRST
    return mirror, flip, alpha, fill, variant


def variant_palette(variants, image: int, index: int | None, palette):
    """
    파트 효과가 고른 변형 팔레트. 원본 0xc8bb4 는 색 목록이 없으면 **색수가 같을 때만** 통째로 덮는다
    — 실제 파일(mode_ui 0·1·31 · game_ui 8·9)은 모두 이미지 팔레트와 색수가 같다.
    """
    if index is None:
        return palette
    candidates = variants.get(image)
    if not candidates or index >= len(candidates):
        return palette
    replacement = candidates[index]
    return replacement if len(replacement) == len(palette) else palette


def compose_frame(parts: list[dict], images, variants=None):
    """파트를 파일 순서대로 겹친다. 이미지마다 제 팔레트를 쓰고 반투명 파트는 섞는다.

    효과 (서브 에이전트 E 가 렌더 결과로 확인, 뜻은 추정):
      0x03 좌우 뒤집기 · 0x04 상하 뒤집기(certi 화살표) · 0x66 n 반투명 n/16(잔상·볼터치)
      0x67 n 반투명 n/255 · 0x6E/0x6F 값 = 파트 모양대로 그 색으로 채우기(번쩍임·실루엣)
      0x05~0x64 붙은 0x40 mpl 의 (효과−5)번 변형 팔레트 (UI 선택/비활성 색, 0xc8bb4)

    팔레트 번호 캔버스도 함께 돌려준다 — 팀·피부 팔레트를 웹에서 런타임에 갈아 끼울 때 쓴다.
    반투명·채우기로 섞인 자리와 변형 팔레트를 쓴 자리는 번호가 뜻을 잃으므로 None 으로 둔다.
    """
    variants = variants or {}
    usable = [p for p in parts if p['image'] < len(images) and images[p['image']][0] > 0]
    if not usable:
        return 0, 0, 0, 0, [], []

    left = min(p['x'] for p in usable)
    top = min(p['y'] for p in usable)
    right = max(p['x'] + images[p['image']][0] for p in usable)
    bottom = max(p['y'] + images[p['image']][1] for p in usable)
    width, height = right - left, bottom - top
    if width > MAXIMUM_FRAME_SIDE or height > MAXIMUM_FRAME_SIDE:
        return 0, 0, 0, 0, [], []

    canvas = [[None] * width for _ in range(height)]
    index_canvas = [[None] * width for _ in range(height)]
    for part in usable:
        part_width, part_height, pixels, base_palette = images[part['image']]
        mirror, flip, alpha, fill, variant = _part_style(part['effects'])
        palette = variant_palette(variants, part['image'], variant, base_palette)
        plain = fill is None and variant is None
        for row in range(part_height):
            source_row = part_height - 1 - row if flip else row
            for column in range(part_width):
                source_column = part_width - 1 - column if mirror else column
                value = pixels[source_row][source_column]
                if is_transparent(value, palette):
                    continue
                red, green, blue = fill if fill is not None else palette[value]
                x, y = part['x'] - left + column, part['y'] - top + row
                below = canvas[y][x]
                index_canvas[y][x] = value if plain and alpha >= 1.0 else None
                if alpha >= 1.0 or below is None:
                    canvas[y][x] = (red, green, blue, round(255 * alpha))
                    continue
                under_alpha = below[3] / 255
                out_alpha = alpha + under_alpha * (1 - alpha)
                mix = lambda top_value, under_value: round(
                    (top_value * alpha + under_value * under_alpha * (1 - alpha)) / out_alpha
                )
                canvas[y][x] = (mix(red, below[0]), mix(green, below[1]), mix(blue, below[2]), round(255 * out_alpha))
    return left, top, width, height, canvas, index_canvas


def decode_file(path: Path, output_dir: Path) -> int:
    raw = path.read_bytes()
    if raw[0:3] != b'PZX':
        return 0

    image_at, frame_at, animation_at = struct.unpack_from('<III', raw, 4)
    palette, block = read_image_section(raw, image_at)

    image_count = struct.unpack_from('<I', block, 0)[0] // 4
    offsets = [struct.unpack_from('<I', block, i * 4)[0] for i in range(image_count)]

    target = output_dir / path.stem
    target.mkdir(parents=True, exist_ok=True)

    written = 0
    images = []
    for index in range(image_count):
        end = offsets[index + 1] if index + 1 < image_count else len(block)
        width, height, pixels, used = decode_image(block[offsets[index]:end], palette)
        images.append((width, height, pixels, used))
        if width == 0 or height == 0:
            continue
        write_png(target / f'{index:03d}.png', width, height, pixels, used)
        written += 1

    frames = [parse_frame(chunk) for chunk in read_section(raw, frame_at, image_at)]
    animations = [parse_animation(chunk) for chunk in read_section(raw, animation_at, frame_at)]
    if not frames:
        return written

    variants = read_variant_mpl(path)
    frame_dir = target / 'frames'
    frame_dir.mkdir(parents=True, exist_ok=True)
    # 프레임마다 바운딩 박스로 잘라내므로 원점을 따로 남긴다 — 여러 레이어를 겹칠 때 필요하다.
    origins: dict[str, dict[str, int]] = {}
    boxes: dict[str, list[list[int]]] = {}
    for index, frame in enumerate(frames):
        if frame['boxes']:
            boxes[f'{index:03d}'] = [list(box) for box in frame['boxes']]
        left, top, width, height, canvas, _ = compose_frame(frame['parts'], images, variants)
        if width <= 0 or height <= 0:
            continue
        write_rgba_png(frame_dir / f'{index:03d}.png', width, height, canvas)
        origins[f'{index:03d}'] = {'x': left, 'y': top, 'width': width, 'height': height}
        written += 1
    (frame_dir / 'origins.json').write_text(json.dumps(origins, indent=1, sort_keys=True), encoding='utf-8')
    write_boxes(frame_dir, boxes)
    if animations:
        (frame_dir / 'animations.json').write_text(json.dumps(animations, indent=1), encoding='utf-8')
    return written


def frame_boxes(path: Path) -> dict[str, list[list[int]]]:
    """PZX(또는 PZF)의 프레임 박스만 뽑는다 — 그림은 풀지 않는다."""
    raw = path.read_bytes()
    if raw[0:3] == b'PZX':
        image_at, frame_at, _ = struct.unpack_from('<III', raw, 4)
        blocks = read_section(raw, frame_at, image_at)
    else:  # PZF — 프레임 구간만 들어 있다 (stadium/fence)
        blocks = read_section(raw, PZD_PZF_SECTION_AT, len(raw))
    boxes: dict[str, list[list[int]]] = {}
    for index, block in enumerate(blocks):
        found = parse_frame(block)['boxes']
        if found:
            boxes[f'{index:03d}'] = [list(box) for box in found]
    return boxes


def write_boxes(frame_dir: Path, boxes: dict[str, list[list[int]]]) -> None:
    """
    프레임 박스를 `boxes.json` 으로 낸다 — origins.json 은 화면들이 이미 읽고 있으므로 건드리지 않는다.

    값은 **프레임 좌표 그대로**다 (원본 0x94a64 가 돌려주는 x,y,w,h). 박스가 없는 프레임은 넣지 않는다.
    """
    if not boxes:
        (frame_dir / 'boxes.json').unlink(missing_ok=True)
        return
    (frame_dir / 'boxes.json').write_text(json.dumps(boxes, indent=1, sort_keys=True), encoding='utf-8')


PZD_PZF_SECTION_AT = 4


def decode_split_pair(image_path: Path, frame_path: Path, output_dir: Path) -> int:
    """
    PZD(이미지 구간만, 오프셋 4) + PZF(프레임 구간만, 오프셋 4) 짝을 PZX 처럼 푼다 — stadium/fence (위치 분석 6차).
    결과는 output_dir/<PZF 이름>/frames 에 합성 프레임과 origins.json 으로 남긴다.
    """
    image_raw = image_path.read_bytes()
    frame_raw = frame_path.read_bytes()
    palette, block = read_image_section(image_raw, PZD_PZF_SECTION_AT)
    image_count = struct.unpack_from('<I', block, 0)[0] // 4
    offsets = [struct.unpack_from('<I', block, i * 4)[0] for i in range(image_count)]
    images = []
    for index in range(image_count):
        end = offsets[index + 1] if index + 1 < image_count else len(block)
        images.append(decode_image(block[offsets[index]:end], palette))

    frames = [parse_frame(chunk) for chunk in read_section(frame_raw, PZD_PZF_SECTION_AT, len(frame_raw))]
    frame_dir = output_dir / frame_path.stem / 'frames'
    frame_dir.mkdir(parents=True, exist_ok=True)
    origins: dict[str, dict[str, int]] = {}
    boxes: dict[str, list[list[int]]] = {}
    for index, frame in enumerate(frames):
        if frame['boxes']:
            boxes[f'{index:03d}'] = [list(box) for box in frame['boxes']]
        left, top, width, height, canvas, _ = compose_frame(frame['parts'], images)
        if width <= 0 or height <= 0:
            continue
        write_rgba_png(frame_dir / f'{index:03d}.png', width, height, canvas)
        origins[f'{index:03d}'] = {'x': left, 'y': top, 'width': width, 'height': height}
    (frame_dir / 'origins.json').write_text(json.dumps(origins, indent=1, sort_keys=True), encoding='utf-8')
    write_boxes(frame_dir, boxes)
    return len(origins)


def main() -> int:
    parser = argparse.ArgumentParser(description='PZX 스프라이트를 PNG로 푼다')
    parser.add_argument('root', type=Path)
    parser.add_argument('-o', '--output', type=Path, default=Path('sprites'))
    arguments = parser.parse_args()
    arguments.output.mkdir(parents=True, exist_ok=True)

    total = failures = 0
    for path in sorted(arguments.root.rglob('*.pzx')):
        try:
            count = decode_file(path, arguments.output)
        except (ValueError, zlib.error, struct.error, IndexError) as error:
            failures += 1
            print(f'  {path.name:<30} 실패: {error}')
            continue
        total += count
        print(f'  {path.relative_to(arguments.root)!s:<36} PNG {count}장')

    # PZD(그림) + PZF(프레임) 로 쪼개진 짝 — stadium/fence
    for frame_path in sorted(arguments.root.rglob('*.pzf')):
        image_path = frame_path.with_suffix('.pzd')
        if not image_path.exists():
            continue
        count = decode_split_pair(image_path, frame_path, arguments.output)
        total += count
        print(f'  {frame_path.relative_to(arguments.root)!s:<36} PNG {count}장')

    print(f'\n총 {total}장 생성, 실패 {failures}개 → {arguments.output}/')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
