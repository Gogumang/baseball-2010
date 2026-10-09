import { describe, expect, it } from 'vitest'
import { holderPlateLayoutOf, holderRingPointOf } from '@/pages/defense/lib/holderMarkLayout'

const 화면 = { width: 240, height: 320 }

describe('공 가진 야수 고리 0x43cb0', () => {
  it('야수 화면점에서 프레임 46 상자(23×18)의 절반(11 · 9)씩 당긴다', () => {
    expect(holderRingPointOf({ x: 120, y: 196 })).toEqual({ x: 109, y: 187 })
  })
})

describe('오른쪽 아래 이름 판 0x43e3e~0x43fc2', () => {
  it('판(49×15)은 (W − 51, H − 17), 칸 아이콘(칸 + 0x20)은 그 왼쪽에 붙는다', () => {
    // 3 1루 → 0x54590 = (칸 5, 글자 0xad) → 아이콘 game_ui 37(36×15)
    const layout = holderPlateLayoutOf(2, { name: '김일루', positionCode: 3 }, 화면)
    expect(layout?.plate).toEqual({ x: 189, y: 303 })
    expect(layout?.chipFrame).toBe(37)
    expect(layout?.chip).toEqual({ x: 153, y: 303, width: 36, height: 15 })
    expect(layout?.label).toBe(0xad)
    // img_text 173 은 15×10 → 아이콘 상자 안 가운데: x + (36 − 15) >> 1 = +10, y + halfUp(5) = +3
    expect(layout?.labelAt).toEqual({ x: 163, y: 306 })
  })

  it('투수 칸은 0x545e8(보직) — 선발은 칸 4 → 아이콘 36, 글자 49', () => {
    const layout = holderPlateLayoutOf(0, { name: '선발투수', pitcherRole: 0 }, 화면)
    expect(layout?.chipFrame).toBe(36)
    expect(layout?.label).toBe(49)
  })

  it('보직 3(표 밖)이면 칸이 처음 값 0 그대로라 판을 안 그린다 (43ea8 `bgt`)', () => {
    expect(holderPlateLayoutOf(0, { name: '?', pitcherRole: 3 }, 화면)).toBeNull()
  })

  it('수비 코드 0(자리 없음)은 칸 −1 → 판 없음, 9 넘는 코드도 0 그대로라 판 없음', () => {
    expect(holderPlateLayoutOf(5, { name: '후보', positionCode: 0 }, 화면)).toBeNull()
    expect(holderPlateLayoutOf(5, { name: '?', positionCode: 0xa }, 화면)).toBeNull()
  })

  it('지명(1) · 외야(7~9)는 칸 7 · 4 → 아이콘 39 · 36', () => {
    expect(holderPlateLayoutOf(1, { name: 'a', positionCode: 1 }, 화면)?.chipFrame).toBe(39)
    expect(holderPlateLayoutOf(8, { name: 'b', positionCode: 9 }, 화면)?.chipFrame).toBe(36)
  })
})
