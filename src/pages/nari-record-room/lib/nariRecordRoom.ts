import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { yearlyStatsOf } from '@/entities/career/model/playerCareer'
import type { SeasonStats } from '@/entities/career/model/seasonStats'
import type { PitcherCareer, PitcherSeasonStats } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherWalksOf, pitcherYearlyStatsOf, seasonEarnedRunAverageOf } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherLeagueRecordsOf } from '@/entities/pitcher-career/model/pitcherSeasonFlow'
import { EMPTY_LEAGUE_RECORD } from '@/entities/awards/model/leaderboard'
import type { LeagueRecord } from '@/entities/awards/model/leaderboard'
import { myLeagueRecordOf } from '@/entities/awards/model/seasonAwards'
import { LEAGUE_TEAM_COUNT } from '@/entities/league/model/league'
import { leagueBatterIdOf, leagueBatterLineOf } from '@/entities/league/model/leaguePlayerStats'
import { teamBatters } from '@/entities/team/model/teamRoster'
import { originalDecimalTextOf, rankSeasonRecords, rankingCategoriesOf } from '@/entities/season-mode/model/seasonRecordRanking'
import type { SeasonRankingEntry, SeasonRankingSide } from '@/entities/season-mode/model/seasonRecordRanking'

/**
 * **나만의리그 [기록실] — 팝업 0x80 → 상태 124** (2026-10-08 직접 떴다. 장면 0x106 모드 3 · 4 공용).
 *
 * ```
 * 106 칸 4   0x13010 130c2~130dc  팝업 0x80(그리기 0x19448 · 키 0x196ec) 열기 · [장면+0x166] = 0
 * 0x19448    제목 StrMODE[74] 흰 글 (W/2 − 0x54, H/2 − 0x28) · 칸 둘 32×32 (W/2 − 0x38, H/2) · (W/2 + 0x18, H/2)
 *            0x858fd(…, 6 / 10, 고른 칸 아니면 −1) · 칸 아래 h + 4 에 img_text 106 "개인기록" · 360 "순위기록" 가운데
 *            (그림 객체 +8 의 +0x1a8 · +0x5a0), 안 고른 칸 글은 (0xb2, 0xb2, 0xb2) 효과 0xb — 시즌 0xf334 와 같은 꼴
 * 0x196ec    취소 → 닫기 · 좌·우(−3 · −4) · '4' · '6' → +0x166 뒤집기 · 확인(−5 · '5') → +0x164 = (+0x166 ? 1 : 0) · 124 · 닫기
 * 124 진입   0x116d4 = 0x5761c(편집기, +0x164 == 0, [장면+0xcc] ≠ 4(투수편), s8 S[1], [sp] s8 S[0xb3]) → 0x5570d(편집기, +0xfc, +0xf0)
 * 124 키     0x1463c  취소 → 106 · +0x164 == 0 이면 '0' · '*' 를 버리고 0x55864(편집기) · 아니면 0x5787d(쪽 넘기기)
 * 124 그림   0x16778  +0x164 ≠ 0 ? 0x5796c : 0x5cfec · 이어 머리띠 0x7f4ed([장면+0xe0])
 * ```
 *
 * **첫 갈래 = 내 선수의 연도별 기록** (0x5761c 만들기 갈래 57654~57812):
 * 0x1c 바이트 팀(0xb4d05)을 새로 만들어 타자편은 0x1fa8d(저장, i) → 0xb5379 를 i < S[0xb3] 만큼 · 이어 0x1fc21(올해),
 * 투수편은 0x1fa79 → 0xb53a5 · 0x1fbd1 로 넣는다 — 줄 i 가 (i + 1)년차다. 0x5561c(편집기, &팀, **0**, 0, 투수편) — 셋째 0 이라
 * **보기 전용**, 다섯째가 탭(타자편 타자 탭 · 투수편 투수 탭). 0x55798(편집기, **4**, 10) — 보이는 열 4 · 줄 10.
 * 0x557c0(편집기, 탭, &[0x40000000], 1, 표, 8 / 9) — 고정 열 하나(0x5658c "연차" 번호 열) + 넘기는 열 표:
 * 타자 0xd1a08 [0 타율, 0x10 홈런, 1 타석, 2 안타, 4 2루타, 8 3루타, 0x20 타점, 0x40 도루] ·
 * 투수 0xd1a28 [0x100 방어, 0x200 이닝, 0x400 실점, 0x800 승, 0x1000 패, 0x2000 세이브, 0x4000 삼진, 0x8000 투구수, 0x10000 사사구].
 * 열 수(8 · 9)가 보이는 열(4)보다 많아 [편집기+0x337] = 1 — 좌·우가 끝 코드 대신 열을 민다(아래 `pressYearRecordKey`).
 */

