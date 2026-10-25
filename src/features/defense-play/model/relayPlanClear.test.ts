import { describe, expect, it } from 'vitest'
import { battedBallTrajectory } from '@/entities/batting/model/battedBallFlight'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { startDefensePlay, stepDefensePlay, isDefensePlayFinished, type DefensePlayInput } from './runDefensePlay'

/**
 * 플레이 vt4c 0xb45dc 머리 (직접 뜸, r225):
 * ```
 * b45f0: +0x12c(쥠) == 0 이면 b4638 로
 * b4608: [4](+0x150) == +0x130 이면 b4638 로 · b4610: [0](+0x14c) == 0 이면 b4638 로
 * b4616: vt5c([4], 0) — 참이면 메시지 0xbc6, 참이든 거짓이든 b4660 (지우기를 건너뛴다)
 * b4638: [4] == +0x130 이면 [0] = 0 · +0x117 = 0          ← 쥠과 상관없다
 * ```
 * +0x130 은 송구 때 받을 야수로 옮으므로(0xb3b38 b3e40), 계획의 최종 받는 야수에게 공이 날아가는 **안 쥔 틱**에 이미 지워진다.
 */
const OUT: AtBatOutcome = { kind: '아웃', detail: '땅볼아웃' }
const patterns = Object.values(BATTED_BALL_PATTERNS).flatMap((list) => list)
const NONE = -1

function inputOf(seed: number, idx: number, key: '6' | '2'): DefensePlayInput {
  return {
    outcome: OUT,
    trajectory: battedBallTrajectory(patterns[idx]),
    bases: idx % 2 === 0 ? { first: true, second: false, third: false } : { first: true, second: true, third: true },
    outs: idx % 3,
    random: createSeededRandom(seed * 100000 + idx),
    defenseIsCpu: false,
    throwMode: '수동',
    controls: { side: '수비', keyAt: (t: number) => (t === 20 + (idx % 25) ? { key } : null) },
  }
}

describe('중계 계획 지우기 b4638 은 쥠 갈래 밖이다', () => {
  it.each([
    [1, 72, '6' as const],
    [1, 1070, '6' as const],
    [1, 696, '2' as const],
  ])('시드 %i 타구 %i 사람 %s — 최종 받는 야수에게 날아가는 틱에 계획이 지워진다', (seed, idx, key) => {
    const input = inputOf(seed, idx, key)
    let state = startDefensePlay(input)
    let clearedWhileFlying = false
    while (!isDefensePlayFinished(state)) {
      // stepDefensePlay 는 상태를 제자리에서 고친다 — 앞 값을 따로 둔다
      const before = { relayFinalSlot: state.relayFinalSlot }
      state = stepDefensePlay(state, input.controls?.keyAt(state.tick) ?? null)
      if (before.relayFinalSlot !== NONE && state.relayFinalSlot === NONE && !state.play.held) {
        expect(state.play.ballHolderSlot).toBe(before.relayFinalSlot)
        expect(state.relayBase).toBe(NONE)
        clearedWhileFlying = true
      }
    }
    expect(clearedWhileFlying).toBe(true)
  })
})
