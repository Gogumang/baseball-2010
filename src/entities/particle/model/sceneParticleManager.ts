import { clearParticles, createParticleScene } from '@/entities/particle/model/particleScene'
import type { ParticleScene } from '@/entities/particle/model/particleScene'

/**
 * **앱 전역 파티클 관리자 [0x1400068]** — 앱 초기화 0x2f9c 가 하나 세우고(0x6d284) 장면이 바뀌어도 그대로 둔다.
 * 쏘기 · 굴리기 · 장면 표는 `widgets/particles` 의 `sceneParticles` 머리말.
 */
const scene: ParticleScene = createParticleScene()
/** 관리자를 쥔 경기 장면 부품 수 — 쥔 동안은 그 부품이 원본 틱 차례로 굴리고 그린다 */
let claims = 0

/** 관리자 — 쏘는 쪽 · 그리기 층이 읽는다 */
export function sceneParticleScene(): ParticleScene {
  return scene
}

/** 관리자 지우기 0x6dee4 — 이미터를 다 지운다(굴림 없음 — 0x6dc08 이 +0x28/+0x29 를 0 으로 둔 뒤 0x6d878 이 굴림 앞에서 빠진다) */
export function clearSceneParticles(): void {
  clearParticles(scene)
}

/** 경기 장면 부품이 관리자를 쥔다 — 돌려준 함수로 놓는다 */
export function claimSceneParticles(): () => void {
  claims += 1
  let released = false
  return () => {
    if (released) return
    released = true
    claims -= 1
  }
}

/** 쥔 부품이 있는가 — 없으면 앱 층(`SceneParticleLayer`)이 굴리고 그린다 */
export function isSceneParticlesClaimed(): boolean {
  return claims > 0
}

/** 시험용 — 관리자를 비우고 쥔 수를 되돌린다 */
export function resetSceneParticleManagerForTest(): void {
  clearParticles(scene)
  claims = 0
}
