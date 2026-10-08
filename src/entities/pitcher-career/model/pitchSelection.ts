import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  HIDDEN_PITCH_COLUMN,
  PITCH_TRAINING_TABLE,
  pitchTrainingStageOf,
  pitchTypeNumberOf,
} from '@/entities/pitcher-career/model/pitchTraining'

/**
 * 123 창(선수정보 → [구질])의 **고르기** — 키 처리 `0x17cec` (H-4 "필살타법(투수는 마구) 선택" 확정).
 *
 * 창 탭은 팝업 0x78 이 정한다 — **1 마구 · 2 구질**(R9 178행).
 *
 * 탭 1(마구) 칸 i(0~3):
 *   1. 이미 사용 중(레코드 `+0x18` == 표[i]) → StrMODE[69] "현재 사용 중인 스킬입니다"
 *   2. 배운 수(저장 `+0x201` = `magicLevel`) ≤ i → StrMODE[71] "트레이닝 완료 후 사용할 수 있습니다"
 *   3. 아니면 StrMODE[70] "[이름] 을 사용하시겠습니까?" → 확인하면 `+0x18 = 표[i]`
 *
 * 탭 2(구질)는 표 0xcc390 의 칸(행, 열)을 고른다 — `pitchCellSelectBlockReasonOf` · `selectPitchCell`.
 */

/** 123 창 마구 칸의 번호표 — 투수 `0xcc368` = [1,2,3,4] (타자 0xcc378 과 같은 값, H2 1-2) */
export const MAGIC_PITCH_CELL_NUMBERS: readonly number[] = [1, 2, 3, 4]

/** 고르기를 막는 까닭 — 글은 화면 쪽(StrMODE 69·71·72)이 고른다 */
export type PitchSelectBlockReason = '사용중' | '훈련필요'

/** 칸 i 의 마구 번호 (표 0xcc368). 칸 밖이면 0 */
export function magicNumberOfCell(cellIndex: number): number {
  return MAGIC_PITCH_CELL_NUMBERS[cellIndex] ?? 0
}

export function magicSelectBlockReasonOf(career: PitcherCareer, cellIndex: number): PitchSelectBlockReason | null {
  const number = magicNumberOfCell(cellIndex)
  if (number === 0) return '훈련필요'
  // 차례가 원본 그대로다 — "사용 중" 검사가 "배운 수" 검사보다 **앞**이다 (0x17cec)
  if (career.selectedMagicNumber === number) return '사용중'
  return career.magicLevel <= cellIndex ? '훈련필요' : null
}

/** 마구 칸 하나를 고른다 (레코드 +0x18 = 표[i]) */
export function selectMagicPitch(career: PitcherCareer, cellIndex: number): PitcherCareer {
  const reason = magicSelectBlockReasonOf(career, cellIndex)
  if (reason !== null) throw new Error(`마구를 고를 수 없습니다 (${reason})`)
  return { ...career, selectedMagicNumber: magicNumberOfCell(cellIndex) }
}

/** 등록이 무조건 주는 FASTBALL (구질 번호 1) — 마스크에 없어도 0xb6d5e 가 칸 0 에 넣는다 (J 3-1) */
export const FASTBALL_TYPE_NUMBER = 1

/** 구질 목록 칸 표 `0xd8920` — 구질 t 의 칸 (FASTBALL 0 · 표 0xcc390 의 행 r 은 칸 r + 1) */
const LIST_SLOT_OF_TYPE: readonly number[] = [6, 0, 1, 1, 2, 2, 3, 3, 4, 4, 1, 1, 2, 2, 3, 3, 4, 4, 1, 2, 3, 4]
const LAST_ORDINARY_TYPE = 21

const hasMaskBit = (career: PitcherCareer, typeNumber: number) =>
  typeNumber > 0 && ((career.pitchMask >>> (typeNumber - 1)) & 1) === 1

/**
 * 지금 경기 구질 목록에 든 구질인가 — `0xa436c(S, t)`: 내 레코드로 목록 0xb6d2d(레코드, 칸, 6)를 세워 칸 1~5 에 t 가 있는지 본다.
 * 목록은 마스크 비트를 구질 번호 차례로 훑어 칸 0xd8920[t] 에 덮어쓰므로 **한 칸(행)에는 번호가 큰 구질 하나만** 남는다.
 */
