import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  HIDDEN_PITCH_COLUMN,
  isHiddenPitchRowOpen,
  isInPitchList,
  pitchTrainingCostOf,
  pitchTrainingCountOf,
  pitchTrainingRequiredSessionsOf,
  pitchTypeNumberOf,
} from '@/entities/pitcher-career/model/pitchTraining'
import { moveGridCursor } from '@/pages/record/lib/annalsGrid'
import type { AnnalsDirection, AnnalsGridShape } from '@/pages/record/lib/annalsGrid'

/**
 * **구질 훈련 창** — 나리 108 탭 2 (`[gfx+0x188] == 2`). 그리기 0x19e44 = 관리 화면 0x19da4 위에 창 **0x803d4(gfx, 상태 틱)**,
 * 키 0x17828 → 창 키 0x80268, 진입 0x17730 (모두 직접 떴다 · unicorn 으로 0x803d4 를 그대로 돌려 그리기 호출을 받았다).
 *
 * 그림 묶음: `[gfx+0x138]` = ui/mode_ui · `[gfx+0x13c]` = ui/num (0x7ba2c 세터 — 0x13f08 의 1407c · 0x11910 의 11a7a 가
 * `[장면+0xf0]` = num 을 넘긴다) · `[gfx+0x144]` = ui/slt_pitch(진입 0x17730 이 모드 3 이면 0xb9b2d 로 프레임 0~21 을 싣는다) ·
 * 스킨 `[skin+0x9c]` = ui/gpoint.
 *
 * ```
 * 8046c  공용 판 0x55e61(skin, mode_ui 26 박스 0 = (24,71,192,151), 0, 정렬 0x11, 위 띠 0x10, 0, 제목 탭 1, 0)
 * 80486  0x802dc(gfx, 박스 2 = (29,93,182,104)) — 칠 #1D44A8 · 위·왼 선 #0A266F · 아래·오른 선 #5683F5
 * 80498  0xba19d(mode_ui 26, 0, 0)                                    ; 아래 막대 그림 (원점 (29,200))
 * 80566  탭 2: 0xb9e05(mode_ui 39, 박스 1 (24,72,46,18), 정렬 0x11, oy −2)   ; 2KEY·4KEY·6KEY·8KEY 탭 줄
 * 805a8  상태 ≠ 0x7b: 0xb9d35(gpoint 11, 박스 3 (29,200,73,18), 정렬 0x21, ox 2) ; G 동전
 * 80d34  mode_ui 29 vt+0x10(0, 0) — 다섯 칸 나무 (원점 (60,104))
 * 80d6a  [gfx+0x18c](초점) ≠ 0 || 틱 % 10 ≠ 0 → mode_ui 40(노랑 꺾쇠)을 (박스 1.x + 탭칸.x, 박스 1.y + 탭칸.y − 2) — 탭칸 = mode_ui 39 박스[행]
 * 80de4  박스 5~10 (mode_ui 29) 칠 RGB(0x87,0xF8,0xFF)                 ; 칸 잇는 줄
 * 80e1c  열 0~4: 칸 = mode_ui 29 박스[열] (`cellLookOf`) · 초점이면 커서 칸 테두리 · 글 번호 [sp+0x68] (`statusLabelOf`)
 * 811a6  초점 && 상태 ≠ 0x7b: 비용(`pitchTrainingWindowCostOf`) 0xba719(박스 3, 자간 1, 기준 0x14 주황, 정렬 0x24, ox −4) ·
 *        횟수 "n/필요" (`pitchTrainingWindowProgressOf`) — num 흰 숫자 0xb9d35(박스 5, 정렬 0x22, ox −10 · 0 "/"(101) · +10) ·
 *        img_text 260 "회"(박스 5, 정렬 0x24, ox −3)
 * 81392  글 번호 > 0 이면 img_text[번호](mode_ui 26 박스 4 (108,201,41,15), 정렬 0x22)
 * ```
 */

/** mode_ui 26 — 창 배치 프레임 (박스 0 판 · 1 제목 · 2 안쪽 · 3 비용 · 4 글 · 5 횟수) */
export const PITCH_TRAINING_LAYOUT_FRAME = 26
export const PITCH_TRAINING_PANEL = { x: 24, y: 71, width: 192, height: 151 } as const
/** 박스 2 — 0x802dc 가 칠하는 안쪽 */
export const PITCH_TRAINING_INNER = { x: 29, y: 93, width: 182, height: 104 } as const
/** 0x802dc 의 색 (0x1400748 인자 그대로) */
export const PITCH_TRAINING_INNER_COLORS = { fill: '#1D44A8', shade: '#0A266F', lit: '#5683F5' } as const
export const PITCH_TRAINING_COST_BOX = { x: 29, y: 200, width: 73, height: 18 } as const
export const PITCH_TRAINING_STATUS_BOX = { x: 108, y: 201, width: 41, height: 15 } as const
export const PITCH_TRAINING_COUNT_BOX = { x: 155, y: 200, width: 56, height: 18 } as const