/** 팝업 0x80 의 두 칸 — [장면+0x166] (0 개인기록 · 1 순위기록). 열 때 0 (130d4~130dc) */
export const RECORD_ROOM_PICK = { 개인기록: 0, 순위기록: 1 } as const
export type RecordRoomPick = (typeof RECORD_ROOM_PICK)[keyof typeof RECORD_ROOM_PICK]

/** 칸 글 img_text — 그림 객체 +8 의 +0x1a8(106) · +0x5a0(360) (0x19510 · 0x19618) */
export const RECORD_ROOM_PICK_LABEL_FRAMES: readonly [number, number] = [106, 360]
export const RECORD_ROOM_PICK_LABELS: readonly [string, string] = ['개인기록', '순위기록']

/** 팝업 제목 StrMODE[74] "보고 싶은 기록을 선택해주세요" (0x1947a) */
export const RECORD_ROOM_PICK_TITLE_ID = 74

export type NariRecordEdition = '타자' | '투수'

/** 넘기는 열 하나 — 비트(0x56ebc 의 갈래) · 머리 글 img_text(0x56dd4) */
export interface YearRecordColumn {
  readonly bit: number
  readonly labelFrame: number
  readonly label: string
}

/** 타자 열 표 0xd1a08 — 머리 글은 0x56dd4 (172 타율 · 61 홈런 · 207 타석 · 208 안타 · 209 2루타 · 210 3루타 · 62 타점 · 211 도루) */
export const BATTER_YEAR_COLUMNS: readonly YearRecordColumn[] = [
  { bit: 0, labelFrame: 172, label: '타율' },
  { bit: 0x10, labelFrame: 61, label: '홈런' },
  { bit: 1, labelFrame: 207, label: '타석' },
  { bit: 2, labelFrame: 208, label: '안타' },
  { bit: 4, labelFrame: 209, label: '2루타' },
  { bit: 8, labelFrame: 210, label: '3루타' },
  { bit: 0x20, labelFrame: 62, label: '타점' },
  { bit: 0x40, labelFrame: 211, label: '도루' },
]

/** 투수 열 표 0xd1a28 — 머리 글 0x56dd4 (171 방어 · 213 이닝 · 214 실점 · 215 승 · 216 패 · 217 세이브 · 181 삼진 · 218 투구수 · 219 사사구) */
export const PITCHER_YEAR_COLUMNS: readonly YearRecordColumn[] = [
  { bit: 0x100, labelFrame: 171, label: '방어' },
  { bit: 0x200, labelFrame: 213, label: '이닝' },
  { bit: 0x400, labelFrame: 214, label: '실점' },
  { bit: 0x800, labelFrame: 215, label: '승' },
  { bit: 0x1000, labelFrame: 216, label: '패' },
  { bit: 0x2000, labelFrame: 217, label: '세이브' },
  { bit: 0x4000, labelFrame: 181, label: '삼진' },
  { bit: 0x8000, labelFrame: 218, label: '투구수' },
  { bit: 0x10000, labelFrame: 219, label: '사사구' },
]

export function yearColumnsOf(edition: NariRecordEdition): readonly YearRecordColumn[] {
  return edition === '타자' ? BATTER_YEAR_COLUMNS : PITCHER_YEAR_COLUMNS
}

