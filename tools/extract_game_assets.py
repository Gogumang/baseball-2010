#!/usr/bin/env python3
"""
게임 패키지에서 텍스트와 에셋을 뽑아내는 분석 도구.

사용자가 직접 가진 게임 파일(.apk / .jar / .zip / 원시 바이너리)을 읽어
한국어 문자열과 이미지·사운드 파일 목록을 추려낸다.

    python3 tools/extract_game_assets.py <파일경로> [-o 출력디렉터리]

피처폰 시절 한국 게임은 문자열이 CP949(EUC-KR)로 들어 있는 경우가 많고,
스마트폰 이식판은 UTF-8 또는 UTF-16LE를 쓴다. 셋 다 훑어서 한글이 실제로
나오는 것만 남긴다.
"""

from __future__ import annotations

import argparse
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path

# 한글 음절 + 자모. 이 범위가 없으면 우연히 디코딩된 쓰레기 문자열로 본다.
HANGUL_PATTERN = re.compile(r'[가-힣ㄱ-ㆎ]')

# 너무 짧은 조각은 대사가 아니다.
MINIMUM_TEXT_LENGTH = 2

# 한글 비율이 이보다 낮으면 우연한 디코딩 결과로 본다.
MINIMUM_HANGUL_RATIO = 0.3

