#!/usr/bin/env python3
"""
게임빌 PZX 스프라이트 / MPL 팔레트 파서.

    python3 tools/parse_sprites.py <압축푼_jar_디렉터리>

알아낸 포맷:

  PZX (프레임 조립 정보)
      'PZX' + 버전(1) | u32 total | u32 19 | u32 16 | u32 플래그 | u16 프레임 수
      u32 오프셋 (프레임수+1)개 | u32 압축 크기 | zlib
      → 풀면 오프셋이 가리키는 프레임 배열이 나온다.
      프레임 = u16 파트 수 | 파트 × 7바이트
      파트  = u16 이미지 번호 | i16 x | i16 y | u8 플래그
      부위를 쌓아 한 프레임을 만드는 방식이라 파트 수가 곧 캐릭터 부위 수다.

  MPL (팔레트)
      u8 ? | u8 팔레트 수 | u32 오프셋 × 팔레트 수 | 팔레트 데이터
      팔레트 = u8 색상 수 | u16 RGB565 × 색상 수

  미해독: PZX 안의 실제 픽셀 데이터 블록 (프레임 블록 뒤에 이어지는 부분).
"""

from __future__ import annotations

import argparse
import zlib
from pathlib import Path

PZX_FRAME_COUNT_OFFSET = 0x14
PZX_OFFSET_TABLE_START = 0x16
PART_SIZE = 7


def parse_pzx(raw: bytes) -> dict:
    if raw[0:3] != b'PZX':
        raise ValueError(f'PZX 매직이 아닙니다: {raw[0:4]!r}')

    frame_count = int.from_bytes(raw[PZX_FRAME_COUNT_OFFSET:PZX_FRAME_COUNT_OFFSET + 2], 'little')
    offsets = [
        int.from_bytes(raw[PZX_OFFSET_TABLE_START + i * 4:PZX_OFFSET_TABLE_START + 4 + i * 4], 'little')
        for i in range(frame_count + 1)
    ]
    cursor = PZX_OFFSET_TABLE_START + (frame_count + 1) * 4
    compressed_size = int.from_bytes(raw[cursor:cursor + 4], 'little')
    stream = raw[cursor + 4:cursor + 4 + compressed_size]
    frame_data = zlib.decompress(stream)

    if len(frame_data) != offsets[-1]:
        raise ValueError(f'프레임 블록 크기 불일치: {len(frame_data)} != {offsets[-1]}')

    frames = []
    for index in range(frame_count):
        block = frame_data[offsets[index]:offsets[index + 1]]
        part_count = int.from_bytes(block[0:2], 'little')
        parts = []
        for part in range(part_count):
            start = 2 + part * PART_SIZE
            chunk = block[start:start + PART_SIZE]
            if len(chunk) < PART_SIZE:
                break
            parts.append({
                'image': int.from_bytes(chunk[0:2], 'little'),
                'x': int.from_bytes(chunk[2:4], 'little', signed=True),
                'y': int.from_bytes(chunk[4:6], 'little', signed=True),
                'flags': chunk[6],
            })
        frames.append(parts)

    return {
        'frameCount': frame_count,
        'frames': frames,
        # 프레임 블록 뒤에 남은 바이트 = 아직 해독하지 못한 픽셀 데이터
        'undecodedBytes': len(raw) - (cursor + 4 + compressed_size),
    }


def parse_mpl(raw: bytes) -> list[list[str]]:
    palette_count = raw[1]
    offsets = [int.from_bytes(raw[2 + i * 4:6 + i * 4], 'little') for i in range(palette_count)]

    palettes = []
    for index, start in enumerate(offsets):
        end = offsets[index + 1] if index + 1 < palette_count else len(raw)
        block = raw[start:end]
        color_count = block[0]
        colors = []
        for c in range(color_count):
            value = int.from_bytes(block[1 + c * 2:3 + c * 2], 'little')
            colors.append(rgb565_to_hex(value))
        palettes.append(colors)
    return palettes


def rgb565_to_hex(value: int) -> str:
    red = (value >> 11) & 0x1F
    green = (value >> 5) & 0x3F
    blue = value & 0x1F
    # 5·6비트를 8비트로 늘릴 때 상위 비트를 되풀이해 채워야 흰색이 흰색으로 남는다
    return '#{:02X}{:02X}{:02X}'.format(
        (red << 3) | (red >> 2), (green << 2) | (green >> 4), (blue << 3) | (blue >> 2)
    )


def main() -> int:
    parser = argparse.ArgumentParser(description='PZX 스프라이트와 MPL 팔레트를 읽는다')
    parser.add_argument('root', type=Path, help='압축을 푼 jar 디렉터리')
    arguments = parser.parse_args()

    print('=== PZX 프레임 ===')
    ok = failed = 0
    for path in sorted(arguments.root.rglob('*.pzx')):
        try:
            result = parse_pzx(path.read_bytes())
        except (ValueError, zlib.error, IndexError) as error:
            failed += 1
            print(f'  {path.name:<30} 실패: {error}')
            continue
        ok += 1
        part_counts = [len(parts) for parts in result['frames']]
        print(f'  {path.relative_to(arguments.root)!s:<36} 프레임 {result["frameCount"]:>3}개, '
              f'파트 {min(part_counts, default=0)}~{max(part_counts, default=0)}개, '
              f'미해독 {result["undecodedBytes"]:,}바이트')
    print(f'  → 성공 {ok}개 / 실패 {failed}개')

    print('\n=== MPL 팔레트 ===')
    for path in sorted(arguments.root.rglob('*.mpl')):
        palettes = parse_mpl(path.read_bytes())
        sizes = {len(p) for p in palettes}
        print(f'  {path.relative_to(arguments.root)!s:<36} 팔레트 {len(palettes)}개, '
              f'색상 수 {sorted(sizes)}  예: {palettes[0][:5]}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