/** 탭 줄 mode_ui 39 — 박스 1 (24,72) 에 oy −2 로 놓는다(정렬 0x11 은 0xb9d74 가 안 본다) */
export const PITCH_TRAINING_TAB_STRIP = { frame: 39, x: 24, y: 72 - 2 } as const
/** mode_ui 39 박스 — 프레임 기준 탭 칸 넷 */
const TAB_BOXES: readonly (readonly [number, number])[] = [[2, 3], [50, 3], [98, 3], [145, 3]]
/** 고른 탭 꺾쇠 mode_ui 40 (45×13) — (박스 1.x + 탭칸.x, 박스 1.y + 탭칸.y − 2) */
export const PITCH_TRAINING_TAB_MARK_FRAME = 40
export function tabMarkTopLeftOf(tab: number): { readonly x: number; readonly y: number } {
  const [x, y] = TAB_BOXES[tab] ?? TAB_BOXES[0]
  return { x: 24 + x, y: 72 + y - 2 }
}
/** 탭 누름 칸 — 탭칸 자리 그대로(45×16, 셋째만 44) */
export function tabPressRectOf(tab: number): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const [x, y] = TAB_BOXES[tab] ?? TAB_BOXES[0]
  return { x: PITCH_TRAINING_TAB_STRIP.x + x, y: PITCH_TRAINING_TAB_STRIP.y + y, width: tab === 2 ? 44 : 45, height: 16 }
}

/** mode_ui 29 — 칸 다섯 나무(박스 0~4 칸 · 5~10 잇는 줄) */
export const PITCH_TRAINING_TREE_FRAME = 29
export const PITCH_TRAINING_CELL_BOXES: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[] = [
  { x: 60, y: 104, width: 53, height: 15 },
  { x: 129, y: 104, width: 53, height: 15 },
  { x: 60, y: 132, width: 53, height: 15 },
  { x: 129, y: 132, width: 53, height: 15 },
  { x: 96, y: 172, width: 53, height: 15 },
]
export const PITCH_TRAINING_CONNECTORS: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[] = [
  { x: 84, y: 119, width: 3, height: 13 },
  { x: 155, y: 119, width: 3, height: 13 },
  { x: 84, y: 147, width: 3, height: 13 },
  { x: 155, y: 147, width: 3, height: 13 },
  { x: 87, y: 157, width: 68, height: 3 },
  { x: 120, y: 160, width: 3, height: 12 },
]
/** 0x80df4 — 0x1400748(0x87, 0xF8, 0xFF) */
export const PITCH_TRAINING_CONNECTOR_COLOR = '#87F8FF'
/** 칸 커서 — 칸을 (−1, −1, +1, +1) 로 넓혀 0xb9ed5 테두리 RGB(255,255,0) (0x810d8~0x8111a) */
export const PITCH_TRAINING_CURSOR_COLOR = '#FFFF00'

/** 칸 판 — 41 주황(지금 목록에 든 구질) · 42 흰(못 배운 칸) · 없음(배운 칸 — 나무의 파란 칸 그대로) */
export const PITCH_TRAINING_ORANGE_PLATE = 41
export const PITCH_TRAINING_WHITE_PLATE = 42
/** slt_pitch 프레임 21 "????" — 계열이 안 열린 히든 칸 (0x80f60 [pack+0x54]) */
export const HIDDEN_PITCH_NAME_FRAME = 21

/** 글 번호 — img_text 293 "배우기" · 296 "사용중" (0x125 · 0x128). 0x7b(123) 창은 295 "장착"을 쓴다 */
export const PITCH_TRAINING_LEARN_LABEL = 0x125
export const PITCH_TRAINING_IN_USE_LABEL = 0x128
/** img_text 260 "회" */
export const PITCH_TRAINING_TIMES_LABEL = 260
/** num 101 흰 "/" — 횟수 사이 */
export const PITCH_TRAINING_SLASH_IMAGE = 101

export interface PitchCellLook {
  /** 덮는 판 — null 이면 mode_ui 29 의 파란 칸 그대로 */
  readonly plate: number | null
  /** slt_pitch 프레임 — 구질 번호 − 1, 막힌 히든은 21 */
  readonly nameFrame: number
  /** 효과 0xb(단색) 색 — 배운 칸 흰색, 그 밖 검정 */
  readonly nameColor: '#FFFFFF' | '#000000'
}

