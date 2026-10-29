import { isVersusMode } from './versusReward'

const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320
const CENTER_X = SCREEN_WIDTH / 2
const CENTER_Y = SCREEN_HEIGHT / 2

/** 진 판 덮개 — [0x15605d0] 색 덮기(검정) 단계 8 (0x4a436) */
export const SETTLEMENT_LOSE_DIM_STEP = 8

/** 띠 fillRect(0, 40, W, 30, 0x80304EA2) — RGB(48,78,162) 알파 0x80 (0x4a466) */
export const SETTLEMENT_BAND = { x: 0, y: 40, width: SCREEN_WIDTH, height: 30, color: 'rgba(48, 78, 162, 0.5)' } as const

/** game_ui 프레임 8 (171×25) 을 (W/2 − 폭/2, 35) (0x4a48e~0x4a4c4) */
export const SETTLEMENT_TITLE_BAR = { frame: 8, centerX: CENTER_X, y: 35, width: 171 } as const

/** result 프레임 0 "YOU WIN" · 1 "YOU LOSE" 를 원점 (W/2, 50) 에 (0x4a4d2 · 0x4a55c) */
export const SETTLEMENT_RESULT_SPRITE = { winFrame: 0, loseFrame: 1, x: CENTER_X, y: 50 } as const

/**
 * 점수 두 개 — game_ui 프레임 16 의 박스 4 = [14, 120, 82, 15] · 박스 5 = [144, 119, 82, 15] (boxes.json).
 * 왼쪽(측 0) x = W/2 − 120 + 14 + 41 + 2 = 57 · 오른쪽(측 1) x = W/2 + 144 + 41 − 0x76 = 187, 둘 다 y = H/2 − 80 + 135 + 10 = 225.
 * 글자는 num 70 + 자리 숫자(0xba51c 기준 0x46), x 가 글 가운데다.
 */
export const SETTLEMENT_SCORE = {
  digitBaseFrame: 0x46,
  side0: { centerX: CENTER_X - 120 + 14 + Math.trunc(82 / 2) + 2, y: CENTER_Y - 80 + 120 + 15 + 10 },
  side1: { centerX: CENTER_X + 144 + Math.trunc(82 / 2) - 0x76, y: CENTER_Y - 80 + 120 + 15 + 10 },
} as const

/** 기본 화면 바닥 — game_ui 이미지 12 (41×12) · img_text 프레임 167 "0:INFO" (31×5) */
export const SETTLEMENT_INFO_BAR = {
  image: 12,
  imageWidth: 41,
  imageHeight: 12,
  x: CENTER_X - (41 >> 1),
  y: SCREEN_HEIGHT - 12 - 1,
  labelFrame: 167,
  labelX: CENTER_X - (31 >> 1),
  labelY: SCREEN_HEIGHT - 12 + 2,
} as const

/** 기본 화면의 이번에 번 G — 0x54a61(skin, 값, W/2 − 0x28, H − 12 − 0x13, 0x46, 0, …) */
export const SETTLEMENT_INFO_POINT = {
  x: CENTER_X - 0x28,
  y: SCREEN_HEIGHT - 12 - 0x13,
  width: 0x46,
  align: 2,
  plus: true,
  plate: true,
} as const

/** 기록 판 높이 — 182, 대전모드에서 이겼으면 202 (0x4aa84~0x4aa9e) */
export function settlementPanelHeightOf(mode: number, isWin: boolean): number {
  return isVersusMode(mode) && isWin ? 0xca : 0xb6
}

const BOX_LEFT = CENTER_X - 0x51
const BOX_WIDTH = 162

/** 기록 판의 칸·글 자리를 판 높이로 풀어 낸다 (r7 의 흐름 그대로) */
export function settlementPanelLayoutOf(height: number, recordCount: number, hasRewardLine: boolean) {
  const top = CENTER_Y - (height >> 1)
  let r7 = top
  const window = { x: CENTER_X - 88, y: top, width: 176, height }
  const title = { image: 30, width: 56, x: CENTER_X - 28, y: r7 + 7 }
  const recordBox = { x: BOX_LEFT, y: r7 + 0x17, width: BOX_WIDTH, height: 0x55 }
  r7 += 0x13
  const listTop = r7 - 6
  const records = {
    scrollBar: { x: CENTER_X + 0x44, y: listTop + 0x15 },
    firstRowY: listTop + 0x16,
    rowStep: 16,
    nameX: BOX_LEFT + 0xf,
    countX: BOX_LEFT + 0x14,
    countWidth: 0x7a,
  }
  const emptyText = { x: BOX_LEFT, y: r7 + 0x28, width: BOX_WIDTH }
  r7 += 0x5d
  const pointBox = { x: BOX_LEFT, y: r7, width: BOX_WIDTH, height: 0x2e }
  const pointRows = [
    { label: 256, name: '획득', labelY: r7 + 8, valueY: r7 + 5, plus: true },
    { label: 257, name: '보유', labelY: r7 + 0x1c, valueY: r7 + 0x19, plus: false },
  ] as const
  const pointLabelX = BOX_LEFT + 0xf
  const pointGpX = BOX_LEFT + 0x2c
  // 0x54a61(skin, 값, x, y, 0x50, 0x10, 1, 1, 더하기, 0) — 획득은 "+" 를 붙이고 보유는 안 붙인다, 둥근 판 없음
  const pointValue = { x: BOX_LEFT + 0x46, width: 0x50, height: 0x10, align: 1, plate: false }
  r7 += 0x32
  const rewardBox = hasRewardLine ? { x: BOX_LEFT, y: r7, width: BOX_WIDTH, height: 0x12 } : null
  const ticker = hasRewardLine ? { x: BOX_LEFT, y: r7 + 3, width: BOX_WIDTH, height: 18 } : null
  if (hasRewardLine) r7 += 0x14
  const okButton = { frame: 0, width: 41, x: CENTER_X - (41 >> 1), y: r7 }
  return {
    window,
    title,
    recordBox,
    records,
    emptyText,
    pointBox,
    pointRows,
    pointLabelX,
    pointGpX,
    pointValue,
    rewardBox,
    ticker,
    okButton,
    hasRecords: recordCount > 0,
  }
}
