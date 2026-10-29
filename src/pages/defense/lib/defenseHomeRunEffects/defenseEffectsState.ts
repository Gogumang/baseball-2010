/** 경기 장면 칸 · 판 칸 · 한 틱 사실 · 표시 비거리 (+0x1960~ · +0x36) */
import { derbyDistanceOf } from '@/entities/home-run-derby/model/derbyRules'
import type { HomeRunFireworks } from '@/entities/batting/model/homeRunFireworks'
import { isFoulEnded } from '@/entities/fielding/model/playGate'
import type { DefensePlayState } from '@/features/defense-play/model/runDefensePlay'
import { HOME_RUN_TEXT_SCENE_START } from '@/widgets/batting-stage/lib/homeRunBanner'
import type { HomeRunTextState } from '@/widgets/batting-stage/lib/homeRunBanner'

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
  /**
   * 공+0xab4 — 공 그리기의 튐 파티클(0x37042)이 1 로 세우고 0x17 진입 0x46734 · 공 초기화 0xa267c(a26bc)가 0 으로 내린다. 읽는 곳은
   * 없다(r247 전수 훑기 — `lib/ballParticles` 머리말). 안 주면 거짓
   */
  readonly ballBounced?: boolean
}

export function defenseEffectsOf(memory: DefenseSceneMemory): DefenseEffects {
  return { textOn: false, text: memory.textScene, fireworks: null, displayDistance: memory.displayDistance, ballBounced: false }
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
