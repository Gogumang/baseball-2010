import { BOARD_BOXES, FENCE_BOXES } from '@/shared/config/original/stadiumScene'
import {
  CLOUD_FRAMES, CROWD_FRAMES, FENCE_BOARD_FRAMES, FENCE_FRAMES, FENCE_SEASON_FRAMES, FIELD_BACKGROUND,
  HIDDEN_BOARD_FRAMES, HIDDEN_FENCE_FRAMES, SCOREBOARD_FRAMES, TEAM_ICON, placedFrame, sprite,
} from '@/widgets/batting-stage/lib/spriteLoader'
import type { PlacedFrame } from '@/widgets/batting-stage/lib/spriteLoader'
import { CLOUD_WRAP_WIDTH, cloudScrollAt, isCloudVisible, skyColorsOf, teamIconOf } from '@/widgets/batting-stage/lib/stageScenery'
import { BATTER_SIDE, STAGE_HEIGHT, STAGE_LAYOUT, STAGE_SIDE, STAGE_WIDTH } from '@/widgets/batting-stage/lib/stageLayout'
import { ORIGINAL_COLORS } from '@/shared/config/design'

/**
 * 타석 배경. 원본은 **배경 묶음이 둘**이고 `0x40ff0` 이 고른다 (**확정**, 값 다시 뜸):
 *
 * | 조건 (0x40ff0) | 묶음 | 구장 그리기 |
 * |---|---|---|
 * | 모드 2(시즌)이고 내 팀 == 홈팀 · 모드 8·9(대전) | 0x41038 (직접 나열) | **0x77494** — 시즌 구장 |
 * | 그 밖 (일반·나리·미션·홈런더비, 시즌 원정) | 0x78578 | **0x77974** — 일반 구장 |
 *
 * 둘 다 하늘 0x77fe8 → 구장 → 바닥 0x7725c 차례다.
 * 좌표는 카메라 오프셋 (−120, −70) 을 뺀 화면 좌표다. 적혀 있는 수치는 좌타(side 1) 기준이다.
 *
 * - **0x77974**(일반): 구장 번호 `st+0x70` 하나로 `fence.pzf` 프레임을 고르고, 팀 아이콘·전광판
 *   상자를 **그 펜스 프레임**에서 읽는다(전광판은 박스 **2** 고정, 0x77d06). 관중 `ppl` 을 그린다.
 * - **0x77494**(시즌): 관중석 `+0x88`·관중 단계 `+0x89`·전광판 `+0x8a` 로 `fence_season.pzf`
 *   (또는 `hidden_fence_*`)와 `fence_board.pzx`(또는 `hidden_board_*`)를 고르고, 팀 아이콘·전광판
 *   상자를 **전광판 그림**에서 읽는다. 관중 `ppl` 은 셋째 인자가 늘 0 이라 안 그린다.
 *
 * 구장 객체 +0x60 은 **현재 타자의 손**을 받아, 우타(0)면 두 그리기 모두 효과 0x11 로
 * **펜스·관중·전광판을 통째로 뒤집는다** (R6 4절). 하늘·구름과 바닥(0x7725c)은 뒤집지 않는다.
 */
/**
 * 시즌 구장 그리기에 들어가는 세 값 — 구장 객체 `+0x88`(관중석 칸) · `+0x89`(관중 단계) ·
 * `+0x8a`(전광판 칸). 경기 시작 준비 `0x353ac~0x353e6` 이 시즌 기록에서 옮겨 담는다 (R6 1절, **확정**).
 *
 * ⚠️ **잔디는 여기 없다.** 잔디 칸(`SR[0x1ba]`)은 프레임이 아니라 **팔레트**로 갈아 끼운다
 *    (`0x786c8(구장, 칸 − 1, 1)`, S3 문서). `+0x89` 는 잔디가 아니라 **관중 수 그림 단계**다.
 */
export interface SeasonStadium {
  /**
   * 관중석 칸 0~6 (구장+0x88 ← `SR[0x1b8]` = `record.stadiumEquipped[0]`).
   * 0~3 은 `fence_season.pzf` 의 `칸 × 5` 묶음, 4~6 은 히든이라 `hidden_fence_(칸−4)` 로 파일이 갈린다.
   */
  readonly stand: number
  /**
   * 관중 그림 단계 (구장+0x89). 프레임은 `관중석×5 + 값 + 1` 이고 그림 뜻은
   * **0 빈 좌석 · 1 적음 · 2 보통 · 3 만원** 이다 (R6 1절).
   *
   * 원본이 넣는 값은 장면마다 다르다 — 시즌 홈경기 `0x353ca` 는 **만원 판정 `SR[0x65]`(0/1/2) + 1**,
   * 대전 모드 `0x3543c·0x35496` 은 **3** 고정, 구장관리 미리보기 `0x629a` 등은 **0** 이다.
   * 만원 판정은 `관중 ≥ 수용×80% → 2 · > 35% → 1 · 그 밖 0` (J 4-7).
   */
  readonly crowd: number
  /** 전광판 칸 0~6 (구장+0x8a ← `SR[0x1b9]` = `record.stadiumEquipped[1]`). 4~6 은 `hidden_board_(칸−4)` */
  readonly board: number
}

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
  /**
   * 차 있으면 배경을 **시즌 구장 그리기 0x77494** 로 그린다 (전광판 칸이 여기서 온다).
   *
   * 원본 배경 고르기 `0x40ff0` 은 **모드 2(시즌)이고 내 팀 == 홈팀**이거나 **모드 8·9(대전)** 일 때만
   * 0x77494(하늘+구장+바닥+0x84490) 로 가고, 그 밖에는 0x78578(하늘+0x77974+바닥+0x78490) 로 간다.
   * 그래서 이 칸이 비어 있으면 아래쪽 일반 경기 길(0x77974, fence.pzf 한 벌)로 그린다.
   *
   * ⚠️ 아직 **부르는 쪽이 안 배선했다** — 시즌 경기를 여는 `app/ui/SeasonRoute.tsx` 가
   *    `record.stadiumEquipped` 를 `TeamGameScreen → BattingStage` 로 내려 줘야 한다.
   */
  readonly seasonStadium?: SeasonStadium
}

