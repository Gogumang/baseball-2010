/**
 * 홈런더비 결과 화면 배치 — 그리기 `0x45c18` (경기 상태 0x1a).
 * 근거: `docs/re/R14-game-side-screens.md` 1절 (**확정** — 좌표·프레임까지 디스어셈으로 읽었다).
 *
 * ```
 * 창 0x55e60(W/2, H/2, 176, 213)                  → (32, 54, 176, 213)
 * game_ui 이미지 30 "RESULT"(56×7) → (W/2 − 33, H/2 − 99)
 * 칸 A 0x5eec4(162×84, 위끝 H/2 − 85)              → (39, 75)
 *   img_text 253 "홈런더비"(45×10)  (W/2 − 70, H/2 − 82)
 *   img_text 243 "총 기회"   · 244 "최대 콤보" · 247 "현재 비거리" · 248 "최고 비거리"
 *     (W/2 − 69, H/2 − 65 / −49 / −33 / −17)
 *   값 바탕 game_ui 프레임 40(58×15) (W/2 + 15, H/2 − 68 + 16i)
 *   단위 img_text 260 "회" · 249 "M" (W/2 + 59, H/2 − 66 + 16i)
 *   값 칸 (W/2 + 15, H/2 − 66 + 16i, 42, 12) 오른쪽 정렬
 * 칸 B 0x5eec4(162×44, 위끝 H/2 + 4)               → (39, 164)
 *   img_text 256 "획득" · 257 "보유" (W/2 − 66, H/2 + 12 / +32) · 252 "GP" (W/2 − 37, 같은 y)
 *   G 숫자 0x54a60 (W/2 − 11, H/2 + 9 / +29, 85×16)
 * 칸 C 0x5eec4(162×49, 위끝 H/2 + 53)              → (39, 213)
 *   StrMAINMENU[53] "재도전하시겠습니까?" (W/2 − 81, H/2 + 61) 폭 162 흰색
 *   popup 프레임 1·2(41×15, 고르면 6·7) (W/2 − 81 − 41/2 + 0x30 · +0x72, H/2 + 53 − 15/2 + 0x24)
 * ```
 */

const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320
const CENTER_X = SCREEN_WIDTH / 2
const CENTER_Y = SCREEN_HEIGHT / 2

/** 공용 창 0x55e60 — 176×213, 화면 한가운데 */
export const RESULT_WINDOW = {
  x: CENTER_X - 88,
  y: CENTER_Y - 106,
  width: 176,
  height: 213,
} as const

/** game_ui **이미지**(프레임 아님) 30 = "RESULT" 56×7 */
export const RESULT_TITLE = { image: 30, x: CENTER_X - 33, y: CENTER_Y - 99, width: 56, height: 7 } as const

/** 칸 A — 총 기회 / 최대 콤보 / 현재 비거리 / 최고 비거리 */
export const STAT_BOX = { x: CENTER_X - 81, y: CENTER_Y - 85, width: 162, height: 84 } as const

/** 칸 제목 "홈런더비" — img_text 프레임 253 */
export const STAT_BOX_TITLE = { frame: 253, x: CENTER_X - 70, y: CENTER_Y - 82 } as const

/** 줄 간격 16 (0x45e90 루프, 4바퀴) */
export const STAT_ROW_STEP = 16

/** 값 바탕 game_ui 프레임 40 (58×15) */
export const STAT_VALUE_PLATE = { frame: 40, x: CENTER_X + 15, firstY: CENTER_Y - 68, width: 58, height: 15 } as const

/** 값 칸 — 42×12, 오른쪽 정렬 */
export const STAT_VALUE_BOX = { x: CENTER_X + 15, firstY: CENTER_Y - 66, width: 42, height: 12 } as const

/** 단위 그림 자리 (10×10) */
export const STAT_UNIT_X = CENTER_X + 59