/** 고정 열 0x5658c 의 머리 글 img_text 0x187 = 391 "연차" — 줄마다 번호 i + 1 (0xba51d) */
export const YEAR_NUMBER_HEADER_FRAME = 391
/** 0x55798(편집기, 4, 10) — [편집기+0x33c] 보이는 넘기는 열 · [+0x33d] 보이는 줄 */
export const VISIBLE_YEAR_COLUMNS = 4
export const VISIBLE_YEAR_ROWS = 10
/** 열 밀기 표 0xd1bbc — 그림 한 번에 한 칸씩, 여섯 번째 뒤 [편집기+0x335] ± 1 (0x5cd60 · 0x5cf02) */
export const YEAR_SLIDE_OFFSETS: readonly number[] = [1, 3, 6, 13, 25, 39]

/** 줄 — 지난 해들(0x1fa8c / 0x1fa78 칸) 뒤 올해 레코드 */
export function batterYearRowsOf(career: PlayerCareer): readonly SeasonStats[] {
  return [...yearlyStatsOf(career), career.stats]
}

export function pitcherYearRowsOf(career: PitcherCareer): readonly PitcherSeasonStats[] {
  return [...pitcherYearlyStatsOf(career), career.stats]
}

/** 타율 × 1000 — 0xb8e3c: 타수 ≤ 0 이면 0, min(1000, trunc(안타 × 1000 / 타수)) */
function battingAverageValueOf(stats: SeasonStats): number {
  if (stats.atBats <= 0) return 0
  return Math.min(1000, Math.trunc((stats.hits * 1000) / stats.atBats))
}

/**
 * 타자 칸 글 — 0x56ebc 의 비트 갈래(56f58~57098)와 숫자 찍기 0x6aff9:
 * 0 타율 0xb8e3d → 소수(v > 999 ? 3 : 0) · 1 +0x20 · 2 +0x22 · 4 +0x24 · 8 +0x26 · 0x10 +0x28 · 0x20 +0x2a · 0x40 +0x2c 는 그대로.
 * null = 웹 커리어가 세지 않는 칸 — ⚠️ 0x40 도루(+0x2c)는 비운다. 내 타자가 +0x2c 를 받는 자리는 원본에 둘이다:
 * ① 사람 경기 정산 0xa8024 의 도루 판(종류 5, a8340~a83c0) — 루를 옮긴 **주자**에게 주는데, 타자편 사람 판은 내 타석뿐이라
 * 주자는 늘 동료다. ② 동료 타석의 간이 엔진 0xc262c → 투구 판정 0xc1818 끝 도루(c1a42~c1a98) — 내가 루에 있을 때.
 * 웹 타자편 동료 타석(`gameFlow.playTeammateAtBat`)은 이 도루 굴림(`onPitchJudged`)을 돌리지 않아 ② 가 일어나지 않는다
 * (난수 순서가 걸린 엔진 일이라 여기서 고치지 않는다). 지어내지 않고 비운다.
 */
export function batterYearCellTextOf(stats: SeasonStats, bit: number): string | null {
  switch (bit) {
    case 0: {
      const average = battingAverageValueOf(stats)
      return originalDecimalTextOf(average, average > 999 ? 3 : 0)
    }
    case 1: return String(stats.atBats)
    case 2: return String(stats.hits)
    case 4: return String(stats.doubles)
    case 8: return String(stats.triples)
    case 0x10: return String(stats.homeRuns)
    case 0x20: return String(stats.runsBattedIn)
    default: return null
  }
}

/**
 * 투수 칸 글 — 0x56ebc: 0x100 방어율 0xb6ce9 → 소수((v > 100 ? v × 10 : v), 3) · 0x200 0xca7b5(+0x20, 3) = 아웃 / 3 ·
 * 0x400 +0x22 · 0x800 s8 +0x2e · 0x1000 s8 +0x2f · 0x2000 +0x24 · 0x4000 +0x26 · 0x8000 +0x28 · 0x10000 +0x2a.
 * +0x2a 사사구는 정산 0xa8024 의 볼넷 · 사구 갈래(a8b58 · a8bd2)가 쌓는다(`PitcherSeasonStats.walks`).
 */
export function pitcherYearCellTextOf(stats: PitcherSeasonStats, bit: number): string | null {
  switch (bit) {
    case 0x100: {
      const average = seasonEarnedRunAverageOf(stats)
      return originalDecimalTextOf(average > 100 ? average * 10 : average, 3)
    }
    case 0x200: return String(Math.trunc(stats.outs / 3))
    case 0x400: return String(stats.runsAllowed)
    case 0x800: return String(stats.wins)
    case 0x1000: return String(stats.losses)
    case 0x2000: return String(stats.saves)
    case 0x4000: return String(stats.strikeouts)
    case 0x8000: return String(stats.pitches)
    case 0x10000: return String(pitcherWalksOf(stats))
    default: return null
  }
}

