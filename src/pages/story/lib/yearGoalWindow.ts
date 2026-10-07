import type { YearGoalWindowValues } from '@/entities/career/model/seasonFlow'
import { boxNumberGlyphsOf, numImageWidthOf } from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import type { CardBox } from '@/widgets/matchup-cards/lib/matchupCardsLayout'

/**
 * 이벤트 명령 **system sub 1 — 올해의 목표 창** (확정, 직접 떴다).
 * 연초 115 의 내장 이벤트(0x8a680)와 정규시즌 끝 392 가 같은 창을 연다.
 *
 * ```
 * 열기  0x8cf64 → 0xd4ec0[2] = 0x8d270 → 0xd4ee4[1] = 0x8d304:
 *       0x741a1(팝업관리자 [0x140005c], 종류 0, 그리기 0x8a351, 키 없음, 관리 창) · 닫기 키 −5(OK) · '5'(0x35)
 *       → 닫히면 0x8d928~ 이 0x7fe90 (나리 S+0x1b7 = 1 · 저장). arg 는 안 쓴다.
 * 그림  0x8a351 → 0x86fdc(관리 창 w — [w+0x138] mode_ui · [w+0x13c] num · [w+0x150] S · [w+0x20] 모드):
 *       F = mode_ui 프레임 83 ([w+0x138] 목록 +0x14c), 박스 k = 0x94a65(F, 0, k)
 *       0x55e61(skin, 박스 0, 0, 정렬 0x11, 0x10, 0, 1, 0)                 ; 공용 창
 *       0x913e5(img_text, 3) · 0xb9e05(img_text 358 "올해의 목표", 박스 1, 정렬 0x22)
 *       F 를 (0, 0) 에 그린다(vt+0x10) — 칸 2열 × 6줄 그림
 *       0x8656c(w, 박스 2, 박스 3, 박스 4, 0):
 *         팔레트 0. i = 0..4: img_text 0xd41d6[묶음·5 + i] 를 박스 2 에 정렬 0x24, 박스 2.y += h + 2
 *         img_text 87 "현재" 를 박스 3 에 0x22, 박스 3.y += h + 2 → 현재 값 다섯 (아래 숫자)
 *         img_text 148 "목표" 를 박스 4 에 0x22, 박스 4.y += h + 2 → 목표 값 다섯
 * 숫자  0xba719(박스, 자간 1, 값, 기준 0x14(num 주황), num, 정렬 0x24, ox −4, oy 0) — 줄마다 박스.y += h + 2
 *       타율 0x8633c / 방어율 0x86248 은 아래 `averageGlyphsOf` · `earnedRunAverageGlyphsOf`.
 * ```
 * 모드 2(시즌모드, `[w+0x20]` == 2 — 0x7b998) 갈래는 아래 `SeasonYearGoalWindowValues` · `seasonColumnOf` (직접 떴다).
 */

/** 이벤트 system 하위 종류 1 (0xd4ee4[1] = 0x8d304) */
export const SYSTEM_YEAR_GOAL_WINDOW = 1

export const YEAR_GOAL_MODE_UI_FRAME = 83
/** mode_ui 프레임 83 의 박스 0~4 (boxes.json — 0x94a65(F, 0, k)) */
export const YEAR_GOAL_BOXES = {
  window: { x: 24, y: 63, width: 192, height: 134 },
  title: { x: 37, y: 68, width: 62, height: 11 },
  labels: { x: 41, y: 105, width: 35, height: 15 },
  current: { x: 81, y: 88, width: 55, height: 15 },
  goals: { x: 140, y: 88, width: 55, height: 15 },
} as const satisfies Record<string, CardBox>

/** img_text 프레임 — 제목(팔레트 3) · 열 머리 · 줄 이름 */
export const YEAR_GOAL_TEXT = { title: 358, current: 87, goal: 148 } as const
/** 표 0xd41d6 — 묶음(0 타자 · 1 선발 · 2 세이브) × 5줄 */
export const YEAR_GOAL_LABELS: readonly (readonly number[])[] = [
  [318, 58, 180, 319, 327], // 타율 · 안타 · 홈런 · 타점 · 인기도
  [316, 328, 124, 317, 327], // 방어 · 실점 · 승 · 삼진 · 인기도
  [316, 328, 407, 317, 327], // 방어 · 실점 · 세이브P · 삼진 · 인기도
]

