#!/usr/bin/env python3
"""원본 비트맵 글꼴 아틀라스를 진짜 웹폰트(TTF/WOFF2)로 굽는다.

    python3 -m venv tools/.venv && tools/.venv/bin/pip install fonttools brotli
    tools/.venv/bin/python tools/build_webfont.py

⚠️ 시스템 파이썬(`python3`)은 외부 관리라 fonttools 를 못 깐다. **반드시 위 venv 를 써라.**
venv 는 저장소에 넣지 않는다 (.gitignore 의 `tools/.venv/`).

왜 만드나
---------
화면 52곳은 `MarkupText`(색 태그)·`MenuList` 같은 평범한 DOM 으로 글을 찍는다. 조각을 직접
찍는 `shared/ui/PixelText` 로 갈아 끼우려면 52곳을 하나씩 손봐야 한다. 대신 원본 글자 모양
그대로인 **웹폰트**를 만들어 두면 `app/styles/theme.css.ts` 의 `font.body` 한 줄만 바꿔
전 화면이 원본 글자로 바뀐다.

들어오는 것 (tools/extract_font.py 가 이미 뽑아 둔 것들 — 원본 .ft2 는 필요 없다)
  public/font/synGak9_11.png                     한글 조각 483개 (9x11 칸, 27열 x 23행)
  public/font/synGulimAsc5_11.png                영문 94자 (5x11 칸, 16열)
  src/shared/lib/font/fontAtlas.generated.json   아틀라스 좌표 + 획 복잡도 표 + 2350자 + 오타 3자

내는 것
  public/font/synGak9.woff2   (--ttf 를 주면 TTF 도 같이 낸다 — 검사용이라 기본은 안 낸다)

합성 규칙은 **다시 쓰지 않는다.** `tools/extract_font.py` 의 `choose_sets`(벌 고르기)와
`jamo_slots`(호환 자모 자리)를 그대로 import 해서 쓴다. 웹 쪽 `src/shared/lib/font/compose.ts`
도 같은 표를 옮긴 것이고 `compose.test.ts` 가 그 값을 붙들고 있으므로, 세 곳이 한 근원을
본다. `--verify-ft2` 를 주면 원본 .ft2 에서 다시 합성한 픽셀과 한 글자씩 대조까지 한다
(base/work/jar 이 있을 때 자동으로 켜진다).

치수 (원본 0x9c068 의 전진 규칙 그대로)
  unitsPerEm = 1100 → 1px = 100 유닛. 11 의 배수라 원본 11px 줄이 정수로 떨어진다.
  수평 전진: 한글 900(9px) · 영문 900이 아니라 500(5px) · 공백 500. 자간은 폰트가 아니라
             CSS `letter-spacing` 이 맡는다 (앱 전역 글꼴 = 1px).
  기준선(baseline): 칸 위에서 10px 아래. 영문 대문자가 0~9행을 쓰고 g·p·y·j·, 가 10행까지
             내려가므로 ascent 1000 · descent 100 이면 11px 칸이 딱 맞는다.

담는 글자 (2401자 + 공백/대체 몇 자)
  KS X 1001 완성형 2350자 + 호환 자모 51자 + ASCII 94자.
  **2350자 밖 한글(뷁·갂 …)은 넣지 않는다** — 원본이 안 그리고 전진도 안 하는 것을 그대로
  옮긴 것이다. 원본 표의 오타 3자(괩→괨·닒→닖·쏀→쎙)도 그대로 재현한다.
"""
import argparse
import calendar
import hashlib
import json
import struct
import sys
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import extract_font as ef  # noqa: E402  (같은 폴더의 추출기에서 합성 규칙을 빌려 온다)

from fontTools.fontBuilder import FontBuilder  # noqa: E402
from fontTools.misc.timeTools import timestampSinceEpoch  # noqa: E402
from fontTools.pens.ttGlyphPen import TTGlyphPen  # noqa: E402
from fontTools.ttLib import TTFont  # noqa: E402

# ---------------------------------------------------------------- 치수

UNITS_PER_PIXEL = 100
UNITS_PER_EM = 11 * UNITS_PER_PIXEL     # 1100 — 원본 줄 높이 11px 가 정수로 떨어진다
ASCENT_PX = 10                          # 칸 0~9행이 기준선 위
DESCENT_PX = 1                          # 10행(g·p·y·j·,)이 기준선 아래
ASCENT = ASCENT_PX * UNITS_PER_PIXEL
DESCENT = DESCENT_PX * UNITS_PER_PIXEL