/**
 * 타자 칸의 숫자 — 0x56ebc 가 0x6aff8 에 넘기는 값 (56f58~57098 · 570de~57170): 타율은 소수점 갈래(자릿수 v > 999 ? 3 : 0),
 * 그 밖은 자릿수 −1. 웹이 세지 않는 칸은 null(`batterYearCellTextOf` 와 같다).
 */
export function batterYearCellNumberOf(stats: SeasonStats, bit: number): YearCellNumber | null {
  if (bit === 0) {
    const average = battingAverageValueOf(stats)
    return { value: average, digits: average > 999 ? 3 : 0, isDecimal: true }
  }
  const text = batterYearCellTextOf(stats, bit)
  return text === null ? null : { value: Number(text), digits: -1, isDecimal: false }
}

/** 투수 칸의 숫자 — 방어율은 소수점 갈래((v > 100 ? v × 10 : v), 자릿수 3), 그 밖은 자릿수 −1 */
export function pitcherYearCellNumberOf(stats: PitcherSeasonStats, bit: number): YearCellNumber | null {
  if (bit === 0x100) {
    const average = seasonEarnedRunAverageOf(stats)
    return { value: average > 100 ? average * 10 : average, digits: 3, isDecimal: true }
  }
  const text = pitcherYearCellTextOf(stats, bit)
  return text === null ? null : { value: Number(text), digits: -1, isDecimal: false }
}

/** 열 밀기 — [편집기+0x331] 단계(−1 = 안 밂) · [+0x332] 방향(0 오른 키 → 다음 열 · 1 왼 키 → 앞 열) */
export interface YearSlide {
  readonly step: number
  readonly direction: 'next' | 'previous'
}

export interface YearRecordView {
  /** 목록 객체 [편집기+0x41c] 의 커서 줄 (+0x10) */
  readonly cursor: number
  /** 목록 객체의 윗줄 (+0x30) — 커서가 보이는 줄을 벗어날 때만 옮긴다 (`0x6c2bd`) */
  readonly top: number
  /** [편집기+0x335] — 보이는 첫 넘기는 열 */
  readonly firstColumn: number
  readonly slide: YearSlide | null
  /**
   * [편집기+0x40c] — 키 0x55864 가 **불릴 때마다** +1 (55868~55874, 미는 동안에도). 0x5561c 가 0 으로 연다.
   * 124 는 갱신 함수가 없어(상태 표 0xcc728 은 진입 0x116d4 뿐) 키가 들어올 때만 오른다 — 화살 · 커서 깜빡임이 키 수를 따른다.
   */
  readonly keyPresses: number
}

/** 0x5561c 가 +0x335 = 0 · +0x331 = −1 · +0x40c = 0, 0x55724 가 목록 커서 (0, 0) · 윗줄 0 으로 연다 */
export const OPEN_YEAR_RECORD_VIEW: YearRecordView = { cursor: 0, top: 0, firstColumn: 0, slide: null, keyPresses: 0 }

/** '기타' = 0x55864 까지 가지만 보기 전용이라 아무 일도 없는 키(확인 · 숫자 등) — [+0x40c] 만 센다 */
export type YearRecordKey = '위' | '아래' | '왼' | '오른' | '기타'

