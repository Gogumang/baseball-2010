/**
 * 필살타법 창 원본 배치 — binary.mod 0x803d4 (칸 그리기 0x805a8~0x807be, layout-re 3·4차, 바이트 확인).
 * 나만의리그 장면 위에 뜨는 창이라 관리 화면을 덮는다.
 */

/** 창 틀 — mode_ui f26 박스0, 제목칸 박스1 */
export const SPECIAL_SWING_WINDOW = { x: 24, y: 71, width: 192, height: 151 } as const
export const TITLE_BOX = { x: 24, y: 72, width: 46, height: 18 } as const
/** img_text 115 "필살타법" (투수는 114 "마구훈련") 을 팔레트3(남색)으로 */
export const TITLE_FRAME = 115

/** f26 합성 그림 — 아래 칸 막대 세 개. 원점이 (29,200) 이다 */
export const FRAME_IMAGE = { frame: 26, x: 29, y: 200 } as const

/** 필살 칸 — mode_ui f27 박스0~3 */
export const SLOT_SIZE = { width: 33, height: 34 } as const
export const SLOT_XS: readonly number[] = [37, 82, 127, 172]
export const SLOT_Y = 99
export const SLOT_COUNT = 4

/** 칸 아이콘 — mode_icon 15 (투수는 19). 33×33 이라 칸 가운데면 좌상단이 그대로다 */
export const SLOT_ICON_FRAME = 15

/** img_text 294 "LV" 를 오른쪽 아래 정렬(0x44)에서 dx −8 · dy −2 */
export const LEVEL_LABEL_FRAME = 294
export const LEVEL_LABEL_OFFSET = { x: -8, y: -2 } as const
/** 레벨 숫자는 num 주황. 오른쪽 아래 정렬에서 첫 칸만 dx −2, 나머지는 −1, dy −1 */
export const LEVEL_DIGIT_OFFSET = { firstSlotX: -2, x: -1, y: -1 } as const

/** 커서 테두리는 10갱신 중 9갱신 동안 보인다 */
export const CURSOR_BLINK_PERIOD = 10
export const CURSOR_VISIBLE_UPDATES = 9

/** 이름칸 f27 박스4 · 설명칸 박스5 */
export const NAME_BOX = { x: 37, y: 143, width: 167, height: 14 } as const
export const DESCRIPTION_BOX = { x: 37, y: 162, width: 167, height: 35 } as const

/** 아래칸 — f26 박스5 에 숫자와 img_text 260 "회" (박스3·4 에 무엇이 들어가는지는 미해독이라 비워 둔다) */
export const COUNT_BOX = { x: 155, y: 200, width: 56, height: 18 } as const
export const COUNT_LABEL_FRAME = 260
export const COUNT_LABEL_OFFSET_X = 10
export const COUNT_DIGIT_OFFSET_X = -10

/**
 * 해금된 칸 수 (원본은 데이터 +0x201). 웹에는 그 값이 없어 "지금 레벨 + 1" 로 둔다 (추정) —
 * 다음에 훈련할 칸까지는 보이고 그 뒤는 잠긴다.
 */
export function unlockedSlotCountOf(level: number): number {
  return Math.min(level + 1, SLOT_COUNT)
}
