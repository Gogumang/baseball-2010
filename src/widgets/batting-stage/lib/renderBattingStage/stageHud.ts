/**
 * 타석 공용 그림 0x4c4bc — 점수판 HUD(램프) · 미션 띠 · 존 또는 구질 목록 · "*MENU" "#TIME" · 구속 판 · 필살 남은 횟수 · 스킬 판.
 * 그리기 목록(투수 · 타자 · 공, 0xbe6a1)을 비운 뒤 그 위에 그린다. 0x1b · 0x23 은 이 묶음을 안 부른다(`omitsHud`)
 */
import { drawHud } from '@/widgets/batting-stage/lib/renderHud'
import { DRAW_EFFECT, drawImagesWithEffect } from '@/shared/lib/pixelEffect/pixelEffect'
import { sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import { drawSoftKeyLabels } from '@/widgets/batting-stage/lib/softKeyLabels'
import type { StagePhaseSnapshot } from '@/widgets/batting-stage/lib/softKeyLabels'
import { drawSpecialSwingBadge } from '@/widgets/batting-stage/lib/specialSwingBadge'
import { drawSkillPanel } from '@/widgets/batting-stage/lib/skillPanel'
import { drawPitchSpeedReadout } from '@/widgets/batting-stage/lib/pitchSpeedReadout'
import { drawPitchMenu } from '@/widgets/batting-stage/lib/pitchInputOverlay'
import { drawStrikeZone, showsStrikeZone } from '@/widgets/batting-stage/lib/renderBattingStage/strikeZone'
import { withCameraShift } from '@/widgets/batting-stage/lib/renderBattingStage/screen/cameraShift'
import type { StageView } from '@/widgets/batting-stage/lib/renderBattingStage/stageBackdrop'
import type { StageMissionStrip, StageScene } from '@/widgets/batting-stage/lib/renderBattingStage/stageScene'

export function drawStageHud(context: CanvasRenderingContext2D, scene: StageScene, view: StageView): void {
  if (scene.hud !== null) {
    // 틱을 넘기는 까닭 = 새 램프 확대 연출(0x373d0 안 갈래 0x37828~0x37858)이 5틱 동안 배율을 줄인다
    // HUD 그리기 0x4c4bc 가 4c50c 에서 램프 그리기 함수 0x373d0(373d0~378f8)을 부르고, 확대는 그 안 갈래다 — 0x37828 을 부르는
    // BL · 리터럴은 없다. 창 첫 그림도 타이머를 한 번 더 줄인다(그림 번호로 넘긴다)
    drawHud(context, scene.hud, scene.tick + view.redrawsSoFar)
  }
  // 0x373d0 끝 0x378f0 → 0x36cb8(모드 5 · 6) → 0x36714 — 미션 HUD 띠 (Q-03 r301)
  if (scene.missionStrips !== undefined && scene.missionStrips !== null) drawMissionStrips(context, scene.missionStrips)
  drawZoneOrPitchMenu(context, scene, view)
  if (scene.stagePhase !== undefined) drawPhaseLabels(context, scene, scene.stagePhase, view)
  // 0x4c4bc 꼬리 0x4cad4 — 경기 스킬 표시 판 0x4b5b4 (`skillPanel`)
  if (scene.skillPanel !== undefined && scene.skillPanel !== null) drawSkillPanel(context, scene.skillPanel)
}

/** 미션 HUD 띠 — 효과 1 로 화면을 읽어 섞는다(`drawImagesWithEffect`). 그림이 아직 안 왔으면 그 장은 건너뛴다(오면 다시 그린다) */
function drawMissionStrips(context: CanvasRenderingContext2D, strips: readonly StageMissionStrip[]): void {
  drawImagesWithEffect(
    context,
    strips.flatMap((strip) => {
      const image = sprite(strip.src)
      return image === null ? [] : [{ image, x: strip.x, y: strip.y, effect: DRAW_EFFECT.TRANSLUCENT, argument: strip.level }]
    }),
  )
}

/**
 * 0x4c4bc 가 HUD(0x4c50c) 다음 0x4c53c 에서 존 0x35ae8 을 부른다 — 그리기 목록(투수·타자·공, 0xbe6a1) 위다.
 * 4c528 — 상태 0xf 이고 사람 수비면 존 대신 구질 목록(빛 지도 · 고리 · 칸)
 */
function drawZoneOrPitchMenu(context: CanvasRenderingContext2D, scene: StageScene, view: StageView): void {
  const pitchInput = scene.pitchInput ?? null
  if (pitchInput?.kind === '구질') drawPitchMenu(context, pitchInput, view.side)
  else if (showsStrikeZone(scene.stagePhase)) withCameraShift(context, view.cameraShift, () => drawStrikeZone(context, view.side))
}

/** 상태 갈래의 글 · 판 — 단계를 아는 화면만 */
function drawPhaseLabels(context: CanvasRenderingContext2D, scene: StageScene, phase: StagePhaseSnapshot, view: StageView): void {
  // 0x4c4bc 꼬리 0x4c8e0 — "*MENU" · "#TIME" (`softKeyLabels`). 교체 창(0xb)은 상태 문턱 밖이라 둘 다 없다
  drawSoftKeyLabels(context, phase, scene.timeKeyCount ?? null, scene.isSubstitutionState === true)
  // 0x4c4bc 의 0x4c9fc — 상태 0x12 의 "Km" 판 · 표시 구속 [+0x19a0] (`pitchSpeedReadout`)
  drawPitchSpeedReadout(context, phase, scene.pitch?.displaySpeedKmh)
  // 0x4c4bc 꼬리 0x4cace — 필살 남은 횟수 0x38a30 (`specialSwingBadge`)
  // 0x38a30 — 자리는 [+0xff4] + 투영 (38ab4)이라 카메라를 탄다
  withCameraShift(context, view.cameraShift, () => drawSpecialSwingBadge(context, phase, scene.specialSwingRemaining ?? null, view.side))
}
