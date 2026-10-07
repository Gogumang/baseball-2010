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
 * ⚠️ 숫자 글꼴은 원본이 `0x585ac(…, 프레임 0x46, 값, x, y, 6, …, 2)` 로 그리는데
 * game_ui 프레임 0x46(70) 은 32×15 파란 판이라 숫자꼴이 아니다 — 어느 스프라이트의 0x46 인지
 * 못 맞춰 웹은 HUD 와 같은 num.pzx 숫자(F-3-1 확정)를 쓴다. 마지막 인자 2 = 가로 가운데 정렬로 본다.
 */
export const SCORE_SLOTS = {
  away: { x: SCREEN_WIDTH / 2 - 64, y: SCREEN_HEIGHT / 2 - 7 },
  home: { x: SCREEN_WIDTH / 2 + 67, y: SCREEN_HEIGHT / 2 - 7 },
} as const
/** num.pzx 숫자 한 줄 높이 */
export const SCORE_GLYPH_HEIGHT = 10

/**
 * 승·패·세 투수 3줄 (0x4fe9c, R10 5절 확정).
 * 바탕은 game_ui 프레임 0x5d(93, 54×15 = 딱지 칸) · 0x5e(94, 55×15 = 이름 칸),
 * y = H/2 + 33 + i × (줄높이 + 1) = 193 · 209 · 225.
 *
 * ⚠️ 줄의 x 는 원본 코드에 안 적혀 있다 — 두 칸(54+55=109)을 화면 가로 가운데로 모았다 (근사).
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

const ROWS_WIDTH = PITCHER_ROWS.labelPlate.width + PITCHER_ROWS.namePlate.width
export const PITCHER_ROW_X = Math.floor((SCREEN_WIDTH - ROWS_WIDTH) / 2)

/** 줄 딱지 = img_text 표 0xd0470 = [388, 389, 329] (S10 1·2절에서 렌더해 읽음 — 확정) */
export const PITCHER_LABELS = [
  { frame: 388, width: 42, height: 10, name: '승리투수' },
  { frame: 389, width: 43, height: 10, name: '패전투수' },
  { frame: 329, width: 31, height: 10, name: '세이브' },
] as const

export function pitcherRowTopOf(row: number) {
  return PITCHER_ROWS.firstY + PITCHER_ROWS.step * row
}

/** 딱지 그림을 딱지 칸 가운데에 놓는다 */
export function pitcherLabelPositionOf(row: number) {
  const label = PITCHER_LABELS[row]
  return {
    x: PITCHER_ROW_X + Math.floor((PITCHER_ROWS.labelPlate.width - label.width) / 2),
    y: pitcherRowTopOf(row) + Math.floor((PITCHER_ROWS.rowHeight - label.height) / 2),
  }
}

/** 이름 칸 — 원본 글은 `"!C!cffffff%s"`(0xcf2e0) 가운데 맞춤 흰 글씨다 */
export function pitcherNameBoxOf(row: number) {
  return {
    x: PITCHER_ROW_X + PITCHER_ROWS.labelPlate.width,
    y: pitcherRowTopOf(row),
    width: PITCHER_ROWS.namePlate.width,
    height: PITCHER_ROWS.rowHeight,
  }
}
