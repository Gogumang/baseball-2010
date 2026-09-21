#!/usr/bin/env python3
"""
원본의 대체 팔레트 파일 `.mpl` 을 읽어 구워 둔 스프라이트에 입힌다.

    python3 tools/apply_mpl.py                 # public/sprites/img_text/frames 의 딱지 글자를 원본 색으로 다시 칠한다
    python3 tools/apply_mpl.py --dry-run       # 바꾸지 않고 무엇이 바뀔지만 찍는다
    python3 tools/apply_mpl.py --dump ui/img_text.mpl   # 팔레트 내용만 본다

`base/work/jar/` (원본 jar 를 푼 것)이 있어야 한다.
    python3 tools/extract_wipi_game.py base/게임빌2010프로야구/0002C663.jar -o base/extracted

## .mpl 이 무엇인가

PZX 그림은 8비트 인덱스 그림이고 팔레트를 파일 안에 하나만 갖고 있다. 원본은 같은 그림을
여러 색으로 쓰려고 **팔레트만 따로 담은 .mpl 파일**을 옆에 두고, 그릴 때 그림의 팔레트를
통째로 갈아 끼운다 (binary.mod 0xb9718 적재 · 0xc8c7c 덮어쓰기 · 0x91c38 다시 칠하기).

바이트 구조 두 가지다 (docs/re/C-create-palette.md C-2 와 같다. 22개 .mpl 전부 이대로 파싱된다):

    첫 바이트 h — 윗 니블이 종류, 아래 니블 ≠ 0 이면 팔레트 뒤에 u32 하나가 더 붙는다
                  (실제 파일은 전부 0 이다)

    h>>4 = 2·3 — 통팔레트 (파일 대부분이 0x30)
        u8 팔레트수 N | u32 절대오프셋 × N | 팔레트 × N
        팔레트 = u8 색수(0 이면 256) | 색 × 색수     (3 이면 RGB565 u16, 2 면 RGB 3바이트)

    h>>4 = 4 — 이미지별 변형 (ui/game_ui.mpl · ui/mode_ui.mpl 둘뿐)
        u8 0x40 | u16 개수 N | u16 이미지번호 × N | u32 절대오프셋 × N | 묶음 × N
        묶음 = u8 변형수 K | (u8 색수 | u16 RGB565 × 색수) × K
        PZX 파트 효과 0x05+n 이 "이 파트 이미지의 n 번째 변형" 을 고른다 (0xc8bb4).

## 웹판은 이걸 어떻게 다루나

웹판은 팔레트를 런타임에 갈아 끼우지 않고 PNG 를 미리 구워 둔다. 그래서 "그릴 때 색을 고른다"
를 "**그 프레임은 그 색으로 굽는다**" 로 옮긴다. 한 프레임이 원본에서 두 색으로 쓰이면
그중 하나만 고를 수밖에 없다 — 그런 자리는 아래 표에 근거와 함께 적어 두었다.

지금 다루는 것은 `ui/img_text.mpl` 하나다. img_text 의 글자 그림은 **언제나 흰색 한 장**이고
(색 두 개: 본체 255,255,255 · 그림자 239,239,239) 원본은 그릴 때마다 0x913e4 로 팔레트를 고른다:

    0 흰색 (255,255,255 / 239,239,239)   — 기본
    1 노랑 (255,227,82  / 255,178,41)
    2 주황빨강 (247,81,16 / 231,24,24)
    3 짙은 파랑 (41,73,165 / 16,36,107)
    4 회색 (123,121,123 / 82,81,82)

문제는 **흰 막대 위에 얹는 흰 글자**다. slt_frame 이미지 116(57×15)·18(39×15)은 흰 막대
(231,227,231)라 팔레트 0 그대로 얹으면 글자가 묻힌다. 원본은 그 자리에서 4 또는 3 을 고른다.

`generate_management_sprites.py` 도 같은 일을 하지만 관리 화면 것만 `public/sprites/management/`
에 사본으로 만든다. 여기서는 그 프레임이 웹판에서 그 색으로만 쓰이므로 제자리에서 굽는다.
"""

from __future__ import annotations

import argparse
import struct
import sys
from collections import Counter
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from decode_pzx import rgb565  # noqa: E402

JAR = Path('base/work/jar')
PUBLIC = Path('public/sprites')

BULK_KINDS = (2, 3)
PER_IMAGE_KIND = 4

