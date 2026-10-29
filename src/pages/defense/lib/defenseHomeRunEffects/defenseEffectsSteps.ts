/** 한 그림 차례 — 갱신 홈런 갈래 → 그리기 → 파티클 틱 · 건너뛰기 · 끝 */
import { claimSceneParticleTick } from '@/entities/particle/model/sceneParticleManager'
import { initHomeRunFireworks, tickHomeRunFireworks } from '@/entities/batting/model/homeRunFireworks'
import type { HomeRunFireworks } from '@/entities/batting/model/homeRunFireworks'
import { clearParticles, emitParticles, tickParticles } from '@/entities/particle/model/particleScene'
import type { ParticleScene } from '@/entities/particle/model/particleScene'
import type { ParticleConfig } from '@/entities/particle/model/particleEmitter'
import type { BallParticleShot } from '@/pages/defense/lib/ballParticles'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { drawHomeRunTextOnce, generalHomeRunTextOn } from '@/widgets/batting-stage/lib/homeRunBanner'
import type { HomeRunTextFrame, HomeRunTextState } from '@/widgets/batting-stage/lib/homeRunBanner'
import { fireworksPortOf } from '@/widgets/batting-stage/lib/homeRunEffects'
import type { DefenseEffects, DefenseTickFacts } from '@/pages/defense/lib/defenseHomeRunEffects/defenseEffectsState'

/** 한 그림 뒤에 그릴 것 */
export interface DefenseEffectsFrame {
  readonly effects: DefenseEffects
  /** 이 그림의 HOMERUN 글자 — 안 그리면 null */
  readonly text: HomeRunTextFrame | null
  /** 비거리 판의 숫자(+0x36) — 판이 안 보이면 null */
  readonly distanceBoard: number | null
}

export interface DefenseEffectsPorts {
  readonly particles: ParticleScene
  /** 경기 난수 — 없으면 홈런 효과 틱 · 파티클 틱을 안 돌린다(시험 · 난수 없는 판) */
  readonly random?: RandomPort
  readonly configOf: (id: number) => ParticleConfig | null
  /** 이 그림이 든 앱 틱 — 앱 전역 관리자는 앱 틀당 한 번만 굴린다(`claimSceneParticleTick`). 없으면 늘 굴린다 */
  readonly appTick?: number
}

/**
 * 원본 한 그림 — 갱신의 홈런 갈래(글자 켜기 · 효과 깔기 · +0x36) → 그리기(비거리 판 · 글자 · 유지 그림의 효과 틱) → 파티클 틱.
 * 판이 닫힌 뒤의 그림은 `facts` 를 null 로 넘긴다(갱신이 529f0 로 빠져 판 칸을 안 건드리고 글자도 안 그린다).
 */
export function stepDefenseEffects(
  effects: DefenseEffects,
  facts: DefenseTickFacts | null,
  ports: DefenseEffectsPorts,
  ballShots: readonly BallParticleShot[] = [],
): DefenseEffectsFrame {
  // 갱신 — 0x51cd8 · 0x51d0c · 0x5297a (판이 닫힌 뒤 그림은 건드리지 않는다)
  const updated = facts === null ? effects : updateDefenseEffectsWithoutDraw(effects, facts)
  // 그리기 — 0x36cd4 는 +0x1960 만 본다
  const distanceBoard = updated.textOn ? updated.displayDistance : null
  // 그리기 — 공 0x36dfc 의 큰 타구 · 튐 파티클 (그리기 목록을 채울 때 — HOMERUN 글자 0x40b18 의 효과 틱보다 앞)
  const ballBounced = emitBallShots(ports, ballShots) || effects.ballBounced === true
  // 그리기 — 0x40b18 (0x40b22: +0x1960 이 꺼졌으면 아무것도 안 한다)
  const drawn = drawHomeRunText(facts?.drawsText === true && updated.textOn, updated.text, updated.fireworks, ports)
  // 프레임 끝 — 0x6de84
  rollFrameEndParticles(ports)
  return {
    effects: { textOn: updated.textOn, text: drawn.text, fireworks: drawn.fireworks, displayDistance: updated.displayDistance, ballBounced },
    text: drawn.frame,
    distanceBoard,
  }
}

/** 공 그리기 0x36dfc 의 파티클을 쏜다 — 튐(공+0xab4)이 하나라도 있었는가 */
function emitBallShots(ports: DefenseEffectsPorts, ballShots: readonly BallParticleShot[]): boolean {
  let bounced = false
  for (const shot of ballShots) {
    if (shot.bounce) bounced = true
    emitParticles(ports.particles, ports.configOf(shot.id), shot.x, shot.y, shot.img)
  }
  return bounced
}

