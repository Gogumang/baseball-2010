/**
 * **시즌모드 내 팀 선수의 감점** (0xb581a 가 감싸는 세 가지 — 질병 0xb5824 · 보직 불일치 0xb5844 · 사기 정액 0xb58ac).
 */

/** 팀 질병 — s8 [시즌+6] > 0 이면 `v += (−30·v)/100` (0xb5824) */
export function illnessPenaltyOf(value: number): number {
  return Math.trunc((-30 * value) / 100)
}

/**
 * 팀 사기 **정액** 감소 (0xb58ac~0xb58e4).
 * `>50 없음 · 31~50 −50 · 11~30 −100 · ≤10 −200`, 0 아래로는 0.
 * ⚠️ 나만의리그(나리)의 사기 보정은 **비율**(−10%/−20%/−50%)이라 값이 다르다 — 섞어 쓰면 안 된다.
 */
export function moraleFlatPenaltyOf(morale: number): number {
  if (morale > 50) return 0
  if (morale > 30) return 50
  if (morale > 10) return 100
  return 200
}

/** 스킬 21 "모든 포지션 수비 가능" — 있으면 보직 벌점이 면제된다 (0xb62b4(p, 0x15)) */
export const ALL_POSITION_SKILL_ID = 21

/** 타자 한 명의 보직·자리 (보직 불일치 판정 입력) */
export interface FieldingAssignment {
  /** 레코드 +0x1c & 0xf — 수비 자리 코드. 0·1·10 은 벌점 면제 */
  readonly fieldPosition: number
  /** 레코드 +0xb & 3 (0xb6704) — 0 내야 · 1 외야 · 2 이상(지명 계열, 유력) */
  readonly positionBar: number
  readonly hasAllPositionSkill?: boolean
  /** 마선수(마타자·마투수)인가 — 0xb6278 이 "투수" 쪽으로 보내 벌점을 안 받는다 */
  readonly isAce?: boolean
}

/** 수비 자리 코드 — 0·1 · 10 은 벌점 면제, 내야 2~6 · 외야 7~9 */
const EXEMPT_POSITION_MAX = 1
const EXEMPT_POSITION_DESIGNATED = 10
const INFIELD_POSITIONS = { first: 2, last: 6 } as const
const OUTFIELD_POSITIONS = { first: 7, last: 9 } as const
/** 보직 `rec[+0xb] & 3` — 0 내야 · 1 외야 */
const POSITION_BAR = { infield: 0, outfield: 1 } as const

function isExemptPosition(position: number): boolean {
  return position <= EXEMPT_POSITION_MAX || position === EXEMPT_POSITION_DESIGNATED
}

/** 보직(내야/외야)에 맞는 자리인가 — 2 이상(지명 계열)은 어느 자리든 맞지 않는다 */
function fitsPositionBar(bar: number, position: number): boolean {
  if (bar === POSITION_BAR.infield) return position >= INFIELD_POSITIONS.first && position <= INFIELD_POSITIONS.last
  if (bar === POSITION_BAR.outfield) return position >= OUTFIELD_POSITIONS.first && position <= OUTFIELD_POSITIONS.last
  return false
}

/**
 * 보직 불일치 **−20%** (0xb5844~0xb58a4) — **시즌모드 내 팀 타자의 수비 칸에만** 붙는다.
 *
 * 설명서는 일반·대전에도 벌점이 있다고 하지만 **코드에는 모드 2 분기뿐이다** (J-3) — 0xb5804 갈래는 시즌 내 팀
 * (`[SR+1] == 팀레코드+0`, b5818)에서만 돌고 그 안의 b5844~b58a4 가 벌점이다. 원본대로 시즌에만 붙인다.
 */
export function hasPositionMismatch(assignment: FieldingAssignment): boolean {
  if (assignment.isAce === true || assignment.hasAllPositionSkill === true) return false
  const position = assignment.fieldPosition & 0xf
  if (isExemptPosition(position)) return false
  return !fitsPositionBar(assignment.positionBar & 3, position)
}

/** 보직 벌점 — `v += v/(−5)` (0xb5898). 정수 나눗셈은 0 쪽 버림이다 */
export function positionMismatchPenaltyOf(value: number): number {
  return Math.trunc(value / -5)
}