/** img_text 프레임 크기 (PNG 를 읽어 적었다 — 높이는 모두 10) */
const TEXT_WIDTH: Readonly<Record<number, number>> = {
  47: 20, 330: 21,
  358: 56, 87: 22, 148: 21, 318: 21, 58: 21, 180: 20, 319: 21, 327: 30, 316: 20, 328: 20, 124: 10, 317: 21, 407: 39,
}
const TEXT_HEIGHT = 10

/** num 기준 0x14 — 주황 숫자 · 소수점 프레임 103(1×2, [num+0x19c]) */
export const YEAR_GOAL_DIGIT_BASE = 0x14
export const YEAR_GOAL_DOT_FRAME = 103
const DOT_SIZE = { width: 1, height: 2 }
const NUMBER_SPACING = 1
const NUMBER_ALIGN = 0x24
const NUMBER_OX = -4
/** 소수점 oy — 0x8633c · 0x86248 이 0xb9d35 에 넘기는 5 */
const DOT_OY = 5
/** 줄 간격 — 박스.y += 박스 높이 + 2 */
const ROW_GAP = 2
const ROWS = 5

/**
 * **시즌모드(모드 2) 갈래** — 같은 창(0x86fdc, 박스·제목·머리 같음)에서 0x8656c 가 고르는 것만 다르다 (직접 떴다):
 * ```
 * 이름  0x8662c: img_text u16 0xd41f4[i] = [47 순위 · 330 승률 · 318 타율 · 316 방어 · 327 인기도]   ; 묶음 표 0xd41d6 대신
 * 현재  0x866e2~0x86830 (S = [w+0x150] = SR):
 *   ① S+0xb2 == 0 && S+0xb4 == 0 → 0 · 그 밖 0xb7aa0(S+0x80, 팀, **1**) + 1   ; 정규시즌 순위(1부터). 숫자 ox −4
 *   ② w = 0xb7908(L, 팀, 1) · l = 0xb7968(L, 팀, 1) · w+l ≠ 0 이면 w×100 / (w+l) 아니면 w×100(= 0)
 *      → 숫자 **ox −10** · 그 뒤 num [num+0x1a8](프레임 106 "%")를 0xb9d35(박스, 0x24, ox −2, oy 1)
 *   ③ 0xa3700(S, 1) → 0x8633c(타율) · ④ 0xa3764(S) → 0x86248(방어율) · ⑤ 0x86a12 공용 인기도 max(0, 0xb6e79(S) − u16 S+0x78)
 * 목표  0x86ac6~0x86b9c: 0x8645c(w, 버퍼, 2, S+0xb3) = u16 0xd4406[연차idx·5 + i] (자르기 없음)
 *   i 0 숫자(표 값 그대로) · 1 숫자 ox −10 + "%" · 2 0x8633c · 3 0x86248 · 4 숫자
 * ```
 * 표 0xd4406 은 판정 0xa37bc 의 표 0xd7cf6 과 50칸 모두 같은 사본이다(직접 비교) — 웹은 `seasonGoalsOf` 하나를 쓴다.
 * 원본 그대로: 목표 ① 은 0부터 센 순위 문턱을 그대로 그린다(1년차 "4" — 판정은 5위까지 달성)인데 현재 ① 은 1부터다.
 * 392(포스트시즌 시작 뒤)에서도 현재 ① 은 셋째 인자 1 이라 정규시즌 순위다 — 판정(셋째 인자 0, 대진 순위)과 다를 수 있다.
 */
export const SEASON_YEAR_GOAL_LABEL_SET = 3
export const SEASON_YEAR_GOAL_LABELS: readonly number[] = [47, 330, 318, 316, 327]

export interface SeasonYearGoalWindowValues {
  readonly labelSet: typeof SEASON_YEAR_GOAL_LABEL_SET
  /** 현재 다섯 — 순위(1부터, 시즌 첫날 전이면 0) · 승률% · 팀 타율 ×1000 · 팀 방어율 ×100 · 인기도 상승(≥ 0) */
  readonly current: readonly number[]
  /** 목표 다섯 — 0xd4406[연차idx·5 + i] 그대로 */
  readonly goals: readonly number[]
}

/** 창이 받는 값 — 나리 두 편(묶음 0~2) 또는 시즌모드(3) */
export type YearGoalWindowSource = YearGoalWindowValues | SeasonYearGoalWindowValues

