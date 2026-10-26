import { BOARD_BOXES, FENCE_BOXES } from '@/shared/config/original/stadiumScene'
import {
  CLOUD_FRAMES, CROWD_FRAMES, FENCE_BOARD_FRAMES, FENCE_FRAMES, FENCE_SEASON_FRAMES,
  HIDDEN_BOARD_FRAMES, HIDDEN_FENCE_FRAMES, SCOREBOARD_FRAMES, SKY_LIGHT_FRAMES, TEAM_ICON, fieldBackground,
  drawFrameAt, frameAnimations, placedFrame, sprite, warmRecoloredFrames,
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
 * 구장 객체 +0x60 은 **현재 타자의 손**을 받아, 우타(0)면 펜스 · 관중석 · 전광판 그림과 바닥(0x7725c)을 효과 0x11 로
 * 뒤집는다 — 팀 아이콘 · 관중 ppl · 전광판 글자는 안 뒤집고 옮기기만 한다 (`RIGHT_HANDED_MIRROR_X` 주석). 하늘·구름은 그대로다.
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
  /** 타석 화면이 열린 뒤 흐른 틱 — 하늘 조명 애니 · (아래 `scoreboardTick` 이 없으면) 전광판 글자 흐름 */
  readonly tick: number
  /**
   * 전광판 글자 셈 — 이 장면에서 배경을 처음 그린 그림이 0 (`sceneCloudClock.sceneScoreboardTickOf`, 구장 +0x8c 의 시작값 자리).
   * 생략하면 `tick`
   */
  readonly scoreboardTick?: number
  /**
   * 구름 흐르기 0x78448 이 센 부름 수(`cloudScrollAt` 의 `calls`) — 경기 장면 동안 이어지는 셈(`model/sceneCloudClock`).
   * 생략하면 0(구름 칸 처음 자리 — 0x78448 을 안 부르는 미리보기 0xb158 따위)
   */
  readonly cloudCalls?: number
  /**
   * 구장 번호 = 구장 객체 +0x70. 모드 1·8·9 는 장면 셋업 0x39fdc 가 st+0x30 으로(9 보다 크면 rand(0, 10)), 3·4 는 홈 팀 ·
   * 대회 2/8, 7 은 내 팀, 시즌 대회는 0x352e8 이 2/8 로 채운다(`features/play-team-game/model/sceneStadium`).
   * 시즌 정규 · 미션은 생성자 값 0 이다
   */
  readonly stadium: number
  /**
   * 바닥 그림 팔레트 줄 = 구장 객체 +0xc (0x76b6c). `seasonStadium.grassPalette` 가 있으면 그쪽이 먼저다. null · 생략이면 기본색
   */
  readonly fieldPalette?: number | null
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
   * 시즌 구장 전광판 글자 x 이동 = 구장 **+0x8c** 그대로. 있으면 `tick` 대신 이 값을 쓴다 — 구장관리·상점 미리보기는 장면 구장의
   * 칸을 직접 들고 흘린다(`stepSeasonScoreboardX`). 생략하면 `scoreboardScrollX(상자 폭, tick)`.
   */
  readonly scoreboardX?: number
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
  /**
   * **0x13 타석 카메라가 옮긴 만큼** (`hitCamera.stageCameraShiftOf`) — 0x41230 이 구장 +0xf10 자리(구장+4 · +8)에 (+0xff4, +0xff8) 을
   * 적으므로 하늘 띠(0x77fe8 이 구장+8 에서) · 구름 · 펜스 묶음 · 바닥이 함께 옮겨진다. 하늘 조명 0x78490 은 화면 오른쪽 위(화면 폭에서
   * 잰다)라 그대로다. 생략하면 (0, 0)
   */
  readonly cameraShift?: { readonly dx: number; readonly dy: number }
}