export function isInPitchList(career: PitcherCareer, typeNumber: number): boolean {
  if (typeNumber <= FASTBALL_TYPE_NUMBER || typeNumber > LAST_ORDINARY_TYPE || !hasMaskBit(career, typeNumber)) return false
  const slot = LIST_SLOT_OF_TYPE[typeNumber]
  for (let later = typeNumber + 1; later <= LAST_ORDINARY_TYPE; later += 1) {
    if (LIST_SLOT_OF_TYPE[later] === slot && hasMaskBit(career, later)) return false
  }
  return true
}

/** 123 탭 2 의 칸 열 — 커서 열은 `min(열, 4)` 로 읽는다 (0x17e30) */
const columnOf = (column: number) => Math.min(column, HIDDEN_PITCH_COLUMN)

/**
 * 그 칸을 다 배웠나 — 0x17e6e~0x17eb8: 열 0~3 은 칸(행·2 + 열%2) 단계 > 열/2, 열 4(히든)는 그 행 두 칸 중 하나라도 단계 > 2
 * (히든 훈련을 마치면 단계가 3 이 된다 — `applyPitchTypeTraining`).
 */
export function isPitchCellLearned(career: PitcherCareer, row: number, column: number): boolean {
  const col = columnOf(column)
  if (col === HIDDEN_PITCH_COLUMN) return [0, 1].some((offset) => (career.pitchTrainingStages[row * 2 + offset] ?? 0) > 2)
  return pitchTrainingStageOf(career, row, col) > Math.trunc(col / 2)
}

/**
 * 123 창 탭 2 확인 키 — **0x17df8~0x17ed8** (직접 떴다):
 * ```
 * 17e48  0xa436c(S, 0xcc390[행][min(열,4)]) — 지금 목록에 있으면 StrMODE[72] "현재 사용 중인 구질입니다"
 * 17e6e  그 칸을 다 배우지 않았으면(`isPitchCellLearned`) StrMODE[71] "트레이닝 완료 후 사용할 수 있습니다"
 * 17ec4  그 밖 StrMODE[73] "해당 구질을 사용하시겠습니까?" (예/아니오 — 예면 `selectPitchCell`)
 * ```
 * 가드는 보유 마스크가 아니라 **훈련 단계**를 본다 — 구질 훈련(0xa3bac 종류 5)은 마스크를 안 건드린다.
 */
export function pitchCellSelectBlockReasonOf(
  career: PitcherCareer,
  row: number,
  column: number,
): PitchSelectBlockReason | null {
  const typeNumber = pitchTypeNumberOf(row, columnOf(column))
  if (typeNumber === 0) return '훈련필요'
  if (isInPitchList(career, typeNumber)) return '사용중'
  return isPitchCellLearned(career, row, column) ? null : '훈련필요'
}

/**
 * 123 탭 2 의 [예] — 갱신 0x17bf4 의 탭 2 갈래(0x17c68~0x17cc2): 그 행의 다섯 구질 `0xcc390[행][0..4]` 비트를 모두 지우고
 * (0xb6e11 — 마스크 +0x1c BIC 0xd88c4[t]) 고른 `0xcc390[행][min(열,4)]` 하나만 켠다(0xb6dfd — ORR). **한 계열에 구질 하나**다.
 * 마스크는 경기 구질 목록(0xb6d2c)이 그대로 읽는다.
 */
export function selectPitchCell(career: PitcherCareer, row: number, column: number): PitcherCareer {
  const reason = pitchCellSelectBlockReasonOf(career, row, column)
  if (reason !== null) throw new Error(`구질을 고를 수 없습니다 (${reason})`)
  const rowBits = (PITCH_TRAINING_TABLE[row] ?? []).reduce((bits, typeNumber) => bits | (1 << (typeNumber - 1)), 0)
  const chosen = pitchTypeNumberOf(row, columnOf(column))
  return { ...career, pitchMask: ((career.pitchMask & ~rowBits) | (1 << (chosen - 1))) >>> 0 }
}
