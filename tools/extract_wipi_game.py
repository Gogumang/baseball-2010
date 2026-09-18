#!/usr/bin/env python3
"""
게임빌 WIPI 패키지(.jar)에서 텍스트·데이터 테이블을 통째로 뽑아 JSON으로 낸다.

    python3 tools/extract_wipi_game.py <패키지.jar> -o <출력디렉터리>

분석해서 알아낸 포맷:

  .zt1 컨테이너
      u32 파일 전체 크기 | u32 해제 후 크기 | zlib 스트림

  GST 문자열 테이블 (Str*)
      'GST' + 버전(1) | u16 항목 수 N | u16 오프셋 (N+1)개 (파일 절대) | 데이터

  GXL 레코드 테이블 (Xls*, 엑셀에서 export한 밸런싱 표)
      'GXL' + 버전(1) | u16 행 크기 | u16 열 수 | u16 행 수 | u8[열수] 열 타입 | 행 데이터
      주의: 행 수와 행 크기를 뒤집어 읽어도 작은 표에서는 검산이 우연히 맞는다.
            반드시 10 + 열수 + 행수*행크기 == 파일크기 로 확인할 것.

  이벤트 텍스트 (r_event_txt, s_event_txt)
      u32 항목 수 N | u32 데이터 크기 | u32 오프셋 N개 (데이터 기준 상대) | 데이터

  문자열은 CP949이며 게임 자체 마크업을 쓴다:
      !N 줄바꿈 · !C 가운데 정렬 · !cRRGGBB 색상 · %s 선수/팀 이름 치환
"""

from __future__ import annotations

import argparse
import json
import zipfile
import zlib
from pathlib import Path

ZT1_HEADER_SIZE = 8
EVENT_TEXT_STEMS = {'r_event_txt', 's_event_txt'}

# 여러 표가 [u8 아이디][CP949 이름 9바이트] 로 시작한다.
NAME_FIELD_START = 1
NAME_FIELD_END = 10


def decompress_zt1(raw: bytes) -> bytes:
    declared_plain_size = int.from_bytes(raw[4:8], 'little')
    plain = zlib.decompress(raw[ZT1_HEADER_SIZE:])
    if len(plain) != declared_plain_size:
        raise ValueError(f'해제 크기 불일치: {len(plain)} != {declared_plain_size}')
    return plain


def decode_entry(blob: bytes) -> str:
    """피처폰 한국 게임이라 CP949가 기본. UTF-16을 먼저 대면 깨진 채로 통과한다."""
    blob = blob.rstrip(b'\x00')
    if not blob:
        return ''
    return blob.decode('cp949', errors='replace')


def parse_string_table(raw: bytes) -> list[str]:
    count = int.from_bytes(raw[4:6], 'little')
    offsets = [int.from_bytes(raw[6 + i * 2:8 + i * 2], 'little') for i in range(count + 1)]
    return [decode_entry(raw[offsets[i]:offsets[i + 1]]) for i in range(count)]


def parse_record_table(raw: bytes) -> dict:
    row_size = int.from_bytes(raw[4:6], 'little')
    column_count = int.from_bytes(raw[6:8], 'little')
    row_count = int.from_bytes(raw[8:10], 'little')
    data_start = 10 + column_count

    if data_start + row_count * row_size != len(raw):
        raise ValueError(f'행 레이아웃 검산 실패: {data_start}+{row_count}*{row_size} != {len(raw)}')

    rows = [raw[data_start + i * row_size:data_start + (i + 1) * row_size] for i in range(row_count)]
    return {
        'rowSize': row_size,
        'columnCount': column_count,
        'rowCount': row_count,
        'columnTypes': list(raw[10:data_start]),
        'names': [decode_entry(row[NAME_FIELD_START:NAME_FIELD_END]) for row in rows],
        'rows': [row.hex() for row in rows],
    }


def parse_event_text(raw: bytes) -> list[str]:
    count = int.from_bytes(raw[0:4], 'little')
    data_size = int.from_bytes(raw[4:8], 'little')
    table_end = ZT1_HEADER_SIZE + count * 4
    offsets = [int.from_bytes(raw[ZT1_HEADER_SIZE + i * 4:ZT1_HEADER_SIZE + 4 + i * 4], 'little')
               for i in range(count)]
    data = raw[table_end:table_end + data_size]

    texts = []
    for index, start in enumerate(offsets):
        end = offsets[index + 1] if index + 1 < count else data_size
        texts.append(decode_entry(data[start:end]))
    return texts


def main() -> int:
    parser = argparse.ArgumentParser(description='게임빌 WIPI 패키지에서 테이블을 추출한다')
    parser.add_argument('package', type=Path)
    parser.add_argument('-o', '--output', type=Path, default=Path('extracted'))
    arguments = parser.parse_args()

    arguments.output.mkdir(parents=True, exist_ok=True)
    tables: dict[str, object] = {}
    failures: list[str] = []

    with zipfile.ZipFile(arguments.package) as archive:
        for name in sorted(archive.namelist()):
            if not name.endswith('.zt1'):
                continue
            stem = Path(name).stem
            try:
                plain = decompress_zt1(archive.read(name))
                if stem in EVENT_TEXT_STEMS:
                    tables[stem] = parse_event_text(plain)
                elif plain[0:3] == b'GST':
                    tables[stem] = parse_string_table(plain)
                elif plain[0:3] == b'GXL':
                    tables[stem] = parse_record_table(plain)
                else:
                    failures.append(f'{stem}: 알 수 없는 포맷 (앞 4바이트 {plain[:4]!r})')
            except (zlib.error, ValueError, IndexError) as error:
                failures.append(f'{stem}: {error}')

    for stem, entries in tables.items():
        (arguments.output / f'{stem}.json').write_text(
            json.dumps(entries, ensure_ascii=False, indent=1), encoding='utf-8')

    print(f'테이블 {len(tables)}개 → {arguments.output}/')
    for stem, entries in sorted(tables.items()):
        if isinstance(entries, dict):
            names = [n for n in entries['names'] if n]
            sample = f'  예: {", ".join(names[:4])}' if names else ''
            print(f'  {stem:<26} 레코드 {entries["rowCount"]:>4}행 × {entries["rowSize"]:>3}바이트'
                  f' / {entries["columnCount"]}열{sample}')
        else:
            korean = sum(1 for t in entries if any('가' <= c <= '힣' for c in t))
            print(f'  {stem:<26} 문자열 {len(entries):>5}개 (한글 {korean}개)')

    if failures:
        print('\n풀지 못한 것:')
        for failure in failures:
            print(f'  {failure}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
