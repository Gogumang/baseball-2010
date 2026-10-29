/** 펜스 기준점에 놓는 그림 — 펜스 · 관중석 그림(우타 거울) · 팀 아이콘 · 전광판 글자(안 뒤집고 잰 박스만큼 옮긴다) */
import { SCOREBOARD_FRAMES, TEAM_ICON, placedFrame, sprite } from '@/widgets/batting-stage/lib/spriteLoader'
import type { PlacedFrame } from '@/widgets/batting-stage/lib/spriteLoader'
import { teamIconOf } from '@/widgets/batting-stage/lib/stageScenery'
import { FENCE_ANCHOR, RIGHT_HANDED_MIRROR_X } from '@/widgets/batting-stage/lib/renderScenery/sceneryLayout'
import type { SceneryState } from '@/widgets/batting-stage/lib/renderScenery/sceneryState'

const MISSION_TEAM_ICON = 11
/** 팀 아이콘 상자 (박스 0 = 구장+0x84 · 박스 1 = +0x80). 어느 쪽이 우리 팀인지는 추정 */
const TEAM_ICON_BOXES = [0, 1] as const

/** 펜스 기준에 그림 하나 — 우타 거울(`RIGHT_HANDED_MIRROR_X`)이면 캔버스를 뒤집어 같은 자리에 그린다. `shiftX` 는 안 뒤집는 옮김 */
export function drawAtFenceAnchor(context: CanvasRenderingContext2D, frame: PlacedFrame | null, isMirrored = false, shiftX = 0): void {
  if (frame === null) return
  if (!isMirrored) {
    context.drawImage(frame.image, FENCE_ANCHOR.x + shiftX + frame.offsetX, FENCE_ANCHOR.y + frame.offsetY)
    return
  }
  context.save()
  context.translate(RIGHT_HANDED_MIRROR_X, 0)
  context.scale(-1, 1)
  context.drawImage(frame.image, FENCE_ANCHOR.x + frame.offsetX, FENCE_ANCHOR.y + frame.offsetY)
  context.restore()
}

/** 박스 0·1 = 구장+0x84 / +0x80 팀 아이콘 — 어느 쪽이 우리 팀인지는 추정 */
export function drawTeamIcons(context: CanvasRenderingContext2D, state: SceneryState, boxes: readonly (readonly number[])[], shiftX = 0): void {
  // 0x77974 77ad6~77af0 · 77b4a~77b64 — 14 → 10, 10 이상 → 11 을 고른 뒤 **전역 모드 5 · 6(미션)이면 늘 11** 로 덮는다
  const isMissionMode = state.gameMode === 5 || state.gameMode === 6
  const icons = [state.ourTeamId, state.opponentTeamId].map((teamId) => (teamId === null || isMissionMode ? MISSION_TEAM_ICON : teamIconOf(teamId)))
  TEAM_ICON_BOXES.forEach((boxIndex, index) => {
    const box = boxes[boxIndex]
    const image = sprite(TEAM_ICON(icons[index] ?? MISSION_TEAM_ICON))
    if (box === undefined || image === null) return
    context.drawImage(image, FENCE_ANCHOR.x + shiftX + box[0], FENCE_ANCHOR.y + box[1])
  })
}

/** 전광판 화면 — board_ani 프레임 0 을 상자 안에서 틱당 1px 씩 흘린다 (0x77726~0x777d8) */
export function drawScoreboardText(context: CanvasRenderingContext2D, box: readonly number[], scrollX: number, shiftX = 0): void {
  const board = placedFrame(SCOREBOARD_FRAMES, 0)
  if (board === null) return
  const left = FENCE_ANCHOR.x + shiftX + box[0]
  const top = FENCE_ANCHOR.y + box[1]
  context.save()
  context.beginPath()
  // 원본은 상자를 x+1, w−1 로 살짝 좁혀서 자른다 (0xbaf6d)
  context.rect(left + 1, top, box[2] - 1, box[3])
  context.clip()
  // 글자는 상자 왼쪽 끝 + 이동값(구장+0x8c) 에 그린다 — 틱마다 1px 씩 흘러간다 (0x77fb4)
  context.drawImage(board.image, left + scrollX, top + board.offsetY)
  context.restore()
}
