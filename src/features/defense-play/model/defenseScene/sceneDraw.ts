import type { WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import {
  JUMP_FLASH_LAST_STEP,
  SLIDE_FLASH_LAST_STEP,
  draftOf,
  stepJumpFlash,
  stepLaserEffect,
  stepSlideFlash,
} from '@/features/defense-play/model/defenseScene/sceneEffectSteps'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene/sceneState'
import {
  type BigOutFrame,
  type JudgeTextFrame,
  type ZoomPunchFrame,
  stepJudgePopup,
  stepZoomPunch,
} from '@/features/defense-play/model/laserPresentation'

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
  const d = draftOf(scene, popupStep.next)
  // 46e08 — 레이저 연출
  if (d.laserRunning) stepLaserEffect(d, context)
  // 46e0e — B 필살 점프 캐치
  if (d.jumpFlash && d.effectStep >= 0 && d.effectStep <= JUMP_FLASH_LAST_STEP) stepJumpFlash(d, context)
  // 46e14 — C 필살 슬라이딩 캐치
  if (d.slideFlash && d.effectStep >= 0 && d.effectStep <= SLIDE_FLASH_LAST_STEP) stepSlideFlash(d, context)
  // 46e24 — 줌 펀치
  const zoom = stepZoomPunch(d.zoomPunch)
  const { popup, effectStep, laserRunning, jumpFlash, slideFlash, slideDirection, deadlyAnim } = d
  return {
    scene: { ...scene, popup, effectStep, laserRunning, jumpFlash, slideFlash, slideDirection, zoomPunch: zoom.next, deadlyAnim },
    bigOut: popupStep.bigOut,
    judgeText: popupStep.text,
    flash: d.flash,
    zoom: zoom.frame,
    recordsLaserOut: popupStep.recordsLaserOut,
    laserStepZero: d.laserStepZero,
    unpaused: d.unpaused,
    flashEnded: d.flashEnded,
  }
}
