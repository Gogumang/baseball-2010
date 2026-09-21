#!/usr/bin/env python3
"""원본 비트맵 글꼴(.ft2)을 웹용 아틀라스 PNG + 좌표 JSON 으로 뽑는다.

    python3 tools/extract_font.py
    python3 tools/extract_font.py --sample /tmp/pixel-font-sample.png

해독 근거는 baseball-2010-re/docs/re/R5-font-particles.md 의 1·2·3·5·6 절이다.

내는 것:
  public/font/synGak9_11.png            한글 조각 483개 아틀라스 (9x11 칸, 27열 x 23행)
  public/font/synGulimAsc5_11.png       영문 조각 94개 아틀라스 (5x11 칸, 16열 x 6행)
  src/shared/lib/font/fontAtlas.generated.json   아틀라스 좌표 + 획 복잡도 표 + KS X 1001 2350자

한글 글꼴 synGak9_11.ft2(6348B)의 구조 — 머리글 없는 형식(첫 3바이트가 "BFT" 가 아니다):
    [0]=w(9) [1]=h(11), 그 뒤로 조각이 bpg=(9*11+7)>>3=13 바이트씩
    초성 12벌 x 19자 = 228조각  (파일 +2)
    중성  7벌 x 21자 = 147조각  (파일 +2966)
    종성  4벌 x 27자 = 108조각  (파일 +4877)
    끝 67바이트 = 획 복잡도 표 3개 (중성[21] · 초성[19] · 종성[27], 파일 +6281)
  2 + 483*13 + 67 = 6348 으로 파일 크기와 정확히 맞는다 → 조각은 483개다
  (L 노트의 "488 조각" 은 틀렸다고 R5 가 정정했고, 파일 크기가 그 정정을 뒷받침한다).

영문 글꼴 synGulimAsc5_11.ft2(660B): [0]=w(5) [1]=h(11), bpg=(5*11+7)>>3=7,
  0x21~0x7E 94자가 `+2 + (c-0x21)*7`. 2 + 94*7 = 660 으로 역시 딱 맞는다.

조각 비트: 행 우선, MSB 먼저, 1 = 글꼴색(원본 기본 흰색 0xFFFF), 0 = 투명.
"""
import argparse
import json
import struct
import zlib
from pathlib import Path

JAR = Path('base/work/jar')
HANGUL_FT2 = 'synGak9_11.ft2'
ASCII_FT2 = 'synGulimAsc5_11.ft2'

# 한글 아틀라스 격자: 한 줄이 한 벌이다 (초성 12벌 · 중성 7벌 · 종성 4벌 = 23줄, 가장 긴 벌이 27자)
ATLAS_COLUMNS = 27
CHO_SETS, CHO_COUNT = 12, 19
JUNG_SETS, JUNG_COUNT = 7, 21
JONG_SETS, JONG_COUNT = 4, 27
CHO_ROW = 0
JUNG_ROW = CHO_ROW + CHO_SETS          # 12
JONG_ROW = JUNG_ROW + JUNG_SETS        # 19
ATLAS_ROWS = JONG_ROW + JONG_SETS      # 23

# 영문 아틀라스 격자
ASCII_COLUMNS = 16
ASCII_FIRST = 0x21
ASCII_COUNT = 94

# 벌 고르기 표 0xd7290 (모드 0 → 행 0..4). [초성벌, 중성벌, 종성벌]
ROW_TABLE = [[6, 2, 1], [10, 5, 1], [6, 4, 3], [8, 3, 2], [5, 1, 0]]
# 0xd731d SHAPE[21] — 받침 없을 때 중성 모양에 따른 초성 벌
SHAPE = [0, 1, 0, 1, 0, 1, 0, 1, 2, 4, 4, 4, 2, 3, 5, 5, 5, 3, 2, 4, 0]
# 0xd7332 HZ[21] — 가로획 있는 모음 ㅗ~ㅢ
HZ = [0] * 8 + [1] * 12 + [0]
# 0xd7347 CX[21] — 복합 모음 ㅘㅙㅚㅝㅞㅟㅢ
CX = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0]

