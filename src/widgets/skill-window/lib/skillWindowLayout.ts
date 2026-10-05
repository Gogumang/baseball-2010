/**
 * 아이템/스킬 창 배치 — 선수정보 칸 "아이템/스킬"(하위 상태 122), 창 종류 `[win+0x1a4]` = **0**.
 *
 * 그리기는 0x19ee0 → 0x8453c → **0x81dc0**(창 객체 0x7b7b8, 그림 `[win+0x138]` = ui/mode_ui.pzx).
 * 종류 0 은 탭 둘(스킬 · 서브아이템)을 가진 창이다 — 상점(종류 1·2·3)과 같은 함수를 타고 머리·칸만 갈린다.
 *
 * 박스는 mode_ui 프레임 33·34·35 의 박스(0x94a65)를 decode_pzx 로 읽은 값이다 (그림 없는 배치 프레임).
 *   프레임 33  0 창 (24,48,192,212) · 1 왼쪽 탭 · 2 오른쪽 탭 · 3 이름 딱지 · 4 설명 · 5 값 칸
 *   프레임 35  스킬 칸 12개 41×25 — x 34·78·122·166, y 71·100·129 (4열 × 3행)
 *   프레임 34  서브아이템 칸 10개 33×33 — x 34·69·104·139·174, y 77·115 (5열 × 2행)
 */
import { ORIGINAL_COLORS } from '@/shared/config/design'