/**
 * 키 0x1463c → 0x55864 (취소는 부르는 쪽이 106 으로, '0' · '*' 는 0x1463c 가 버려 여기 안 온다).
 * - 0x55864 머리가 [+0x40c] 를 +1 한다 — 어떤 키든, 미는 동안이든.
 * - 밀고 있는 동안([+0x331] ≠ −1)은 0x5587c 가 나머지를 통째로 건너뛴다.
 * - 왼(55a1a · 55a5a) · 오른(55a90): [+0x337] 이 켜져 있어(열 8 · 9 > 4) 끝 코드 대신 +0x331 = 0 · +0x332 = 1 / 0.
 * - 위 · 아래: 목록 객체 vt+0x18 = 0x6c299 → 0x6c521 → 0x6c031. 목록 모양은 0x55724 의 vt+0x1c(1열, 줄 수, 1, 꼴 **0x20**) —
 *   세로로 넘치면 **감는다**((y ± 1 + 줄 수) % 줄 수). 이어 vt+0x20 = 0x6c2bd 가 윗줄을 고친다: 커서가 [윗줄, 윗줄 + 보이는 줄)
 *   밖이면 아래로 벗어났을 때 커서 − 보이는 줄 + 1, 위로 벗어났을 때 커서. 보이는 줄 [+0x38] = min(10, 줄 수)(0x55784).
 */
export function pressYearRecordKey(view: YearRecordView, key: YearRecordKey, rowCount: number): YearRecordView {
  const counted = { ...view, keyPresses: view.keyPresses + 1 }
  if (view.slide !== null) return counted
  switch (key) {
    case '위': return withCursor(counted, rowCount, -1)
    case '아래': return withCursor(counted, rowCount, 1)
    case '왼': return { ...counted, slide: { step: 0, direction: 'previous' } }
    case '오른': return { ...counted, slide: { step: 0, direction: 'next' } }
    case '기타': return counted
  }
}

/** 0x6be71 → 0x6bead(꼴 0x20 세로 감기) · 0x6c2bd(윗줄) */
function withCursor(view: YearRecordView, rowCount: number, dy: number): YearRecordView {
  if (rowCount <= 0) return view
  const cursor = (view.cursor + dy + rowCount) % rowCount
  const visible = visibleYearRowCountOf(rowCount)
  if (cursor >= view.top && cursor < view.top + visible) return { ...view, cursor }
  const top = cursor - view.top > 0 ? cursor - visible + 1 : cursor
  return { ...view, cursor, top }
}

/** 목록 +0x38 = min([편집기+0x33d] 10, 줄 수) (0x55784~0x5578e) */
export function visibleYearRowCountOf(rowCount: number): number {
  return Math.min(VISIBLE_YEAR_ROWS, rowCount)
}

/**
 * 그림 한 번의 넘기는 열 밀림(px) — 0x5c984 5ccde~5cd8c. 밀 수 없는 쪽이면 0(그 그림에서 +0x331 = −1 로 그만둔다).
 * 방향 'next'(0)는 왼쪽으로(x − 표[단계]), 'previous'(1)는 오른쪽으로(x + 표[단계]).
 */
export function yearSlideOffsetOf(view: YearRecordView, columnCount: number): number {
  if (view.slide === null || !canSlide(view, columnCount)) return 0
  const offset = YEAR_SLIDE_OFFSETS[view.slide.step] ?? 0
  return view.slide.direction === 'next' ? -offset : offset
}

/** 그림 한 번이 끝난 뒤 — 단계 + 1, 여섯이면 그만두고 첫 열 ± 1 (5cefa~5cf50). 밀 수 없으면 곧장 그만둔다 */
export function advanceYearSlide(view: YearRecordView, columnCount: number): YearRecordView {
  if (view.slide === null) return view
  if (!canSlide(view, columnCount)) return { ...view, slide: null }
  const step = view.slide.step + 1
  if (step < YEAR_SLIDE_OFFSETS.length) return { ...view, slide: { ...view.slide, step } }
  const firstColumn = view.slide.direction === 'next' ? view.firstColumn + 1 : view.firstColumn - 1
  return { ...view, firstColumn, slide: null }
}

/** 0x5ccea~0x5cd1e — 다음 열: 첫 열 + 보이는 열 < 열 수 · 앞 열: 첫 열 > 0 */
function canSlide(view: YearRecordView, columnCount: number): boolean {
  if (view.slide === null) return false
  return view.slide.direction === 'next'
    ? view.firstColumn + VISIBLE_YEAR_COLUMNS < columnCount
    : view.firstColumn > 0
}