# 호환 자모(U+3131~U+3163) 51자의 자리. 원본은 표 0xd5fc8 을 거치지만 결과는 표준 조합형과 같다.
CHO_ORDER = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
JUNG_ORDER = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
JONG_ORDER = 'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'

# R5 2절: 원본 표 0xd602e 가 세 글자만 표준 조합형과 다르다(원본 오타). binary.mod 가 있으면 다시 뽑는다.
FALLBACK_QUIRKS = {'괩': '괨', '닒': '닖', '쏀': '쎙'}


# ---------------------------------------------------------------- .ft2 읽기

class HangulFont:
    """머리글 없는 형식의 한글 벌 글꼴 (파서 0x9c73c 가 읽는 그대로)."""

    def __init__(self, raw: bytes):
        self.width, self.height = raw[0], raw[1]
        self.bpg = (self.width * self.height + 7) >> 3
        self.raw = raw
        self.cho_base = 2
        self.jung_base = self.cho_base + CHO_SETS * CHO_COUNT * self.bpg
        self.jong_base = self.jung_base + JUNG_SETS * JUNG_COUNT * self.bpg
        table = self.jong_base + JONG_SETS * JONG_COUNT * self.bpg
        # 파일 끝 67바이트 = 획 복잡도 표. 글꼴 객체 칸 +0x3c(중성) +0x38(초성) +0x40(종성) 순서다.
        self.jung_stroke = list(raw[table:table + JUNG_COUNT])
        self.cho_stroke = list(raw[table + JUNG_COUNT:table + JUNG_COUNT + CHO_COUNT])
        self.jong_stroke = list(raw[table + JUNG_COUNT + CHO_COUNT:table + JUNG_COUNT + CHO_COUNT + JONG_COUNT])
        expected = table + JUNG_COUNT + CHO_COUNT + JONG_COUNT
        if expected != len(raw):
            raise SystemExit(f'{HANGUL_FT2} 크기가 다르다: {len(raw)} (예상 {expected})')

    def piece(self, base: int, index: int) -> bytes:
        start = base + index * self.bpg
        return self.raw[start:start + self.bpg]


class AsciiFont:
    """영문 1바이트 글꼴 (파서 0x9c8a4)."""

    def __init__(self, raw: bytes):
        self.width, self.height = raw[0], raw[1]
        self.bpg = (self.width * self.height + 7) >> 3
        self.raw = raw
        if 2 + ASCII_COUNT * self.bpg != len(raw):
            raise SystemExit(f'{ASCII_FT2} 크기가 다르다: {len(raw)}')

    def piece(self, code: int) -> bytes:
        start = 2 + (code - ASCII_FIRST) * self.bpg
        return self.raw[start:start + self.bpg]


def unpack_bits(data: bytes, width: int, height: int) -> list[list[int]]:
    """행 우선·MSB 먼저인 1비트 조각을 픽셀 격자로 푼다."""
    bits = ''.join(f'{byte:08b}' for byte in data)
    return [[1 if bits[y * width + x] == '1' else 0 for x in range(width)] for y in range(height)]


# ---------------------------------------------------------------- 합성 (0x9bb28)

def choose_sets(cho: int, jung: int, jong: int, font: HangulFont) -> tuple[int, int, int]:
    """(초성벌, 중성벌, 종성벌). 없는 자리는 −1 로 넘긴다. R5 3절 식 그대로."""
    jung_index = jung
    if jung_index < 0 and jong < 0:
        jung_index = 0
    # HZ/SHAPE 를 −1 로 읽는 경우(자음/겹자음 홀로)는 원본이 배열 앞을 넘겨 읽는 자리다.
    # 파이썬의 음수 첨자는 맨 뒤(20번)를 집는데, HZ[20]=0 · SHAPE[20]=0 이라 결과가 원본과 같다.
    if HZ[jung_index] and jong >= 0:
        a = font.cho_stroke[max(cho, 0)]
        b = font.jong_stroke[jong]
        t = 0 if a + b > 4 else 1 if (a == 1 and b == 3) else 2 if (a == 3 and b == 1) else 3
        cho_set = ROW_TABLE[t][0] + CX[jung_index]
        jung_set, jong_set = ROW_TABLE[t][1], ROW_TABLE[t][2]
    elif jong < 0:
        cho_set = SHAPE[jung_index]
        cho_set = cho_set - 1 if cho_set > 0 else cho_set   # 형식 1 에서만 1 뺀다
        jung_set, jong_set = 0, 0
    else:
        cho_set, jung_set, jong_set = ROW_TABLE[4][0], ROW_TABLE[4][1], 0
    if cho < 0 and jong < 0:
        jung_set = 6                                         # 모음 홀로
    return cho_set, jung_set, jong_set


