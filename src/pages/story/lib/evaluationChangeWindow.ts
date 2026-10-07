import type { CardBox } from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import { goalTableLayoutOf, placedNumberOf, placedTextOf } from '@/pages/story/lib/yearGoalWindow'
import type { YearGoalNumberPiece, YearGoalTextPiece, YearGoalWindowSource } from '@/pages/story/lib/yearGoalWindow'

/**
 * 이벤트 명령 **system sub 2 — 경기 평가 변화 창** (확정, 직접 떴다). 116 의 평가 내장 이벤트 0x8a6fc 둘째 명령이다.
 *
 * ```
 * 쌓기  0x8a6fc: 명령 = 8 바이트(0xac8b5) 종류 2 · sub 2 · arg 0x4b                 ; arg 는 아무도 안 읽는다
 *       0x86531(gfx, S+7, 사기, S+0x4a, 인기도, S+0x64, 평판) → [gfx+0x260 + 4i]
 *         = 사기 변화 · 현재 사기 · 인기도 변화 · 현재 인기도 · 평판 변화 · 현재 평판 (116 0x12b08~0x12b70 이 이 차례로 넘긴다)
 * 열기  0x8cf64 → 0xd4ec0[2] = 0x8d270 → 0xd4ee4[2] = 0x8d386:
 *       0x741a1(팝업관리자, 0, 그리기 0x8a361, 키 없음, 관리 창) · 닫기 키 −5(OK) · '5'(0x35)   ; sub 1 과 같은 꼴
 * 그림  0x8a361 → 0x86c90(gfx — [gfx+0x138] mode_ui · [gfx+0x13c] num):
 *       F = mode_ui 프레임 84 ([+0x138] 목록 +0x150), 박스 k = 0x94a65(F, 0, k)
 *       0x55e61(skin, 박스 0, 0, 정렬 0x11, 0x10, 0, 1, 0)                     ; 공용 창 (올해의 목표 창과 같다)
 *       0x913e5(img_text, 3) · 0xb9e05(img_text 359, 박스 1, 정렬 0x22)
 *       F 를 (0, 0) 에 그린다(vt+0x10)
 *       0x7d120(gfx, 5, (박스1.x, 박스1.y, 박스1.w × 3 − 8, 박스1.h), 1)        ; "N년 G/45경기" — 막 치른 경기(−1)
 *       팔레트 0. i = 0..2: img_text 0xd4acc[i] = [84 사기 · 327 인기도 · 331 평판] 를 박스 2 에 정렬 0x24 · ox −4
 *       i = 0..2: 현재 [gfx+0x264 + 8i] 를 박스 3 에 0xba719(자간 1, 기준 0x14, 정렬 0x24, ox −4)
 *       i = 0..2: 변화 v = [gfx+0x260 + 8i] 를 박스 4 에
 *                 v ≠ 0 → mode_ui 애니 (v > 0 ? 1 : 2) 를 (x + 1, y + 2) 에 0x93c45 로 그리고 0x93d91 로 한 칸 진행
 *                 v = 0 → 흰 RGB(255,255,255) 막대 0x6a9f1(x + 1, y + trunc(h/2), trunc(w/2) − 4, 2)
 *                 |v| 를 0xba719(…, 정렬 0x24, ox 0)
 *       세 표 모두 줄마다 박스.y += h + 2
 *       0x8656c(gfx, 박스 7, 박스 5, 박스 6, 0)                                 ; 올해의 목표 표 (`goalTableLayoutOf`)
 * ```
 */

/** 이벤트 system 하위 종류 2 (0xd4ee4[2] = 0x8d386) */
export const SYSTEM_EVALUATION_CHANGE_WINDOW = 2

export const EVALUATION_CHANGE_MODE_UI_FRAME = 84
/** mode_ui 프레임 84 의 박스 0~7 (boxes.json — 0x94a65(F, 0, k)) */
export const EVALUATION_CHANGE_BOXES = {
  window: { x: 24, y: 52, width: 192, height: 209 },
  title: { x: 37, y: 57, width: 62, height: 11 },
  labels: { x: 42, y: 83, width: 35, height: 15 },
  current: { x: 81, y: 83, width: 55, height: 15 },
  change: { x: 147, y: 83, width: 32, height: 15 },
  goalCurrent: { x: 81, y: 140, width: 55, height: 15 },
  goals: { x: 140, y: 140, width: 55, height: 15 },
  goalLabels: { x: 39, y: 157, width: 37, height: 15 },
} as const satisfies Record<string, CardBox>

