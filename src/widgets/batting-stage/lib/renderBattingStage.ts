import type { Pitch } from '@/entities/pitching/model/pitch'
import { ballFrameIndexAt, ballPixelAt, platePixelOf } from '@/widgets/batting-stage/lib/trajectory'
import { frameAnimations, JUDGE_FRAMES, PITCHER_FRAMES, placedFrame, sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import { drawScenery } from '@/widgets/batting-stage/lib/renderScenery'
import type { SceneryState } from '@/widgets/batting-stage/lib/renderScenery'
import { judgeAnimationOf, judgeFrameAt, pitcherFrameAt, pitcherIdleFrameAt } from '@/widgets/batting-stage/lib/stageScenery'

import { drawHud } from '@/widgets/batting-stage/lib/renderHud'
import { drawFieldMap } from '@/widgets/batting-stage/lib/renderFieldMap'
import { batterLayersOf } from '@/widgets/batting-stage/lib/batterLayers'

/** 타자 몸통 종류 — 타자 폼을 넘기지 않아 balancer(0) (추정) */
const BATTER_BODY_TYPE = 0
import type { HudState } from '@/widgets/batting-stage/lib/renderHud'
import { STAGE_LAYOUT, toPixel } from '@/widgets/batting-stage/lib/stageLayout'
import { UI_COLORS } from '@/shared/config/design'

export { STAGE_HEIGHT, STAGE_WIDTH, toPixel, toZoneCoordinate } from '@/widgets/batting-stage/lib/stageLayout'

export interface StageScene {
  readonly pitch: Pitch | null
  /** 공 프레임 F (0 = 릴리스). 공이 아직 손을 떠나지 않았으면 음수 */
  readonly frame: number
  /** 투구 시작 뒤 흐른 틱. 투구 중이 아니면 null — 투수는 대기 동작 */
  readonly pitcherTick: number | null
  /** 화면이 열린 뒤 흐른 틱 — 대기 동작 · 구름 */
  readonly tick: number
  /** 판정 글자가 뜬 뒤 흐른 틱 */
  readonly resultTick: number
  readonly scenery: Omit<SceneryState, 'tick' | 'inning' | 'ourTeamId' | 'opponentTeamId'>
  /** 타자 좌우 이동 fe4 — 타자 그림 x 에 더한다 */
  readonly shift: number
  /** 이글아이 아이템 사용 시 공의 도착 지점을 미리 보여준다. */
  readonly isEagleEyeEnabled: boolean
  readonly resultText: string
  /** 타자 자세 f (0xb905c) — 레이어마다 가산값을 더해 그린다 */
  readonly swingFrame: number
  /** 마운드에 그릴 마선수. 없으면 평범한 투수라 그리지 않는다. */
  /** 화면에 겹쳐 그릴 경기 상황 */
  readonly hud: HudState | null
  readonly acePitcher: {
    readonly framesUrl: string
    readonly frameCount: number
    readonly stillUrl: string
  } | null
}

export function renderBattingStage(
  context: CanvasRenderingContext2D,
  scene: StageScene,
): void {
  drawScenery(context, {
    ...scene.scenery,
    tick: scene.tick,
    inning: scene.hud?.inning ?? 1,
    ourTeamId: scene.hud?.ourTeamId ?? null,
    opponentTeamId: scene.hud?.opponentTeamId ?? null,
  })
  const progress = scene.pitch === null || scene.frame < 0 ? -1 : scene.frame / scene.pitch.frameCount
  drawPitcher(context, scene.acePitcher, progress, scene.pitcherTick, scene.tick)
  drawBatter(context, scene.swingFrame, scene.shift)
  drawStrikeZone(context)
  if (scene.pitch !== null && scene.isEagleEyeEnabled) {
    drawEagleEyeMarker(context, platePixelOf(scene.pitch))
  }
  if (scene.pitch !== null && scene.frame >= 0 && scene.frame < scene.pitch.frameCount) {
    drawBall(context, scene.pitch, scene.frame)
  }
  if (scene.hud !== null) {
    drawHud(context, scene.hud)
    // 전광판과 별개로 원본이 타석 중에 그리는 작은 지도 (0x395f4) — 루상 주자가 여기 보인다
    drawFieldMap(context, scene.hud.bases)
  }
  if (scene.resultText !== '') {
    drawResultText(context, scene.resultText, scene.resultTick)
  }
}

/** 타자·투수 앵커 (프레임 원점 = 발밑) — 원본 표 0xcfb2c · 0xcfb18 */
const BATTER_ANCHOR_X = STAGE_LAYOUT.batterAnchor.x
const BATTER_ANCHOR_Y = STAGE_LAYOUT.batterAnchor.y
const MOUND_CENTER_X = STAGE_LAYOUT.pitcherAnchor.x
const MOUND_BOTTOM_Y = STAGE_LAYOUT.pitcherAnchor.y

/** 일반 투수 폼 — 원본 투수 명단 첫 선수의 폼(0)으로 둔다 (추정). 홀수 폼이면 좌우 반전이다 */
const PITCHER_FORM = 0

function drawPitcher(
  context: CanvasRenderingContext2D,
  ace: StageScene['acePitcher'],
  progress: number,
  pitcherTick: number | null,
  tick: number,
): void {
  const ratio = progress < 0 ? 0 : Math.min(1, progress)

  if (ace === null) {
    // 투구 단계 표 (0x9e0b8) · 대기 동작 (state 2)
    const index = pitcherTick === null ? pitcherIdleFrameAt(tick) : pitcherFrameAt(PITCHER_FORM, pitcherTick)
    const frame = placedFrame(PITCHER_FRAMES, index)
    if (frame === null) return
    context.drawImage(frame.image, MOUND_CENTER_X + frame.offsetX, MOUND_BOTTOM_Y + frame.offsetY)
    return
  }

  // 마선수 단계 표(0xd7483)는 아직 옮기지 않아 합성 프레임을 진행률로 돌린다 (추정).
  // 프레임 합성이 안 된 캐릭터는 정지 그림이라도 세운다 — 아무것도 안 그리는 것보다 낫다.
  let image: HTMLImageElement | null
  if (ace.frameCount === 0) {
    image = ace.stillUrl === '' ? null : sprite(ace.stillUrl)
  } else {
    const index = Math.min(ace.frameCount - 1, Math.floor(ratio * ace.frameCount))
    image = sprite(`${ace.framesUrl}/${String(index).padStart(3, '0')}.png`)
  }
  if (image === null) return

  context.drawImage(image, MOUND_CENTER_X - image.width / 2, MOUND_BOTTOM_Y - image.height)
}

/** 원작 타자는 그림자·몸통·헬멧·배트·몸통 앞·다리를 자세마다 다른 순서로 겹친다 (0x78cfc) */
function drawBatter(context: CanvasRenderingContext2D, swingFrame: number, shift: number): void {
  for (const layer of batterLayersOf(swingFrame, BATTER_BODY_TYPE)) {
    const frame = placedFrame(layer.folder, layer.frame)
    if (frame === null) continue
    context.drawImage(
      frame.image,
      BATTER_ANCHOR_X + shift + frame.offsetX,
      BATTER_ANCHOR_Y + frame.offsetY,
    )
  }
}

/** 존 표시는 선이 아니라 slt_pitch 프레임 73(빨간 모서리)을 존 가운데에 찍는다 (0x35ae8) */
const ZONE_FRAME_FOLDER = './sprites/slt_pitch/frames'
const ZONE_FRAME_INDEX = 73

function drawStrikeZone(context: CanvasRenderingContext2D): void {
  const frame = placedFrame(ZONE_FRAME_FOLDER, ZONE_FRAME_INDEX)
  if (frame === null) return
  const center = toPixel({ x: 0, y: 0 })
  context.drawImage(frame.image, Math.round(center.x) + frame.offsetX, Math.round(center.y) + frame.offsetY)
}

function drawEagleEyeMarker(context: CanvasRenderingContext2D, center: { x: number; y: number }): void {
  context.strokeStyle = UI_COLORS.eagleEye
  context.lineWidth = 1.5
  context.beginPath()
  context.arc(center.x, center.y, 8, 0, Math.PI * 2)
  context.stroke()
  context.beginPath()
  context.moveTo(center.x - 11, center.y)
  context.lineTo(center.x + 11, center.y)
  context.moveTo(center.x, center.y - 11)
  context.lineTo(center.x, center.y + 11)
  context.stroke()
}

/** ball.pzx 합성 프레임 — 원점이 공 가운데라 투영 좌표에 원점대로 놓는다 */
const BALL_FRAMES = './sprites/ball/frames'

function drawBall(context: CanvasRenderingContext2D, pitch: Pitch, frame: number): void {
  const position = ballPixelAt(pitch, frame)
  const ballFrame = ballFrameIndexAt(pitch, frame)
  const placed = placedFrame(BALL_FRAMES, ballFrame)

  if (placed === null) {
    context.fillStyle = UI_COLORS.ball
    context.beginPath()
    context.arc(position.x, position.y, 1 + ballFrame / 2, 0, Math.PI * 2)
    context.fill()
    return
  }
  context.drawImage(placed.image, Math.round(position.x) + placed.offsetX, Math.round(position.y) + placed.offsetY)
}

/** 판정 글자 — game_judge 애니를 (117,224) 원점에 재생한다 (0x39504 → 0x393b4). 해당 애니가 없는 문구는 글자로 쓴다 */
function drawResultText(context: CanvasRenderingContext2D, text: string, resultTick: number): void {
  const { x: centerX, y: centerY } = STAGE_LAYOUT.judgeCenter
  const animation = judgeAnimationOf(text)
  if (animation !== null) {
    const entries = frameAnimations(JUDGE_FRAMES)?.[animation]
    const frameIndex = entries === undefined ? null : judgeFrameAt(entries, resultTick)
    const frame = frameIndex === null ? null : placedFrame(JUDGE_FRAMES, frameIndex)
    if (frame !== null) context.drawImage(frame.image, centerX + frame.offsetX, centerY + frame.offsetY)
    return
  }

  context.font = 'bold 20px Galmuri11, "Apple SD Gothic Neo", sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.lineWidth = 4
  context.strokeStyle = UI_COLORS.resultOutline
  context.strokeText(text, centerX, centerY)
  context.fillStyle = UI_COLORS.resultText
  context.fillText(text, centerX, centerY)
}
