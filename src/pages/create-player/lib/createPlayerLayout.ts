import { ORIGINAL_COLORS } from '@/shared/config/design'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import {
  BATTING_TYPE_NAMES, INFO_COLUMNS, INFO_ROW_HEIGHT, INFO_ROW_STEP, INFO_TOP,
  POSITION_NAMES, SIDE_NAMES, SKIN_NAMES,
} from '@/pages/management/lib/basicInfoLayout'
import type { RookieProfile } from '@/entities/career/model/playerCareer'
import { ROOKIE_BATTER_SLOT } from '@/entities/career/model/nariTeamRecord'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/**
 * 선수 등록 배치 (나만의리그 상태 0x66 — 진입 0x17360 · 갱신 0x16f28 · 그리기 **0x15f34**).
 * 근거: `docs/re/C-create-palette.md` C-4 "선수 등록 화면" · C-6 "등록 화면 배치" (확정).
 *
 * 원본은 등록 전용 화면을 따로 그리지 않는다 — 관리 화면 **기본정보 카드(0x15e20)** 를 그대로 그리고
 * 고른 줄의 값 칸에 **노란 깜빡이 커서**만 얹는다(0x15f34). 그래서 판·정보 칸 좌표는
 * `pages/management/lib/basicInfoLayout.ts` 것을 그대로 가져다 쓴다 (C-6 "웹 … 와 같은 숫자").
 */

/** 값을 고르는 줄 (이름 줄은 입력기라 따로 둔다) */
export type CreatePlayerRowId = '타입' | '포지션' | '손' | '피부'
/** 줄 선택 목록이 도는 다섯 줄 */
export type SelectableRowId = '이름' | CreatePlayerRowId
export type InfoCellId = '팀명' | '필살' | '타순' | SelectableRowId

/**
 * 줄 선택 목록 [this+0x74] 은 1×5 (0x17360):
 *   0 이름 · 1 타입 · 2 포지션/보직 · 3 손 · 4 피부.
 * 웹 화면의 위아래 이동 순서가 이 순서다 (예전 웹판은 포지션이 타입보다 앞이었다 — 원본과 달랐다).
 */
export const ROW_ORDER: readonly SelectableRowId[] = ['이름', '타입', '포지션', '손', '피부']

/**
 * 고른 줄의 안내 문구 — 원문 표 StrMODE 에서 읽는다(r216 화면 글 감사: 예전엔 줄바꿈 !N 을 " · " 로 이어 뜻만 옮겼다).
 * 번호는 그리기 0x15f34 161f4~16252 (점프표 0xcc6d8, 고른 줄 번호): 줄 0 → 3 · 1 → 모드 4 면 7(투수 8) · 2 → 4(5) ·
 * 3 → 9(10) · 4 → 11 · 5 → 6. 타자는 이름 [3] · 타입 [7] · 포지션 [4] · 손 [9] · 피부 [11] (투수는 `REGISTER_ROW_HINTS`).
 */
export const ROW_HINT_TEXT_IDS: Readonly<Record<string, number>> = { 이름: 3, 타입: 7, 포지션: 4, 손: 9, 피부: 11 }

export const ROW_HINTS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(ROW_HINT_TEXT_IDS).map(([row, id]) => [row, ORIGINAL_MODE_TEXT[id] ?? '']),
)

/** 한 줄의 선택지와 그 값이 앉는 자리 */
export interface RowChoice {
  readonly options: readonly string[]
  readonly valueOf: (profile: RookieProfile) => number
  readonly replaced: (profile: RookieProfile, value: number) => RookieProfile
}

/**
 * 고를 수 있는 줄 → 선택지와 레코드 칸 (C-4 표, 선수 레코드 +0xb):
 *   타입 [0x7c] bit5-7 · 포지션 [0x78] bit0-1 · 손 [0x80] bit4 · 피부 [0x84] bit2-3.
 * 이름표 문자열은 0x1400258 타입 · 0x1400248 보직 · 0x1400238 손 · 0x140022c 피부.
 */
export const CHOICES: Readonly<Record<CreatePlayerRowId, RowChoice>> = {
  타입: {
    options: BATTING_TYPE_NAMES,
    valueOf: (profile) => profile.battingTypeIndex,
    replaced: (profile, value) => ({ ...profile, battingTypeIndex: value }),
  },
  포지션: {
    options: POSITION_NAMES,
    valueOf: (profile) => profile.positionIndex,
    replaced: (profile, value) => ({ ...profile, positionIndex: value }),
  },
  손: {
    options: SIDE_NAMES,
    valueOf: (profile) => profile.battingSide,
    replaced: (profile, value) => ({ ...profile, battingSide: value }),
  },
  피부: {
    options: SKIN_NAMES,
    valueOf: (profile) => profile.skinIndex,
    replaced: (profile, value) => ({ ...profile, skinIndex: value }),
  },
}

/** 값 한 칸 옮기기 — 목록 끝에서 돈다 (원본 목록 vtable 의 좌우 키와 같다) */
export function choiceStepped(profile: RookieProfile, id: CreatePlayerRowId, step: number): RookieProfile {
  const choice = CHOICES[id]
  const next = (choice.valueOf(profile) + step + choice.options.length) % choice.options.length
  return choice.replaced(profile, next)
}

export interface InfoCell {
  readonly id: InfoCellId
  /** 이름표 그림 (img_text 프레임) */
  readonly labelFrame: number
  readonly label: { readonly x: number; readonly width: number }
  readonly value: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  /** 줄 선택 목록에서 몇 번인가. 커서가 가지 않는 칸(팀명·필살·타순)은 null (C-6) */
  readonly rowIndex: number | null
}

