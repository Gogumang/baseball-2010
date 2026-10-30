import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  HIDDEN_PITCH_COLUMN,
  isHiddenPitchRowOpen,
  isInPitchList,
  pitchTrainingCostOf,
  pitchTrainingCountOf,
  pitchTrainingRequiredSessionsOf,
  pitchTypeNumberOf,
} from './otherSlices'
import {
  HIDDEN_PITCH_NAME_FRAME,
  PITCH_TRAINING_IN_USE_LABEL,
  PITCH_TRAINING_LEARN_LABEL,
  PITCH_TRAINING_ORANGE_PLATE,
  PITCH_TRAINING_WHITE_PLATE,
  PITCH_WINDOW_EQUIP_LABEL,
} from './windowLayout'

/** 구질 훈련 창의 칸 그림 · 아래 글 · 비용 · 횟수 (0x80e1c~0x8134e) — 배치는 `windowLayout` */

export interface PitchCellLook {
  /** 덮는 판 — null 이면 mode_ui 29 의 파란 칸 그대로 */
  readonly plate: number | null
  /** slt_pitch 프레임 — 구질 번호 − 1, 막힌 히든은 21 */
  readonly nameFrame: number
  /** 효과 0xb(단색) 색 — 배운 칸 흰색, 그 밖 검정 */
  readonly nameColor: '#FFFFFF' | '#000000'
}

/**
 * 칸 그림 (0x80e1c~0x810ac) — 열 0~3 은 칸(행·2 + 열%2) 단계 > 열/2 면 "배움", 열 4 는 그 행 cell0 단계 ≤ 1 이면 cell1 을 보고
 * 단계 > 2 면 "배움". 먼저 0xa436c(목록에 든 구질)이면 주황 판. 열 4 는 계열이 안 열렸으면 흰 판 + "????".
 */
export function cellLookOf(career: PitcherCareer, row: number, column: number): PitchCellLook {
  const typeNumber = pitchTypeNumberOf(row, column)
  const nameFrame = typeNumber - 1
  if (column === HIDDEN_PITCH_COLUMN && !isHiddenPitchRowOpen(career, row)) {
    return { plate: PITCH_TRAINING_WHITE_PLATE, nameFrame: HIDDEN_PITCH_NAME_FRAME, nameColor: '#000000' }
  }
  if (isInPitchList(career, typeNumber)) return { plate: PITCH_TRAINING_ORANGE_PLATE, nameFrame, nameColor: '#000000' }
  const isLearned =
    column === HIDDEN_PITCH_COLUMN
      ? stageOf(career, hiddenProgressCellOf(career, row)) > 2
      : stageOf(career, row * 2 + (column % 2)) > Math.trunc(column / 2)
  return isLearned ? { plate: null, nameFrame, nameColor: '#FFFFFF' } : { plate: PITCH_TRAINING_WHITE_PLATE, nameFrame, nameColor: '#000000' }
}

const stageOf = (career: PitcherCareer, cell: number) => career.pitchTrainingStages[cell] ?? 0
/** 열 4 의 칸 — cell0 단계가 1 이하면 cell1 (0x80e3c~0x80e58 · 0x81244~0x81262) */
const hiddenProgressCellOf = (career: PitcherCareer, row: number) => (stageOf(career, row * 2) <= 1 ? row * 2 + 1 : row * 2)

/**
 * 창이 선 상태 — 108(0x6c) 구질 훈련 · 123(0x7b) 구질 고르기. 그림 0x803d4 는 같고 이 셋이 갈린다(직접 떴다):
 * 처음 글 번호 80ce2~80cf0(0x7b 면 0x7b + 0xac = 0x127) · 배운 칸 글 8116c~8117e(0x6c 만 −1) · G 동전 805a8 · 비용 · 횟수 8119e~811a4(0x7b 면 건너뜀).
 */
export type PitchWindowState = '훈련' | '장착'

/**
 * 아래 글 (0x80ce2 · 0x81120~0x8117e · 81392) — 처음 값 0x125 "배우기"(0x7b 면 0x127 "장착"). 초점이 칸에 있을 때 커서 칸만 본다:
 * 목록에 든 구질이면 0x128 "사용중", 칸(행·2 + 열%2 — 열 4 도 보정 없이 cell0) 단계 > 열/2 면 108 은 −1(안 그림) · 123 은 0x127.
 * 초점이 탭 줄이면 처음 값 그대로 선다(원본 그대로).
 */
export function statusLabelOf(
  career: PitcherCareer,
  row: number,
  column: number,
  isCellFocus: boolean,
  state: PitchWindowState = '훈련',
): number | null {
  const initial = state === '장착' ? PITCH_WINDOW_EQUIP_LABEL : PITCH_TRAINING_LEARN_LABEL
  if (!isCellFocus) return initial
  if (isInPitchList(career, pitchTypeNumberOf(row, column))) return PITCH_TRAINING_IN_USE_LABEL
  if (stageOf(career, row * 2 + (column % 2)) > Math.trunc(column / 2)) return state === '장착' ? PITCH_WINDOW_EQUIP_LABEL : null
  return initial
}

/**
 * 비용 (0x811b4~0x81206) — 커서 칸 번호를 **자르지 않고** /2 해 표 0xd46a2 [−300, −600, −1000] 의 절댓값.
 * 칸 5(아래 줄 오른쪽)도 2 라 1000 이다.
 */
export function pitchTrainingWindowCostOf(cellIndex: number): number {
  return pitchTrainingCostOf(Math.trunc(cellIndex / 2) * 2)
}

/**
 * 횟수 "n / 필요" (0x81224~0x8134e) — c = min(칸, 4), 칸 = 행·2 + c%2(c 가 4 면 히든 보정), 필요 = 0xd469e[c/2] = [2, 4, 5].
 * 목록에 든 구질이거나 단계 > c/2 면 "필요/필요", 단계 == c/2 면 그 칸 횟수, 그보다 낮으면 0.
 */
export function pitchTrainingWindowProgressOf(
  career: PitcherCareer,
  row: number,
  column: number,
): { readonly count: number; readonly required: number } {
  const required = pitchTrainingRequiredSessionsOf(column)
  const cell = column === HIDDEN_PITCH_COLUMN ? hiddenProgressCellOf(career, row) : row * 2 + (column % 2)
  const stage = stageOf(career, cell)
  const half = Math.trunc(column / 2)
  if (isInPitchList(career, pitchTypeNumberOf(row, column)) || stage > half) return { count: required, required }
  return { count: stage === half ? pitchTrainingCountOf(career, cell) : 0, required }
}
