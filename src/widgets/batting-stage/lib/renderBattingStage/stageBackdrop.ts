/** 타석 그림 한 장의 공통 값(타석 좌우 · 결과 배경 · 0x13 카메라 · 창 첫 그림 수)과 배경 0x41230 */
import { drawScenery } from '@/widgets/batting-stage/lib/renderScenery'
import { skyColumnOfInning } from '@/widgets/batting-stage/lib/stageScenery'
import { STAGE_SIDE } from '@/widgets/batting-stage/lib/stageLayout'
import { redrawsUpTo } from '@/widgets/batting-stage/lib/stageRedraws'
import { stageCameraShiftOf } from '@/widgets/batting-stage/lib/hitCamera'
import type { CameraShift } from '@/widgets/batting-stage/lib/renderBattingStage/screen/cameraShift'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage/stageScene'

export interface StageView {
  readonly side: number
  /** 결과 창 뒤 배경만 그리는 때의 구장 내림 y (`resultBackdropOffsetY`), 아니면 null */
  readonly backdropOffsetY: number | null
  /** 0x13 카메라(`hitCamera`) — 고정 오프셋(−120, −70) 그림에서 옮길 차이. 0x13 이 아니면 (0, 0) */
  readonly cameraShift: CameraShift
  /** 이 그림까지 든 창 첫 그림 수 — 장면이 사는 동안 도는 그리기 쪽 애니(하늘 조명 0x78490 · 램프 그리기 0x373d0 의 확대 갈래 0x37828~0x37858)에 더한다 */
  readonly redrawsSoFar: number
}

export function stageViewOf(scene: StageScene): StageView {
  return {
    side: scene.side ?? STAGE_SIDE,
    backdropOffsetY: scene.resultBackdropOffsetY ?? null,
    cameraShift: stageCameraShiftOf(scene.camera),
    redrawsSoFar: redrawsUpTo(scene.redrawTicks, scene.tick),
  }
}

export function drawStageBackdrop(context: CanvasRenderingContext2D, scene: StageScene, view: StageView): void {
  const hud = scene.hud
  drawScenery(context, {
    ...scene.scenery,
    // 하늘 조명 0x78490 은 배경 0x41230 그림마다 한 칸(78542 0x93d91) — 창 첫 그림도 배경을 그린다(전광판 셈은 `scoreboardTick`)
    tick: scene.tick + view.redrawsSoFar,
    side: view.side,
    skyColumn: skyColumnOf(scene),
    ourTeamId: hud === null ? null : (hud.ourTeamId ?? null),
    opponentTeamId: hud === null ? null : (hud.opponentTeamId ?? null),
    offsetY: view.backdropOffsetY ?? 0,
    ...cameraShiftField(view.cameraShift),
  })
}

/** 하늘 칸 = 경기 상태 +0x6b(0부터 세는 이닝) — 1회가 칸 0. 정산 결과 배경은 장면이 준 칸 */
function skyColumnOf(scene: StageScene): number {
  return scene.skyColumn ?? skyColumnOfInning(scene.hud?.inning ?? 1)
}

/** 0x41230 — 구장 +0xf10 자리 = (+0xff4, +0xff8). 0x13 카메라가 옮긴 만큼 하늘 · 구름 · 펜스 · 바닥이 따라간다 */
function cameraShiftField(cameraShift: CameraShift): { readonly cameraShift?: CameraShift } {
  return cameraShift.dx === 0 && cameraShift.dy === 0 ? {} : { cameraShift }
}
