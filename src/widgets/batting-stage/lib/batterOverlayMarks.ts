import type { StageAnimationEntry } from '@/widgets/batting-stage/lib/spriteLoader'
import { STRONG_HIT_PARTICLE_ID } from '@/widgets/batting-stage/lib/hitParticles'

/**
 * **타자 덧그림 0x49e64 의 두 그림** — 보통 타격 불꽃(game_effect 애니 2 · 3)과 사구 표시(player_effect 애니 14) (r183, 2026-10-25 직접 떴다).
 * ```
 * 49faa  [+0xf9c]+8 == 0 · [+0xf9c]+0xd(스윙 중) ≠ 0 · 맞음 [+0xfd2] ≠ 0 · !0x392ac(감상 플래그) 이고 0x49aec 가 [sp+0x57] 을 안 세웠으면:
 * 49fe6    0x357e0(결과 코드 24~26) 이나 0x35988(강한 타구) 이면 애니 3 · ptc 5, 0x39304(약한 타구) 면 애니 2 · ptc 없음, 아니면 애니 2 · ptc 6
 * 4a034    스윙 칸 s = 0xb905d(스윙) > 6 이면 0xbe8a5(그리기 목록, 타격점 (+0x10dc, +0x10e0) 투영 + 카메라, 깊이 [0xcfa8c+0x14] + 10,
 *          game_effect(+0x102c), 애니, 효과 0, …) → 4a0a0 0x93d91(애니) 한 칸 ; s == 7 이고 ptc 가 있으면 0xbbc85 (`hitParticles`)
 * 4a0ce  상태 > 0xf · st[0x12](사구) ≠ 0 · st[0x10](스윙함) == 0 · 상태 틱 [+0x2c] ≤ 7 이면
 *          0xbe8a5(그리기 목록, (타자 x, 타자 y − 0x51), 깊이 [0xcfa8c+0x14], player_effect(+0x1030), 애니 14, 효과 0, …) → 4a12a 0x93d91 한 칸
 * ```
 * - 두 애니는 그림마다 넘기고(그리기 목록 0xbe6a1 은 넣을 때가 아니라 비울 때 지금 칸을 그린다) **끝 비트를 안 본다** — 다 돌면
 *   0x93d90 이 마지막 칸에 세우고(93e26 → 0x93d30) 그 칸을 계속 그린다. game_effect 애니 2 · 3 의 마지막 칸은 프레임 21(그림에 없는
 *   칸 = 빈 그림), player_effect 애니 14 의 마지막 칸은 프레임 51 (dy −2) 다.
 * - 되감기: game_effect 는 0x10 진입 0x39894(39950~3999a)가 공마다 모두 0x93d31(애니, 1) · 0x93cfd(애니, 0) — 돌림 없이 켠다.
 *   player_effect 는 0xf 진입 0x3d954(3daba~3db06)가 공마다 모두 되감고 돌림 비트 0x1a610(4 · 9 · 10 · 13 · 15 · 16)만 돌림으로 켠다 —
 *   애니 14 는 한 번만 돈다.
 * - 스윙 칸 s 는 맞은 틀 J(0x11)에서 7 이고(0x4a0ca 의 ptc 가 그 그림에 한 번 난다) 스윙은 끝 칸에 머물러(`batterLayers.batterFrameAt`)
 *   0x13 동안 6 을 안 내려온다 — 불꽃은 필살 그림 0x49aec 와 같은 부름 차례다(J 의 그림이 첫 부름, 0x13 틱 d 의 그림이 d + 2 번째).
 *   ⚠️ 근사: [+0xf9c]+8 칸은 웹 타석에 없다(`hitParticles` 와 같다). 타격점은 맞은 틱의 공 자리다(`BattingStage` 의 불꽃 ptc 와 같다).
 * - 사구 표시는 0x12 틱 0~7 의 그림 여덟 번이다(0x12 그리기 0x4ce9c 도 0x49e64 를 부른다). 사구는 스윙이 없을 때만 난다(0x35a2c).
 */

/** game_effect 애니 — 보통 · 약한 타구 */
export const HIT_FLAME_NORMAL_ANIMATION = 2
/** game_effect 애니 — 홈런성(0x357e0) · 강한 타구(0x35988) */
export const HIT_FLAME_STRONG_ANIMATION = 3
/** player_effect 애니 14 — 사구 표시 */
export const HIT_BY_PITCH_MARK_ANIMATION = 14
/** 4a110 — 타자 y − 0x51 */
export const HIT_BY_PITCH_MARK_OFFSET_Y = -0x51
/** 4a0e4 — 상태 틱 [+0x2c] ≤ 7 인 그림만 */
const HIT_BY_PITCH_MARK_LAST_TICK = 7

/**
 * 이 타구의 불꽃 애니 — 감상 플래그(큰 타구)면 null. `particleId` 는 같은 고르기의 ptc(`hitParticles.hitParticleIdOf` — 5 = 006 이면
 * 홈런성 · 강한 타구, 6 = 007 보통, null 약한 타구)다.
 */
export function hitFlameAnimationOf(particleId: number | null, isBigHit: boolean): number | null {
  if (isBigHit) return null
  return particleId === STRONG_HIT_PARTICLE_ID ? HIT_FLAME_STRONG_ANIMATION : HIT_FLAME_NORMAL_ANIMATION
}

/** 0x12 상태 틱 `stateTick` 의 그림이 사구 표시를 몇 번째로 부르는가(1 부터) — 틱 7 을 넘으면 null */
export function hitByPitchMarkDrawCallOf(stateTick: number): number | null {
  if (stateTick < 0 || stateTick > HIT_BY_PITCH_MARK_LAST_TICK) return null
  return stateTick + 1
}

/**
 * 되감긴 한 번 도는 애니의 k 번째 부름(1 부터)에 그릴 칸 — 부를 때마다 한 칸(칸 길이 max(1, 지연), 0x93d90) 넘긴 뒤의 칸이고, 다 돌면
 * 마지막 칸에 선다. 끝 비트를 안 보는 부르는 쪽이라 마지막 칸을 계속 그린다
 */
export function onceAnimationStepAt(
  entries: readonly StageAnimationEntry[],
  drawCall: number,
): { readonly frame: number; readonly dx: number; readonly dy: number } | null {
  if (drawCall < 1 || entries.length === 0) return null
  let remaining = drawCall
  for (const entry of entries) {
    const length = Math.max(1, entry.delay)
    if (remaining < length) return { frame: entry.frame, dx: entry.dx ?? 0, dy: entry.dy ?? 0 }
    remaining -= length
  }
  const last = entries[entries.length - 1]
  return { frame: last.frame, dx: last.dx ?? 0, dy: last.dy ?? 0 }
}
