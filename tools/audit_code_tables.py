#!/usr/bin/env python3
"""
손으로 옮겨 적은 숫자 표가 binary.mod 의 그 주소와 같은지 훑는다 (읽기만 한다).

    python3 -I tools/audit_code_tables.py [--binary <binary.mod>] [--all]

src/**/*.ts(x) (시험 파일 빼고) 에서 정수 세 개 이상으로 된 배열 리터럴을 찾고, 그 배열 앞 주석
(또는 같은 줄)에 적힌 **데이터 구역 주소**(.text 뒤쪽 표 0xcb000~0xdaac8 · .data 0x1400000~)를
모아, 그 주소에서 u8 · s8 · u16 · s16 · u32 · s32 로 같은 개수를 읽어 견준다.

  MATCH    적힌 주소 중 하나에서 어떤 폭으로든 값 · 개수 · 차례가 같다
  MOVED    적힌 주소에서는 다르지만 같은 열이 데이터 구역 다른 곳에 있다 (주소를 잘못 적었을 수 있다)
  MATCH=   줄이 여럿인 표 — 줄마다 적힌 주소 뒤 1KB 안에서 같은 폭으로 찾았다 (줄 길이가 다른 표 · 앞 칸만 쓰는 표)
  MATCH~   부호 뒤집기 · 절댓값 · ×10ⁿ 를 거치면 같다 (주석에 그 가공이 적혀 있어야 한다)
  DIFF     어디에서도 같은 열이 없다 — 사람이 봐야 한다 (뜻을 바꾼 값 · 일부만 옮긴 값 · 표가 아닌 것)

배열이 표의 앞부분만 옮긴 것이면 MATCH 로 나온다(앞에서부터 같은 개수만 읽는다).
웹 표가 원본을 가공한 것(÷10 · 순서 바꿈 · 합치기)이면 DIFF 로 나오며, 그건 근거를 확인해 남긴다.
결과는 docs/re 의 대조 기록(r337)에 옮겨 적었다. 같은 훑기를 src/shared/config/original/originalSource.test.ts 가
시험으로 돈다(가공한 표는 그 시험의 DERIVED 목록에 이유와 함께 둔다).
"""

from __future__ import annotations

import argparse
import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_BINARY_CANDIDATES = (
    ROOT / 'base/work/jar/binary.mod',
    ROOT.parent / 'baseball-2010/base/work/jar/binary.mod',
    ROOT.parent.parent / 'baseball-2010/base/work/jar/binary.mod',
)

TEXT_VA, TEXT_OFF, TEXT_SIZE = 0x1000, 0x34, 0xD9AC8
DATA_VA, DATA_OFF, DATA_SIZE = 0x1400000, 0x101D4C, 0x998
# 표가 모여 있는 곳 — 코드 구역(렌더러 0xb9000~0xcb000 까지)을 뺀 .text 뒤쪽
TABLE_VA_FROM = 0xCB000

FORMATS = (('u8', 'B', 1), ('s8', 'b', 1), ('u16', 'H', 2), ('s16', 'h', 2), ('u32', 'I', 4), ('s32', 'i', 4))

TRANSFORMS = (
    ('부호 뒤집음', lambda v: -v),
    ('절댓값', abs),
    *((f'×{k}', (lambda k: lambda v: v * k)(k)) for k in (10, 100, 1000)),
    *((f'−×{k}', (lambda k: lambda v: -v * k)(k)) for k in (10, 100, 1000)),
)

ADDRESS = re.compile(r'0x([0-9a-fA-F]{5,7})\b')
ARRAY_START = re.compile(r'(?:^|[\s;])(?:export\s+)?(?:const|let)[ \t]+([A-Za-z_$][\w$]*)[^=\n]*=\s*(?:Object\.freeze\()?\[', re.M)
NUMBER = re.compile(r'-?(?:0x[0-9a-fA-F]+|\d+)(?![\w.])')


