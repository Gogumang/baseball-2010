import { ORIGINAL_COLORS } from '@/shared/config/design'
import { cloudPaletteRowOf, isCloudVisible } from '@/widgets/batting-stage/lib/stageScenery'
import { BATTER_SIDE, STAGE_HEIGHT, STAGE_SIDE, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'
import { FLAT_SKY_STADIUM } from '@/widgets/batting-stage/lib/renderScenery/sceneryLayout'
import { drawClouds, drawSky, drawSkyLight } from '@/widgets/batting-stage/lib/renderScenery/sky'
import { drawFence } from '@/widgets/batting-stage/lib/renderScenery/fence'
import { drawField } from '@/widgets/batting-stage/lib/renderScenery/field'
import type { SceneryState } from '@/widgets/batting-stage/lib/renderScenery/sceneryState'

export type { SceneryState, SeasonStadium } from '@/widgets/batting-stage/lib/renderScenery/sceneryState'
export {
  scoreboardScrollX,
  seasonBoardFrameOf,
  seasonFenceFramesOf,
  seasonScoreboardBoxOf,
  seasonScoreboardRewindXOf,
  seasonTeamIconBoxesOf,
  stepSeasonScoreboardX,
} from '@/widgets/batting-stage/lib/renderScenery/seasonBoard'
export { RIGHT_HANDED_CROWD_SHIFT, RIGHT_HANDED_MIRROR_X, rightHandedBoxShiftOf } from '@/widgets/batting-stage/lib/renderScenery/sceneryLayout'
export {
  STADIUM_PREVIEW_ICON_TEAM,
  STADIUM_PREVIEW_MIRRORED,
  drawStadiumPreview,
  type StadiumPreviewState,
} from '@/widgets/batting-stage/lib/renderScenery/stadiumPreview'
export {
  MATCH_INFO_STADIUM_MIRRORED,
  drawMatchInfoStadium,
  type MatchInfoStadiumState,
} from '@/widgets/batting-stage/lib/renderScenery/matchInfoStadium'

/**
 * 타석 배경. 원본은 **배경 묶음이 둘**이고 `0x40ff0` 이 고른다 (**확정**, 값 다시 뜸):
 *
 * | 조건 (0x40ff0) | 묶음 | 구장 그리기 |
 * |---|---|---|
 * | 모드 2(시즌)이고 내 팀 == 홈팀 · 모드 8·9(대전) | 0x41038 (직접 나열) | **0x77494** — 시즌 구장 |
 * | 그 밖 (일반·나리·미션·홈런더비, 시즌 원정) | 0x78578 | **0x77974** — 일반 구장 |
 *
 * 둘 다 하늘 0x77fe8 → 구장 → 바닥 0x7725c → **하늘 조명 0x78490** 차례다 (0x78578 · 0x41038~0x4106a).
 * 좌표는 카메라 오프셋 (−120, −70) 을 뺀 화면 좌표다. 적혀 있는 수치는 좌타(side 1) 기준이다.
 *
 * - **0x77974**(일반): 구장 번호 `st+0x70` 하나로 `fence.pzf` 프레임을 고르고, 팀 아이콘·전광판
 *   상자를 **그 펜스 프레임**에서 읽는다(전광판은 박스 **2** 고정, 0x77d06). 관중 `ppl` 을 그린다.
 * - **0x77494**(시즌): 관중석 `+0x88`·관중 단계 `+0x89`·전광판 `+0x8a` 로 `fence_season.pzf`
 *   (또는 `hidden_fence_*`)와 `fence_board.pzx`(또는 `hidden_board_*`)를 고르고, 팀 아이콘·전광판
 *   상자를 **전광판 그림**에서 읽는다. 관중 `ppl` 은 셋째 인자가 늘 0 이라 안 그린다.
 *
 * 구장 객체 +0x60 은 **현재 타자의 손**을 받아, 우타(0)면 펜스 · 관중석 · 전광판 그림과 바닥(0x7725c)을 효과 0x11 로
 * 뒤집는다 — 팀 아이콘 · 관중 ppl · 전광판 글자는 안 뒤집고 옮기기만 한다 (`RIGHT_HANDED_MIRROR_X` 주석). 하늘·구름은 그대로다.
 */
export function drawScenery(context: CanvasRenderingContext2D, state: SceneryState): void {
  context.fillStyle = ORIGINAL_COLORS.black
  context.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  const { dx, dy } = state.cameraShift ?? { dx: 0, dy: 0 }
  const colorIndex = drawSky(context, state, dy)
  if (showsClouds(state, colorIndex)) {
    withShift(context, dx, dy, () => drawClouds(context, state.cloudCalls ?? 0, cloudPaletteRowOf(colorIndex)))
  }
  const offsetY = state.offsetY ?? 0
  withShift(context, dx, 0, () => drawFence(context, state, offsetY + dy))
  drawField(context, grassPaletteOf(state), offsetY + dy, (state.side ?? STAGE_SIDE) === BATTER_SIDE.우타, dx)
  if (offsetY === 0) drawSkyLight(context, state, colorIndex)
}

/** 구장 8 은 하늘 0x77fe8 이 단색만 칠하고 구름 갈래까지 가지 않는다(78088 → 783a8) */
function showsClouds(state: SceneryState, colorIndex: number): boolean {
  return state.stadium !== FLAT_SKY_STADIUM && isCloudVisible(colorIndex)
}

/** 바닥 팔레트 줄 — 시즌 구장 잔디가 먼저, 그다음 구장 +0xc, 없으면 기본색(null) */
function grassPaletteOf(state: SceneryState): number | null {
  return state.seasonStadium?.grassPalette ?? state.fieldPalette ?? null
}

/** 0x13 카메라가 옮긴 만큼 캔버스를 옮겨 그린다 — 옮김이 없으면 그대로 */
function withShift(context: CanvasRenderingContext2D, dx: number, dy: number, draw: () => void): void {
  if (dx === 0 && dy === 0) {
    draw()
    return
  }
  context.save()
  context.translate(dx, dy)
  draw()
  context.restore()
}