const CAMERA = { x: -120, y: -70 }
const SKY_GRADIENT = { top: 10, bottom: 118, end: 178 }
const CLOUD_COUNT = 3
/** 하늘을 단색으로 칠하고 조명도 안 그리는 구장 번호 (0x78046 · 0x784c6 `cmp #8`) */
const FLAT_SKY_STADIUM = 8
/** 구장 8 의 하늘 단색 — 0x7806e `0x1400748(0xc6, 0xd4, 0xd7)` */
const FLAT_SKY_COLOR = 'rgb(198, 212, 215)'
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
 * **되감기 0x77edc(구장, 1)** — 시즌 구장(+0x40 전광판 그림이 있다)이면 전광판 칸 +0x8a 가 0 · 5 일 때 **아무것도 안 하고**,
 * 그 밖이면 +0x8c = 전광판 그림 박스(칸 3 이면 2, 아니면 0)의 폭 + 2 (0x77ee8~0x77fa6, 직접 떴다). 안 건드리면 null.
 */
export function seasonScoreboardRewindXOf(board: number): number | null {
  const box = seasonScoreboardBoxOf(board)
  return box === null ? null : box[2] + SCOREBOARD_SCROLL_START_MARGIN
}

/**
 * **흐르기 0x77fb4(구장, 1)** 를 `steps` 번 — 부를 때마다 +0x8c −= 1, `−(board_ani 프레임 0 폭) − 10 > +0x8c` 면 0x77edc(구장, 1)
 * 로 되감는다(직접 떴다, 0x77fb4~0x77fe4). 칸 0 · 5 는 되감기가 아무것도 안 해 값이 계속 줄어든다(그 칸은 글자를 안 그린다).
 */
