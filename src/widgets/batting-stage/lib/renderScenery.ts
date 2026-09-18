import { FENCE_BOXES } from '@/shared/config/original/stadiumScene'
import {
  CLOUD_FRAMES, CROWD_FRAMES, FENCE_FRAMES, FIELD_BACKGROUND, SCOREBOARD_FRAMES, TEAM_ICON, placedFrame, sprite,
} from '@/widgets/batting-stage/lib/spriteLoader'
import { CLOUD_WRAP_WIDTH, cloudScrollAt, isCloudVisible, skyColorsOf, teamIconOf } from '@/widgets/batting-stage/lib/stageScenery'
import { STAGE_HEIGHT, STAGE_LAYOUT, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'

/**
 * 타석 배경 (0x78578): 하늘 0x77fe8 → 펜스 0x77974(팀 아이콘·관중·전광판) → 바닥 0x7725c.
 * 좌표는 카메라 오프셋 (−120, −70) 을 뺀 화면 좌표다. 웹 화면은 좌타(side 1) 배치다.
 */
export interface SceneryState {
  /** 하늘 표 행 (0~5) */
  readonly skyRow: number
  readonly inning: number
  /** 타석 화면이 열린 뒤 흐른 틱 — 구름 이동 */
  readonly tick: number
  /** 구장 번호 — 고르는 규칙(st+0x70)이 미확인이라 0 (추정) */
  readonly stadium: number
  readonly ourTeamId: number | null
  readonly opponentTeamId: number | null
}

const CAMERA = { x: -120, y: -70 }
const SKY_GRADIENT = { top: 10, bottom: 118, end: 178 }
const CLOUD_COUNT = 3
/** 좌타 펜스 기준점 (−121 − 10, −70 + 3) */
const FENCE_ANCHOR = { x: CAMERA.x - 1 - 10, y: CAMERA.y + 3 }
const MISSION_TEAM_ICON = 11
const SCOREBOARD_BOX = 2

export function drawScenery(context: CanvasRenderingContext2D, state: SceneryState): void {
  context.fillStyle = '#000000'
  context.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  const colorIndex = drawSky(context, state)
  if (isCloudVisible(colorIndex)) drawClouds(context, state.tick)
  drawFence(context, state)
  drawField(context)
}

function drawSky(context: CanvasRenderingContext2D, state: SceneryState): number {
  const { top, bottom, colorIndex } = skyColorsOf(state.skyRow, state.inning)
  context.fillStyle = top
  context.fillRect(0, 0, STAGE_WIDTH, SKY_GRADIENT.top)
  const gradient = context.createLinearGradient(0, SKY_GRADIENT.top, 0, SKY_GRADIENT.bottom)
  gradient.addColorStop(0, top)
  gradient.addColorStop(1, bottom)
  context.fillStyle = gradient
  context.fillRect(0, SKY_GRADIENT.top, STAGE_WIDTH, SKY_GRADIENT.bottom - SKY_GRADIENT.top)
  context.fillStyle = bottom
  context.fillRect(0, SKY_GRADIENT.bottom, STAGE_WIDTH, SKY_GRADIENT.end - SKY_GRADIENT.bottom)
  return colorIndex
}

function drawClouds(context: CanvasRenderingContext2D, tick: number): void {
  for (let index = 0; index < CLOUD_COUNT; index += 1) {
    const frame = placedFrame(CLOUD_FRAMES, index)
    if (frame === null) continue
    const x = CAMERA.x + cloudScrollAt(index, tick) + frame.offsetX
    const y = CAMERA.y + frame.offsetY
    context.drawImage(frame.image, x, y)
    context.drawImage(frame.image, x + CLOUD_WRAP_WIDTH, y)
  }
}

function drawFence(context: CanvasRenderingContext2D, state: SceneryState): void {
  const fence = placedFrame(FENCE_FRAMES, state.stadium)
  if (fence !== null) context.drawImage(fence.image, FENCE_ANCHOR.x + fence.offsetX, FENCE_ANCHOR.y + fence.offsetY)

  const boxes = FENCE_BOXES[state.stadium] ?? []
  // 박스 0·1 = st+0x84 / +0x80 팀 아이콘 — 어느 쪽이 우리 팀인지는 추정
  const icons = [state.ourTeamId, state.opponentTeamId].map((teamId) =>
    teamId === null ? MISSION_TEAM_ICON : teamIconOf(teamId),
  )
  icons.forEach((icon, index) => {
    const box = boxes[index]
    const image = sprite(TEAM_ICON(icon))
    if (box === undefined || image === null) return
    context.drawImage(image, FENCE_ANCHOR.x + box[0], FENCE_ANCHOR.y + box[1])
  })

  const crowd = placedFrame(CROWD_FRAMES, state.stadium)
  if (crowd !== null) context.drawImage(crowd.image, FENCE_ANCHOR.x + crowd.offsetX, FENCE_ANCHOR.y + crowd.offsetY)

  // 전광판 (board_ani) — 박스 2 로 잘라 그린다. 흐르는 애니메이션은 미해독이라 첫 프레임을 세운다 (추정)
  const box = boxes[SCOREBOARD_BOX]
  const board = placedFrame(SCOREBOARD_FRAMES, 0)
  if (box === undefined || board === null) return
  const left = FENCE_ANCHOR.x + box[0]
  const top = FENCE_ANCHOR.y + box[1]
  context.save()
  context.beginPath()
  context.rect(left, top, box[2], box[3])
  context.clip()
  context.drawImage(board.image, left + board.offsetX, top + board.offsetY)
  context.restore()
}

function drawField(context: CanvasRenderingContext2D): void {
  const field = sprite(FIELD_BACKGROUND)
  if (field === null) return
  context.drawImage(
    field,
    STAGE_LAYOUT.fieldSourceX, 0, STAGE_WIDTH, field.height,
    0, STAGE_LAYOUT.fieldTopY, STAGE_WIDTH, field.height,
  )
}
