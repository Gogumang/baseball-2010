import { describe, expect, it } from 'vitest'
import {
  ENTRY_TABLES_BASIC,
  ENTRY_TABLES_WIDE,
  entryColumnOf,
  entryCursorBorderOf,
  entryCursorRectOf,
  entryListGeometryOf,
  entryPickedFillOf,
  entryRotationCellOf,
  entryRowYOf,
  entrySlideOffsetOf,
  entryStaminaLinesOf,
  entryStaminaPercentOf,
  entryStatCellOf,
} from '@/widgets/entry-editor/lib/entryListWindow'

/**
 * 엔트리 목록 창 0x5cfec → 0x5c984 — 기대값은 unicorn 으로 0x5cfec 를 그대로 돌려 받은 그리기 인자다(r89).
 */
describe('엔트리 목록 창 0x5c984', () => {
  it('기본 표 타자 탭 — 고정 열 타순(20) · 이름(48), 넘기는 열 수비 딱지(105) · 타율(144) · 홈런(183), 자르기 (105, 58, 117, 221)', () => {
    const g = entryListGeometryOf({ table: ENTRY_TABLES_BASIC.batter, firstColumn: 0, slideOffset: 0, keyPresses: 0 })
    expect(g.fixed.map((placed) => [placed.column.kind, placed.x])).toEqual([
      ['타순', 20],
      ['이름', 48],
    ])
    expect(g.scroll.map((placed) => [placed.column.kind, placed.x])).toEqual([
      ['딱지', 105],
      ['기록', 144],
      ['기록', 183],
    ])
    expect(g.clip).toEqual({ x: 105, y: 58, width: 117, height: 221 })
    expect(g.leftArrow).toBeNull()
    expect(g.rightArrow).toBeNull()
  })

  it('머리 글 — 타순 36 · 이름 27 · 딱지 28 · 순서 202 · 기록 0x56dd4 (타율 172 · 홈런 61 · 방어 171 · 삼진 181 · 실책 212)', () => {
    expect([0x1000000, 0x2000000, 0x10000000, 0x8000000].map((word) => entryColumnOf(word).headerFrame)).toEqual([36, 27, 28, 202])
    expect([0, 0x10, 0x100, 0x4000, 0x80].map((word) => entryColumnOf(word).headerFrame)).toEqual([172, 61, 171, 181, 212])
    expect([0x1000000, 0x2000000, 0x10000000, 0].map((word) => entryColumnOf(word).cellFrame)).toEqual([0x1b, 0x1c, 0x23, 0x23])
  })

  it('넓은 표는 옆 화살 slt 20 — 첫 열 0: 오른쪽만 (219, 62) · 첫 열 2: (98, 62) · (219, 62) · 첫 열 7: 왼쪽만', () => {
    const at = (firstColumn: number) => entryListGeometryOf({ table: ENTRY_TABLES_WIDE.batter, firstColumn, slideOffset: 0, keyPresses: 0 })
    expect(at(0).leftArrow).toBeNull()
    expect(at(0).rightArrow).toEqual({ x: 219, y: 62 })
    expect(at(0).scroll.map((placed) => [placed.index, placed.x])).toEqual([
      [0, 105],
      [1, 144],
      [2, 183],
      [3, 222],
    ])
    expect(at(2).leftArrow).toEqual({ x: 98, y: 62 })
    expect(at(2).scroll.map((placed) => [placed.index, placed.x])).toEqual([
      [1, 66],
      [2, 105],
      [3, 144],
      [4, 183],
      [5, 222],
    ])
    expect(at(7).rightArrow).toBeNull()
    expect(at(7).scroll.map((placed) => [placed.index, placed.x])).toEqual([
      [6, 66],
      [7, 105],
      [8, 144],
      [9, 183],
    ])
  })

  it('열 밀기 — 표 0xd1bbc 단계 3 = 13px: 다음 열이면 첫 그린 열이 105 − 39 − 13 = 53', () => {
    const offset = entrySlideOffsetOf({ step: 3, direction: 'next' }, 2, 10)
    expect(offset).toBe(-13)
    const g = entryListGeometryOf({ table: ENTRY_TABLES_WIDE.batter, firstColumn: 2, slideOffset: offset, keyPresses: 0 })
    expect(g.scroll[0]).toMatchObject({ index: 1, x: 53 })
    expect(entrySlideOffsetOf({ step: 0, direction: 'previous' }, 0, 10)).toBe(0)
  })

  it('커서 0x56234 · 고른 줄 0x563dc — 투수 탭 커서 줄 2 · 고른 줄 4 (키 셈 0 이라 안쪽 반투명)', () => {
    const g = entryListGeometryOf({ table: ENTRY_TABLES_BASIC.pitcher, firstColumn: 0, slideOffset: 0, keyPresses: 0 })
    const cursor = entryCursorRectOf({ geometry: g, rowY: entryRowYOf(2, 0), subTab: 0, isNameOnly: false, badgeX: 105 })
    expect(cursor).toEqual({ x: 48, y: 119, width: 93, height: 15 })
    expect(entryCursorBorderOf(cursor!, 0)).toMatchObject({ x: 49, y: 120, width: 91, height: 13 })
    expect(entryCursorBorderOf(cursor!, 4)).toMatchObject({ x: 48, y: 119, width: 93, height: 15, color: '#ffff00' })
    expect(entryPickedFillOf({ geometry: g, rowY: entryRowYOf(4, 0), subTab: 0, badgeX: 105 })).toEqual({ x: 49, y: 156, width: 91, height: 13 })
    // 스페셜 에디트 [skin+0x438] = 1 — 이름 칸만 · 수비위치 탭 — 딱지 칸만
    expect(entryCursorRectOf({ geometry: g, rowY: 83, subTab: -1, isNameOnly: true, badgeX: 105 })?.width).toBe(54)
    expect(entryCursorRectOf({ geometry: g, rowY: 83, subTab: 1, isNameOnly: false, badgeX: 105 })).toEqual({ x: 105, y: 83, width: 36, height: 15 })
    // 보기 전용은 고른 줄을 안 그린다
    expect(entryPickedFillOf({ geometry: g, rowY: 83, subTab: -1, badgeX: 105 })).toBeNull()
  })

  it('기록 칸 — 타율 소수(v > 999 ? 3 : 0) · 방어율 (v > 100 ? ×10 : v, 3) · 이닝 아웃/3 · 실책 +0x2e', () => {
    const batter = { atBats: 40, hits: 12, doubles: 1, triples: 0, homeRuns: 3, runsBattedIn: 9, steals: 2, errors: 5 }
    const pitcher = { outs: 30, runsAllowed: 9, saves: 0, strikeouts: 7, pitches: 150, walks: 4, wins: 2, losses: 1 }
    expect(entryStatCellOf(0, batter, undefined)).toEqual({ value: 300, digits: 0, isDecimal: true })
    expect(entryStatCellOf(0x80, batter, undefined)).toEqual({ value: 5, digits: -1, isDecimal: false })
    expect(entryStatCellOf(0x100, undefined, pitcher)).toEqual({ value: 8100, digits: 3, isDecimal: true })
    expect(entryStatCellOf(0x200, undefined, pitcher)?.value).toBe(10)
    expect(entryStatCellOf(0x10000, undefined, pitcher)?.value).toBe(4)
    expect(entryStatCellOf(0x10, undefined, pitcher)).toBeNull()
  })

  it('등판 순서 열 0x56721 — 줄 0 "등판"(53) · 1~3 숫자 줄 + 1 · 그 밖 "-"', () => {
    expect([0, 1, 3, 4].map(entryRotationCellOf)).toEqual([{ today: true }, { number: 2 }, { number: 4 }, { dash: true }])
  })

  it('체력 줄 0x571d8 — M 500 · S 80 → 녹 20 · 빨 16, S 는 모드 1·2·3·4·8·9 만 +0x2c / 100', () => {
    expect(entryStaminaLinesOf(500, 80)).toEqual({ length: 20, current: 16 })
    expect(entryStaminaPercentOf(2, 8000)).toBe(80)
    expect(entryStaminaPercentOf(5, 8000)).toBe(100)
  })
})
