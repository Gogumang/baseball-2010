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
const TAB_BOXES: readonly (readonly [number, number])[] = [
  [2, 3],
  [50, 3],
  [98, 3],
  [145, 3],
]
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

/** 글 번호 — img_text 293 "배우기" · 295 "장착" · 296 "사용중" (0x125 · 0x127 · 0x128). 0x7b(123) 창의 처음 값이 0x127 이다 */
export const PITCH_TRAINING_LEARN_LABEL = 0x125
export const PITCH_WINDOW_EQUIP_LABEL = 0x127
export const PITCH_TRAINING_IN_USE_LABEL = 0x128
/** img_text 260 "회" */
export const PITCH_TRAINING_TIMES_LABEL = 260
/** num 101 흰 "/" — 횟수 사이 */
export const PITCH_TRAINING_SLASH_IMAGE = 101
