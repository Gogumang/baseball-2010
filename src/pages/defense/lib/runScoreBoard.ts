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
 * ## 홈런 갈래 (0x357e0 참 = 결과 [+0xfd4] ∈ 0x18..0x1a 이고 [+0xfe7] == 0) — 직접 떴다
 * ```
 * 52030  메시지 0x13(주자 하나 홈인, 인자 = 주자 칸):  n = [+0x10fc] + 1 → [+0x10fc] · 간격 g = min(40 / n, 20) → [+0x1101]
 *        주자 칸 == 0(타자주자) 이면  타이머 [+0x10f8] = g · n · [+0x1100] = 1
 *        아니면                      타이머 = 0 · [+0x1100] = 0          ; 점수 +1 (0xa5c34) 은 갈래와 상관없이
 * 41a9e  그리기:  [+0x1100] == 0 이면 안 그린다 · t < g·(n − 1) 이면 안 그린다
 *        공격 쪽 점수 − n 으로 그린다 · t −= 1 · t < g·(n − 1) 이면 n −= 1, n < 0 이면 [+0x1100] = 0
 * ```
 * 곧 타자주자가 홈을 밟는 순간 판이 서고, g 번마다 1점씩 올라가 보이다가 다 오른 뒤 g 번 더 서 있다.
 * [+0x10fc] 는 새 타석 0x48d50(48f7e)이 0 으로 비운다.
 *
 * ## 판이 끝난 뒤 — 0x35108 까지는 그리고, 상태 0x17 을 나가면 안 그린다
 * 0x41a64 는 0x17 그리기 0x46c88 에서만 불리고(0x46e62 — 관문과 상관없이), 0x17 끝 0x528b0 의 0x35108(3519c)이 타이머 [+0x10f8] = 0
 * 으로 둔다. 관문이 닫힌 뒤 0x35108 까지의 갱신(아래 `closesDefenseScene`)에도 그리기는 돌아 판이 타이머대로 선다.
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

/** 홈런 갈래의 칸 — [+0x10fc] 들어온 수 n · [+0x1101] 간격 g · [+0x10f8] 타이머 t · [+0x1100] 섰나 */
export interface HomeRunScoreBoard {
  readonly count: number
  readonly gap: number
  readonly timer: number
  readonly active: boolean
}

/** 새 타석 0x48d50 이 비운 뒤 */
export const EMPTY_HOME_RUN_SCORE_BOARD: HomeRunScoreBoard = { count: 0, gap: 0, timer: 0, active: false }

/** 메시지 0x13 홈런 갈래 (0x52030~0x52072) — 주자 하나가 홈을 밟았다 */
export function homeRunScoreBoardRunIn(board: HomeRunScoreBoard, isBatterRunner: boolean): HomeRunScoreBoard {
  const count = board.count + 1
  const gap = Math.min(Math.trunc(40 / count), RUN_SCORE_BOARD_TICKS)
  return isBatterRunner ? { count, gap, timer: gap * count, active: true } : { count, gap, timer: 0, active: false }
}

/** 0x41a64 홈런 갈래 (0x41a9e~0x41b0e) — 그리기 한 번. `hiddenRuns` 는 공격 쪽 점수에서 뺄 수 */
export function drawHomeRunScoreBoard(
  board: HomeRunScoreBoard,
): { readonly visible: boolean; readonly hiddenRuns: number; readonly next: HomeRunScoreBoard } {
  if (!board.active || board.timer < board.gap * (board.count - 1)) return { visible: false, hiddenRuns: 0, next: board }
  const timer = board.timer - 1
  if (timer >= board.gap * (board.count - 1)) {
    return { visible: true, hiddenRuns: board.count, next: { ...board, timer } }
  }
  const count = board.count - 1
  return { visible: true, hiddenRuns: board.count, next: { ...board, timer, count, active: count >= 0 } }
}

/** 판에 보이는 두 점수 — 공격 쪽(st[9])에서 `hidden` 만큼 뺀다 */
export function runScoreBoardHiddenScoresOf(
  scores: readonly [number, number], battingSide: number, hidden: number,
): readonly [number, number] {
  return battingSide === 0 ? [scores[0] - hidden, scores[1]] : [scores[0], scores[1] - hidden]
}