/**
 * 칸 그림 (0x80e1c~0x810ac) — 열 0~3 은 칸(행·2 + 열%2) 단계 > 열/2 면 "배움", 열 4 는 그 행 cell0 단계 ≤ 1 이면 cell1 을 보고
 * 단계 > 2 면 "배움". 먼저 0xa436c(목록에 든 구질)이면 주황 판. 열 4 는 계열이 안 열렸으면 흰 판 + "????".
 */
export function cellLookOf(career: PitcherCareer, row: number, column: number): PitchCellLook {
  const typeNumber = pitchTypeNumberOf(row, column)
  const nameFrame = typeNumber - 1
  if (column === HIDDEN_PITCH_COLUMN && !isHiddenPitchRowOpen(career, row)) {
    return { plate: PITCH_TRAINING_WHITE_PLATE, nameFrame: HIDDEN_PITCH_NAME_FRAME, nameColor: '#000000' }
  }
  if (isInPitchList(career, typeNumber)) return { plate: PITCH_TRAINING_ORANGE_PLATE, nameFrame, nameColor: '#000000' }
  const isLearned = column === HIDDEN_PITCH_COLUMN
    ? stageOf(career, hiddenProgressCellOf(career, row)) > 2
    : stageOf(career, row * 2 + (column % 2)) > Math.trunc(column / 2)
  return isLearned
    ? { plate: null, nameFrame, nameColor: '#FFFFFF' }
    : { plate: PITCH_TRAINING_WHITE_PLATE, nameFrame, nameColor: '#000000' }
}

const stageOf = (career: PitcherCareer, cell: number) => career.pitchTrainingStages[cell] ?? 0
/** 열 4 의 칸 — cell0 단계가 1 이하면 cell1 (0x80e3c~0x80e58 · 0x81244~0x81262) */
const hiddenProgressCellOf = (career: PitcherCareer, row: number) => (stageOf(career, row * 2) <= 1 ? row * 2 + 1 : row * 2)

/**
 * 아래 글 (0x81120~0x8117e · 81392) — 초점이 칸에 있을 때 커서 칸만 본다. 처음 0x125 "배우기",
 * 목록에 든 구질이면 0x128 "사용중", 칸(행·2 + 열%2 — 열 4 도 보정 없이 cell0) 단계 > 열/2 면 108 은 −1(안 그림).
 * 초점이 탭 줄이면 처음 값 그대로 "배우기" 가 선다(원본 그대로).
 */
export function statusLabelOf(career: PitcherCareer, row: number, column: number, isCellFocus: boolean): number | null {
  if (!isCellFocus) return PITCH_TRAINING_LEARN_LABEL
  if (isInPitchList(career, pitchTypeNumberOf(row, column))) return PITCH_TRAINING_IN_USE_LABEL
  if (stageOf(career, row * 2 + (column % 2)) > Math.trunc(column / 2)) return null
  return PITCH_TRAINING_LEARN_LABEL
}

/**
 * 비용 (0x811b4~0x81206) — 커서 칸 번호를 **자르지 않고** /2 해 표 0xd46a2 [−300, −600, −1000] 의 절댓값.
 * 칸 5(아래 줄 오른쪽)도 2 라 1000 이다.
 */
export function pitchTrainingWindowCostOf(cellIndex: number): number {
  return pitchTrainingCostOf(Math.trunc(cellIndex / 2) * 2)
}

/**
 * 횟수 "n / 필요" (0x81224~0x8134e) — c = min(칸, 4), 칸 = 행·2 + c%2(c 가 4 면 히든 보정), 필요 = 0xd469e[c/2] = [2, 4, 5].
 * 목록에 든 구질이거나 단계 > c/2 면 "필요/필요", 단계 == c/2 면 그 칸 횟수, 그보다 낮으면 0.
 */
export function pitchTrainingWindowProgressOf(career: PitcherCareer, row: number, column: number): { readonly count: number; readonly required: number } {
  const required = pitchTrainingRequiredSessionsOf(column)
  const cell = column === HIDDEN_PITCH_COLUMN ? hiddenProgressCellOf(career, row) : row * 2 + (column % 2)
  const stage = stageOf(career, cell)
  const half = Math.trunc(column / 2)
  if (isInPitchList(career, pitchTypeNumberOf(row, column)) || stage > half) return { count: required, required }
  return { count: stage === half ? pitchTrainingCountOf(career, cell) : 0, required }
}

/** 칸 커서 → 열 (0x810c0~0x810d0 `min(칸, 4)`) */
export const cellColumnOf = (cellIndex: number) => Math.min(cellIndex, HIDDEN_PITCH_COLUMN)

/** 깜빡임 — 0xca911(틱, 10) ≠ 0 (상태 틱 [장면+0x2c]) */
export const isPitchTrainingBlinkOn = (tick: number) => tick % 10 !== 0

