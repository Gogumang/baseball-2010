import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import {
  JUDGE_POPUP_START,
  NO_ZOOM_PUNCH,
  startZoomPunch,
  stepJudgePopup,
  stepZoomPunch,
  type BigOutFrame,
  type JudgePopupState,
  type JudgeTextFrame,
  type ZoomPunchFrame,
  type ZoomPunchState,
} from '@/features/defense-play/model/laserPresentation'

/**
 * **수비 장면의 연출 칸 — 판을 넘어 남는다** (경기 장면 객체 칸 · 전역 줌 0x15606d8, 2026-10-08 직접 뜸).
 *
 * 그리기 0x46c88 의 차례는 결과 판 0x46844(46de4) → 레이저 연출 0x4403c(46e08) → 필살 포구 연출 B 0x441c4(46e0e) →
 * C 0x44398(46e14) → 줌 펀치 0xbb84c(46e24) 다. 셋 다 **같은 단계 칸 +0x1992** 를 쓴다(레이저는 +0x1990, B 는 +0x1994,
 * C 는 +0x1995 가 설 때만 돈다).
 *
 * 이 칸들은 장면 초기화 0x3e340(경기 장면을 만들 때 한 번) 말고는 판마다 지워지지 않는다:
 * - 0x17 진입 0x46418(4670e)은 결과 판 타이머 +0x108c = −1 만 적는다.
 * - 투구 0x11 진입 0x3de10(3df32)이 +0x1997 = 1, 0x10 진입 0x39894 가 game_judge 애니를 모두 되감는다(큰 OUT 애니 2 포함).
 * - +0x1998 · +0x1999 를 지우는 곳은 결과 판의 보통 갈래와 큰 OUT 끝뿐이다 — 판 끝에 남으면 다음 판까지 간다.
 * - deadly_effect(게임+0x1024) 애니 0 은 **아무도 되감지 않는다**(xval 0x1024: 적재 0x48a48 · 해제 0x33854 · 0x4403c · 0x441c4 ·
 *   0x44398 뿐). 연출 단계 0 의 0x93cfd(애니, 0) 은 칸을 0 으로 돌리지 않고 돌리기 비트만 켠다 — 그래서 한 경기의 **첫** 필살
 *   포구만 0 · 1 · 2 · 3 칸을 다 그리고, 그 뒤로는 끝 칸 3 을 한 그림 그리고 곧바로 끝난다(93df2 넘김이 곧 감김 → 끝 비트).
 * 웹은 판마다 진행기를 새로 세우므로 이 칸들을 `DefenseScene` 으로 묶어 경기 흐름이 판에서 판으로 넘긴다.
 *
 * ⚠️ 미해결(근사): 3아웃 뒤 상태 0x18 도 수비 화면 0x46c88 을 그려 결과 판 · 연출이 그동안 이어 돈다 — 웹은 0x18 그림이 없어
 *   남은 연출을 다음 수비 화면이 이어받는다. 견제 판은 투구(0x10 · 0x11)를 안 지나 +0x1997 · 애니 2 를 안 되감는 것으로 본다(유력).
 */
export interface DefenseScene {
  /** 결과 판 0x46844 의 칸 (+0x108c · +0x10ac · +0x1088 · +0x1997 · +0x1998 · +0x1999 · 애니) */
  readonly popup: JudgePopupState
  /** +0x1992 — 연출 단계(−1 쉼). 레이저 · B · C 가 함께 쓴다 */
  readonly effectStep: number
  /** +0x1990 — 레이저 연출 0x4403c 가 돈다 (0x400bc 가 세우고 단계 3 이 내린다) */
  readonly laserRunning: boolean
  /** +0x1994 — 필살 점프 캐치 연출 B 0x441c4 가 돈다 */
  readonly jumpFlash: boolean
  /** +0x1995 — 필살 슬라이딩 캐치 연출 C 0x44398 가 돈다 */
  readonly slideFlash: boolean
  /** +0x1996 — C 의 방향(공 가진 야수 +0xa8 동작 번호 0xf~0x12) */
  readonly slideDirection: number
  /** 줌 펀치 전역 0x15606d8 */
  readonly zoomPunch: ZoomPunchState
  /** deadly_effect 애니 0 — 경기 내내 되감기지 않는다 */
  readonly deadlyAnim: DeadlyAnimState
  /**
   * 플레이 객체 +0x160 — 사람이 고른 송구 목표 루(−1 없음). 플레이 객체도 장면과 함께 한 번 만들어지고(생성자 0xb0b3a · 0xb0b6e),
   * +0x160 을 쓰는 곳은 그 둘 · 키 메시지 0x588 의 vt60 0xb3118 · 던진 뒤 b46a8 의 −1 뿐이다(즉치 0xb0 << 1 전수) — 판 시작
   * vt1c 0xb0edc 도 안 지운다. 그래서 판 안에서 못 쓴 키(공을 아무도 안 쥐었거나 밀어내기 판처럼 vt4c 가 안 도는 판)는 다음 판의
   * 첫 쥔 야수가 준비되면 그 루로 보낸다.
   */
  readonly throwTarget: number
}

