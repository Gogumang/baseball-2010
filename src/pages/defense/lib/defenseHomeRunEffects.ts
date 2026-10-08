import { derbyDistanceOf } from '@/entities/home-run-derby/model/derbyRules'
import {
  initHomeRunFireworks,
  tickHomeRunFireworks,
  type HomeRunFireworks,
} from '@/entities/batting/model/homeRunFireworks'
import { isFoulEnded } from '@/entities/fielding/model/playGate'
import { clearParticles, tickParticles, type ParticleScene } from '@/entities/particle/model/particleScene'
import type { ParticleConfig } from '@/entities/particle/model/particleEmitter'
import type { DefensePlayState } from '@/features/defense-play/model/runDefensePlay'
import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  drawHomeRunTextOnce,
  generalHomeRunTextOn,
  HOME_RUN_TEXT_SCENE_START,
  type HomeRunTextFrame,
  type HomeRunTextState,
} from '@/widgets/batting-stage/lib/homeRunBanner'
import { fireworksPortOf } from '@/widgets/batting-stage/lib/homeRunEffects'

/**
 * ============================================================================
 * **수비 판(상태 0x17) 화면의 홈런 연출 — HOMERUN 글자 · 홈런 효과(불꽃) · 파티클 · 비거리 판** (2026-10-08 직접 뜸)
 * ============================================================================
 * 원본 프레임 0x52c50 은 키 → 갱신 → 그리기 → 프레임 끝 파티클 틱(0x53050 → 0x6de84 · 그리기 0x6dd68) 차례다. 0x17 에서는
 * ```
 * 갱신 0x524c0 (슬롯 2)
 *   52502  관문 0xb0d28 이 닫혔으면 529f0 (+0x1094 셈 — 11 번째에 0xbb9 → 0x528b0 → 0x35108)
 *   …      플레이 틱 vt48 — 결과 코드 8 · 12 면 곧바로 메시지 0xbba(0xbfbac) → 0x51c82:
 *   51cd8    0xa5fec(사건 8) · +0x1963 = 0 · +0x1961 = 0 · +0x1960 = 1 · 글자 칸 +0x1964+i = 5+i   (`generalHomeRunTextOn`)
 *   51d0c    0x90191([0x1400064], 2, 1) · +8 = +9 = 1                                          ; 홈런 효과 종류 2 (굴림 없음)
 *   526ca  모드 ≠ 7 → 528f0 (일반 갈래):
 *   528f0    (공+0x68 == aa4 && aa0 ≥ 공+0x68) || (공+0x68 == ab0 && aa0 ≥ ab0) 이고 !0xb68dc(파울) 이면
 *   5293e      +0x36(u16) = min(|0xa25b0(공, aa0) − (20000, 1000, 30000)| / 265, 160)        ; 표시 비거리 — 낙구 점
 * 그리기 0x46c88
 *   46cb6  비거리 판 0x36cd4: 플레이+0x118 == 8 || +0x1960 일 때 "___M" 판과 +0x36           ; 일반 모드는 +0x1960 일 때만
 *   46e2e  0x33c98(0x17 이면 참) && 관문 0xb0d28 열림 && (state[0x1d] || 플레이+0x129) 이면 0x40b18(HOMERUN 글자)
 *   40faa    글자가 유지 단계(+0x1961 ≥ 4)를 그린 그림이면 0x901a0 — 홈런 효과 틱(칸 7 — 파티클을 쏘고 굴린다)
 *   46e62  득점 점수판 0x41a64
 * 프레임 끝 0x53050  0x6de84(파티클 틱 — 굴린다) · 0x6dd68(파티클 그리기 — 화면 좌표 그대로)
 * 0x17 끝 0x35108   0x351d0 +0x1960 = 0 · 0x351e2 → 0x6dee4(파티클 모두 치우기)
 * ```
 * - state[0x1d] 는 사건 코드 8 처리 0xb2bd8 이 +0x111 과 함께 세운다(웹 `homeRunFlag`), +0x129 는 코드 12(웹 `play.suppressed`).
 *   그리기 쪽 관문은 갱신 뒤에 다시 부르는 0xb0d28(G3)이다 — 부를 때마다 +0x120 이 오르므로 진행기가 틱 끝에 따로 적어 둔
 *   `drawGateOpen` 을 본다(`playGate.passPlayGateBetweenTicks`).
 * - +0x1962(유지 반짝임 셈)는 아무도 0 으로 안 되돌려 **장면 내내 이어진다**, +0x36 은 경기 상태 초기화 0xb6814(0xb687e)만 0 으로 둔다
 *   — 부르는 쪽이 경기 장면 동안 들고 다닌다(`DefenseSceneMemory`).
 * - 홈런더비(모드 7)는 이 화면이 아니다(타석 화면 — pages/home-run-derby). 여기는 일반 · 팀 · 투수 · 미션 모드의 0x17 이다.
 *
 * ⚠️ 남은 것
 * - 키 건너뛰기 0x519cc(+0xfe7)는 `fastForwardDefenseEffects`(글자 끄기 · 효과 칸 버리기 · 파티클 치우기) 뒤 52b26 이 한 그림 안에서
 *   판을 끝까지 돌리는 동안 `updateDefenseEffectsWithoutDraw`(갱신 쪽만)다 — 수비 재생 화면(`DefensePlayback`)이 부른다.
 * - 판이 닫힌 뒤 0x35108 까지의 그림 수는 +0x1094 가 11 이 될 때(홈런 타구 0x357e0 && 홈런 점수판 [+0x1100] 이 켜져 있는 동안은 더 —
 *   `runScoreBoard.closesDefenseScene`)다. 수비 재생은 그 갱신마다 그리기(비거리 판 · 득점 점수판) · 파티클 틱을 돌린다.
 * - 0x11 · 0x13 타석 화면에서 쏜 타격 불꽃 이미터는 0x17 로 이어지지 않는다(2026-10-08 직접 뜸) — 파티클 관리자 [0x1400068] 는 하나지만
 *   0x17 진입 0x46418 이 4673a~46740 에서 `0x6dee4([0x1400068])`(이미터마다 0x6de30 으로 지우고 수 = 0)를 **갈래 없이** 부른다
 *   (0x46418 머리 ~ 0x46740 사이에 그 너머로 뛰는 분기가 없다). 그래서 수비 재생은 판마다 빈 파티클 장면으로 시작한다.
 */