/**
 * 정보 칸 8개 (0x7c450) — 1열 팀명·이름·타입·필살 / 2열 보직·손·피부·타순.
 * 줄 간격 17, 칸 높이 15, 첫 줄 y 184.
 */
const CELL_IDS: readonly (readonly InfoCellId[])[] = [
  ['팀명', '이름', '타입', '필살'],
  ['포지션', '손', '피부', '타순'],
]

export const INFO_CELLS: readonly InfoCell[] = INFO_COLUMNS.flatMap((column, columnIndex) =>
  column.labelFrames.map((labelFrame, row) => {
    const id = CELL_IDS[columnIndex][row]
    const rowIndex = ROW_ORDER.findIndex((rowId) => rowId === id)
    return {
      id,
      labelFrame,
      label: column.label,
      value: {
        x: column.value.x,
        y: INFO_TOP + row * INFO_ROW_STEP,
        width: column.value.width,
        height: INFO_ROW_HEIGHT,
      },
      rowIndex: rowIndex === -1 ? null : rowIndex,
    }
  }),
)

/** 줄 번호 → 그 줄의 값 칸 */
export function valueBoxOf(rowIndex: number): InfoCell['value'] {
  const cell = INFO_CELLS.find((candidate) => candidate.rowIndex === rowIndex)
  if (cell === undefined) throw new Error(`선수 등록에 없는 줄입니다: ${rowIndex}`)
  return cell.value
}

/**
 * 커서 사각형 = 값 칸을 사방 1px 키운 것 (0x16038 `(값상자.x−1, 값상자.y−1, w+2, h+2)`).
 * C-6 표와 같은 값이 나온다 — 이름 (59,200,83,17) · 타입 (59,217,83,17) ·
 * 포지션 (175,183,34,17) · 손 (175,200,34,17) · 피부 (175,217,34,17).
 */
export function cursorRectOf(rowIndex: number) {
  const box = valueBoxOf(rowIndex)
  return { x: box.x - 1, y: box.y - 1, width: box.width + 2, height: box.height + 2 }
}

/** 커서 색 = 0x1400748(0xff,0xff,0) 노랑 (유력) */
export const CURSOR_COLOR = ORIGINAL_COLORS.highlightYellow
/** 깜빡임 — 타이머 [this+0x2c] % 10 ≠ 0 일 때만 그린다 (0x16038) */
export const CURSOR_BLINK_PERIOD = 10
export function isCursorVisibleAt(tick: number): boolean {
  return tick % CURSOR_BLINK_PERIOD !== 0
}

/**
 * 정보 칸 그림 = mode_ui.pzx 프레임 **2(타자) / 1(투수)** (0x15f64).
 * 두 프레임 모두 원점이 (60,184) 이라 FrameSprite 에 (0,0) 으로 넘기면 제자리에 놓인다.
 * (프레임 0 은 PNG 가 없다 — 그림 없이 그림칸·오른쪽 판 **박스만** 가진 배치 프레임이다.)
 */
export const INFO_FRAME = { batter: 2, pitcher: 1 } as const

/**
 * 고른 줄 화살표 (0x160a8~0x160e0, 직접 떴다). 그림은 [장면+0xec] = `ui/mode_ui.pzx`(나리 진입 0x13f08 · 0x11910 이 싣는다)의
 * 프레임 목록 +0x60 = **프레임 24**(5×8 왼쪽 화살, 원점 (0,0)). 고른 줄이 0(이름)이 아니면 값 칸 상자 R(박스 4, 커서 사각형의 안쪽)에
 * ```
 * 0xb9e05(프레임 24, R, 정렬 0x21, 효과 0)                 ; 왼쪽 화살 — 정렬 비트 0x1 은 0xb9d74 가 안 봐 x = R.x
 * 0xb9e05(프레임 24, R, 정렬 0x24, 효과 0x11, x 이동 = 폭)  ; 뒤집은 오른쪽 화살 — x = R.x + R.w − 폭 + 폭 = R.x + R.w
 * ```
 * 세로 0x20 은 `(d >> 1) + d % 2`, d = R.h − 8 (15 → 4). 뒤집기 0x11 은 왼쪽 끝을 그대로 두고 그린다(환경설정 화살과 같은 쓰임).
 * 곧 왼쪽 화살은 값 칸 **안** 왼쪽 끝에, 오른쪽 화살은 값 칸 바로 **바깥** 오른쪽에 선다(원본 그대로).
 */
export const ARROW = { image: assetUrl('./sprites/mode_ui/frames/024.png'), width: 5, height: 8 } as const

/** 화살 자리 — `step` < 0 왼쪽 · > 0 오른쪽 */
export function arrowTopLeftOf(box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }, step: number) {
  const d = box.height - ARROW.height
  return { x: step < 0 ? box.x : box.x + box.width, y: box.y + (d >> 1) + (d % 2) }
}

/** 선수 미리보기 자세 — 대기 애니 첫 칸 (batterLayersOf 의 프레임 0) */
export const FIGURE_POSE_FRAME = 0

/**
 * 등록 화면의 타순 칸 = **8** — 등록 화면에 타순 선택은 없고(C-4 확정), 생성 0x17360 이 타자면 레코드 +0xa 에
 * **0xa7** 을 쓴다(0x17646~0x1764c). 정보 칸 그리기는 `0xb6395(레코드) + 1` 을 찍는다(0x7cf78~0x7cf80) — 아래 5비트 7 → 8번.
 */
export const ROOKIE_BATTING_ORDER = ROOKIE_BATTER_SLOT + 1
