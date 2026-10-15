import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import { BATTERS, PITCHERS } from '@/shared/config/original/roster'
import { ORIGINAL_SKILLS } from '@/shared/config/original/skills'
import { leagueBatterIdOf, leaguePitcherIdOf } from '@/entities/league/model/leaguePlayerStats'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { substitutionDetailAbilities, substitutionStaminaOf } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamEntryBatter, TeamEntryPitcher } from '@/features/play-team-game/model/teamGameRoster'
import { NO_ROSTER_SLOT } from '@/features/play-team-game/model/teamGameRoster'
import { aceBatterProfileOf } from '@/widgets/matchup-cards/lib/matchupRecord'
import { batterPositionBadgeOf, pitcherRoleBadgeOf } from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import { batterProfileOf, teamBatterHandOf } from '@/pages/team-game/lib/teamMatchupCards'
import type { TeamMatchupRecords } from '@/pages/team-game/lib/teamMatchupCards'
import { teamBatterSeasonStatsOf, teamPitcherSeasonStatsOf } from '@/pages/team-game/lib/teamMatchupCards'

/**
 * **교체 창 — 경기 상태 0xb** (진입 0x3ae08 · 키 0x495fc · 그리기 0x4db68 → 0x384b8). 2026-10-14 unicorn 으로 0x384b8 · 0x37904 ·
 * 0x37e5c · 0x37dd4 · 0x571d8 · 0x5b798 · 0x5aefc 를 그대로 돌려 그리기 인자를 받았다(240×320).
 * ```
 * 0x384b8
 *   공용 판 0x55e61(skin, W/2, H/2, 192, 210, 0, 0x22, 위 띠 16, 아래 띠 0, 제목 탭 1, 어둡게 1)      → (24, 55)
 *   game_ui 이미지 50 ▲ (W/2 − 6, H/2 − 115) · 51 ▼ (W/2 − 6, H/2 + 107) — 틱 [장면+0x2c] % 8 ≤ 3 이면 2px 바깥(43 · 269)
 *   사람 팀 큰 로고(장면 +0x104c 측 0 · +0x1050 측 1 — st[0x31] == 0 이면 측 0) 0xbb91d(로고, W/2 − w·15/20, H/2 − h·15/20 + 35,
 *     종류 0x12(2 크기 · 0x10 섞기), 15, 25) — 1.5 배 · 섞기 0xbb8d4(그림 × (32 − 25) + 바탕 × 25) / 32
 *   제목 img_text 150 "투수"(투수 교체) · 149 "타자"(대타)를 팔레트 3 으로 (41, 60), 팔레트 0 으로 299 "교체" 를 (65, 60)
 *   지금 선수 칸 0x37904(장면, 29, 74, 투수?) · "CHANGE" game_ui 애니 0(프레임 41~43, 지연 4, 돌림)을 (50, 122)
 *   벤치 목록 0x37e5c(장면, 29, 154, 투수?) — 6 줄 · 커서 상자 0x37dd4 · 상세 창 0x5b798
 *   game_ui 이미지 12(41×12)를 (W/2 − 20, H − 13) · img_text 프레임 167 "0 INFO" 를 (W/2 − 15, H − 10)
 * ```
 * 칸 배치(0x37904 · 0x37e5c): 칸 x = 29 + 6 = 35 에서 칸마다 폭 + 3 — 이름 54(game_ui 28) · 나머지 36(game_ui 35).
 * 머리 0x5650c 는 game_ui 24 · 34 의 크기로 (x, y − 2, w, 15) 안 가운데에 img_text 표 0xcfe7e
 * (투수 27 이름 · 28 보직 · 171 방어 · 181 삼진 / 타자 27 · 28 · 172 타율 · 61 홈런)를 팔레트 0 으로 그린다. 값 줄은 머리 + 15 + 3.
 * 벤치 줄은 154 에서 18 씩.
 */
