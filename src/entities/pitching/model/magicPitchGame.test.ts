import { describe, expect, it } from 'vitest'
import {
  advanceMagicPitchGameState,
  createMagicPitchGameState,
  isAceMagicNumber,
} from '@/entities/pitching/model/magicPitchGame'
import { MAGIC_PITCH_TYPE_NUMBER } from '@/entities/pitcher-career/model/magicPitch'
import { ACE_PITCHER_REPERTOIRES, ROSTER_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'

const FASTBALL = 1

describe('magicPitchGame — 한 경기 마구 상태 (0xaebe4 · 0x345fc · 0x3de10)', () => {
  it('마투수 레코드 +0x18 은 5~9 다 (H2 4-1)', () => {
    expect(ACE_PITCHER_REPERTOIRES.map((ace) => ace.magicId)).toEqual([5, 6, 7, 8, 9])
    expect(ACE_PITCHER_REPERTOIRES.every((ace) => isAceMagicNumber(ace.magicId))).toBe(true)
    expect(isAceMagicNumber(4)).toBe(false)
  })

  it('일반 투수는 +0x18 이 0 이라 남은 횟수가 0 이다', () => {
    const state = createMagicPitchGameState(ROSTER_PITCHER_REPERTOIRES[0])
    expect(ROSTER_PITCHER_REPERTOIRES.every((pitcher) => pitcher.magicId === 0)).toBe(true)
    expect(state).toEqual({ remaining: 0, ballMagicNumber: 0 })
  })

  it('마투수 Lv1 은 표 0xd8509 의 3 회로 시작한다', () => {
    expect(createMagicPitchGameState(ACE_PITCHER_REPERTOIRES[0]).remaining).toBe(3)
    expect(createMagicPitchGameState(ACE_PITCHER_REPERTOIRES[0], { aceLevel: 4 }).remaining).toBe(7)
    expect(createMagicPitchGameState(ACE_PITCHER_REPERTOIRES[0], { hasSpiritSkill: true }).remaining).toBe(5)
  })

  it('첫 마구는 공짜다 — 소모 조건이 `공+0x10 != 0` 인 원본 버그 그대로', () => {
    const state = { remaining: 3, ballMagicNumber: 0 }
    advanceMagicPitchGameState(state, MAGIC_PITCH_TYPE_NUMBER, 5)
    expect(state).toEqual({ remaining: 3, ballMagicNumber: 5 })
    advanceMagicPitchGameState(state, MAGIC_PITCH_TYPE_NUMBER, 5)
    expect(state).toEqual({ remaining: 2, ballMagicNumber: 5 })
  })

  it('마구가 아닌 공에도 공+0x10 이 남는다 — 되돌리는 코드가 원본에 없다 (H2 3-4)', () => {
    const state = { remaining: 3, ballMagicNumber: 0 }
    advanceMagicPitchGameState(state, MAGIC_PITCH_TYPE_NUMBER, 5)
    advanceMagicPitchGameState(state, FASTBALL, 5)
    expect(state.ballMagicNumber).toBe(5)
    expect(state.remaining).toBe(3)
  })

  it('마지막 한 번(남은 1→0)은 공+0x10 을 새로 쓰지 않는다 (0x3de10 의 `남은 > 0`)', () => {
    const state = { remaining: 1, ballMagicNumber: 9 }
    advanceMagicPitchGameState(state, MAGIC_PITCH_TYPE_NUMBER, 9)
    // 소모로 0 이 되어 싣기 가지를 못 타지만, 직전 값이 남아 마구 보정은 그대로 붙는다
    expect(state).toEqual({ remaining: 0, ballMagicNumber: 9 })
  })

  it('한 경기에 나가는 마구는 표 값 + 1 이다', () => {
    const state = createMagicPitchGameState(ACE_PITCHER_REPERTOIRES[0])
    let thrown = 0
    while (state.remaining > 0) {
      advanceMagicPitchGameState(state, MAGIC_PITCH_TYPE_NUMBER, 5)
      thrown += 1
    }
    expect(thrown).toBe(3 + 1)
  })
})
