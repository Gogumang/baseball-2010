import { describe, expect, it } from 'vitest'
import { heldBallTickOf } from '@/widgets/batting-stage/lib/heldBall'

describe('상태 0x12 의 공 — 0x4ce9c 가 0x3b2f4 를 불러 마지막 점에 그린다', () => {
  it('안 친 공 · 헛스윙의 결과(0x12)는 0x12 를 연 0x11 마지막 그림의 공 틱 N + 1 을 넘겨 마지막 점(N − 1 로 잘림)에 그린다', () => {
    expect(heldBallTickOf({ kind: '결과', tick: 0, isPaused: false }, 23)).toBe(24)
    expect(heldBallTickOf({ kind: '결과', tick: 17, isPaused: false, isInPlay: false }, 23)).toBe(24)
  })

  it('맞은 공 뒤 인플레이(0x17) · 대기 · 투구중 · 타격 · 단계 모름은 이 길이 아니다', () => {
    expect(heldBallTickOf({ kind: '결과', tick: 0, isPaused: false, isInPlay: true }, 23)).toBeNull()
    expect(heldBallTickOf({ kind: '대기', tick: 0, isPaused: false }, 23)).toBeNull()
    expect(heldBallTickOf({ kind: '투구중', tick: 0, isPaused: false }, 23)).toBeNull()
    expect(heldBallTickOf({ kind: '타격', tick: 0, isPaused: false }, 23)).toBeNull()
    expect(heldBallTickOf(undefined, 23)).toBeNull()
  })
})