/**
 * **124 목록 칸 배치** (0x5c984 · 0x5658c · 0x56ebc · 0x5650c · 0x55d6c 직접 떴다). 칸 그림은 편집기 [+0x324] = 장면 +0xfc =
 * **ui/game_ui.pzx**(0x13fee, 팔레트 game_ui.mpl) 프레임, 화살은 [편집기+0xa8] = 장면 +0xf8 = **ui/slt_frame.pzx** 이미지
 * (0x14098~0x140ae 가 편집기 +0xa4 game_ui · +0xa8 slt_frame · +0xb0 team_logo · +0xb8 = 장면 +0xf0 **ui/num.pzx** 를 넣는다).
 * ```
 * 판 0x55e60(…, W/2 = 120, H/2 + 5, 210, 220)                      → (15, 55, 210, 220)
 * 머리 줄 y = H/2 − 0x66 = 58 · 첫 열 x = W/2 − 0x64 = 20
 * 고정 열 0x5658c: 머리 칸 0x5650c — 프레임 0x17(25×15)은 **크기만** 재고 그리지 않는다 · 글 img_text 391 을 (x, y − 2, 25, 15) 가운데(0x22)
 *   y += 15 + 10 → 83 · 줄마다 프레임 0x1b(25×15) (x, y) · 번호 0xba51c(x, y + 3, 25, 15, 틈 0, i + 1, num 0x1e + 숫자, 꼴 2 = 가로 가운데)
 *   · y += 15 + 3. 돌려준 폭 25 → 다음 x = 20 + 25 + 3 = 48
 * 넘기는 열: x0 = 48 + [+0x33e](0x5761c 가 15) = 63 · 보이는 폭 0x55d6c = Σ(36 + 3) × 4 = 156
 *   첫 열 ≠ 0 이면 slt_frame 20(◀ 5×8) (x0 − 깜빡 − 5, 62) · 첫 열 + 4 ≠ 열 수면 같은 그림 뒤집어(0x11) (x0 + 156 + 깜빡 − 5, 62)
 *   자르기 0xbae25(63, 58, 156, 221) · 열 i 는 x = 63 + (i − 첫 열)·39 + 밀림 (첫 열 − 1 부터 그린다)
 *   0x56ebc: 머리 0x5650c(프레임 0x22 36×15 크기만 · 글 0x56dd4) · 줄마다 프레임 0x23(36×15) (x, y) · 숫자 0x6aff8(x + 24, y + 3, …)
 * 위아래 화살: 목록 줄 수 > 1 이면 slt_frame 0x20(▲ 13×8) (114, 45 − 깜빡) · 0x21(▼) (114, 277 + 깜빡)
 *   깜빡 = [+0x40c] % 8 ≤ 4 ? 2 : 0 (5ca52~5ca6c)
 * 커서 0x56234: 0x5658c 가 커서 줄에서 [+0x3ec] = (x 20, y, 0xc1, 15) — 폭은 [+0x438] = 0 이라 193 + 0 + 3 = 196.
 *   [+0x40c] % 8 ≤ 3 이면 0x6aa65(x + 1, y + 1, 194, 13, 둥글기 1, 0x80ffff00 반투명 노랑) · 아니면 (x, y, 196, 15, 1, 노랑 0xffff00)
 * ```
 */
export const YEAR_TABLE_LAYOUT = {
  panel: { x: 15, y: 55, width: 210, height: 220 },
  headerY: 58,
  numberX: 20,
  numberWidth: 25,
  cellHeight: 15,
  firstRowY: 83,
  rowStep: 18,
  statX: 63,
  statWidth: 36,
  columnStep: 39,
  clip: { x: 63, y: 58, width: 156, height: 221 },
  /** 머리 글 칸 — (x, y − 2, 폭, 15) 가운데 */
  labelY: 56,
  upArrowY: 45,
  downArrowY: 277,
  arrowX: 114,
  sideArrowY: 62,
  cursorWidth: 196,
} as const

/** 0x5c984 의 화살 깜빡 [sp+0x40] — [+0x40c] % 8 ≤ 4 ? 2 : 0 */
export function yearArrowBlinkOf(view: YearRecordView): number {
  return view.keyPresses % 8 <= 4 ? 2 : 0
}

/** 0x56234 의 커서 꼴 — [+0x40c] % 8 ≤ 3 이면 안쪽 반투명, 아니면 바깥 불투명 */
export function yearCursorIsInsetOf(view: YearRecordView): boolean {
  return view.keyPresses % 8 <= 3
}