const CAMERA = { x: -120, y: -70 }
const SKY_GRADIENT = { top: 10, bottom: 118, end: 178 }
const CLOUD_COUNT = 3
/** 좌타 펜스 기준점 (−121 − 10, −70 + 3) */
const FENCE_ANCHOR = { x: CAMERA.x - 1 - 10, y: CAMERA.y + 3 }
const MISSION_TEAM_ICON = 11
/**
 * 일반 경기(0x77974)의 전광판 상자 — **fence.pzf 프레임의 박스 2** 로 **박아 놓았다**
 * (0x77d06 `movs r3, #2` — 종류를 안 본다). 시즌 구장(0x77494) 쪽은 fence 가 아니라
 * **전광판 그림 자신의 박스**를 쓰므로 `SEASON_SCOREBOARD_BOX` 를 따로 둔다.
 */
const SCOREBOARD_BOX = 2
/** 팀 아이콘 상자 (박스 0 = 구장+0x84 · 박스 1 = +0x80). 어느 쪽이 우리 팀인지는 추정 */
const TEAM_ICON_BOXES = [0, 1] as const
/** 히든이 시작되는 칸 — 관중석·전광판 모두 4 부터 `hidden_*` 파일로 갈린다 (0x76cf4 `cmp #3 / bgt`) */
const HIDDEN_FIRST_SLOT = 4
/** 관중석 한 칸이 fence_season.pzf 에서 차지하는 프레임 수 (0x774ca `v × 5`) */
const SEASON_FENCE_STRIDE = 5
/** 전광판 칸 3 만 팀 아이콘 자리를 가진다 — 이때만 전광판 화면이 박스 2 다 (0x77654·0x7776a) */
const SEASON_BOARD_WITH_ICONS = 3
/** 전광판 화면을 아예 건너뛰는 칸 (0x7773e `cmp #0` · 0x77744 `cmp #5`) */
const SEASON_BOARD_BLANK_SLOTS: readonly number[] = [0, 5]
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

/**
 * 시즌 구장 펜스 — 바탕(관중석)과 덧그림(관중) 두 프레임을 고른다 (0x774c6·0x77570, R6 1절).
 *   바탕 = `관중석 × 5` · 덧그림 = `관중석 × 5 + 관중단계 + 1`
 * 칸 ≤ 3 이면 `fence_season.pzf`(4묶음 × 5장), 4~6 이면 `hidden_fence_(칸−4)` 에서 0 부터 다시 센다.
 */
export function seasonFenceFramesOf(stand: number, crowd: number): {
  readonly folder: string
  readonly standFrame: number
  readonly crowdFrame: number
} {
  const isHidden = stand >= HIDDEN_FIRST_SLOT
  const base = isHidden ? 0 : stand * SEASON_FENCE_STRIDE
  return {
    folder: isHidden ? HIDDEN_FENCE_FRAMES(stand - HIDDEN_FIRST_SLOT) : FENCE_SEASON_FRAMES,
    standFrame: base,
    crowdFrame: base + crowd + 1,
  }
}

/** 시즌 전광판 그림 — 칸 ≤ 3 이면 `fence_board` 프레임 `칸`, 4~6 이면 `hidden_board_(칸−4)` 프레임 0 (0x775d0) */
export function seasonBoardFrameOf(board: number): { readonly folder: string; readonly frame: number } {
  const isHidden = board >= HIDDEN_FIRST_SLOT
  return {
    folder: isHidden ? HIDDEN_BOARD_FRAMES(board - HIDDEN_FIRST_SLOT) : FENCE_BOARD_FRAMES,
    frame: isHidden ? 0 : board,
  }
}

/**
 * 시즌 전광판 **화면**이 들어가는 상자. 없으면 null 이라 안 그린다.
 * 칸 0·5 는 원본이 통째로 건너뛰고(0x7773e·0x77744), 칸 3 만 상자 2 다(0x7776a).
 * 실제로 `fence_board` 0 번과 `hidden_board_1` 에는 박스 데이터 자체가 없어 표도 빈 칸이다.
 */
