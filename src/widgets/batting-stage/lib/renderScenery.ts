import { FENCE_BOXES } from '@/shared/config/original/stadiumScene'
import {
  CLOUD_FRAMES, CROWD_FRAMES, FENCE_FRAMES, FIELD_BACKGROUND, SCOREBOARD_FRAMES, TEAM_ICON, placedFrame, sprite,
} from '@/widgets/batting-stage/lib/spriteLoader'
import { CLOUD_WRAP_WIDTH, cloudScrollAt, isCloudVisible, skyColorsOf, teamIconOf } from '@/widgets/batting-stage/lib/stageScenery'
import { BATTER_SIDE, STAGE_HEIGHT, STAGE_LAYOUT, STAGE_SIDE, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/**
 * 타석 배경 (0x78578): 하늘 0x77fe8 → 펜스 0x77974(팀 아이콘·관중·전광판) → 바닥 0x7725c.
 * 좌표는 카메라 오프셋 (−120, −70) 을 뺀 화면 좌표다. 적혀 있는 수치는 좌타(side 1) 기준이다.
 *
 * 구장 객체 +0x60 은 **현재 타자의 손**을 받아, 우타(0)면 구장 그리기 0x77494 가 효과 0x11 로
 * **펜스·관중·전광판을 통째로 뒤집는다** (R6 4절). 하늘·구름과 바닥(0x7725c)은 뒤집지 않는다.
 */
export interface SceneryState {
  /** 하늘 표 행 (0~5) */
  readonly skyRow: number
  readonly inning: number
  /** 타석 화면이 열린 뒤 흐른 틱 — 구름·전광판 이동 */
  readonly tick: number
  /** 구장 번호 — 고르는 규칙(st+0x70)이 미확인이라 0 (추정) */
  readonly stadium: number
  readonly ourTeamId: number | null
  readonly opponentTeamId: number | null
  /** 타자 손 (0 우타 · 1 좌타). 우타면 펜스 묶음이 좌우로 뒤집힌다. 없으면 좌타 배치다 */
  readonly side?: number
  /**
   * 환경설정 전광판(+0x3a) — OFF 면 전광판을 그리지 않는다 (0x77726, R2-game-effects.md 6절).
   * 생략하면(웹판이 아직 안 이어 준 자리) 켠 것으로 본다 — 이 필드는 아직 부르는 쪽이 배선하지 않았다.
   */
  readonly isScoreboardOn?: boolean
}

const CAMERA = { x: -120, y: -70 }
const SKY_GRADIENT = { top: 10, bottom: 118, end: 178 }
const CLOUD_COUNT = 3
/** 좌타 펜스 기준점 (−121 − 10, −70 + 3) */
const FENCE_ANCHOR = { x: CAMERA.x - 1 - 10, y: CAMERA.y + 3 }
const MISSION_TEAM_ICON = 11
/**
 * FENCE_BOXES 의 세 번째 칸(전광판용으로 뽑아 둔 칸, generate_stadium_scene.py 주석 "2 전광판")을 쓴다.
 * 원본 0x77494 는 상자 0(종류 +0x8a == 3 이면 2)을 쓰지만, 그 "박스"는 fence.pzf 가 아니라
 * fence_board.pzx 자체 프레임의 박스로 보인다(팀 아이콘이 이미 FENCE_BOXES 박스 0·1 을 쓰고 있어
 * 겹칠 수 없다) — fence_board.pzx 박스 데이터를 아직 추출하지 못해 종류 분기는 못 옮긴다 (R2-game-effects.md 6절, **근사**).
 */
const SCOREBOARD_BOX = 2
/** 전광판 글자 시작 x — 상자 폭 + 2 (되감기 값과 같다, 0x77edc) */
const SCOREBOARD_SCROLL_START_MARGIN = 2
/** 프레임 폭(143) + 10 만큼 완전히 빠지면 되감는다 (0x77fb4) */
const SCOREBOARD_REWIND_THRESHOLD = -153

/** 전광판 x 이동(구장+0x8c) — 틱당 1px 씩 왼쪽으로 흘러 −153 밑으로 빠지면 시작값으로 되감는다 (0x77fb4) */
export function scoreboardScrollX(boxWidth: number, tick: number): number {
  const start = boxWidth + SCOREBOARD_SCROLL_START_MARGIN
  const cycleLength = start - SCOREBOARD_REWIND_THRESHOLD + 1
  return start - (Math.max(0, tick) % cycleLength)
}

export function drawScenery(context: CanvasRenderingContext2D, state: SceneryState): void {
  context.fillStyle = ORIGINAL_COLORS.black
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
  // 우타면 펜스 묶음 전체를 화면 가운데 축으로 뒤집는다.
  // 원본은 뒤집은 그림을 월드 x+490/x+480 에 놓는데(0x77494) 그 1px 어긋남까지는 못 옮겼다 — **근사**.
  const isMirrored = (state.side ?? STAGE_SIDE) === BATTER_SIDE.우타
  context.save()
  if (isMirrored) {
    context.translate(STAGE_WIDTH, 0)
    context.scale(-1, 1)
  }
  drawFenceParts(context, state)
  context.restore()
}

function drawFenceParts(context: CanvasRenderingContext2D, state: SceneryState): void {
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

  // 전광판 (board_ani) — 환경설정 +0x3a OFF 면 그리지 않는다 (R2-game-effects.md 6절)
  if (state.isScoreboardOn === false) return
  const box = boxes[SCOREBOARD_BOX]
  const board = placedFrame(SCOREBOARD_FRAMES, 0)
  if (box === undefined || board === null) return
  const left = FENCE_ANCHOR.x + box[0]
  const top = FENCE_ANCHOR.y + box[1]
  context.save()
  context.beginPath()
  // 원본은 상자를 x+1, w−1 로 살짝 좁혀서 자른다 (0xbaf6d)
  context.rect(left + 1, top, box[2] - 1, box[3])
  context.clip()
  // 글자는 상자 왼쪽 끝 + 이동값(구장+0x8c) 에 그린다 — 틱마다 1px 씩 흘러간다 (0x77fb4)
  context.drawImage(board.image, left + scoreboardScrollX(box[2], state.tick), top + board.offsetY)
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
