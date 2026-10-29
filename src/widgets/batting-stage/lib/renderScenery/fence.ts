/** 일반 구장 0x77974 · 시즌 구장 0x77494 — 펜스 · 관중석 · 관중 · 전광판 그림 · 팀 아이콘 · 전광판 글자 */
import { FENCE_BOXES } from '@/shared/config/original/stadiumScene'
import { CROWD_FRAMES, FENCE_FRAMES, placedFrame } from '@/widgets/batting-stage/lib/spriteLoader'
import type { PlacedFrame } from '@/widgets/batting-stage/lib/spriteLoader'
import { BATTER_SIDE, STAGE_SIDE } from '@/widgets/batting-stage/lib/stageLayout'
import { RIGHT_HANDED_CROWD_SHIFT, rightHandedBoxShiftOf } from '@/widgets/batting-stage/lib/renderScenery/sceneryLayout'
import {
  scoreboardScrollX,
  seasonBoardFrameOf,
  seasonFenceFramesOf,
  seasonScoreboardBoxOf,
  seasonTeamIconBoxesOf,
} from '@/widgets/batting-stage/lib/renderScenery/seasonBoard'
import { drawAtFenceAnchor, drawScoreboardText, drawTeamIcons } from '@/widgets/batting-stage/lib/renderScenery/fenceBoxes'
import type { SceneryState, SeasonStadium } from '@/widgets/batting-stage/lib/renderScenery/sceneryState'

/**
 * 일반 경기(0x77974)의 전광판 상자 — **fence.pzf 프레임의 박스 2** 로 **박아 놓았다**
 * (0x77d06 `movs r3, #2` — 종류를 안 본다). 시즌 구장(0x77494) 쪽은 fence 가 아니라
 * **전광판 그림 자신의 박스**를 쓰므로 `SEASON_SCOREBOARD_BOX` 를 따로 둔다.
 */
const SCOREBOARD_BOX = 2

export function drawFence(context: CanvasRenderingContext2D, state: SceneryState, offsetY: number): void {
  const isMirrored = (state.side ?? STAGE_SIDE) === BATTER_SIDE.우타
  context.save()
  // 0x77974 의 기준 y = 구장+8 + 밀기 + 3 — 펜스·팀 아이콘·관중·전광판이 모두 이 기준에서 그려진다
  context.translate(0, offsetY)
  drawFenceParts(context, state, isMirrored)
  context.restore()
}

/*
 * **둘째 관중 묶음 [구장+0x78]** — 0x77974 의 77c24~77cda (2026-10-14 직접 떴다). 첫 묶음 +0x74(`stadium/ppl.pzx`)와 똑같이 그린다:
 * ```
 * 77c24  설정 +0x3a(전광판) == 0 이면 건너뜀 · 77c38 [구장+0x78] == 0 이면 건너뜀
 * 77c40  프레임 (s8)구장+0x70 의 파트마다: x = 기준(sp+0x40) + dx (+0x60 == 0 이면 + 0x78) · y = 기준(sp+0x44) + dy · 효과 0 · 그림 vt+0x14
 * ```
 * 그런데 +0x78 은 jar 안의 그림이 아니다. 적재 0x76ba4 의 76ddc~76e98:
 * ```
 * 76ddc  옛 +0x78 이 있으면 풀고 0
 * 76df8  설정 +0x3a == 0 이면 안 싣는다
 * 76e04  0x69fd1(…, "ppl.pzx" 0xd3904) — 단말 저장소에 그 파일이 있는가 (경로에 "stadium/" 가 없다)
 * 76e10  오늘 = 0xbaaf9 의 연 · 월 · 일 → 연×10000 + 월×100 + 일 + 19000100
 *        만료 = 저장 +0x149 · +0x14a · +0x14b → 연×10000 + 월×100 + 일 + 20000000
 * 76e76  만료 ≥ 오늘이면 0xb9719("ppl.pzx", 0, …) 로 실어 +0x78 · 아니면 76e9e 0x6a101 로 파일을 지운다
 * ```
 * 그 파일과 만료일은 네트워크 받기 0x7262c 가 쓴다(72b9c 0x69fe1 쓰기 · 72c50~ 저장 +0x149~+0x14b — `d_level.dat` 과 같은 받기).
 * 곧 **내려받은 광고 관중 그림**이라 원본 jar(`base/work/jar` 에는 `stadium/ppl.pzx` 만 있다)만으로는 안 그려진다. 웹은 받기가 없어
 * 그리지 않는다 — 원본의 "받은 적 없는 단말" 과 같다. 시즌 구장 0x77494 는 관중 ppl 을 아예 안 그린다(셋째 인자 0).
 */

