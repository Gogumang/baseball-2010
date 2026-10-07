/**
 * **수비 장면 득점 점수판 `0x41a64(장면)`** — 수비 인플레이(상태 0x17) 그리기 0x46c88 이 0x46e62 에서 부른다. 직접 떴다
 * (0x41a64~0x41bea · 메시지 0x13 갈래 0x51fb8~0x5209c).
 *
 * ## 세우기 — 메시지 0x13 "주자 한 명 들어옴" (0x51fb8)
 * 주자가 홈을 밟아 점수판에 올라갈 때마다(보류 득점이 풀릴 때도 0xaa39e 가 하나씩) 메시지 0x13 이 온다.
 * ```
 * 5201a  0x357e0(장면)(결과 [+0xfd4] ∈ 0x18..0x1a — 홈런) 이고 [+0xfe7] == 0 → 홈런 갈래 (아래 ⚠️)
 * 52074  그 밖:  [+0x1100] = 0 · [+0x10fc] = 1 · [+0x10f8] = 0x14                ; 타이머 20
 * 52098  0xa5c34(…) — 점수를 1 올린다
 * ```
 *
 * ## 그리기 — 0x41a64 (보통 갈래 0x41b10)
 * ```
 * 41a7e  s0 = 0xb69b0(st, 0) · s1 = 0xb69b0(st, 1)
 * 41b10  t = [+0x10f8]
 *        t > 0xf : 공격 쪽(st[9]) 점수 −1 로 그린다 (막 오른 1점을 아직 안 보인다) · t −= 1
 *        0 < t ≤ 0xf : 그대로 그린다 · t −= 1
 *        t ≤ 0 : 안 그린다 (0 을 돌려준다)
 * 41b54  0x41440(장면, 0, 0x32, 0, 0, 0)                                            ; 점수판 틀
 * 41b9a  0x585ad(skin, num 이미지, 0x46, s0, W/2 − 0x40, H/2 + 0x2d, 간격 8, 자리 0, 정렬 2)
 * 41bde  0x585ad(skin, num 이미지, 0x46, s1, W/2 + 0x43, H/2 + 0x2d, 간격 8, 자리 0, 정렬 2)
 * ```
 * 곧 1점이 들어오면 20번 그리는 동안 서고, 처음 5번은 앞 점수 · 나머지 15번은 새 점수다.
 * - 숫자 0x585ad: 폭 = Σ그림 폭 + 셋째 글자부터 간격, 정렬 2 → x −= 폭/2, 글자마다 폭 + 간격씩 나아간다
 *   (`widgets/matchup-cards` 의 `paddedNumberGlyphsOf` 와 같은 함수). num 이미지 0x46~0x4f 는 큰 파란 숫자(30×36 안팎).
 *
 * ⚠️ 미해결 — 홈런 갈래(0x52030~0x5206e · 0x41a9e~0x41b0e): 들어온 수 n 으로 간격 = min(40 / n, 20), 타이머 = 간격 × n,
 *    판을 세운 뒤 간격마다 1점씩 올려 보인다. 웹 홈런은 미리 계산한 비행 재생(`ticks`)이라 주자가 홈을 밟는 틱이 실려 오지
 *    않아 끼우지 않는다.
 */

/** 화면 240×320 — W · H */
const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320

/** 메시지 0x13 보통 갈래가 세우는 타이머 (0x5208a `movs r3, #0x14`) */
export const RUN_SCORE_BOARD_TICKS = 0x14
/** 이보다 크면 공격 쪽 점수를 1 빼고 그린다 (0x41b16 `cmp r3, #0xf`) */
export const RUN_SCORE_BOARD_PREVIOUS_ABOVE = 0xf

/** 점수판 틀 0x41440 의 자리 (0x41b4a `movs r2, #0x32`) */
export const RUN_SCORE_BOARD_FRAME_AT = { x: 0, y: 0x32 } as const