/** deadly_effect 애니 0 의 상태 칸 (애니 +8 객체의 [0] 칸 · [2] 비트) — 지연 0 이라 셈 칸은 늘 0 이다 */
export interface DeadlyAnimState {
  readonly frameIndex: number
  /** 비트 1 — 돌고 있다 */
  readonly playing: boolean
  /** 비트 2 — 끝났다(감겼다) */
  readonly ended: boolean
}

/** deadly_effect 애니 0 = 프레임 [0, 1, 2, 3] 지연 0 (R2 2절) */
const DEADLY_ANIM_FRAMES = 4

/** 경기 장면을 막 만든 상태 — 0x3e340 · 그림 적재 0x48658 뒤 */
export const DEFENSE_SCENE_START: DefenseScene = {
  popup: JUDGE_POPUP_START,
  effectStep: -1,
  laserRunning: false,
  jumpFlash: false,
  slideFlash: false,
  slideDirection: 0,
  zoomPunch: NO_ZOOM_PUNCH,
  deadlyAnim: { frameIndex: 0, playing: false, ended: false },
  throwTarget: -1,
}

/**
 * 수비 화면에 들어설 때 — 0x17 진입 0x46418 이 결과 판 타이머를 −1 로, 투구를 거쳐 온 판이면(타구 · 볼넷 · 도루 · 폭투)
 * 0x39894 · 0x3de10 이 애니 되감기 · +0x1997 = 1 을 먼저 했다.
 */
export function enterDefenseScene(scene: DefenseScene | undefined, afterPitch: boolean): DefenseScene {
  const base = scene ?? DEFENSE_SCENE_START
  const popup = afterPitch ? { ...base.popup, shown: true, bigOutDraws: 0, textAdvances: 0 } : base.popup
  return { ...base, popup: { ...popup, timer: -1 } }
}

/** 레이저 발사 0x400bc(40100) — +0x1992 = 0 · +0x1991 = +0x1990 = 1 (+0x1993 · 플레이 vt64(1) 은 진행기 몫) */
export function fireLaser(scene: DefenseScene): DefenseScene {
  return { ...scene, effectStep: 0, laserRunning: true }
}

/**
 * 슬롯 2 머리 5256c~525dc — 플레이+0x1f7(필살 점프 캐치 동작이 걸림)이면 +0x1994 = 1, 아니고 +0x1f8(슬라이딩)이면 +0x1995 = 1,
 * 그리고 단계가 −1 이면 0. 관문 G2(52502)가 열리고 판 종류가 마스크 0x58c(2 · 3 · 7 · 8 · 10) 밖일 때만 온다(부르는 쪽이 본다).
 * ⚠️ 그 앞 5254c 의 갈래 — +0x1991(레이저를 쏜 적 있음) && 0xb4c9d(포구 틱 관문 · 동작 시작 틱 − 1 == 공 틱)면 +0x1991 = 0 으로
 *   내리고 이 그림의 켜기를 건너뛴다 — 는 옮기지 않았다. 그 그림은 동작 시작 바로 앞이라 켜짐 칸이 아직 안 서 있다.
 */
export function turnOnDeadlyFlash(scene: DefenseScene, flags: { readonly jump: boolean; readonly slide: boolean }): DefenseScene {
  if (flags.jump) {
    return { ...scene, jumpFlash: true, effectStep: scene.effectStep === -1 ? 0 : scene.effectStep }
  }
  if (flags.slide) {
    return { ...scene, slideFlash: true, effectStep: scene.effectStep === -1 ? 0 : scene.effectStep }
  }
  return scene
}

