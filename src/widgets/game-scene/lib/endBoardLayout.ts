/**
 * 경기 장면 상태 0x18 의 **경기 끝 결과 판** 배치 (그리기 0x4fe9c, R10 5절 확정).
 *
 * ```
 * 0x41440(경기, 0, 3, 0, 0, 0)                             점수판 틀 — `widgets/scoreboard-frame`
 * 점수 0xb69b0(st, 0/1) → (W/2 − 64, H/2 − 7) · (W/2 + 67, H/2 − 7)   숫자 0x585ac(…, 0x46, 값, x, y, 6, …, 2)
 * 투수 3줄 y = H/2 + 33 + i × (줄높이 + 1), 딱지 = 표 0xd0470 = img_text [388, 389, 329]
 *          이름 "!C!cffffff%s"(0xcf2e0) ← 0xb62c0(0xb8b60(팀[측], 번호)), 측 == 2 면 빈 줄
 * ```
 *
 * 정산 화면(0x4a384)과 한 장에 겹친 나만의리그 결과 화면(`pages/game-result`)도 이 자리를 그대로 쓴다.
 *
 * 결과 판 머리의 `0x41440(경기, 0, 3, 0, 0, 0)` 점수판 틀(game_ui 프레임 16 · PLAYER/COM · 로고 · 팀 이름)은
 * `widgets/scoreboard-frame` 이 그린다 (y = 3 은 0x4fed8 — 경기 끝이면 3, 교대 판이면 0).
 */

const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320

/** 경기 끝 판은 처음 **10틱** 동안 상태를 붙든다 — `경기+0x32 = (틱 ≤ 9)` (0x4f95a), OK 가 먹지 않는다 */
export const GAME_END_INPUT_LOCK_TICKS = 10

/**
 * 두 팀 점수 `0xb69b0(st, 0/1)` 을 (W/2 − 64, H/2 − 7) 과 (W/2 + 67, H/2 − 7) 에
 * (R10 5절 0x4fe9c 확정). 왼쪽이 측 0(초 = 원정), 오른쪽이 측 1(말 = 홈).
 * 웹은 `gameState.ts:24` 대로 **플레이어 팀이 홈(말)** 이라 오른쪽이 우리 점수다.
 *
 * 숫자는 50098 · 500e2 `0x585ad(skin, [[[장면+0x1014]+8]+8], 0x46, 값, x, y, 간격 6, 자리 0, 정렬 2, 0, 0)` —
 * [장면+0x1014] 는 ui/num.pzx(F 4절 0x330f0) 라 **num 이미지 0x46~0x4f(큰 파란 숫자, 30×36 안팎)** 다.
 * 수비 득점판 0x41a64(`pages/defense/lib/runScoreBoard`, 간격 8)와 같은 글꼴 · 같은 함수다.
 * 0x585ac: 폭 = Σ그림 폭 + **셋째 글자부터** 간격, 정렬 2 → x −= 폭/2, 세로는 y 그대로(왼쪽 위), 글자마다 폭 + 간격씩 나아간다.
 */
export const SCORE_SLOTS = {
  away: { x: SCREEN_WIDTH / 2 - 64, y: SCREEN_HEIGHT / 2 - 7 },
  home: { x: SCREEN_WIDTH / 2 + 67, y: SCREEN_HEIGHT / 2 - 7 },
} as const

/** num 이미지 기준 0x46 · 간격 6 (0x5009a `movs r3, #6`) */
export const SCORE_DIGIT_BASE = 0x46
const SCORE_GAP = 6
/** num 이미지 0x46~0x4f 의 폭 (public/sprites/num 070~079 그림 크기) */
const SCORE_DIGIT_WIDTHS = [32, 22, 29, 29, 32, 30, 30, 31, 30, 30] as const

export interface ScoreGlyph {
  /** num 이미지 번호 */
  readonly image: number
  readonly x: number
  readonly y: number
}

