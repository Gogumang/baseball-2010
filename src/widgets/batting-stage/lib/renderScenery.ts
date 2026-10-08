import { BOARD_BOXES, FENCE_BOXES } from '@/shared/config/original/stadiumScene'
import {
  CLOUD_FRAMES, CROWD_FRAMES, FENCE_BOARD_FRAMES, FENCE_FRAMES, FENCE_SEASON_FRAMES,
  HIDDEN_BOARD_FRAMES, HIDDEN_FENCE_FRAMES, SCOREBOARD_FRAMES, SKY_LIGHT_FRAMES, TEAM_ICON, fieldBackground,
  frameAnimations, placedFrame, sprite,
} from '@/widgets/batting-stage/lib/spriteLoader'
import type { PlacedFrame } from '@/widgets/batting-stage/lib/spriteLoader'
import {
  CLOUD_WRAP_WIDTH, SKY_LIGHT_LAST_COLOR_INDEX, cloudPaletteRowOf, isSkyLightModeShown, cloudScrollAt, isCloudVisible, skyColorsOf,
  skyLightFrameAt, skyLightPaletteRowOf, teamIconOf,
} from '@/widgets/batting-stage/lib/stageScenery'
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
 * 둘 다 하늘 0x77fe8 → 구장 → 바닥 0x7725c → **하늘 조명 0x78490** 차례다 (0x78578 · 0x41038~0x4106a).
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
 * ⚠️ **잔디는 그 세 칸에 없다.** 잔디 칸(`SR[0x1ba]`)은 프레임이 아니라 바닥 그림
 *    (`구장+0x2c` = `stadium/attack`, 그리는 곳 `0x7725c`)의 **팔레트**를 갈아 끼운다
 *    (`0x786c8(구장, 칸 − 1, 1)` → `.mpl` 줄 `2 − 칸`, S3 문서 · `grassPaletteRowOf`).
 *    같은 경기 준비 묶음이 같은 조건(시즌 홈경기)에서 걸므로 `grassPalette` 로 같이 받는다.
 *    `+0x89` 는 잔디가 아니라 **관중 수 그림 단계**다.
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
  /**
   * 바닥 그림 `stadium/attack` 의 `.mpl` 줄 = `2 − 잔디 칸` (`0x786c8`). **null 이면 기본 팔레트**다.
   *
   * 칸 0 거친인조잔디 → 줄 2(누런 올리브) · 1 인조잔디 → 줄 1(청록) ·
   * 2 천연잔디 → 줄 0(짙은 녹색) · 3 특급천연잔디 → null(PZX 기본, 밝은 녹색).
   * 구장 객체 생성자 `0x76ace` 가 `[구장+0xc] = −1` 이라 **시즌 홈경기가 아니면 기본색**이다.
   */
  readonly grassPalette: number | null
}