# ── img_text 프레임별 팔레트 (binary.mod 디스어셈으로 확정) ──────────────────────
#
# 목록 화면 딱지 그리기 0x65744 (P6 2a-3 "끝부분", 모든 k 공통):
#   0x6576c  movs r1,#4  → 0x913e4([0x1552ae8], 4)  … A 딱지, 막대는 늘 slt_frame 116(흰색)
#   0x657ba  movs r1,#4  → 글자 그리기 직전에 한 번 더
#   B 딱지 팔레트는 [sp+0xc8] 변수다: 0x63cf0 기본 0(파란 막대 117),
#   k 3·4·5 만 0x63d86 에서 4 로 바꾸고 막대도 116(흰색)으로 바꾼다.
#   → 흰 막대 위 글자 = 팔레트 4(회색), 파란 막대 위 글자 = 팔레트 0(흰색).
#   A 딱지 프레임: k 0·3·4·5 = 157 "PLAYER", k 1 = 158 "COM" (0x63d1e·0x63d36·0x63d82)
#   B 딱지 프레임: k 3·4·5 = 158 "COM", 그 밖 = 159 "ABILITY" (파란 막대라 흰색 그대로)
#
# 경기정보 줄 딱지 0x64f2a~0x65074 (막대 slt_frame 이미지 18, 흰색):
#   0x64fd6 · 0x65002  movs r1,#3 → 팔레트 3(짙은 파랑). 표 0xd1e84 = [47,48,49,51,50]
#
# 마선수 고르기(k 2)·명예의전당(k 11)의 A 딱지는 **원본이 아예 안 그린다**
#   (0x63d68 이 [sp+0xb4] = 0 으로 꺼서 0x65768 에서 건너뛴다). 웹판은 그리고 있으므로
#   50·51 은 경기정보 쪽 색(3, 짙은 파랑)을 따른다 — **근사다**. 원본이 그렸다면 4(회색)였다.
IMG_TEXT_FRAME_PALETTE: dict[int, int] = {
    47: 3,   # 순위   — 경기정보 줄 딱지
    48: 3,   # 승패
    49: 3,   # 선발
    50: 3,   # 마타자 (마선수 화면 A 딱지로도 쓰여 근사다 — 위 주석 참고)
    51: 3,   # 마투수
    157: 4,  # PLAYER — 목록 화면 A 딱지, 흰 막대 116
    158: 4,  # COM    — 목록 화면 A 딱지(k 1) · B 딱지(k 3·4·5), 흰 막대 116
    # 159 "ABILITY" 는 파란 막대(117) 위라 원본도 팔레트 0(흰색)이다 — 건드리지 않는다.
}


def read_mpl(path: Path) -> dict:
    """.mpl 을 파싱한다. 위 독스트링의 두 형식을 모두 읽는다."""
    raw = path.read_bytes()
    head = raw[0]
    kind, has_tail = head >> 4, head & 0x0F

    if kind == PER_IMAGE_KIND:
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

    if kind not in BULK_KINDS:
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


def recolor(path: Path, source: list, target: list, dry_run: bool) -> tuple[int, str]:
    """
    PNG 의 색을 팔레트 source → target 으로 같은 번호끼리 바꾼다.

    이미 바꿔 둔 파일을 다시 돌려도 안전하다 — 바뀐 색은 source 에 없어서 걸리지 않는다
    (img_text 팔레트 0·3·4 는 색이 하나도 겹치지 않는다).
    """
    image = Image.open(path).convert('RGBA')
    mapping = {tuple(source[i]): tuple(target[i]) for i in range(min(len(source), len(target)))}
    original = list(image.getdata())
    before = Counter(original)
    pixels = [(*mapping[pixel[:3]], pixel[3]) if pixel[3] and pixel[:3] in mapping else pixel
              for pixel in original]
    changed = sum(1 for old, new in zip(original, pixels) if old != new)
    if changed and not dry_run:
        image.putdata(pixels)
        image.save(path)
    top = [f'{color[:3]}×{n}' for color, n in before.most_common(3) if color[3]]
    return changed, ' '.join(top)


def apply_img_text(dry_run: bool) -> int:
    palettes = read_mpl(JAR / 'ui/img_text.mpl')['palettes']
    white = palettes[0]
    frames = PUBLIC / 'img_text/frames'
    total = 0
    for frame, index in sorted(IMG_TEXT_FRAME_PALETTE.items()):
        path = frames / f'{frame:03d}.png'
        if not path.exists():
            print(f'  프레임 {frame:>3} 없음 — 건너뜀 ({path})')
            continue
        changed, top = recolor(path, white, palettes[index], dry_run)
        total += changed
        state = '그대로' if not changed else f'{changed}픽셀'
        print(f'  프레임 {frame:>3} → 팔레트 {index} {tuple(palettes[index][1])} : {state}  (전 {top})')
    return total


def main() -> int:
    parser = argparse.ArgumentParser(description='.mpl 대체 팔레트를 스프라이트에 입힌다')
    parser.add_argument('--dump', metavar='상대경로', help='base/work/jar 아래 .mpl 을 찍어만 본다')
    parser.add_argument('--dry-run', action='store_true', help='바꾸지 않고 결과만 찍는다')
    arguments = parser.parse_args()

    if arguments.dump:
        parsed = read_mpl(JAR / arguments.dump)
        if 'per_image' in parsed:
            print(f'{arguments.dump}: 이미지별 변형 {len(parsed["per_image"])}개')
            for image, variants in parsed['per_image'].items():
                print(f'  이미지 {image}: 변형 {len(variants)}개, 색 {len(variants[0])}개')
                for index, palette in enumerate(variants):
                    print(f'    {index}: {palette}')
        else:
            print(f'{arguments.dump}: 통팔레트 {len(parsed["palettes"])}벌 '
                  f'(색 {len(parsed["palettes"][0])}개)')
            for index, palette in enumerate(parsed['palettes']):
                print(f'  {index}: {palette if len(palette) <= 8 else palette[:8] + ["…"]}')
        return 0

    if not (JAR / 'ui/img_text.mpl').exists():
        print(f'{JAR}/ui/img_text.mpl 이 없다 — 먼저 원본 jar 를 풀어야 한다', file=sys.stderr)
        return 1

    print('ui/img_text.mpl → public/sprites/img_text/frames')
    changed = apply_img_text(arguments.dry_run)
    print(f'{"바꿀 픽셀" if arguments.dry_run else "바꾼 픽셀"} {changed}개')
    return 0


if __name__ == '__main__':
    sys.exit(main())
