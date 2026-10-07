import { describe, expect, it } from 'vitest'
import {
  RUN_SCORE_BOARD_FRAME_AT, RUN_SCORE_BOARD_TICKS, RUN_SCORE_SLOTS, drawRunScoreBoard, runScoreBoardScoresOf,
  runScoreGlyphsOf,
} from '@/pages/defense/lib/runScoreBoard'

describe('수비 장면 득점 점수판 0x41a64', () => {
  it('틀은 (0, 0x32), 두 점수는 가운데 (56, 205) · (187, 205)', () => {
    expect(RUN_SCORE_BOARD_FRAME_AT).toEqual({ x: 0, y: 50 })
    expect(RUN_SCORE_SLOTS).toEqual([{ x: 56, y: 205 }, { x: 187, y: 205 }])
  })

  it('1점이면 20번 선다 — 처음 5번(t > 0xf)은 앞 점수, 나머지 15번은 새 점수, t ≤ 0 이면 안 그린다', () => {
    let timer = RUN_SCORE_BOARD_TICKS
    const frames: boolean[] = []
    for (let i = 0; i < 22; i += 1) {
      const drawn = drawRunScoreBoard(timer)
      timer = drawn.timerAfter
      if (drawn.visible) frames.push(drawn.previousScore)
    }
    expect(frames.length).toBe(20)
    expect(frames.filter(Boolean).length).toBe(5)
    expect(frames.slice(0, 5).every(Boolean)).toBe(true)
  })

  it('앞 점수는 공격 측(st[9])만 1 을 뺀다', () => {
    expect(runScoreBoardScoresOf([3, 5], 0, true)).toEqual([2, 5])
    expect(runScoreBoardScoresOf([3, 5], 1, true)).toEqual([3, 4])
    expect(runScoreBoardScoresOf([3, 5], 1, false)).toEqual([3, 5])
  })

  it('숫자 0x585ad(…, 0x46, 값, x, y, 8, 0, 2) — x 에서 폭/2 를 빼고, 셋째 글자부터 간격을 센다', () => {
    // "7" 폭 31 → x = 56 − 15
    expect(runScoreGlyphsOf(7, { x: 56, y: 205 })).toEqual([{ image: 0x46 + 7, x: 41, y: 205 }])
    // "10" 폭 22 + 32 = 54 (간격은 셋째 글자부터) → x = 187 − 27, 다음 글자는 22 + 8 뒤
    expect(runScoreGlyphsOf(10, { x: 187, y: 205 })).toEqual([
      { image: 0x47, x: 160, y: 205 },
      { image: 0x46, x: 190, y: 205 },
    ])
  })
})