def file_offset(va: int) -> int | None:
    if TEXT_VA <= va < TEXT_VA + TEXT_SIZE:
        return va - TEXT_VA + TEXT_OFF
    if DATA_VA <= va < DATA_VA + DATA_SIZE:
        return va - DATA_VA + DATA_OFF
    return None


def is_table_address(va: int) -> bool:
    return TABLE_VA_FROM <= va < TEXT_VA + TEXT_SIZE or DATA_VA <= va < DATA_VA + DATA_SIZE


def read_values(raw: bytes, va: int, fmt: str, size: int, count: int) -> list[int] | None:
    offset = file_offset(va)
    if offset is None or offset + size * count > len(raw):
        return None
    return list(struct.unpack_from(f'<{count}{fmt}', raw, offset))


def array_body(text: str, start: int) -> str | None:
    """`[` 다음부터 짝이 맞는 `]` 까지. 숫자 · 쉼표 · 괄호 · 공백 · 주석만 있어야 한다."""
    depth = 0
    for index in range(start, len(text)):
        char = text[index]
        if char == '[':
            depth += 1
        elif char == ']':
            depth -= 1
            if depth == 0:
                return text[start:index + 1]
        if index - start > 20000:
            return None
    return None


def numbers_of(body: str) -> list[int] | None:
    stripped = re.sub(r'//[^\n]*', '', body)
    stripped = re.sub(r'/\*.*?\*/', '', stripped, flags=re.S)
    if re.search(r'[A-Za-z_$\'"`{]', re.sub(NUMBER, '', stripped)):
        return None   # 숫자만으로 된 표가 아니다 (객체 · 이름 · 식)
    values = [int(token, 0) for token in NUMBER.findall(stripped)]
    return values if len(values) >= 3 else None


def candidate_arrays(path: Path):
    text = path.read_text(encoding='utf-8')
    for match in ARRAY_START.finditer(text):
        body = array_body(text, match.end() - 1)
        if body is None:
            continue
        values = numbers_of(body)
        if values is None:
            continue
        line_start = text.rfind('\n', 0, match.start()) + 1
        # 앞 주석: 바로 위 12줄 + 선언 줄
        head = text[:line_start].split('\n')[-13:]
        context = '\n'.join(head) + text[line_start:match.end()]
        addresses = sorted({int(a, 16) for a in ADDRESS.findall(context) if is_table_address(int(a, 16))})
        line = text.count('\n', 0, match.start()) + 1
        yield match.group(1), line, values, addresses, rows_of(body)


def rows_of(body: str) -> list[list[int]] | None:
    """[[..], [..]] 처럼 한 겹 안쪽 줄이 있으면 줄마다 숫자 목록. 아니면 None."""
    inner = re.findall(r'\[([^\[\]]*)\]', re.sub(r'//[^\n]*', '', body)[1:-1])
    rows = [[int(token, 0) for token in NUMBER.findall(row)] for row in inner]
    return rows if len(rows) >= 2 and all(rows) else None


def rows_within(raw: bytes, rows: list[list[int]], addresses: list[int], span: int = 0x400) -> str | None:
    """줄마다 적힌 주소 뒤 span 바이트 안에서 같은 폭으로 이어진 열을 찾는다 (줄 길이가 다른 표 · 줄 차례만 옮긴 표)."""
    for label, fmt, size in FORMATS:
        for base in addresses:
            start = file_offset(base)
            if start is None:
                continue
            window = raw[start:start + span]
            places = []
            for row in rows:
                try:
                    needle = struct.pack(f'<{len(row)}{fmt}', *row)
                except struct.error:
                    break
                position = window.find(needle)
                while position >= 0 and position % size:
                    position = window.find(needle, position + 1)
                if position < 0:
                    break
                places.append(base + position)
            else:
                return f'{base:#x}/{label} 줄마다 ' + ' · '.join(f'{va:#x}' for va in places[:6]) + (' …' if len(places) > 6 else '')
    return None