/** 박스 기준을 옮길 값 — 좌타 0, 우타면 그 그림으로 잰 값(그림이 아직 없으면 null: 놓을 자리를 못 잰다) */
function boxShiftOf(frame: PlacedFrame | null, isMirrored: boolean): number | null {
  if (!isMirrored) return 0
  return frame === null ? null : rightHandedBoxShiftOf({ offsetX: frame.offsetX, width: frame.image.width })
}

export function drawFenceParts(context: CanvasRenderingContext2D, state: SceneryState, isMirrored: boolean): void {
  if (state.seasonStadium !== undefined) {
    drawSeasonFenceParts(context, state, state.seasonStadium, isMirrored)
    return
  }
  drawPlainFenceParts(context, state, isMirrored)
}

/** 일반 구장 0x77974 — 펜스 프레임 · 팀 아이콘 · 관중 ppl · 전광판 글자(펜스 박스 2) */
function drawPlainFenceParts(context: CanvasRenderingContext2D, state: SceneryState, isMirrored: boolean): void {
  const fence = placedFrame(FENCE_FRAMES, state.stadium)
  drawAtFenceAnchor(context, fence, isMirrored)
  const shift = boxShiftOf(fence, isMirrored)

  const boxes = FENCE_BOXES[state.stadium] ?? []
  if (shift !== null) drawTeamIcons(context, state, boxes, shift)

  // 관중 ppl — 우타도 안 뒤집고 옆으로만 옮긴다 (77bea~77c16)
  const crowd = placedFrame(CROWD_FRAMES, state.stadium)
  drawAtFenceAnchor(context, crowd, false, isMirrored ? RIGHT_HANDED_CROWD_SHIFT : 0)
  // 둘째 관중 묶음 [구장+0x78] (77c24~77cda) — 내려받는 광고 그림이라 웹은 안 그린다 (위 "둘째 관중 묶음" 주석)

  // 전광판 (board_ani) — 환경설정 +0x3a OFF 면 그리지 않는다 (R2-game-effects.md 6절)
  if (state.isScoreboardOn === false) return
  const box = boxes[SCOREBOARD_BOX]
  if (shift !== null && box !== undefined) drawScoreboardText(context, box, scoreboardScrollX(box[2], state.scoreboardTick ?? state.tick), shift)
}

/**
 * 시즌 구장 배경 0x77494 — 그리는 **차례까지** 원본 그대로다.
 *   1. 관중석 프레임 `칸 × 5`               (0x774c6~0x7755e)
 *   2. 관중 덧그림 `관중석 × 5 + 관중단계 + 1` (0x77570~0x775cc)
 *   3. 전광판 그림 — 칸 0·5 도 **그림은 그린다** (0x775d0~0x77650)
 *   4. 칸 3 일 때만 팀 아이콘 (전광판 그림의 박스 0·1)  (0x77654~0x77722)
 *   5. 전광판 흐르는 글자 (박스 0, 칸 3 이면 2)         (0x77726~0x777d8)
 *   6. 관중(ppl) — **원본은 안 그린다**: 부르는 세 곳(0x41042·0xb178·0xb23c)이 모두
 *      셋째 인자를 0 으로 넘겨 0x777de 에서 곧바로 빠진다. 원본 그대로 여기서도 뺀다.
 */
export function drawSeasonFenceParts(context: CanvasRenderingContext2D, state: SceneryState, season: SeasonStadium, isMirrored: boolean): void {
  const fence = seasonFenceFramesOf(season.stand, season.crowd)
  drawAtFenceAnchor(context, placedFrame(fence.folder, fence.standFrame), isMirrored)
  drawAtFenceAnchor(context, placedFrame(fence.folder, fence.crowdFrame), isMirrored)

  const board = seasonBoardFrameOf(season.board)
  const boardFrame = placedFrame(board.folder, board.frame)
  drawAtFenceAnchor(context, boardFrame, isMirrored)
  // 아이콘 · 글자 상자는 전광판 그림을 효과 0x11 로 잰 박스(sp+0x58)로 옮긴다 (0x7764c · 0x7778a)
  const shift = boxShiftOf(boardFrame, isMirrored)
  if (shift === null) return

  drawTeamIcons(context, state, seasonTeamIconBoxesOf(season.board), shift)

  if (state.isScoreboardOn === false) return
  const box = seasonScoreboardBoxOf(season.board)
  if (box === null) return
  drawScoreboardText(context, box, state.scoreboardX ?? scoreboardScrollX(box[2], state.scoreboardTick ?? state.tick), shift)
}
