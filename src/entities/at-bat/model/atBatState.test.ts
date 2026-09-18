import { describe, expect, it } from 'vitest'
import { applyPitchResolution, createAtBat, isAtBatFinished } from '@/entities/at-bat/model/atBatState'
import type { AtBatState, PitchResolution } from '@/entities/at-bat/model/atBatState'

const 스트라이크: PitchResolution = { kind: '스트라이크', isSwinging: true }
const 볼: PitchResolution = { kind: '볼' }
const 파울: PitchResolution = { kind: '파울' }

function 연속적용(state: AtBatState, resolutions: PitchResolution[]): AtBatState {
  return resolutions.reduce(applyPitchResolution, state)
}

describe('atBatState', () => {
  it('새 타석은 0볼 0스트라이크로 시작한다', () => {
    const state = createAtBat()

    expect(state).toEqual({ balls: 0, strikes: 0, outcome: null })
    expect(isAtBatFinished(state)).toBe(false)
  })

  it('스트라이크 세 개면 삼진으로 타석이 끝난다', () => {
    const state = 연속적용(createAtBat(), [스트라이크, 스트라이크, 스트라이크])

    expect(state.outcome).toEqual({ kind: '삼진' })
    expect(isAtBatFinished(state)).toBe(true)
  })

  it('볼 네 개면 볼넷으로 타석이 끝난다', () => {
    const state = 연속적용(createAtBat(), [볼, 볼, 볼, 볼])

    expect(state.outcome).toEqual({ kind: '볼넷' })
  })

  it('투 스트라이크 이후의 파울은 카운트를 올리지 않는다', () => {
    const state = 연속적용(createAtBat(), [스트라이크, 스트라이크, 파울, 파울, 파울])

    expect(state.strikes).toBe(2)
    expect(state.outcome).toBeNull()
  })

  it('원 스트라이크에서의 파울은 스트라이크가 된다', () => {
    const state = 연속적용(createAtBat(), [스트라이크, 파울])

    expect(state.strikes).toBe(2)
  })

  it('타석이 끝난 뒤의 투구는 상태를 바꾸지 않는다', () => {
    const 삼진 = 연속적용(createAtBat(), [스트라이크, 스트라이크, 스트라이크])

    expect(applyPitchResolution(삼진, 볼)).toBe(삼진)
  })

  it('입력 상태를 변경하지 않고 새 객체를 돌려준다', () => {
    const before = createAtBat()
    const after = applyPitchResolution(before, 스트라이크)

    expect(before.strikes).toBe(0)
    expect(after.strikes).toBe(1)
  })
})