/** 경기 장면 동안 남는 칸 — 부르는 쪽이 판마다 넘기고 판이 끝나면 돌려받는다 */
export interface DefenseSceneMemory {
  /** 장면 +0x1961 · +0x1962 · +0x1963 · +0x1964+i — HOMERUN 글자 칸 */
  readonly textScene: HomeRunTextState
  /** 경기 상태 +0x36 — 표시 비거리 */
  readonly displayDistance: number
}

/** 장면 new · 경기 상태 초기화(0xb6814)의 0 */
export const DEFENSE_SCENE_START: DefenseSceneMemory = { textScene: HOME_RUN_TEXT_SCENE_START, displayDistance: 0 }

/** 한 판 동안의 연출 칸 */
export interface DefenseEffects {
  /** +0x1960 — HOMERUN 글자 켜짐 (비거리 판도 이것을 본다) */
  readonly textOn: boolean
  readonly text: HomeRunTextState
  /** 홈런 효과 객체 [0x1400064] 종류 2 — 이 판에서 아직 안 깔았으면 null */
  readonly fireworks: HomeRunFireworks<number> | null
  /** +0x36 */
  readonly displayDistance: number
}

export function defenseEffectsOf(memory: DefenseSceneMemory): DefenseEffects {
  return { textOn: false, text: memory.textScene, fireworks: null, displayDistance: memory.displayDistance }
}

export function sceneMemoryOf(effects: DefenseEffects): DefenseSceneMemory {
  return { textScene: effects.text, displayDistance: effects.displayDistance }
}

/** 진행기 한 틱(= 원본 한 그림의 갱신)에서 연출이 보는 것 */
export interface DefenseTickFacts {
  /** 이 틱에 결과 코드 8 · 12 메시지(0x51c82)를 지났다 */
  readonly homeRunBranch: boolean
  /** 이 틱 일반 갈래 0x528f0 이 +0x36 에 쓴 값 (안 썼으면 null) */
  readonly displayDistance: number | null
  /** 그리기 0x46e2e~0x46e58 — 관문 열림 && (state[0x1d] || 플레이+0x129) */
  readonly drawsText: boolean
}

/** 진행기 한 틱 앞의 상태에서 읽어 둘 것 — 진행기는 상태를 제자리에서 고친다 */
export interface DefenseTickBefore {
  readonly tick: number
  readonly homeRunEvent: boolean
}

export function tickBeforeOf(state: DefensePlayState): DefenseTickBefore {
  return { tick: state.tick, homeRunEvent: state.homeRunEvent }
}