export const SUBSTITUTION_WINDOW = {
  panel: { x: 24, y: 55, width: 192, height: 210, topBand: 16, bottomBand: 0 },
  title: { firstX: 41, secondX: 65, y: 60, pitcherFrame: 150, batterFrame: 149, changeFrame: 299 },
  arrows: { x: 114, upImage: 50, downImage: 51, upY: [43, 45], downY: [269, 267] },
  logo: { centerX: 120, centerY: 195, scale: 1.5, opacity: 7 / 32 },
  current: { headerY: 75, cellY: 95 },
  bench: { firstY: 154, step: 18, visibleRows: 6 },
  columnX: [35, 92, 131, 170],
  columnWidth: [54, 36, 36, 36],
  cellHeight: 15,
  nameCellFrame: 28,
  valueCellFrame: 35,
  /** 0x37dd4 — 커서 상자 (칸 x, y, 폭 합 + 9, 15) */
  cursorBox: { x: 35, width: 171, height: 15 },
  change: { x: 50, y: 122, frames: [41, 42, 43], delay: 4 },
  info: { image: 12, x: 100, y: 307, width: 41, height: 12, textFrame: 167, textX: 105, textY: 310 },
} as const

/** 머리 글 img_text — 표 0xcfe7e */
export const HEADER_TEXT_FRAMES = { pitcher: [27, 28, 171, 181], batter: [27, 28, 172, 61] } as const

/** 틱 [장면+0x2c] % 8 ≤ 3 — 화살이 2px 바깥 · 커서 상자는 노란 안쪽 (0x384b8 · 0x37dd4) */
export const isBlinkOut = (tick: number) => (((tick % 8) + 8) % 8) <= 3

/**
 * 커서 상자 0x37dd4 — 틱 % 8 ≤ 3 이면 둥근 테두리 0x6aa64(x + 1, y + 1, w − 2, h − 2, 1, 0x80FFFF00 반투명 노랑),
 * 아니면 (x, y, w, h, 1, 빨강 #FF0000).
 */
export function cursorBoxOf(rowY: number, tick: number): { x: number; y: number; width: number; height: number; color: string; opacity: number } {
  const box = SUBSTITUTION_WINDOW.cursorBox
  return isBlinkOut(tick)
    ? { x: box.x + 1, y: rowY + 1, width: box.width - 2, height: box.height - 2, color: '#FFFF00', opacity: 0x80 / 0xff }
    : { x: box.x, y: rowY, width: box.width, height: box.height, color: '#FF0000', opacity: 1 }
}

/** 둥근 테두리 0x6aa64(둥글기 ≤ 3) — 선 넷 (`commonPanel` 의 roundEdge 와 같은 식) */
export function roundEdgeRectsOf(x: number, y: number, w: number, h: number): { x: number; y: number; width: number; height: number }[] {
  return [
    { x: x + 1, y, width: w - 1, height: 1 },
    { x: x + 1, y: y + h, width: w - 1, height: 1 },
    { x, y: y + 1, width: 1, height: h - 1 },
    { x: x + w, y: y + 1, width: 1, height: h - 1 },
  ]
}

/** "CHANGE" 애니 0 — 지연 4 의 세 칸 돌림 (0x93cfd(애니, 1) · 그릴 때마다 0x93d91 한 칸) */
export const changeFrameAt = (draw: number) =>
  SUBSTITUTION_WINDOW.change.frames[Math.floor(Math.max(0, draw) / SUBSTITUTION_WINDOW.change.delay) % SUBSTITUTION_WINDOW.change.frames.length]

/** 칸 4 개 중 둘째 칸의 딱지 — game_ui 프레임(칸 위에 겹침) · img_text 글자. 없으면 null */
export interface CellBadge {
  readonly chipFrame: number
  readonly label: number
}

/** 체력 줄 (0x571d8 투수 갈래) — 녹 #1C9300 최대 · 빨 #FF3C14 지금, 이름 칸 바닥 두 줄 */
export interface StaminaLines {
  readonly length: number
  readonly current: number
}

/** 타자 이름 칸 오른쪽 세로 두 줄 (0x571d8 타자 갈래) — 색은 +0xb & 3 (0 #89DB14 · 1 #FF3C14 · 2 #14B3DB) */
export const FIELDER_TYPE_COLORS: readonly string[] = ['#89DB14', '#FF3C14', '#14B3DB']

