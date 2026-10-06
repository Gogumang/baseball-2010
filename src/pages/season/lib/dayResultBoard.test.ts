import { describe, expect, it } from 'vitest'
import {
  BOARD_FRAME, boardRowsOf, imageCenterOf, isWinA, isWinB, logoPanelRectsOf, rowPanelRectsOf, scoreRightOf, shifted,
} from '@/pages/season/lib/dayResultBoard'

/** 경기 뒤 마무리 판 0xb400 — 줄 고르기 b5a0 · 판 색 b44e · 로고 칸 0x860dc · WIN/LOSE b676/b6c4 */

const 표 = (scoresA: number[], scoresB: number[]) => ({
  teamsA: [1, 3, 5, 7, 9],
  teamsB: [0, 2, 4, 6, 8],
  scoresA,
  scoresB,
})

describe('줄 고르기 (b5a0~b5d6)', () => {
  it('내 경기 줄(scoreA −1)을 건너뛰고 나머지 넷을 차례대로', () => {
    const rows = boardRowsOf(표([3, 1, -1, 0, 7], [2, 5, -1, 0, 4]))
    expect(rows.map((row) => row.teamA)).toEqual([1, 3, 7, 9])
    expect(rows.map((row) => [row.scoreA, row.scoreB])).toEqual([[3, 2], [1, 5], [0, 0], [7, 4]])
  })

  it('내 경기가 마지막 줄이면 앞 넷이다', () => {
    expect(boardRowsOf(표([1, 2, 3, 4, -1], [0, 0, 0, 0, -1])).map((row) => row.teamA)).toEqual([1, 3, 5, 7])
  })
})

describe('WIN · LOSE (b676 · b6c4)', () => {
  it('더 낸 쪽이 WIN — 동점이면 ⚠️ 둘 다 LOSE (원본 그대로)', () => {
    expect([isWinA({ teamA: 0, teamB: 1, scoreA: 3, scoreB: 2 }), isWinB({ teamA: 0, teamB: 1, scoreA: 3, scoreB: 2 })])
      .toEqual([true, false])
    expect([isWinA({ teamA: 0, teamB: 1, scoreA: 2, scoreB: 2 }), isWinB({ teamA: 0, teamB: 1, scoreA: 2, scoreB: 2 })])
      .toEqual([false, false])
  })
})

describe('판 색', () => {
  it('줄 판: 검정 → (+1,+1,−2,−2) 흰색 → (+1,+1,−1,−1) #335FCD', () => {
    expect(rowPanelRectsOf(BOARD_FRAME.row)).toEqual([
      { x: 24, y: 49, width: 193, height: 56, color: '#000000', round: 1 },
      { x: 25, y: 50, width: 191, height: 54, color: '#FFFFFF', round: 1 },
      { x: 26, y: 51, width: 190, height: 53, color: '#335FCD', round: 0 },
    ])
  })

  it('로고 칸 0x860dc: (w−1,h−1) 검정 → #2033AA → 위 절반 #3045CD', () => {
    expect(logoPanelRectsOf(BOARD_FRAME.logoA)).toEqual([
      { x: 30, y: 57, width: 38, height: 37, color: '#000000', round: 1 },
      { x: 31, y: 58, width: 37, height: 36, color: '#2033AA', round: 0 },
      { x: 32, y: 59, width: 36, height: 18, color: '#3045CD', round: 0 },
    ])
  })

  it('줄마다 박스 0 높이(56)씩 내려간다', () => {
    expect(shifted(BOARD_FRAME.scoreB, 3).y).toBe(80 + 3 * 56)
  })
})

describe('가운데 맞춤', () => {
  it('WIN(19×9)은 29폭 칸에서 x + 5 · LOSE(29×9)는 그대로', () => {
    expect(imageCenterOf(BOARD_FRAME.resultA, 19, 9)).toEqual({ x: 75, y: 69 })
    expect(imageCenterOf(BOARD_FRAME.resultA, 29, 9)).toEqual({ x: 70, y: 69 })
  })

  it('점수 한 자리(6px)는 25폭 칸 가운데 — 오른쪽 끝은 왼쪽 + 전진폭', () => {
    // 왼쪽 = 71 + trunc((25 − 6) / 2) = 80, 전진 = 7
    expect(scoreRightOf(BOARD_FRAME.scoreA, 3)).toBe(87)
  })
})
