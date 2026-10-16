import { drawStrengthOf, particlePixelOf } from '@/entities/particle/model/particleEmitter'
import type { ParticleScene } from '@/entities/particle/model/particleScene'

/**
 * **파티클 그림의 모습** — `drawParticles`(0x6dd68 → 0x6dc4c)가 읽는 값만 차례대로 뜬 수 목록. 파티클 관리자는 제자리에서 고쳐 쓰는
 * 객체라 그리기 건너뛰기(`createDrawMemo`)에 그대로 넘길 수 없어 이 값으로 견준다.
 * 이미터마다 (그림 번호 img · 효과 mode · 입자 수), 입자마다 (화면 x · y · 세기 A >> 8 · 남은 수명 life — 파트 · 뒤집기를 고른다).
 */
export function particleSignatureOf(scene: ParticleScene | null | undefined): readonly number[] | null {
  if (scene === null || scene === undefined) return null
  const signature: number[] = []
  for (const emitter of scene.emitters) {
    signature.push(emitter.img, emitter.config.mode, emitter.particles.length)
    for (const particle of emitter.particles) {
      const { x, y } = particlePixelOf(particle)
      signature.push(x, y, drawStrengthOf(particle), particle.life)
    }
  }
  return signature
}