export function stepSeasonScoreboardX(x: number, board: number, steps: number): number {
  const rewindTo = seasonScoreboardRewindXOf(board)
  let next = x
  for (let step = 0; step < steps; step += 1) {
    next -= 1
    if (next < SCOREBOARD_REWIND_THRESHOLD && rewindTo !== null) next = rewindTo
  }
  return next
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
  const { dx, dy } = state.cameraShift ?? { dx: 0, dy: 0 }
  const colorIndex = drawSky(context, state, dy)
  // 구장 8 은 하늘 0x77fe8 이 단색만 칠하고 구름 갈래까지 가지 않는다(78088 → 783a8)
  if (state.stadium !== FLAT_SKY_STADIUM && isCloudVisible(colorIndex)) {
    withShift(context, dx, dy, () => drawClouds(context, state.cloudCalls ?? 0, cloudPaletteRowOf(colorIndex)))
  }
  const offsetY = state.offsetY ?? 0
  withShift(context, dx, 0, () => drawFence(context, state, offsetY + dy))
  drawField(context, state.seasonStadium?.grassPalette ?? state.fieldPalette ?? null, offsetY + dy, (state.side ?? STAGE_SIDE) === BATTER_SIDE.우타, dx)
  if (offsetY === 0) drawSkyLight(context, state, colorIndex)
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

/**
 * 하늘 0x77fe8 — 구장 +0x70 == 8 이면(78040~78088) 화면 전체 (0, 0, W, H) 를 RGB(0xc6, 0xd4, 0xd7) 한 색으로 칠하고 끝난다
 * (그라데이션 · 구름 없음). 그 밖은 표 0xd37a4 줄 · 칸의 두 색으로 위 단색 · 그라데이션 · 아래 단색.
 * 돌려주는 색 칸은 구름 · 하늘 조명이 쓴다(구장 8 은 둘 다 안 그린다).
 */
function drawSky(context: CanvasRenderingContext2D, state: SceneryState, dy = 0): number {
  const { top, bottom, colorIndex } = skyColorsOf(state.skyRow, state.skyColumn)
  if (state.stadium === FLAT_SKY_STADIUM) {
    context.fillStyle = FLAT_SKY_COLOR
    context.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
    return colorIndex
  }
  // 띠는 구장+8 에서 잰다 — 0x13 카메라가 옮긴 dy 만큼 같이 내려간다(가로 480 이라 화면을 늘 덮는다)
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
  return colorIndex
}

/** 구름 (0x782d6~) — 그림은 0x76fd0 이 `.mpl` 줄 `v − 1` 로 실어 둔 것이다 (`cloudPaletteRowOf`) */
function drawClouds(context: CanvasRenderingContext2D, cloudCalls: number, paletteRow: number | null): void {
  for (let index = 0; index < CLOUD_COUNT; index += 1) {
    const frame = placedFrame(CLOUD_FRAMES, index, paletteRow)
    if (frame === null) continue
    const x = CAMERA.x + cloudScrollAt(index, cloudCalls) + frame.offsetX
    const y = CAMERA.y + frame.offsetY
    context.drawImage(frame.image, x, y)
    context.drawImage(frame.image, x + CLOUD_WRAP_WIDTH, y)
  }
}

/**
 * **우타(구장 +0x60 == 0) 거울** — 0x77974 · 0x77494 · 0x7725c 를 직접 떴다 (2026-10-14).
 * ```
 * 779a4  +0x60 ≠ 0(좌타): x = 구장+4 − 1 … − 10 에 효과 0 · 박스 계산 0x948cd 도 효과 0      ; 77a1a~77a40
 *        +0x60 == 0(우타): x = 구장+4 + 10 + 480 에 효과 0x11(좌우)로 펜스를 그리고 박스도 효과 0x11 로 잰다 ; 77a42~77ab4
 * 77ad0  팀 아이콘 0 · 1 = 펜스 박스 i 의 (x, y) + (잰 박스 x − 프레임 +0xe) — 아이콘 자체는 안 뒤집는다(0xb9d35, 정렬 0x22)
 * 77bea  관중 ppl(+0x74) 파트: 좌타 x = 기준 + dx · 우타 x = 기준 + dx + 0x78 — **효과는 같다(안 뒤집는다)**
 * 77d06  전광판 글자 상자 = 펜스 박스 2 + 1 + (잰 박스 x − 프레임 +0xe) — 글자도 안 뒤집는다
 * 77540  시즌 구장 0x77494: 관중석 · 관중 덧그림 · 전광판 그림 셋 다 우타면 x + 490 · 효과 0x11, 아이콘 · 글자는 전광판 그림 박스로 잰다
 * 772ca  바닥 0x7725c: 좌타 x = 구장+4 − 1 − 0x48 효과 0 · 우타 x = 구장+4 − 0x21 효과 0x11 (그림 단계 뒤집기 — 제 상자 안)
 * ```
 * 효과 0x11 · b 0 은 파트를 x' = X − (dx + 폭) 에 거울로 놓는다(R6 3b) — 펜스 점 p 는 좌타 XL + p, 우타 XR − 1 − p 이고
 * XL = −131 · XR = 370 이라 **화면 x → 238 − x 거울**이다(바닥도 폭 585 라 같은 거울). 그래서 펜스 · 관중석 · 전광판 그림 · 바닥은
 * 캔버스를 (239, 0) 에서 뒤집어 그리고, 박스로 놓는 팀 아이콘 · 전광판 글자는 뒤집지 않은 채 잰 박스만큼 옮긴다
 * (`rightHandedBoxShiftOf` — 지금 펜스 셋은 모두 141), 관중 ppl 은 0x78 + 21 = 141 옮긴다.
 * 예전 웹은 통째로 뒤집어 관중 ppl 그림의 "GAMEVIL®" 글자가 거울로 나와 거울을 꺼 두었다 — 원본은 ppl 을 안 뒤집고 옮기기만
 * 하므로 우타에서도 그 글자는 똑바로 읽힌다(헤드리스 확인).
 * 흔들기 칸(구장 +0x64 → 0xbb255 · 0x771e4)은 웹이 안 그리므로 0 으로 본다.
 */
export const RIGHT_HANDED_MIRROR_X = 239
/** 우타 펜스 그리기 x = 구장+4 + 10 + 480 (0x77a72 · 0x77a84) */
const RIGHT_HANDED_FENCE_X = CAMERA.x + 10 + 480
/** 우타 관중 ppl 파트는 좌타 자리 + 0x78 + 21 (77bf0 · 77c0e — 기준이 −1 − 10 대신 + 10 이고 + 0x78) */
export const RIGHT_HANDED_CROWD_SHIFT = 10 + 0x78 - (-1 - 10)

/**
 * 우타 때 박스로 놓는 그림(팀 아이콘 · 전광판 글자)을 좌타 자리에서 옮기는 값 — (XR − 2·원점x − 폭) − XL.
 * 0x948cd 가 효과 0x11 로 잰 박스 x = XR − (원점x + 폭) 에서 프레임 +0xe(원점x) 를 한 번 더 뺀다.
 */
export function rightHandedBoxShiftOf(frame: { readonly offsetX: number; readonly width: number }): number {
  return RIGHT_HANDED_FENCE_X - 2 * frame.offsetX - frame.width - FENCE_ANCHOR.x
}

function drawFence(context: CanvasRenderingContext2D, state: SceneryState, offsetY: number): void {
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

function drawFenceParts(context: CanvasRenderingContext2D, state: SceneryState, isMirrored: boolean): void {
  if (state.seasonStadium !== undefined) {
    drawSeasonFenceParts(context, state, state.seasonStadium, isMirrored)
    return
  }

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
function drawSeasonFenceParts(
  context: CanvasRenderingContext2D,
  state: SceneryState,
  season: SeasonStadium,
  isMirrored: boolean,
): void {
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

/** 펜스 기준에 그림 하나 — 우타 거울(`RIGHT_HANDED_MIRROR_X`)이면 캔버스를 뒤집어 같은 자리에 그린다. `shiftX` 는 안 뒤집는 옮김 */
function drawAtFenceAnchor(context: CanvasRenderingContext2D, frame: PlacedFrame | null, isMirrored = false, shiftX = 0): void {
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
function drawTeamIcons(
  context: CanvasRenderingContext2D,
  state: SceneryState,
  boxes: readonly (readonly number[])[],
  shiftX = 0,
): void {
  // 0x77974 77ad6~77af0 · 77b4a~77b64 — 14 → 10, 10 이상 → 11 을 고른 뒤 **전역 모드 5 · 6(미션)이면 늘 11** 로 덮는다
  const isMissionMode = state.gameMode === 5 || state.gameMode === 6
  const icons = [state.ourTeamId, state.opponentTeamId].map((teamId) =>
    teamId === null || isMissionMode ? MISSION_TEAM_ICON : teamIconOf(teamId),
  )
  TEAM_ICON_BOXES.forEach((boxIndex, index) => {
    const box = boxes[boxIndex]
    const image = sprite(TEAM_ICON(icons[index] ?? MISSION_TEAM_ICON))
    if (box === undefined || image === null) return
    context.drawImage(image, FENCE_ANCHOR.x + shiftX + box[0], FENCE_ANCHOR.y + box[1])
  })
}

/** 전광판 화면 — board_ani 프레임 0 을 상자 안에서 틱당 1px 씩 흘린다 (0x77726~0x777d8) */
function drawScoreboardText(
  context: CanvasRenderingContext2D,
  box: readonly number[],
  scrollX: number,
  shiftX = 0,
): void {
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
  // 애니 0 의 칸 전부를 미리 칠한다 — 넘어가는 칸마다 구운 벌이 한 박자 비치지 않게 (원본은 적재 때 팔레트를 갈아 끼운다)
  warmRecoloredFrames(`sky-light|${paletteRow}`, () =>
    [...new Set(entries.map((entry) => entry.frame))].map((frame) => ({ folder: SKY_LIGHT_FRAMES, frame, paletteIndex: paletteRow })))
  const first = placedFrame(SKY_LIGHT_FRAMES, 0, paletteRow)
  if (first === null) return
  const originX = STAGE_WIDTH - first.offsetX - first.image.width
  // 애니 그리기 0x93c45(…, 효과 r3 = 0) → 프레임 0xc9f98 이 파트 효과 0x67 을 픽셀 효과 2(더하기 b = 200 ~ 100)로 그린다 —
  // 하늘 · 구름 · 펜스 · 바닥을 칠한 화면에 더한다(`drawFrameAt` → `layers.json`). 겹이 아직이면 구운 근사(알파 b/255)
  drawFrameAt(context, SKY_LIGHT_FRAMES, frameIndex, originX, 0, { paletteIndex: paletteRow })
}

/**
 * 바닥(그라운드) — 원본 `0x7725c` 가 구장 객체 `+0x2c` 에 달린 `stadium/attack` 그림을 그린다.
 * `grassPalette` 가 있으면 그 `.mpl` 줄로 칠한 그림을 쓴다 (잔디 = 팔레트, `0x786c8`).
 * 칠하는 동안에는 구운 그림이 나가므로 첫 몇 프레임은 기본색이 보인다.
 */
function drawField(context: CanvasRenderingContext2D, grassPalette: number | null, offsetY: number, isMirrored = false, shiftX = 0): void {
  const field = fieldBackground(grassPalette)
  if (field === null) return
  if (isMirrored) {
    // 0x772ca — 우타는 x = 구장+4 − 0x21 에 효과 0x11(제 상자 안 뒤집기). 폭 585 라 좌타 자리(−193)의 238 − x 거울과 같다
    context.save()
    context.translate(RIGHT_HANDED_MIRROR_X + shiftX, 0)
    context.scale(-1, 1)
    context.drawImage(field, -STAGE_LAYOUT.fieldSourceX, STAGE_LAYOUT.fieldTopY + offsetY)
    context.restore()
    return
  }
  if (shiftX !== 0) {
    // 0x13 카메라가 옮긴 가로 — 화면 폭만 잘라 그리던 그림을 통째로 구장+4 자리에서 그린다
    context.drawImage(field, -STAGE_LAYOUT.fieldSourceX + shiftX, STAGE_LAYOUT.fieldTopY + offsetY)
    return
  }
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
 * **우타 거울** (2026-10-15 직접 떴다): 이 구장([this+0x10c])은 0x3b14 가 `0x1239(0x94)`(4028 · 할당 0x2ac4 가 0x1400428 memset 으로
 * 0 을 채운다) → 생성자 0x76b24(4032) → 0x76ac8 로 만들고 76ade~76ae2 가 **+0x60 = 0** 으로 둔다. 진입 0xe4d0 은 +0x60 을 안 쓰고
 * (0x78741 관중석 · +0x89 = 0 · +0x8a = 기록+0x1b9 · 0x76b6c · 0x76ba4(1) · 0x783b0 · 0x76fc4 · 카메라 · 0x786c9 잔디), 장면 +0x10c 를
 * 읽는 시즌 장면 함수(0x3b14 · 0x4180 · 0x5f3c · 0x7958 · 0x957c · 0xb158 · 0xb1f8 · 0xe4d0 · 0xe9ac · 0xf684 · 0x10004) 어디도 +0x60 을
 * 안 쓴다. 그래서 시즌 구장 0x77494(774e6 `ldrb [+0x60]` == 0 → 77540 x + 490 · 효과 0x11)와 바닥 0x7725c(77272 == 0 → 772ca
 * x = 구장+4 − 0x21 · 효과 0x11)가 **우타 거울 길**로 그린다. 거울 축은 2·구장+4 + 479 라 카메라 (−165) 에서는 화면 149 − x 다 —
 * 웹은 캔버스를 dx(= −165 + 120) 만큼 옮긴 뒤 경기 우타 길(`RIGHT_HANDED_MIRROR_X`, 바닥 통째)을 그대로 그리면 같은 축이 된다.
 * 바닥 그림(폭 585)은 우타 자리 −198~387 이 화면을 다 덮는다.
 *
 * **전광판 팀 아이콘**(칸 3, 0x77654~0x77722): 구장+0x7c(아이콘 그림)는 적재 0x76ba4 가 76ec2 에서 늘 싣고(0 이 아니다), 아이콘 칸
 * +0x84(박스 0) · +0x80(박스 1)은 위 함수들 어디도 안 쓴다 — 할당 memset 의 **0 그대로**다. 0x77494 는 0x77974 와 달리 모드 5·6 덮기가
 * 없고 14 → 10 · 9 초과 → 11 만 고르므로 두 상자 모두 **아이콘 0** 이 그려진다.
 *
 * 장면 구장 칸 (U-124 닫음):
 * - 하늘 칸 구장+0x18 은 0x783b0 이 `[0x1552d0c]+0x6b`(마지막 경기 상태의 이닝)를 읽는다 — 부르는 쪽이 `liveGameInningIndex()` 로 넘긴다.
 * - 구름 칸 구장+0x1c · +0x20 · +0x24 는 0x76ab0 · 할당 memset 의 0 에서 0x78448 만 옮기는데, 0x78448 을 부르는 곳은 경기 장면
 *   0x3f060 · 0x45c18 · 0x4a384 셋뿐이라(xref 전수) 시즌 장면 0x105 의 이 구장은 **늘 0** 이다 — 웹의 부름 수 0(`cloudCalls` 생략)과 같다.
 * - 전광판 글자 자리(+0x8c)는 부르는 쪽이 장면 구장 칸으로 넘긴다(`scoreboardX`).
 */
export const STADIUM_PREVIEW_CAMERA = { x: -165, y: -80 } as const

export interface StadiumPreviewState {
  readonly skyRow: number
  readonly skyColumn: number
  readonly seasonStadium: SeasonStadium
  /** 환경설정 전광판(+0x3a) — OFF 면 전광판 글자를 안 그린다 (0x77726). 생략하면 켠 것 */
  readonly isScoreboardOn?: boolean
  /** 전광판 글자 x 이동 = 장면 구장 +0x8c (`StadiumPreviewScene`) */
  readonly scoreboardX: number
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
  // 시즌 구장 0x77494 — +0x60 == 0 이라 우타 거울 길(관중석 · 덧그림 · 전광판 그림 뒤집기, 아이콘 · 글자는 잰 박스만큼 옮김)
  drawSeasonFenceParts(context, stadiumPreviewSceneryOf(state), state.seasonStadium, STADIUM_PREVIEW_MIRRORED)
  context.restore()

  // 바닥 0x7725c — +0x60 == 0 이라 772ca 우타 갈래(x = 구장+4 − 0x21, 효과 0x11). 카메라 x 를 따라 dx 만큼 옮긴다
  context.save()
  context.translate(dx, 0)
  drawField(context, state.seasonStadium.grassPalette, dy, STADIUM_PREVIEW_MIRRORED)
  context.restore()
}

/** 구장관리 미리보기 구장 +0x60 == 0 (생성자 76ae2, 위 주석) — 우타 거울 길로 그린다 */
export const STADIUM_PREVIEW_MIRRORED = true
/** 미리보기 구장의 아이콘 칸 +0x84 · +0x80 — 아무도 안 써서 할당 memset 의 0 (위 주석) */
export const STADIUM_PREVIEW_ICON_TEAM = 0

function stadiumPreviewSceneryOf(state: StadiumPreviewState): SceneryState {
  return {
    skyRow: state.skyRow,
    skyColumn: state.skyColumn,
    tick: 0,
    stadium: 0,
    seasonStadium: state.seasonStadium,
    ourTeamId: STADIUM_PREVIEW_ICON_TEAM,
    opponentTeamId: STADIUM_PREVIEW_ICON_TEAM,
    scoreboardX: state.scoreboardX,
    ...(state.isScoreboardOn === undefined ? {} : { isScoreboardOn: state.isScoreboardOn }),
  }
}

/**
 * **경기정보 구장 미리보기** — 도우미 `0x5fd04(스킨, 무대)` 가 무대를 세운 뒤 `0x581dc(스킨, 무대, 1)` 로 화면을 떠 둔다(직접 떴다):
 * ```
 * 5fd0a  0x76b6c(무대)            ; 바닥 stadium/attack 을 무대+0xc 줄로
 * 5fd16  0x76ba4(무대, 0)         ; 일반 구장 그림(펜스 · 관중 · 전광판)
 * 5fd1e  0x783b0(무대)            ; 하늘 줄 +0x10 — 모드 1 측 0 팀 · 2 시즌 +0xb2 · 3·4 나리 +0xb2 (mod 6), 칸 +0x18 = 경기 상태 +0x6b
 * 5fd28  0x76fc4(무대, 1)         ; 하늘 칸 = min(+0x18, 12) · 구름
 * 5fd36  무대+4 = −120 · 무대+8 = −68  ; 카메라 (경기는 −70)
 * 5fd40  0x581dc(스킨, 무대, 1):
 *   581f6  0x6a735(gfx, RGB(255, 255, 255))     ; 화면 흰색
 *   58210  0x78578(무대, 0, 1)                  ; 하늘 0x77fe8 → 일반 구장 0x77974 → 바닥 0x7725c → 하늘 조명 0x78490
 *   58218  0xbdd65(1) · 3줄 선(알파 0x10) · [0x15605d0] 흰 단계 3 · 0xbda01 로 [0x1552ae4] 에 떠 둔다 → [skin+0x450]
 * ```
 * 떠 두면 무대는 버리고(3162a · 683e · 1c888) 그림마다 `0x581dc(스킨, 0, 0)` 이 그 버퍼를 (0, 0) 에 찍는다 — 구름 · 전광판이 안 흐른다.
 * 부르는 곳: 일반모드 22 진입 0x314b0(3161e) · 시즌 0xdd 진입 0x6548(682e) · 나리 142 진입 0x1c46c(1c87c).
 * 그리는 곳: 0xb810(시즌 0xdd · 0xe0 · 0xe1) · 0x16928(나리 142~144) · 0x2e070 · 0x2e0c4(일반모드 22 · 23).
 *
 * 이 함수는 `0x78578` 까지(흐리기 앞)를 그린다. 팀 아이콘 박스 0 = 무대+0x84(측 0 팀) · 박스 1 = +0x80(측 1 팀).
 * 경기 상태 +0x6b 는 세 진입 모두 앞에서 0xb6814 로 지운 뒤라 하늘 칸 0 이다.
 */
export const MATCH_INFO_STADIUM_CAMERA = { x: -120, y: -68 } as const

/**
 * **경기정보 무대는 우타 거울로 그린다** (2026-10-14 직접 떴다). 무대는 세 진입이 모두 생성자 0x76b24(0x314b0 315c6 · 0x6548 67dc ·
 * 0x1c46c 1c7ae)로 새로 만들고, 0x76b24 → 0x76ac8 이 76ade~76ae2 에서 **+0x60 = 0** 으로 둔다. 그 뒤 진입이 채우는 칸은 +0x70 · +0x80 ·
 * +0x84 · +0xc 이고 0x5fd04 의 0x76b6c · 0x76ba4 · 0x783b0 · 0x76fc4 도 +0x60 을 안 쓴다 — `adds rN, #0x60 ; strb [rN]` 을 .text
 * 전체에서 훑으면 +0x60 을 쓰는 곳은 0x76ae2(생성자) 와 경기 장면 구장(장면 +0xf10)을 적는 다섯 곳(0x3adbc · 0x3b108 · 0x47d62 ·
 * 0x48890 · 0x516b8 — 모두 `[장면+0xf10]` 에 0xb63c1 타자 손)뿐이다(str/strh 로 +0x5c~+0x60 을 덮는 곳도 구장 클래스 안에 없다).
 * 0x77974 의 [sp+0x48] = 무대+0x60(779a0) 이 0 이므로 펜스 · 바닥은 효과 0x11 로 뒤집히고 팀 아이콘 · 전광판 글자 · 관중 ppl 은
 * 경기 우타와 같이 옮겨진다.
 */
export const MATCH_INFO_STADIUM_MIRRORED = true

export interface MatchInfoStadiumState {
  /** 무대 +0x70 — 펜스 프레임 · 하늘 단색(8) */
  readonly stadium: number
  /** 무대 +0xc — 바닥 팔레트 줄 (null 기본색) */
  readonly fieldPalette: number | null
  /** 하늘 줄 +0x10 (`stadiumSkyRowOf`) */
  readonly skyRow: number
  /** 무대 +0x84 — 측 0(선공) 팀 */
  readonly side0TeamId: number
  /** 무대 +0x80 — 측 1(후공) 팀 */
  readonly side1TeamId: number
  /** 전역 모드 — 하늘 조명 0x78490 이 5 · 6 · 7 이면 안 그린다 */
  readonly gameMode: number
  /** 환경설정 전광판(+0x3a) — OFF 면 전광판 글자를 안 그린다. 생략하면 켠 것 */
  readonly isScoreboardOn?: boolean
}

export function drawMatchInfoStadium(context: CanvasRenderingContext2D, state: MatchInfoStadiumState): void {
  const dy = MATCH_INFO_STADIUM_CAMERA.y - CAMERA.y
  const scenery: SceneryState = {
    skyRow: state.skyRow,
    skyColumn: 0,
    tick: 0,
    stadium: state.stadium,
    fieldPalette: state.fieldPalette,
    ourTeamId: state.side0TeamId,
    opponentTeamId: state.side1TeamId,
    gameMode: state.gameMode,
    ...(state.isScoreboardOn === undefined ? {} : { isScoreboardOn: state.isScoreboardOn }),
  }
  // 0x581dc 581f6 — 화면 흰색
  context.fillStyle = '#fff'
  context.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)

  // 하늘 0x77fe8 — 구장 8 이면 화면 전체 단색, 그 밖은 구장+8 에서 위 단색 · 그라데이션 · 아래 단색
  const { top, bottom, colorIndex } = skyColorsOf(state.skyRow, 0)
  const isFlatSky = state.stadium === FLAT_SKY_STADIUM
  if (isFlatSky) {
    context.fillStyle = FLAT_SKY_COLOR
    context.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT)
  } else {
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
  }

  context.save()
  context.translate(0, dy)
  if (!isFlatSky && isCloudVisible(colorIndex)) drawClouds(context, 0, cloudPaletteRowOf(colorIndex))
  // 일반 구장 0x77974 — 펜스 프레임 · 팀 아이콘 · 관중 · 전광판(틱 0). 무대 +0x60 == 0 이라 **우타 거울** 길이다
  // (`MATCH_INFO_STADIUM_MIRRORED` — 펜스 뒤집기 · 아이콘 · 글자 옮김 · 관중 ppl 141 옮김)
  drawFenceParts(context, scenery, MATCH_INFO_STADIUM_MIRRORED)
  context.restore()
  // 바닥 0x7725c — 무대+0xc 줄, +0x60 == 0 이라 772ca 우타 갈래(효과 0x11)
  drawField(context, state.fieldPalette, dy, MATCH_INFO_STADIUM_MIRRORED)
  // 하늘 조명 0x78490(무대, 0, 1)
  drawSkyLight(context, scenery, colorIndex)
}