/** 승률 숫자 ox · "%" (num 106, 6×8) 자리 — 0x86788~0x867e6 · 0x86ade~0x86b24 */
const WIN_RATE_OX = -10
export const YEAR_GOAL_PERCENT_FRAME = 106
const PERCENT_SIZE = { width: 6, height: 8 }
const PERCENT_OFFSET = { x: -2, y: 1 }

export interface YearGoalTextPiece {
  readonly frame: number
  readonly x: number
  readonly y: number
  /** img_text 팔레트 — 0 흰색 · 3 짙은 파랑 */
  readonly palette: 0 | 3
}

export interface YearGoalNumberPiece {
  /** num 프레임 (주황 숫자 20~29 · 소수점 103) */
  readonly frame: number
  readonly x: number
  readonly y: number
}

export interface YearGoalWindowLayout {
  readonly texts: readonly YearGoalTextPiece[]
  readonly numbers: readonly YearGoalNumberPiece[]
}

const halfUp = (difference: number) => (difference >> 1) + (difference % 2)

/** img_text 0xb9e05 → 0xb9d74: 0x2 → x += (w − W) >> 1 · 0x4 → x += w − W · 0x20 → y += 올림((h − H)/2) */
function textPieceOf(frame: number, area: CardBox, align: number, palette: 0 | 3): YearGoalTextPiece {
  const width = TEXT_WIDTH[frame] ?? 0
  let x = area.x
  let y = area.y
  if ((align & 0x2) !== 0) x += (area.width - width) >> 1
  if ((align & 0x4) !== 0) x += area.width - width
  if ((align & 0x20) !== 0) y += halfUp(area.height - TEXT_HEIGHT)
  return { frame, x, y, palette }
}

/** 0xba719 — 자간 1 · 주황 · 정렬 0x24 · ox (기본 −4) */
function numberPiecesOf(value: number, area: CardBox, ox = NUMBER_OX): YearGoalNumberPiece[] {
  return boxNumberGlyphsOf(value, area, { x: ox, y: 0 }, YEAR_GOAL_DIGIT_BASE, NUMBER_SPACING, NUMBER_ALIGN)
    .map((glyph) => ({ frame: glyph.image, x: glyph.x, y: glyph.y }))
}

/** num 한 장 0xb9d35(그림, 박스, 정렬 0x24, ox, oy) → 0xb9c5c: x += w − W · y += trunc((h − H)/2) */
function imagePieceOf(
  frame: number, size: { readonly width: number; readonly height: number }, area: CardBox, ox: number, oy: number,
): YearGoalNumberPiece {
  return {
    frame,
    x: area.x + ox + area.width - size.width,
    y: area.y + oy + Math.trunc((area.height - size.height) / 2),
  }
}

/** 소수점 0xb9d35(num 103, 박스, 정렬 0x24, ox, oy 5) */
function dotPieceOf(area: CardBox, ox: number): YearGoalNumberPiece {
  return imagePieceOf(YEAR_GOAL_DOT_FRAME, DOT_SIZE, area, ox, DOT_OY)
}

/** 승률 — 숫자를 ox −10 에, "%"(num 106)를 ox −2 · oy 1 에 */
function winRateGlyphsOf(value: number, area: CardBox): YearGoalNumberPiece[] {
  return [
    ...numberPiecesOf(value, area, WIN_RATE_OX),
    imagePieceOf(YEAR_GOAL_PERCENT_FRAME, PERCENT_SIZE, area, PERCENT_OFFSET.x, PERCENT_OFFSET.y),
  ]
}

/** 한 자리 칸 = num 기준(0) 그림 폭 + 1 — 0x8633c · 0x86248 이 `[num+0x50]`(프레임 20)의 폭으로 잰다 */
const DIGIT_STEP = numImageWidthOf(YEAR_GOAL_DIGIT_BASE) + 1

/** 0x6c804(v, 10) — 몫이 0 이 될 때까지 10 으로 나눈 횟수 (0 → 0) */
function extraDigitsOf(value: number): number {
  let count = 0
  for (let rest = Math.trunc(value / 10); rest !== 0; rest = Math.trunc(rest / 10)) count += 1
  return count
}

