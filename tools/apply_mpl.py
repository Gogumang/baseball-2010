#!/usr/bin/env python3
"""
원본의 대체 팔레트 파일 `.mpl` 과 프레임 박스를 `public/sprites` 에 반영한다.

    python3 tools/apply_mpl.py                 # 아래 네 가지를 모두 한다
    python3 tools/apply_mpl.py --dry-run       # 바꾸지 않고 무엇이 바뀔지만 찍는다
    python3 tools/apply_mpl.py --dump ui/img_text.mpl   # 팔레트 내용만 본다

    1. 딱지 글자 굽기   ui/img_text.mpl 팔레트를 img_text 프레임에 직접 칠한다
    2. 팔레트 내보내기  통팔레트(.mpl 0x2·0x3) 를 `<폴더>/palette.json` 으로 낸다
    3. 팔레트 번호 지도 팀·피부로 색이 바뀌는 그림에 `<폴더>/[frames/]index/NNN.png` 를 붙인다
    4. 프레임 박스      `<폴더>/frames/boxes.json` (원본 0x94a64 의 x,y,w,h)

`base/work/jar/` (원본 jar 를 푼 것)이 있어야 한다.
    python3 tools/extract_wipi_game.py base/게임빌2010프로야구/0002C663.jar -o base/extracted

이 도구는 **멱등**이다. 몇 번을 돌려도 같은 바이트가 나온다 (1 은 이미 바뀐 색이 다시 걸리지 않고,
2~4 는 원본 jar 만 보고 다시 쓴다). `decode_pzx.py` 로 스프라이트를 다시 푼 뒤에 한 번 돌리면 된다.

## .mpl 이 무엇인가

PZX 그림은 8비트 인덱스 그림이고 팔레트를 파일 안에 하나만 갖고 있다. 원본은 같은 그림을
여러 색으로 쓰려고 **팔레트만 따로 담은 .mpl 파일**을 옆에 두고, 그릴 때 그림의 팔레트를
통째로 갈아 끼운다 (binary.mod 0xb9718 적재 · 0xc8c7c 덮어쓰기 · 0x91c38 다시 칠하기).
바이트 구조는 `decode_pzx.read_mpl` 의 주석에 있다 (22개 .mpl 전부 그대로 파싱된다).

0x40(이미지별 변형) 형인 `ui/game_ui.mpl` · `ui/mode_ui.mpl` 은 여기서 다루지 않는다 —
PZX 파트 효과 `0x05+n` 이 고르는 것이라 `decode_pzx.py` 가 프레임을 합성할 때 이미 구워 넣는다.

## 굽느냐 런타임이냐 — 재어 보고 정한 것

`bat/batter_*` · `pitcher` 는 **피부 × 15 + 팀** 으로 45벌, `batter_helmet` · `defender` 는 팀으로
15벌이다 (C-create-palette.md C-1). 벌마다 PNG 를 구우면:

    batter_balancer  75장 304K × 45벌 = 3,375장 13.4MB
    batter_sluger    71장 288K × 45벌 = 3,195장 13.0MB
    pitcher          62장 256K × 45벌 = 2,790장 11.5MB
    batter_helmet    33장 136K × 15벌 =   495장  2.0MB
    defender        164장 672K × 15벌 = 2,460장 10.1MB
    ────────────────────────────────────────────────
    합계                              12,315장 50.0MB

지금 `public/sprites` 가 32MB 다. 82MB 가 되고 파일 수만큼 요청이 생긴다
(`prune_sprites.py` 는 "50MB 넘으면 안 된다" 를 이유로 골라 담고 있다).
그래서 **런타임 교체**를 고른다. 대신 두 가지를 여기서 만들어 둔다:

  - `palette.json` — 벌 전체와 PZX 가 이미 구워 쓰는 벌 번호
  - `index/NNN.png` — 픽셀마다 **팔레트 번호**를 담은 그림 (빨강 = 번호, 알파 0 = 손대지 말 것)

번호 지도가 필요한 이유: 구워 둔 PNG 는 색이 납작해져서 번호를 잃는다. 그런데 기본 팔레트에
**같은 색이 두 번호에 들어 있고 벌마다 서로 달라지는** 자리가 있다 — `pitcher` 의 #005142 는
번호 10·25 둘 다인데 45벌 중 42벌에서 서로 다른 색이 된다(318픽셀). 색만 보고 바꾸면 여기가 틀린다.
`src/shared/lib/sprite/paletteSwap.ts` 가 이 두 파일로 캔버스에서 칠한다.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from decode_pzx import (  # noqa: E402
    compose_frame,
    decode_image,
    frame_boxes,
    is_transparent,
    read_image_section,
    read_mpl,
    read_section,
    parse_frame,
)
import struct  # noqa: E402

JAR = Path('base/work/jar')
PUBLIC = Path('public/sprites')

# ── 벌을 고르는 규칙 (C-create-palette.md C-1, binary.mod 0x78ab0 · 0x793b0 · 0x48658 · 0x63a7e) ──
#
# 번호 지도를 붙일 그림들이다. 값은 palette.json 에 그대로 적어 둘 "고르는 법" 이다.
OUTFIT_RULES: dict[str, str] = {
    'bat/batter_balancer': '피부 × 15 + 팀',
    'bat/batter_sluger': '피부 × 15 + 팀',
    'bat/batter_helmet': '팀',
    'pitcher': '피부 × 15 + 팀',
    'defender': '팀',
    # 0x63a7e: 피부 1 → 0 · 2 → 1 · 0 → mpl 안 씀. 2 번 벌은 인물 8·9 전용(0x63a50).
    'event_char_0': '피부 1 → 0 · 2 → 1 · 0 → 안 씀 (2 = 이벤트 인물 8·9)',
    # ── 장비 외형 (L-sound-effects.md 3절 · 타자 0x78fd8 · 투수 0x79790 디스어셈으로 확정) ──
    #
    # 같은 PZX 를 .mpl 의 다른 줄로 칠해 **등급별 색**을 만든다. n = 그 부위 장비의 등급 0~10.
    # 줄 −1 은 "그림 기본색" 이라 mpl 을 안 쓴다 — 그래서 여기 palette.json 의 `baked` 가
    # 죄다 null 이다 (구워 둔 PNG = PZX 안 기본 팔레트 = 벌 목록 밖). 런타임은 벌을 안 고를 때
    # 구운 PNG 를 그대로 쓰면 된다.
    # 두 함수 모두 부위 번호는 0=머리 · 1=손 · 2=몸 · 3=다리 다 (문자열 "head_" "hand_"
    # "body_" "leg_" 를 잇는 갈래로 확인). 머리·몸은 늘 −1(기본색)이라 여기 없다.
    #   0x790f6~0x79102  타자 손: n>6 은 다른 파일, n≤1 → −1, 아니면 n−2
    #   0x79252 · 0x7927e 타자 다리: n≤6 → n−1, n≥7 → n−8
    #   0x79832 · 0x7984a 투수 **다리** (슬롯 [r7+0x28], 0x79850 · 0x7988e 로 대조)
    #   0x79870 · 0x79888 투수 **손**   (슬롯 [r7+0x20]): 식은 타자 다리와 같다
    'item/item_bat_hand': '등급 n: 0·1 → 기본색(mpl 안 씀) · 2~6 → 줄 n−2 (0x790f6)',
    'item/item_bat_leg_0': '등급 n: 0 → 기본색 · 1~6 → 줄 n−1 (0x79252)',
    'item/item_bat_leg_7': '등급 n: 7 → 기본색 · 8~10 → 줄 n−8 (0x7927e)',
    'item/item_pit_hand_0': '등급 n: 0 → 기본색 · 1~6 → 줄 n−1 (0x79870)',
    'item/item_pit_hand_7': '등급 n: 7 → 기본색 · 8~10 → 줄 n−8 (0x79888)',
    'item/item_pit_leg_0': '등급 n: 0 → 기본색 · 1~6 → 줄 n−1 (0x79832)',
    'item/item_pit_leg_7': '등급 n: 7 → 기본색 · 8~10 → 줄 n−8 (0x7984a)',
    # ── 시즌 구장 잔디 (S3-stadium-items.md · 0x786c8 디스어셈으로 확정) ──
    #
    # 타석 바닥 그림(`0x7725c` 이 구장 `+0x2c` 를 그린다)의 팔레트를 잔디 칸으로 갈아 끼운다.
    #   0x786c8(구장, idx, flag): [구장+0xc] = idx ; 줄 = flag ? 1 − idx : idx
    #                             줄 < 0 이면 mpl 없이 PZX 기본 팔레트로 다시 적재한다
    #   부르는 곳은 전부 `idx = SR[0x1ba] − 1`, `flag = 1` 이라 **줄 = 2 − 칸** 이다
    #   (경기 준비 0x353ec → 0x354b4, 구장관리·상점 미리보기 0x62e4 · 0x7afa · 0x9c76).
    #   구장 객체 생성자 0x76ace 가 [+0xc] 를 −1 로 두므로 시즌 홈경기가 아니면 기본색이다.
    # 줄 2 올리브(거친인조잔디) · 줄 1 청록(인조잔디 "항상 푸른색") · 줄 0 짙은 녹색(천연잔디)
    # · 칸 3(특급천연잔디) 은 줄 −1 = PZX 기본색.
    'stadium/attack': '잔디 칸 v: 줄 2 − v (0 → 2 · 1 → 1 · 2 → 0 · 3 → 기본색) (0x786c8)',
}

# 벌을 고르는 규칙을 아직 못 찾은 것들. 팔레트는 내보내되 굽지도 지도를 붙이지도 않는다.
UNKNOWN_RULE = '미해결 — 원본이 몇 번을 고르는지 아직 못 찾았다'
KNOWN_BULK_RULES: dict[str, str] = {
    'ui/img_text': '로드 때 0번 고정, 그릴 때 0x913e4 가 고른다 (여기서 프레임에 구워 둔다)',
    'ui/mode_icon': '1벌뿐 — 관리 화면 "선택된 커맨드 아이콘" 주황. '
                    'tools/generate_management_sprites.py 가 이미 이 벌로 사본을 만든다',
    # 수비 화면 바탕. 0x78824(구장 객체)가 defense.pzx 를 적재하고, 0x7885c 가 팔레트 번호를
    # `1 − 번호` 로 뒤집어 다시 적재한다 (I-controls.md 1b). 주/야간으로 보인다 — **유력**.
    # 3벌 중 2번 벌을 고르는 곳은 아직 못 찾았다.
    'stadium/defense': '주/야간 — 0x78824 적재, 0x7885c 가 `1 − 번호` 로 다시 적재 (유력). '
                       '2번 벌을 고르는 곳은 미해결',
}

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


def hex_color(color) -> str:
    return '#%02x%02x%02x' % tuple(color[:3])


# ── 1. img_text 딱지 글자 굽기 ────────────────────────────────────────────────

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


# ── 2·3. 팔레트 내보내기와 팔레트 번호 지도 ────────────────────────────────────

def load_pzx(path: Path):
    """PZX 의 이미지들을 푼다 — (공용 팔레트, [(폭, 높이, 픽셀, 팔레트)…])."""
    raw = path.read_bytes()
    image_at = struct.unpack_from('<I', raw, 4)[0]
    palette, block = read_image_section(raw, image_at)
    count = struct.unpack_from('<I', block, 0)[0] // 4
    offsets = [struct.unpack_from('<I', block, i * 4)[0] for i in range(count)]
    images = []
    for index in range(count):
        end = offsets[index + 1] if index + 1 < count else len(block)
        images.append(decode_image(block[offsets[index]:end], palette))
    return palette, images


def baked_palette_index(base, palettes) -> int | None:
    """구워 둔 PNG 가 쓰는 벌 번호 = PZX 안 기본 팔레트와 바이트가 같은 벌."""
    for index, palette in enumerate(palettes):
        if all(tuple(palette[i]) == tuple(base[i]) for i in range(min(len(palette), len(base)))):
            return index
    return None


def write_palette_json(folder: Path, mpl_relative: str, base, palettes, rule: str, dry_run: bool) -> None:
    payload = {
        'mpl': mpl_relative,
        'select': rule,
        'baked': baked_palette_index(base, palettes),
        'colors': [hex_color(color) for color in base],
        'palettes': [[hex_color(color) for color in palette] for palette in palettes],
    }
    text = json.dumps(payload, ensure_ascii=False, indent=1) + '\n'
    if not dry_run:
        (folder / 'palette.json').write_text(text, encoding='utf-8')


def write_index_png(path: Path, width: int, height: int, rows) -> None:
    """
    팔레트 번호 지도. 빨강 = 번호, 알파 255 = 그 번호로 다시 칠해도 되는 자리.

    반투명(0x66)·채우기(0x6E) 로 섞인 자리는 번호가 뜻을 잃으므로 알파 0 으로 두고
    런타임이 구워 둔 색을 그대로 쓰게 한다 — **근사다** (defender 그림자·event_char_0 잔상).
    """
    image = Image.new('RGBA', (width, height))
    image.putdata([(value, 0, 0, 255) if value is not None else (0, 0, 0, 0)
                   for row in rows for value in row])
    image.save(path)


def write_index_maps(pzx: Path, folder: Path, dry_run: bool) -> tuple[int, int]:
    """폴더에 이미 있는 PNG 와 짝이 맞는 번호 지도를 만든다. (낱장, 프레임) 개수를 돌려준다."""
    images = load_pzx(pzx)[1]
    loose = composed = 0

    if any(folder.glob('[0-9][0-9][0-9].png')):
        target = folder / 'index'
        if not dry_run:
            target.mkdir(parents=True, exist_ok=True)
        for index, (width, height, pixels, used) in enumerate(images):
            if width == 0 or height == 0 or not (folder / f'{index:03d}.png').exists():
                continue
            rows = [[None if is_transparent(value, used) else value for value in row] for row in pixels]
            if not dry_run:
                write_index_png(target / f'{index:03d}.png', width, height, rows)
            loose += 1

    frame_dir = folder / 'frames'
    if frame_dir.is_dir():
        raw = pzx.read_bytes()
        image_at, frame_at, _ = struct.unpack_from('<III', raw, 4)
        frames = [parse_frame(chunk) for chunk in read_section(raw, frame_at, image_at)]
        target = frame_dir / 'index'
        if not dry_run and frames:
            target.mkdir(parents=True, exist_ok=True)
        for index, frame in enumerate(frames):
            if not (frame_dir / f'{index:03d}.png').exists():
                continue
            _, _, width, height, _, index_canvas = compose_frame(frame['parts'], images)
            if width <= 0 or height <= 0:
                continue
            if not dry_run:
                write_index_png(target / f'{index:03d}.png', width, height, index_canvas)
            composed += 1

    return loose, composed


def export_palettes(dry_run: bool) -> None:
    for mpl in sorted(JAR.rglob('*.mpl')):
        relative = str(mpl.relative_to(JAR))
        stem = str(mpl.relative_to(JAR).with_suffix(''))
        folder = PUBLIC / mpl.stem
        pzx = mpl.with_suffix('.pzx')
        parsed = read_mpl(mpl)
        if 'per_image' in parsed:
            print(f'  {relative:<34} 0x40 형 — decode_pzx 가 프레임에 구워 넣는다 (C-9)')
            continue
        if not folder.is_dir() or not pzx.exists():
            print(f'  {relative:<34} public/sprites/{mpl.stem} 없음 — 건너뜀')
            continue

        base, _ = read_image_section(pzx.read_bytes(),
                                     struct.unpack_from('<I', pzx.read_bytes(), 4)[0])
        palettes = parsed['palettes']
        rule = OUTFIT_RULES.get(stem) or KNOWN_BULK_RULES.get(stem) or UNKNOWN_RULE
        write_palette_json(folder, relative, base, palettes, rule, dry_run)
        note = f'벌 {len(palettes)} × {len(palettes[0])}색, 구워진 벌 {baked_palette_index(base, palettes)}'

        if stem in OUTFIT_RULES:
            loose, composed = write_index_maps(pzx, folder, dry_run)
            note += f', 번호 지도 낱장 {loose}장 · 프레임 {composed}장'
        print(f'  {relative:<34} {note}')


# ── 4. 프레임 박스 ────────────────────────────────────────────────────────────

def export_boxes(dry_run: bool) -> int:
    """`frames/boxes.json` — origins.json 은 화면들이 읽고 있으므로 건드리지 않는다."""
    total = 0
    sources = sorted(JAR.rglob('*.pzx')) + sorted(JAR.rglob('*.pzf'))
    for path in sources:
        frame_dir = PUBLIC / path.stem / 'frames'
        if not frame_dir.is_dir():
            continue
        try:
            boxes = frame_boxes(path)
        except (ValueError, struct.error, IndexError) as error:
            print(f'  {path.name:<34} 박스를 읽지 못했다: {error}')
            continue
        if not boxes:
            continue
        if not dry_run:
            (frame_dir / 'boxes.json').write_text(
                json.dumps(boxes, indent=1, sort_keys=True), encoding='utf-8')
        print(f'  {path.name:<34} 박스 있는 프레임 {len(boxes)}개 → {frame_dir}/boxes.json')
        total += len(boxes)
    return total


def main() -> int:
    parser = argparse.ArgumentParser(description='.mpl 대체 팔레트와 프레임 박스를 스프라이트에 반영한다')
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
                    print(f'    {index}: {[hex_color(color) for color in palette]}')
        else:
            print(f'{arguments.dump}: 통팔레트 {len(parsed["palettes"])}벌 '
                  f'(색 {len(parsed["palettes"][0])}개)')
            for index, palette in enumerate(parsed['palettes']):
                shown = [hex_color(color) for color in palette[:8]]
                print(f'  {index}: {shown if len(palette) <= 8 else shown + ["…"]}')
        return 0

    if not (JAR / 'ui/img_text.mpl').exists():
        print(f'{JAR}/ui/img_text.mpl 이 없다 — 먼저 원본 jar 를 풀어야 한다', file=sys.stderr)
        return 1

    print('1. ui/img_text.mpl → public/sprites/img_text/frames')
    changed = apply_img_text(arguments.dry_run)
    print(f'   {"바꿀 픽셀" if arguments.dry_run else "바꾼 픽셀"} {changed}개')

    print('2·3. 통팔레트 → palette.json · 팔레트 번호 지도')
    export_palettes(arguments.dry_run)

    print('4. 프레임 박스 → boxes.json')
    boxes = export_boxes(arguments.dry_run)
    print(f'   박스를 가진 프레임 {boxes}개')
    return 0


if __name__ == '__main__':
    sys.exit(main())