def compose_bits(cho: int, jung: int, jong: int, font: HangulFont) -> bytes:
    """원본 0x9bb28 그대로 세 조각을 비트열로 OR 한다 (웹 쪽 정답지)."""
    cho_set, jung_set, jong_set = choose_sets(cho, jung, jong, font)
    buf = bytearray(font.bpg)

    def merge(base: int, index: int, shift: int) -> None:
        # 0x9baf8: 조각 전체를 한 비트열로 보고 오른쪽으로 shift 비트 민다
        piece = font.piece(base, index)
        acc = 0
        for i in range(font.bpg):
            acc = (acc << 8) | piece[i]
            buf[i] |= (acc >> shift) & 0xFF

    if cho >= 0:
        merge(font.cho_base, cho + cho_set * CHO_COUNT, 2 if (jung < 0 and jong < 0) else 0)
    if jung >= 0:
        merge(font.jung_base, jung + jung_set * JUNG_COUNT, 0)
    if jong >= 0:
        merge(font.jong_base, jong + jong_set * JONG_COUNT, font.jung_stroke[jung] if jung >= 0 else 0)
    return bytes(buf)


def compose_pixels(cho: int, jung: int, jong: int, font: HangulFont) -> list[list[int]]:
    """조각을 픽셀 단위로 겹쳐 그린다 — 웹 컴포넌트가 하는 방식."""
    cho_set, jung_set, jong_set = choose_sets(cho, jung, jong, font)
    out = [[0] * font.width for _ in range(font.height)]

    def draw(base: int, index: int, shift: int) -> None:
        grid = unpack_bits(font.piece(base, index), font.width, font.height)
        for y in range(font.height):
            for x in range(font.width):
                if grid[y][x] and x + shift < font.width:
                    out[y][x + shift] = 1

    if cho >= 0:
        draw(font.cho_base, cho + cho_set * CHO_COUNT, 2 if (jung < 0 and jong < 0) else 0)
    if jung >= 0:
        draw(font.jung_base, jung + jung_set * JUNG_COUNT, 0)
    if jong >= 0:
        draw(font.jong_base, jong + jong_set * JONG_COUNT, font.jung_stroke[jung] if jung >= 0 else 0)
    return out


def verify_pixel_shift(font: HangulFont) -> None:
    """비트열 밀기 == 픽셀 밀기 인지 확인한다.

    원본의 밀기는 13바이트 전체를 한 비트열로 보므로 9픽셀 행 경계를 넘어 감겨 들어올 수 있다.
    그런데 **실제로 닿는 조합**(초성 벌0 을 2픽셀 · 종성 아무 벌이나 1픽셀)에서는 밀려 나가는
    비트가 전부 0 이라 두 방식의 결과가 같다. 그래서 웹 컴포넌트는 조각을 x+shift 에 그냥 겹쳐
    그려도 원본과 비트 단위로 같다. 글꼴 파일이 바뀌면 여기서 걸린다.
    """
    for cho in range(CHO_COUNT):
        if compose_bits(cho, -1, -1, font) != pack_bits(compose_pixels(cho, -1, -1, font), font):
            raise SystemExit(f'초성 {cho} 홀로: 비트열 밀기와 픽셀 밀기가 다르다')
    for jung in (1, 3, 5, 7, 10, 15):      # 획 복잡도 표에서 종성을 1픽셀 미는 모음 ㅐㅒㅔㅖㅙㅞ
        for cho in range(CHO_COUNT):
            for jong in range(JONG_COUNT):
                if compose_bits(cho, jung, jong, font) != pack_bits(compose_pixels(cho, jung, jong, font), font):
                    raise SystemExit(f'{cho}/{jung}/{jong}: 비트열 밀기와 픽셀 밀기가 다르다')