/** 숫자 그림 하나 — num.pzx 이미지 번호와 칸 왼쪽 기준 x */
export interface NumberGlyphPlacement {
  readonly frame: number
  readonly x: number
}

/** num.pzx 숫자 폭 — '1' 만 4, 그 밖 6 (이미지 20~29 · 30~39) */
const digitWidthOf = (digit: number) => (digit === 1 ? 4 : 6)

/**
 * 번호 열 0xba51c(x, y + 3, 25, 15, 틈 0, 값, 이미지 0x1e + 숫자, num, 꼴 2) — 숫자를 왼쪽부터 늘어놓고
 * 꼴 비트 1 이라 x += (25 − 합 폭) >> 1.
 */
export function yearNumberGlyphsOf(value: number): readonly NumberGlyphPlacement[] {
  const digits = [...String(Math.max(0, Math.trunc(value)))].map(Number)
  const total = digits.reduce((sum, digit) => sum + digitWidthOf(digit), 0)
  let x = (YEAR_TABLE_LAYOUT.numberWidth - total) >> 1
  return digits.map((digit) => {
    const placed = { frame: 0x1e + digit, x }
    x += digitWidthOf(digit)
    return placed
  })
}

/** 넘기는 열 한 칸의 숫자 — 0x6aff8 의 입력 */
export interface YearCellNumber {
  readonly value: number
  /** 자릿수 인자 — −1 이면 값이 다 찍힐 때까지 */
  readonly digits: number
  /** 소수점 갈래 (인자 [sp+0x10]) */
  readonly isDecimal: boolean
}

/** 0x6aff8 이 찍는 것 — 숫자 그림(칸 왼쪽 기준)과 점(흰 1×2, 칸 왼쪽 기준 x · 칸 위 기준 y) */
export interface YearCellDrawing {
  readonly glyphs: readonly NumberGlyphPlacement[]
  readonly dots: readonly { readonly x: number; readonly y: number }[]
}

/** 0x56ebc 가 숫자를 찍는 자리 — 칸 x + 0x18 · y + 3 */
const CELL_DIGIT_X = 0x18
const CELL_DIGIT_Y = 3
/** 숫자 한 칸 걸음 — 이미지 20 폭 6 + 틈 1 */
const CELL_DIGIT_STEP = 7
/** 점 자리 — 숫자 높이 10 − 2 */
const CELL_DOT_DY = 8

/**
 * **숫자 찍기 0x6aff8**(직접 떴다, 0x6aff8~0x6b26a) — 0x56ebc 는 앵커 4 로 불러 x 를 고치지 않고 **오른쪽 자리부터 왼쪽으로** 찍는다.
 * 한 자리마다 이미지 0x14 + (v % (u·10)) / u 를 x 에 · x −= 이미지 20 폭 + 1 · u ×= 10.
 * - 자릿수 −1: v / u > 0 이거나 u == 1 인 동안.
 * - 소수점 갈래: v > 99999 → u = 1000 · 점 자리 3 / > 9999 → 100 · 2 / > 999 → 10 · 1 / 그 밖은 자릿수 0 이면 3 · 점 0,
 *   자릿수 3 이면 점 1. 셈 [sp+8] = 2 에서 한 자리마다 −1, 셈 == 점 자리인 자리를 찍은 뒤 흰 점 두 개를 (x − 3, y + 8 · y + 9)에
 *   찍고 x −= 3 을 더 한다 — ".315" · "1.00" · "3.51" 꼴.
 */
