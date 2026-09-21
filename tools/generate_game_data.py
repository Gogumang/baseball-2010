#!/usr/bin/env python3
"""
추출한 원본 테이블을 게임이 바로 쓰는 TypeScript 데이터로 변환한다.

    python3 tools/generate_game_data.py

입력: base/extracted/*.json   (tools/extract_wipi_game.py 결과)
출력: src/shared/config/original/*.ts  (손으로 고치지 말 것 — 이 스크립트를 고칠 것)
"""

from __future__ import annotations

import json
import struct
from pathlib import Path

EXTRACTED = Path('base/extracted')
OUTPUT = Path('src/shared/config/original')

# 원본 능력치는 0~999 눈금이다. 웹판도 같은 눈금을 쓴다 (예전에는 10으로 나눴다).
ABILITY_SCALE = 1

# 선수/마선수 레코드 레이아웃 (48바이트)
#   0        u8   아이디
#   1..9     CP949 이름 (널 패딩)
#   12..19   u16 × 4  능력치
ABILITY_OFFSET = 12
ABILITY_COUNT = 4

# 수비 위치 코드 — XlsBATTER_DATA 행 바이트 28 (레코드 +0x1c, 표의 14번째 칸 u32).
# 원본 0xb1048 은 `(레코드 +0x1c & 0xf) − 1` 로 수비 칸을 고른다 (칸 0 = 투수는 건너뜀).
#   1 지명 · 2 포수 · 3 1루 · 4 2루 · 5 3루 · 6 유격
#   7 = 1루 쪽 외야(우익 자리) · 8 = 3루 쪽 외야(좌익 자리) · 9 중견
#   0 = 자리 없는 후보 (15팀 × 3명 = 45명)
# ⚠️ 원본 그대로: 기록 번호(7 좌익 · 8 중견 · 9 우익)와 7·8·9 가 다르다. 좌표 표 0xd86ec 를 따른다.
# 근거: R3-field-view.md 2-2·6절
POSITION_OFFSET = 28
POSITION_MASK = 0xF

# StrCOMMON 안의 구간. 인덱스를 직접 확인해 정리한 것이다.
COMMON_TEAM_RANGE = (0, 15)
COMMON_ACE_PITCHER_RANGE = (15, 20)
COMMON_ACE_BATTER_RANGE = (20, 25)
# 육성 선수의 필살타법·마구 이름 (창에 뜨는 것)
COMMON_BATTER_BURST_RANGE = (25, 30)
COMMON_PITCHER_BURST_RANGE = (31, 37)
# ⚠️ 마선수 기술 이름은 **다른 구간**이다 (H2 6절·4-1 확정):
#   마타자 StrCOMMON[0x5f + n] = 100~104 (핑크 봄 · 플레임 스트라이커 · 메이든 임팩트 · 하트 브레이커 · 크로스 액스)
#   마투수 StrCOMMON[0x5a + n] = 95~99  (싸이킥 스타 · 트리플 크로우 · 홀로그램 레이저 · 다크 일루전 · 브레스 웨폰)
# 예전에는 위 육성용 구간을 순번으로 붙여 메디카가 "파워 스윙" 이 되어 있었다.
COMMON_ACE_BATTER_BURST_RANGE = (100, 105)
COMMON_ACE_PITCHER_BURST_RANGE = (95, 100)
COMMON_SKILL_START = 55

# StrMODE 안의 구간.
MODE_STAT_RANGE = (22, 35)          # 인기도 · 평판 · 사기 · 소지금 …
MODE_TRAINING_RANGE = (35, 48)      # 히트 · 파워 · 수비 · 주루 · 모든능력치 · 제구 …
MODE_SCHEDULE_RANGE = (48, 59)      # 들어가기 · 팬미팅 · 외식 · 입원 · 야구교실 …

# ace_icon.pzx 는 StrCOMMON 순서를 따른다 — 투수 5명이 먼저다.
ACE_ICON_PITCHER_START = 0
ACE_ICON_BATTER_START = 5

BANNER = ('// 이 파일은 tools/generate_game_data.py 가 원본 패키지에서 생성했다.\n'
          '// 직접 고치지 말고 생성기를 고칠 것.\n\n')


def load(name: str):
    return json.loads((EXTRACTED / f'{name}.json').read_text(encoding='utf-8'))


def abilities_of(row_hex: str) -> list[int]:
    row = bytes.fromhex(row_hex)
    return [
        int.from_bytes(row[ABILITY_OFFSET + i * 2:ABILITY_OFFSET + 2 + i * 2], 'little')
        // ABILITY_SCALE
        for i in range(ABILITY_COUNT)
    ]


def position_of(row_hex: str) -> int:
    """타자 레코드의 수비 위치 코드 (0xb1048 과 같은 식)."""
    row = bytes.fromhex(row_hex)
    return int.from_bytes(row[POSITION_OFFSET:POSITION_OFFSET + 4], 'little') & POSITION_MASK


def quote(text: str) -> str:
    return "'" + text.replace('\\', '\\\\').replace("'", "\\'") + "'"


def clean_strings(entries: list[str]) -> list[str]:
    return [entry.rstrip('\x00').strip() for entry in entries]


def write(filename: str, body: str) -> None:
    (OUTPUT / filename).write_text(BANNER + body, encoding='utf-8')
    print(f'  {filename}')


DATA_OUTPUT = OUTPUT / 'data'


