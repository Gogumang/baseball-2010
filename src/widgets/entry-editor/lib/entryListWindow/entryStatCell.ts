import type { EntryBatterLine, EntryPitcherLine } from '@/entities/season-mode/model/entryEditor'
import type { YearCellNumber } from '@/widgets/entry-editor/ui/entryListWindow/otherSlices'

/** `0xb8e3c` 타율 × 1000 */
export function entryBattingAverageOf(line: Pick<EntryBatterLine, 'atBats' | 'hits'>): number {
  if (line.atBats <= 0) return 0
  return Math.min(1000, Math.trunc((line.hits * 1000) / line.atBats))
}

/** `0xb6ce8` 방어율 × 100 */
export function entryEarnedRunAverageOf(line: Pick<EntryPitcherLine, 'outs' | 'runsAllowed'>): number {
  if (line.outs > 0) return Math.min(9999, Math.trunc((line.runsAllowed * 2700) / line.outs))
  return line.runsAllowed > 0 ? 9999 : 0
}

/**
 * 기록 열 한 칸 — 0x56ebd 의 비트 갈래(56f58~57098)와 0x6aff8 인자: 타율 0xb8e3d 소수(v > 999 ? 3 : 0) ·
 * 방어율 0xb6ce9 소수((v > 100 ? v × 10 : v), 3) · 이닝 0xca7b5(+0x20, 3) · 그 밖 그 칸 값(자릿수 −1).
 * 타자 비트는 [팀+0x18] 배열, 투수 비트는 [팀+0x14] 배열의 같은 줄을 읽는다.
 */
export function entryStatCellOf(word: number, batter: EntryBatterLine | undefined, pitcher: EntryPitcherLine | undefined): YearCellNumber | null {
  if (word <= LAST_BATTER_STAT_WORD) return batter === undefined ? null : (BATTER_STAT_CELLS.get(word)?.(batter) ?? null)
  return pitcher === undefined ? null : (PITCHER_STAT_CELLS.get(word)?.(pitcher) ?? null)
}

/** 타자 기록 비트의 끝 — 0x80 까지는 [팀+0x18] 타자 배열 */
const LAST_BATTER_STAT_WORD = 0x80

/** 그 칸 값을 자릿수 −1 로 */
const plainCellOf = (value: number | undefined): YearCellNumber | null => (value === undefined ? null : { value, digits: -1, isDecimal: false })

/** 타자 기록 비트 → 칸 (56f58~) — 0 타율 0xb8e3d 소수(v > 999 ? 3 : 0) */
const BATTER_STAT_CELLS: ReadonlyMap<number, (batter: EntryBatterLine) => YearCellNumber | null> = new Map([
  [
    0,
    (batter: EntryBatterLine) => {
      const average = entryBattingAverageOf(batter)
      return { value: average, digits: average > 999 ? 3 : 0, isDecimal: true }
    },
  ],
  [1, (batter: EntryBatterLine) => plainCellOf(batter.atBats)],
  [2, (batter: EntryBatterLine) => plainCellOf(batter.hits)],
  [4, (batter: EntryBatterLine) => plainCellOf(batter.doubles)],
  [8, (batter: EntryBatterLine) => plainCellOf(batter.triples)],
  [0x10, (batter: EntryBatterLine) => plainCellOf(batter.homeRuns)],
  [0x20, (batter: EntryBatterLine) => plainCellOf(batter.runsBattedIn)],
  [0x40, (batter: EntryBatterLine) => plainCellOf(batter.steals)],
  [0x80, (batter: EntryBatterLine) => plainCellOf(batter.errors)],
])

/** 투수 기록 비트 → 칸 — 0x100 방어율 0xb6ce9 소수((v > 100 ? v × 10 : v), 3) · 0x200 이닝(아웃 / 3) */
const PITCHER_STAT_CELLS: ReadonlyMap<number, (pitcher: EntryPitcherLine) => YearCellNumber | null> = new Map([
  [
    0x100,
    (pitcher: EntryPitcherLine) => {
      const average = entryEarnedRunAverageOf(pitcher)
      return { value: average > 100 ? average * 10 : average, digits: 3, isDecimal: true }
    },
  ],
  [0x200, (pitcher: EntryPitcherLine) => plainCellOf(Math.trunc(pitcher.outs / 3))],
  [0x400, (pitcher: EntryPitcherLine) => plainCellOf(pitcher.runsAllowed)],
  [0x800, (pitcher: EntryPitcherLine) => plainCellOf(pitcher.wins)],
  [0x1000, (pitcher: EntryPitcherLine) => plainCellOf(pitcher.losses)],
  [0x2000, (pitcher: EntryPitcherLine) => plainCellOf(pitcher.saves)],
  [0x4000, (pitcher: EntryPitcherLine) => plainCellOf(pitcher.strikeouts)],
  [0x8000, (pitcher: EntryPitcherLine) => plainCellOf(pitcher.pitches)],
  [0x10000, (pitcher: EntryPitcherLine) => plainCellOf(pitcher.walks)],
])
