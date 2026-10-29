import { DETAIL_WINDOW, type DetailWindowOrigin } from '@/widgets/player-detail-window/lib/playerDetailWindow/detailWindowFrame'

/**
 * 줄 — 칸 x = 창 x + 9 (game_ui 23, 25×15) · 값 칸 창 x + 39 (game_ui 28, 54×15). y 는 창 y 에서 잰 값(에뮬레이션으로 받았다).
 * 이름 글은 0xb9d74(글, 창 x + 9, 창 y + `labelDy`, 25, 15, 0x22, …, dy [sp+0x14] = 1) — 0x5b90c~0x5b916 이 dy 1 을 넘기므로
 * 글 칸은 결국 y = `labelDy` + 1 이다(`DETAIL_LABEL_DY`).
 */
export interface DetailRow {
  readonly labelFrame: number
  readonly cellDy: number
  readonly labelDy: number
  readonly textDy: number
}

export const DETAIL_LABEL_DX = 9

export const DETAIL_VALUE_DX = 39

export const DETAIL_LABEL_CELL = 23

export const DETAIL_VALUE_CELL = 28

/** 0xb9d74 의 dy [sp+0x14] = 1 (0x5b90c `movs r5, #1` · 0x5b916 `str r5, [sp, #0x14]`) */
export const DETAIL_LABEL_DY = 1

/** 투수(종류 3): 29 타입 · 30 손 · 34 구질(흐르는 글) · 33 스킬 · 32 마구 · 86 연봉 */
export const PITCHER_DETAIL_ROWS: readonly DetailRow[] = [
  { labelFrame: 29, cellDy: 9, labelDy: 8, textDy: 9 },
  { labelFrame: 30, cellDy: 27, labelDy: 26, textDy: 27 },
  { labelFrame: 34, cellDy: 125, labelDy: 124, textDy: 125 },
  { labelFrame: 33, cellDy: 143, labelDy: 142, textDy: 143 },
  { labelFrame: 32, cellDy: 160, labelDy: 160, textDy: 161 },
  { labelFrame: 86, cellDy: 179, labelDy: 178, textDy: 179 },
]

/** 타자(종류 2): 29 타입 · 30 손 · 33 스킬 · 35 필살 · 86 연봉 */
export const BATTER_DETAIL_ROWS: readonly DetailRow[] = [
  { labelFrame: 29, cellDy: 9, labelDy: 8, textDy: 9 },
  { labelFrame: 30, cellDy: 27, labelDy: 26, textDy: 27 },
  { labelFrame: 33, cellDy: 143, labelDy: 142, textDy: 143 },
  { labelFrame: 35, cellDy: 161, labelDy: 160, textDy: 161 },
  { labelFrame: 86, cellDy: 179, labelDy: 178, textDy: 179 },
]

/** 능력치 도형 0x5aefc(…, 가운데 x = 창 x + w/2, y = 창 y + h/2 − 16(투수) · − 6(타자), 종류, rec, 0, 반지름 22) */
export const DETAIL_RADAR = { dx: 53, pitcherDy: 85, batterDy: 95, radius: 22 } as const

/** 다 열린 창의 도형 가운데 */
export function detailRadarCenterOf(origin: DetailWindowOrigin, isPitcher: boolean): { readonly x: number; readonly y: number } {
  return {
    x: origin.startX + DETAIL_WINDOW.finalDx + DETAIL_RADAR.dx,
    y: origin.y + (isPitcher ? DETAIL_RADAR.pitcherDy : DETAIL_RADAR.batterDy),
  }
}

/** 축 이름 img_text — 0xd1b14: 투수 37 제구 · 38 구속 · 39 변화 · 40 체력 / 타자 41 히트 · 42 파워 · 43 수비 · 44 주루 */
export const DETAIL_RADAR_LABELS = { pitcher: [37, 38, 39, 40], batter: [41, 42, 43, 44] } as const
