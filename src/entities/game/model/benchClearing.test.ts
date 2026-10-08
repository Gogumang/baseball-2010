import { describe, expect, it } from 'vitest'
import {
  benchClearingEffectOf,
  rollsIntoBenchClearing,
  staminaAfterBenchClearing,
} from '@/entities/game/model/benchClearing'
import { recordSeasonGameEvent, clearSeasonGameRecord } from '@/entities/season-mode/model/seasonReputation'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { createFractionRandom } from '@/shared/api/random/fractionRandom'

/** 굴림을 몇 번 했는지 세는 고정 난수 */
function 고정(value: number): RandomPort & { calls: number } {
  const random = {
    calls: 0,
    ...createFractionRandom(() => {
      random.calls += 1
      return value
    }),
  }
  return random
}

const 사구 = { isHitByPitch: true, isHomeRunDerby: false, burstInProgress: false }

describe('rollsIntoBenchClearing — 0x4e72c~0x4e776', () => {
  it('rand(0, 99) ≤ 19 면 들어간다 — 19 는 들어가고 20 은 아니다 (0~98 중 20개)', () => {
    // floor(v × 99): 19/99 → 19, 20/99 → 20
    expect(rollsIntoBenchClearing(사구, 고정(19.5 / 99))).toBe(true)
    expect(rollsIntoBenchClearing(사구, 고정(20.5 / 99))).toBe(false)
    expect(rollsIntoBenchClearing(사구, 고정(0))).toBe(true)
  })

  it('사구면 들고 나든 늘 한 번 굴린다', () => {
    const 들어감 = 고정(0)
    const 안들어감 = 고정(0.9)
    rollsIntoBenchClearing(사구, 들어감)
    rollsIntoBenchClearing(사구, 안들어감)

    expect(들어감.calls).toBe(1)
    expect(안들어감.calls).toBe(1)
  })

  it('사구가 아니거나 홈런더비면 굴리지 않는다', () => {
    const 볼넷 = 고정(0)
    const 더비 = 고정(0)

    expect(rollsIntoBenchClearing({ ...사구, isHitByPitch: false }, 볼넷)).toBe(false)
    expect(rollsIntoBenchClearing({ ...사구, isHomeRunDerby: true }, 더비)).toBe(false)
    expect(볼넷.calls).toBe(0)
    expect(더비.calls).toBe(0)
  })

  it('돌발이 진행 중이면 안 들어가지만 굴림은 먼저 돈다 (0x8eb94 가 rand 뒤)', () => {
    const random = 고정(0)

    expect(rollsIntoBenchClearing({ ...사구, burstInProgress: true }, random)).toBe(false)
    expect(random.calls).toBe(1)
  })
})

describe('benchClearingEffectOf — 0x3ab4a~0x3ab92', () => {
  it('수비가 사람이면 지금 투수 스태미나 −1000, 투구 수는 그대로', () => {
    expect(benchClearingEffectOf(true)).toEqual({ defenseStaminaLoss: 1000, defensePitchCountGain: 0, seasonRecordCode: 1 })
  })

  it('수비가 CPU 면 투구 수 +10, 스태미나는 그대로', () => {
    expect(benchClearingEffectOf(false)).toEqual({ defenseStaminaLoss: 0, defensePitchCountGain: 10, seasonRecordCode: 1 })
  })

  it('스태미나는 [0, 10000] 으로 자른다 (0xaeab0)', () => {
    expect(staminaAfterBenchClearing(5000, 1000)).toBe(4000)
    expect(staminaAfterBenchClearing(300, 1000)).toBe(0)
  })

  it('S[1] 은 내 팀이 수비일 때만 오른다 — 코드 1 ≤ 5 (0xa755c 게이트)', () => {
    const { seasonRecordCode } = benchClearingEffectOf(true)

    expect(recordSeasonGameEvent(clearSeasonGameRecord(), seasonRecordCode, '수비')[1]).toBe(1)
    expect(recordSeasonGameEvent(clearSeasonGameRecord(), seasonRecordCode, '공격')[1]).toBe(0)
  })
})
