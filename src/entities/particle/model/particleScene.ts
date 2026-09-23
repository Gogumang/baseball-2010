import type { RandomPort } from '@/shared/api/random/randomPort'
import { createEmitter, tickEmitter } from '@/entities/particle/model/particleEmitter'
import type { ParticleConfig, ParticleEmitter } from '@/entities/particle/model/particleEmitter'

/**
 * 파티클 관리자 (0x6df5c · 0x6de84) — 이미터 목록을 들고 틱마다 굴린다.
 *
 * - 이미터가 **64개를 넘으면 새 요청을 무시한다** (0x6df5c `목록 수 > 0x3f`).
 * - 끝난 이미터는 지운다 (+0x54 자동삭제 기본 1).
 *
 * 원본은 입자를 512개짜리 공용 풀(0x6d07c)에서 꺼내 쓴다. 웹은 풀 대신 배열을 쓰고,
 * 대신 이미터마다 파일 `total` 이 상한이라 입자 수는 원본과 같은 선에서 멈춘다.
 */
export interface ParticleScene {
  readonly emitters: ParticleEmitter[]
}

/** 목록 상한 (0x6df5c) */
export const MAX_EMITTERS = 64

export function createParticleScene(): ParticleScene {
  return { emitters: [] }
}

/**
 * 파티클 한 벌을 쏜다 — 원본 `0xbbc84(x, y, id, img, loop=0, total=−1, relCam=0, followCam=0)`.
 * 설정이 없으면(아직 안 불러왔거나 쓸 수 없는 번호) 아무것도 하지 않는다.
 */
export function emitParticles(
  scene: ParticleScene,
  config: ParticleConfig | null,
  x: number,
  y: number,
  img: number,
): void {
  if (config === null) return
  if (scene.emitters.length >= MAX_EMITTERS) return
  scene.emitters.push(createEmitter(config, x, y, img))
}

/** 한 틱 — 이미터를 모두 굴리고 끝난 것을 치운다 (0x6de84) */
export function tickParticles(scene: ParticleScene, random: RandomPort): void {
  let alive = 0
  for (const emitter of scene.emitters) {
    tickEmitter(emitter, random)
    if (emitter.done) continue
    scene.emitters[alive] = emitter
    alive += 1
  }
  scene.emitters.length = alive
}

/** 파티클을 전부 치운다 (0x6dee4 — 상태가 바뀔 때 원본도 목록을 비운다) */
export function clearParticles(scene: ParticleScene): void {
  scene.emitters.length = 0
}