export interface SubstitutionRow {
  /** 명단 칸 */
  readonly index: number
  readonly name: string
  readonly badge: CellBadge | null
  /** 방어율 ×100 / 타율 ×1000 — 기록이 없으면 null (⚠️ 아래) */
  readonly rate: number | null
  /** 탈삼진 / 홈런 */
  readonly count: number | null
  readonly stamina: StaminaLines | null
  /** 타자 이름 칸 세로 줄 색 칸 (+0xb & 3) — 투수는 null */
  readonly fielderType: number | null
}

/**
 * 투수 체력 줄 길이 — 0x571d8 `L = trunc(trunc(M × (w × 100 − 400) / 1249) / 100)` · `R = trunc(S × L / 100)` (w = 54).
 * 녹 선 (x + 3, y + h − 2)~(x + 3 + L, …) 과 한 줄 아래, 빨 선 (x + 3)~(x + 3 + R) 두 줄.
 */
export function staminaLinesOf(capacity: number, percent: number, cellWidth = 54): StaminaLines {
  const length = Math.trunc(Math.trunc((capacity * (cellWidth * 100 - 400)) / 0x4e1) / 100)
  return { length, current: Math.trunc((percent * length) / 100) }
}

const benchBadgeOfFielderType = (type: number): CellBadge | null =>
  type === 0 ? { chipFrame: 37, label: 304 } : type === 1 ? { chipFrame: 36, label: 305 } : type === 2 ? { chipFrame: 39, label: 306 } : null

/** 보직 딱지 0x545e8 — 칸 = 0x20 + 칸 번호 (선발 36 · 중계 39 · 구원 37) */
function roleBadgeOf(role: number | undefined): CellBadge | null {
  if (role === undefined || role < 0 || role > 2) return null
  const badge = pitcherRoleBadgeOf(role, 0)
  return { chipFrame: 0x20 + badge.chip, label: badge.label }
}

function pitcherRowOf(progress: TeamGameProgress, records: TeamMatchupRecords | undefined, index: number): SubstitutionRow {
  const entry = progress.ourPitcherEntry[index]
  const stats = entry === undefined ? null : teamPitcherSeasonStatsOf(progress, records, progress.options.ourTeamId, entry)
  const stamina = substitutionStaminaOf(progress, index)
  return {
    index,
    name: entry?.name ?? '',
    badge: roleBadgeOf(entry?.role),
    // 0xb6ce9 — 100 보다 크면 ×10 해서 소수 셋 자리 (0x37b24)
    rate: stats?.earnedRunAverage ?? null,
    count: stats?.strikeouts ?? null,
    stamina: stamina === null ? null : staminaLinesOf(stamina.capacity, stamina.percent),
    fielderType: null,
  }
}

/** 타자 레코드 +0xb — 마타자는 마선수 표 */
function entryProfileOf(progress: TeamGameProgress, entry: TeamEntryBatter): number {
  if (entry.aceIndex >= 0) return aceBatterProfileOf(entry.aceIndex)
  return batterProfileOf(progress.options.ourTeamId, entry) ?? 0
}

function batterRowOf(progress: TeamGameProgress, records: TeamMatchupRecords | undefined, index: number, isCurrent: boolean): SubstitutionRow {
  const entry = progress.ourEntry[index]
  const stats = entry === undefined ? null : teamBatterSeasonStatsOf(progress, records, progress.options.ourTeamId, entry)
  const fielderType = entry === undefined ? 0 : entryProfileOf(progress, entry) & 3
  // 지금 타자 칸은 수비 위치 0x54590(+0x1c & 0xf), 벤치 줄은 +0xb & 3 (0x38240) — 두 함수가 다른 칸을 읽는다
  const position = entry === undefined ? null : batterPositionBadgeOf(entry.position, -1, -1)
  const badge = isCurrent
    ? (position === null || position.chip < 0 ? null : { chipFrame: 0x20 + position.chip, label: position.label })
    : benchBadgeOfFielderType(fielderType)
  return {
    index,
    name: entry?.name ?? '',
    badge,
    rate: stats?.battingAverage ?? null,
    count: stats?.homeRuns ?? null,
    stamina: null,
    fielderType,
  }
}

