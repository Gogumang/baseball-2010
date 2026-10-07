import { describe, expect, it } from 'vitest'
import {
  averageGlyphsOf, earnedRunAverageGlyphsOf, SEASON_YEAR_GOAL_LABEL_SET, YEAR_GOAL_BOXES, YEAR_GOAL_PERCENT_FRAME,
  yearGoalWindowLayoutOf,
} from '@/pages/story/lib/yearGoalWindow'
import type { SeasonYearGoalWindowValues } from '@/pages/story/lib/yearGoalWindow'

/** 첫 값 줄 = 박스 3/4 의 머리 다음 줄 (y 88 + 17) */
const 현재1 = { ...YEAR_GOAL_BOXES.current, y: 105 }

describe('올해의 목표 창 배치 — 0x86fdc · 0x8656c', () => {
  it('제목은 팔레트 3 으로 박스 1 가운데, 이름은 박스 2 오른끝 · 줄마다 17 아래', () => {
    const { texts } = yearGoalWindowLayoutOf({ labelSet: 2, current: [0, 0, 0, 0, 0], goals: [0, 0, 0, 0, 0] })
    expect(texts[0]).toEqual({ frame: 358, x: 40, y: 69, palette: 3 })
    // 세이브 묶음 — 0xd41d6[10..14]
    expect(texts.slice(1, 6).map((piece) => piece.frame)).toEqual([316, 328, 407, 317, 327])
    // "세이브P"(39) 는 박스(35) 보다 넓어 왼쪽으로 삐져나온다 — 원본 그대로
    expect(texts[3]).toEqual({ frame: 407, x: 41 + 35 - 39, y: 105 + 2 * 17 + 3, palette: 0 })
    expect(texts[6]).toEqual({ frame: 87, x: 97, y: 91, palette: 0 })
    expect(texts[7]).toEqual({ frame: 148, x: 157, y: 91, palette: 0 })
  })

  it('숫자는 자간 1 · 주황(기준 20) · 오른끝 −4 — "12" 는 폭 (4+1)+(6+1)', () => {
    const { numbers } = yearGoalWindowLayoutOf({ labelSet: 0, current: [0, 12, 0, 0, 0], goals: [0, 0, 0, 0, 0] })
    const 안타 = numbers.filter((piece) => piece.y === 105 + 17 + 3 && piece.x < 140)
    expect(안타).toEqual([{ frame: 21, x: 81 - 4 + 55 - 12, y: 125 }, { frame: 22, x: 81 - 4 + 55 - 7, y: 125 }])
  })

  it('타율 0x8633c — 0.305: 세 자리 소수, 칸은 "0" 폭으로 잰다, 소수점은 −26 · oy 5', () => {
    const 조각 = averageGlyphsOf(305, 현재1)
    expect(조각).toEqual([
      { frame: 23, x: 111, y: 108 }, { frame: 20, x: 118, y: 108 }, { frame: 25, x: 125, y: 108 },
      // 소수점: 81 − 26 + 55 − 1, 105 + 5 + 6
      { frame: 103, x: 109, y: 116 },
      // 정수 0 을 −27 에: 81 − 27 + 55 − 7
      { frame: 20, x: 102, y: 108 },
    ])
  })

  it('타율 0.05 — 앞 0 을 채운다(f = 50 → 한 자리 모자람)', () => {
    const frames = averageGlyphsOf(50, 현재1).map((piece) => piece.frame)
    expect(frames).toEqual([25, 20, 20, 103, 20])
  })

  it('방어율 0x86248 — 3.05: 소수 ≤ 9 면 앞에 0, 소수점 −19, 정수 −20', () => {
    const 조각 = earnedRunAverageGlyphsOf(305, 현재1)
    expect(조각).toEqual([
      { frame: 25, x: 125, y: 108 },
      { frame: 20, x: 118, y: 108 },
      { frame: 103, x: 116, y: 116 },
      { frame: 23, x: 109, y: 108 },
    ])
  })
})

describe('올해의 목표 창 — 시즌모드(모드 2) 갈래 0x8656c', () => {
  /** 1년차: 현재 [순위 3 · 승률 57% · 0.281 · 3.45 · 인기도 12] / 목표 0xd4406[0..4] */
  const 값: SeasonYearGoalWindowValues = { labelSet: SEASON_YEAR_GOAL_LABEL_SET, current: [3, 57, 281, 345, 12], goals: [4, 55, 250, 390, 50] }

  it('이름은 0xd41f4 [순위 · 승률 · 타율 · 방어 · 인기도] — 제목·머리는 같은 창', () => {
    const { texts } = yearGoalWindowLayoutOf(값)
    expect(texts.map((piece) => piece.frame)).toEqual([358, 47, 330, 318, 316, 327, 87, 148])
    // "순위"(20) 오른끝 정렬
    expect(texts[1]).toEqual({ frame: 47, x: 41 + 35 - 20, y: 108, palette: 0 })
  })

  it('승률은 숫자를 ox −10 에, "%"(num 106, 6×8)를 ox −2 · oy 1 에 — 현재·목표 둘 다', () => {
    const { numbers } = yearGoalWindowLayoutOf(값)
    const 퍼센트 = numbers.filter((piece) => piece.frame === YEAR_GOAL_PERCENT_FRAME)
    // 둘째 값 줄 y = 105 + 17, oy 1 + trunc((15 − 8)/2)
    expect(퍼센트).toEqual([
      { frame: 106, x: 81 - 2 + 55 - 6, y: 122 + 1 + 3 },
      { frame: 106, x: 140 - 2 + 55 - 6, y: 122 + 1 + 3 },
    ])
    // 57 — "7"(폭 6 + 자간 1) 오른끝이 81 − 10 + 55
    const 승률 = numbers.filter((piece) => piece.y === 125 && piece.x < 140 && piece.frame !== 106)
    expect(승률.map((piece) => piece.frame)).toEqual([25, 27])
    expect(승률[1]!.x + 7).toBe(81 - 10 + 55)
  })

  it('셋째 줄은 타율(0x8633c) · 넷째 줄은 방어율(0x86248) — 둘 다 소수점이 있다', () => {
    const { numbers } = yearGoalWindowLayoutOf(값)
    const 셋째 = { ...YEAR_GOAL_BOXES.current, y: 105 + 2 * 17 }
    const 넷째 = { ...YEAR_GOAL_BOXES.current, y: 105 + 3 * 17 }
    expect(numbers).toEqual(expect.arrayContaining([...averageGlyphsOf(281, 셋째), ...earnedRunAverageGlyphsOf(345, 넷째)]))
    expect(numbers.filter((piece) => piece.frame === 103)).toHaveLength(4)
  })
})
