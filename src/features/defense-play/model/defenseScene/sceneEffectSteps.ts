import { drawDeadlyAnim, startDeadlyAnim } from '@/features/defense-play/model/defenseScene/deadlyAnim'
import type { DeadlyFlashFrame, SceneDrawContext } from '@/features/defense-play/model/defenseScene/sceneDraw'
import type { DeadlyAnimState, DefenseScene } from '@/features/defense-play/model/defenseScene/sceneState'
import { type JudgePopupState, type ZoomPunchState, startZoomPunch } from '@/features/defense-play/model/laserPresentation'

/** 그리기 한 번 동안 고치는 장면 칸과 그 그림의 결과 표시 — `drawDefenseScene` 이 연출 단계를 차례로 돌리며 고친다 */
export interface SceneDraft {
  popup: JudgePopupState
  effectStep: number
  laserRunning: boolean
  jumpFlash: boolean
  slideFlash: boolean
  slideDirection: number
  zoomPunch: ZoomPunchState
  deadlyAnim: DeadlyAnimState
  laserStepZero: boolean
  unpaused: boolean
  flashEnded: boolean
  flash: DeadlyFlashFrame | null
}

export function draftOf(scene: DefenseScene, popup: JudgePopupState): SceneDraft {
  return {
    popup,
    effectStep: scene.effectStep,
    laserRunning: scene.laserRunning,
    jumpFlash: scene.jumpFlash,
    slideFlash: scene.slideFlash,
    slideDirection: scene.slideDirection,
    zoomPunch: scene.zoomPunch,
    deadlyAnim: scene.deadlyAnim,
    laserStepZero: false,
    unpaused: false,
    flashEnded: false,
    flash: null,
  }
}

/** B 의 마지막 단계(7 — 애니를 그리고 넘긴다) · C 의 마지막 단계(5) */
export const JUMP_FLASH_LAST_STEP = 7
export const SLIDE_FLASH_LAST_STEP = 5

/** 줌 펀치를 공 가진 야수에게서 다시 세운다 — 0xbb39d(100, H) */
function zoomOnHolder(d: SceneDraft, context: SceneDrawContext): void {
  if (context.holder !== undefined) d.zoomPunch = startZoomPunch(context.holder)
}

/** B · C 끝 — +0x1993 = 0 · 단계 −1 · 플레이+0x1f4 = +0x1f8 = +0x1f7 = 0 · +0x1998 = 1 (+0x1999 는 안 세운다) */
function endFlash(d: SceneDraft): void {
  d.unpaused = true
  d.effectStep = -1
  d.flashEnded = true
  d.popup = { ...d.popup, bigOutArmed: true }
}

/** 0x93cfd(deadly 애니 0, 0) · 결과 판 +0x1997 = 0 */
function startEffect(d: SceneDraft): void {
  d.deadlyAnim = startDeadlyAnim(d.deadlyAnim)
  d.popup = { ...d.popup, shown: false }
}

/**
 * 4403c (+0x1990) 단계 0: 0x93cfd(deadly 애니 0, 0) · +0x1997 = +0x19ad = +0x19ae = 0 · 단계 1
 * 1: 줌 0xbb39d(100, H) · +0x1993 = 0 · 단계 2 / 2: 단계 3 / 3: 단계 −1 · +0x1990 = 0 · +0x1998 = +0x1999 = 1
 */
export function stepLaserEffect(d: SceneDraft, context: SceneDrawContext): void {
  switch (d.effectStep) {
    case 0:
      startEffect(d)
      d.laserStepZero = true
      d.effectStep = 1
      return
    case 1:
      zoomOnHolder(d, context)
      d.unpaused = true
      d.effectStep = 2
      return
    case 2:
      d.effectStep = 3
      return
    case 3:
      d.effectStep = -1
      d.laserRunning = false
      d.popup = { ...d.popup, bigOutArmed: true, bigOutRecord: true }
  }
}

/**
 * 441c4 (+0x1994) 점프표 0xd0040 — 단계 0: 0x93cfd(애니, 0) · 단계 1 · +0x1997 = 0 / 1~5: 단계++ / 6: 줌 0xbb39d(100, H) · 단계 7 /
 * 7: 애니를 (H, y − 50) 에 그리고 넘김, 끝 비트면 B 끝
 */
export function stepJumpFlash(d: SceneDraft, context: SceneDrawContext): void {
  if (d.effectStep === 0) {
    startEffect(d)
    d.effectStep = 1
    return
  }
  if (d.effectStep <= 5) {
    d.effectStep += 1
    return
  }
  if (d.effectStep === 6) {
    zoomOnHolder(d, context)
    d.effectStep = 7
    return
  }
  const frame = drawFlashAnim(d)
  const holder = context.holder
  if (holder !== undefined) d.flash = { kind: 'b', step: frame, x: holder.x, z: holder.z - holder.y }
  if (!d.deadlyAnim.ended) return
  d.jumpFlash = false
  endFlash(d)
}

/**
 * 44398 (+0x1995) 점프표 0xd0060 — 단계 0: B 와 같다 / 1 · 2: +0x1996 = H+0xa8 · 줌 · 단계++ / 3 · 4: 줌 · 단계++ /
 * 5: 애니를 방향대로 (0xf → y + 10 · 0x10 → y − 10 · 0x11 → x − 10 · 0x12 → x + 10) 그리고 넘김, 끝이면 B 와 같다(+0x1995)
 */
export function stepSlideFlash(d: SceneDraft, context: SceneDrawContext): void {
  if (d.effectStep === 0) {
    startEffect(d)
    d.effectStep = 1
    return
  }
  if (d.effectStep <= 4) {
    if (d.effectStep <= 2) d.slideDirection = context.holderAction ?? 0
    zoomOnHolder(d, context)
    d.effectStep += 1
    return
  }
  const frame = drawFlashAnim(d)
  const holder = context.holder
  if (holder !== undefined) d.flash = { kind: 'c', step: frame, direction: d.slideDirection, x: holder.x, z: holder.z - holder.y }
  if (!d.deadlyAnim.ended) return
  d.slideFlash = false
  endFlash(d)
}

/** 0x93c45(그리기) 뒤 0x93d91(넘기기) — 그린 칸 */
function drawFlashAnim(d: SceneDraft): number {
  const drawn = drawDeadlyAnim(d.deadlyAnim)
  d.deadlyAnim = drawn.next
  return drawn.frame
}