/** 두 점수의 가운데 x 와 y (0x41b78 · 0x41bbc) */
export const RUN_SCORE_SLOTS = [
  { x: SCREEN_WIDTH / 2 - 0x40, y: SCREEN_HEIGHT / 2 + 0x2d },
  { x: SCREEN_WIDTH / 2 + 0x43, y: SCREEN_HEIGHT / 2 + 0x2d },
] as const

/** num 이미지 기준 0x46 · 간격 8 · 자리 0 · 정렬 2 */
export const RUN_SCORE_DIGIT_BASE = 0x46
const RUN_SCORE_GAP = 8

/** num 이미지 0x46~0x4f 의 폭 (public/sprites/num 070~079 그림 크기) */
const RUN_SCORE_DIGIT_WIDTHS = [32, 22, 29, 29, 32, 30, 30, 31, 30, 30] as const

export interface RunScoreGlyph {
  readonly image: number
  readonly x: number
  readonly y: number
}

/** 0x585ad(…, 0x46, 값, x, y, 8, 0, 2) — 정렬 2 라 x 에서 폭/2 를 빼고, 세로는 y 그대로 */
export function runScoreGlyphsOf(value: number, slot: { readonly x: number; readonly y: number }): RunScoreGlyph[] {
  const digits = String(Math.max(0, Math.trunc(value))).split('').map(Number)
  const measured = digits.reduce(
    (sum, digit, index) => sum + RUN_SCORE_DIGIT_WIDTHS[digit]! + (index > 1 ? RUN_SCORE_GAP : 0),
    0,
  )
  let left = slot.x - (measured >> 1)
  return digits.map((digit) => {
    const placed = { image: RUN_SCORE_DIGIT_BASE + digit, x: left, y: slot.y }
    left += RUN_SCORE_DIGIT_WIDTHS[digit]! + RUN_SCORE_GAP
    return placed
  })
}

export interface RunScoreBoardFrame {
  /** 이번 그리기에서 판이 서는가 */
  readonly visible: boolean
  /** 공격 쪽 점수를 1 빼고 보이는가 (t > 0xf) */
  readonly previousScore: boolean
  /** 그린 뒤 타이머 */
  readonly timerAfter: number
}

/** 0x41a64 보통 갈래 — 그리기 한 번 */
export function drawRunScoreBoard(timer: number): RunScoreBoardFrame {
  if (timer <= 0) return { visible: false, previousScore: false, timerAfter: timer }
  return { visible: true, previousScore: timer > RUN_SCORE_BOARD_PREVIOUS_ABOVE, timerAfter: timer - 1 }
}

/** 판에 보이는 두 점수 — 공격 쪽(st[9])은 t > 0xf 동안 1 을 뺀다 */
export function runScoreBoardScoresOf(
  scores: readonly [number, number], battingSide: number, previousScore: boolean,
): readonly [number, number] {
  if (!previousScore) return scores
  return battingSide === 0 ? [scores[0] - 1, scores[1]] : [scores[0], scores[1] - 1]
}

/** 득점 점수판 재료를 이루는 경기 칸 — 플레이가 시작될 때의 경기 (`GameState` 의 일부) */
export interface RunScoreBoardGame {
  /** 사람 팀이 선 측 — 0 선공 · 1 후공 */
  readonly playerSide: number
  readonly ourScore: number
  readonly opponentScore: number
  readonly half: '초' | '말'
}

/**
 * 수비 재생(`DefensePlayback.runScoreBoard`)에 넘길 값 — 두 점수 0xb69b0(st, 0/1)은 측 0(선공)이 왼쪽,
 * 공격 측 st[9] 는 초 0 · 말 1. 두 측(점수판 틀 0x41440)은 부르는 화면이 정한다.
 */
export function runScoreBoardSourceOf<Side>(
  game: RunScoreBoardGame,
  sides: readonly [Side, Side],
): { readonly sides: readonly [Side, Side]; readonly scores: readonly [number, number]; readonly battingSide: number } {
  return {
    sides,
    scores: game.playerSide === 0 ? [game.ourScore, game.opponentScore] : [game.opponentScore, game.ourScore],
    battingSide: game.half === '초' ? 0 : 1,
  }
}
