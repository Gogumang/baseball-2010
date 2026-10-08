/**
 * **비거리 판 — 원본 `0x36cd4`** (← 0x17 그리기 0x46c88 의 0x46cb6). 일반 · 팀 · 투수 · 미션 모드의 0x17 에서는
 * 플레이+0x118 == 8(더비 판)이 아니라 **+0x1960(HOMERUN 글자 켜짐)** 일 때만 그린다(`defenseHomeRunEffects`).
 * ```
 * 36d1a  0xba815(rect, trainning, 11, 종류 1)                 ; 프레임 11 의 합집합 상자 → 폭 40
 * 36d7c  0xba759(trainning, 11, 종류 1, W/2 − 폭/2, 10, …)      ; 판 "___M" (40×16)
 * 36da0  상자 0(3, 2, 24, 11)의 x · y 를 W/2 − 폭/2 · 14 로 **덮는다**(더하지 않는다 — 원본 그대로)
 * 36dc6  0xba719(상자, 자간 0, +0x36, 기준 0, num 이미지, 정렬 4)  ; 흰 숫자, 오른쪽 맞춤
 * ```
 * 배치는 홈런더비 HUD(`pages/home-run-derby/lib/derbyHudLayout` 의 `DISTANCE_BOARD`)와 같은 함수 그대로다 — 페이지끼리 가져다 쓸 수 없어
 * 같은 원본 수를 여기에도 적는다.
 */

/** 화면 폭 W (0x14008b8) */
const SCREEN_WIDTH = 240
const NUM_FOLDER = './sprites/num'

export const DEFENSE_DISTANCE_BOARD = {
  src: './sprites/trainning/frames/011.png',
  width: 40,
  x: SCREEN_WIDTH / 2 - 40 / 2,
  y: 10,
  /** 숫자 상자 — 폭 · 높이는 상자 0 (24×11), 자리는 판 왼쪽 위 x · y = 14 */
  numberBox: { x: SCREEN_WIDTH / 2 - 40 / 2, y: 14, width: 24, height: 11 },
} as const

export interface DistanceGlyph {
  readonly src: string
  readonly left: number
  readonly top: number
}

/** num 이미지 0~9(흰색) — 모두 8×10 이고 "1" 만 4×10 */
const digitWidthOf = (digit: number) => (digit === 1 ? 4 : 8)

/** 0xba719 → 0xba51c(자간 0, 기준 0, 정렬 4) — 글자 높이가 모두 10 이라 아래 맞춤을 해도 위 = 상자 y */
export function defenseDistanceGlyphsOf(displayDistance: number): DistanceGlyph[] {
  const digits = [...String(Math.max(0, Math.trunc(displayDistance)))].map(Number)
  const { numberBox } = DEFENSE_DISTANCE_BOARD
  let left = numberBox.x + numberBox.width - digits.reduce((total, digit) => total + digitWidthOf(digit), 0)
  return digits.map((digit) => {
    const placed = { src: `${NUM_FOLDER}/${String(digit).padStart(3, '0')}.png`, left, top: numberBox.y }
    left += digitWidthOf(digit)
    return placed
  })
}