/** HOMERUN 글자 0x40b18 한 번 — 유지 단계를 그린 그림에서만 홈런 효과 틱 0x40faa(경기 난수를 굴린다) */
function drawHomeRunText(
  isDrawn: boolean,
  text: HomeRunTextState,
  fireworks: HomeRunFireworks<number> | null,
  ports: DefenseEffectsPorts,
): { readonly frame: HomeRunTextFrame | null; readonly text: HomeRunTextState; readonly fireworks: HomeRunFireworks<number> | null } {
  if (!isDrawn) return { frame: null, text, fireworks }
  const isHold = text.stage >= 4
  const drawn = drawHomeRunTextOnce(text)
  if (!isHold || fireworks === null || ports.random === undefined) return { frame: drawn.frame, text: drawn.next, fireworks }
  const ticked = tickHomeRunFireworks(fireworks, fireworksPortOf(ports.particles, ports.configOf), ports.random)
  return { frame: drawn.frame, text: drawn.next, fireworks: ticked }
}

/** 프레임 끝 파티클 틱 0x6de84 — 난수가 있고 이 앱 틀에서 아직 안 굴렸을 때만 */
function rollFrameEndParticles(ports: DefenseEffectsPorts) {
  if (ports.random !== undefined && claimSceneParticleTick(ports.particles, ports.appTick)) tickParticles(ports.particles, ports.random)
}

/**
 * **창이 선 첫 그림([창+0x250])** — 갱신 없이 그리기 0x46c88 만 한 번 더 돈다(52efe). 그 그림은 앞 그림과 같은 상태를 그리므로
 * 공 그리기 0x36dfc 의 파티클(같은 조건이면 같은 것)을 다시 쏘고, HOMERUN 글자 0x40b18 이 한 번 더 그려 글자 칸이 한 칸 더 가며
 * 유지 단계면 홈런 효과 틱 0x40faa(경기 난수 — 굴림이 그만큼 는다)도 한 번 더 돈다. 프레임 끝 파티클 틱 0x6de85 는 53048 이 창이
 * 서 있어 건너뛴다. `drawsText` 는 앞 그림의 그리기 관문(46e2e~46e58)이다 — 판이 닫힌 뒤 그림이면 거짓.
 */
export function redrawDefenseEffects(
  effects: DefenseEffects,
  drawsText: boolean,
  ports: DefenseEffectsPorts,
  ballShots: readonly BallParticleShot[] = [],
): DefenseEffectsFrame {
  const distanceBoard = effects.textOn ? effects.displayDistance : null
  const ballBounced = emitBallShots(ports, ballShots) || effects.ballBounced === true
  const drawn = drawHomeRunText(drawsText && effects.textOn, effects.text, effects.fireworks, ports)
  return { effects: { ...effects, text: drawn.text, fireworks: drawn.fireworks, ballBounced }, text: drawn.frame, distanceBoard }
}

/**
 * 키 건너뛰기 0x519cc(51a0a~51a32) — +0x1960 = 0(글자 끄기) · 0x8fc70(홈런 효과 칸 버리기) · 파티클 +0x57 = 0 · 0x6dee4(파티클 치우기).
 * 글자 칸(+0x1961~)과 +0x36 은 안 건드린다. 같은 처리의 소리 끊기 0x6e418(0x519fe)은 부르는 쪽(`DefensePlayback`)이 소리 포트 `stop` 으로 한다.
 */
export function fastForwardDefenseEffects(effects: DefenseEffects, particles: ParticleScene): DefenseEffects {
  clearParticles(particles)
  return { ...effects, textOn: false, fireworks: null }
}

/**
 * 건너뛰기(+0xfe7) 동안의 갱신 하나 — 52b26 이 그리기 · 프레임 끝 파티클 틱 없이 슬롯 2 를 되풀이한다.
 * 갱신 쪽(0x51c82 글자 켜기 · 효과 깔기 · 0x5297a +0x36)만 돈다. 파티클 틱 · 효과 틱 굴림이 없다.
 */
export function updateDefenseEffectsWithoutDraw(effects: DefenseEffects, facts: DefenseTickFacts): DefenseEffects {
  let { textOn, text, fireworks, displayDistance } = effects
  if (facts.homeRunBranch) {
    text = generalHomeRunTextOn(text)
    textOn = true
    fireworks = initHomeRunFireworks<number>()
  }
  if (facts.displayDistance !== null) displayDistance = facts.displayDistance
  return { ...effects, textOn, text, fireworks, displayDistance }
}

/** 0x17 끝 0x35108 — 글자를 끄고(0x351d0) 파티클을 치운다(0x6dee4) */
export function endDefenseEffects(effects: DefenseEffects, particles: ParticleScene): DefenseEffects {
  clearParticles(particles)
  return { ...effects, textOn: false }
}