FAMILY_NAME = 'SynGak9'
STYLE_NAME = 'Regular'
VERSION = '1.000'

# 글꼴 안에 날짜를 박으면 돌릴 때마다 파일이 달라진다. 원본 게임이 나온 해로 고정한다.
FIXED_TIMESTAMP = timestampSinceEpoch(calendar.timegm((2009, 1, 1, 0, 0, 0, 0, 1, 0)))

# 원본 0x9c19c~0x9c1b2: '·' 와 '‥' 만 영문 글꼴의 '.' 과 ':' 로 바뀐다 (compose.ts 의 ASCII_SUBSTITUTES)
ASCII_SUBSTITUTES = {0x00B7: ord('.'), 0x2025: ord(':')}

DEFAULT_JSON = Path('src/shared/lib/font/fontAtlas.generated.json')
DEFAULT_FONT_DIR = Path('public/font')
DEFAULT_OUT = DEFAULT_FONT_DIR / 'synGak9.woff2'


# ---------------------------------------------------------------- PNG 읽기

def read_png_alpha(path: Path) -> tuple[int, int, list[list[int]]]:
    """8비트 RGBA PNG 의 알파만 0/1 격자로 읽는다 (아틀라스는 흰 픽셀 + 투명뿐이다)."""
    raw = path.read_bytes()
    if raw[:8] != b'\x89PNG\r\n\x1a\n':
        raise SystemExit(f'{path}: PNG 가 아니다')
    pos, idat, header = 8, bytearray(), None
    while pos < len(raw):
        length = struct.unpack('>I', raw[pos:pos + 4])[0]
        tag = raw[pos + 4:pos + 8]
        payload = raw[pos + 8:pos + 8 + length]
        if tag == b'IHDR':
            header = struct.unpack('>IIBBBBB', payload[:13])
        elif tag == b'IDAT':
            idat += payload
        pos += 12 + length
    if header is None:
        raise SystemExit(f'{path}: IHDR 이 없다')
    width, height, depth, color_type = header[0], header[1], header[2], header[3]
    if (depth, color_type) != (8, 6):
        raise SystemExit(f'{path}: 8비트 RGBA 가 아니다 (depth={depth} color={color_type})')

    data = zlib.decompress(bytes(idat))
    stride, bpp = width * 4, 4
    grid, previous, cursor = [], bytearray(stride), 0
    for _ in range(height):
        filter_type = data[cursor]
        cursor += 1
        line = bytearray(data[cursor:cursor + stride])
        cursor += stride
        if filter_type == 1:
            for x in range(bpp, stride):
                line[x] = (line[x] + line[x - bpp]) & 0xFF
        elif filter_type == 2:
            for x in range(stride):
                line[x] = (line[x] + previous[x]) & 0xFF
        elif filter_type == 3:
            for x in range(stride):
                left = line[x - bpp] if x >= bpp else 0
                line[x] = (line[x] + ((left + previous[x]) >> 1)) & 0xFF
        elif filter_type == 4:
            for x in range(stride):
                a = line[x - bpp] if x >= bpp else 0
                b = previous[x]
                c = previous[x - bpp] if x >= bpp else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 0xFF
        elif filter_type != 0:
            raise SystemExit(f'{path}: 모르는 PNG 필터 {filter_type}')
        grid.append([1 if line[x * 4 + 3] else 0 for x in range(width)])
        previous = line
    return width, height, grid


# ---------------------------------------------------------------- 아틀라스에서 합성

class Strokes:
    """extract_font.choose_sets 가 찾는 획 복잡도 표만 들고 있는 껍데기.

    추출기는 .ft2 를 읽은 HangulFont 를 받지만 실제로 쓰는 건 cho_stroke·jong_stroke 뿐이다.
    JSON 에 같은 표가 들어 있으므로 원본 파일 없이도 같은 벌을 고를 수 있다.
    """

    def __init__(self, hangul: dict):
        self.cho_stroke = hangul['choStroke']
        self.jung_stroke = hangul['jungStroke']
        self.jong_stroke = hangul['jongStroke']


