/**
 * 경기 결과 화면 배치 (그리기 0x4a384 = 정산 화면 · 0x4fe9c = 상태 0x18 경기 끝 결과 판).
 *
 * 근거: `docs/re/F-ui-layout.md` F-7 · 6-1(0x4a384 앞부분, 확정),
 *       `docs/re/R10-game-states.md` 5절(상태 0x18 경기 끝 결과 판, 확정),
 *       `docs/re/S10-asset-reading.md` 1·2절(img_text 388 "승리투수" · 389 "패전투수" · 329 "세이브"),
 *       `docs/re/S1-win-loss-save.md`(승·패·세 투수를 누가 받는지).
 *
 * ```
 * 패배면 화면 전체 검정 단계 8          (0x4a42a)
 * 띠 fillRect(0, 40, 240, 30, 0x80304EA2) (0x4a466)
 * game_ui 프레임 8 (171×25) → (34, 35)   (0x4a48e)
 * result 프레임 0 "YOU WIN" / 1 "YOU LOSE" 기준점 (120, 50) (0x4a4d2·0x4a55c)
 * 점수 (W/2 − 64, H/2 − 7) · (W/2 + 67, H/2 − 7)           (0x4fe9c)
 * 투수 3줄 y = H/2 + 33 + i × (줄높이 + 1)                  (0x4fe9c, 표 0xd0470 = [388, 389, 329])
 * ```
 *
 * ⚠️ 원본은 이 그림들을 **두 화면**에 나눠 그린다 — 승패 그림·보상 글은 정산(0x4a384),
 * 점수와 투수 3줄은 그 앞 상태 0x18(0x4fe9c) 이다. 웹판은 경기 결과 화면이 하나뿐이라
 * 두 화면의 확정 좌표를 한 장에 겹쳐 놓았다 (배치 결정).
 * 겹치는 쪽(정산 0x4a948 의 (0,80) 점수판 + 판 176×202)은 F 문서도 '유력' 이고 이 좌표들과
 * 자리가 부딪혀 안 옮겼다.
 */

const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320

/** 패배면 화면 전체를 검정 **단계 8** 로 어둡게 (0x4a42a~0x4a444, F-7 1 확정) */
export const LOSE_DIM_STAGE = 8
/**
 * 단계 → 불투명도 환산은 원본에서 못 읽었다 (F 4절 0: "정확한 불투명도는 미확인").
 * 알파가 4비트 단계로 보여 16 을 분모로 삼는다 — 근사다.
 */
export const DIM_STAGE_MAX = 16
export const LOSE_DIM_OPACITY = LOSE_DIM_STAGE / DIM_STAGE_MAX

/** 띠 `fillRect(0, 40, W, 30, 0x80304EA2)` = RGB(48,78,162) 50% 반투명 (0x4a466~0x4a478, 확정) */
export const BAND = {
  x: 0,
  y: 40,
  width: SCREEN_WIDTH,
  height: 30,
  color: 'rgba(48, 78, 162, 0.5)',
} as const

/** game_ui 프레임 8 = 171×25 파란 둥근 막대, x = W/2 − 폭/2 = 34, y = 35 (0x4a48e~0x4a4c4, 확정) */
export const TITLE_BAR = { frame: 8, x: 34, y: 35, width: 171, height: 25 } as const

/**
 * result.pzx 승패 그림. 기준점은 (W/2, 50) 이고 프레임 원점(origins.json)이
 * 000 = (−77,−17) · 001 = (−80,−17) 이라 왼쪽 위가 (43,33) · (40,33) 이다 (F-7 4 확정).
 * 원점을 더한 값을 그대로 적어 둔다 — origins.json 을 안 받아도 자리가 흔들리지 않게 하려는 것이다.
 */
export const RESULT_SPRITES = {
  승: { frame: 0, x: 43, y: 33, width: 149, height: 31 },
  /** 무승부 전용 그림이 없어 원본도 패배 쪽 프레임을 쓴다 (F-7 4) */
  패: { frame: 1, x: 40, y: 33, width: 162, height: 31 },
} as const

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

/**
 * 보상·기록 글 (F-7 5 유력): "!R%d회" · "!C기록이 없습니다!" · "승리 추가 보상[!cffff00 … G포인트]".
 * 원본은 176×202 판 안에 넣는데 그 판 좌표가 '유력' 이라(위 머리말) 판은 안 그리고
 * 투수 3줄 아래 빈 자리에 줄만 둔다 (배치 근사).
 */
export const REWARD_TEXT = {
  x: 20,
  y: pitcherRowTopOf(PITCHER_ROWS.count - 1) + PITCHER_ROWS.step + 8,
  width: SCREEN_WIDTH - 40,
} as const

/** 원본 글 0xd0978 "기록이 없습니다!" */
export const NO_RECORD_TEXT = '기록이 없습니다!'