export interface SceneryState {
  /** 하늘 표 행 (0~5) */
  readonly skyRow: number
  /** 하늘 칸 — 구장 +0x14 = min(경기 상태 +0x6b, 12), 0부터 (`skyColumnOfInning`) */
  readonly skyColumn: number
  /** 타석 화면이 열린 뒤 흐른 틱 — 구름·전광판 이동 */
  readonly tick: number
  /** 구장 번호 — 고르는 규칙(st+0x70)이 미확인이라 0 (추정) */
  readonly stadium: number
  readonly ourTeamId: number | null
  readonly opponentTeamId: number | null
  /** 타자 손 (0 우타 · 1 좌타). 우타면 펜스 묶음이 좌우로 뒤집힌다. 없으면 좌타 배치다 */
  readonly side?: number
  /**
   * 환경설정 전광판(+0x3a) — OFF 면 전광판 흐르는 글자를 그리지 않는다 (0x77726, R2-game-effects.md 6절).
   * `BattingStage` 의 `isScoreboardOn` 이 그대로 내려온다. 생략하면 켠 것으로 본다.
   */
  readonly isScoreboardOn?: boolean
  /**
   * 차 있으면 배경을 **시즌 구장 그리기 0x77494** 로 그린다 (전광판 칸이 여기서 온다).
   *
   * 원본 배경 고르기 `0x40ff0` 은 **모드 2(시즌)이고 내 팀 == 홈팀**이거나 **모드 8·9(대전)** 일 때만
   * 0x77494(하늘+구장+바닥+0x84490) 로 가고, 그 밖에는 0x78578(하늘+0x77974+바닥+0x78490) 로 간다.
   * 그래서 이 칸이 비어 있으면 아래쪽 일반 경기 길(0x77974, fence.pzf 한 벌)로 그린다.
   *
   * 시즌 경기는 `app/ui/SeasonRoute.tsx` 가 `seasonStadiumOf(record)` 를 `TeamGameScreen → BattingStage` 로 내려 준다
   * (홈경기·대전일 때만 — 0x40ff0 의 갈림).
   */
  readonly seasonStadium?: SeasonStadium
  /**
   * 게임 모드(전역 `0x1552d10`). 하늘 조명 0x78490 이 **모드 5·6(미션)·7(홈런더비)** 에서는 안 그린다
   * (0x784a2~0x784b0). 생략하면 그 셋이 아닌 것으로 본다. `BattingStage` 의 `gameMode` 가 그대로 내려온다.
   */
  readonly gameMode?: number
  /**
   * **세로 밀기** — `0x78578(구장, y, 움직임)` 의 둘째 인자. 구장 `0x77974`(위 = 구장+8 + y + 3)와
   * 바닥 `0x7725c`(위 = 구장+8 + y + 0xe2)에만 더해지고 하늘·구름 `0x77fe8` 은 안 움직인다.
   * 하늘 조명 `0x78490` 은 이 값이 0 이 아니면 안 그린다(784b8 `cmp r1,#0`). 타석에서는 늘 0 이다.
   * 결과 창(상태 0x1a, `0x45c18`)이 장면 +0x17e2 를 넘긴다. 생략하면 0.
   */
  readonly offsetY?: number
}

const CAMERA = { x: -120, y: -70 }
const SKY_GRADIENT = { top: 10, bottom: 118, end: 178 }
const CLOUD_COUNT = 3
/** 하늘을 단색으로 칠하고 조명도 안 그리는 구장 번호 (0x78046 · 0x784c6 `cmp #8`) */
const FLAT_SKY_STADIUM = 8
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
  if (isCloudVisible(colorIndex)) drawClouds(context, state.tick, cloudPaletteRowOf(colorIndex))
  const offsetY = state.offsetY ?? 0
  drawFence(context, state, offsetY)
  drawField(context, state.seasonStadium?.grassPalette ?? null, offsetY)
  if (offsetY === 0) drawSkyLight(context, state, colorIndex)
}

