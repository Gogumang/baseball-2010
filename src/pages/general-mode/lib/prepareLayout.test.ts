import { describe, expect, it } from 'vitest'
import {
  ACE_LAYOUT, FIRST_BAT_LAYOUT, MATCH_INFO_LAYOUT, aceCellPositionOf, firstBatTagPlacementOf, isAceCellDimmed,
  isAceGridCursorOn, isPrepareBobOn, stadiumArrowsOf, stadiumInfoValuesOf,
} from '@/pages/general-mode/lib/prepareLayout'

/** 일반모드 준비 화면 배치 (공용 목록 페이지 0x63b15 — P6 2a) */

describe('마선수 격자 세로 기준 (S9 10절 정정 1)', () => {
  it('cy 는 **첫 줄 위쪽** 이다 — PITCHER 딱지(175) 바로 아래에 첫 줄이 온다', () => {
    const 첫줄 = aceCellPositionOf(0).y

    // 첫 열 보정 3 → 190 − 3 = 187
    expect(첫줄).toBe(187)
    // 예전에는 세로도 중심으로 읽어 첫 줄이 150 이라 PITCHER 딱지가 칸 한복판을 뚫었다
    expect(ACE_LAYOUT.rowTags[0].panel.y).toBeLessThan(첫줄)
  })

  it('세로 틈은 0x79ed5 인자 0x12 = 18 — 둘째 줄은 58 아래, BATTER 딱지(233) 밑에 온다 (0x64820)', () => {
    expect(ACE_LAYOUT.grid.vGap).toBe(18)
    expect(aceCellPositionOf(5).y).toBe(aceCellPositionOf(0).y + 58)
    expect(aceCellPositionOf(5).y).toBeGreaterThan(ACE_LAYOUT.rowTags[1].panel.y)
    // 4·5번째 열은 0xd40b8 보정 13
    expect(aceCellPositionOf(8).y).toBe(190 + 58 - 13)
  })
})

describe('격자 칸 · 깜빡임 · 흐린 칸 (0x7a571 종류 7)', () => {
  it('칸 x 는 20 + 40열 — 칸너비 0xd1df8 = [40 ×5] · 가로틈 0', () => {
    expect([0, 1, 4].map((cell) => aceCellPositionOf(cell).x)).toEqual([20, 60, 180])
  })

  it('커서 깜빡임 [격자+0x18] % 8 ≤ 4', () => {
    expect([1, 4, 5, 6, 8].map(isAceGridCursorOn)).toEqual([true, true, false, false, true])
  })

  it('마투수 단계는 마타자 칸을, 마타자 단계는 고른 마투수 밖의 마투수 칸을 흐린다 (0x7b1d0)', () => {
    expect([0, 4, 5, 9].map((cell) => isAceCellDimmed(cell, true, null))).toEqual([false, false, true, true])
    expect([0, 2, 5].map((cell) => isAceCellDimmed(cell, false, 2))).toEqual([true, false, false])
  })
})

describe('공용 목록 깜빡 [sp+0xd4] (0x63b4a)', () => {
  it('틱 % 6 ≤ 3 이면 켜진다', () => {
    expect([0, 3, 4, 5, 6].map(isPrepareBobOn)).toEqual([true, true, false, false, true])
  })

  it('선공 꼬리표 — 꺼지면 유저 (A + 25, A − 47) · 글 (A + 32, A − 45), 켜지면 바깥으로 2px', () => {
    const A = { x: 52, y: 110 }
    expect(firstBatTagPlacementOf(true, A, false)).toEqual({ tag: { x: 77, y: 63 }, text: { x: 84, y: 65 } })
    expect(firstBatTagPlacementOf(true, A, true)).toEqual({ tag: { x: 79, y: 61 }, text: { x: 86, y: 63 } })
    const B = { x: 188, y: 92 }
    expect(firstBatTagPlacementOf(false, B, true)).toEqual({ tag: { x: 130, y: 51 }, text: { x: 132, y: 53 } })
  })

  it('구장 화살 (30, 201) · (205, 201) — 구장 단계에서 깜빡이면 움직일 수 있는 쪽으로 2px', () => {
    expect(FIRST_BAT_LAYOUT.arrow.y).toBe(201)
    expect(stadiumArrowsOf(false, true, 3, 10)).toEqual({ leftX: 30, rightX: 205 })
    expect(stadiumArrowsOf(true, true, 3, 10)).toEqual({ leftX: 28, rightX: 207 })
    expect(stadiumArrowsOf(true, true, 0, 10)).toEqual({ leftX: 30, rightX: 207 })
    expect(stadiumArrowsOf(true, false, 3, 10)).toEqual({ leftX: 30, rightX: 205 })
  })

  it('경기정보 값 칸 — 유저 (16, 줄y + 3) · CPU 뒤집어 (138, 줄y − 3), 이미지 10 은 86×15', () => {
    expect(MATCH_INFO_LAYOUT.valueCell).toMatchObject({ userX: 16, cpuX: 138, userDy: 3, cpuDy: -3, width: 86 })
  })
})

describe('구장 값 두 줄 — 0xba269 폭 −1 (0x646ca · 0x6472c)', () => {
  it('가운데 = x + (날 글 폭 >> 1) — 연고지 x 174 · 좌석 x 165, 서식 글자까지 잰다', () => {
    // "!C!cffffff인천" = 영문 10 × 6 + 한글 2 × 10 − 1 = 79 → 174 + 39
    // "!C!cffffff25000석" = 영문 15 × 6 + 한글 10 − 1 = 99 → 165 + 49
    expect(stadiumInfoValuesOf({ city: '인천', capacity: 25000 })).toEqual([
      { text: '인천', centerX: 213 },
      { text: '25000석', centerX: 214 },
    ])
    expect(FIRST_BAT_LAYOUT.infoValues.map(({ y }) => y)).toEqual([222, 242])
  })
})