def pack_bits(grid: list[list[int]], font: HangulFont) -> bytes:
    bits = ''.join(str(p) for row in grid for p in row).ljust(font.bpg * 8, '0')
    return bytes(int(bits[i:i + 8], 2) for i in range(0, font.bpg * 8, 8))


# ---------------------------------------------------------------- PNG 쓰기

def write_png(path: Path, width: int, height: int, rows: list[bytearray]) -> None:
    body = bytearray()
    for row in rows:
        body.append(0)
        body += row

    def chunk(tag: bytes, payload: bytes) -> bytes:
        return (struct.pack('>I', len(payload)) + tag + payload
                + struct.pack('>I', zlib.crc32(tag + payload) & 0xFFFFFFFF))

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b'\x89PNG\r\n\x1a\n'
                     + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
                     + chunk(b'IDAT', zlib.compress(bytes(body), 9))
                     + chunk(b'IEND', b''))


def blank_rows(width: int, height: int) -> list[bytearray]:
    return [bytearray(width * 4) for _ in range(height)]


def blit(rows: list[bytearray], grid: list[list[int]], x0: int, y0: int,
         color: tuple[int, int, int, int] = (255, 255, 255, 255)) -> None:
    for y, line in enumerate(grid):
        row = rows[y0 + y]
        for x, on in enumerate(line):
            if on:
                row[(x0 + x) * 4:(x0 + x) * 4 + 4] = bytes(color)


# ---------------------------------------------------------------- KS X 1001 2350자