class Atlas:
    """아틀라스 PNG 두 장에서 칸을 떠 온다."""

    def __init__(self, meta: dict, font_dir: Path):
        self.hangul = meta['hangul']
        self.ascii = meta['ascii']
        self.strokes = Strokes(self.hangul)
        _, _, self.hangul_grid = read_png_alpha(font_dir / 'synGak9_11.png')
        _, _, self.ascii_grid = read_png_alpha(font_dir / 'synGulimAsc5_11.png')

    def hangul_cell(self, column: int, row: int) -> list[list[int]]:
        w, h = self.hangul['glyphWidth'], self.hangul['glyphHeight']
        x0, y0 = column * w, row * h
        return [[self.hangul_grid[y0 + y][x0 + x] for x in range(w)] for y in range(h)]

    def ascii_cell(self, code: int) -> list[list[int]]:
        w, h = self.ascii['glyphWidth'], self.ascii['glyphHeight']
        index = code - self.ascii['first']
        x0 = (index % self.ascii['columns']) * w
        y0 = (index // self.ascii['columns']) * h
        return [[self.ascii_grid[y0 + y][x0 + x] for x in range(w)] for y in range(h)]

    def compose(self, cho: int, jung: int, jong: int) -> list[list[int]]:
        """초성·중성·종성 조각을 겹쳐 한 글자를 만든다 (compose.ts 의 composePieces 와 같은 계산).

        벌 고르기는 추출기 것을 그대로 쓰고, 미는 양도 원본 0x9baf8 그대로다
        (자음 홀로 2px · 세로획 둘인 모음 아래 받침 1px).
        """
        meta = self.hangul
        w, h = meta['glyphWidth'], meta['glyphHeight']
        cho_set, jung_set, jong_set = ef.choose_sets(cho, jung, jong, self.strokes)
        out = [[0] * w for _ in range(h)]

        def draw(column: int, row: int, shift: int) -> None:
            cell = self.hangul_cell(column, row)
            for y in range(h):
                for x in range(w):
                    if cell[y][x] and x + shift < w:
                        out[y][x + shift] = 1

        if cho >= 0:
            draw(cho, meta['choRow'] + cho_set, 2 if (jung < 0 and jong < 0) else 0)
        if jung >= 0:
            draw(jung, meta['jungRow'] + jung_set, 0)
        if jong >= 0:
            draw(jong, meta['jongRow'] + jong_set, meta['jungStroke'][jung] if jung >= 0 else 0)
        return out


def syllable_indices(character: str, drawable: set[str], quirks: dict[str, str]) -> tuple[int, int, int] | None:
    """완성형 한 글자의 (초성, 중성, 종성) 조각 순번. 원본이 못 그리면 None.

    그릴 수 있는지는 **원래 글자로** 따지고 순번만 오타대로 바꾼다 — 오타가 가리키는
    괨·닖·쎙 은 2350자 밖이라 순서를 뒤집으면 세 글자가 통째로 사라진다 (compose.ts 와 같다).
    """
    if character not in drawable:
        return None
    offset = ord(quirks.get(character, character)) - 0xAC00
    return offset // 588, (offset % 588) // 28, offset % 28 - 1


# ---------------------------------------------------------------- 픽셀 → 윤곽

def rectangles(grid: list[list[int]]) -> tuple[tuple[int, int, int, int], ...]:
    """켜진 픽셀을 사각형 몇 개로 덮는다.

    한 픽셀에 사각형 하나씩 만들면 점이 네 배로 늘어 파일이 커진다. 같은 행에서 이어진
    픽셀을 가로로 합치고, 바로 아래 행에도 같은 가로 범위가 통째로 켜져 있으면 세로로도
    더 합친다. 결과는 원본 픽셀과 정확히 같은 모양이다 (근사가 아니다).
    """
    height = len(grid)
    width = len(grid[0]) if height else 0
    used = [[False] * width for _ in range(height)]
    found = []
    for y in range(height):
        x = 0
        while x < width:
            if not grid[y][x] or used[y][x]:
                x += 1
                continue
            right = x
            while right < width and grid[y][right] and not used[y][right]:
                right += 1
            bottom = y + 1
            while (bottom < height
                   and all(grid[bottom][i] and not used[bottom][i] for i in range(x, right))):
                bottom += 1
            for yy in range(y, bottom):
                for xx in range(x, right):
                    used[yy][xx] = True
            found.append((x, y, right, bottom))
            x = right
    return tuple(found)


def build_glyph(rects: tuple[tuple[int, int, int, int], ...]):
    """사각형 목록을 TrueType 글리프로. 유닛은 기준선 기준 y-up 이다."""
    pen = TTGlyphPen(None)
    for x0, y0, x1, y1 in rects:
        left, right = x0 * UNITS_PER_PIXEL, x1 * UNITS_PER_PIXEL
        top = (ASCENT_PX - y0) * UNITS_PER_PIXEL
        bottom = (ASCENT_PX - y1) * UNITS_PER_PIXEL
        # 시계 방향(y-up) 바깥 윤곽. 사각형끼리 겹치지 않으므로 방향만 맞으면 된다.
        pen.moveTo((left, top))
        pen.lineTo((right, top))
        pen.lineTo((right, bottom))
        pen.lineTo((left, bottom))
        pen.closePath()
    return pen.glyph()


# ---------------------------------------------------------------- 글리프 모으기

class GlyphSet:
    """(전진폭, 사각형 목록) 이 같으면 글리프 하나를 돌려 쓴다.

    한글 순서를 뒤에 몰아 두면 hmtx 가 꼬리의 같은 전진폭을 한 번만 적어 파일이 작아진다.
    """

    def __init__(self):
        self.order = ['.notdef']
        self.rects = {'.notdef': ()}
        self.advance = {'.notdef': 0}       # 원본은 못 그리는 글자의 폭이 0 이다
        self.cmap: dict[int, str] = {}
        self._seen: dict[tuple, str] = {}

    def add(self, codepoint: int, advance: int, rects: tuple) -> None:
        key = (advance, rects)
        name = self._seen.get(key)
        if name is None:
            name = f'g{len(self.order):04d}'
            self._seen[key] = name
            self.order.append(name)
            self.rects[name] = rects
            self.advance[name] = advance
        self.cmap[codepoint] = name

    def alias(self, codepoint: int, source: int) -> None:
        self.cmap[codepoint] = self.cmap[source]


def collect(atlas: Atlas, meta: dict) -> GlyphSet:
    ascii_advance = atlas.ascii['glyphWidth'] * UNITS_PER_PIXEL       # 500
    hangul_advance = atlas.hangul['glyphWidth'] * UNITS_PER_PIXEL     # 900
    glyphs = GlyphSet()

    # 1) 영문 폭(5px)을 쓰는 글자들을 앞에 둔다.
    #    공백은 그림 없이 5px 전진 — 원본 0x9c068 이 공백·제어를 그렇게 다룬다.
    glyphs.add(0x20, ascii_advance, ())
    # U+00A0 는 원본에 없는 글자다. 웹 문자열에 섞여 들면 대체 글꼴이 제 폭으로 그려
    # 줄이 어긋나므로 보통 공백과 같게 넣는다 — **이 한 자는 근사다.**
    glyphs.add(0x00A0, ascii_advance, ())
    for code in range(atlas.ascii['first'], atlas.ascii['first'] + atlas.ascii['count']):
        glyphs.add(code, ascii_advance, rectangles(atlas.ascii_cell(code)))
    for source, target in ASCII_SUBSTITUTES.items():
        glyphs.alias(source, target)

    # 2) 한글 폭(9px). 호환 자모 51자 → 완성형 2350자 순서.
    for index, slot in enumerate(ef.jamo_slots()):
        pixels = atlas.compose(slot[0], slot[1], slot[2])
        glyphs.add(0x3131 + index, hangul_advance, rectangles(pixels))
    drawable = set(meta['ks2350'])
    quirks = meta['quirks']
    for character in meta['ks2350']:
        indices = syllable_indices(character, drawable, quirks)
        assert indices is not None
        pixels = atlas.compose(*indices)
        glyphs.add(ord(character), hangul_advance, rectangles(pixels))
    return glyphs


# ---------------------------------------------------------------- 원본 .ft2 와 대조

def verify_against_ft2(atlas: Atlas, meta: dict, jar: Path) -> int:
    """아틀라스에서 합성한 픽셀이 원본 .ft2 에서 합성한 픽셀과 같은지 한 글자씩 본다."""
    font = ef.HangulFont((jar / ef.HANGUL_FT2).read_bytes())
    ascii_font = ef.AsciiFont((jar / ef.ASCII_FT2).read_bytes())
    checked = 0
    for index, slot in enumerate(ef.jamo_slots()):
        if atlas.compose(*slot) != ef.compose_pixels(slot[0], slot[1], slot[2], font):
            raise SystemExit(f'호환 자모 U+{0x3131 + index:04X} 가 원본과 다르다')
        checked += 1
    drawable, quirks = set(meta['ks2350']), meta['quirks']
    for character in meta['ks2350']:
        cho, jung, jong = syllable_indices(character, drawable, quirks)
        if atlas.compose(cho, jung, jong) != ef.compose_pixels(cho, jung, jong, font):
            raise SystemExit(f'{character} 가 원본과 다르다')
        checked += 1
    for code in range(atlas.ascii['first'], atlas.ascii['first'] + atlas.ascii['count']):
        expected = ef.unpack_bits(ascii_font.piece(code), ascii_font.width, ascii_font.height)
        if atlas.ascii_cell(code) != expected:
            raise SystemExit(f'영문 0x{code:02X} 가 원본과 다르다')
        checked += 1
    return checked


# ---------------------------------------------------------------- 폰트 굽기

def build_font(glyphs: GlyphSet) -> FontBuilder:
    builder = FontBuilder(unitsPerEm=UNITS_PER_EM, isTTF=True)
    builder.setupGlyphOrder(glyphs.order)
    builder.setupCharacterMap(glyphs.cmap)
    builder.setupGlyf({name: build_glyph(glyphs.rects[name]) for name in glyphs.order})
    builder.setupHorizontalMetrics({name: (glyphs.advance[name], 0) for name in glyphs.order})
    builder.setupHorizontalHeader(ascent=ASCENT, descent=-DESCENT, lineGap=0)
    builder.setupNameTable({
        'familyName': FAMILY_NAME,
        'styleName': STYLE_NAME,
        'uniqueFontIdentifier': f'{FAMILY_NAME}-{STYLE_NAME} {VERSION}',
        'fullName': f'{FAMILY_NAME} {STYLE_NAME}',
        'psName': f'{FAMILY_NAME}-{STYLE_NAME}',
        'version': f'Version {VERSION}',
        # 원본은 게임빌 2010 프로야구(2009)의 synGak9_11.ft2 / synGulimAsc5_11.ft2 다.
        'description': 'Bitmap font extracted from the 2009 WIPI game (synGak9_11 + synGulimAsc5_11).',
    })
    builder.setupOS2(
        version=4,
        sTypoAscender=ASCENT, sTypoDescender=-DESCENT, sTypoLineGap=0,
        usWinAscent=ASCENT, usWinDescent=DESCENT,
        sCapHeight=ASCENT, sxHeight=7 * UNITS_PER_PIXEL,
        achVendID='NONE', fsType=0,
        panose=dict(bFamilyType=2, bSerifStyle=11, bWeight=5, bProportion=9,
                    bContrast=0, bStrokeVariation=0, bArmStyle=0, bLetterForm=0,
                    bMidline=0, bXHeight=0),
    )
    # 글리프 이름 2400개를 그대로 싣지 않는다 (post 3.0). 웹에서는 쓸 일이 없고 수십 KB 다.
    builder.setupPost(keepGlyphNames=False)

    head = builder.font['head']
    head.created = head.modified = FIXED_TIMESTAMP   # 두 번 돌려도 같은 파일이 나오도록 고정
    head.lowestRecPPEM = 11
    return builder


def save(builder: FontBuilder, woff2: Path, ttf: Path | None) -> None:
    woff2.parent.mkdir(parents=True, exist_ok=True)
    if ttf is not None:
        ttf.parent.mkdir(parents=True, exist_ok=True)
        builder.font.flavor = None
        builder.save(str(ttf))
    builder.font.flavor = 'woff2'
    builder.save(str(woff2))


# ---------------------------------------------------------------- 미리보기 PNG

SAMPLE_SCALE = 3
SAMPLE_GAP = 1          # 앱 전역 글꼴의 자간 (CSS letter-spacing 과 같은 값)
SAMPLE_LINE_GAP = 3     # 앱 전역 글꼴의 줄간


def render_sample(path: Path, lines: list[str], font_path: Path, height_px: int) -> None:
    """구운 폰트를 **다시 읽어서** 문장을 찍는다.

    아틀라스가 아니라 저장된 woff2 의 cmap·hmtx·glyf 를 그대로 쓰므로, 파일까지 제대로
    구워졌는지가 그림으로 드러난다. 배치·여백·색은 tools/extract_font.py 의 --sample 과
    똑같이 맞췄다 — 두 PNG 가 픽셀 단위로 같아야 맞는 것이다.
    """
    font = TTFont(str(font_path))
    cmap = font.getBestCmap()
    glyf, hmtx = font['glyf'], font['hmtx']
    upp = font['head'].unitsPerEm // height_px      # 1px 이 몇 유닛인가 (=100)

    def shape(line: str):
        pieces, x = [], 0
        for character in line:
            name = cmap.get(ord(character))
            if name is None:
                continue                            # 2350자 밖: 안 그리고 전진도 안 한다
            glyph = glyf[name]
            if glyph.numberOfContours > 0:
                coordinates, ends = glyph.getCoordinates(glyf)[0], glyph.endPtsOfContours
                start = 0
                for end in ends:
                    points = coordinates[start:end + 1]
                    start = end + 1
                    xs = [p[0] // upp for p in points]
                    ys = [ASCENT_PX - p[1] // upp for p in points]
                    pieces.append((x + min(xs), min(ys), x + max(xs), max(ys)))
            x += hmtx[name][0] // upp + SAMPLE_GAP
        return pieces, max(x - SAMPLE_GAP, 0)

    laid = [shape(line) for line in lines]
    line_height = height_px + SAMPLE_LINE_GAP
    width = max(w for _, w in laid) + 8
    height = line_height * len(lines) + 6
    canvas = [[0] * width for _ in range(height)]
    for index, (pieces, _) in enumerate(laid):
        top = 3 + index * line_height
        for x0, y0, x1, y1 in pieces:
            for y in range(y0, y1):
                for x in range(x0, x1):
                    canvas[top + y][4 + x] = 1

    rows = ef.blank_rows(width * SAMPLE_SCALE, height * SAMPLE_SCALE)
    for y in range(height * SAMPLE_SCALE):
        row = rows[y]
        for x in range(width * SAMPLE_SCALE):
            on = canvas[y // SAMPLE_SCALE][x // SAMPLE_SCALE]
            row[x * 4:x * 4 + 4] = bytes((30, 30, 30, 255) if on else (250, 246, 232, 255))
    ef.write_png(path, width * SAMPLE_SCALE, height * SAMPLE_SCALE, rows)
    print(f'  미리보기 {path} ({width * SAMPLE_SCALE}x{height * SAMPLE_SCALE})')


# ---------------------------------------------------------------- 본체

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--json', type=Path, default=DEFAULT_JSON)
    parser.add_argument('--font-dir', type=Path, default=DEFAULT_FONT_DIR, help='아틀라스 PNG 가 있는 곳')
    parser.add_argument('--out', type=Path, default=DEFAULT_OUT)
    parser.add_argument('--ttf', type=Path, default=None, help='TTF 도 낼 경로 (검사용)')
    parser.add_argument('--jar', type=Path, default=ef.JAR, help='원본 .ft2 폴더 (--verify-ft2 용)')
    parser.add_argument('--verify-ft2', action='store_true', help='원본 .ft2 와 한 글자씩 대조한다')
    parser.add_argument('--sample', type=Path, default=None, help='구운 폰트로 찍은 미리보기 PNG')
    parser.add_argument('--text', action='append', default=None, help='미리보기에 쓸 줄 (여러 번)')
    arguments = parser.parse_args()

    meta = json.loads(arguments.json.read_text(encoding='utf-8'))
    atlas = Atlas(meta, arguments.font_dir)
    print(f'아틀라스 한글 {atlas.hangul["glyphWidth"]}x{atlas.hangul["glyphHeight"]} / '
          f'영문 {atlas.ascii["glyphWidth"]}x{atlas.ascii["glyphHeight"]} · '
          f'2350자 + 자모 {len(ef.jamo_slots())}자 + 영문 {atlas.ascii["count"]}자')

    if arguments.verify_ft2 or (arguments.jar / ef.HANGUL_FT2).exists():
        checked = verify_against_ft2(atlas, meta, arguments.jar)
        print(f'  원본 .ft2 와 {checked}자 대조 — 모두 같다')
    else:
        print('  원본 .ft2 가 없어 대조는 건너뛴다 (아틀라스 PNG 만으로 굽는다)')

    glyphs = collect(atlas, meta)
    points = sum(len(rects) * 4 for rects in glyphs.rects.values())
    print(f'  글리프 {len(glyphs.order)}개 · cmap {len(glyphs.cmap)}자 · 점 {points}개')

    builder = build_font(glyphs)
    save(builder, arguments.out, arguments.ttf)
    size = arguments.out.stat().st_size
    digest = hashlib.sha256(arguments.out.read_bytes()).hexdigest()
    print(f'  {arguments.out} {size:,}B ({size / 1024:.1f}KB) sha256={digest[:16]}…')
    if arguments.ttf is not None:
        ttf_size = arguments.ttf.stat().st_size
        print(f'  {arguments.ttf} {ttf_size:,}B ({ttf_size / 1024:.1f}KB)')

    if arguments.sample is not None:
        render_sample(arguments.sample, arguments.text or ef.SAMPLE_LINES,
                      arguments.out, atlas.hangul['glyphHeight'])
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