export interface LayoutBox {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

const box = (x: number, y: number, width: number, height: number): LayoutBox => ({ x, y, width, height })

/** 프레임 33 박스 0~5 */
export const WINDOW_BOX = box(24, 48, 192, 212)
export const TAB_BOXES: readonly LayoutBox[] = [box(26, 50, 92, 15), box(122, 50, 92, 15)]
export const NAME_BOX = box(33, 163, 75, 15)
export const DESCRIPTION_BOX = box(33, 180, 174, 65)

/** 프레임 35 박스 0~11 — 스킬 칸 */
const SKILL_CELL_XS = [34, 78, 122, 166]
const SKILL_CELL_YS = [71, 100, 129]
export const SKILL_CELL_BOXES: readonly LayoutBox[] = SKILL_CELL_YS.flatMap((y) => SKILL_CELL_XS.map((x) => box(x, y, 41, 25)))

/** 프레임 34 박스 0~9 — 서브아이템 칸 */
const ITEM_CELL_XS = [34, 69, 104, 139, 174]
const ITEM_CELL_YS = [77, 115]
export const ITEM_CELL_BOXES: readonly LayoutBox[] = ITEM_CELL_YS.flatMap((y) => ITEM_CELL_XS.map((x) => box(x, y, 33, 33)))

/**
 * 목록 객체 셋 (0x7b7b8 이 만든다 — 0x198 은 0x6bd7d, 0x19c·0x248 은 굴림 격자 0x6c219).
 * 차원은 채우기 0x81618 의 vtable+0x1c(열, 행, 1, 0x30): 탭 (2,1) · 서브아이템 (5,2) · 스킬 (4, 행).
 * 깃발 0x30 = 비트4·5 → **가로·세로 모두 같은 줄 안에서 감는다** (0x6beac, 다음 줄로 넘기는 0x100·0x200 은 없음).
 */
export const TAB_COUNT = 2
export const SKILL_COLUMNS = 4
/** 스킬 격자의 보이는 행 = 목록 +0x38 (0x81708 `movs r3,#3`) · 보이는 열 +0x34 = 4 */
export const SKILL_VISIBLE_ROWS = 3
export const ITEM_COLUMNS = 5
export const ITEM_ROWS = 2

/** 목록에 넣는 스킬 번호 0~23 — 채우기 0x81618 의 `cmp r4,#0x17` */
const LAST_LISTED_SKILL_ID = 23

/**
 * 스킬 목록 = `[win+0x1e4]` (s32 × 24, 처음엔 모두 −1). 0x81618 이 **0 부터 23 까지 차례로** 보유(0xa3a74)를 보고
 * 가진 번호를 앞에서부터 채운다 → **얻은 차례가 아니라 번호 차례**다. 장착 여부는 목록에 안 들어간다(그리기가 본다).
 */
export function skillListOf(skillIds: readonly number[]): readonly number[] {
  return Array.from({ length: LAST_LISTED_SKILL_ID + 1 }, (_unused, id) => id).filter((id) => skillIds.includes(id))
}

/** 스킬 격자 행 수 — `ceil(개수 / 4)` 이고 3 보다 작으면 3 (0x816c2~0x816e6) */
export function skillGridRowsOf(count: number): number {
  return Math.max(SKILL_VISIBLE_ROWS, Math.ceil(count / SKILL_COLUMNS))
}

export interface GridCursor {
  readonly column: number
  readonly row: number
}

export type GridDirection = 'up' | 'down' | 'left' | 'right'

/**
 * 방향 키 하나 — 0x6be70(−3 왼 · −4 오른 · −1 위 · −2 아래) → 0x6beac.
 * 깃발 0x30 이라 끝에서 같은 줄 반대쪽으로 감는다(`(칸 + d + 칸수) % 칸수`). 빈 칸에도 선다 — 막힘 표 +0x28 은
 * 0x6c4bc 가 모두 1 로 채운다.
 */
export function moveGridCursor(cursor: GridCursor, direction: GridDirection, columns: number, rows: number): GridCursor {
  const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0
  const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0
  return {
    column: (cursor.column + dx + columns) % columns,
    row: (cursor.row + dy + rows) % rows,
  }
}

/**
 * 굴림 0x6c2bd (vtable+0x20) — 커서가 보이는 칸 밖으로 나가면 **겨우 보이게만** 맨 윗행을 옮긴다.
 *   행 < 윗행 → 윗행 = 행 · 행 ≥ 윗행 + 3 → 윗행 = 행 − 3 + 1
 */
export function scrolledTopRowOf(topRow: number, cursorRow: number): number {
  if (cursorRow < topRow) return cursorRow
  if (cursorRow >= topRow + SKILL_VISIBLE_ROWS) return cursorRow - SKILL_VISIBLE_ROWS + 1
  return topRow
}

/** 칸 → 목록 번호 0x85ad0: `열 + 열수 × 행` */
export const gridIndexOf = (cursor: GridCursor, columns: number) => cursor.column + columns * cursor.row

/**
 * 칸 바탕 그림 — mode_ui 프레임 (0x82ee2~0x82f8e).
 *   장착 안 됨(0xa4bf8 = 0) → 49 회색. 장착이면 0x5f350(표, s) 비트로 갈린다:
 *   비트0(0·1·8~16) → 46 파랑 · 비트1(2~5·17~20, 마이너스) → 47 주황 · 그 밖(6·7·21~23) → 48 보라.
 * 빈 칸(목록 끝 뒤)도 49 를 그리지만 칸을 1px 줄인 박스에 가운데 맞춤이라 자리가 다르다 → `EMPTY_CELL_OFFSET`.
 */
export const CELL_FRAME = { 파랑: 46, 주황: 47, 보라: 48, 회색: 49, 커서: 50 } as const

/** 0x5f350(표, s) — s ≤ 1 · 8~16 → 1 · 2~5 · 17~20 → 2 · 나머지 → 4 (0x10/0x20 OR 은 여기서 안 쓴다) */
export function skillAttributeOf(skillId: number): 1 | 2 | 4 {
  if (skillId <= 1 || (skillId >= 8 && skillId <= 16)) return 1
  if ((skillId >= 2 && skillId <= 5) || (skillId >= 17 && skillId <= 20)) return 2
  return 4
}

export function skillCellFrameOf(skillId: number, isEquipped: boolean): number {
  if (!isEquipped) return CELL_FRAME.회색
  const attribute = skillAttributeOf(skillId)
  return attribute === 1 ? CELL_FRAME.파랑 : attribute === 2 ? CELL_FRAME.주황 : CELL_FRAME.보라
}

/**
 * 빈 칸 0x8302e: 박스를 (w−1, h−1) = 40×24 로 줄이고 41×25 프레임 49 를 0x22 로 가운데 맞춘다.
 * 0xb9d74 의 가로는 `floor((40−41)/2) = −1`, 세로는 `trunc + 나머지` 꼴이라 `(−1 >> 1) + (−1) = −2` 다.
 */
export const EMPTY_CELL_OFFSET = { x: -1, y: -2 } as const

/** 플러스/마이너스 표시 애니메이션 — mode_ui 애니 1(프레임 61 위로 깜빡) · 2(62 아래로), 자리 = 박스3 오른쪽 끝 − 20, 위 + 2 (0x83176~0x831b8) */
export const SKILL_SIGN_ANIMATION = { 플러스: 1, 마이너스: 2 } as const
export const SKILL_SIGN_POSITION = { x: NAME_BOX.x + NAME_BOX.width - 20, y: NAME_BOX.y + 2 } as const

/** mode_ui 프레임 — 탭 띠(36 왼쪽 탭이 흰 탭 · 37 오른쪽), 탭 꺾쇠 38 */
export const MODE_UI_FRAME = { 스킬탭띠: 36, 서브아이템탭띠: 37, 탭커서: 38 } as const

/** img_text 프레임 — 탭 이름 표 0xd4954 = [278 "스킬", 105 "서브아이템"], 딱지 149 "타자" · 150 "투수", 295 "장착" */
export const TAB_LABEL_FRAMES: readonly number[] = [278, 105]
export const SIDE_LABEL_FRAME = { 타자: 149, 투수: 150 } as const
export const EQUIP_LABEL_FRAME = 295

/**
 * 장착 수 줄 (0x82c76~0x82e2c) — 박스 3 을 기준으로 num 그림(20+n, "/" 127)을 효과 11(단색) **흰색**으로 찍는다.
 * 0xb9d35 → 0xb9c5c (그림): x = 박스x + dx 뒤 정렬(가로 가운데는 올림, 오른쪽은 x − (그림폭 − 박스폭)), y = 박스y + dy + trunc((15 − 높이)/2).
 *   장착 수  정렬 0x24(오른쪽) dx 81 (10 이면 '1' 을 dx 74, '0' 을 dx 81)  dy 3
 *   "/"      정렬 0x22(가운데) dx 122                                      dy 3
 *   상한     정렬 0x21(왼쪽)   dx 163 (10 이면 '1' 163 · '0' 167)            dy 3
 *   "장착"   img_text 295, 0xb9e05(프레임) 정렬 0x22, dx 95 − k(장착 수 > 9 면 5, 상한 > 9 면 5 더), dy 2
 */
export const EQUIP_COUNT_LAYOUT = {
  countRightDx: 81,
  countTenOneDx: 74,
  slashDx: 122,
  limitDx: 163,
  limitTenZeroDx: 167,
  digitDy: 3,
  labelDx: 95,
  labelDy: 2,
  wideShift: 5,
} as const

/** 0x81d0c 창 판 — 둥근(1) 검정 (x, y, w−1, h−1) → 둥근 흰 (x+1, y+1, w−3, h−3) → 채우기 #335FCD (x+2, y+2, w−4, h−4) */
export const WINDOW_COLORS = {
  outer: ORIGINAL_COLORS.black,
  inner: ORIGINAL_COLORS.text,
  fill: ORIGINAL_COLORS.boardFill,
} as const

export const SKILL_WINDOW_COLORS = {
  /** 고른 탭 글 #335FCD · 안 고른 탭 글 #5897FF (0x81f18~0x81f28) */
  tabOn: ORIGINAL_COLORS.boardFill,
  tabOff: ORIGINAL_COLORS.tabSelected,
  /** 박스 3 이름 딱지 (0x8225e~0x82396) */
  nameFill: ORIGINAL_COLORS.bandDark,
  nameEdge: ORIGINAL_COLORS.nameBoxEdge,
  nameHighlight: ORIGINAL_COLORS.nameBoxDot,
  /** 박스 4 설명 판 0x802dc — 채우기 #1D44A8, 위·왼 #0A266F, 아래·오른 #5683F5 */
  descriptionFill: ORIGINAL_COLORS.panelDeep,
  text: ORIGINAL_COLORS.text,
  shadow: ORIGINAL_COLORS.black,
  /** 서브아이템 칸 바탕 0x7e764(…, 0): 둥근 테 #041D52 · 채우기 #2033AA · 윗반 #3045CD */
  itemCellEdge: '#041D52',
  itemCellFill: '#2033AA',
  itemCellLight: '#3045CD',
  /** 서브아이템 커서 0x81824: 위·옆 윗반 RGB(255,255,8) · 옆 아랫반·아래 RGB(255,181,8) — 두께 2 */
  itemCursorUpper: '#FFFF08',
  itemCursorLower: '#FFB508',
} as const

/** 커서 깜빡임 — `0xca911(틱, 10) != 0` 일 때만 그린다 (탭 꺾쇠 0x81f68 · 스킬 칸 0x830b4 · 아이템 칸 0x8260a) */
export const isBlinkVisible = (update: number) => update % 10 !== 0

/**
 * 설명 박스 4 글 자리.
 *   스킬 (0x831e4~0x8323c): 소개 StrSKILL[표 번호] 를 (박스x + 3, 박스y + 3) · "효과 : !cFFFF00" + StrSKILL[40 + 표 번호]
 *   를 (박스x + 3, 박스y + 30), 둘 다 정렬 0x11 · 줄 너비는 박스 폭 174 그대로.
 *   서브아이템 (0x82a02 · 0x82b72): 박스를 (+3, +3, −6, −6) 으로 줄여 정렬 0x11 로 한 덩어리.
 * ⚠️ 글 엔진 0x6ef4d 의 줄 간격은 읽지 않았다 — 웹은 공용 MarkupText(14px) 를 쓴다 (근사).
 */
export const SKILL_TEXT_OFFSET = { x: 3, introY: 3, effectY: 30 } as const
export const ITEM_TEXT_INSET = 3
