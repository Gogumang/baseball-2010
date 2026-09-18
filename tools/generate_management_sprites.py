"""
관리 화면에 필요한 팔레트 변형 그림을 만든다 (binary.mod 0x7d34c · 0x7e418, layout-re 명세).

  선택된 커맨드 아이콘   mode_icon.pzx 0~20 을 mode_icon.mpl 팔레트 0(주황)으로
  노란 글자              img_text 334 "년" · 335 "경기" 를 img_text.mpl 팔레트 1 색으로 (흰 ↔ 노랑 두 색 대응)
  커맨드 이름표          img_text 89~94 (메인)·하위 메뉴 이름표를 흰 본문 + 8방향 1px #2033AA 테두리로 (효과 0x0b)

사용: python3 tools/generate_management_sprites.py
"""
import struct
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from decode_pzx import decode_image, is_transparent, read_image_section, rgb565  # noqa: E402

UI = Path('base/work/jar/ui')
PUBLIC = Path('public/sprites')
OUTPUT = PUBLIC / 'management'

# 메인 0~5 · 선수정보 6~9·15 · 훈련 11~15 · 아이템 7·8·20 (표 0x7e84c)
COMMAND_ICON_COUNT = 21
COMMAND_LABEL_FRAMES = [89, 90, 91, 92, 93, 94, 96, 228, 101, 115, 297, 98, 103, 108, 113, 100, 105, 110]
YELLOW_LABEL_FRAMES = [334, 335]
# 남색 머리글 — img_text.mpl 팔레트 3 (layout-re 3·4차)
#   372 상세정보 창 제목 / 136 순위 · 235 팀명 · 215 승 · 216 패 · 234 승률 (순위표 0x7f070 머리칸)
#   115 필살타법 창 제목 (0x803d4)
NAVY_LABEL_FRAMES = [372, 136, 235, 215, 216, 234, 115]
LABEL_OUTLINE = (0x20, 0x33, 0xAA, 255)
OUTLINE_OFFSETS = [(-1, 0), (0, -1), (1, 0), (0, 1), (-1, -1), (1, -1), (1, 1), (-1, 1)]


def read_palettes(name: str) -> list[list[tuple[int, int, int]]]:
    """mpl: u8 머리 | u8 팔레트 수 | u32 오프셋 × 수 | 각 팔레트 = u8 색 수(0=256) + RGB565"""
    raw = (UI / name).read_bytes()
    count = raw[1]
    offsets = struct.unpack_from(f'<{count}I', raw, 2)
    palettes = []
    for offset in offsets:
        color_count = raw[offset] or 256
        palettes.append([rgb565(struct.unpack_from('<H', raw, offset + 1 + 2 * i)[0]) for i in range(color_count)])
    return palettes


def pzx_image(name: str, index: int, palette) -> Image.Image:
    raw = (UI / name).read_bytes()
    image_at = struct.unpack_from('<I', raw, 4)[0]
    own_palette, block = read_image_section(raw, image_at)
    count = struct.unpack_from('<I', block, 0)[0] // 4
    offsets = [struct.unpack_from('<I', block, i * 4)[0] for i in range(count)]
    end = offsets[index + 1] if index + 1 < count else len(block)
    width, height, pixels, decoded_palette = decode_image(block[offsets[index]:end], own_palette)
    image = Image.new('RGBA', (width, height))
    for y in range(height):
        for x in range(width):
            value = pixels[y][x]
            if is_transparent(value, decoded_palette) or value >= len(palette):
                continue
            image.putpixel((x, y), tuple(palette[value]) + (255,))
    return image


def write_selected_icons() -> None:
    orange = read_palettes('mode_icon.mpl')[0]
    for index in range(COMMAND_ICON_COUNT):
        pzx_image('mode_icon.pzx', index, orange).save(OUTPUT / f'icon_selected_{index}.png')


def write_recolored_labels(palette_index: int, frames: list[int], prefix: str) -> None:
    palettes = read_palettes('img_text.mpl')
    white, target = palettes[0], palettes[palette_index]
    mapping = {tuple(white[i]): tuple(target[i]) for i in range(min(len(white), len(target)))}
    for frame in frames:
        source = Image.open(PUBLIC / 'img_text/frames' / f'{frame:03d}.png').convert('RGBA')
        pixels = [(*mapping.get(pixel[:3], pixel[:3]), pixel[3]) if pixel[3] else pixel for pixel in source.getdata()]
        source.putdata(pixels)
        source.save(OUTPUT / f'{prefix}_{frame}.png')


def write_yellow_labels() -> None:
    write_recolored_labels(1, YELLOW_LABEL_FRAMES, 'label_yellow')
    write_recolored_labels(3, NAVY_LABEL_FRAMES, 'label_navy')


def write_command_labels() -> None:
    for frame in COMMAND_LABEL_FRAMES:
        body = Image.open(PUBLIC / 'img_text/frames' / f'{frame:03d}.png').convert('RGBA')
        outline = Image.new('RGBA', body.size)
        outline.putdata([LABEL_OUTLINE if pixel[3] else (0, 0, 0, 0) for pixel in body.getdata()])
        white = Image.new('RGBA', body.size)
        white.putdata([(255, 255, 255, 255) if pixel[3] else (0, 0, 0, 0) for pixel in body.getdata()])
        canvas = Image.new('RGBA', (body.width + 2, body.height + 2))
        for dx, dy in OUTLINE_OFFSETS:
            canvas.alpha_composite(outline, (1 + dx, 1 + dy))
        canvas.alpha_composite(white, (1, 1))
        canvas.save(OUTPUT / f'command_label_{frame}.png')


def main() -> int:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    write_selected_icons()
    write_yellow_labels()
    write_command_labels()
    print(f'관리 화면 그림을 {OUTPUT} 에 만들었다')
    return 0


if __name__ == '__main__':
    sys.exit(main())
