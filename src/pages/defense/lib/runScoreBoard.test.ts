import { describe, expect, it } from 'vitest'
import {
  RUN_SCORE_BOARD_FRAME_AT, RUN_SCORE_BOARD_TICKS, RUN_SCORE_SLOTS, drawRunScoreBoard, runScoreBoardScoresOf,
  runScoreBoardSourceOf, runScoreGlyphsOf, EMPTY_HOME_RUN_SCORE_BOARD, drawHomeRunScoreBoard, homeRunScoreBoardRunIn,
  runScoreBoardHiddenScoresOf,
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

describe('수비 재생에 넘길 득점 점수판 재료 (팀경기 · 투수편 · 타자편 공통)', () => {
  const sides = ['측0', '측1'] as const
  it('선공(측 0)이면 내 점수가 왼쪽, 초면 공격 측 0', () => {
    expect(runScoreBoardSourceOf({ playerSide: 0, ourScore: 3, opponentScore: 1, half: '초' }, sides))
      .toEqual({ sides, scores: [3, 1], battingSide: 0 })
  })
  it('후공(측 1)이면 상대 점수가 왼쪽, 말이면 공격 측 1', () => {
    expect(runScoreBoardSourceOf({ playerSide: 1, ourScore: 3, opponentScore: 1, half: '말' }, sides))
      .toEqual({ sides, scores: [1, 3], battingSide: 1 })
  })
})

describe('득점 점수판 홈런 갈래 (0x52030 · 0x41a9e)', () => {
  const 그리기 = (board: ReturnType<typeof homeRunScoreBoardRunIn>) => {
    const hidden: number[] = []
    let current = board
    for (let i = 0; i < 200; i += 1) {
      const drawn = drawHomeRunScoreBoard(current)
      current = drawn.next
      if (!drawn.visible) break
      hidden.push(drawn.hiddenRuns)
    }
    return hidden
  }

  it('솔로 — 타자주자가 들어오면 간격 20 · 타이머 20: 21번은 앞 점수(−1), 그 뒤 20번은 새 점수, 그리고 내린다', () => {
    const board = homeRunScoreBoardRunIn(EMPTY_HOME_RUN_SCORE_BOARD, true)
    expect(board).toEqual({ count: 1, gap: 20, timer: 20, active: true })
    const hidden = 그리기(board)
    expect(hidden.filter((n) => n === 1)).toHaveLength(21)
    expect(hidden.filter((n) => n === 0)).toHaveLength(20)
    expect(hidden).toHaveLength(41)
  })

  it('만루 — 앞 주자 셋은 판을 내린 채 세고, 타자주자에서 n = 4 · 간격 10 · 타이머 40 으로 1점씩 올라간다', () => {
    let board = EMPTY_HOME_RUN_SCORE_BOARD
    for (let i = 0; i < 3; i += 1) board = homeRunScoreBoardRunIn(board, false)
    expect(board).toMatchObject({ count: 3, timer: 0, active: false })
    expect(drawHomeRunScoreBoard(board).visible).toBe(false)
    board = homeRunScoreBoardRunIn(board, true)
    expect(board).toEqual({ count: 4, gap: 10, timer: 40, active: true })
    const hidden = 그리기(board)
    expect([...new Set(hidden)]).toEqual([4, 3, 2, 1, 0])
    expect(hidden.filter((n) => n === 4)).toHaveLength(11)
    expect(hidden.filter((n) => n === 0)).toHaveLength(10)
  })

  it('공격 쪽에서 감춘 수를 뺀다', () => {
    expect(runScoreBoardHiddenScoresOf([5, 2], 0, 3)).toEqual([2, 2])
    expect(runScoreBoardHiddenScoresOf([5, 2], 1, 1)).toEqual([5, 1])
  })
})
