import { describe, expect, it } from 'vitest'
import {
  HIT_FLAME_NORMAL_ANIMATION,
  HIT_FLAME_STRONG_ANIMATION,
  hitByPitchMarkDrawCallOf,
  hitFlameAnimationOf,
  onceAnimationStepAt,
} from '@/widgets/batting-stage/lib/batterOverlayMarks'
import { NORMAL_HIT_PARTICLE_ID, STRONG_HIT_PARTICLE_ID } from '@/widgets/batting-stage/lib/hitParticles'

describe('타자 덧그림 0x49e64 — 보통 타격 불꽃 · 사구 표시 (r183)', () => {
  it('불꽃 애니는 ptc 고르기와 같은 판정 — 홈런성 · 강한 타구 3, 보통 · 약한 타구 2, 큰 타구는 없다 (49fe6~4a032)', () => {
    expect(hitFlameAnimationOf(STRONG_HIT_PARTICLE_ID, false)).toBe(HIT_FLAME_STRONG_ANIMATION)
    expect(hitFlameAnimationOf(NORMAL_HIT_PARTICLE_ID, false)).toBe(HIT_FLAME_NORMAL_ANIMATION)
    // 약한 타구(0x39304)는 ptc 없이 애니 2
    expect(hitFlameAnimationOf(null, false)).toBe(HIT_FLAME_NORMAL_ANIMATION)
    // 감상 플래그 0x392ac — 49fe4 에서 통째로 건너뛴다
    expect(hitFlameAnimationOf(null, true)).toBeNull()
  })

  it('사구 표시는 0x12 틱 0~7 의 그림 여덟 번 — 틱 t 의 그림이 t + 1 번째 부름 (4a0e4 [+0x2c] ≤ 7)', () => {
    expect(hitByPitchMarkDrawCallOf(0)).toBe(1)
    expect(hitByPitchMarkDrawCallOf(7)).toBe(8)
    expect(hitByPitchMarkDrawCallOf(8)).toBeNull()
    expect(hitByPitchMarkDrawCallOf(-1)).toBeNull()
  })

  it('한 번 도는 애니는 부를 때마다 넘긴 뒤의 칸 — 다 돌면 마지막 칸에 서서 그 칸을 계속 그린다 (0x93d90 → 0x93d30)', () => {
    // game_effect 애니 2: 프레임 8 · 9 · 10 · 11 (지연 2) 뒤 21(그림에 없는 칸, 지연 0)
    const flame = [
      { frame: 8, delay: 2 },
      { frame: 9, delay: 2 },
      { frame: 10, delay: 2 },
      { frame: 11, delay: 2 },
      { frame: 21, delay: 0 },
    ]
    expect([1, 2, 3, 7, 8, 9, 20].map((k) => onceAnimationStepAt(flame, k)?.frame)).toEqual([8, 9, 9, 11, 21, 21, 21])
    // player_effect 애니 14: 프레임 51 넷(지연 0, dy 0 · 2 · 1 · −2)
    const mark = [
      { frame: 51, delay: 0, dy: 0 },
      { frame: 51, delay: 0, dy: 2 },
      { frame: 51, delay: 0, dy: 1 },
      { frame: 51, delay: 0, dy: -2 },
    ]
    expect([1, 2, 3, 4, 8].map((k) => onceAnimationStepAt(mark, k)?.dy)).toEqual([2, 1, -2, -2, -2])
    expect(onceAnimationStepAt(mark, 0)).toBeNull()
  })
})