/** 이 그림의 필살 포구 번쩍임 — deadly_effect 프레임 · 종류 · 공 가진 야수 자리(월드 x · z − y) */
export interface DeadlyFlashFrame {
  readonly kind: 'b' | 'c'
  readonly step: number
  readonly direction?: number
  readonly x: number
  readonly z: number
}

export interface SceneDrawContext {
  /** 플레이+0x130 (0xb0c91) — 공 가진 야수 칸 */
  readonly holderSlot: number
  /** 그 야수의 +0x20 자리 */
  readonly holder: WorldPoint | undefined
  /** 그 야수의 +0xa8 동작 번호 (C 의 방향) */
  readonly holderAction: number | undefined
}

export interface SceneDraw {
  readonly scene: DefenseScene
  readonly bigOut: BigOutFrame | null
  readonly judgeText: JudgeTextFrame | null
  readonly flash: DeadlyFlashFrame | null
  readonly zoom: ZoomPunchFrame | null
  /** 결과 판이 state[0x8b] = 1 을 적었다 (46932) */
  readonly recordsLaserOut: boolean
  /** 레이저 단계 0 — +0x19ad · +0x19ae 를 내린다 */
  readonly laserStepZero: boolean
  /** +0x1993 = 0 (레이저 단계 1 · B · C 끝) */
  readonly unpaused: boolean
  /** B · C 끝 — 플레이+0x1f4 · +0x1f7 · +0x1f8 = 0 */
  readonly flashEnded: boolean
}

/** 0x93cfd(애니, 0) — 돌고 있지 않으면 비트 0 · 4 를 지우고 돌리기 비트를 켠다. 칸 · 끝 비트는 그대로다 */
function startDeadlyAnim(anim: DeadlyAnimState): DeadlyAnimState {
  return anim.playing ? anim : { ...anim, playing: true }
}

/**
 * 0x93c45(그리기) 뒤 0x93d91(넘기기) — 그린 칸과 넘긴 상태. 지연 0 이라 넘길 때마다 칸이 오르고, 4 에서 감기면 끝 비트를 세우고
 * 되풀이가 아니라 마지막 칸(3)에 멈춘다(93e16 → 0x93d30(애니, 0)). 감기지 않은 넘김은 끝 비트를 지운다(93e04).
 */
function drawDeadlyAnim(anim: DeadlyAnimState): { readonly frame: number; readonly next: DeadlyAnimState } {
  const frame = anim.frameIndex
  if (!anim.playing) return { frame, next: anim }
  const index = anim.frameIndex + 1
  if (index < DEADLY_ANIM_FRAMES) return { frame, next: { frameIndex: index, playing: true, ended: false } }
  return { frame, next: { frameIndex: DEADLY_ANIM_FRAMES - 1, playing: false, ended: true } }
}

/**
 * 수비 화면 그리기 0x46c88 한 번의 연출 몫 — 결과 판 → 레이저 0x4403c → B 0x441c4 → C 0x44398 → 줌 0xbb84c.
 *
 * ```
 * 4403c (+0x1990) 단계 0: 0x93cfd(deadly 애니 0, 0) · +0x1997 = +0x19ad = +0x19ae = 0 · 단계 1
 *                 1: 줌 0xbb39d(100, H) · +0x1993 = 0 · 단계 2 / 2: 단계 3 / 3: 단계 −1 · +0x1990 = 0 · +0x1998 = +0x1999 = 1
 * 441c4 (+0x1994) 점프표 0xd0040 — 단계 0: 0x93cfd(애니, 0) · 단계 1 · +0x1997 = 0 / 1~5: 단계++ / 6: 줌 0xbb39d(100, H) · 단계 7 /
 *                 7: 애니를 (H, y − 50) 에 그리고 넘김, 끝 비트면 +0x1993 = 0 · 단계 −1 · +0x1994 = 0 · 플레이+0x1f4 = +0x1f8 = +0x1f7 = 0 ·
 *                    +0x1998 = 1 (+0x1999 는 안 세운다 — 필살송구 기록 36 과 상관없다)
 * 44398 (+0x1995) 점프표 0xd0060 — 단계 0: B 와 같다 / 1 · 2: +0x1996 = H+0xa8 · 줌 · 단계++ / 3 · 4: 줌 · 단계++ /
 *                 5: 애니를 방향대로 (0xf → y + 10 · 0x10 → y − 10 · 0x11 → x − 10 · 0x12 → x + 10) 그리고 넘김, 끝이면 B 와 같다(+0x1995)
 * ```
 * H = 0xb0c91 = 플레이+0x130 야수, 자리는 그 +0x20 의 (x, z − y) 화면점. 줌은 시작할 때마다 100% · 커지는 중으로 다시 선다.
 */
