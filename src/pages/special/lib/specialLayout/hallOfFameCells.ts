import { SCREEN } from '@/pages/special/lib/specialLayout/specialItems'
import { HALL_OF_FAME_PITCHER_SLOTS } from '@/pages/special/lib/specialLayout/hallOfFameSlots'
import type { HallOfFameSlotState } from '@/pages/special/lib/specialLayout/hallOfFameSlots'

/**
 * 명예의 전당 (하위 상태 27 = 공용 목록 페이지 `0x63b15` 의 **k = 8**) — P6 2a-3 · S9 3~4절.
 *
 * 화면은 위쪽 **자세히 보기 두 자리**(A = 선수, B = 능력치)와 아래쪽 **5×3 격자 15칸**,
 * 그리고 커서 칸 옆에 뜨는 **말풍선**(친구에게 선물 / 슬롯에서 삭제) 으로 되어 있다.
 *
 * 격자는 공용 위젯 `0x79ed5(격자, 6, 120, H/2 + 19 = 179, 칸너비표, 줄높이 40, 5열, 3행, …)` 이고,
 * 그리기 `0x7a571` 의 식은 S9 4절에서 확정됐다:
 * ```
 * 왼쪽 x = cx − (Σ칸너비 + (열−1)·가로틈)/2        위쪽 y = cy (가운데 정렬 안 함)
 * x[i] = 왼쪽 + 열·(칸너비 + 가로틈)              y[i] = 위쪽 + 줄·(줄높이 + 세로틈)
 * 종류 6 이면 y[i] -= 0xd40b8[열] = [3,3,3,13,13]  ← 4·5열만 10px 더 위
 * ```
 * 칸너비 표는 0xd1df8 = [40 ×5], 가로 · 세로틈 0 이다(0x651be~0x651d6) — 왼쪽 x 가 20, 칸이 (20·60·100·140·180) 로 떨어진다.
 * 칸 바탕(남색 둥근 네모)은 **없다** — 시작 0x7a005 의 넷째 인자 [격자+8] = 0 (0x651e6). 칸 그림은 `HALL_OF_FAME_CELL_ART`.
 * 시작 셋째 인자 [격자+6] = 1 이라 커서 튕김(`useGridCursorBounce`)은 있다.
 */
export const HALL_OF_FAME_GRID = {
  kind: 6,
  centerX: 120,
  /** cy = H/2 + 19 — **첫 줄 위쪽 y** 다 (가운데가 아니다, S9 3-2) */
  firstRowY: SCREEN.height / 2 + 19,
  columns: 5,
  rows: 3,
  /** 칸너비 표 = 0xd1df8 [40 ×5] (0x63b3a 에서 [sp+0x294] 로 베끼고 0x651be 가 다섯째 인자로 넘긴다, 직접 떴다) */
  cellWidth: 40,
  rowHeight: 40,
  /** 가로 · 세로틈 0 — 0x79ed5 아홉째 · 열째 인자가 둘 다 r5 = 0 이다(0x651c6 · 0x651d4 · 0x651d6, 직접 떴다) */
  horizontalGap: 0,
  verticalGap: 0,
  /** 종류 6 의 열별 y 보정 표 0xd40b8 (확정) */
  columnYAdjust: [3, 3, 3, 13, 13],
} as const