/** 0x585ad(…, 0x46, 값, x, y, 6, 0, 2) — 자리 0 이라 앞 0 을 채우지 않는다 */
export function endScoreGlyphsOf(value: number, slot: { readonly x: number; readonly y: number }): ScoreGlyph[] {
  const digits = String(Math.max(0, Math.trunc(value))).split('').map(Number)
  const measured = digits.reduce(
    (sum, digit, index) => sum + SCORE_DIGIT_WIDTHS[digit]! + (index > 1 ? SCORE_GAP : 0),
    0,
  )
  let left = slot.x - (measured >> 1)
  return digits.map((digit) => {
    const placed = { image: SCORE_DIGIT_BASE + digit, x: left, y: slot.y }
    left += SCORE_DIGIT_WIDTHS[digit]! + SCORE_GAP
    return placed
  })
}

/**
 * 승·패·세 투수 3줄 (0x4fe9c 50120~50246 직접 뜸). 바탕은 game_ui([장면+0x1018]) 프레임 0x5d(93, 54×15 = 딱지 칸) ·
 * 0x5e(94, 55×15 = 이름 칸), 줄높이 h = 프레임 0x5d 높이 15 (0xba815 상자):
 * ```
 * 50162  0xba759(game_ui, 0x5d, 1, W/2 − w₅d − 2, H/2 + 0x21 + i·(h + 1))          ; 딱지 칸 (64, 193 + 16i)
 * 5019c  0xba759(game_ui, 0x5e, 1, W/2,          H/2 + 0x21 + i·(h + 1))          ; 이름 칸 (120, …)
 * 50238  0xba759(img_text, 표 0xd0470[i], 1, W/2 − w₅d + w₅d/2 − w딱지/2 − 2, H/2 + 0x21 + i·(h + 1) + 3)
 * 502c4  이름 0xba269("!C!cffffff%s", W/2, 줄 위 + 2, 폭 w₅d(54), −1, 0)          ; 이름 칸 x 에서 폭 54 가운데
 * ```
 * 나눗셈은 0 쪽으로 버린다(asr + 부호 보정). 그림 원점은 셋 다 (0, 0) 이다(origins.json).
 */
export const PITCHER_ROWS = {
  count: 3,
  firstY: SCREEN_HEIGHT / 2 + 33,
  rowHeight: 15,
  /** 줄 간격 = 줄높이 + 1 */
  step: 16,
  labelPlate: { frame: 93, width: 54, height: 15 },
  namePlate: { frame: 94, width: 55, height: 15 },
} as const

/** 딱지 칸 x = W/2 − w₅d − 2 */
export const PITCHER_ROW_X = SCREEN_WIDTH / 2 - PITCHER_ROWS.labelPlate.width - 2
/** 이름 칸 x = W/2 */
export const PITCHER_NAME_PLATE_X = SCREEN_WIDTH / 2

/** 줄 딱지 = img_text 표 0xd0470 = [388, 389, 329] (S10 1·2절에서 렌더해 읽음 — 확정) */
export const PITCHER_LABELS = [
  { frame: 388, width: 42, height: 10, name: '승리투수' },
  { frame: 389, width: 43, height: 10, name: '패전투수' },
  { frame: 329, width: 31, height: 10, name: '세이브' },
] as const

export function pitcherRowTopOf(row: number) {
  return PITCHER_ROWS.firstY + PITCHER_ROWS.step * row
}

/** 50238 — W/2 − w₅d + trunc(w₅d/2) − trunc(w딱지/2) − 2 · 줄 위 + 3 */
export function pitcherLabelPositionOf(row: number) {
  const label = PITCHER_LABELS[row]
  const plateWidth = PITCHER_ROWS.labelPlate.width
  return {
    x: SCREEN_WIDTH / 2 - plateWidth + Math.trunc(plateWidth / 2) - Math.trunc(label.width / 2) - 2,
    y: pitcherRowTopOf(row) + 3,
  }
}

/**
 * 이름 글 상자 — 0xba269(글, W/2, 줄 위 + 2, 폭 w₅d = 54, 높이 −1, 0). 글은 `"!C!cffffff%s"`(0xcf2e0) 가운데 맞춤 흰 글씨,
 * 높이 −1 이라 세로는 y 에서 위를 맞춘다. 폭은 이름 칸(55)이 아니라 딱지 칸 폭 54 를 그대로 쓴다(원본대로).
 */
export function pitcherNameBoxOf(row: number) {
  return {
    x: PITCHER_NAME_PLATE_X,
    y: pitcherRowTopOf(row) + 2,
    width: PITCHER_ROWS.labelPlate.width,
  }
}