def write_json(filename: str, value) -> None:
    """대사·에피소드처럼 양이 많은 원본 데이터는 JSON 으로 두고, TS 는 타입만 입혀 읽는다."""
    DATA_OUTPUT.mkdir(parents=True, exist_ok=True)
    (DATA_OUTPUT / filename).write_text(json.dumps(value, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'  data/{filename}')


def write_json_module(filename: str, json_name: str, value, declaration: str, imports: str = '') -> None:
    """JSON 한 벌 + 그것을 읽는 얇은 TS 모듈을 함께 만든다."""
    write_json(json_name, value)
    body = [imports] if imports else []
    body += [f"import data from '@/shared/config/original/data/{json_name}'", '', declaration]
    write(filename, '\n'.join(body) + '\n')


def generate_ace_players() -> None:
    """마선수 — 원작의 특별 상대. 타자 5명 + 투수 5명."""
    lines = [
        "import type { BatterAbility } from '@/entities/batting/model/batter'",
        '',
        'export interface AcePlayer {',
        '  readonly id: string',
        '  readonly name: string',
        "  readonly role: '타자' | '투수'",
        '  readonly ability: BatterAbility',
        '  /** 원본 ace/ace_icon.pzx 의 33×33 아이콘 */',
        '  readonly iconUrl: string',
        '  /** 원본에서 합성한 애니메이션 프레임 폴더 */',
        '  readonly framesUrl: string',
        '  readonly frameCount: number',
        '  /** 프레임 합성이 안 된 경우 쓰는 정지 그림 */',
        '  readonly stillUrl: string',
        '  /** 필살기 이름 (StrCOMMON) */',
        '  readonly burst: string',
        '}',
        '',
        '/** 원본 XlsACE_BAT_DATA / XlsACE_PIT_DATA. 능력치는 원본 0~999 눈금 그대로. */',
        'export const ACE_PLAYERS: readonly AcePlayer[] = [',
    ]
    common = clean_strings(load('StrCOMMON'))
    batter_bursts = common[slice(*COMMON_ACE_BATTER_BURST_RANGE)]
    pitcher_bursts = common[slice(*COMMON_ACE_PITCHER_BURST_RANGE)]

    # ace/ 스프라이트 파일명 순서와 표 순서가 같다.
    sprite_ids = {
        '타자': ['medica', 'kao', 'roze', 'death', 'tiger'],
        '투수': ['psyker', 'leony', 'bbmachine', 'ballantine', 'dragona'],
    }
    icon_start = {'타자': ACE_ICON_BATTER_START, '투수': ACE_ICON_PITCHER_START}
    bursts = {'타자': batter_bursts, '투수': pitcher_bursts}
    frame_counts = count_frames()

    for role, table in (('타자', 'XlsACE_BAT_DATA'), ('투수', 'XlsACE_PIT_DATA')):
        data = load(table)
        for index, (name, row) in enumerate(zip(data['names'], data['rows'])):
            # 원본 순서는 히트·파워·수비·주루 (생성 표 0xcc3fa·훈련 0x17f5c, 누락 탐색 5차)
            hit, power, defense, run = abilities_of(row)
            identifier = sprite_ids[role][index]
            folder = ('batter_' if role == '타자' else 'pitcher_') + identifier
            icon = f'./sprites/ace_icon/{icon_start[role] + index:03d}.png'
            burst = bursts[role][index] if index < len(bursts[role]) else ''
            lines.append(
                f"  {{ id: {quote(identifier)}, name: {quote(name)}, "
                f"role: '{role}', ability: {{ hit: {hit}, power: {power}, "
                f"run: {run}, defense: {defense} }}, iconUrl: {quote(icon)}, "
                f"framesUrl: {quote('./sprites/' + folder + '/frames')}, "
                f"frameCount: {frame_counts.get(folder, 0)}, "
                f"stillUrl: {quote(largest_image(folder))}, burst: {quote(burst)} }},"
            )
    lines.append(']')
    write('acePlayers.ts', '\n'.join(lines) + '\n')


def largest_image(folder: str) -> str:
    """프레임 합성이 실패한 캐릭터를 위해 가장 큰 파트 그림을 고른다."""
    directory = Path('public/sprites') / folder
    if not directory.exists():
        return ''
    candidates = [path for path in directory.glob('*.png')]
    if not candidates:
        return ''
    biggest = max(candidates, key=lambda path: path.stat().st_size)
    return f'./sprites/{folder}/{biggest.name}'


def count_frames() -> dict:
    """합성된 프레임이 몇 장인지 센다. 없으면 0."""
    root = Path('public/sprites')
    counts = {}
    if not root.exists():
        return counts
    for frames in root.glob('*/frames'):
        counts[frames.parent.name] = len(list(frames.glob('*.png')))
    return counts


def generate_roster() -> None:
    """일반 선수 명단 — 타자 180명, 투수 120명."""
    rosters = {}
    for label, table in (('batters', 'XlsBATTER_DATA'), ('pitchers', 'XlsPITCHER_DATA')):
        data = load(table)
        rows = []
        for index, (name, row) in enumerate(zip(data['names'], data['rows'])):
            if not name.strip():
                continue
            player = {'id': index, 'name': name, 'ability': abilities_of(row)}
            # 수비 위치는 타자 표에만 있다. 투수 표의 같은 칸(+0x1c)은 다른 뜻이라 넣지 않는다.
            if label == 'batters':
                player['position'] = position_of(row)
            rows.append(player)
        rosters[label] = rows
    write_json_module(
        'roster.ts',
        'roster.json',
        rosters,
        'export interface RosterPlayer {\n'
        '  readonly id: number\n'
        '  readonly name: string\n'
        '  /** 히트 · 파워 · 수비 · 주루 (투수는 제구 · 구속 · 변화 · 체력) — 0xb6414 인덱스 순서 */\n'
        '  readonly ability: readonly [number, number, number, number]\n'
        '  /**\n'
        '   * 수비 위치 코드 — 원본 레코드 +0x1c (XlsBATTER_DATA 행 바이트 28).\n'
        '   * 1 지명 · 2 포수 · 3 1루 · 4 2루 · 5 3루 · 6 유격 ·\n'
        '   * 7 = 1루 쪽 외야(우익 자리) · 8 = 3루 쪽 외야(좌익 자리) · 9 중견 · 0 = 자리 없는 후보.\n'
        '   * 수비 칸 번호는 `code - 1` 이고 칸 0(투수)은 이 검색에서 빠진다 (0xb1048).\n'
        '   * ⚠️ 원본 그대로: 기록 번호(7 좌익 · 8 중견 · 9 우익)와 7·8·9 가 어긋난다.\n'
        '   * 투수 명단에는 없다.\n'
        '   */\n'
        '  readonly position?: number\n'
        '}\n'
        '\n'
        '// JSON 은 네 칸 튜플을 나타내지 못해 한 번 더 단언한다\n'
        'export const BATTERS = data.batters as unknown as readonly RosterPlayer[]\n'
        'export const PITCHERS = data.pitchers as unknown as readonly RosterPlayer[]',
    )


def generate_teams() -> None:
    data = load('XlsTEAM_DATA')
    names = clean_strings(load('StrCOMMON'))[slice(*COMMON_TEAM_RANGE)]

    lines = [
        'export interface TeamRecord {',
        '  readonly id: number',
        '  readonly name: string',
        '  readonly logoUrl: string',
        '  /** 원본 XlsTEAM_DATA의 u16 6개. 팀 전력 지표로 보인다. */',
        '  readonly values: readonly number[]',
        '}',
        '',
        '/** 원본 팀 15개. 이름은 StrCOMMON, 로고는 ui/team_logo.pzx 이며 순서가 같다. */',
        'export const TEAMS: readonly TeamRecord[] = [',
    ]
    for index, row_hex in enumerate(data['rows']):
        row = bytes.fromhex(row_hex)
        values = [int.from_bytes(row[i:i + 2], 'little') for i in range(0, len(row), 2)]
        name = names[index] if index < len(names) else f'팀 {index}'
        lines.append(
            f"  {{ id: {index}, name: {quote(name)}, "
            f"logoUrl: {quote(f'./sprites/team_logo/{index:03d}.png')}, "
            f"values: [{', '.join(map(str, values))}] }},"
        )
    lines.append(']')
    write('teams.ts', '\n'.join(lines) + '\n')


def generate_string_list(source: str, const_name: str, filename: str, comment: str) -> None:
    entries = clean_strings(load(source))
    json_name = filename.replace('.ts', '.json')
    write_json_module(
        filename,
        json_name,
        entries,
        f'/** {comment} (원본 {source}, {len(entries)}개) */\n'
        f'export const {const_name}: readonly string[] = data',
    )


# ── 스토리 ────────────────────────────────────────────────

# 선택지로 볼 최대 길이. 이보다 길면 대사로 본다.
CHOICE_MAX_LENGTH = 34
# 선택지 묶음으로 인정할 최소/최대 개수
CHOICE_RUN_MINIMUM = 2
CHOICE_RUN_MAXIMUM = 4
# 선택지가 안 나와도 이 줄 수를 넘으면 장면을 끊는다.
SCENE_MAX_LINES = 12


def looks_like_choice(text: str) -> bool:
    """
    선택지는 '연봉 협상한다', '그냥 받아들인다'처럼 짧은 서술형 행동 문장이다.
    줄바꿈 마크업이 들어간 긴 대사는 선택지가 아니다.
    """
    stripped = text.strip()
    if not stripped or '!N' in stripped or len(stripped) > CHOICE_MAX_LENGTH:
        return False
    body = stripped.split('(')[0].strip().rstrip('.')
    return body.endswith('다')


# 스킬 40종: 이름 StrCOMMON[55~94], 소개 StrSKILL[0~39], 효과 StrSKILL[40~79]
SKILL_COUNT = 40
COMMON_SKILL_NAME_START = 55
# 효과 문구로 나눈 대상 — 0~7 공통(훈련·부상·능력치), 8~23 타자(안타율·장타율), 24~39 투수(피안타율·실투율)
SKILL_ROLE_RANGES = (('공통', 0, 8), ('타자', 8, 24), ('투수', 24, 40))


def generate_skills() -> None:
    """스킬 — 이름·소개·효과를 한 레코드로 묶는다. 획득 조건과 색(플러스/마이너스/스페셜)은 미해독."""
    common = clean_strings(load('StrCOMMON'))
    texts = clean_strings(load('StrSKILL'))
    skills = [
        {
            'id': index,
            'name': common[COMMON_SKILL_NAME_START + index],
            'description': texts[index],
            'effect': texts[SKILL_COUNT + index],
            'role': role,
        }
        for role, start, end in SKILL_ROLE_RANGES
        for index in range(start, end)
    ]
    write_json_module(
        'skills.ts',
        'skills.json',
        skills,
        'export interface OriginalSkill {\n'
        '  readonly id: number\n'
        '  readonly name: string\n'
        '  /** 소개 (StrSKILL[id]) */\n'
        '  readonly description: string\n'
        '  /** 효과 (StrSKILL[40+id]) — 마크업 원문 */\n'
        '  readonly effect: string\n'
        "  /** 효과 문구로 나눈 대상 */\n"
        "  readonly role: '공통' | '타자' | '투수'\n"
        '}\n'
        '\n'
        '/** 스킬 40종 (StrCOMMON[55~94] + StrSKILL) */\n'
        'export const ORIGINAL_SKILLS: readonly OriginalSkill[] = data as readonly OriginalSkill[]',
    )


# 올해의 목표 표 (binary.mod, VA = 파일오프셋 + 0xfcc) — 누락 탐색 에이전트가 찾은 주소
BINARY_VA_OFFSET = 0xFCC
BATTER_YEAR_GOAL_TABLE_VA = 0xD7F9E
YEAR_COUNT = 13
GOAL_COUNT = 5
# 선수 +0xb 상위 비트로 고르는 표 중 실제 값이 있는 것은 두 개다 (세 번째는 다른 데이터)
BATTER_GOAL_TABLE_COUNT = 2


def generate_year_goals() -> None:
    """올해의 목표 — 연차 13 × 5칸 (타율×1000 · 안타 · 홈런 · 타점 · 인기도 상승), StrUSER_EVT[0]."""
    binary = (EXTRACTED.parent / 'work' / 'jar' / 'binary.mod').read_bytes()
    offset = BATTER_YEAR_GOAL_TABLE_VA - BINARY_VA_OFFSET
    count = BATTER_GOAL_TABLE_COUNT * YEAR_COUNT * GOAL_COUNT
    values = struct.unpack_from(f'<{count}H', binary, offset)
    tables = []
    for table in range(BATTER_GOAL_TABLE_COUNT):
        rows = []
        for year in range(YEAR_COUNT):
            start = (table * YEAR_COUNT + year) * GOAL_COUNT
            rows.append('[' + ', '.join(str(v) for v in values[start:start + GOAL_COUNT]) + ']')
        tables.append('  [\n    ' + ',\n    '.join(rows) + ',\n  ]')
    lines = [
        '/**',
        ' * 타자 올해의 목표 (binary.mod 0xd7f9e). [표][연차−1] = [타율×1000, 안타, 홈런, 타점, 인기도 상승].',
        ' * 표는 선수 타입 비트(선수 +0xb)로 고른다.',
        ' */',
        'export const BATTER_YEAR_GOALS: readonly (readonly (readonly number[])[])[] = [',
        ',\n'.join(tables) + ',',
        ']',
    ]
    write('yearGoals.ts', '\n'.join(lines) + '\n')


def generate_bursts() -> None:
    """필살기 — 타자 스윙 5종, 투수 볼 6종 (StrCOMMON)."""
    common = clean_strings(load('StrCOMMON'))
    lines = [
        '/** 타자 필살기 (원본 StrCOMMON) */',
        'export const BATTER_BURSTS: readonly string[] = ['
        + ', '.join(quote(t) for t in common[slice(*COMMON_BATTER_BURST_RANGE)]) + ']',
        '',
        '/** 투수 필살기 (원본 StrCOMMON) */',
        'export const PITCHER_BURSTS: readonly string[] = ['
        + ', '.join(quote(t) for t in common[slice(*COMMON_PITCHER_BURST_RANGE)]) + ']',
    ]
    write('bursts.ts', '\n'.join(lines) + '\n')


# ── 돌발미션 ──────────────────────────────────────────────

# .zt1 은 u32 전체 크기 · u32 해제 크기 · zlib 이다 (tools/extract_wipi_game.py).
ZT1_HEADER_SIZE = 8
# GXL 레코드 표 머리: 'GXL'+버전 4바이트 · u16 행크기 · u16 열수 · u16 행수 = 10바이트,
# 그 뒤에 u8 열 타입이 열 수만큼 붙는다. 그래서 **본문 시작 = 10 + 열 수** 다.
# 돌발미션 표는 16열이라 26바이트(0x1a)를 건너뛰며, 그래야 40/44/56행 × 16바이트가 파일 끝에
# 딱 맞게 떨어진다 (XlsACE_PIT_DATA 가 23열이라 0x21 을 건너뛰는 것과 같은 계산이다).
GXL_FIXED_HEADER = 10

# 돌발미션 대사 한 줄 = u8 화자 · u8 표정 · CP949 128바이트. 한 행에 4줄 = 520바이트다
# (줄 0 제안 · 1 성공 · 2 실패 · 3 무효 — entities/burst-mission/model/burstMissionJudge.ts).
BURST_TEXT_LINE_COUNT = 4
BURST_TEXT_STRING_SIZE = 128
BURST_TEXT_LINE_SIZE = 2 + BURST_TEXT_STRING_SIZE

# 표 이름 → (본문 표, 대사 표, 행 수). 행 수는 로더 0x8e1b0 이 읽는 값이며 검산용이다.
BURST_MISSION_TABLES = (
    ('BATTER', 'XlsBATTER_BURST', 'XlsBATTER_BURST_TEXT', 40),
    ('PITCHER', 'XlsPITCHER_BURST', 'XlsPITCHER_BURST_TEXT', 44),
    ('SEASON', 'XlsSEASON_BURST', 'XlsSEASON_BURST_TEXT', 56),
)

BURST_ROW_SIZE = 16


def read_gxl_rows(name: str) -> tuple[list[bytes], list[int]]:
    """
    data/<name>.zt1 (GXL 레코드 표)을 원시 바이트에서 직접 풀어 행 목록으로 돌려준다.

    `base/extracted/*.json` 을 거치지 않는 이유: 그 JSON 의 `names` 는 모든 표가
    [u8 아이디][CP949 이름 9바이트] 로 시작한다고 보고 읽은 값이라, 이름 칸이 없는
    돌발미션 표에서는 숫자를 글자로 잘못 읽은 쓰레기다.
    """
    import zlib as _zlib
    raw = _zlib.decompress(Path(f'base/work/jar/data/{name}.zt1').read_bytes()[ZT1_HEADER_SIZE:])
    if raw[0:3] != b'GXL':
        raise ValueError(f'{name}: GXL 표가 아니다 (앞 4바이트 {raw[:4]!r})')
    row_size = int.from_bytes(raw[4:6], 'little')
    column_count = int.from_bytes(raw[6:8], 'little')
    row_count = int.from_bytes(raw[8:10], 'little')
    data_start = GXL_FIXED_HEADER + column_count
    if data_start + row_count * row_size != len(raw):
        raise ValueError(f'{name}: 행 레이아웃 검산 실패 '
                         f'({data_start}+{row_count}*{row_size} != {len(raw)})')
    rows = [raw[data_start + i * row_size:data_start + (i + 1) * row_size] for i in range(row_count)]
    return rows, list(raw[GXL_FIXED_HEADER:data_start])


def burst_lines_of(row: bytes) -> list[dict]:
    lines = []
    for index in range(BURST_TEXT_LINE_COUNT):
        offset = index * BURST_TEXT_LINE_SIZE
        lines.append({
            'speaker': row[offset],
            'expression': row[offset + 1],
            'text': fixed_cp949(row, offset + 2, BURST_TEXT_STRING_SIZE),
        })
    return lines


def generate_burst_missions() -> None:
    """
    돌발미션 — 타석 전에 감독·동료가 걸어 오는 짧은 과제.

    본문 표(`XlsBATTER_BURST` 40행 · `XlsPITCHER_BURST` 44행 · `XlsSEASON_BURST` 56행)는
    16열이 전부 u8 인 16바이트 행이다. **뜻풀이는 여기서 하지 않고 원시 16바이트 그대로 낸다** —
    열의 뜻은 `entities/burst-mission/model/burstMissionRow.ts` 의 `decodeBurstRow` 가 안다.
    """
    tables = {}
    for label, body_table, text_table, expected_rows in BURST_MISSION_TABLES:
        rows, column_types = read_gxl_rows(body_table)
        text_rows, _ = read_gxl_rows(text_table)
        if len(rows) != expected_rows or len(text_rows) != expected_rows:
            raise ValueError(f'{body_table}: 행 수가 {expected_rows} 가 아니다 '
                             f'(본문 {len(rows)} · 대사 {len(text_rows)})')
        if any(len(row) != BURST_ROW_SIZE for row in rows) or any(t != 0 for t in column_types):
            raise ValueError(f'{body_table}: 16바이트 u8 × 16 열이 아니다 (열 타입 {column_types})')
        tables[label] = {
            'rowBytes': [list(row) for row in rows],
            'lines': [burst_lines_of(row) for row in text_rows],
        }

    write_json_module(
        'burstMissions.ts',
        'burstMissions.json',
        tables,
        '/** 돌발미션 대사 한 줄. 화자·표정 번호는 원본 값 그대로다 (뜻은 미해독) */\n'
        'export interface OriginalBurstLine {\n'
        '  readonly speaker: number\n'
        '  readonly expression: number\n'
        '  /** 마크업 원문 — !cRRGGBB 색상 · !N 줄바꿈 */\n'
        '  readonly text: string\n'
        '}\n'
        '\n'
        'export interface OriginalBurstTable {\n'
        '  /** 행마다 원시 16바이트. 뜻은 entities/burst-mission 의 decodeBurstRow 가 입힌다 */\n'
        '  readonly rowBytes: readonly (readonly number[])[]\n'
        '  /** 행마다 대사 4줄 — 0 제안 · 1 성공 · 2 실패 · 3 무효 */\n'
        '  readonly lines: readonly (readonly OriginalBurstLine[])[]\n'
        '}\n'
        '\n'
        "export type OriginalBurstTableName = 'BATTER' | 'PITCHER' | 'SEASON'\n"
        '\n'
        '/** 돌발미션 표 (원본 Xls{BATTER,PITCHER,SEASON}_BURST + _TEXT — 40 · 44 · 56행) */\n'
        'export const ORIGINAL_BURST_TABLES: Readonly<Record<OriginalBurstTableName, OriginalBurstTable>> =\n'
        '  data as unknown as Readonly<Record<OriginalBurstTableName, OriginalBurstTable>>',
    )


def generate_mode_menus() -> None:
    """원작의 훈련 항목과 스케줄 활동 (StrMODE)."""
    mode = clean_strings(load('StrMODE'))
    training = [t for t in mode[slice(*MODE_TRAINING_RANGE)] if t]
    schedule = [t for t in mode[slice(*MODE_SCHEDULE_RANGE)] if t and t != '들어가기']
    stats = [t for t in mode[slice(*MODE_STAT_RANGE)] if t]

    lines = [
        '/** 원작 훈련 항목 — 능력치 이름을 골라 횟수를 쌓는다 (StrMODE) */',
        'export const TRAINING_TARGETS: readonly string[] = ['
        + ', '.join(quote(t) for t in training) + ']',
        '',
        '/** 원작 스케줄 활동 (StrMODE) */',
        'export const SCHEDULE_ACTIVITIES: readonly string[] = ['
        + ', '.join(quote(t) for t in schedule) + ']',
        '',
        '/** 원작 선수 상태 항목 (StrMODE) */',
        'export const STATUS_LABELS: readonly string[] = ['
        + ', '.join(quote(t) for t in stats) + ']',
    ]
    write('modeMenus.ts', '\n'.join(lines) + '\n')


# 미션 레코드 배치 (레코드 바이트를 직접 세어 확인했다):
#   u8 × 9 | u16 제한 | u16 제한시간 | u8 조건코드 | 목표 32 | 이름 32 | 설명문 64 | ...
# 제한시간을 u8 로 읽으면 300초(2c 01)가 44초가 된다 — 실제로 그렇게 잘못 읽고 있었다.
MISSION_ID_OFFSET = 0
MISSION_STAGE_OFFSET = 1
# 윗 4비트 = 상대 마선수 순번 (타자편은 마투수, 투수편은 마타자 순서. 0 이면 일반 선수)
MISSION_OPPONENT_OFFSET = 8
# 상위 바이트 = 타석 제한, 하위 바이트 윗 4비트 = 스윙 제한, 아래 4비트 = 투구 수 제한.
# 설명문과 전부 맞는다: 투수 4번 0x0106 "6개의 공으로", 타자 10번 0x0030 "3번의 스윙으로"
MISSION_LIMITS_OFFSET = 9
MISSION_TIME_LIMIT_OFFSET = 11
# 바이트 13 = **투수 미션의 조준점 흔들림 세기** 0~3 (E-defense-rules.md E-7 · 4a, 확정).
#   읽어 두기 0xaa57c(`ldrb [rec,#0xd]` → 미션 컨텍스트 +0x20), 쓰기 0x39c5c(투수 조준 틱 갱신,
#   화면 모드 5 = 투수 미션일 때만). 조준점은 존 중심 기준 x ±600 · y ±400 으로 잘린 뒤:
#     1: rand(0,100) ≤ 50 이면 x += rand(−40, 40)
#     2: rand(0,100) ≤ 50 이면 x += rand(−80, 80), y += rand(−80, 80)
#     3: rand(0,100) ≤ 50 이면 x = rand(중심x−600, 중심x+600), y = rand(중심y−400, 중심y+400)
#   붙은 미션: 투수 4 로제 · 5 "흔들리지 않는 마음" = 1 / 투수 8 크라이져 · 12 킹타이거 = 2 /
#   투수 10 "난공불락의 철벽마무리" = 3. 타자편은 모두 0(효과 없음).
# 예전에는 이 바이트가 목표 문자열 앞에 붙어 '\x01아웃' 이 되는 바람에 목표가 판정되지 않았다.
MISSION_CONDITION_OFFSET = 13

# 흔들림 세기별 매개변수 (0x39d24~0x39dde). 확률은 `rand(0,100) <= 50` 이라 **51%** 다 — 원본 그대로.
MISSION_AIM_SHAKE_CHANCE = 50
MISSION_AIM_CLAMP_X = 600
MISSION_AIM_CLAMP_Y = 400
MISSION_AIM_SHAKE_LEVELS = (
    (1, 40, 0, 'false'),
    (2, 80, 80, 'false'),
    (3, MISSION_AIM_CLAMP_X, MISSION_AIM_CLAMP_Y, 'true'),
)
MISSION_TEXT_FIELDS = ((14, 32), (46, 32), (78, 64))

# 목표 개수 칸 (레코드 뒤쪽). 4비트 단위로 여러 목표가 한 바이트를 나눠 쓴다.
# (오프셋, 비트 이동, 마스크) — 모든 미션의 설명문 숫자와 맞는다.
#   타자 1 "2안타와 1타점" → 166=02, 165=01 / 타자 13 "3번의 타석을 모두 홈런" → 163=03
#   투수 2 "MAX투구게이지 6구와 2아웃" → 161 위=6, 164=02 / 투수 1 "경기를 마무리" → 164=03 (설명문에 숫자 없음)
BATTER_GOAL_COUNT_FIELDS = {
    '단타': (160, 0, 0xF), '2루타': (160, 4, 0xF), '3루타': (161, 0, 0xF),
    '그라운드홈런': (162, 0, 0xF), '만루홈런': (162, 4, 0xF), '홈런': (163, 0, 0xFF),
    '도루': (164, 0, 0xF), '번트': (164, 4, 0xF), '타점': (165, 0, 0xFF), '안타': (166, 0, 0xFF),
}
PITCHER_GOAL_COUNT_FIELDS = {
    '삼진콤보': (160, 0, 0xF), '탈삼진': (160, 4, 0xF), 'MAX게이지': (161, 4, 0xF), '아웃': (164, 0, 0xFF),
}


# 시작 상황 (점검 에이전트, 0xaae7c) — 3번 바이트 아래 4비트 = 시작 이닝(0부터),
# 4번 바이트 비트0-1 아웃 · 2-3 볼 · 4-5 스트라이크 (볼/스트라이크 순서는 추정 — 투수 14번 "3볼" 과 맞음),
# 5번 바이트 주자 비트 4=1루 · 2=2루 · 1=3루 (0xa9a9c)
MISSION_INNING_OFFSET = 3
MISSION_COUNT_OFFSET = 4
MISSION_RUNNER_OFFSET = 5
# 투수 실패 한도 (0xaac76~0xaacd6) — 그 값에 닿는 순간 실패. 0 이면 한도 없음
PITCHER_RUN_LIMIT = (161, 0, 0xF)
PITCHER_WALK_LIMIT = (162, 4, 0xF)
PITCHER_HIT_LIMIT = (162, 0, 0xF)


def nibble(row: bytes, field: tuple) -> int:
    offset, shift, mask = field
    return (row[offset] >> shift) & mask


def goal_counts_of(row: bytes, fields: dict) -> dict:
    counts = {name: (row[offset] >> shift) & mask for name, (offset, shift, mask) in fields.items()}
    return {name: count for name, count in counts.items() if count > 0}


def fixed_cp949(row: bytes, offset: int, size: int) -> str:
    return row[offset:offset + size].split(b'\x00', 1)[0].decode('cp949').strip()


# 142~159 = 9이닝 × 2팀 점수판 (0xaa610). 위 줄 = 원정 상대, 아래 줄 = 홈(우리) — 타자 12번 4:7 9회말 만루,
# 투수 1번 3:1 로 앞선 9회(실점 한도 2 = 동점) 와 맞아서 이렇게 읽는다 (추정)
MISSION_SCOREBOARD_OFFSET = 142
INNINGS = 9


def start_of(row: bytes) -> str:
    count = row[MISSION_COUNT_OFFSET]
    opponent = sum(row[MISSION_SCOREBOARD_OFFSET:MISSION_SCOREBOARD_OFFSET + INNINGS])
    ours = sum(row[MISSION_SCOREBOARD_OFFSET + INNINGS:MISSION_SCOREBOARD_OFFSET + 2 * INNINGS])
    runners = row[MISSION_RUNNER_OFFSET]
    flag = lambda bit: 'true' if runners & bit else 'false'
    return (
        f"{{ inning: {(row[MISSION_INNING_OFFSET] & 0xF) + 1}, outs: {count & 3}, "
        f"balls: {(count >> 2) & 3}, strikes: {(count >> 4) & 3}, "
        f"runners: {{ first: {flag(4)}, second: {flag(2)}, third: {flag(1)} }}, "
        f"ourScore: {ours}, opponentScore: {opponent} }}"
    )


def fail_limits_of(row: bytes, side: str) -> str:
    if side != '투수':
        return '{ runs: 0, walks: 0, hits: 0 }'
    return (
        f"{{ runs: {nibble(row, PITCHER_RUN_LIMIT)}, walks: {nibble(row, PITCHER_WALK_LIMIT)}, "
        f"hits: {nibble(row, PITCHER_HIT_LIMIT)} }}"
    )


def generate_missions() -> None:
    """
    미션 모드 — 원작 설명서: "타자편, 투수편으로 나누어지며 총 28개의 미션이
    준비되어 있습니다. 육성 선수 혹은 팀을 조작하여 제한 조건 내에서 게임 내 목표를..."

    이름·목표·설명문은 XlsBATTER_MISSION / XlsPITCHER_MISSION 레코드의 고정 길이 CP949 칸이다.
    """
    lines = [
        'export interface OriginalMission {',
        '  readonly id: number',
        "  readonly side: '타자' | '투수'",
        '  /** 난이도 단계. 원본 레코드의 두 번째 열이며 세 미션마다 오른다. */',
        '  readonly stage: number',
        '  readonly name: string',
        '  /** 목표 종류. 원본은 여러 개를 | 로 묶는다. */',
        '  readonly goals: readonly string[]',
        '  /** 원작 설명문. !N 은 줄바꿈 마크업이다. */',
        '  readonly briefing: string',
        '  /** 초 단위. 0이면 시간 제한이 없다. */',
        '  readonly timeLimitSeconds: number',
        '  /** 타석 제한. 0이면 없다. */',
        '  readonly plateAppearanceLimit: number',
        '  /** 스윙 제한. 0이면 없다. */',
        '  readonly swingLimit: number',
        '  /** 투구 수 제한. 0이면 없다. */',
        '  readonly pitchLimit: number',
        '  /** 상대 마선수 순번 (1부터, 상대 편 ACE_PLAYERS 순서). 0이면 일반 선수. */',
        '  readonly opponentAce: number',
        '  /**',
        '   * 원본 레코드 바이트 13 = **투수 미션의 조준점 흔들림 세기** 0~3 (0xaa57c → 0x39c5c).',
        '   * 0 이면 흔들리지 않는다. 1~3 의 뜻은 `MISSION_AIM_SHAKES` 를 볼 것. 타자편은 모두 0 이다.',
        '   */',
        '  readonly conditionCode: number',
        '  /** 목표별 필요 개수 (레코드 뒤쪽 칸). 사이클링히트는 단타·2루타·3루타·홈런 각각이다. */',
        '  readonly goalCounts: Readonly<Record<string, number>>',
        '  /** 시작 상황 — 이닝(1부터)·아웃·볼·스트라이크·주자 */',
        '  readonly start: {',
        '    readonly inning: number',
        '    readonly outs: number',
        '    readonly balls: number',
        '    readonly strikes: number',
        '    readonly runners: { readonly first: boolean; readonly second: boolean; readonly third: boolean }',
        '    readonly ourScore: number',
        '    readonly opponentScore: number',
        '  }',
        '  /** 투수편 실패 한도 — 실점·볼넷·피안타가 이 값에 닿으면 실패. 0 이면 없음 */',
        '  readonly failLimits: { readonly runs: number; readonly walks: number; readonly hits: number }',
        '}',
        '',
        '/** 원본 XlsBATTER_MISSION / XlsPITCHER_MISSION */',
        'export const MISSIONS: readonly OriginalMission[] = [',
    ]

    for side, table, count_fields in (
        ('타자', 'XlsBATTER_MISSION', BATTER_GOAL_COUNT_FIELDS),
        ('투수', 'XlsPITCHER_MISSION', PITCHER_GOAL_COUNT_FIELDS),
    ):
        data = load(table)
        for row_hex in data['rows']:
            row = bytes.fromhex(row_hex)
            goals, name, briefing = (fixed_cp949(row, offset, size) for offset, size in MISSION_TEXT_FIELDS)
            if not name:
                continue
            limits, time_limit = struct.unpack_from('<HH', row, MISSION_LIMITS_OFFSET)
            lines.append(
                f"  {{ id: {row[MISSION_ID_OFFSET]}, side: '{side}', "
                f"stage: {row[MISSION_STAGE_OFFSET]}, name: {quote(name)}, "
                f"goals: [{', '.join(quote(g) for g in goals.split('|'))}], "
                f"briefing: {quote(briefing)}, "
                f"timeLimitSeconds: {time_limit}, "
                f"plateAppearanceLimit: {limits >> 8}, "
                f"swingLimit: {(limits >> 4) & 0xF}, "
                f"pitchLimit: {limits & 0xF}, "
                f"opponentAce: {row[MISSION_OPPONENT_OFFSET] >> 4}, "
                f"conditionCode: {row[MISSION_CONDITION_OFFSET]}, "
                f"goalCounts: {{ {', '.join(f'{quote(k)}: {v}' for k, v in goal_counts_of(row, count_fields).items())} }}, "
                f"start: {start_of(row)}, "
                f"failLimits: {fail_limits_of(row, side)} }},"
            )
    lines.append(']')
    lines += [
        '',
        '/** 투수 미션 조준점 흔들림 (0x39c5c) — `conditionCode` 가 색인이다 */',
        'export interface MissionAimShake {',
        '  /** 틱마다 흔들릴 확률 % — 원본은 rand(0,100) <= 50 이라 51% 다 (⚠️ 원본 그대로) */',
        '  readonly chancePercent: number',
        '  /** 가로 흔들림 폭 (rand(−x, x)) */',
        '  readonly shakeX: number',
        '  /** 세로 흔들림 폭 (0 이면 세로는 안 흔든다) */',
        '  readonly shakeY: number',
        '  /** true 면 흔드는 대신 존 안 아무 데로 조준점을 옮긴다 */',
        '  readonly teleport: boolean',
        '}',
        '',
        '/** 조준점이 존 중심에서 벗어날 수 있는 한계 (0x39c5c) */',
        f'export const MISSION_AIM_CLAMP = {{ x: {MISSION_AIM_CLAMP_X}, y: {MISSION_AIM_CLAMP_Y} }}',
        '',
        '/** MISSION_AIM_SHAKES[conditionCode] — 0 은 흔들림 없음 */',
        'export const MISSION_AIM_SHAKES: readonly (MissionAimShake | null)[] = [',
        '  null,',
        *[
            f'  {{ chancePercent: {MISSION_AIM_SHAKE_CHANCE}, shakeX: {x}, shakeY: {y}, teleport: {teleport} }},'
            f' // 조건코드 {code}'
            for code, x, y, teleport in MISSION_AIM_SHAKE_LEVELS
        ],
        ']',
    ]
    write('missions.ts', '\n'.join(lines) + '\n')


# data/pitch.zt1 의 좌표 단위를 존 단위로 바꾸는 나눗수.
# 가장 큰 변화(CHANGEUP 1614)가 존 0.9가 되도록 잡았다 — 원본의 존 크기는 미해독이라
# 이 한 값만 우리가 정했고, 구질 사이의 상대 비율은 전부 원본 그대로다.
PITCH_BREAK_DIVISOR = 1793

PITCH_TYPE_NAMES = [
    'FASTBALL', 'TWO-SEAM', 'H.FAST', 'SINKER', 'SHOOT', 'SLIDER', 'CURVE', 'FORK',
    'CHANGEUP', 'CUT FAST', 'R.FAST', 'H.SINKER', 'H.SHOOT', 'H.SLIDER', 'S.CURVE',
    'S.CHANGEUP', 'GYRO', 'P.SINKER', 'P.SLIDER', 'KNUCKLE', 'SPECIAL',
]

# 레코드 수가 가장 많은 직구(32)를 기준 구속 1.0으로 둔다.
FASTEST_RECORD_COUNT = 32


def read_pitch_curves() -> list[dict]:
    """
    data/pitch.zt1 의 구질별 궤적 제어점에서 변화량을 계산한다.

        u8 항목수 | u32 오프셋 × N | 항목
        항목 = u8 구질번호 | u8 레코드수 | 레코드…
        레코드 = u16 크기 | u8 단계 | u16 점정보 | (i32 x, i32 y, i32 z) × 점개수

    ※ 점정보는 하위 바이트만 점 개수다. 상위 바이트는 변형 번호라 마스킹해야 한다
      (514 = 0x0202 → 점 2개, 변형 2). 이걸 안 가리면 점이 수백 개로 잡힌다.

    ※ 레코드는 **4개씩 한 묶음이 구속 단계**다. 묶음 안에서 `단계`가 1~2씩 줄어든다
      (FASTBALL 18/16/14/12, CHANGEUP 24/23/22/21). `단계`가 곧 공이 날아가는
      프레임 수라서 이것이 원본의 실제 비행 시간이다.

    첫 점은 릴리스, 마지막 점은 플레이트이며 모든 구질이 같다.
    가운데 점이 직선에서 얼마나 벗어나는지가 곧 변화량이다.
    직구는 점이 둘뿐이라 변화가 0이 된다 — 원본이 실제로 그렇다.
    """
    import zlib as _zlib
    raw = _zlib.decompress(Path('base/work/jar/data/pitch.zt1').read_bytes()[8:])
    count = raw[0]
    offsets = [int.from_bytes(raw[1 + i * 4:5 + i * 4], 'little') for i in range(count)]

    curves = []
    for index in range(min(count, len(PITCH_TYPE_NAMES))):
        end = offsets[index + 1] if index + 1 < count else len(raw)
        block = raw[offsets[index]:end]
        record_count = block[1]
        record_size = int.from_bytes(block[2:4], 'little')
        record = block[2:2 + record_size]
        point_count = int.from_bytes(record[3:5], 'little') & 0xFF

        # 앞 4개 레코드가 구속 1~4단계다. 그 `단계` 값이 비행 프레임 수다.
        flight_steps = []
        cursor = 2
        for _ in range(min(4, record_count)):
            size = int.from_bytes(block[cursor:cursor + 2], 'little')
            if size <= 0 or cursor + size > len(block):
                break
            flight_steps.append(block[cursor + 2])
            cursor += size

        points = []
        for p in range(point_count):
            base = 5 + p * 12
            points.append(tuple(
                int.from_bytes(record[base + k * 4:base + 4 + k * 4], 'little', signed=True)
                for k in range(3)
            ))

        horizontal = vertical = 0
        if len(points) >= 2:
            (x0, y0, z0), (x1, y1, z1) = points[0], points[-1]
            for (x, y, z) in points[1:-1]:
                ratio = (z - z0) / (z1 - z0) if z1 != z0 else 0
                dx = x - (x0 + (x1 - x0) * ratio)
                dy = y - (y0 + (y1 - y0) * ratio)
                if abs(dx) > abs(horizontal):
                    horizontal = dx
                if abs(dy) > abs(vertical):
                    vertical = dy

        curves.append({
            'name': PITCH_TYPE_NAMES[index],
            'horizontal': horizontal / PITCH_BREAK_DIVISOR,
            # 원본은 y가 아래로 갈수록 크다. 우리 좌표는 위가 양수라 부호를 뒤집는다.
            'vertical': -vertical / PITCH_BREAK_DIVISOR,
            'speed': record_count / FASTEST_RECORD_COUNT,
            'flight_steps': flight_steps,
        })
    return curves


def generate_pitch_types() -> None:
    lines = [
        'export interface PitchTypeInfo {',
        '  readonly name: string',
        '  /** 변화량 (존 단위). 원본 궤적 제어점에서 계산했다. */',
        '  readonly horizontalBreak: number',
        '  readonly verticalBreak: number',
        '  /** 구속 계수. 원본 궤적의 레코드 수 비율이다. */',
        '  readonly speed: number',
        '  /**',
        '   * 구속 1~4단계별 비행 프레임 수. pitch.zt1 레코드의 `단계` 값 그대로다.',
        '   * 앞이 느리고 뒤로 갈수록 빠르다 (FASTBALL 18/16/14/12).',
        '   */',
        '  readonly flightSteps: readonly number[]',
        '}',
        '',
        '/** 원작 구질 21종. 이름은 binary.mod, 변화량·구속·비행 프레임은 data/pitch.zt1 에서 왔다. */',
        'export const PITCH_TYPES: readonly PitchTypeInfo[] = [',
    ]
    for curve in read_pitch_curves():
        lines.append(
            f"  {{ name: {quote(curve['name'])}, "
            f"horizontalBreak: {curve['horizontal']:.3f}, "
            f"verticalBreak: {curve['vertical']:.3f}, "
            f"speed: {curve['speed']:.3f}, "
            f"flightSteps: [{', '.join(str(s) for s in curve['flight_steps'])}] }},"
        )
    lines.append(']')
    write('pitchTypes.ts', '\n'.join(lines) + '\n')



EVENT_PORTRAIT_FILES = ('event_char_0', 'event_char_1', 'event_char_2')


def _event_portraits(portraits: list[dict]) -> list[dict]:
    # 캐릭터 번호의 기본 애니메이션이 -1 인 항목은 원작도 자리를 차지하지 않는다 (0x7f54c).
    return [
        {'file': p['file'], 'animation': p['anim'], 'side': p['side']}
        for p in portraits
        if not p.get('hidden') and p.get('file') in EVENT_PORTRAIT_FILES
    ]


def _event_command(command: dict, texts: list[str]) -> dict:
    op = command['op']
    if op == 'system' and command['sub'] == 0:
        # 알림 팝업 — arg 가 대사 번호다 (0x8cf64 system 0)
        text = texts[command['arg']] if command['arg'] < len(texts) else ''
        return {'op': 'system', 'sub': 0, 'arg': command['arg'], 'text': text}
    if op == 'say':
        return {'op': 'say', 'text': command['textStr'] or '', 'speaker': command['speaker'],
                'format': command['fmt'], 'portraits': _event_portraits(command['portraits'])}
    if op == 'choice':
        return {'op': 'choice', 'portraits': _event_portraits(command['portraits']),
                'choices': [{'text': c['textStr'] or '', 'gotoEvent': c['gotoEvent']} for c in command['choices']]}
    if op == 'yesno':
        return {'op': 'yesno', 'text': command['textStr'] or '', 'yesEvent': command['yesEvent'], 'noEvent': command['noEvent']}
    if op == 'match':
        return {'op': 'match', 'team': command['team'], 'resultEvents': [command['arg1'], command['arg2']]}
    return {key: value for key, value in command.items() if key not in ('textStr', 'speakerName')}


def generate_events() -> None:
    """
    tools/decode_events.py 가 해독한 r_event 스크립트를 웹에서 쓰는 형태로 옮긴다.
    대사·화자·초상화(파일·애니메이션·좌우)·선택지 분기가 전부 원본 그대로다.
    """
    events = json.loads(Path('base/extracted/r_event.json').read_text(encoding='utf-8'))
    texts = json.loads(Path('base/extracted/r_event_txt.json').read_text(encoding='utf-8'))
    names = load('StrMODE')
    # 화자 번호 0 = 이름 없음, 1 = 플레이어, 2~24 = StrMODE[번호+91] (binary.mod 0x8b0xx)
    speakers = ['', '<player>'] + [names[code + 91] for code in range(2, 25)]

    out = [
        {
            'id': e['id'],
            # 대상 편 — 0 코드가 직접 부름(분기·평가·엔딩) · 1 공통 · 2 타자 · 3 투수 (점검 에이전트, 타자/투수 쌍 대사로 확인)
            'audience': e['enabled'],
            'repeatable': bool(e['repeatable']),
            'trigger': e['trigger'],
            'requiresEvent': e['requiresEvent'],
            'dateFrom': e['dateFrom'],
            'dateTo': e['dateTo'],
            'conditions': e['conditions'],
            'commands': [_event_command(c, texts) for c in e['commands']],
        }
        for e in events
    ]
    write_json_module(
        'events.ts',
        'events.json',
        out,
        '/** 원본 data/r_event.zt1 이벤트 스크립트 (binary.mod 0xadd10 해석기 기준으로 해독). */\n'
        'export const ORIGINAL_EVENTS: readonly OriginalEvent[] = data as readonly OriginalEvent[]',
        imports="import type { OriginalEvent } from '@/shared/config/original/eventTypes'",
    )
    meta = [
        f'/** r_event 이벤트 수. 본문(events.ts)을 불러오지 않고 진행 상태를 알 때 쓴다. */',
        f'export const TOTAL_EVENT_COUNT = {len(out)}',
        '',

        '/** 화자 번호 → 이름표. 0 은 이름 없음, 1 은 플레이어 이름으로 바꾼다 (StrMODE[번호+91]). */',
        f'export const SPEAKER_NAMES: readonly string[] = {json.dumps(speakers, ensure_ascii=False)}',
    ]
    write('eventMeta.ts', '\n'.join(meta) + '\n')

PATTERN_FILE = Path('base/work/jar/data/pattern.dat')
PATTERN_FLAG_FILE = Path('base/work/jar/data/pattern_plag.dat')
# pattern.dat 은 앞 9바이트 뒤(파일 +9)부터, pattern_plag.dat 은 파일 처음부터 같은 구조다:
#   u8 묶음 수 · u32×묶음 수 (기준점부터의 거리) · 묶음마다 u8 코드 · u16 개수 · 항목들
PATTERN_BASE = 9
PATTERN_FLAG_BASE = 0


def _pattern_groups(data: bytes, base: int, item_size: int) -> dict:
    count = data[base]
    groups = {}
    for index in range(count):
        offset = base + int.from_bytes(data[base + 1 + index * 4:base + 5 + index * 4], 'little')
        code = data[offset]
        size = int.from_bytes(data[offset + 1:offset + 3], 'little')
        items = [
            int.from_bytes(data[offset + 3 + i * item_size:offset + 3 + (i + 1) * item_size], 'little')
            for i in range(size)
        ]
        groups[code] = items
    return groups


def generate_batted_ball_patterns() -> None:
    patterns = _pattern_groups(PATTERN_FILE.read_bytes(), PATTERN_BASE, 4)
    flags = _pattern_groups(PATTERN_FLAG_FILE.read_bytes(), PATTERN_FLAG_BASE, 1)
    lines = []
    for code in sorted(patterns):
        words = patterns[code]
        code_flags = flags.get(code, [0] * len(words))
        if len(code_flags) != len(words):
            raise ValueError(f'pattern_plag 개수가 다릅니다: 코드 {code} {len(code_flags)} != {len(words)}')
        items = ', '.join(
            f'[{w >> 23}, {(w >> 11) & 0xFFF}, {w & 0x7FF}, {flag}]' for w, flag in zip(words, code_flags)
        )
        lines.append(f'  {code}: [{items}],')
    body = [
        '/**',
        ' * 원본 data/pattern.dat · pattern_plag.dat — 타구 결과 코드(0~26, 21~23 없음)별 타구 패턴.',
        ' * 항목 = [a, b, c, 플래그]. u32 w 에서 a = w>>23, b = (w>>11)&0xfff, c = w&0x7ff (0xb0614 · 위치 분석 3차).',
        ' * 뜻(추정): a 수평각(90 = 가운데, 45~135 밖이면 파울) · b 타구 속도 · c 높이. 플래그 비트0 = c 부호 반전.',
        ' */',
        'export type BattedBallPattern = readonly [angle: number, speed: number, height: number, flags: number]',
        '',
        'export const BATTED_BALL_PATTERNS: Readonly<Record<number, readonly BattedBallPattern[]>> = {',
        *lines,
        '}',
    ]
    write('battedBallPatterns.ts', '\n'.join(body) + '\n')


BINARY_MOD = Path('base/work/jar/binary.mod')
# binary.mod 파일 오프셋 = VA − 0xfcc
BINARY_VA_BASE = 0xFCC


def read_binary_table(va: int, fmt: str) -> list[int]:
    import struct as _struct
    raw = BINARY_MOD.read_bytes()
    return list(_struct.unpack_from(fmt, raw, va - BINARY_VA_BASE))


# 마구 레코드 고르기 (0x9e944, H2-special-skills.md 3-5).
MAGIC_PITCH_TYPE = 22
# 마투수 마구 번호 5~9 는 레코드 12~16 이다 (m + 7)
MAGIC_ACE_MIN_ID = 5
MAGIC_ACE_INDEX_OFFSET = 7
# 폼 f ≤ 5 이고 홀수면 f − 1 (0x9e950)
MAGIC_FORM_PAIR_LIMIT = 5


def generate_pitch_curves() -> None:
    """
    data/pitch.zt1 투구 레코드 전부 (위치 분석 2·5차).
        항목 = u8 구질 | u8 레코드수 | 레코드…
        레코드 = u8 크기 | u8 곡선종류(0 베지어 · 1 B-스플라인) | u8 비행 틱 N | u8 점수 | u8 폼(level) | (i32 x, y, z) × 점수
    항목 번호 + 1 이 원본 구질 번호 t 다 (1 FASTBALL … 21 SPECIAL, 22 마구).
    """
    import struct as _struct
    import zlib as _zlib
    raw = _zlib.decompress(Path('base/work/jar/data/pitch.zt1').read_bytes()[8:])
    count = raw[0]
    offsets = [_struct.unpack_from('<I', raw, 1 + i * 4)[0] for i in range(count)]
    entries = []
    for index in range(count):
        end = offsets[index + 1] if index + 1 < count else len(raw)
        block = raw[offsets[index]:end]
        cursor = 2
        records = []
        for _ in range(block[1]):
            size, curve, frames, point_count, form = block[cursor:cursor + 5]
            if size != 5 + 12 * point_count:
                raise ValueError(f'pitch.zt1 레코드 크기가 맞지 않습니다: 항목 {index} 크기 {size} 점 {point_count}')
            points = [
                list(_struct.unpack_from('<iii', block, cursor + 5 + 12 * p)) for p in range(point_count)
            ]
            records.append(f'{{ curve: {curve}, frames: {frames}, form: {form}, points: {points} }}')
            cursor += size
        entries.append('  [' + ', '.join(records) + '],')
    body = [
        '/**',
        ' * 원본 data/pitch.zt1 투구 레코드 (파서 0x9e944 · 위치 분석 2·5차).',
        ' * PITCH_RECORDS[t − 1] = 구질 t 의 레코드들. 같은 폼 안에서 k 번째(구속 단계 0~3)를 고른다.',
        ' * 좌표는 발사점 S(20000, 0, 24500) 기준 상대값이다.',
        ' */',
        'export interface PitchRecord {',
        '  /** 0 베지어 · 1 B-스플라인(미해독) */',
        '  readonly curve: number',
        '  /** 공이 나는 틱 수 N */',
        '  readonly frames: number',
        '  /** 투수 폼(level) */',
        '  readonly form: number',
        '  readonly points: readonly (readonly [number, number, number])[]',
        '}',
        '',
        'export const PITCH_RECORDS: readonly (readonly PitchRecord[])[] = [',
        *entries,
        ']',
        '',
        '/** 마구는 구질 22 하나다 — PITCH_RECORDS 색인은 t − 1 이다 */',
        f'export const MAGIC_PITCH_TYPE = {MAGIC_PITCH_TYPE}',
        '',
        '/**',
        ' * 마구 → 구질 22 블록의 몇 번째 레코드인가 (0x9e944, H2-special-skills.md 3-5).',
        ' *   육성·일반 마구 (magicId 1~4): 3(m − 1) + 폼/2',
        ' *   마투수      (magicId 5~9): m + 7',
        ' * 폼은 0x9e950 에서 먼저 홀수를 하나 내린다 (0/1 → 0, 2/3 → 2, 4/5 → 4; 6 이상은 그대로).',
        ' * 마구 4 는 폼에 따라 샤이닝 볼 · 캐넌 볼 · 미라지 볼로 갈리는데 레코드와 이름만 다르다.',
        ' */',
        'export function magicPitchRecordIndex(magicId: number, form: number): number {',
        f'  if (magicId >= {MAGIC_ACE_MIN_ID}) return magicId + {MAGIC_ACE_INDEX_OFFSET}',
        f'  const evenForm = form <= {MAGIC_FORM_PAIR_LIMIT} && form % 2 === 1 ? form - 1 : form',
        '  return 3 * (magicId - 1) + Math.trunc(evenForm / 2)',
        '}',
        '',
        '/** 마구 레코드 — 없으면 undefined (구질 22 블록은 레코드 17개다) */',
        'export function magicPitchRecord(magicId: number, form: number): PitchRecord | undefined {',
        f'  return PITCH_RECORDS[MAGIC_PITCH_TYPE - 1]?.[magicPitchRecordIndex(magicId, form)]',
        '}',
    ]
    write('pitchRecords.ts', '\n'.join(body) + '\n')


def generate_trigonometry_tables() -> None:
    """원본 정수 삼각함수 표 (위치 분석 2·5차, 0x6c6a8 · 0x6c768 · 0x6c7c0)."""
    sine_hundred = read_binary_table(0xD310C, '<91B')
    tangent = read_binary_table(0xD2FA4, '<90I')
    sine_sixteen = read_binary_table(0xD2EEC, '<91H')
    body = [
        '/** sin × 100, 0~90° (표 0xd310c) */',
        f'export const SINE_HUNDRED_TABLE: readonly number[] = {sine_hundred}',
        '',
        '/** tan × 10000, 0~89° (표 0xd2fa4) — 역탄젠트 이진 탐색용 */',
        f'export const TANGENT_TABLE: readonly number[] = {tangent}',
        '',
        '/** sin × 65535, 0~90° (표 0xd2eec) — 제구 오차 각도용 */',
        f'export const SINE_SIXTEEN_TABLE: readonly number[] = {sine_sixteen}',
    ]
    write('trigonometryTables.ts', '\n'.join(body) + '\n')


PITCH_PATTERN_DIFFICULTIES = ('easy', 'normal', 'hard')
PITCH_PATTERN_HEADER = 10
PITCH_PATTERN_COLUMNS = 9


def generate_pitch_patterns() -> None:
    """
    data/pitchpattern_{easy,normal,hard}.arr (0x9ede0 · 0x9eeac, 위치 분석 5차).
    머리 10바이트(열 수 9 + 열 종류) 뒤 9바이트 행 72개 = (스트라이크, 볼, 아웃, 목표 종류 0~4 가중치 %, 주자 상황 열).
    """
    lines = []
    for difficulty in PITCH_PATTERN_DIFFICULTIES:
        raw = Path(f'base/work/jar/data/pitchpattern_{difficulty}.arr').read_bytes()
        body = raw[PITCH_PATTERN_HEADER:]
        if raw[0] != PITCH_PATTERN_COLUMNS or len(body) % PITCH_PATTERN_COLUMNS:
            raise ValueError(f'pitchpattern_{difficulty}.arr 형식이 예상과 다릅니다')
        rows = [list(body[i:i + PITCH_PATTERN_COLUMNS]) for i in range(0, len(body), PITCH_PATTERN_COLUMNS)]
        lines.append(f'  {difficulty}: {rows},')
    body = [
        '/**',
        ' * 원본 data/pitchpattern_*.arr — 행 = [스트라이크, 볼, 아웃, w0, w1, w2, w3, w4, 주자열].',
        ' * 주자열: 1 주자 있고 2사 아님 · 2 주자 있고 2사 · 3 주자 없음. w 는 목표 종류 0~4 의 % 가중치.',
        ' */',
        "export type PitchPatternDifficulty = 'easy' | 'normal' | 'hard'",
        '',
        'export const PITCH_PATTERNS: Readonly<Record<PitchPatternDifficulty, readonly (readonly number[])[]>> = {',
        *lines,
        '}',
    ]
    write('pitchPatterns.ts', '\n'.join(body) + '\n')


# ── CPU 타자 행동 확률표 (data/battingPattern.arr) ─────────────
# 512바이트 = 머리 8(열 수 7 + 열 종류 7) + 7바이트 행 72개.
# 행 = [스트라이크, 볼, 아웃, c0 치기, c1 번트, c2 지켜보기, 주자열]. 모든 행 c0+c1+c2 = 100.
#   적재 0x9f074(생성자 0x9f0d0 ← 경기 장면 0x3e340) · 행 찾기 0x9f11c(S·B·O·주자열이 모두 같은 첫 행)
#   상황 넣기 0x9f190(주자열 = 주자 없음 3 / 2사 2 / 그 밖 1) · 뽑기 0x9f224(r = rand(0,100))
#   쓰는 곳 0x34334 = CPU 타자 행동 결정 (근거: L-sound-effects.md 4-C · Q1-cpu-offense-ai.md 1b·6절)
BATTING_PATTERN_FILE = Path('base/work/jar/data/battingPattern.arr')
BATTING_PATTERN_HEADER = 8
BATTING_PATTERN_COLUMNS = 7
BATTING_PATTERN_ROW_COUNT = 72


def generate_batting_patterns() -> None:
    """CPU 타자가 치기·번트·지켜보기를 고르는 원본 확률표."""
    raw = BATTING_PATTERN_FILE.read_bytes()
    body_bytes = raw[BATTING_PATTERN_HEADER:]
    if raw[0] != BATTING_PATTERN_COLUMNS or len(body_bytes) != BATTING_PATTERN_COLUMNS * BATTING_PATTERN_ROW_COUNT:
        raise ValueError('battingPattern.arr 형식이 예상과 다릅니다')
    rows = [
        list(body_bytes[i * BATTING_PATTERN_COLUMNS:(i + 1) * BATTING_PATTERN_COLUMNS])
        for i in range(BATTING_PATTERN_ROW_COUNT)
    ]
    for row in rows:
        if row[3] + row[4] + row[5] != 100:
            raise ValueError(f'battingPattern.arr 행 합이 100이 아닙니다: {row}')
    body = [
        '/**',
        ' * 원본 data/battingPattern.arr — CPU 타자의 행동 확률표 (적재 0x9f074, 쓰는 곳 0x34334).',
        ' * 행 = [스트라이크, 볼, 아웃, 치기 %, 번트 %, 지켜보기 %, 주자열]. 세 확률의 합은 늘 100 이다.',
        ' * 주자열: 1 주자 있고 2사 아님 · 2 주자 있고 2사 · 3 주자 없음 (0x9f190).',
        ' */',
        f'export const BATTING_PATTERNS: readonly (readonly number[])[] = {rows}',
        '',
        "export type BattingPatternChoice = '치기' | '번트' | '지켜보기'",
        '',
        '/** 행에서 꺼낸 확률 — 0x9f224 가 rand(0,100) 한 번으로 고른다 */',
        'export interface BattingPatternOdds {',
        '  /** 치기 % (c0) */',
        '  readonly swing: number',
        '  /** 번트 % (c1) */',
        '  readonly bunt: number',
        '  /** 지켜보기 % (c2) */',
        '  readonly take: number',
        '}',
        '',
        '/** 주자열 고르기 (0x9f190) — 주자 없음 3 · 2사 2 · 그 밖 1 */',
        'export function battingPatternRunnerColumn(outs: number, hasRunner: boolean): number {',
        '  if (!hasRunner) return 3',
        '  return outs === 2 ? 2 : 1',
        '}',
        '',
        '/**',
        ' * 상황 → 확률 (행 찾기 0x9f11c). 원본은 72행을 앞에서부터 훑어 처음 맞는 행을 쓴다.',
        ' * 볼카운트가 표에 없는 값이면 원본도 찾지 못하므로 첫 행으로 근사한다 — **근사다**.',
        ' */',
        'export function battingPatternOdds(',
        '  strikes: number,',
        '  balls: number,',
        '  outs: number,',
        '  hasRunner: boolean,',
        '): BattingPatternOdds {',
        '  const column = battingPatternRunnerColumn(outs, hasRunner)',
        '  const row =',
        '    BATTING_PATTERNS.find(',
        '      (candidate) =>',
        '        candidate[0] === strikes &&',
        '        candidate[1] === balls &&',
        '        candidate[2] === outs &&',
        '        candidate[6] === column,',
        '    ) ?? BATTING_PATTERNS[0]',
        '  return { swing: row[3], bunt: row[4], take: row[5] }',
        '}',
        '',
        '/** 뽑기 0x9f224 — roll = rand(0, 100) */',
        'export function battingPatternChoiceOf(odds: BattingPatternOdds, roll: number): BattingPatternChoice {',
        "  if (roll < odds.swing) return '치기'",
        "  if (roll < odds.swing + odds.bunt) return '번트'",
        "  return '지켜보기'",
        '}',
    ]
    write('battingPatterns.ts', '\n'.join(body) + '\n')


# ── 경기 밸런스 표 (data/d_level.dat) ─────────────────────────
# 488바이트. 적재 0xb7370 / 0xb7414 / 0x7262c, 읽기 실패 시 폴백 0xb6f28 과 값이 같다.
# **난이도 옵션이 아니다** — 파일 하나를 모든 모드가 쓴다 (L-sound-effects.md 4-D).
# 문서는 적재본 기준으로 주소를 적는다: **객체 오프셋 = 파일 오프셋 + 4**.
# 아래 상수는 전부 **파일 오프셋**이고, 주석에 괄호로 객체 오프셋을 적어 둔다.
D_LEVEL_FILE = Path('base/work/jar/data/d_level.dat')
D_LEVEL_SIZE = 488

# 필살타법·마구 보정표 (0x34d6c). 육성·명전 선수는 기술 번호 n = 번호−1 (4칸),
# 마선수는 k = 레벨×5 + 순번 (25칸, 다섯 명 값이 같다). 근거 H2-special-skills.md 2절.
D_LEVEL_BURST_STEPS = 4
D_LEVEL_ACE_STEPS = 25


def read_d_level() -> bytes:
    raw = D_LEVEL_FILE.read_bytes()
    if len(raw) != D_LEVEL_SIZE:
        raise ValueError(f'd_level.dat 크기가 {D_LEVEL_SIZE} 가 아닙니다: {len(raw)}')
    return raw


def d_u16(raw: bytes, offset: int) -> int:
    return int.from_bytes(raw[offset:offset + 2], 'little')


def d_u16_list(raw: bytes, offset: int, count: int) -> list[int]:
    return [d_u16(raw, offset + 2 * i) for i in range(count)]


def d_s8_list(raw: bytes, offset: int, count: int) -> list[int]:
    return [int.from_bytes(raw[offset + i:offset + i + 1], 'little', signed=True) for i in range(count)]


def generate_d_level() -> None:
    """data/d_level.dat 를 통째로 읽어 이름을 붙인다 — 손으로 옮겨 적지 않는다."""
    raw = read_d_level()
    burst = lambda offset: d_u16_list(raw, offset, D_LEVEL_BURST_STEPS)
    ace = lambda offset: d_u16_list(raw, offset, D_LEVEL_ACE_STEPS)
    burst_pct = lambda offset: d_s8_list(raw, offset, D_LEVEL_BURST_STEPS)
    ace_pct = lambda offset: d_s8_list(raw, offset, D_LEVEL_ACE_STEPS)
    body = [
        '/**',
        ' * 원본 data/d_level.dat (488바이트) — **경기 밸런스 설정표**. 난이도 옵션이 아니라',
        ' * 파일 하나를 모든 모드가 쓴다 (적재 0xb7370 · 폴백 0xb6f28 과 값이 같다).',
        ' * 문서의 주소는 적재본 기준이라 **객체 오프셋 = 파일 오프셋 + 4** 다.',
        ' * 아래 주석의 0x.. 는 파일 오프셋이다.',
        ' */',
        'export const D_LEVEL = {',
        '  /** 스윙 타이밍 0x34be0 — max(바닥, 배율 × (폭 − 벌점) / 폭) */',
        f'  swingTiming: {{ floor: {d_u16(raw, 0x0C)}, scale: {d_u16(raw, 0x0E)} }}, // 0x0c · 0x0e',
        '  /** 주자 스타트 판정 기준 (0xa092c: 주루×7/100 + 이 값, ÷250) */',
        f'  runnerLeadBase: {d_u16(raw, 0x10)}, // 0x10',
        '  fielding: {',
        '    /** 모든 야수 같은 달리기 속도 (0xa2164) */',
        f'    runSpeed: {d_u16(raw, 0x14)}, // 0x14',
        '    /** 송구 속도 = 기본 + 등급배수 × (수비등급 + 1) */',
        f'    throwSpeedBase: {d_u16(raw, 0x16)}, // 0x16',
        f'    throwSpeedPerGrade: {d_u16(raw, 0x26)}, // 0x26',
        '    /** 이동 능력 = 배수 × (수비등급 + 1) */',
        f'    movePerGrade: {d_u16(raw, 0x24)}, // 0x24',
        '    /** 에러 값 = 기준 − 수비등급 + 8 (= 10 − 등급) */',
        f'    errorBase: {d_u16(raw, 0x28)}, // 0x28',
        '    /** 송구 공 중력 배율 % — 내야(칸 ≤ 5) · 외야 */',
        f'    infieldThrowGravityPercent: {d_u16(raw, 0x18)}, // 0x18',
        f'    outfieldThrowGravityPercent: {d_u16(raw, 0x1A)}, // 0x1a',
        '    /** 포구 → 송구 지연 틱 (내야는 중계 뒤 재송구 지연도 같다) */',
        f'    infieldReleaseTicks: {d_u16(raw, 0x1C)}, // 0x1c',
        f'    outfieldReleaseTicks: {d_u16(raw, 0x1E)}, // 0x1e',
        '    /** 중계 문턱 거리 (0xaf3d4 가 미정렬 u32 로 읽지만 0x40 이 0 이라 이 값) */',
        f'    relayDistance: {d_u16(raw, 0x3E)}, // 0x3e',
        '  },',
        '  /** 투구마다 rand(0,10000) 로 보는 폭투·포일 (0.1%) — 홈런더비 제외 */',
        f'  wildPitchChance: {d_u16(raw, 0x2A)}, // 0x2a (분모 10000)',
        '  /** 투수 교체 확률 % (0xac360) — 평소 · 9회 · 8회 · 지고 있음 · 주자 2명 이상 · 1점 차 리드 */',
        f'  reliefChances: {d_s8_list(raw, 0x36, 6)}, // 0x36~0x3b',
        '  /** 타격 판정 0xab214 — 마선수(ace) · 일반(normal) 식 */',
        '  swing: {',
        f'    aceFormula: {{ hitBase: {d_u16(raw, 0x42)}, hitCoefficient: {d_u16(raw, 0x44)},'
        f' extraBase: {d_u16(raw, 0x46)}, extraCoefficient: {d_u16(raw, 0x48)},'
        f' contactFactor: {d_u16(raw, 0x4A)} }}, // 0x42~0x4a',
        f'    normalFormula: {{ hitBase: {d_u16(raw, 0x4C)}, hitCoefficient: {d_u16(raw, 0x4E)},'
        f' extraBase: {d_u16(raw, 0x50)}, extraCoefficient: {d_u16(raw, 0x52)},'
        f' contactFactor: {d_u16(raw, 0x54)} }}, // 0x4c~0x54',
        f'    hitWeight: {raw[0x56]}, // 0x56',
        f'    extraWeight: {raw[0x57]}, // 0x57',
        f'    powerPivot: {raw[0x58]}, // 0x58',
        f'    foulPercent: {raw[0x59]}, // 0x59',
        f'    outPercent: {raw[0x5A]}, // 0x5a',
        '    /** 마선수 보너스 — 타자 기본·레벨당 · 투수 기본·레벨당 */',
        f'    aceBonus: {{ batterBase: {d_u16(raw, 0x1D4)}, batterPerLevel: {d_u16(raw, 0x1D6)},'
        f' pitcherBase: {d_u16(raw, 0x1D8)}, pitcherPerLevel: {d_u16(raw, 0x1DA)} }}, // 0x1d4~0x1da',
        '    /** 제구 등급 → 투수 능력 배율 % */',
        f'    pitchGradeMultipliers: {d_u16_list(raw, 0x1DC, 6)}, // 0x1dc~0x1e6',
        '  },',
        '  /**',
        '   * 필살타법·마구 보정 (0x34d6c → 0xab214 에 넘기는 12바이트).',
        '   * `burst*` 는 육성·명전 선수의 기술 번호 1~4 (색인 = 번호 − 1),',
        '   * `ace*` 는 마선수의 레벨×5 + 순번 (25칸, 다섯 명 값이 같다).',
        '   * ⚠️ 원본 그대로: 마구의 solid·homeRun % 는 투수가 아니라 **타자** 쪽에 더해진다.',
        '   */',
        '  boost: {',
        f'    burstBatterHit: {burst(0x78)}, // 0x78',
        f'    burstBatterPower: {burst(0x80)}, // 0x80',
        f'    burstBatterSolidPercent: {burst_pct(0x19A)}, // 0x19a',
        f'    burstBatterHomeRunPercent: {burst_pct(0x19E)}, // 0x19e',
        f'    magicPitchControl: {burst(0x88)}, // 0x88',
        f'    magicPitchSpeed: {burst(0x90)}, // 0x90',
        f'    magicPitchSolidPercent: {burst_pct(0x160)}, // 0x160',
        f'    magicPitchHomeRunPercent: {burst_pct(0x164)}, // 0x164',
        f'    aceBatterHit: {ace(0xFC)}, // 0xfc',
        f'    aceBatterPower: {ace(0x12E)}, // 0x12e',
        f'    aceBatterSolidPercent: {ace_pct(0x1A2)}, // 0x1a2',
        f'    aceBatterHomeRunPercent: {ace_pct(0x1BB)}, // 0x1bb',
        f'    acePitcherControl: {ace(0x98)}, // 0x98',
        f'    acePitcherSpeed: {ace(0xCA)}, // 0xca',
        f'    acePitcherSolidPercent: {ace_pct(0x168)}, // 0x168',
        f'    acePitcherHomeRunPercent: {ace_pct(0x181)}, // 0x181',
        '  },',
        '} as const',
        '',
        '/** 아직 이름을 못 붙인 칸까지 남김없이 — d_level.dat 488바이트 그대로 */',
        f'export const D_LEVEL_RAW: readonly number[] = {list(raw)}',
    ]
    write('dLevel.ts', '\n'.join(body) + '\n')


# ── 원본 수치표 balance.json ───────────────────────────────────
# d_level.dat 에서 오는 값은 **파일을 직접 읽는다**. 그 밖은 binary.mod 디스어셈으로 확인한
# 리터럴이라 여기에 적어 두고 source 에 주소를 남긴다 (근거 없는 값은 source 에 "추정").
BALANCE_LITERALS = {
    'ability': {
        'maximum': 999,
        'rookieByBattingType': [
            {'hit': 100, 'power': 100, 'defense': 100, 'run': 100},
            {'hit': 80, 'power': 150, 'defense': 80, 'run': 80},
        ],
        'rookiePositionBonus': 30,
        'source': '상한 0xc1b38 · 신인 표 0xcc3fa · 포지션 보너스 0x16e2c (포지션 뜻은 추정)',
    },
    'rookie': {
        'popularity': 0, 'reputation': 300, 'morale': 100, 'salary': 50,
        'money': 6000, 'gamePoint': 0, 'skillIds': [0, 8],
        'source': ('0x11244~0x112d2 직접 디스어셈. 연봉 50(0x32)·소지금 60(0x3c)·인기도 0·평판 300(0x96<<1)'
                   '·사기 100(0x64). G포인트를 넣는 명령이 없어 0 이다'),
    },
    'limits': {
        'morale': 100, 'popularity': 9999, 'reputation': 999, 'affection': 100,
        'gamePoint': 99999, 'moneyUnits': 9999, 'nameBytes': 8,
        'source': '인기도·평판 0xd4e50 점프표 · 소지금 0x1b768 · G포인트 0x4ea0c',
    },
    'money': {'unit': 100, 'source': '원본 소지금·연봉 한 칸 = 100만원 (관리 화면 0x63118)'},
    'season': {
        'gamesPerSeason': 45, 'gamesPerManagementCycle': 2,
        'source': '45경기 0xb818c · 관리 주기 r_event_txt[176]',
    },
    'training': {
        'gainRange': {'minimum': 4, 'maximumExclusive': 7},
        'legGainRange': {'minimum': 5, 'maximumExclusive': 8},
        'moraleLossRange': {'minimum': 5, 'maximumExclusive': 8},
        'typeBonus': 1, 'rookieSkillId': 0, 'weakBodySkillId': 3,
        'source': '0x17f5c · 히트/파워 bfa55(4,7) · 수비/주루 0x18704 · 타입 보너스 StrMODE[194] · 스킬 0x1891c·0x1898e',
    },
    'specialSwing': {
        'requiredSessions': [4, 5, 6, 7],
        'gamePointCost': [500, 700, 900, 1200],
        'moraleLossRange': {'minimum': 9, 'maximumExclusive': 13},
        'source': '0xa3bac 종류 4 — 필요 횟수 0xd7e92 · 비용 0xd80e1(−5,−7,−9,−12 ×100)',
    },
    'coldGame': {
        'fromInning': 7, 'margin': 10,
        'source': '0xb68fc — 이닝 인덱스 > 5 부터. 말 공격 중에는 아웃 수와 무관하게 매 타석 본다 (0xb6976)',
    },
}

# 기록달성 금액표 0xcfbf8 (경기 중 누계표 0xd8158 과 값이 같다)
BALANCE_RECORD_GAME_POINTS = [
    10, 8, 10, 12, 15, 10, 20, 40, 2, 5, 15, 30, 5, 20, 40, 100, 2, 3, 5, 20,
    40, 10, 20, 40, 3, 5, 2, 100, 10, 20, 100, 120, 3, 5, 5, 8, 3, 10, 20, 40,
]

# 간이 타석 0xc11f0 의 리터럴 — d_level.dat 이 아니라 함수 리터럴 풀에 있다
BALANCE_QUICK_AT_BAT_LITERALS = {
    'basePower': 75,
    'spreadRange': {'minimum': -13, 'maximumExclusive': 21},
    'weakSwingGate': 2999,
    'tightCourseGate': 1499,
    'tightCourseGain': 3,
    'extraBaseLimit': 666,
    'extraInningFrom': 10,
    'extraInningPowerStep': 5,
    'extraInningPowerFloor': 50,
}
BALANCE_QUICK_AT_BAT_GRADE_TABLE = [
    [5, 15, 70, 97, 100],
    [4, 12, 60, 95, 100],
    [3, 9, 50, 93, 100],
    [2, 5, 45, 91, 100],
]

# 0xab214 안의 함수 리터럴 — d_level.dat 에는 없다 (파일 전체를 훑어 확인했다)
BALANCE_SWING_CODE_LITERALS = {
    'missionAcePitcherBonus': 100,
    'solidCap': 9000,
    'homeRunCap': 4500,
    'swingStrengthBonus': 500,
    'exhaustedBonus': 2000,
}


def generate_balance() -> None:
    """
    원본 수치표. **d_level.dat 에서 오는 값은 파일을 직접 읽는다** (예전에는 손으로 옮겨 적었다).
    파일 오프셋 ↔ 문서의 객체 오프셋은 +4 만큼 어긋난다 — source 에는 파일 오프셋을 적는다.
    """
    raw = read_d_level()
    formula = lambda offset: {
        'hitBase': d_u16(raw, offset),
        'hitCoefficient': d_u16(raw, offset + 2),
        'extraBase': d_u16(raw, offset + 4),
        'extraCoefficient': d_u16(raw, offset + 6),
        'contactFactor': d_u16(raw, offset + 8),
    }
    value = {
        'note': "원본 수치표. 값마다 binary.mod 주소를 source 에 적었다. 근거가 없는 것은 source 에 '추정' 이라고 적는다.",
        'ability': BALANCE_LITERALS['ability'],
        'rookie': BALANCE_LITERALS['rookie'],
        'limits': BALANCE_LITERALS['limits'],
        'money': BALANCE_LITERALS['money'],
        'season': BALANCE_LITERALS['season'],
        'training': BALANCE_LITERALS['training'],
        'specialSwing': BALANCE_LITERALS['specialSwing'],
        'recordGamePoints': BALANCE_RECORD_GAME_POINTS,
        'recordGamePointsSource': '기록달성 금액표 0xcfbf8 (경기 중 누계표 0xd8158 과 값이 같다). 이름은 StrGAME[id+8]',
        'swing': {
            'note': '타격 판정 0xab214 가 쓰는 값. 함수 리터럴이 아니라 data/d_level.dat 에 있고, 폴백 0xb6f28 과 값이 같다',
            'aceFormula': formula(0x42),
            'normalFormula': formula(0x4C),
            'hitWeight': raw[0x56],
            'extraWeight': raw[0x57],
            'powerPivot': raw[0x58],
            'foulPercent': raw[0x59],
            'outPercent': raw[0x5A],
            'aceBonus': {
                'batterBase': d_u16(raw, 0x1D4),
                'batterPerLevel': d_u16(raw, 0x1D6),
                'pitcherBase': d_u16(raw, 0x1D8),
                'pitcherPerLevel': d_u16(raw, 0x1DA),
            },
            'missionAcePitcherBonus': BALANCE_SWING_CODE_LITERALS['missionAcePitcherBonus'],
            'pitchGradeMultipliers': d_u16_list(raw, 0x1DC, 6),
            'solidCap': BALANCE_SWING_CODE_LITERALS['solidCap'],
            'homeRunCap': BALANCE_SWING_CODE_LITERALS['homeRunCap'],
            'swingStrengthBonus': BALANCE_SWING_CODE_LITERALS['swingStrengthBonus'],
            'exhaustedBonus': BALANCE_SWING_CODE_LITERALS['exhaustedBonus'],
            'source': ('data/d_level.dat 파일 오프셋 0x42~0x5a · 0x1d4~0x1e6 을 생성기가 직접 읽는다 '
                       '(문서의 객체 오프셋 0x46~0x5e · 0x1d8~0x1e0 = 파일 + 4). '
                       'missionAcePitcherBonus·solidCap·homeRunCap·swingStrengthBonus·exhaustedBonus 는 '
                       '0xab214 안의 함수 리터럴이라 파일에 없다'),
        },
        'quickAtBat': {
            'note': '간이 타석 0xc11f0 — 사람이 조작하지 않는 타석',
            **BALANCE_QUICK_AT_BAT_LITERALS,
            'powerScale': {'minimum': d_u16(raw, 0x0C), 'maximumValue': d_u16(raw, 0x0E)},
            'pitchGradeTable': BALANCE_QUICK_AT_BAT_GRADE_TABLE,
            'pitchGradeBand': 250,
            'source': ('리터럴 풀 0xc1580(10000)·0xc1584(2999)·0xc1590(1499)·0xc1804(666) · 등급표 0xd896c · '
                       'powerScale 은 data/d_level.dat 파일 0x0c·0x0e 를 직접 읽는다'),
        },
        'coldGame': BALANCE_LITERALS['coldGame'],
    }
    write_json('balance.json', value)


PITCHER_FORM_OFFSET = 0x0B
PITCHER_MAGIC_OFFSET = 0x18
PITCHER_PITCH_MASK_OFFSET = 0x1C


def pitcher_repertoire_of(row_hex: str) -> tuple[int, int, int]:
    """선수 레코드 → (폼 니블 +0xb>>4, 마구 번호 +0x18, 보유 구질 비트마스크 u32 +0x1c)"""
    import struct as _struct
    row = bytes.fromhex(row_hex)
    return (
        row[PITCHER_FORM_OFFSET] >> 4,
        row[PITCHER_MAGIC_OFFSET],
        _struct.unpack_from('<I', row, PITCHER_PITCH_MASK_OFFSET)[0],
    )


def generate_pitcher_repertoires() -> None:
    """투수 레코드의 폼·마구·보유 구질 (0xb6e24 · 0xb6d2c, 위치 분석 5차). 마선수 투수 5명 + 일반 투수 120명."""
    lines = []
    for label, table in (('ACE_PITCHER_REPERTOIRES', 'XlsACE_PIT_DATA'), ('ROSTER_PITCHER_REPERTOIRES', 'XlsPITCHER_DATA')):
        data = load(table)
        items = []
        for name, row in zip(data['names'], data['rows']):
            if not name.strip():
                continue
            form, magic, mask = pitcher_repertoire_of(row)
            items.append(f'  {{ name: {quote(name)}, form: {form}, magicId: {magic}, pitchMask: {mask} }},')
        lines += [f'export const {label}: readonly PitcherRepertoire[] = [', *items, ']', '']
    body = [
        '/** 투수 레코드 — 폼 니블(+0xb>>4), 마구 번호(+0x18, 0 = 없음), 보유 구질 비트마스크(+0x1c, 비트 t−1 = 구질 t) */',
        'export interface PitcherRepertoire {',
        '  readonly name: string',
        '  readonly form: number',
        '  readonly magicId: number',
        '  readonly pitchMask: number',
        '}',
        '',
        *lines,
    ]
    write('pitcherRepertoires.ts', '\n'.join(body))


SKY_ROW_COUNT = 6
SKY_COLUMN_COUNT = 13
SKY_COLOR_COUNT = 10


def generate_stadium_scene() -> None:
    """
    타석 화면 배경 표 (위치 분석 6차).
        하늘 0x77fe8 — 색 번호 표 0xd37a4[행 × 13 + 열], 색 쌍 표 0xd37f2[번호] = (위 RGB, 아래 RGB)
        펜스 0x77974 — stadium/fence.pzf 프레임의 박스 0·1 = 팀 아이콘, 박스 2 = 전광판
    """
    import sys as _sys
    _sys.path.insert(0, str(Path(__file__).parent))
    from decode_pzx import read_section
    import struct as _struct
    rows = read_binary_table(0xD37A4, f'<{SKY_ROW_COUNT * SKY_COLUMN_COUNT}B')
    colors = read_binary_table(0xD37F2, f'<{SKY_COLOR_COUNT * 6}B')
    fence_raw = Path('base/work/jar/stadium/fence.pzf').read_bytes()
    boxes = []
    for block in read_section(fence_raw, 4, len(fence_raw)):
        frame_boxes = [list(_struct.unpack_from('<hhhh', block, 2 + 8 * k)) for k in range(block[1])]
        boxes.append(frame_boxes)
    sky_rows = [rows[r * SKY_COLUMN_COUNT:(r + 1) * SKY_COLUMN_COUNT] for r in range(SKY_ROW_COUNT)]
    sky_colors = [colors[i * 6:i * 6 + 6] for i in range(SKY_COLOR_COUNT)]
    body = [
        '/** 하늘 색 번호 — SKY_COLOR_ROWS[행][min(이닝, 12)] (표 0xd37a4, 행 6개) */',
        f'export const SKY_COLOR_ROWS: readonly (readonly number[])[] = {sky_rows}',
        '',
        '/** 하늘 색 쌍 [위 R, G, B, 아래 R, G, B] (표 0xd37f2) */',
        f'export const SKY_COLOR_PAIRS: readonly (readonly number[])[] = {sky_colors}',
        '',
        '/** 구장 펜스 프레임별 박스 [x, y, 폭, 높이] — 0·1 팀 아이콘, 2 전광판 (fence.pzf) */',
        f'export const FENCE_BOXES: readonly (readonly (readonly number[])[])[] = {boxes}',
    ]
    write('stadiumScene.ts', '\n'.join(body) + '\n')


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    print('생성:')
    generate_ace_players()
    generate_roster()
    generate_teams()
    generate_string_list('StrNICKNAME', 'ORIGINAL_TITLES', 'titles.ts', '칭호')
    generate_skills()
    generate_year_goals()
    generate_string_list('StrITEM', 'ORIGINAL_ITEMS', 'items.ts', '아이템 이름')
    generate_string_list('StrENDING', 'ORIGINAL_ENDINGS', 'endings.ts', '엔딩 전문')
    generate_string_list('StrTIP', 'ORIGINAL_TIPS', 'tips.ts', '로딩 팁')
    generate_string_list('StrHOWTO', 'ORIGINAL_HOWTO', 'howto.ts', '게임 내 도움말')
    generate_string_list('StrUSER_EVT', 'ORIGINAL_USER_EVENTS', 'userEvents.ts', '경기 후 평가·목표·연속 기록 문구')
    generate_string_list('StrMODE', 'ORIGINAL_MODE_TEXT', 'modeText.ts', '모드 화면 문구 (관리·상점·시즌·투수편 팝업)')
    generate_bursts()
    generate_burst_missions()
    generate_mode_menus()
    generate_missions()
    generate_pitch_types()
    generate_events()
    generate_batted_ball_patterns()
    generate_pitch_curves()
    generate_trigonometry_tables()
    generate_pitch_patterns()
    generate_batting_patterns()
    generate_pitcher_repertoires()
    generate_stadium_scene()
    generate_d_level()
    generate_balance()


main()