/**
 * 명전 격자의 **칸 그림** — 종류 3 · 6(k 6 · 8)은 0x7ac2e, 칸 바탕(남색 둥근 네모)은 없다: 시작 0x7a005(격자, [skin+0xe8], 1, 0) 의
 * 넷째 인자 [격자+8] = 0 이라(0x651e6 `movs r3, #0`) 0x7a7da 가 바탕 갈래를 건너뛴다. 칸마다 (직접 떴다):
 * ```
 * 7ac4e  slt_frame 이미지 0(39×38) 을 (x, y)                                   ; 칸 틀
 *        가운데 (cx, cy) = (x + 39/2, y + 38/2) — 아래 그림은 모두 (cx − w/2, cy − h/2)
 *        칸 상태 [목록+0x20c + 칸×8] (점프표 0xd40e8):
 * 7acb6    0 → 이미지 115 (×)
 * 7ad02    1 · 3 → 칸 ≤ 4 ? 23 (글러브) : 24 (방망이) 위에 딱지 0xd40a0[[목록+0x20c + 칸×8 + 4]]
 *              딱지 표 0xd40a0 = [28 BAL, 30 SLG, 29 SPD, 25 OVER, 27 SIDE, 26 UNDER] — 칸 채우기 0x5eb8c 가 투수는
 *              (폼 rec+0xb >> 4) >> 1 + 3 (0x5ed92 · 0x5ed8c 0xb6e25), 타자는 rec+0xb >> 5 (0x5ede4 · 0x5ee46) 를 적는다 = 타입
 * 7adcc    2 · 4 → 칸 ≤ 4 ? 21 (어두운 글러브) : 22 (어두운 방망이)
 * 7ae54    5 → 31 (자물쇠)
 * 7aeaa  목록 종류 [목록+0x1fc] == 3(나리 145 등록)이고 전역 모드 [0x1552d10] 가 3(투수편)이면 칸 > 4, 4(타자편)이면 칸 ≤ 4 를
 *        0x6b7d5(gfx, x, y, 39, 38, 둥글기 1, 0x80000000) — 반투명 검정으로 덮는다
 * ```
 * 커서는 열림 애니가 끝났고([격자+9]) 깜빡일 때([격자+0x18] % 8 ≤ 4) slt_frame 이미지 1(42×42) 을 (x − 2, y − 2) (0x7b3a0 → 0x7b432).
 */
export const HALL_OF_FAME_CELL_ART = {
  frame: { image: 0, width: 39, height: 38 },
  cursor: { image: 1, dx: -2, dy: -2 },
  none: { image: 115, width: 19, height: 19 },
  /** 찬 칸 — [투수 칸, 타자 칸] */
  filled: [
    { image: 23, width: 25, height: 27 },
    { image: 24, width: 31, height: 31 },
  ],
  /** 빈 칸 — [투수 칸, 타자 칸] */
  empty: [
    { image: 21, width: 27, height: 29 },
    { image: 22, width: 33, height: 33 },
  ],
  locked: { image: 31, width: 21, height: 25 },
  /** 딱지 표 0xd40a0 — 타자 타입 0 · 1 · 2, 투수 타입 0 · 1 · 2 (+3) */
  typeLabels: [
    { image: 28, width: 19, height: 7 },
    { image: 30, width: 19, height: 7 },
    { image: 29, width: 19, height: 7 },
    { image: 25, width: 25, height: 7 },
    { image: 27, width: 21, height: 7 },
    { image: 26, width: 31, height: 7 },
  ],
  /** 덮개 0x80000000 — 위 바이트 알파 0x80 */
  dimOpacity: 0x80 / 0xff,
} as const

export interface HallOfFameCellImage {
  readonly image: number
  readonly width: number
  readonly height: number
}

/**
 * 칸 하나에 칸 틀 위로 그리는 그림 (차례대로, 모두 칸 가운데 맞춤 — `HALL_OF_FAME_CELL_ART` 머리말).
 * `typeIndex` 는 찬 칸 선수의 타입 — 모르면(생김새 없는 옛 저장) 딱지를 뺀다(⚠️ 웹 저장 한계).
 */
export function hallOfFameCellImagesOf(slot: number, state: HallOfFameSlotState, typeIndex: number | null): readonly HallOfFameCellImage[] {
  const art = HALL_OF_FAME_CELL_ART
  const side = slot < HALL_OF_FAME_PITCHER_SLOTS ? 0 : 1
  if (state === 0) return [art.none]
  if (state === 5) return [art.locked]
  if (state === 2 || state === 4) return [art.empty[side]]
  const label = typeLabelOf(side, typeIndex)
  return label === undefined ? [art.filled[side]] : [art.filled[side], label]
}