/**
 * 창의 줄 — 지금 선수(투수 `0xae83c` · 타자 `0xae89c`)와 벤치(`0xb8b09` · `0xb8b19`).
 * 방어율 · 탈삼진 / 타율 · 홈런 칸은 소개 판과 같은 시즌 줄(`teamPitcherSeasonStatsOf` · `teamBatterSeasonStatsOf`)이다 — 일반모드는
 * Xls 행의 줄, 마선수는 XlsACE 행의 줄. ⚠️ 남은 것: 대전(8 · 9)은 웹에 없고, 기록표가 없을 때의 표 밖 선수는 숫자를 비운다.
 */
export function substitutionRowsOf(
  progress: TeamGameProgress,
  kind: '투수' | '대타',
  benchIndexes: readonly number[],
  records: TeamMatchupRecords | undefined,
): { readonly current: SubstitutionRow; readonly bench: readonly SubstitutionRow[] } {
  if (kind === '투수') {
    return {
      current: pitcherRowOf(progress, records, progress.ourPitcherIndex),
      bench: benchIndexes.map((index) => pitcherRowOf(progress, records, index)),
    }
  }
  return {
    current: batterRowOf(progress, records, progress.game.battingOrderIndex, true),
    bench: benchIndexes.map((index) => batterRowOf(progress, records, index, false)),
  }
}

/**
 * 목록 0x6c4bd(목록, 1열, n줄, 1, 꼴 0x330) — 위 · 아래는 세로로 감고(꼴 0x20), 윗줄은 0x6c2bd 가 보이는 6 줄 안으로 맞춘다.
 */
export function movedListCursor(cursor: number, top: number, count: number, dy: number): { cursor: number; top: number } {
  if (count <= 0) return { cursor, top }
  const next = (cursor + dy + count) % count
  const visible = Math.min(count, SUBSTITUTION_WINDOW.bench.visibleRows)
  if (next >= top && next < top + visible) return { cursor: next, top }
  return { cursor: next, top: next - top > 0 ? next - visible + 1 : next }
}

/* ── 상세 창 0x5b798 ('0' INFO) ─────────────────────────────────────────────────────────── */

/**
 * '0' 키 0x49712 — 창 [skin+0x424] 를 켜며 (x, y, w, h) = (W/2 + 0x52, H/2 − 0x65, 7, 203), 걸음 [+0x426] = 1, [+0x425] = 0.
 * 그릴 때마다(0x5c8aa, 창을 다 그린 **뒤**) 걸음 ×= 2 · x −= 걸음 · w += 걸음, w > 105 면 끝: w = 106 · x = W/2 + 0x52 − 0x60 = 106 ·
 * [+0x425] = 1. 흐르는 글 · 능력치 도형은 끝난 뒤에만 그린다.
 */
export interface DetailWindowFrame {
  readonly x: number
  readonly width: number
  readonly isOpen: boolean
}

export const DETAIL_WINDOW = { startX: 202, startWidth: 7, finalX: 106, finalWidth: 106, y: 59, height: 203 } as const

/** 연 뒤 `draw` 번째(0 부터) 그림의 창 */
export function detailWindowFrameAt(draw: number): DetailWindowFrame {
  let x: number = DETAIL_WINDOW.startX
  let width: number = DETAIL_WINDOW.startWidth
  let step = 1
  for (let index = 0; index < draw; index += 1) {
    step *= 2
    x -= step
    width += step
    if (width > 105) return { x: DETAIL_WINDOW.finalX, width: DETAIL_WINDOW.finalWidth, isOpen: true }
  }
  return { x, width, isOpen: false }
}

/**
 * 창 틀 0x5476c → 0x5461c(skin, x, y, w, h) — 둥근 칠(x, y, w, h, 1, #081C4A) · 둥근 테두리(x+1, y+1, w−2, h−2, #335FCD) ·
 * 점 넷(x+2 · x+w−2, y+2 · y+h−2, #335FCD) · 둥근 칠(x+2, y+2, w−4, h−4, #FFFFFF) · 둥근 칠(x+4, y+4, w−8, h−8, #335FCD).
 * 안쪽은 0xbae25(x + 5, y + 5, w − 10, h − 10) 로 자른다.
 */
