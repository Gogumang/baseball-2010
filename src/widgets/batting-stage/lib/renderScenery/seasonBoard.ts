/** 시즌 구장(0x77494)의 관중석 · 전광판 칸 고르기와 전광판 글자 흐르기 */
import { BOARD_BOXES } from '@/shared/config/original/stadiumScene'
import { FENCE_BOARD_FRAMES, FENCE_SEASON_FRAMES, HIDDEN_BOARD_FRAMES, HIDDEN_FENCE_FRAMES } from '@/widgets/batting-stage/lib/spriteLoader'

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
export function seasonFenceFramesOf(
  stand: number,
  crowd: number,
): {
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