function drawSky(context: CanvasRenderingContext2D, state: SceneryState): number {
  const { top, bottom, colorIndex } = skyColorsOf(state.skyRow, state.skyColumn)
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

/** 구름 (0x782d6~) — 그림은 0x76fd0 이 `.mpl` 줄 `v − 1` 로 실어 둔 것이다 (`cloudPaletteRowOf`) */
function drawClouds(context: CanvasRenderingContext2D, tick: number, paletteRow: number | null): void {
  for (let index = 0; index < CLOUD_COUNT; index += 1) {
    const frame = placedFrame(CLOUD_FRAMES, index, paletteRow)
    if (frame === null) continue
    const x = CAMERA.x + cloudScrollAt(index, tick) + frame.offsetX
    const y = CAMERA.y + frame.offsetY
    context.drawImage(frame.image, x, y)
    context.drawImage(frame.image, x + CLOUD_WRAP_WIDTH, y)
  }
}

function drawFence(context: CanvasRenderingContext2D, state: SceneryState, offsetY: number): void {
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
  // 0x77974 의 기준 y = 구장+8 + 밀기 + 3 — 펜스·팀 아이콘·관중·전광판이 모두 이 기준에서 그려진다
  context.translate(0, offsetY)
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

/**
 * **하늘 조명** `sky_effect_light` (구장+0x38) — 그리기 `0x78490(구장, y, 움직임)`, 바닥 **다음** 맨 위 겹.
 * ```
 * 78494: 구장+0x50(= 장면 상태, 0x3f07c) == 0x19(정산) → 안 그림
 * 784a2: 모드(0x1552d10) ∈ {5, 6, 7} → 안 그림
 * 784b2: +0x38 이 안 실렸거나(v > 7) · y 인자 ≠ 0 · 구장+0x70 == 8 → 안 그림
 * 784d6: v = 표0xd37a4[행][열] > 7 → 안 그림
 * 784ea: (x0, y0) = 프레임0.vt18() ; w = 프레임0[+0x12]
 * 78526: 애니 0 을 (화면폭 − x0 − w, 0) 에 그린다 (0x93c44)
 * 7853c: 움직임 인자면 0x93d90(한 칸) · 0x93cfc(애니, 1)(되풀이)  ; 0x40ff0: 움직임 = 장면 상태 ≠ 0x11
 * ```
 * 프레임 원점이 (163, 0) 폭 77 이라 `240 − 163 − 77 = 0` — **애니 기준점이 화면 (0, 0)** 이고 그림은 오른쪽
 * 위 구석(163~240)에 붙는다. vt18 을 "프레임 0 의 원점" 으로 읽은 것은 유력이다(원점 + 폭이 화면폭과 꼭 맞는다).
 *
 * **근사**: 원본은 투구 비행(상태 0x11) 동안 애니를 멈추지만 이 그리기는 장면 상태를 몰라 타석 틱으로 늘 돌린다.
 * 상태 0x19(정산)·y 인자 ≠ 0 은 타석 화면에서 일어나지 않아 뺐다.
 * ⚠️ 함께 실리는 `sky_effect_light1`(구장+0x3c) 은 **그리는 자리를 못 찾았다** — 구장 클래스(0x76a00~0x79000)와
 * 장면+0xf10 을 거쳐 +0x38/+0x3c 를 읽는 곳을 전수로 훑어도 0x78490 의 +0x38 뿐이다. 그래서 안 그린다.
 */
function drawSkyLight(context: CanvasRenderingContext2D, state: SceneryState, colorIndex: number): void {
  if (!isSkyLightModeShown(state.gameMode)) return
  if (state.stadium === FLAT_SKY_STADIUM) return
  if (colorIndex > SKY_LIGHT_LAST_COLOR_INDEX) return
  const entries = frameAnimations(SKY_LIGHT_FRAMES)?.[0]
  if (entries === undefined) return
  const frameIndex = skyLightFrameAt(entries, state.tick)
  if (frameIndex === null) return
  const paletteRow = skyLightPaletteRowOf(colorIndex)
  const first = placedFrame(SKY_LIGHT_FRAMES, 0, paletteRow)
  const frame = placedFrame(SKY_LIGHT_FRAMES, frameIndex, paletteRow)
  if (first === null || frame === null) return
  const originX = STAGE_WIDTH - first.offsetX - first.image.width
  context.drawImage(frame.image, originX + frame.offsetX, frame.offsetY)
}

/**
 * 바닥(그라운드) — 원본 `0x7725c` 가 구장 객체 `+0x2c` 에 달린 `stadium/attack` 그림을 그린다.
 * `grassPalette` 가 있으면 그 `.mpl` 줄로 칠한 그림을 쓴다 (잔디 = 팔레트, `0x786c8`).
 * 칠하는 동안에는 구운 그림이 나가므로 첫 몇 프레임은 기본색이 보인다.
 */
function drawField(context: CanvasRenderingContext2D, grassPalette: number | null, offsetY: number): void {
  const field = fieldBackground(grassPalette)
  if (field === null) return
  context.drawImage(
    field,
    STAGE_LAYOUT.fieldSourceX, 0, STAGE_WIDTH, field.height,
    0, STAGE_LAYOUT.fieldTopY + offsetY, STAGE_WIDTH, field.height,
  )
}

/**
 * **구장 미리보기** — 시즌 장면 0x105 상태 0xea(구장관리) 그리기 `0xb158` (직접 떴다):
 * ```
 * b15a  구장 = [this+0x10c] ; 구장+4 = −165 · 구장+8 = −80     ; 틀마다 카메라를 다시 놓는다 (진입 0xe4d0 의 (−84, −80) 을 덮는다)
 * b172  0x77fe8(구장, 0)      ; 하늘·구름 — 구름 흐르기 0x78448 · 전광판 흐르기 0x77fb4 는 이 상태에서 안 부른다
 * b17e  0x77494(구장, 0, 0)   ; 시즌 구장 (관중 ppl 없음)
 * b188  0x7725c(구장, 0)      ; 바닥
 * b196  0x83378(창, 틱)       ; 그 위에 아이템 창 — 하늘 조명 0x78490 은 안 그린다
 * ```
 * 그림 함수는 경기 배경(`drawScenery` 의 시즌 구장 길)과 같고 카메라만 (−120, −70) 대신 (−165, −80) 이다. 하늘 0x77fe8 은 구장+4 에서
 * 폭 480 으로 칠하므로 화면을 다 덮는다.
 *
 * ⚠️ 미해결(근사):
 * - 하늘 칸 구장+0x18 은 0x783b0 이 `[0x1552d0c]+0x6b`(마지막 경기 상태의 이닝)를 읽는다 — 웹은 그 값을 안 들어 부르는 쪽이 넘긴다.
 * - 구름 자리(구장 안 구름 칸)와 전광판 글자 자리(+0x8c)는 마지막으로 흐른 값 그대로인데 웹은 처음 값(틱 0)으로 둔다.
 * - 전광판 칸 3 의 팀 아이콘(구장+0x80 · +0x84)은 이 장면에서 누가 채우는지 못 찾아 안 그린다.
 * - 바닥 0x7725c 의 x 는 구장+0x60(타자 손)에 따라 1 줄어드는데 그 값도 못 찾았다 — 경기 배경과 같이 무시한다.
 */
export const STADIUM_PREVIEW_CAMERA = { x: -165, y: -80 } as const

export interface StadiumPreviewState {
  readonly skyRow: number
  readonly skyColumn: number
  readonly seasonStadium: SeasonStadium
  /** 환경설정 전광판(+0x3a) — OFF 면 전광판 글자를 안 그린다 (0x77726). 생략하면 켠 것 */
  readonly isScoreboardOn?: boolean
}

export function drawStadiumPreview(context: CanvasRenderingContext2D, state: StadiumPreviewState): void {
  const dx = STADIUM_PREVIEW_CAMERA.x - CAMERA.x
  const dy = STADIUM_PREVIEW_CAMERA.y - CAMERA.y
  context.fillStyle = ORIGINAL_COLORS.black
  context.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)

  // 하늘 0x77fe8 — 구장+8 에서 80 단색 · 108 그라데이션 · 60 단색 (가로는 480 이라 화면을 다 덮는다)
  const { top, bottom, colorIndex } = skyColorsOf(state.skyRow, state.skyColumn)
  const skyTop = SKY_GRADIENT.top + dy
  const skyBottom = SKY_GRADIENT.bottom + dy
  context.fillStyle = top
  context.fillRect(0, 0, STAGE_WIDTH, skyTop)
  const gradient = context.createLinearGradient(0, skyTop, 0, skyBottom)
  gradient.addColorStop(0, top)
  gradient.addColorStop(1, bottom)
  context.fillStyle = gradient
  context.fillRect(0, skyTop, STAGE_WIDTH, skyBottom - skyTop)
  context.fillStyle = bottom
  context.fillRect(0, skyBottom, STAGE_WIDTH, SKY_GRADIENT.end - SKY_GRADIENT.bottom)

  context.save()
  context.translate(dx, dy)
  if (isCloudVisible(colorIndex)) drawClouds(context, 0, cloudPaletteRowOf(colorIndex))
  // 시즌 구장 0x77494 — 팀 아이콘(칸 3)은 위 미해결이라 뺀다
  const season = state.seasonStadium
  const fence = seasonFenceFramesOf(season.stand, season.crowd)
  drawAtFenceAnchor(context, placedFrame(fence.folder, fence.standFrame))
  drawAtFenceAnchor(context, placedFrame(fence.folder, fence.crowdFrame))
  const board = seasonBoardFrameOf(season.board)
  drawAtFenceAnchor(context, placedFrame(board.folder, board.frame))
  if (state.isScoreboardOn !== false) drawScoreboardText(context, seasonScoreboardBoxOf(season.board) ?? undefined, 0)
  context.restore()

  // 바닥 0x7725c — 그림 x 는 구장+4 를 따라 옮겨 간다(원본 쪽 자르기 시작점이 −dx 만큼 오른쪽)
  const field = fieldBackground(season.grassPalette)
  if (field === null) return
  const sourceX = STAGE_LAYOUT.fieldSourceX - dx
  context.drawImage(
    field,
    sourceX, 0, STAGE_WIDTH, field.height,
    0, STAGE_LAYOUT.fieldTopY + dy, STAGE_WIDTH, field.height,
  )
}