export const DETAIL_COLORS = { outer: '#081C4A', edge: '#335FCD', white: '#FFFFFF' } as const

/** 줄 — 칸 x = 창 x + 9 (game_ui 23, 25×15) · 값 칸 창 x + 39 (game_ui 28, 54×15). y 는 에뮬레이션으로 받은 값 그대로 */
export interface DetailRow {
  readonly labelFrame: number
  readonly cellY: number
  readonly labelY: number
  readonly textY: number
}

export const DETAIL_LABEL_DX = 9
export const DETAIL_VALUE_DX = 39
export const DETAIL_LABEL_CELL = 23
export const DETAIL_VALUE_CELL = 28

/** 투수(종류 3): 29 타입 · 30 손 · 34 구질(흐르는 글) · 33 스킬 · 32 마구 · 86 연봉 */
export const PITCHER_DETAIL_ROWS: readonly DetailRow[] = [
  { labelFrame: 29, cellY: 68, labelY: 67, textY: 68 },
  { labelFrame: 30, cellY: 86, labelY: 85, textY: 86 },
  { labelFrame: 34, cellY: 184, labelY: 183, textY: 184 },
  { labelFrame: 33, cellY: 202, labelY: 201, textY: 202 },
  { labelFrame: 32, cellY: 219, labelY: 219, textY: 220 },
  { labelFrame: 86, cellY: 238, labelY: 237, textY: 238 },
]

/** 타자(종류 2): 29 타입 · 30 손 · 33 스킬 · 35 필살 · 86 연봉 */
export const BATTER_DETAIL_ROWS: readonly DetailRow[] = [
  { labelFrame: 29, cellY: 68, labelY: 67, textY: 68 },
  { labelFrame: 30, cellY: 86, labelY: 85, textY: 86 },
  { labelFrame: 33, cellY: 202, labelY: 201, textY: 202 },
  { labelFrame: 35, cellY: 220, labelY: 219, textY: 220 },
  { labelFrame: 86, cellY: 238, labelY: 237, textY: 238 },
]

/** 능력치 도형 0x5aefc(…, 가운데 x = 창 x + w/2, y = 창 y + h/2 − 16(투수) · − 6(타자), 종류, rec, 0, 반지름 22) */
export const DETAIL_RADAR = { centerX: 159, pitcherCenterY: 144, batterCenterY: 154, radius: 22 } as const

/**
 * 도형 축 칸 (0x5aefc 0x5b412 루프, 반지름 22 를 돌린 값) — 축 끝(선 0x6a905 #6B92F4 → 지금 꼭짓점) · 이름 상자 slt_frame 17(26×29) ·
 * 이름 img_text 상자 + 3 · 숫자 0x6aff8(상자 x + 0x12, 상자 y + 0x11, 앵커 4). 가운데 기준 상대값.
 */
export const DETAIL_RADAR_AXES: readonly { readonly end: { x: number; y: number }; readonly box: { x: number; y: number } }[] = [
  { end: { x: -29, y: -29 }, box: { x: -19, y: -38 } },
  { end: { x: 28, y: -29 }, box: { x: 19, y: -38 } },
  { end: { x: 28, y: 28 }, box: { x: 19, y: 38 } },
  { end: { x: -29, y: 28 }, box: { x: -19, y: 38 } },
]

/** 축 이름 img_text — 0xd1b14: 투수 37 제구 · 38 구속 · 39 변화 · 40 체력 / 타자 41 히트 · 42 파워 · 43 수비 · 44 주루 */
export const DETAIL_RADAR_LABELS = { pitcher: [37, 38, 39, 40], batter: [41, 42, 43, 44] } as const

/** 연봉 0x55cf4 — v ≤ 9999 "%d" · 그 밖 "%d억"(나머지 0) · "%d억%03d" */
export function salaryTextOf(value: number): string {
  if (value <= 9999) return String(value)
  const eok = Math.trunc(value / 10000)
  const rest = value % 10000
  return rest === 0 ? `${eok}억` : `${eok}억${String(rest).padStart(3, '0')}`
}