/**
 * 격자 둘 — 창 생성 0x7b5e0~0x7b63c: 탭 [gfx+0x190] = new(0x28) 0x6bd7d vt+0x10(4, 1, 1, 0x330),
 * 칸 [gfx+0x194] = new(0x3c) 0x6c219 vt+0x1c(2, 3, 1, 0x30). 칸 번호 = 줄 × 2 + 칸 — 4 · 5 는 아래 가운데 칸 하나(min 4).
 */
export const PITCH_TRAINING_TAB_GRID: AnnalsGridShape = {
  columns: 4, rows: 1, wrapsColumns: true, wrapsRows: true, carriesRowOnColumnWrap: true, carriesColumnOnRowWrap: true,
}
export const PITCH_TRAINING_CELL_GRID: AnnalsGridShape = { columns: 2, rows: 3, wrapsColumns: true, wrapsRows: true }

export interface PitchTrainingCursor {
  /** [gfx+0x18c] — 0 탭 줄 · 1 칸 */
  readonly isCellFocus: boolean
  /** 탭 격자 칸 = 표 0xcc390 의 행(계열) */
  readonly tab: number
  /** 칸 격자 칸 0~5 */
  readonly cell: number
}

/** 진입 0x17730 — 0x80234 가 두 격자를 (0, 0) 으로, 초점 0 (탭 2 는 커서를 더 건드리지 않는다) */
export const PITCH_TRAINING_START: PitchTrainingCursor = { isCellFocus: false, tab: 0, cell: 0 }

export type PitchTrainingKey = AnnalsDirection | 'ok' | 'clr'

/** 웹 키 → 원본 키. 숫자 '2' '4' '6' '8' 은 격자(숫자키 꼴 1)가 ↑ ← → ↓ 로 읽고, '5' 는 OK 다 */
export function pitchTrainingKeyOf(key: string): PitchTrainingKey | null {
  if (key === 'ArrowUp' || key === '2') return 'up'
  if (key === 'ArrowDown' || key === '8') return 'down'
  if (key === 'ArrowLeft' || key === '4') return 'left'
  if (key === 'ArrowRight' || key === '6') return 'right'
  if (key === 'Enter' || key === '5') return 'ok'
  if (key === 'Escape' || key === 'Backspace') return 'clr'
  return null
}

export type PitchTrainingKeyOutcome =
  | { readonly kind: 'move'; readonly cursor: PitchTrainingCursor }
  /** 0x17912 칸 가드 — (행, 열) 을 고른다 */
  | { readonly kind: 'confirm'; readonly row: number; readonly column: number }
  /** 취소 → 107 (17a76 `0xbcb49(0x6b)`) */
  | { readonly kind: 'close' }

/**
 * 키 0x17828 (탭 2) → 창 키 0x80268:
 * ```
 * OK(−5 · '5')  초점 0 이면 초점 = 1 (칸 커서는 그대로, 17918~17922) · 1 이면 칸 가드(행, min(칸, 4))
 * CLR(−16)      초점 1 이면 초점 = 0 (17a64~17a74) · 0 이면 → 107
 * 그 밖 초점 0   '8' · ↓ → 초점 = 1 · 칸 격자 vt+0x14(0, 0) · 아니면 탭 격자 키 (↑ · '2' 는 0x330 감기로 왼쪽 탭)
 * 그 밖 초점 1   칸 줄 == 0 이고 '2' · ↑ → 초점 = 0 · 아니면 칸 격자 키
 * ```
 */
export function pitchTrainingKeyOutcomeOf(cursor: PitchTrainingCursor, key: PitchTrainingKey): PitchTrainingKeyOutcome {
  if (key === 'ok') {
    if (!cursor.isCellFocus) return { kind: 'move', cursor: { ...cursor, isCellFocus: true } }
    return { kind: 'confirm', row: cursor.tab, column: cellColumnOf(cursor.cell) }
  }
  if (key === 'clr') return cursor.isCellFocus ? { kind: 'move', cursor: { ...cursor, isCellFocus: false } } : { kind: 'close' }
  if (!cursor.isCellFocus) {
    if (key === 'down') return { kind: 'move', cursor: { ...cursor, isCellFocus: true, cell: 0 } }
    return { kind: 'move', cursor: { ...cursor, tab: moveGridCursor(PITCH_TRAINING_TAB_GRID, cursor.tab, key) } }
  }
  if (key === 'up' && cursor.cell < PITCH_TRAINING_CELL_GRID.columns) return { kind: 'move', cursor: { ...cursor, isCellFocus: false } }
  return { kind: 'move', cursor: { ...cursor, cell: moveGridCursor(PITCH_TRAINING_CELL_GRID, cursor.cell, key) } }
}