export function yearCellDrawingOf(cell: YearCellNumber): YearCellDrawing {
  const glyphs: NumberGlyphPlacement[] = []
  const dots: { x: number; y: number }[] = []
  let x = CELL_DIGIT_X
  let unit = 1
  let digits = cell.digits
  let dotAt = 0
  let countdown = 0
  const value = cell.value
  if (cell.isDecimal) {
    if (value > 99999) {
      unit = 1000
      dotAt = 3
    } else if (value > 9999) {
      unit = 100
      dotAt = 2
    } else if (value > 999) {
      unit = 10
      dotAt = 1
    } else if (digits === 0) {
      digits = 3
      dotAt = 0
    } else if (digits === 3) {
      dotAt = 1
    }
    countdown = 2
  }
  const place = () => {
    const digit = Math.trunc((value % (unit * 10)) / unit)
    glyphs.push({ frame: 0x14 + digit, x })
    if (cell.isDecimal) {
      if (countdown === dotAt) {
        dots.push({ x: x - 3, y: CELL_DIGIT_Y + CELL_DOT_DY })
        x -= 3
      }
      countdown -= 1
    }
    x -= CELL_DIGIT_STEP
    unit *= 10
  }
  if (digits === -1) {
    while (Math.trunc(value / unit) > 0 || unit === 1) place()
  } else {
    for (let left = digits; left > 0; left -= 1) place()
  }
  return { glyphs, dots }
}

/** 0x5650c · 0xb9d75 꼴 0x22 — (칸 x, 56, 폭, 15) 안 가운데: x += (폭 − w) >> 1 · y += 올림((15 − h) / 2) */
export function yearLabelOffsetOf(boxWidth: number, imageWidth: number, imageHeight: number): { readonly x: number; readonly y: number } {
  const dy = YEAR_TABLE_LAYOUT.cellHeight - imageHeight
  return { x: (boxWidth - imageWidth) >> 1, y: (dy >> 1) + (dy - ((dy + (dy < 0 ? 1 : 0)) >> 1 << 1)) }
}

/**
 * **둘째 갈래 = 나리 판 순위**(0x5761c 만들기 0 갈래 0x577a8 → 순위 객체 0x9d77d, 그리기 0x5796c — 시즌 0xdb 와 같은 함수).
 * 편(타자 쪽 표 0xd1a4c · 투수 쪽 0xd1a60)은 0x5761c 셋째 인자 = [장면+0xcc] ≠ 4 다. 순위 0x9d789(…, 종류, 모드 3 · 4, 1, 0) 의
 * 규정 문턱은 모드 3 · 4 갈래(9d7da~9d826)가 나리 저장 0x1fa2d 의 S+0xb2(이번 시즌 경기 수)로 셈한다 — 시즌과 같은 식.
 */
export function nariRankingSideOf(edition: NariRecordEdition): SeasonRankingSide {
  return edition
}

/**
 * 타자편 순위 재료 — 열 팀 타자 명단 차례(`seasonAwards.leagueRecordsOf` 와 같은 차례)에 +0x2c 도루(`steals`)까지 채운다
 * (순위 종류 10 이 본다). 내 선수 줄은 `myLeagueRecordOf` — ⚠️ 내 도루는 0 이다(`batterYearCellTextOf` 의 ②: 웹 동료 간이 타석에 도루 굴림이 없다).
 */
export function nariBatterRankingRecordsOf(career: PlayerCareer): readonly LeagueRecord[] {
  const mine = myLeagueRecordOf(career)
  const records: LeagueRecord[] = []
  for (let teamId = 0; teamId < LEAGUE_TEAM_COUNT; teamId += 1) {
    teamBatters(teamId).forEach((player, slot) => {
      const line = leagueBatterLineOf(career.leaguePlayerStats, leagueBatterIdOf(teamId, slot))
      records.push({
        ...EMPTY_LEAGUE_RECORD,
        teamId,
        name: player.name,
        atBatsOrOuts: line.atBats,
        hits: line.hits,
        homeRuns: line.homeRuns,
        runsBattedIn: line.runsBattedIn,
        batterExtra: line.steals ?? 0,
      })
    })
    if (mine.teamId === teamId) records.push(mine)
  }
  return records
}

/** 쪽 하나의 상위 10명 */
export function nariRankingEntriesOf(
  edition: NariRecordEdition,
  career: PlayerCareer | PitcherCareer,
  page: number,
): readonly SeasonRankingEntry[] {
  const categories = rankingCategoriesOf(nariRankingSideOf(edition))
  const category = categories[page] ?? categories[0]
  const records = edition === '타자'
    ? nariBatterRankingRecordsOf(career as PlayerCareer)
    : pitcherLeagueRecordsOf(career as PitcherCareer)
  return rankSeasonRecords(records, category.kind, career.gamesPlayed)
}
