/**
 * 투수 그림 객체의 그리기 0x79524. 마투수(+0x3d ≥ 0)는 79568 에서 갈려 실린 ace/pitcher_*.pzx 의 프레임 하나만 효과 0x11(좌투)로
 * 그리고, 평범한 투수는 바탕 · 장비 · 덧그림 여섯 칸을 쌓는다. 프레임은 0x9e0b8 이 상태 · 단계로 고른다 (`pitcherPoseOf`).
 */
import { drawFrameAt, placedFrame, sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import { pitcherPoseOf } from '@/widgets/batting-stage/lib/stageScenery'
import type { PitcherAnimation } from '@/widgets/batting-stage/lib/stageScenery'
import { NO_PITCHER_EQUIPMENT, pitcherLayersOf } from '@/widgets/batting-stage/lib/batterLayers'
import { stageLayoutOf } from '@/widgets/batting-stage/lib/stageLayout'
import { drawMirroredAt } from '@/widgets/batting-stage/lib/renderBattingStage/mirror'
import {
  acePitcherMirrorsOf,
  pitcherMirrorOf,
  pitcherOutfitOf,
  pitcherPaletteOf,
  warmPitcherRecolors,
} from '@/widgets/batting-stage/lib/renderBattingStage/pitcher/pitcherLook'
import type { StageScene } from '@/widgets/batting-stage/lib/renderBattingStage/stageScene'

type AcePitcher = NonNullable<StageScene['acePitcher']>

/** 투수 앵커(프레임 원점 = 발밑, 원본 표 0xcfb18 의 side 칸)와 좌투 거울 — 좌투면 x + 1 (0x38db8) 자리를 축으로 놓는다 */
interface PitcherPlace {
  readonly anchor: { readonly x: number; readonly y: number }
  readonly axisX: number
  readonly isMirrored: boolean
  readonly pose: number
}

export function drawPitcher(context: CanvasRenderingContext2D, scene: StageScene, animation: PitcherAnimation, side: number): void {
  const ace = scene.acePitcher
  const anchor = stageLayoutOf(side).pitcherAnchor
  const pose = pitcherPoseOf(animation, scene.pitcherForm ?? 0, ace?.order ?? null)
  // 좌투면 x + 1 (0x38db8) 자리를 축으로 거울을 놓는다 — 타자 그림과 같은 축 잡기(근사, `drawBatter` 주석)
  const place = { anchor, pose, ...pitcherMirrorOf(anchor.x, scene.pitcherHand ?? 0) }
  if (ace === null) {
    drawPlainPitcher(context, scene, place)
    return
  }
  if (ace.frameCount === 0) {
    drawAcePitcherStill(context, ace, anchor)
    return
  }
  drawAcePitcherFrame(context, ace, place, side)
}

/**
 * 원본 0x79524 는 바탕 프레임 f · 머리 · 몸 · **바탕 f+22** · 손 · 다리 여섯 칸을 이 차례로 쌓는다.
 * f+22 에 몸통·던지는 팔·글러브 안 공이 들어 있다 (PITCHER_OVERLAY_FRAME_OFFSET 주석).
 * 장비 칸(손 · 다리)은 등급 줄(.mpl), 바탕 pitcher.pzx 두 칸은 피부 × 15 + 팀 벌이다 — 적재 0x793b0 의 794c2 가
 * 타석 교대 0x47cc8(482c0~482fc)이 넘긴 수비 팀 · 투수 피부로 연다(`pitcherLayerPaletteIndexOf`)
 */
function drawPlainPitcher(context: CanvasRenderingContext2D, scene: StageScene, place: PitcherPlace): void {
  const equipment = scene.pitcherEquipment ?? NO_PITCHER_EQUIPMENT
  const outfit = pitcherOutfitOf(scene)
  drawMirroredAt(context, place.axisX, place.isMirrored, () => {
    warmPitcherRecolors(equipment, outfit)
    for (const layer of pitcherLayersOf(place.pose, equipment)) {
      const frame = placedFrame(layer.folder, layer.frame, pitcherPaletteOf(layer, outfit))
      if (frame === null) continue
      context.drawImage(frame.image, place.axisX + frame.offsetX, place.anchor.y + frame.offsetY)
    }
  })
}

/** 프레임 합성이 안 된 캐릭터는 정지 그림이라도 세운다 — 다섯 마투수 모두 프레임이 있어 지금은 안 탄다 */
function drawAcePitcherStill(context: CanvasRenderingContext2D, ace: AcePitcher, anchor: PitcherPlace['anchor']): void {
  const image = ace.stillUrl === '' ? null : sprite(ace.stillUrl)
  if (image !== null) context.drawImage(image, anchor.x - image.width / 2, anchor.y - image.height)
}

/** 마투수 — 단계 표 0xd7483 의 프레임 (ace/pitcher_*.pzx 의 프레임 번호 = frames/NNN.png, 원점 origins.json) */
function drawAcePitcherFrame(context: CanvasRenderingContext2D, ace: AcePitcher, place: PitcherPlace, side: number): void {
  const mirrors = acePitcherMirrorsOf(ace.order, place.isMirrored, side)
  // 효과 0 이면 프레임 0xc9f98 이 파트 효과를 따른다 — 드래고나 프레임 5~7 의 0x67 파트(b = 255)는 화면에 더한다.
  // 효과 0x11(뒤집기)은 ca074 갈래라 파트 효과 없이 모두 복사한다(`drawFrameAt` 의 partEffects)
  drawMirroredAt(context, place.axisX, mirrors, () => {
    drawFrameAt(context, ace.framesUrl, place.pose, place.axisX, place.anchor.y, { partEffects: !mirrors })
  })
}
