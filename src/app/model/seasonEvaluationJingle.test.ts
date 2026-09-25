import { describe, expect, it } from 'vitest'
import { seasonEvaluationJingleIdOf } from '@/app/model/useSeasonSession'

/**
 * 시즌 모드 경기 뒤 평가 징글 (원본 0xdeae~0xdede, 상태 0xe9 관중·수입 창).
 * 나만의리그(문턱 1)와 **문턱만 다르다** — 시즌은 `0xdece cmp r3,#3` 이라 3 이다.
 */
describe('시즌 경기 평가 징글 36·37·38', () => {
  it('인기도 변화가 음수면 38 (0xdebc)', () => {
    expect(seasonEvaluationJingleIdOf(-1)).toBe(38)
    expect(seasonEvaluationJingleIdOf(-10)).toBe(38)
  })

  it('0~3 이면 37 — 문턱 3 은 "보통" 쪽에 든다 (`bgt`)', () => {
    expect(seasonEvaluationJingleIdOf(0)).toBe(37)
    expect(seasonEvaluationJingleIdOf(3)).toBe(37)
  })

  it('3 을 넘으면 36 (0xdeda)', () => {
    expect(seasonEvaluationJingleIdOf(4)).toBe(36)
  })
})
