import { describe, expect, it } from 'vitest'
import { gridOpenAfter, gridOpenCellDy, gridOpenDrawAt, gridOpenStart } from '@/shared/lib/gridOpen/gridOpen'
import type { GridOpenShape } from '@/shared/lib/gridOpen/gridOpen'

/** 마선수 격자 — 2줄 · 줄높이 40 · 세로틈 18 · 시프트 1 (0x64818~0x6482c) */
const ACE: GridOpenShape = { rows: 2, columns: 5, rowHeight: 40, rowGap: 18, shift: 1 }
/** 팀 15칸 — 3줄 · 40 · 0 · 1 */
const TEAM: GridOpenShape = { rows: 3, columns: 5, rowHeight: 40, rowGap: 0, shift: 1 }
/** 미션 고르기 — 3줄 · 28 · 2 · 2 (0x1e184~0x1e19c) */
const MISSION: GridOpenShape = { rows: 3, columns: 5, rowHeight: 28, rowGap: 2, shift: 2 }

const doneDrawOf = (shape: GridOpenShape) => {
  let draw = 0
  while (!gridOpenDrawAt(shape, draw, true).isDoneAfter) draw += 1
  return draw
}

describe('격자 열림 애니 0x79fa8 (S9 3-3)', () => {
  it('시작 0x7a005 — 애니면 마지막 줄만 1 내려간 채, 아니면 다 연 채', () => {
    expect(gridOpenStart(TEAM, true)).toEqual({ revealFrom: 10, slide: 1, speed: 1, shown: 1, isDone: false })
    expect(gridOpenStart(TEAM, false)).toEqual({ revealFrom: 0, slide: 80, speed: 1, shown: 2, isDone: true })
  })

  it('속도는 걸음마다 시프트만큼 커지고 줄에 닿으면 1 로 돌아간다 — 마선수 1 · 3 · 7 · 15 · 31 → 58', () => {
    expect([0, 1, 2, 3, 4, 5].map((steps) => gridOpenAfter(ACE, steps).slide)).toEqual([1, 3, 7, 15, 31, 58])
    expect(gridOpenAfter(ACE, 5).isDone).toBe(true)
  })

  it('팀 3줄은 40 에서 한 번 멈췄다가 80 에서 끝난다', () => {
    expect([4, 5, 6, 7, 8, 9, 10].map((steps) => gridOpenAfter(TEAM, steps).slide)).toEqual([31, 40, 42, 46, 54, 70, 80])
    expect(gridOpenAfter(TEAM, 9).isDone).toBe(false)
    expect(gridOpenAfter(TEAM, 10).isDone).toBe(true)
  })

  it('[skin+0xe4] 가 서는 그림 — 마선수 4 · 팀 9 · 미션(시프트 2) 5 (그 그림이 남긴 값)', () => {
    expect(doneDrawOf(ACE)).toBe(4)
    expect(doneDrawOf(TEAM)).toBe(9)
    expect(doneDrawOf(MISSION)).toBe(5)
  })

  it('칸 자리 — 겹친 칸은 첫 줄 자리, 미끄럼 칸은 마지막 줄부터 떨어진다', () => {
    const first = gridOpenAfter(TEAM, 0)
    // 칸 0~9 는 첫 줄 자리 (줄 1 은 −40)
    expect(gridOpenCellDy(TEAM, first, 0)).toBe(0)
    expect(gridOpenCellDy(TEAM, first, 7)).toBe(-40)
    // 마지막 줄 칸 10 은 위쪽 y + 1 — 다 연 자리(80)에서 −79
    expect(gridOpenCellDy(TEAM, first, 10)).toBe(-79)
    const mid = gridOpenAfter(TEAM, 6)
    expect(mid.revealFrom).toBe(5)
    expect(gridOpenCellDy(TEAM, mid, 5)).toBe(42 - 40 - 40)
    expect(gridOpenCellDy(TEAM, mid, 0)).toBe(0)
    const done = gridOpenAfter(TEAM, 10)
    expect([0, 7, 14].map((index) => gridOpenCellDy(TEAM, done, index))).toEqual([0, 0, 0])
  })
})
