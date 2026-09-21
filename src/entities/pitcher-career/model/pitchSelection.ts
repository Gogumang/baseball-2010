import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { hasPitchType } from '@/entities/pitcher-career/model/pitchTraining'

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
 * 탭 2(구질)도 같은 꼴이다 — StrMODE[72] "현재 사용 중인 구질입니다" · [73] "해당 구질을
 * 사용하시겠습니까?" (Q0 108·123 줄). ⚠️ **고른 구질이 들어가는 원본 칸은 문서에 없다**:
 * 경기의 구질 칸 6개는 0xb6d2c 가 마스크 `+0x1c` 만으로 만든다(H2 3-1). 그래서 여기서는
 * 커리어의 `selectedPitchType` 에만 적어 두고 경기로는 넘기지 않는다 — 칸이 밝혀지면 그리로 옮긴다.
 */

/** 123 창 마구 칸의 번호표 — 투수 `0xcc368` = [1,2,3,4] (타자 0xcc378 과 같은 값, H2 1-2) */
export const MAGIC_PITCH_CELL_NUMBERS: readonly number[] = [1, 2, 3, 4]

/** 고르기를 막는 까닭 — 글은 화면 쪽(StrMODE 69·71·72)이 고른다 */
export type PitchSelectBlockReason = '사용중' | '훈련필요' | '미보유'

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

/** 지금 던질 수 있는 구질 — FASTBALL + 마스크 +0x1c 의 비트 (0xb6d44) */
export function ownsPitchType(career: PitcherCareer, typeNumber: number): boolean {
  return typeNumber === FASTBALL_TYPE_NUMBER || hasPitchType(career, typeNumber)
}

export function pitchTypeSelectBlockReasonOf(
  career: PitcherCareer,
  typeNumber: number,
): PitchSelectBlockReason | null {
  if (!ownsPitchType(career, typeNumber)) return '미보유'
  return career.selectedPitchType === typeNumber ? '사용중' : null
}

/** 구질 하나를 고른다 (⚠️ 원본 저장 칸 미확인 — `selectedPitchType` 주석 참고) */
export function selectPitchType(career: PitcherCareer, typeNumber: number): PitcherCareer {
  const reason = pitchTypeSelectBlockReasonOf(career, typeNumber)
  if (reason !== null) throw new Error(`구질을 고를 수 없습니다 (${reason})`)
  return { ...career, selectedPitchType: typeNumber }
}