/** 손 글 — 표 0xd2084 · 0xd208c(우타 · 좌타) / 0xd2094 · 0xd209c(우완 · 좌완) */
const HAND_TEXT = { batter: ['우타', '좌타'], pitcher: ['우완', '좌완'] } as const
/** 타입 글 표 0x1400124 — 타자 +0xb >> 5 (타격형 · 장타형) · 투수 (폼 >> 1) + 2 (오버핸드 · 사이드암 · 언더스로) */
const BATTER_TYPE_TEXT = ['타격형', '장타형'] as const
const PITCHER_TYPE_TEXT = ['오버핸드', '사이드암', '언더스로'] as const
/** 마선수 타입 — StrCOMMON[0x69 + 순번](타자) · [0x6e + 순번](투수) */
const ACE_BATTER_TYPE_TEXT = ['백의천사', '무에타이', '새침부끄', '헤비메탈', '프로레슬링'] as const
const ACE_PITCHER_TYPE_TEXT = ['싸이킥커', '사자왕류', 'MK-II', '뱀파이어', '용인족'] as const
/** 마구 StrCOMMON[0x1e + n](1~3) · n = 4 면 [0x22 + 폼 >> 1] */
const MAGIC_TEXT = ['파이어 볼', '웨이브 볼', '썬더 볼'] as const
const FORM_MAGIC_TEXT = ['샤이닝 볼', '캐넌 볼', '미라지 볼'] as const
/** 필살 StrCOMMON[0x18 + n] · 장타형이고 n = 4 면 [0x1d] 메테오 스윙 */
const SPECIAL_SWING_TEXT = ['파워 스윙', '플레임 스윙', '토네이도스윙', '미라지 스윙'] as const
const METEOR_SWING_TEXT = '메테오 스윙'
/** 없음 글 0xcc274 · 이어 붙이기 0xcc298 */
export const DETAIL_NONE_TEXT = '-'
const JOIN_TEXT = ' / '

export interface DetailRowValue {
  /** 흐르는 글(0x5a8c8 — 창이 다 열린 뒤에만)인가, 가운데 글(0xba411)인가 */
  readonly kind: 'text' | 'ticker'
  readonly text: string
}

export interface PlayerDetail {
  readonly kind: '투수' | '타자'
  readonly values: readonly DetailRowValue[]
  /** 도형 값 `0xb6414(rec, k, 1)` */
  readonly abilities: readonly number[]
}

/** 스킬 이름 — 투수 갈래(5c49c)는 k > 7 이면 StrCOMMON[0x47 + k], 타자 갈래는 늘 [0x37 + k] (직접 돌려 확인) */
function skillNamesOf(bits: number, isPitcher: boolean): string[] {
  const names: string[] = []
  for (let k = 0; k <= 0x17; k += 1) {
    if (((bits >>> k) & 1) === 0) continue
    const id = isPitcher && k > 7 ? k + 16 : k
    names.push(ORIGINAL_SKILLS[id]?.name ?? '')
  }
  return names
}

const textValue = (text: string): DetailRowValue => ({ kind: 'text', text })
const tickerOrNone = (names: readonly string[]): DetailRowValue =>
  names.length === 0 ? textValue(DETAIL_NONE_TEXT) : { kind: 'ticker', text: names.join(JOIN_TEXT) }

/** 연봉 = 레코드 +0x1b × 10 × 100 (모드 3 · 4 의 내 선수 갈래는 팀 경기에 없다) */
function salaryOf(grade: number | null): DetailRowValue {
  // ⚠️ 미확인: 표 밖 선수(영입 기록 · 마선수)의 +0x1b 는 웹 명단에 없어 0 으로 둔다
  return textValue(salaryTextOf((grade ?? 0) * 1000))
}

function pitcherGradeOf(teamId: number, entry: TeamEntryPitcher): number | null {
  if (entry.aceIndex >= 0 || entry.tableSlot === undefined) return null
  return PITCHERS[leaguePitcherIdOf(entry.tableTeamId ?? teamId, entry.tableSlot)]?.grade ?? null
}

