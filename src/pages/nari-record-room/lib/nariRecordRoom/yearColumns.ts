/** 첫 갈래(내 선수의 연도별 기록)의 팝업 칸 · 열 표 · 줄 · 칸 숫자 — 0x5761c · 0x56ebc */
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { yearlyStatsOf } from '@/entities/career/model/playerCareer'
import type { SeasonStats } from '@/entities/career/model/seasonStats'
import type { PitcherCareer, PitcherSeasonStats } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherWalksOf, pitcherYearlyStatsOf, seasonEarnedRunAverageOf } from '@/entities/pitcher-career/model/pitcherCareer'
import { originalDecimalTextOf } from '@/entities/season-mode/model/seasonRecordRanking'

/** 팝업 0x80 의 두 칸 — [장면+0x166] (0 개인기록 · 1 순위기록). 열 때 0 (130d4~130dc) */
export const RECORD_ROOM_PICK = { 개인기록: 0, 순위기록: 1 } as const
export type RecordRoomPick = (typeof RECORD_ROOM_PICK)[keyof typeof RECORD_ROOM_PICK]

/** 칸 글 img_text — 그림 객체 +8 의 +0x1a8(106) · +0x5a0(360) (0x19510 · 0x19618) */
export const RECORD_ROOM_PICK_LABEL_FRAMES: readonly [number, number] = [106, 360]
export const RECORD_ROOM_PICK_LABELS: readonly [string, string] = ['개인기록', '순위기록']

/** 팝업 그림 · 칸 자리는 시즌 0xf334 와 같은 꼴이라 `widgets/record-pick-popup` 이 함께 쓴다 */

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
 * 0x40 도루(+0x2c) — 내 타자가 +0x2c 를 받는 자리는 원본에 둘이다: ① 사람 경기 정산 0xa8024 의 도루 판(종류 5, a8340~a83c0) —
 * 루를 옮긴 **주자**에게 주는데, 타자편 사람 판은 내 타석뿐이라 주자는 늘 동료다. ② 동료 타석의 간이 엔진 0xc262c → 투구 판정
 * 0xc1818 끝 도루(c1a42~c1a98) — 내가 루에 있을 때. 웹은 ② 를 `gameFlow.playTeammateAtBat` 이 `SeasonStats.stolenBases` 로 센다
 * (옛 저장은 0). null = 웹 커리어가 세지 않는 칸.
 */
export function batterYearCellTextOf(stats: SeasonStats, bit: number): string | null {
  const textOf = BATTER_CELL_TEXT.get(bit)
  return textOf === undefined ? null : textOf(stats)
}

/** 타자 비트 → 칸 글 (0x56ebc 갈래) */
const BATTER_CELL_TEXT: ReadonlyMap<number, (stats: SeasonStats) => string> = new Map([
  [
    0,
    (stats: SeasonStats) => {
      const average = battingAverageValueOf(stats)
      return originalDecimalTextOf(average, average > 999 ? 3 : 0)
    },
  ],
  [1, (stats: SeasonStats) => String(stats.atBats)],
  [2, (stats: SeasonStats) => String(stats.hits)],
  [4, (stats: SeasonStats) => String(stats.doubles)],
  [8, (stats: SeasonStats) => String(stats.triples)],
  [0x10, (stats: SeasonStats) => String(stats.homeRuns)],
  [0x20, (stats: SeasonStats) => String(stats.runsBattedIn)],
  [0x40, (stats: SeasonStats) => String(stats.stolenBases ?? 0)],
])

/**
 * 투수 칸 글 — 0x56ebc: 0x100 방어율 0xb6ce9 → 소수((v > 100 ? v × 10 : v), 3) · 0x200 0xca7b5(+0x20, 3) = 아웃 / 3 ·
 * 0x400 +0x22 · 0x800 s8 +0x2e · 0x1000 s8 +0x2f · 0x2000 +0x24 · 0x4000 +0x26 · 0x8000 +0x28 · 0x10000 +0x2a.
 * +0x2a 사사구는 정산 0xa8024 의 볼넷 · 사구 갈래(a8b58 · a8bd2)가 쌓는다(`PitcherSeasonStats.walks`).
 */
export function pitcherYearCellTextOf(stats: PitcherSeasonStats, bit: number): string | null {
  const textOf = PITCHER_CELL_TEXT.get(bit)
  return textOf === undefined ? null : textOf(stats)
}

/** 투수 비트 → 칸 글 (0x56ebc 갈래) */
const PITCHER_CELL_TEXT: ReadonlyMap<number, (stats: PitcherSeasonStats) => string> = new Map([
  [
    0x100,
    (stats: PitcherSeasonStats) => {
      const average = seasonEarnedRunAverageOf(stats)
      return originalDecimalTextOf(average > 100 ? average * 10 : average, 3)
    },
  ],
  [0x200, (stats: PitcherSeasonStats) => String(Math.trunc(stats.outs / 3))],
  [0x400, (stats: PitcherSeasonStats) => String(stats.runsAllowed)],
  [0x800, (stats: PitcherSeasonStats) => String(stats.wins)],
  [0x1000, (stats: PitcherSeasonStats) => String(stats.losses)],
  [0x2000, (stats: PitcherSeasonStats) => String(stats.saves)],
  [0x4000, (stats: PitcherSeasonStats) => String(stats.strikeouts)],
  [0x8000, (stats: PitcherSeasonStats) => String(stats.pitches)],
  [0x10000, (stats: PitcherSeasonStats) => String(pitcherWalksOf(stats))],
])

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

/** 넘기는 열 한 칸의 숫자 — 0x6aff8 의 입력 */
export interface YearCellNumber {
  readonly value: number
  /** 자릿수 인자 — −1 이면 값이 다 찍힐 때까지 */
  readonly digits: number
  /** 소수점 갈래 (인자 [sp+0x10]) */
  readonly isDecimal: boolean
}
