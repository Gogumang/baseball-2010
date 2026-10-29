import { HIT_PARTICLE_IMAGE, specialSwingParticlesOf } from '@/widgets/batting-stage/lib/hitParticles'
import type { PitcherHitScene } from '@/widgets/batting-stage/lib/pitcherSideStage/hitScene'
import { type SpecialSwingStageEffect, specialSwingStageEffectOf } from '@/widgets/batting-stage/lib/specialSwingEffect'

/** 판정 틀에 타격점에 쏘는 파티클 하나 — 0xbbc84(x, y + `offsetY`, id, img, …) */
export interface PitcherHitParticle {
  readonly id: number
  readonly img: number
  readonly offsetY: number
}

/**
 * **판정 틀의 타격점 그림 · 파티클** — 스윙 그리기 0x49e64 49f7c(상태 0x13 이거나 맞음 +0xfd2 ∧ 0xb9271 == 0)가 0x49aec 를 부르고,
 * 필살 스윙이 그림 갈래를 타면(`specialSwingStageEffectOf` ≠ null) [sp+0x60] = 1 이라 49fa2 가 보통 불꽃(49faa~4a0ce)을 건너뛰고
 * 0x49aec 가 필살 파티클(49dbc · 49de0, `specialSwingParticlesOf`)을 쏜다. 아니면 보통 불꽃(`particleId`)이다 — 타자편 `BattingStage`
 * 의 판정과 같은 갈래다. `aceBatterOrder` 는 0xb63a0(마타자 순번, 없으면 null), `side` 는 0xb63c1(타자 손).
 */
export function pitcherHitContactOf(
  hit: Pick<PitcherHitScene, 'particleId' | 'specialSwing' | 'isBuntStance'>,
  batterForm: number,
  aceBatterOrder: number | null,
  side: number,
): { readonly effect: SpecialSwingStageEffect | null; readonly particles: readonly PitcherHitParticle[] } {
  const special = hit.specialSwing
  if (special !== null) {
    const aceIndex = special.isAceBatter ? (aceBatterOrder ?? -1) : -1
    const effect = specialSwingStageEffectOf(special.number, batterForm, aceIndex, side)
    if (effect !== null) return { effect, particles: specialSwingParticlesOf(special.number, batterForm, aceIndex) }
  }
  return { effect: null, particles: flameParticlesOf(hit) }
}

/** 보통 불꽃 — 49faa: 번트 자세(S+8 ≠ 0)면 불꽃 · ptc 가 없다 */
function flameParticlesOf(hit: Pick<PitcherHitScene, 'particleId' | 'isBuntStance'>): readonly PitcherHitParticle[] {
  if (hit.isBuntStance === true) return []
  return hit.particleId === null ? [] : [{ id: hit.particleId, img: HIT_PARTICLE_IMAGE, offsetY: 0 }]
}