/** 0x357e0 — 타구 결과 코드 [+0xfd4] 가 24~26(홈런성)인가 */
export function isHomeRunHitCode(resultCode: number | null | undefined): boolean {
  return resultCode !== null && resultCode !== undefined && resultCode - 0x18 >= 0 && resultCode - 0x18 <= 2
}

/**
 * 메시지 0x13 한 번 (0x51fb8 → 5201a) — `0x357e0 && +0xfe7 == 0` 이면 홈런 갈래(0x52030), 아니면 보통 갈래 52074:
 * `[+0x1100] = 0 · [+0x10fc] = 1 · [+0x10f8] = 0x14`. 두 갈래가 같은 칸(+0x10f8 타이머 · +0x10fc 수)을 쓴다.
 */
export function runScoreBoardRunIn(
  board: HomeRunScoreBoard, slot: number, homeRunHit: boolean, fastForward: boolean,
): HomeRunScoreBoard {
  if (homeRunHit && !fastForward) return homeRunScoreBoardRunIn(board, slot === 0)
  return { ...board, active: false, count: 1, timer: RUN_SCORE_BOARD_TICKS }
}

/**
 * 그리기 0x41a64 한 번 — 0x41a94 `0x357e0` 이면 홈런 갈래(41a9e), 아니면 보통 갈래(41b10). `hidden` 은 공격 쪽 점수에서 뺄 수.
 * 0x357e0 은 +0xfe7 을 안 본다(그리기 쪽).
 */
export function drawRunScoreBoardScene(
  board: HomeRunScoreBoard, homeRunHit: boolean,
): { readonly visible: boolean; readonly hidden: number; readonly next: HomeRunScoreBoard } {
  if (homeRunHit) {
    const drawn = drawHomeRunScoreBoard(board)
    return { visible: drawn.visible, hidden: drawn.hiddenRuns, next: drawn.next }
  }
  const drawn = drawRunScoreBoard(board.timer)
  return { visible: drawn.visible, hidden: drawn.previousScore ? 1 : 0, next: { ...board, timer: drawn.timerAfter } }
}

/**
 * ============================================================================
 * **판이 닫힌 뒤 0x35108 까지 — 슬롯 2 의 닫힌 갈래 529f0~52a32** (직접 뜸)
 * ============================================================================
 * ```
 * 529f0  +0x1094 += 1 ; ≤ 10 이면 52b26(+0xfe7 이면 되돌아 돈다)
 * 52a00  … 공+0x34 > 0x7cf 면 소리 0x27(0x62369)
 * 52a1c  0x357e0(홈런성 결과) && [+0x1100](홈런 점수판 섰음) → 52b36 (이번 그림은 안 닫는다 — 다음 그림 +0x1094 가 또 오른다)
 * 52a34  메시지 0xbb9 · 판정 0xae3e8 · 0x4e600 · **0x35108**(0x17 끝 — 타이머 [+0x10f8] = 0 · +0x1960 = 0 · 파티클 치우기) ·
 *        +0xfe7 = 0 · +0x1100 = 0
 * ```
 * 곧 관문이 닫힌 뒤 **11 번째 갱신**에서 끝나고, 홈런 타구는 홈런 점수판이 내려갈(그리기 41b08 이 n < 0 에서 [+0x1100] = 0) 때까지 더 선다.
 * 그동안 그리기 0x46c88 은 그대로 돈다 — 득점 점수판(0x46e62) · 비거리 판 · 프레임 끝 파티클 틱. +0x1094 는 판 시작에 0 이다.
 */
export const CLOSED_UPDATES_BEFORE_END = 10

/** 닫힌 갱신 하나 — 이 갱신의 +0x1094(올린 뒤)와 그 앞 그리기까지의 홈런 점수판으로 0x35108 을 부르는가 */
export function closesDefenseScene(closedCount: number, homeRunHit: boolean, board: HomeRunScoreBoard): boolean {
  return closedCount > CLOSED_UPDATES_BEFORE_END && !(homeRunHit && board.active)
}