function batterGradeOf(teamId: number, entry: TeamEntryBatter): number | null {
  if (entry.aceIndex >= 0 || entry.rosterSlot === NO_ROSTER_SLOT) return null
  return BATTERS[leagueBatterIdOf(entry.tableTeamId ?? teamId, entry.rosterSlot)]?.grade ?? null
}

/** 상세 창 값 — 투수 `0xb8b09(팀, 커서)` · 타자 `0xb8b19(팀, 커서)` (0x384b8 → 0x37e5c 끝 0x38420) */
export function playerDetailOf(progress: TeamGameProgress, kind: '투수' | '대타', index: number): PlayerDetail | null {
  const teamId = progress.options.ourTeamId
  const abilities = substitutionDetailAbilities(progress, kind, index)
  if (abilities === null) return null
  if (kind === '투수') {
    const entry = progress.ourPitcherEntry[index]
    if (entry === undefined) return null
    const isAce = entry.aceIndex >= 0
    const { form, magicId: magicNumber, pitchMask } = entry.repertoire
    const pitches: string[] = []
    // 5c2b0 — k = 1..22, 레코드 +0x1c & 표 0xd17a8[k](= 1 << (k − 1)) 이면 이름 표 0x14000c8[k]
    for (let k = 1; k <= 0x16; k += 1) if ((pitchMask & (1 << (k - 1))) !== 0) pitches.push(PITCH_TYPES[k - 1]?.name ?? '')
    const magic = magicNumber <= 0
      ? textValue(DETAIL_NONE_TEXT)
      : isAce
        ? { kind: 'ticker' as const, text: ACE_PLAYERS[5 + entry.aceIndex]?.burst ?? '' }
        : { kind: 'ticker' as const, text: magicNumber === 4 ? (FORM_MAGIC_TEXT[form >> 1] ?? '') : (MAGIC_TEXT[magicNumber - 1] ?? '') }
    return {
      kind: '투수',
      abilities,
      values: [
        textValue(isAce ? (ACE_PITCHER_TYPE_TEXT[entry.aceIndex] ?? '') : (PITCHER_TYPE_TEXT[form >> 1] ?? '')),
        textValue(HAND_TEXT.pitcher[pitcherHandOf(form, isAce)] ?? ''),
        { kind: 'ticker', text: pitches.join(JOIN_TEXT) },
        tickerOrNone(skillNamesOf(entry.skillBits ?? 0, true)),
        magic,
        salaryOf(pitcherGradeOf(teamId, entry)),
      ],
    }
  }
  const entry = progress.ourEntry[index]
  if (entry === undefined) return null
  const isAce = entry.aceIndex >= 0
  const profile = entryProfileOf(progress, entry)
  // 레코드 +0x18 — 마타자는 순번 + 5, 붙박이 표 · 일반 레코드는 0 이다 (`teamGameFlow` 의 필살 남은 칸 주석, H2 4-2)
  const special = isAce
    ? { kind: 'ticker' as const, text: ACE_PLAYERS[entry.aceIndex]?.burst ?? '' }
    : textValue(DETAIL_NONE_TEXT)
  return {
    kind: '타자',
    abilities,
    values: [
      textValue(isAce ? (ACE_BATTER_TYPE_TEXT[entry.aceIndex] ?? '') : (BATTER_TYPE_TEXT[profile >> 5] ?? '')),
      textValue(HAND_TEXT.batter[teamBatterHandOf(teamId, entry)] ?? ''),
      tickerOrNone(skillNamesOf(entry.skillBits ?? 0, false)),
      special,
      salaryOf(batterGradeOf(teamId, entry)),
    ],
  }
}

/** 필살 이름 — 일반 레코드 +0x18 이 있을 때의 갈래(5bd90~5be0e). 팀 경기 명단에는 아직 쓰는 곳이 없다 */
export function specialSwingTextOf(number: number, battingType: number): string {
  if (battingType === 1 && number === 4) return METEOR_SWING_TEXT
  return SPECIAL_SWING_TEXT[number - 1] ?? ''
}