export function seasonScoreboardBoxOf(board: number): readonly number[] | null {
  if (SEASON_BOARD_BLANK_SLOTS.includes(board)) return null
  const boxes = BOARD_BOXES[board] ?? []
  return boxes[board === SEASON_BOARD_WITH_ICONS ? 2 : 0] ?? null
}

/** 시즌 구장에서 팀 아이콘이 붙는 상자 두 개 — **칸 3 일 때만** 있다 (0x77654 `cmp #3 / bne`) */
export function seasonTeamIconBoxesOf(board: number): readonly (readonly number[])[] {
  return board === SEASON_BOARD_WITH_ICONS ? (BOARD_BOXES[board] ?? []) : []
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
  /**
   * ⚠️ **꺼 뒀다.** 우타일 때 펜스 묶음을 통째로 뒤집었더니 관중석 그림(`ppl`)에 박혀 있는
   *    **"GAMEVIL®" 광고 글자가 거울상**으로 나왔다. 원본 그림 파일에서는 그 글자가
   *    똑바로 읽히므로(직접 펼쳐서 확인), 퍼블리셔 로고를 뒤집어 내보냈을 리가 없다.
   *
   *    앵커 표(0xcfb18·0xcfb2c·0xcfb7c)의 두 칸이 폭 480 기준 거울이라
   *    (480−276=204≈203 · 480−184=296≈295 · 480−226−33=221) 원본이 무대를 통째로
   *    뒤집는 것처럼 보이지만, **어느 쪽이 native 인지**가 아직 안 밝혀졌다.
   *    밝혀질 때까지는 배경을 뒤집지 않는다 — 타자 그림 반전과 앵커 표는 그대로 산다.
   */
  const isMirrored = false && (state.side ?? STAGE_SIDE) === BATTER_SIDE.우타
  context.save()
  if (isMirrored) {
    context.translate(STAGE_WIDTH, 0)
    context.scale(-1, 1)
  }
  drawFenceParts(context, state)
  context.restore()
}

function drawFenceParts(context: CanvasRenderingContext2D, state: SceneryState): void {
  if (state.seasonStadium !== undefined) {
    drawSeasonFenceParts(context, state, state.seasonStadium)
    return
  }

  const fence = placedFrame(FENCE_FRAMES, state.stadium)
  drawAtFenceAnchor(context, fence)

  const boxes = FENCE_BOXES[state.stadium] ?? []
  drawTeamIcons(context, state, boxes)

  const crowd = placedFrame(CROWD_FRAMES, state.stadium)
  drawAtFenceAnchor(context, crowd)

  // 전광판 (board_ani) — 환경설정 +0x3a OFF 면 그리지 않는다 (R2-game-effects.md 6절)
  if (state.isScoreboardOn === false) return
  drawScoreboardText(context, boxes[SCOREBOARD_BOX], state.tick)
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
function drawSeasonFenceParts(
  context: CanvasRenderingContext2D,
  state: SceneryState,
  season: SeasonStadium,
): void {
  const fence = seasonFenceFramesOf(season.stand, season.crowd)
  drawAtFenceAnchor(context, placedFrame(fence.folder, fence.standFrame))
  drawAtFenceAnchor(context, placedFrame(fence.folder, fence.crowdFrame))

  const board = seasonBoardFrameOf(season.board)
  drawAtFenceAnchor(context, placedFrame(board.folder, board.frame))

  drawTeamIcons(context, state, seasonTeamIconBoxesOf(season.board))

  if (state.isScoreboardOn === false) return
  drawScoreboardText(context, seasonScoreboardBoxOf(season.board) ?? undefined, state.tick)
}

function drawAtFenceAnchor(context: CanvasRenderingContext2D, frame: PlacedFrame | null): void {
  if (frame === null) return
  context.drawImage(frame.image, FENCE_ANCHOR.x + frame.offsetX, FENCE_ANCHOR.y + frame.offsetY)
}

/** 박스 0·1 = 구장+0x84 / +0x80 팀 아이콘 — 어느 쪽이 우리 팀인지는 추정 */
function drawTeamIcons(
  context: CanvasRenderingContext2D,
  state: SceneryState,
  boxes: readonly (readonly number[])[],
): void {
  const icons = [state.ourTeamId, state.opponentTeamId].map((teamId) =>
    teamId === null ? MISSION_TEAM_ICON : teamIconOf(teamId),
  )
  TEAM_ICON_BOXES.forEach((boxIndex, index) => {
    const box = boxes[boxIndex]
    const image = sprite(TEAM_ICON(icons[index] ?? MISSION_TEAM_ICON))
    if (box === undefined || image === null) return
    context.drawImage(image, FENCE_ANCHOR.x + box[0], FENCE_ANCHOR.y + box[1])
  })
}

/** 전광판 화면 — board_ani 프레임 0 을 상자 안에서 틱당 1px 씩 흘린다 (0x77726~0x777d8) */
function drawScoreboardText(
  context: CanvasRenderingContext2D,
  box: readonly number[] | undefined,
  tick: number,
): void {
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
  context.drawImage(board.image, left + scoreboardScrollX(box[2], tick), top + board.offsetY)
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