def read_ks_table(binary: Path) -> tuple[str, dict[str, str]]:
    """binary.mod 의 CP949→조합형 표 0xd602e 로 2350자와 원본 오타를 뽑는다."""
    raw = binary.read_bytes()
    codes = struct.unpack('<2350H', raw[0xd602e - 0xfcc:0xd602e - 0xfcc + 4700])
    chars, quirks = [], {}
    for i, code in enumerate(codes):
        source = bytes([0xB0 + i // 94, 0xA1 + i % 94]).decode('cp949')
        chars.append(source)
        drawn = code.to_bytes(2, 'big').decode('johab')
        if drawn != source:
            quirks[source] = drawn
    return ''.join(chars), quirks


def ks_table_from_codec() -> tuple[str, dict[str, str]]:
    """binary.mod 가 없을 때. 2350자는 cp949 코덱으로 같게 나오고 오타 3자는 R5 2절 값을 쓴다."""
    chars = [bytes([0xB0 + i // 94, 0xA1 + i % 94]).decode('cp949') for i in range(2350)]
    return ''.join(chars), dict(FALLBACK_QUIRKS)


def jamo_slots() -> list[list[int]]:
    """호환 자모 51자의 (초성, 중성, 종성) 조각 순번. 없는 자리는 −1."""
    slots = []
    for code in range(0x3131, 0x3164):
        ch = chr(code)
        if ch in JUNG_ORDER:
            slots.append([-1, JUNG_ORDER.index(ch), -1])
        elif ch in CHO_ORDER:
            slots.append([CHO_ORDER.index(ch), -1, -1])
        else:                                   # 초성으로 못 쓰는 겹자음 ㄳㄵㄶㄺ~ㅀㅄ
            slots.append([-1, -1, JONG_ORDER.index(ch)])
    return slots


# ---------------------------------------------------------------- 배치 (0x9c068)

def text_pieces(text: str, hangul: HangulFont, ascii_font: AsciiFont,
                allowed: set[str], quirks: dict[str, str], gap: int):
    """원본 전진 규칙대로 (x, 픽셀격자) 목록과 전체 폭을 낸다. 미리보기 PNG 용."""
    out, x = [], 0
    for ch in text:
        if ch == '·':
            ch = '.'
        elif ch == '‥':
            ch = ':'
        code = ord(ch)
        if code < 0x80:
            if ASCII_FIRST <= code <= 0x7E:
                out.append((x, unpack_bits(ascii_font.piece(code), ascii_font.width, ascii_font.height)))
            x += ascii_font.width + gap        # 공백·제어도 전진은 한다
            continue
        if 0x3131 <= ord(ch) <= 0x3163:
            cho, jung, jong = jamo_slots()[ord(ch) - 0x3131]
        elif ch in allowed:
            # 그릴 수 있는지는 원래 글자로 따지고, 조각 순번만 원본 표의 오타대로 바꾼다.
            # (오타가 가리키는 괨·닖·쎙 은 2350자 밖이라 순서를 바꾸면 통째로 사라진다)
            base = ord(quirks.get(ch, ch)) - 0xAC00
            cho, jung, jong = base // 588, (base % 588) // 28, base % 28 - 1
        else:
            continue                            # 2350자 밖: 안 그리고 전진도 안 한다
        out.append((x, compose_pixels(cho, jung, jong, hangul)))
        x += hangul.width + gap
    return out, max(x - gap, 0)


def render_sample(path: Path, lines: list[str], hangul: HangulFont, ascii_font: AsciiFont,
                  allowed: set[str], quirks: dict[str, str], gap: int, line_gap: int, scale: int) -> None:
    laid = [text_pieces(line, hangul, ascii_font, allowed, quirks, gap) for line in lines]
    line_height = hangul.height + line_gap
    width = max(w for _, w in laid) + 8
    height = line_height * len(lines) + 6
    canvas = [[0] * width for _ in range(height)]
    for index, (pieces, _) in enumerate(laid):
        for x0, grid in pieces:
            for y, row in enumerate(grid):
                for x, on in enumerate(row):
                    if on:
                        canvas[3 + index * line_height + y][4 + x0 + x] = 1
    rows = blank_rows(width * scale, height * scale)
    for y in range(height * scale):
        row = rows[y]
        for x in range(width * scale):
            on = canvas[y // scale][x // scale]
            row[x * 4:x * 4 + 4] = bytes((30, 30, 30, 255) if on else (250, 246, 232, 255))
    write_png(path, width * scale, height * scale, rows)
    print(f'  미리보기 {path} ({width * scale}x{height * scale})')


# ---------------------------------------------------------------- 본체

SAMPLE_LINES = [
    '게임빌 2010 프로야구',
    '홈런! 삼진 아웃, 뷁 괜찮아?',
    'ㄱㄴㄷ ㅏㅑ 한글 조합형 벌 글꼴',
    'Score 3:2 (9th) HOMERUN~',
    '쏀 괩 닒 가각갂 꽃밭 읽다 넓다',
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--jar', type=Path, default=JAR, help='.ft2 가 풀려 있는 폴더')
    parser.add_argument('--public', type=Path, default=Path('public/font'))
    parser.add_argument('--json', type=Path, default=Path('src/shared/lib/font/fontAtlas.generated.json'))
    parser.add_argument('--sample', type=Path, default=None, help='미리보기 PNG 를 낼 경로')
    parser.add_argument('--sample-gap', type=int, default=1, help='미리보기 자간 (앱 전역 글꼴 = 1)')
    parser.add_argument('--sample-line-gap', type=int, default=3)
    parser.add_argument('--sample-scale', type=int, default=3)
    parser.add_argument('--text', action='append', default=None, help='미리보기에 쓸 줄 (여러 번)')
    arguments = parser.parse_args()

    hangul = HangulFont((arguments.jar / HANGUL_FT2).read_bytes())
    ascii_font = AsciiFont((arguments.jar / ASCII_FT2).read_bytes())
    print(f'한글 {hangul.width}x{hangul.height} bpg={hangul.bpg} 조각 '
          f'{CHO_SETS * CHO_COUNT + JUNG_SETS * JUNG_COUNT + JONG_SETS * JONG_COUNT}개 / '
          f'영문 {ascii_font.width}x{ascii_font.height} bpg={ascii_font.bpg} {ASCII_COUNT}자')
    verify_pixel_shift(hangul)
    print('  비트열 밀기 = 픽셀 밀기 확인')

    binary = arguments.jar / 'binary.mod'
    if binary.exists():
        ks2350, quirks = read_ks_table(binary)
        print(f'  CP949 표 0xd602e 에서 2350자를 읽었다 (원본 오타 {len(quirks)}자: '
              f'{", ".join(f"{a}→{b}" for a, b in quirks.items())})')
    else:
        ks2350, quirks = ks_table_from_codec()
        print('  binary.mod 가 없어 cp949 코덱으로 2350자를 만들었다 (오타는 R5 2절 값)')

    # 한글 아틀라스: 한 줄이 한 벌
    atlas_width, atlas_height = ATLAS_COLUMNS * hangul.width, ATLAS_ROWS * hangul.height
    rows = blank_rows(atlas_width, atlas_height)
    for group, (base, sets, count, row0) in {
        'cho': (hangul.cho_base, CHO_SETS, CHO_COUNT, CHO_ROW),
        'jung': (hangul.jung_base, JUNG_SETS, JUNG_COUNT, JUNG_ROW),
        'jong': (hangul.jong_base, JONG_SETS, JONG_COUNT, JONG_ROW),
    }.items():
        del group
        for set_index in range(sets):
            for piece in range(count):
                grid = unpack_bits(hangul.piece(base, piece + set_index * count), hangul.width, hangul.height)
                blit(rows, grid, piece * hangul.width, (row0 + set_index) * hangul.height)
    hangul_png = arguments.public / 'synGak9_11.png'
    write_png(hangul_png, atlas_width, atlas_height, rows)
    print(f'  {hangul_png} ({atlas_width}x{atlas_height})')

    # 영문 아틀라스
    ascii_rows_count = -(-ASCII_COUNT // ASCII_COLUMNS)
    ascii_width = ASCII_COLUMNS * ascii_font.width
    ascii_height = ascii_rows_count * ascii_font.height
    rows = blank_rows(ascii_width, ascii_height)
    for index in range(ASCII_COUNT):
        grid = unpack_bits(ascii_font.piece(ASCII_FIRST + index), ascii_font.width, ascii_font.height)
        blit(rows, grid, (index % ASCII_COLUMNS) * ascii_font.width,
             (index // ASCII_COLUMNS) * ascii_font.height)
    ascii_png = arguments.public / 'synGulimAsc5_11.png'
    write_png(ascii_png, ascii_width, ascii_height, rows)
    print(f'  {ascii_png} ({ascii_width}x{ascii_height})')

    payload = {
        '주석': 'tools/extract_font.py 가 base/work/jar/*.ft2 에서 뽑았다 — 손으로 고치지 마라',
        'hangul': {
            'atlas': './font/synGak9_11.png',
            'glyphWidth': hangul.width,
            'glyphHeight': hangul.height,
            'atlasWidth': atlas_width,
            'atlasHeight': atlas_height,
            'choRow': CHO_ROW, 'choSets': CHO_SETS, 'choCount': CHO_COUNT,
            'jungRow': JUNG_ROW, 'jungSets': JUNG_SETS, 'jungCount': JUNG_COUNT,
            'jongRow': JONG_ROW, 'jongSets': JONG_SETS, 'jongCount': JONG_COUNT,
            'choStroke': hangul.cho_stroke,
            'jungStroke': hangul.jung_stroke,
            'jongStroke': hangul.jong_stroke,
        },
        'ascii': {
            'atlas': './font/synGulimAsc5_11.png',
            'glyphWidth': ascii_font.width,
            'glyphHeight': ascii_font.height,
            'atlasWidth': ascii_width,
            'atlasHeight': ascii_height,
            'columns': ASCII_COLUMNS,
            'first': ASCII_FIRST,
            'count': ASCII_COUNT,
        },
        'jamoSlots': jamo_slots(),
        'quirks': quirks,
        'ks2350': ks2350,
    }
    arguments.json.parent.mkdir(parents=True, exist_ok=True)
    arguments.json.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'  {arguments.json}')

    if arguments.sample is not None:
        render_sample(arguments.sample, arguments.text or SAMPLE_LINES, hangul, ascii_font,
                      set(ks2350), quirks, arguments.sample_gap, arguments.sample_line_gap,
                      arguments.sample_scale)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
