import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  createEmitter,
  createParticlePool,
  releaseEmitter,
  tickEmitter,
} from '@/entities/particle/model/particleEmitter'
import type { EmitterState, ParticleConfig, ParticleEmitter, ParticlePool } from '@/entities/particle/model/particleEmitter'

/**
 * 파티클 관리자 (0x6df5c · 0x6de84 · 0x6dee4) — 이미터 목록을 들고 틱마다 굴린다.
 *
 * - 이미터가 **64개 이상이면 새 요청을 무시한다** (0x6df5c `목록 수 > 0x3f`).
 * - 이미터는 목록(벡터 +0xc) 차례로 굴리고, 상태 3 을 돌려준 이미터는 그 자리에서 빼고 지운다(0x6de30 — 자동 삭제 +0x54 는 0x6d2f8 의 1).
 * - 입자는 관리자 하나의 **공용 풀 512 알**(0x6d07c)에서 꺼낸다 (`ParticlePool`).
 *
 * ## 이미터 블록 — 지운 이미터의 +0x58 을 읽는 곳 (2026-10-08 원본 할당기 해독)
 * 이미터는 `new(0x60)`(0x1238 → 0x2ac4: 자체 힙 0x28b8 + 0 채움)으로 만들고 `delete`(0x1258 → 0x26ec)로 지운다.
 * 자체 힙(0x14bc → 0x1468: [0x15000d0, +0x52800))은 크기 등급 표 0x1500010(0x12a8 이 채움 — 아래)으로 등급을 고르고
 * 등급마다 0x400 바이트 덩이 안에서 블록 머리 4 바이트를 단다:
 * ```
 * 등급 1 (0, 0x1c] · 2 (0x1c, 0x3c] · 3 (0x3c, 0x7c] · 4 (0x7c, 0xf8] · 5 (0xf8, 0x178] · 6 (0x178, 0x1f8] · 7 (0x1f8, 0x3f8] · 11 · 12 큰 것
 * ```
 * 이미터(0x60)는 등급 3 이다. 할당기를 그대로 돌려 본(unicorn 으로 0x12a8 · 0x1468 · 0x1238 · 0x1258 실행) 결과:
 * - 같은 등급의 빈 자리 중 **주소가 가장 낮은 곳**을 준다(덩이 목록 차례 → 덩이 안 주소). 지운 차례(LIFO)와 상관없다.
 * - 지우기는 머리 4 바이트만 고친다 — **몸(+0x58 포함)은 그대로 남는다**. 그래서 지운 이미터의 +0x58 은 마지막에 적은 값이다.
 * - 같은 자리를 새 이미터가 받으면 0 채움 뒤 0x6d2f8 이 +0x58 = 0 을 적고, 그 뒤로는 새 이미터의 상태가 거기 적힌다.
 *
 * 웹은 이것을 **블록 번호**로 흉내 낸다: 이미터는 비어 있는 가장 낮은 번호를 받고(`block`), 지우면 번호를 돌려준다.
 * `blockStates[번호]` 는 그 자리의 +0x58 — 이미터가 틱마다 적고, 지워도 남는다(`blockStateOf`).
 * ⚠️ 가정(원본에서 정해지지 않음): 등급 3 에서 이미터 말고 다른 것(0x3d~0x7c 바이트 — 218 곳의 new 중 무엇이든)이 이 사이에
 *   생기거나 지워지지 않고, 이미터 자리 사이에 다른 크기의 빈틈이 없다. 특히 관리자 벡터의 버퍼(0x6e15c → 0x3535: 용량 1·2·4·8·16·32…
 *   의 ×4 바이트)는 **용량 16(0x40)일 때 등급 3** 이라, 이미터가 처음으로 9 개 → 17 개를 넘는 순간 등급 3 에 0x44 블록이 생겼다
 *   사라진다 — 그 용량은 부팅 뒤 지금까지 한꺼번에 살았던 이미터 수가 정하므로 웹은 따르지 않는다.
 */
export interface ParticleScene {
  readonly emitters: ParticleEmitter[]
  /** 공용 풀 (0x6d07c, 512) */
  readonly pool: ParticlePool
  /** 블록 번호 → 지금 그 자리의 이미터 (지웠으면 null) */
  readonly blocks: (ParticleEmitter | null)[]
  /** 블록 번호 → 그 자리 +0x58 (지운 뒤에도 남는다) */
  readonly blockStates: EmitterState[]
}

/** 목록 상한 (0x6df5c) */
export const MAX_EMITTERS = 64

export function createParticleScene(): ParticleScene {
  return { emitters: [], pool: createParticlePool(), blocks: [], blockStates: [] }
}

/** 관리자가 든 이미터의 블록 번호 */
const blockOfEmitter = new WeakMap<ParticleEmitter, number>()

/**
 * 파티클 한 벌을 쏜다 — 원본 `0xbbc84(x, y, id, img, loop=0, total=−1, relCam=0, followCam=0)`.
 * 설정이 없으면(아직 안 불러왔거나 쓸 수 없는 번호) 아무것도 하지 않는다.
 * 만들었으면 이미터가 받은 **블록 번호**를, 못 만들었으면 null 을 돌려준다(0xbbc84 의 되돌림 — 홈런 효과 칸 +0x14 가 붙잡는다).
 */
export function emitParticles(
  scene: ParticleScene,
  config: ParticleConfig | null,
  x: number,
  y: number,
  img: number,
): number | null {
  if (config === null) return null
  if (scene.emitters.length >= MAX_EMITTERS) return null
  const emitter = createEmitter(config, x, y, img, -1, scene.pool)
  let block = scene.blocks.indexOf(null)
  if (block < 0) block = scene.blocks.length
  scene.blocks[block] = emitter
  // 0 채움(0x2ac4) · 0x6d2f8 의 +0x58 = 0
  scene.blockStates[block] = 0
  blockOfEmitter.set(emitter, block)
  scene.emitters.push(emitter)
  return block
}

/** 블록 자리의 +0x58 — 지운 이미터의 자리면 마지막 값, 새 이미터가 받았으면 그 이미터의 값 */
export function blockStateOf(scene: ParticleScene, block: number): EmitterState {
  return scene.blockStates[block] ?? 0
}

/** 이미터를 지운다 (0x6de30 — 정리 0x6dc08 → delete). 블록은 비지만 +0x58 은 남는다 */
function deleteEmitter(scene: ParticleScene, emitter: ParticleEmitter): void {
  releaseEmitter(emitter)
  const block = blockOfEmitter.get(emitter)
  if (block !== undefined && scene.blocks[block] === emitter) scene.blocks[block] = null
}

/** 한 틱 — 이미터를 목록 차례로 굴리고 끝난 것을 그 자리에서 지운다 (0x6de84) */
export function tickParticles(scene: ParticleScene, random: RandomPort): void {
  let alive = 0
  for (const emitter of scene.emitters) {
    const state = tickEmitter(emitter, random)
    const block = blockOfEmitter.get(emitter)
    if (block !== undefined && scene.blocks[block] === emitter) scene.blockStates[block] = state
    if (state === 3) {
      deleteEmitter(scene, emitter)
      continue
    }
    scene.emitters[alive] = emitter
    alive += 1
  }
  scene.emitters.length = alive
}

/** 파티클을 전부 치운다 (0x6dee4 — 목록 차례로 정리 · delete 뒤 수를 0 으로. 상태가 바뀔 때 원본도 목록을 비운다) */
export function clearParticles(scene: ParticleScene): void {
  for (const emitter of scene.emitters) deleteEmitter(scene, emitter)
  scene.emitters.length = 0
}