ASSET_SUFFIXES = {
    '이미지': {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'},
    '사운드': {'.mp3', '.ogg', '.wav', '.mid', '.mmf', '.qcp'},
    '폰트': {'.ttf', '.otf', '.bdf'},
    '코드': {'.dex', '.so', '.class', '.jar'},
    '데이터': {'.json', '.xml', '.txt', '.csv', '.dat', '.bin'},
}

ENCODINGS = ('cp949', 'utf-8', 'utf-16-le')

# 한국어에서 압도적으로 자주 쓰이는 음절. 엉뚱한 인코딩으로 읽으면 한글 코드포인트는
# 나와도 이 글자들이 거의 안 나온다 — 진짜 한국어와 디코딩 쓰레기를 가르는 기준이다.
COMMON_SYLLABLES = set(
    '이가은는을를의에서로도다하고지나요시니습으부터만한할했그저우리내너'
    '있없된되면서와과나저것수때말일사람선수경기훈련타자투수'
)

# 진짜 한국어로 인정하기 위한 최소 상용 음절 비율
MINIMUM_COMMON_RATIO = 0.25


def _extract_with(blob: bytes, encoding: str) -> list[str]:
    try:
        decoded = blob.decode(encoding, errors='ignore')
    except (LookupError, UnicodeDecodeError):
        return []

    found: list[str] = []
    # 제어문자로 끊어서 조각을 만든다
    for piece in re.split(r'[\x00-\x08\x0b-\x1f\x7f]+', decoded):
        piece = piece.strip()
        if len(piece) < MINIMUM_TEXT_LENGTH:
            continue
        hangul = HANGUL_PATTERN.findall(piece)
        if not hangul:
            continue
        if len(hangul) / len(piece) < MINIMUM_HANGUL_RATIO:
            continue
        if _common_ratio(hangul) < MINIMUM_COMMON_RATIO:
            continue
        found.append(piece)

    return found


def _common_ratio(hangul_characters: list[str]) -> float:
    if not hangul_characters:
        return 0.0
    hits = sum(1 for character in hangul_characters if character in COMMON_SYLLABLES)
    return hits / len(hangul_characters)


def extract_strings(blob: bytes) -> list[str]:
    """
    바이트 덩어리에서 한글 문자열을 뽑는다.

    세 인코딩을 모두 시도하되 결과를 합치지 않는다 — CP949로 쓰인 한국어를
    UTF-16LE로 읽으면 한글 코드포인트가 우연히 나와서, 합치면 같은 대사의
    깨진 사본이 함께 남는다. 가장 한국어다운 하나만 고른다.
    """
    best_result: list[str] = []
    best_score = 0.0

    for encoding in ENCODINGS:
        candidates = _extract_with(blob, encoding)
        if not candidates:
            continue

        hangul = [character for text in candidates for character in HANGUL_PATTERN.findall(text)]
        # 상용 음절 비율 × 분량. 비율만 보면 짧은 우연이 이긴다.
        score = _common_ratio(hangul) * len(hangul)
        if score > best_score:
            best_score = score
            best_result = candidates

    return best_result


def analyze_zip(path: Path, output_dir: Path) -> None:
    """APK/JAR/ZIP을 열어 내용물 목록과 문자열을 뽑는다."""
    suffix_counter: Counter[str] = Counter()
    all_strings: list[tuple[str, str]] = []

    with zipfile.ZipFile(path) as archive:
        members = [info for info in archive.infolist() if not info.is_dir()]
        print(f'파일 {len(members)}개')

        for info in members:
            suffix = Path(info.filename).suffix.lower()
            suffix_counter[suffix or '(확장자없음)'] += 1

            # 코드·데이터·확장자 없는 덩어리에서 문자열을 찾는다
            if suffix in ASSET_SUFFIXES['이미지'] | ASSET_SUFFIXES['사운드']:
                continue
            try:
                blob = archive.read(info)
            except (RuntimeError, zipfile.BadZipFile) as error:
                print(f'  ! 읽기 실패 {info.filename}: {error}', file=sys.stderr)
                continue

            for text in extract_strings(blob):
                all_strings.append((info.filename, text))

        print('\n확장자별 분포:')
        for suffix, count in suffix_counter.most_common(20):
            category = next(
                (name for name, group in ASSET_SUFFIXES.items() if suffix in group),
                '기타',
            )
            print(f'  {suffix:<16} {count:>5}개  ({category})')

        _write_asset_list(members, output_dir)

    _write_strings(all_strings, output_dir)


def analyze_raw(path: Path, output_dir: Path) -> None:
    """압축이 아닌 원시 바이너리(WIPI 리소스 덩어리 등)를 훑는다."""
    blob = path.read_bytes()
    print(f'원시 바이너리 {len(blob):,} 바이트')
    _write_strings([(path.name, text) for text in extract_strings(blob)], output_dir)


def _write_asset_list(members, output_dir: Path) -> None:
    lines = [f'{info.file_size:>10,}  {info.filename}' for info in sorted(members, key=lambda i: -i.file_size)]
    target = output_dir / 'files.txt'
    target.write_text('\n'.join(lines), encoding='utf-8')
    print(f'\n파일 목록 → {target}')


def _write_strings(entries: list[tuple[str, str]], output_dir: Path) -> None:
    # 같은 문자열이 인코딩 3종에서 중복으로 잡히므로 걷어낸다
    seen: set[tuple[str, str]] = set()
    unique: list[tuple[str, str]] = []
    for source, text in entries:
        key = (source, text)
        if key in seen:
            continue
        seen.add(key)
        unique.append((source, text))

    target = output_dir / 'korean-strings.txt'
    with target.open('w', encoding='utf-8') as handle:
        current_source = None
        for source, text in unique:
            if source != current_source:
                handle.write(f'\n===== {source} =====\n')
                current_source = source
            handle.write(text + '\n')

    print(f'한국어 문자열 {len(unique):,}개 → {target}')
    if unique:
        print('\n미리보기:')
        for _source, text in unique[:15]:
            print(f'  {text[:70]}')


def main() -> int:
    parser = argparse.ArgumentParser(description='게임 패키지에서 한국어 텍스트와 에셋 목록을 추출한다')
    parser.add_argument('path', type=Path, help='분석할 .apk / .jar / .zip / 바이너리 파일')
    parser.add_argument('-o', '--output', type=Path, default=Path('extracted'), help='출력 디렉터리')
    args = parser.parse_args()

    if not args.path.is_file():
        print(f'파일을 찾을 수 없습니다: {args.path}', file=sys.stderr)
        return 1

    args.output.mkdir(parents=True, exist_ok=True)
    print(f'분석 대상: {args.path}  ({args.path.stat().st_size:,} 바이트)\n')

    if zipfile.is_zipfile(args.path):
        analyze_zip(args.path, args.output)
    else:
        analyze_raw(args.path, args.output)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