/** 네 줄 — 딱지 프레임과 단위 프레임 (img_text) */
export const STAT_ROWS = [
  { label: 243, name: '총 기회', unit: 260, unitName: '회' },
  { label: 244, name: '최대 콤보', unit: 260, unitName: '회' },
  { label: 247, name: '현재 비거리', unit: 249, unitName: 'M' },
  { label: 248, name: '최고 비거리', unit: 249, unitName: 'M' },
] as const

export const STAT_LABEL_X = CENTER_X - 69
export const STAT_LABEL_FIRST_Y = CENTER_Y - 65

export const statLabelTopOf = (row: number) => STAT_LABEL_FIRST_Y + STAT_ROW_STEP * row
export const statPlateTopOf = (row: number) => STAT_VALUE_PLATE.firstY + STAT_ROW_STEP * row
export const statValueTopOf = (row: number) => STAT_VALUE_BOX.firstY + STAT_ROW_STEP * row

/** 칸 B — 획득 GP / 보유 GP */
export const POINT_BOX = { x: CENTER_X - 81, y: CENTER_Y + 4, width: 162, height: 44 } as const

/** 두 줄 — img_text 256 "획득" · 257 "보유", 252 "GP" */
export const POINT_ROWS = [
  { label: 256, name: '획득', labelY: CENTER_Y + 12, valueY: CENTER_Y + 9 },
  { label: 257, name: '보유', labelY: CENTER_Y + 32, valueY: CENTER_Y + 29 },
] as const

export const POINT_LABEL_X = CENTER_X - 66
export const POINT_GP_FRAME = 252
export const POINT_GP_X = CENTER_X - 37
/** 0x54a60 알약 — (W/2 − 11, y, 0x55, 0x10) */
export const POINT_VALUE_BOX = { x: CENTER_X - 11, width: 0x55, height: 0x10 } as const

/** 칸 C — 재도전 묻기 */
export const RETRY_BOX = { x: CENTER_X - 81, y: CENTER_Y + 53, width: 162, height: 49 } as const

/** StrMAINMENU[53] 원문 — 표 자체가 웹에 없어 문구만 옮겨 적는다 */
export const RETRY_QUESTION = '재도전하시겠습니까?'
export const RETRY_TEXT = { x: CENTER_X - 81, y: CENTER_Y + 61, width: 162 } as const

const POPUP_BUTTON = { width: 41, height: 15 }
const RETRY_BUTTON_Y = RETRY_BOX.y - Math.trunc(POPUP_BUTTON.height / 2) + 0x24
const RETRY_BUTTON_BASE_X = RETRY_BOX.x - Math.trunc(POPUP_BUTTON.width / 2)

/**
 * 예/아니오 단추 — popup 프레임 1·2 가 보통, 6·7 이 골라진 모습이다.
 * 두 단추의 x 차는 0x72 − 0x30 = 66 이다.
 */
export const RETRY_BUTTONS = [
  { answer: true, name: '예', frame: 1, selectedFrame: 6, x: RETRY_BUTTON_BASE_X + 0x30, y: RETRY_BUTTON_Y },
  { answer: false, name: '아니오', frame: 2, selectedFrame: 7, x: RETRY_BUTTON_BASE_X + 0x72, y: RETRY_BUTTON_Y },
] as const

/** 예/아니오 커서 기본값 = 예 (scene+0x17f9, R14 1-5) */
export const RETRY_DEFAULT_ANSWER = true

/**
 * G 숫자 글자 — `0x54a60` 이 쓰는 `ui/gpoint.pzx` 의 0~9 그림이다.
 * "1" 만 4px 이고 나머지는 8px 인 것은 `widgets/screen-frame` 이 이미 확인한 규칙이다.
 */
export const GAME_POINT_FOLDER = './sprites/gpoint'
export const GAME_POINT_GLYPH_HEIGHT = 8

export function gamePointGlyphsOf(value: number): { frame: number; width: number }[] {
  return [...String(Math.max(0, Math.trunc(value)))].map((digit) => ({
    frame: Number(digit),
    width: digit === '1' ? 4 : 8,
  }))
}
