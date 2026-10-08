import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { yearlyStatsOf } from '@/entities/career/model/playerCareer'
import type { SeasonStats } from '@/entities/career/model/seasonStats'
import type { PitcherCareer, PitcherSeasonStats } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherYearlyStatsOf, seasonEarnedRunAverageOf } from '@/entities/pitcher-career/model/pitcherCareer'
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
 * null = 웹 커리어가 세지 않는 칸 — ⚠️ 0x40 도루(+0x2c)는 내 선수 칸이 웹에 없다(리그 표만 센다). 지어내지 않고 비운다.
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
 * null = ⚠️ 0x10000 사사구(+0x2a)는 내 투수 시즌 칸이 웹에 없다 — 비운다.
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
    default: return null
  }
}

/** 열 밀기 — [편집기+0x331] 단계(−1 = 안 밂) · [+0x332] 방향(0 오른 키 → 다음 열 · 1 왼 키 → 앞 열) */
export interface YearSlide {
  readonly step: number
  readonly direction: 'next' | 'previous'
}

export interface YearRecordView {
  /** 목록 객체 [편집기+0x41c] 커서 줄 */
  readonly cursor: number
  /** [편집기+0x335] — 보이는 첫 넘기는 열 */
  readonly firstColumn: number
  readonly slide: YearSlide | null
}

/** 0x5561c 가 +0x335 = 0 · +0x331 = −1, 목록 커서 0 으로 연다 */
export const OPEN_YEAR_RECORD_VIEW: YearRecordView = { cursor: 0, firstColumn: 0, slide: null }

export type YearRecordKey = '위' | '아래' | '왼' | '오른'

/**
 * 키 0x1463c → 0x55864 (취소는 부르는 쪽이 106 으로, '0' · '*' 는 0x1463c 가 버린다. 확인은 보기 전용이라 아무 일도 없다).
 * - 밀고 있는 동안([+0x331] ≠ −1)은 0x5587c 가 키를 통째로 건너뛴다.
 * - 왼(55a1a · 55a5a) · 오른(55a90): [+0x337] 이 켜져 있어(열 8 · 9 > 4) 끝 코드 대신 +0x331 = 0 · +0x332 = 1 / 0.
 * - 위 · 아래: 목록 객체(vtable +0x18). ⚠️ 끝에서 감기는지는 미해결 — 웹 편집기(`entryEditor`)와 같이 멈춘다.
 */
export function pressYearRecordKey(view: YearRecordView, key: YearRecordKey, rowCount: number): YearRecordView {
  if (view.slide !== null) return view
  switch (key) {
    case '위': return { ...view, cursor: Math.max(0, view.cursor - 1) }
    case '아래': return { ...view, cursor: Math.min(Math.max(0, rowCount - 1), view.cursor + 1) }
    case '왼': return { ...view, slide: { step: 0, direction: 'previous' } }
    case '오른': return { ...view, slide: { step: 0, direction: 'next' } }
  }
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

/** 목록 객체의 윗줄 — 커서가 보이는 10줄 안에 들게 (웹 편집기 `EntryEditorScreen` 과 같은 셈) */
export function yearTopRowOf(cursor: number, rowCount: number): number {
  if (rowCount <= VISIBLE_YEAR_ROWS) return 0
  return Math.min(Math.max(0, cursor - VISIBLE_YEAR_ROWS + 1), rowCount - VISIBLE_YEAR_ROWS)
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
 * (순위 종류 10 이 본다). 내 선수 줄은 `myLeagueRecordOf` — ⚠️ 내 도루는 웹이 세지 않아 0 이다.
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
