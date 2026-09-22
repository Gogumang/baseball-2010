#!/usr/bin/env python3
"""
게임이 실제로 쓰는 스프라이트만 public/sprites 에 남긴다.

    python3 tools/prune_sprites.py [--dry-run]

원본 전체(7,000장 넘음)를 그대로 배포하면 50MB가 넘고 파일 수만큼 요청이 생긴다.
전체는 base/sprites 에 그대로 두고, 배포본에는 쓰는 것만 복사한다.

소스에서 `/sprites/...` 문자열을 찾아 정적 참조를 모으고,
코드가 번호를 만들어 붙이는 폴더(`num/${n}.png` 같은)는 아래 목록으로 통째로 가져온다.
"""

from __future__ import annotations

import argparse
import re
import shutil
from pathlib import Path

SOURCE_ROOT = Path('base/sprites')
TARGET_ROOT = Path('public/sprites')
CODE_ROOT = Path('src')

STATIC_REFERENCE = re.compile(r'/sprites/([A-Za-z0-9_./-]+\.png)')
# 코드가 경로를 만들어 쓰는 폴더. 폴더 전체를 가져온다.
DYNAMIC_FOLDERS = (
    'num',              # 점수·숫자
    'ball',             # 공 크기 시퀀스
    'ace_icon',         # 마선수 아이콘
    'team_logo',        # 팀 로고
    'mode_icon',        # 메뉴 아이콘
    'item_icon',        # 아이템 아이콘
    'event_map',        # 외출 지도
    'game_ui',          # 경기 HUD
    'game_judge',       # 판정 문구
    'game_frame',       # 화면 제목
    'popup',            # 버튼 라벨
    'main_ui',          # 메인 메뉴 글자
    'main_title',       # 타이틀 아트
    'slt_frame',        # 선택 프레임
    'mode_back',        # 메뉴 배경
    'attack',           # 타석 그라운드
)
# 애니메이션 프레임을 쓰는 캐릭터 폴더
FRAME_FOLDERS = (
    'batter_balancer',
    'batter_medica', 'batter_kao', 'batter_roze', 'batter_death', 'batter_tiger',
    'pitcher_psyker', 'pitcher_leony', 'pitcher_bbmachine', 'pitcher_ballantine',
    'pitcher_dragona',
)


def collect() -> set[Path]:
    wanted: set[Path] = set()

    for path in CODE_ROOT.rglob('*'):
        if path.suffix not in {'.ts', '.tsx'}:
            continue
        for match in STATIC_REFERENCE.findall(path.read_text(encoding='utf-8')):
            wanted.add(Path(match))

    for folder in DYNAMIC_FOLDERS:
        for png in (SOURCE_ROOT / folder).glob('*.png'):
            wanted.add(png.relative_to(SOURCE_ROOT))

    for folder in FRAME_FOLDERS:
        # 파트 원본은 필요 없고 합성된 프레임만 쓴다
        for png in (SOURCE_ROOT / folder / 'frames').glob('*.png'):
            wanted.add(png.relative_to(SOURCE_ROOT))
        # 프레임 합성이 안 된 캐릭터는 정지 그림으로 대체하므로 파트도 남긴다
        if not (SOURCE_ROOT / folder / 'frames').exists():
            for png in (SOURCE_ROOT / folder).glob('*.png'):
                wanted.add(png.relative_to(SOURCE_ROOT))

    return {path for path in wanted if (SOURCE_ROOT / path).exists()}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    arguments = parser.parse_args()

    # 아래에서 TARGET_ROOT 를 통째로 지우고 다시 채운다. 원본 트리가 없으면 "지우고 아무것도
    # 안 넣기" 가 되어 배포본이 날아가므로 먼저 막는다 (지금 저장소에는 base/sprites 가 없다 —
    # public/sprites 는 decode_pzx.py 를 -o public/sprites 로 직접 돌려 채운 것이다).
    if not SOURCE_ROOT.exists():
        raise ValueError(f'원본 스프라이트 트리가 없습니다: {SOURCE_ROOT} '
                         f'(먼저 python3 tools/decode_pzx.py base/work/jar -o {SOURCE_ROOT} 를 돌리세요)')

    wanted = collect()
    total = sum((SOURCE_ROOT / path).stat().st_size for path in wanted)
    available = sum(1 for _ in SOURCE_ROOT.rglob('*.png'))
    print(f'전체 {available:,}장 중 {len(wanted):,}장 사용 ({total / 1024 / 1024:.1f}MB)')

    if arguments.dry_run:
        return 0

    if TARGET_ROOT.exists():
        shutil.rmtree(TARGET_ROOT)
    for path in sorted(wanted):
        target = TARGET_ROOT / path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(SOURCE_ROOT / path, target)

    print(f'→ {TARGET_ROOT}')
    return 0


raise SystemExit(main())