export function drawDefenseScene(scene: DefenseScene, context: SceneDrawContext): SceneDraw {
  // 46de4 — 결과 판
  const popupStep = stepJudgePopup(scene.popup)
  let popup = popupStep.next
  let effectStep = scene.effectStep
  let laserRunning = scene.laserRunning
  let jumpFlash = scene.jumpFlash
  let slideFlash = scene.slideFlash
  let slideDirection = scene.slideDirection
  let zoomPunch = scene.zoomPunch
  let deadlyAnim = scene.deadlyAnim
  let laserStepZero = false
  let unpaused = false
  let flashEnded = false
  let flash: DeadlyFlashFrame | null = null
  const zoomOnHolder = () => {
    if (context.holder !== undefined) zoomPunch = startZoomPunch(context.holder)
  }
  const endFlash = () => {
    unpaused = true
    effectStep = -1
    flashEnded = true
    popup = { ...popup, bigOutArmed: true }
  }

  // 46e08 — 레이저 연출
  if (laserRunning) {
    if (effectStep === 0) {
      deadlyAnim = startDeadlyAnim(deadlyAnim)
      popup = { ...popup, shown: false }
      laserStepZero = true
      effectStep = 1
    } else if (effectStep === 1) {
      zoomOnHolder()
      unpaused = true
      effectStep = 2
    } else if (effectStep === 2) {
      effectStep = 3
    } else if (effectStep === 3) {
      effectStep = -1
      laserRunning = false
      popup = { ...popup, bigOutArmed: true, bigOutRecord: true }
    }
  }

  // 46e0e — B 필살 점프 캐치
  if (jumpFlash && effectStep >= 0 && effectStep <= 7) {
    if (effectStep === 0) {
      deadlyAnim = startDeadlyAnim(deadlyAnim)
      effectStep = 1
      popup = { ...popup, shown: false }
    } else if (effectStep <= 5) {
      effectStep += 1
    } else if (effectStep === 6) {
      zoomOnHolder()
      effectStep = 7
    } else {
      const drawn = drawDeadlyAnim(deadlyAnim)
      deadlyAnim = drawn.next
      if (context.holder !== undefined) {
        flash = { kind: 'b', step: drawn.frame, x: context.holder.x, z: context.holder.z - context.holder.y }
      }
      if (deadlyAnim.ended) {
        jumpFlash = false
        endFlash()
      }
    }
  }

  // 46e14 — C 필살 슬라이딩 캐치
  if (slideFlash && effectStep >= 0 && effectStep <= 5) {
    if (effectStep === 0) {
      deadlyAnim = startDeadlyAnim(deadlyAnim)
      effectStep = 1
      popup = { ...popup, shown: false }
    } else if (effectStep <= 4) {
      if (effectStep <= 2) slideDirection = context.holderAction ?? 0
      zoomOnHolder()
      effectStep += 1
    } else {
      const drawn = drawDeadlyAnim(deadlyAnim)
      deadlyAnim = drawn.next
      if (context.holder !== undefined) {
        flash = {
          kind: 'c',
          step: drawn.frame,
          direction: slideDirection,
          x: context.holder.x,
          z: context.holder.z - context.holder.y,
        }
      }
      if (deadlyAnim.ended) {
        slideFlash = false
        endFlash()
      }
    }
  }

  // 46e24 — 줌 펀치
  const zoom = stepZoomPunch(zoomPunch)
  zoomPunch = zoom.next

  return {
    scene: { ...scene, popup, effectStep, laserRunning, jumpFlash, slideFlash, slideDirection, zoomPunch, deadlyAnim },
    bigOut: popupStep.bigOut,
    judgeText: popupStep.text,
    flash,
    zoom: zoom.frame,
    recordsLaserOut: popupStep.recordsLaserOut,
    laserStepZero,
    unpaused,
    flashEnded,
  }
}