def search_everywhere(raw: bytes, values: list[int]) -> list[tuple[int, str]]:
    found = []
    for name, fmt, size in FORMATS:
        try:
            needle = struct.pack(f'<{len(values)}{fmt}', *values)
        except struct.error:
            continue
        for region_va, region_off, region_size in ((TABLE_VA_FROM, TABLE_VA_FROM - TEXT_VA + TEXT_OFF,
                                                    TEXT_VA + TEXT_SIZE - TABLE_VA_FROM),
                                                   (DATA_VA, DATA_OFF, DATA_SIZE)):
            haystack = raw[region_off:region_off + region_size]
            position = haystack.find(needle)
            while position >= 0 and len(found) < 4:
                found.append((region_va + position, name))
                position = haystack.find(needle, position + 1)
    return found


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--binary', type=Path)
    parser.add_argument('--all', action='store_true', help='주소가 안 적힌 배열도 데이터 구역에서 찾아 본다')
    arguments = parser.parse_args()
    binary = arguments.binary or next((p for p in DEFAULT_BINARY_CANDIDATES if p.exists()), None)
    if binary is None:
        print('binary.mod 를 찾지 못했다 (--binary 로 줄 것)')
        return 1
    raw = binary.read_bytes()

    counts = {'MATCH=': 0, 'MATCH~': 0, 'MATCH': 0, 'MOVED': 0, 'DIFF': 0, 'FOUND': 0}
    for path in sorted((ROOT / 'src').rglob('*.ts*')):
        if '.test.' in path.name or path.suffix not in ('.ts', '.tsx'):
            continue
        if 'shared/config/original' in str(path) and path.name not in ('balance.ts', 'mainMenu.ts', 'trainingAnimation.ts', 'sounds.ts'):
            continue   # 생성기가 만든 표는 originalSource.test.ts 가 따로 본다
        for name, line, values, addresses, rows in candidate_arrays(path):
            where = f'{path.relative_to(ROOT)}:{line} {name} ({len(values)}개)'
            if not addresses:
                if arguments.all and len(values) >= 4 and len(set(values)) > 1:
                    hits = search_everywhere(raw, values)
                    if hits:
                        counts['FOUND'] += 1
                        print(f'FOUND  {where} — 주소 안 적힘, 데이터 구역 ' + ', '.join(f'{va:#x}/{f}' for va, f in hits))
                continue
            matched = [
                (va, label) for va in addresses for label, fmt, size in FORMATS
                if read_values(raw, va, fmt, size, len(values)) == values
            ]
            if not matched and rows is not None:
                found_rows = rows_within(raw, rows, addresses)
                if found_rows is not None:
                    counts['MATCH='] += 1
                    print(f'MATCH= {where} — {found_rows}')
                    continue
            if not matched:
                # 옮기며 가공한 표 — 부호 뒤집기 · 절댓값 · ×10ⁿ 배율 (주석이 그렇다고 적은 것만 사람이 받아들인다)
                for transform_name, transform in TRANSFORMS:
                    for va in addresses:
                        for label, fmt, size in FORMATS:
                            read = read_values(raw, va, fmt, size, len(values))
                            if read is not None and [transform(v) for v in read] == values:
                                matched.append((va, f'{label} {transform_name}'))
                if matched:
                    counts['MATCH~'] += 1
                    print(f'MATCH~ {where} — ' + ', '.join(f'{va:#x}/{label}' for va, label in matched[:3]))
                    continue
            if matched:
                counts['MATCH'] += 1
                print(f'MATCH  {where} — ' + ', '.join(f'{va:#x}/{label}' for va, label in matched[:3]))
                continue
            hits = search_everywhere(raw, values)
            if hits:
                counts['MOVED'] += 1
                print(f'MOVED  {where} — 적힌 {[hex(a) for a in addresses]} · 실제 '
                      + ', '.join(f'{va:#x}/{f}' for va, f in hits))
            else:
                counts['DIFF'] += 1
                preview = values[:12]
                print(f'DIFF   {where} — 적힌 {[hex(a) for a in addresses]} 값 {preview}{" …" if len(values) > 12 else ""}')
    print(counts)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
