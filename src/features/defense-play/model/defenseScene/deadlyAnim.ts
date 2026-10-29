import type { DeadlyAnimState } from '@/features/defense-play/model/defenseScene/sceneState'
import { isBugFixed } from '@/shared/config/bugfixes'

/** deadly_effect 애니 0 = 프레임 [0, 1, 2, 3] 지연 0 (R2 2절) */
const DEADLY_ANIM_FRAMES = 4

/**
 * 0x93cfd(애니, 0) — 돌고 있지 않으면 비트 0 · 4 를 지우고 돌리기 비트를 켠다. 칸 · 끝 비트는 그대로다.
 * B-86 고친 길 — 칸 0 으로 되감아(끝 비트도 내려) 필살 포구마다 0 · 1 · 2 · 3 칸을 다 그린다. 굴림 없음
 */
export function startDeadlyAnim(anim: DeadlyAnimState): DeadlyAnimState {
  if (isBugFixed('B-86')) return { frameIndex: 0, playing: true, ended: false }
  return anim.playing ? anim : { ...anim, playing: true }
}

/**
 * 0x93c45(그리기) 뒤 0x93d91(넘기기) — 그린 칸과 넘긴 상태. 지연 0 이라 넘길 때마다 칸이 오르고, 4 에서 감기면 끝 비트를 세우고
 * 되풀이가 아니라 마지막 칸(3)에 멈춘다(93e16 → 0x93d30(애니, 0)). 감기지 않은 넘김은 끝 비트를 지운다(93e04).
 */
export function drawDeadlyAnim(anim: DeadlyAnimState): { readonly frame: number; readonly next: DeadlyAnimState } {
  const frame = anim.frameIndex
  if (!anim.playing) return { frame, next: anim }
  const index = anim.frameIndex + 1
  if (index < DEADLY_ANIM_FRAMES) return { frame, next: { frameIndex: index, playing: true, ended: false } }
  return { frame, next: { frameIndex: DEADLY_ANIM_FRAMES - 1, playing: false, ended: true } }
}
