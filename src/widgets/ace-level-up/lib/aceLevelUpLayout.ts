/**
 * **마선수 레벨업 창 그리기 `0x5f394`** 의 배치 (0x5f394~0x5fa08 직접 뜸 — 그리기 호출은 unicorn 으로 함수만 돌려 가로채 맞췄다).
 * W/2 = 120 · H/2 = 160 · x0 = W/2 − 0x60 = 24 이다.
 * ```
 * 5f424  공용 판 0x55e60(skin, W/2, H/2, 0xc0, 0xd4, 0, 정렬 0x22, 0, 0, 제목 탭 1, 어둡게 1)          ; (24, 54) 192×212
 * 5f48a  제목 img_text 375 "레벨업" 팔레트 3 — (x0 + 0x2d − (폭 >> 1), H/2 − 0x65)                    ; (54, 59)
 * 머리 줄 (y = H/2 − 0x63 = 61):
 * 5f4ec  slt_frame 프레임 45 (45×15) (W/2 + 0x1e, y)                                                 ; (150, 61)
 * 5f50c  slt_frame 이미지 108 (화살) (W/2 + 0x32, H/2 − 0x61)                                         ; (170, 63)
 * 5f566  img_text 376 "LV" 팔레트 0 — (x0 + 0x7a − 폭, H/2 − 0x61)                                    ; 오른쪽 끝 146
 * 5f58a  0x585ac(skin, num, 기준 0x14, 레벨 + 1, W/2 + 0x29, H/2 − 0x61, 간격 1, 자리 0, 정렬 2)       ; 가운데 161
 * 5f5ac  0x585ac(…, 레벨 + 2, W/2 + 0x40, …, 정렬 2)                                                 ; 가운데 184
 * 줄 i = 0..4 (y = H/2 − 0x4d + i · (45 프레임 높이 15 + 3) = 83 + 18i):
 * 5f61e  slt_frame 프레임 45 (x0 + 0x3f, y) · 5f640 이미지 108 (x0 + 0x72, y + 2) · 5f65e 프레임 45 (x0 + 0x7e, y)
 * 5f6b8  딱지 img_text 표[i] 팔레트 0 — (x0 + 0x3b − 폭, y + 3)                                      ; 오른쪽 끝 83
 *          표 0xd1c48 = 340 제구 · 341 구속 · 342 변화 · 343 체력 · 308 마구, 칸 > 4(마타자)면 336 · 337 · 338 · 339 · 115
 * 5f800  0x585ac(…, 지금 값, x0 + d + 0x3f, y + 2, 간격 1, 자리 0, 정렬 4) · 5f81e (…, 다음 값, x0 + d + 0x7e, …) ; 오른쪽 끝
 *          줄 0~3: d = 0x23 (오른쪽 끝 122 · 185), 값 = 능력치 · s8 0xd1734[lv] / 100 (0xca7b5)
 *          줄 4:   d = 0x17 (오른쪽 끝 110 · 173), 값 = 횟수 표 [lv] (마투수 0xd173e · 마타자 0xd1739)
 *          줄 4 만 img_text 260 "회" 를 (x0 + 45 + 0x2e, y + 2) · (x0 + 45 + 0x6c, y + 2) 에 더 긋는다
 * 5f878  안쪽 칸 0xbb28d(W/2, H/2 + 0x10, 0xae, 0x41, 정렬 2)                                        ; (33, 176) 174×65
 * 5f8de  비용 줄 0xba269(sprintf(StrCOMMON[0x31], 1000 · 0xd1724[lv]), W/2 − 0x52, H/2 + 0x24, 폭 0xa4) ; (38, 196) 폭 164
 * 버튼 (popup.pzx [[0x140005c]+4], y = H/2 − 0x6a − 15 + 0xce = 245):
 * 5f948  프레임 1 "예" (W/2 − 41 − 0xf, y) · 5f97c 프레임 2 "아니오" (W/2 + 0xf, y)                   ; (64, 245) · (135, 245)
 * 5f9f6  [skin+0x31e] ≠ 0 이면 프레임 6 을 "예" 자리에, 아니면 프레임 7 을 "아니오" 자리에 덧긋는다(원점 −4, −4)
 * ```
 * 창에 마선수 이름은 없다 — 이름 막대(0x64b40)는 목록 쪽 그림이다.
 */

export const ACE_LEVEL_UP_PANEL = { x: 24, y: 54, width: 0xc0, height: 0xd4 } as const

/** 제목 img_text 375 (팔레트 3) — 가운데 x = x0 + 0x2d, 위 59 */
export const ACE_LEVEL_UP_TITLE = { frame: 375, centerX: 24 + 0x2d, y: 160 - 0x65 } as const

/** slt_frame 프레임 45 (45×15) — 값 막대 · slt_frame 이미지 108 — 화살 */
export const ACE_LEVEL_UP_BAR_FRAME = 45
export const ACE_LEVEL_UP_BAR_HEIGHT = 15
export const ACE_LEVEL_UP_ARROW_IMAGE = 108

/** num 기준 이미지 0x14 — 주황 숫자 20~29 (1 만 폭 4, 나머지 6) */
export const ACE_LEVEL_UP_NUMBER_BASE = 0x14
const NUMBER_GAP = 1
const numberImageWidthOf = (digit: number) => (digit === 1 ? 4 : 6)