/** 찬 칸 타입 딱지 — 투수 칸은 표 3 부터, 타자 칸은 0 부터. 타입을 모르면 없다 */
function typeLabelOf(side: number, typeIndex: number | null): HallOfFameCellImage | undefined {
  if (typeIndex === null) return undefined
  return HALL_OF_FAME_CELL_ART.typeLabels[(side === 0 ? 3 : 0) + typeIndex]
}

/** 그림 하나의 왼쪽 위 — 칸 가운데 (x + 39/2, y + 38/2) 에서 (w/2, h/2) 를 뺀다 (모두 양수라 내림) */
export function hallOfFameCellImageTopLeftOf(image: HallOfFameCellImage): { readonly dx: number; readonly dy: number } {
  const { frame } = HALL_OF_FAME_CELL_ART
  return {
    dx: Math.floor(frame.width / 2) - Math.floor(image.width / 2),
    dy: Math.floor(frame.height / 2) - Math.floor(image.height / 2),
  }
}

/** 0x7aeaa — 나리 145 등록에서 지금 편이 아닌 칸을 덮나 (투수편은 칸 > 4, 타자편은 칸 ≤ 4) */
export function isHallOfFameCellDimmed(edition: '투수' | '타자' | null, slot: number): boolean {
  if (edition === null) return false
  return edition === '투수' ? slot >= HALL_OF_FAME_PITCHER_SLOTS : slot < HALL_OF_FAME_PITCHER_SLOTS
}

export const HALL_OF_FAME_SLOTS = HALL_OF_FAME_GRID.columns * HALL_OF_FAME_GRID.rows

/** 격자 왼쪽 x = cx − (Σ칸너비 + (열−1)·가로틈)/2 (S9 3-2) */
export const HALL_OF_FAME_GRID_LEFT =
  HALL_OF_FAME_GRID.centerX -
  Math.trunc((HALL_OF_FAME_GRID.cellWidth * HALL_OF_FAME_GRID.columns + (HALL_OF_FAME_GRID.columns - 1) * HALL_OF_FAME_GRID.horizontalGap) / 2)

export interface GridCell {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly column: number
  readonly row: number
}

/**
 * 홈런더비 선수 고르기(공용 목록 k 7, 격자 종류 4)의 첫 줄 위쪽 y = H/2 + 0x18 = 184 — 0x65152~0x65158 이 k 7 이면
 * dy 를 0x13 대신 0x18 로 둔다(행 2). 열별 보정 0xd40b8 은 종류 4 에도 걸린다(0x7a79c~0x7a7a2).
 */
export const HOME_RUN_DERBY_FIRST_ROW_Y = SCREEN.height / 2 + 0x18

/** 칸 i 의 자리 (0x7a708~0x7a78e, 열림 애니가 끝난 뒤의 값). `firstRowY` 는 격자 cy(첫 줄 위쪽) */
export function hallOfFameCellOf(index: number, firstRowY: number = HALL_OF_FAME_GRID.firstRowY): GridCell {
  const column = index % HALL_OF_FAME_GRID.columns
  const row = Math.trunc(index / HALL_OF_FAME_GRID.columns)
  return {
    x: HALL_OF_FAME_GRID_LEFT + column * (HALL_OF_FAME_GRID.cellWidth + HALL_OF_FAME_GRID.horizontalGap),
    y: firstRowY + row * (HALL_OF_FAME_GRID.rowHeight + HALL_OF_FAME_GRID.verticalGap) - HALL_OF_FAME_GRID.columnYAdjust[column],
    width: HALL_OF_FAME_GRID.cellWidth,
    height: HALL_OF_FAME_GRID.rowHeight,
    column,
    row,
  }
}