/** img_text 359 — 제목(팔레트 3) */
export const EVALUATION_CHANGE_TITLE = 359
/** 표 0xd4acc — 사기 · 인기도 · 평판 */
export const EVALUATION_CHANGE_LABELS: readonly number[] = [84, 327, 331]
/** mode_ui 애니 1(▲ 프레임 61) · 2(▼ 프레임 62) */
export const EVALUATION_CHANGE_ARROW_ANIMATIONS = { up: 1, down: 2 } as const

const LABEL_OX = -4
const CURRENT_OX = -4
const CHANGE_OX = 0
const ROW_GAP = 2
/** 0x7d120 에 넘기는 사각형 — 박스 1 을 오른쪽으로 늘린다(w × 3 − 8) */
const MESSAGE_WIDTH_SCALE = 3
const MESSAGE_WIDTH_CUT = 8

export interface EvaluationChangeValues {
  /** [gfx+0x260 + 8i] — 사기 S+7 · 인기도 S+0x4a · 평판 S+0x64 */
  readonly changes: readonly [number, number, number]
  /** [gfx+0x264 + 8i] — 현재 사기 · 인기도 · 평판 */
  readonly currents: readonly [number, number, number]
}

export interface EvaluationChangeArrow {
  readonly animation: 1 | 2
  readonly x: number
  readonly y: number
}

export interface EvaluationChangeDash {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface EvaluationChangeWindowLayout {
  readonly texts: readonly YearGoalTextPiece[]
  readonly numbers: readonly YearGoalNumberPiece[]
  readonly arrows: readonly EvaluationChangeArrow[]
  readonly dashes: readonly EvaluationChangeDash[]
  /** 0x7d120 이 "N년 G/45경기" 를 오른쪽부터 찍는 사각형 */
  readonly messageBox: CardBox
}

const rowOf = (area: CardBox, row: number): CardBox => ({ ...area, y: area.y + row * (area.height + ROW_GAP) })

export function evaluationChangeWindowLayoutOf(
  values: EvaluationChangeValues,
  goals: YearGoalWindowSource,
): EvaluationChangeWindowLayout {
  const B = EVALUATION_CHANGE_BOXES
  const table = goalTableLayoutOf(goals, { labels: B.goalLabels, current: B.goalCurrent, goals: B.goals })
  const arrows: EvaluationChangeArrow[] = []
  const dashes: EvaluationChangeDash[] = []
  const changeNumbers = values.changes.flatMap((change, row) => {
    const area = rowOf(B.change, row)
    if (change !== 0) {
      arrows.push({ animation: change > 0 ? EVALUATION_CHANGE_ARROW_ANIMATIONS.up : EVALUATION_CHANGE_ARROW_ANIMATIONS.down, x: area.x + 1, y: area.y + 2 })
    } else {
      dashes.push({ x: area.x + 1, y: area.y + Math.trunc(area.height / 2), width: Math.trunc(area.width / 2) - 4, height: 2 })
    }
    return placedNumberOf(Math.abs(change), area, CHANGE_OX)
  })
  return {
    texts: [
      placedTextOf(EVALUATION_CHANGE_TITLE, B.title, 0x22, 3),
      ...EVALUATION_CHANGE_LABELS.map((frame, row) => placedTextOf(frame, rowOf(B.labels, row), 0x24, 0, LABEL_OX)),
      ...table.texts,
    ],
    numbers: [
      ...values.currents.flatMap((current, row) => placedNumberOf(current, rowOf(B.current, row), CURRENT_OX)),
      ...changeNumbers,
      ...table.numbers,
    ],
    arrows,
    dashes,
    messageBox: { ...B.title, width: B.title.width * MESSAGE_WIDTH_SCALE - MESSAGE_WIDTH_CUT },
  }
}
