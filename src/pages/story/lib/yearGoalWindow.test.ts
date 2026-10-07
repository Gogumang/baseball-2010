import { describe, expect, it } from 'vitest'
import {
  averageGlyphsOf, earnedRunAverageGlyphsOf, YEAR_GOAL_BOXES, yearGoalWindowLayoutOf,
} from '@/pages/story/lib/yearGoalWindow'

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