/**
 * 타율 0x8633c(w, 값 ×1000, 박스, ox) — 오른쪽부터 찍는다:
 * ```
 *   s = 폭(num 20) + 1 ; f = 값 % 1000 ; n = 0x6c804(f, 10) + 1
 *   f 를 ox 에 · k = 0 .. 3 − n − 1: "0" 을 ox − s·n − s·k 에          ; 세 자리로 채운다
 *   소수점을 ox − 3s − 1 에 (oy 5) · 값 / 1000 을 ox − 3s − 2 에
 * ```
 * 칸 간격을 "0" 폭으로 재므로 "1"(폭 4)이 끼면 틈이 생긴다 — 원본 그대로.
 */
export function averageGlyphsOf(value: number, area: CardBox, ox = NUMBER_OX): YearGoalNumberPiece[] {
  const fraction = value % 1000
  const digits = extraDigitsOf(fraction) + 1
  const pieces = numberPiecesOf(fraction, area, ox)
  for (let k = 0; k < 3 - digits; k += 1) pieces.push(...numberPiecesOf(0, area, ox - DIGIT_STEP * digits - DIGIT_STEP * k))
  pieces.push(dotPieceOf(area, ox - 3 * DIGIT_STEP - 1))
  pieces.push(...numberPiecesOf(Math.trunc(value / 1000), area, ox - 3 * DIGIT_STEP - 2))
  return pieces
}

/**
 * 방어율 0x86248(w, 값 ×100, 박스, ox):
 * ```
 *   s = 폭(num 20) + 1 ; 0x6c804(값, 10) 는 부르고 버린다
 *   값 % 100 을 ox 에 · 그것이 ≤ 9 면 "0" 을 ox − s 에
 *   소수점을 ox − 2s − 1 에 (oy 5) · 값 / 100 을 ox − 2s − 2 에
 * ```
 */
export function earnedRunAverageGlyphsOf(value: number, area: CardBox, ox = NUMBER_OX): YearGoalNumberPiece[] {
  const fraction = value % 100
  const pieces = numberPiecesOf(fraction, area, ox)
  if (fraction <= 9) pieces.push(...numberPiecesOf(0, area, ox - DIGIT_STEP))
  pieces.push(dotPieceOf(area, ox - 2 * DIGIT_STEP - 1))
  pieces.push(...numberPiecesOf(Math.trunc(value / 100), area, ox - 2 * DIGIT_STEP - 2))
  return pieces
}

const rowOf = (area: CardBox, row: number): CardBox => ({ ...area, y: area.y + row * (area.height + ROW_GAP) })

/** 시즌모드 한 칸 — ① 숫자 · ② 승률 · ③ 타율 · ④ 방어율 · ⑤ 숫자 (현재·목표 같은 꼴) */
function seasonCellOf(value: number, area: CardBox, row: number): YearGoalNumberPiece[] {
  if (row === 1) return winRateGlyphsOf(value, area)
  if (row === 2) return averageGlyphsOf(value, area)
  if (row === 3) return earnedRunAverageGlyphsOf(value, area)
  return numberPiecesOf(value, area)
}

/** 창 한 장의 글·숫자 자리 — 박스 3·4 는 머리 줄 다음(1줄째)부터 값이다 */
export function yearGoalWindowLayoutOf(values: YearGoalWindowSource): YearGoalWindowLayout {
  const B = YEAR_GOAL_BOXES
  const labels = values.labelSet === SEASON_YEAR_GOAL_LABEL_SET ? SEASON_YEAR_GOAL_LABELS : YEAR_GOAL_LABELS[values.labelSet]
  const texts: YearGoalTextPiece[] = [
    textPieceOf(YEAR_GOAL_TEXT.title, B.title, 0x22, 3),
    ...labels.map((frame, row) => textPieceOf(frame, rowOf(B.labels, row), 0x24, 0)),
    textPieceOf(YEAR_GOAL_TEXT.current, B.current, 0x22, 0),
    textPieceOf(YEAR_GOAL_TEXT.goal, B.goals, 0x22, 0),
  ]
  const firstGlyphsOf = values.labelSet === 0 ? averageGlyphsOf : earnedRunAverageGlyphsOf
  const cellOf = values.labelSet === SEASON_YEAR_GOAL_LABEL_SET
    ? seasonCellOf
    : (value: number, area: CardBox, row: number) => row === 0 ? firstGlyphsOf(value, area) : numberPiecesOf(value, area)
  const columnOf = (column: readonly number[], area: CardBox) =>
    column.slice(0, ROWS).flatMap((value, row) => cellOf(value, rowOf(area, row + 1), row))
  return { texts, numbers: [...columnOf(values.current, B.current), ...columnOf(values.goals, B.goals)] }
}
