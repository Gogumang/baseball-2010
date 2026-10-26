import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { MAGIC_PITCH_TYPE_NUMBER, ballMagicNumberOfPitch } from '@/entities/pitcher-career/model/magicPitch'
import { advanceMagicPitchGameState, type MagicPitchGameState } from '@/entities/pitching/model/magicPitchGame'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 마구 = MAGIC_PITCH_TYPE_NUMBER
const 직구 = 1
const 번호 = 2

/** 구질 차례대로 던지고 (공+0x10, 남은) 을 공마다 적는다 */
function throwAll(remaining: number, pitches: readonly number[]): { balls: number[]; remaining: number[]; magicThrown: number } {
  const state: MagicPitchGameState = { remaining, ballMagicNumber: 0 }
  const balls: number[] = []
  const left: number[] = []
  let magicThrown = 0
  for (const type of pitches) {
    // CPU 는 남은 횟수가 있을 때만 마구를 고른다 (0x344dc) — 없으면 직구로 바꿔 던진다
    const thrown = type === 마구 && state.remaining <= 0 ? 직구 : type
    if (thrown === 마구) magicThrown += 1
    advanceMagicPitchGameState(state, thrown, 번호)
    balls.push(state.ballMagicNumber)
    left.push(state.remaining)
  }
  return { balls, remaining: left, magicThrown }
}

describe('B-08 첫 마구 소모', () => {
  const pitches = [마구, 마구, 마구, 마구, 마구, 마구, 마구]

  it('원본: 첫 마구가 공짜라 표 4 개보다 하나 많은 5 개를 던진다', () => {
    expect(throwAll(4, pitches).magicThrown).toBe(5)
  })

  it('고침: 표 값 4 개만 던진다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-08']))
    const run = throwAll(4, pitches)
    expect(run.magicThrown).toBe(4)
    expect(run.remaining.slice(0, 4)).toEqual([3, 2, 1, 0])
  })

  it('홈런더비는 고쳐도 소모가 없다 (0x3460e → 0x348d6)', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-08']))
    const state: MagicPitchGameState = { remaining: 3, ballMagicNumber: 0 }
    advanceMagicPitchGameState(state, 마구, 번호, true)
    expect(state.remaining).toBe(3)
  })
})

describe('B-01 공+0x10 이 다음 공에 남음', () => {
  const pitches = [직구, 마구, 직구, 직구]

  it('원본: 마구 뒤의 직구에도 번호가 남는다', () => {
    expect(throwAll(4, pitches).balls).toEqual([0, 번호, 번호, 번호])
  })

  it('고침: 마구로 던진 그 공에만 번호가 실린다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-01']))
    expect(throwAll(4, pitches).balls).toEqual([0, 번호, 0, 0])
  })

  it('고침: 마지막 한 개(1 → 0)도 싣는다 — 원본은 소모 뒤 남은 0 이라 안 싣고 직전 값을 둔다', () => {
    const input = { previous: 0, pitchTypeNumber: 마구, pitcherMagicNumber: 번호, remainingBefore: 1, remainingAfter: 0 }
    expect(ballMagicNumberOfPitch(input)).toBe(0)
    setBugfixConfigForTests(bugfixConfigWith(['B-01']))
    expect(ballMagicNumberOfPitch(input)).toBe(번호)
  })

  it('고침: 투수가 바뀌어도 앞 투수의 번호가 남지 않는다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-01']))
    expect(ballMagicNumberOfPitch({ previous: 9, pitchTypeNumber: 직구, pitcherMagicNumber: 0, remainingBefore: 0, remainingAfter: 0 })).toBe(0)
  })

  it('B-01 · B-08 둘 다 고치면 표 값만큼 던지고 그 공마다만 실린다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-01', 'B-08']))
    const run = throwAll(2, [마구, 직구, 마구, 마구, 직구])
    expect(run.magicThrown).toBe(2)
    expect(run.balls).toEqual([번호, 0, 번호, 0, 0])
  })
})
