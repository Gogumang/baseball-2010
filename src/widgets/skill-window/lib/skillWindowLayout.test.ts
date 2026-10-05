import { describe, expect, it } from 'vitest'
import {
  CELL_FRAME, SKILL_CELL_BOXES, ITEM_CELL_BOXES, moveGridCursor, scrolledTopRowOf, skillCellFrameOf, skillGridRowsOf,
  skillListOf,
} from '@/widgets/skill-window/lib/skillWindowLayout'

describe('스킬 목록 0x81618 — 0~23 을 번호 차례로', () => {
  it('얻은 차례가 아니라 번호 차례이고, 24 이상은 넣지 않는다', () => {
    expect(skillListOf([22, 8, 0, 30, 5])).toEqual([0, 5, 8, 22])
  })

  it('행 수는 ceil(개수/4) 이고 3 보다 작지 않다', () => {
    expect(skillGridRowsOf(0)).toBe(3)
    expect(skillGridRowsOf(12)).toBe(3)
    expect(skillGridRowsOf(13)).toBe(4)
    expect(skillGridRowsOf(24)).toBe(6)
  })
})

describe('격자 커서 — 깃발 0x30(같은 줄 안에서 감기) · 굴림 0x6c2bd', () => {
  it('끝에서 같은 줄 반대쪽으로 감는다', () => {
    expect(moveGridCursor({ column: 3, row: 0 }, 'right', 4, 3)).toEqual({ column: 0, row: 0 })
    expect(moveGridCursor({ column: 0, row: 0 }, 'up', 4, 5)).toEqual({ column: 0, row: 4 })
  })

  it('맨 윗행은 커서가 보이게만 옮긴다', () => {
    expect(scrolledTopRowOf(0, 3)).toBe(1)
    expect(scrolledTopRowOf(1, 2)).toBe(1)
    expect(scrolledTopRowOf(2, 0)).toBe(0)
  })
})

describe('칸 그림 — 장착 안 됨 49, 장착이면 0x5f350 비트로 46·47·48', () => {
  it.each([
    [0, true, CELL_FRAME.파랑], [12, true, CELL_FRAME.파랑], [3, true, CELL_FRAME.주황], [19, true, CELL_FRAME.주황],
    [6, true, CELL_FRAME.보라], [22, true, CELL_FRAME.보라], [0, false, CELL_FRAME.회색],
  ])('스킬 %i 장착 %s → %i', (skillId, isEquipped, frame) => {
    expect(skillCellFrameOf(skillId, isEquipped)).toBe(frame)
  })
})

describe('배치 프레임 박스 (mode_ui 35 · 34)', () => {
  it('스킬 칸은 41×25 열둘, 서브아이템 칸은 33×33 열', () => {
    expect(SKILL_CELL_BOXES).toHaveLength(12)
    expect(SKILL_CELL_BOXES[5]).toEqual({ x: 78, y: 100, width: 41, height: 25 })
    expect(ITEM_CELL_BOXES).toHaveLength(10)
    expect(ITEM_CELL_BOXES[9]).toEqual({ x: 174, y: 115, width: 33, height: 33 })
  })
})
