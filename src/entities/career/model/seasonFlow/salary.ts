import { isBugFixed } from '@/shared/config/bugfixes'

export const SALARY_EVENT_ID = 380
export const SALARY_FIRM_EVENT_ID = 381
export const SALARY_POLITE_EVENT_ID = 382
export const SALARY_ACCEPT_EVENT_ID = 383

/** 연봉 결과 등급 k 의 구간 — k ≥ 5 → 0 · ≥ 3 → 1 · ≥ 1 → 2 · 그 밖 3 */
const SALARY_RESULT_RANKS: readonly (readonly [minimumRank: number, offset: number])[] = [
  [5, 0],
  [3, 1],
  [1, 2],
]
const LOWEST_SALARY_RESULT_OFFSET = 3
/** 381(강하게) 결과는 384~387, 그 밖(382 정중하게)은 388~391 */
const FIRM_SALARY_RESULT_BASE = 384
const POLITE_SALARY_RESULT_BASE = 388

/** 연봉 결과 — 등급 k = 타이틀 1위 수 + (MVP 면 2) */
export function salaryResultEventId(choiceEventId: number, rank: number): number {
  const offset = SALARY_RESULT_RANKS.find(([minimumRank]) => rank >= minimumRank)?.[1] ?? LOWEST_SALARY_RESULT_OFFSET
  return (choiceEventId === SALARY_FIRM_EVENT_ID ? FIRM_SALARY_RESULT_BASE : POLITE_SALARY_RESULT_BASE) + offset
}

/** 보상 20 의 값 → 연봉 변동률(%) */
const SALARY_RATE: readonly number[] = [30, 20, 10, -20, 20, 10, 5, -10, 0]

/** 연봉 칸 +0x1c8 은 u16 — 쓰기 0xa4fd8 이 자르지 않고 `strh` 로 넣어 65536 을 넘으면 아래 16비트만 남는다(감긴다) */
const SALARY_MASK = 0xffff

/**
 * 연봉협상에 필요한 칸 — 타자편 `PlayerCareer` 와 투수편 `PitcherCareer` 가 같은 커리어 칸
 * (인기도 0xb6e79 · 시즌 시작 인기도 career+0x78 · 연봉 career+0x1c8)을 쓴다.
 * 원본도 한 벌의 함수(0xa39fc · 0x8cac0)가 모드 3·4 를 같이 돈다.
 */
export interface SalaryHolder {
  readonly popularity: number
  readonly popularityAtSeasonStart: number
  readonly salary: number
  /** 레코드 +0x1b — 0xa4fd8 이 감기기 전 v 로 쓴 값 (`nariRecordSalaryGradeOfCareer`) */
  readonly salaryRecordGrade?: number
}

/**
 * 380 제시액 (0x8bc4c → 0xa39fc). 상승분 = max(1, trunc((인기도 − 시즌 시작 인기도) / 4)),
 * 새 연봉 = 상승분 + 현재 연봉. 단위는 100만원 한 칸 — 대사 "%s만 상승해서 %s만" 은 둘 다 ×100 해서
 * 금액 서식 0x55cf4 로 찍는다.
 */
export function salaryOfferOf(career: SalaryHolder): { readonly raise: number; readonly salary: number } {
  const raise = Math.max(1, Math.trunc((career.popularity - career.popularityAtSeasonStart) / 4))
  return { raise, salary: raise + career.salary }
}

/**
 * 연봉 = base ± trunc(base × 변동률 / 100), base = max(1, trunc(인기도 상승/4)) + 이전 연봉 (0x8cac0).
 * 단위는 원본 그대로 100만원 한 칸이다 (관리 화면이 ×100 해서 만원으로 보여 준다).
 * 새 값은 0xa4fd8 `strh` 로 쓰여 u16 으로 감긴다(상한에 붙지 않는다 — 원본 버그 B-69, 고친 길은 65535 에 붙인다).
 */
export function applySalaryChange<C extends SalaryHolder>(career: C, code: number): C {
  const base = salaryOfferOf(career).salary
  const rate = SALARY_RATE[code] ?? 0
  const change = Math.sign(rate) * Math.trunc((base * Math.abs(rate)) / 100)
  // 0x8cac0 의 v 는 32비트 정수(8cada · 8cb28)라 0xa4fd8 의 레코드 +0x1b 는 감기기 전 v 로 센다(a4ff6~a5006)
  const salary = base + change
  // ⚠️ 원본 버그(B-69): 0xa4fe2 `strh` 가 자르지 않아 65535 를 넘으면 아래 16비트만 남는다(큰 연봉이 작은 값으로 돈다).
  // 고침(bugfixes.json B-69, 기본 켬): u16 상한 65535 에 붙인다. 레코드 +0x1b 는 어느 쪽이든 감기기 전 v 로 센다(0xff). 굴림 없음
  const stored = isBugFixed('B-69') ? Math.min(salary, SALARY_MASK) : salary & SALARY_MASK
  return { ...career, salary: stored, salaryRecordGrade: nariRecordSalaryGradeOf(salary) }
}

/** 레코드 +0x1b 는 바이트 — 0xa4ffe `movs r3, #0xff ; cmp r0, #0xff ; bge` */
const RECORD_SALARY_GRADE_MAXIMUM = 0xff
const RECORD_SALARY_GRADE_DIVISOR = 10

/**
 * **나리 선수 레코드 +0x1b** — 연봉 쓰기 `0xa4fd8(S, v)` (직접 떴다):
 * ```
 * a4fda~a4fe2  S+0x1c8 = v (strh)
 * a4fec        rec = 0x1fc75(app, [0x1552d10] 모드)            ; 내 나리 선수 레코드
 * a4ff2~a5006  rec+0x1b = min(v / 10 (부호 나눗셈 0xca7b4), 0xff)
 * ```
 * 부르는 곳은 등록 0x10fb4(11246, v = 0x32) · 보상 종류 20(8cb84) 둘뿐이라 +0x1b 는 늘 지금 연봉의 1/10 이다. 등록 0x1f654 ·
 * 0x1f680 과 시즌 영입 0xc554 는 이 0x30 바이트를 통째로 옮기므로 명전 · 영입 선수도 그때의 값을 든다. 시즌(모드 2) 상세 창
 * 0x5b798(5c848~5c886)은 이 칸 × 1000 을 연봉으로 찍는다.
 * v 는 0x8cac0 의 32비트 정수(감기기 전)라 v ≥ 65536 이면 S+0x1c8 은 감겨도 +0x1b 는 0xff 다(r244 — 8cada `ldrh` + 상승분 ·
 * 8cb28 `adds` 뒤 곧장 a4fd8 로, 자르는 곳이 없다). 그래서 보상 20 이 그때 값을 `salaryRecordGrade` 에 남기고
 * (`applySalaryChange`) 레코드를 베끼는 곳은 `nariRecordSalaryGradeOfCareer` 로 읽는다.
 */
export function nariRecordSalaryGradeOf(salary: number): number {
  return Math.min(Math.trunc(salary / RECORD_SALARY_GRADE_DIVISOR), RECORD_SALARY_GRADE_MAXIMUM)
}

/** 레코드 +0x1b — 마지막 연봉 쓰기 0xa4fd8 가 남긴 값. 그 값이 없으면(등록 그대로 · 옛 저장) 지금 연봉에서 센다 */
export function nariRecordSalaryGradeOfCareer(career: Pick<SalaryHolder, 'salary' | 'salaryRecordGrade'>): number {
  return career.salaryRecordGrade ?? nariRecordSalaryGradeOf(career.salary)
}