/** 진행기가 한 틱을 돈 뒤 — 그 틱에 연출이 볼 것을 읽는다 */
export function defenseTickFactsOf(before: DefenseTickBefore, after: DefensePlayState, finished: boolean): DefenseTickFacts {
  return {
    // 사건 8 은 결과 코드 8 · 12 에서만 서고 판에 한 번이다(0x9d5bc 는 +0x112 가 서기 전 한 번 — 6d 절)
    homeRunBranch: !before.homeRunEvent && after.homeRunEvent,
    displayDistance: displayDistanceWrittenAt(before.tick, after),
    // 그리기 쪽 관문은 이 틱 플레이 틱 뒤에 부르는 G3(0x46e3c)이다 — 틱 끝 G2(`finished`)보다 +0x120 이 하나 덜 올랐을 때 본다
    drawsText: (after.drawGateOpen ?? !finished) && (after.homeRunFlag || after.play.suppressed),
  }
}

/**
 * 일반 갈래 0x528f0~0x5297a — 공 틱 t 의 갱신에서 +0x36 을 쓰는가. 쓰면 그 값(낙구 점의 비거리), 아니면 null.
 * `(t == aa4 && aa0 ≥ t) || (t == ab0 && aa0 ≥ ab0)` 이고 0xb68dc(파울)가 거짓일 때만.
 */
export function displayDistanceWrittenAt(tick: number, state: DefensePlayState): number | null {
  const { trajectory } = state
  const landing = trajectory.landingTick
  const atFence = tick === trajectory.fenceTick && landing >= tick
  const atPole = tick === trajectory.poleTick && landing >= trajectory.poleTick
  if (!atFence && !atPole) return null
  const foul = isFoulEnded({
    flyOut: state.flyOut,
    specialEvent: state.input.specialEvent === true,
    foulAngle: state.foulAngle,
    strikes: state.input.strikes ?? 0,
    buntKind: state.input.buntKind ?? 0,
    poleTick: trajectory.poleTick,
    fenceTick: trajectory.fenceTick,
    ballTouched: false,
  })
  if (foul) return null
  return derbyDistanceOf(trajectory.pointAt(landing))
}

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
}

/**
 * 원본 한 그림 — 갱신의 홈런 갈래(글자 켜기 · 효과 깔기 · +0x36) → 그리기(비거리 판 · 글자 · 유지 그림의 효과 틱) → 파티클 틱.
 * 판이 닫힌 뒤의 그림은 `facts` 를 null 로 넘긴다(갱신이 529f0 로 빠져 판 칸을 안 건드리고 글자도 안 그린다).
 */
export function stepDefenseEffects(
  effects: DefenseEffects,
  facts: DefenseTickFacts | null,
  ports: DefenseEffectsPorts,
): DefenseEffectsFrame {
  let { textOn, text, fireworks, displayDistance } = effects
  // 갱신 — 0x51cd8 · 0x51d0c
  if (facts?.homeRunBranch === true) {
    text = generalHomeRunTextOn(text)
    textOn = true
    fireworks = initHomeRunFireworks<number>()
  }
  // 갱신 — 0x5297a
  if (facts !== null && facts.displayDistance !== null) displayDistance = facts.displayDistance
  // 그리기 — 0x36cd4 는 +0x1960 만 본다
  const distanceBoard = textOn ? displayDistance : null
  // 그리기 — 0x40b18 (0x40b22: +0x1960 이 꺼졌으면 아무것도 안 한다)
  let textFrame: HomeRunTextFrame | null = null
  if (facts?.drawsText === true && textOn) {
    const isHold = text.stage >= 4
    const drawn = drawHomeRunTextOnce(text)
    textFrame = drawn.frame
    text = drawn.next
    // 0x40faa — 유지 단계를 그린 그림에서만 효과 틱
    if (isHold && fireworks !== null && ports.random !== undefined) {
      fireworks = tickHomeRunFireworks(fireworks, fireworksPortOf(ports.particles, ports.configOf), ports.random)
    }
  }
  // 프레임 끝 — 0x6de84
  if (ports.random !== undefined) tickParticles(ports.particles, ports.random)
  return { effects: { textOn, text, fireworks, displayDistance }, text: textFrame, distanceBoard }
}

/**
 * 키 건너뛰기 0x519cc(51a0a~51a32) — +0x1960 = 0(글자 끄기) · 0x8fc70(홈런 효과 칸 버리기) · 파티클 +0x57 = 0 · 0x6dee4(파티클 치우기).
 * 글자 칸(+0x1961~)과 +0x36 은 안 건드린다. ⚠️ 0x6e418(소리 멈춤)은 소리 포트에 멈춤이 없어 안 옮겼다.
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
  return { textOn, text, fireworks, displayDistance }
}

/** 0x17 끝 0x35108 — 글자를 끄고(0x351d0) 파티클을 치운다(0x6dee4) */
export function endDefenseEffects(effects: DefenseEffects, particles: ParticleScene): DefenseEffects {
  clearParticles(particles)
  return { ...effects, textOn: false }
}
