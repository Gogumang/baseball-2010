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

/**
 * 관리자 틱 0x6de85 가 마지막으로 돈 **앱 틱** — 원본은 앱 루프 한 틀에 장면 프레임 하나가 돌고 그 끝에서 관리자를 한 번 굴린다
 * (`sceneParticles` 머리 표 — 다섯 장면 프레임 모두 틀 끝 한 번). 웹은 굴리는 루프가 화면마다 따로라(앱 층 · 타석 · 수비 판) 화면이
 * 바뀌는 틀에서 두 루프가 같은 틀을 굴리거나 둘 다 건너뛸 수 있다 — 이 표지를 함께 보고 앱 틀당 한 번만 굴린다.
 */
let lastTickedAppTick: number | null = null

/**
 * 앱 틱 `appTick` 의 틀에 관리자 틱을 돌려도 되는가 — 아직 안 돌았으면 참을 돌려주고 표지를 그 틀로 올린다. 앱 전역 관리자가 아닌
 * 장면(시험 따위)이거나 앱 틱을 모르면(`undefined`) 늘 참이다.
 */
export function claimSceneParticleTick(target: ParticleScene, appTick: number | undefined): boolean {
  if (target !== scene || appTick === undefined) return true
  if (lastTickedAppTick !== null && appTick <= lastTickedAppTick) return false
  lastTickedAppTick = appTick
  return true
}

/** 시험용 — 관리자를 비우고 쥔 수를 되돌린다 */
export function resetSceneParticleManagerForTest(): void {
  clearParticles(scene)
  claims = 0
  lastTickedAppTick = null
}