export interface AceLevelUpGlyph {
  readonly image: number
  readonly x: number
  readonly y: number
}

/**
 * 0x585ac 숫자(간격 1 · 자리 0) — 폭은 셋째 글자부터 간격을 더해 세고(0x58620), 정렬 2 면 폭 >> 1, 4 면 폭을 x 에서 뺀다.
 * 글자마다 폭 + 간격씩 나아간다.
 */
export function aceLevelUpNumberOf(value: number, x: number, y: number, align: 2 | 4): AceLevelUpGlyph[] {
  const digits = [...String(Math.max(0, Math.trunc(value)))].map(Number)
  const measured = digits.reduce((sum, digit, index) => sum + numberImageWidthOf(digit) + (index > 1 ? NUMBER_GAP : 0), 0)
  let left = x - (align === 2 ? measured >> 1 : measured)
  return digits.map((digit) => {
    const glyph = { image: ACE_LEVEL_UP_NUMBER_BASE + digit, x: left, y }
    left += numberImageWidthOf(digit) + NUMBER_GAP
    return glyph
  })
}

/** 머리 줄 — "LV" 오른쪽 끝 146 · 막대 (150, 61) · 화살 (170, 63) · 숫자 가운데 161 · 184 (y 63) */
export const ACE_LEVEL_UP_HEAD = {
  labelFrame: 376,
  labelRight: 24 + 0x7a,
  labelY: 160 - 0x61,
  bar: { x: 120 + 0x1e, y: 160 - 0x63 },
  arrow: { x: 120 + 0x32, y: 160 - 0x61 },
  currentCenterX: 120 + 0x29,
  nextCenterX: 120 + 0x40,
  numberY: 160 - 0x61,
} as const

/** 마투수 줄 딱지 표 0xd1c48 · 마타자 바꿔 넣기 (0x5f5c2~0x5f5d8) */
export const ACE_PITCHER_ROW_LABEL_FRAMES = [340, 341, 342, 343, 308] as const
export const ACE_BATTER_ROW_LABEL_FRAMES = [336, 337, 338, 339, 115] as const
/** 줄 4 의 "회" */
export const ACE_LEVEL_UP_TIMES_FRAME = 260

export interface AceLevelUpRowPlacement {
  readonly y: number
  readonly labelRight: number
  readonly labelY: number
  readonly currentBar: { readonly x: number; readonly y: number }
  readonly arrow: { readonly x: number; readonly y: number }
  readonly nextBar: { readonly x: number; readonly y: number }
  /** 0x585ac 정렬 4 — 오른쪽 끝 */
  readonly currentRight: number
  readonly nextRight: number
  readonly numberY: number
  /** 줄 4 의 "회" 두 자리 — 줄 0~3 은 없다 */
  readonly times: readonly { readonly x: number; readonly y: number }[]
}

const X0 = 24
const FIRST_ROW_Y = 160 - 0x4d
const ROW_STEP = ACE_LEVEL_UP_BAR_HEIGHT + 3
const BAR_WIDTH = 45

/** 줄 i (0..4) 의 자리 */
export function aceLevelUpRowOf(row: number): AceLevelUpRowPlacement {
  const y = FIRST_ROW_Y + row * ROW_STEP
  const d = row === 4 ? 0x17 : 0x23
  return {
    y,
    labelRight: X0 + 0x3b,
    labelY: y + 3,
    currentBar: { x: X0 + 0x3f, y },
    arrow: { x: X0 + 0x72, y: y + 2 },
    nextBar: { x: X0 + 0x7e, y },
    currentRight: X0 + d + 0x3f,
    nextRight: X0 + d + 0x7e,
    numberY: y + 2,
    times: row === 4 ? [{ x: X0 + BAR_WIDTH + 0x2e, y: y + 2 }, { x: X0 + BAR_WIDTH + 0x6c, y: y + 2 }] : [],
  }
}

/** 안쪽 칸 0xbb28d(W/2, H/2 + 0x10, 0xae, 0x41, 정렬 2) */
export const ACE_LEVEL_UP_COST_BOX = { x: 120 - (0xae >> 1), y: 160 + 0x10, width: 0xae, height: 0x41 } as const
/** 비용 줄 0xba269 — (W/2 − 0x52, H/2 + 0x24) 폭 0xa4 */
export const ACE_LEVEL_UP_COST_TEXT = { x: 120 - 0x52, y: 160 + 0x24, width: 0xa4 } as const

/** popup.pzx 버튼 — 보통 1 "예" · 2 "아니오", 고른 칸 6 · 7 (원점 −4, −4) */
export const ACE_LEVEL_UP_BUTTONS = [
  { label: '예', frame: 1, selectedFrame: 6, x: 120 - 41 - 0xf, y: 160 - 0x6a - 15 + 0xce },
  { label: '아니오', frame: 2, selectedFrame: 7, x: 120 + 0xf, y: 160 - 0x6a - 15 + 0xce },
] as const
export const ACE_LEVEL_UP_BUTTON_SIZE = { width: 41, height: 15 } as const
