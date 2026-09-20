import { formatOriginalMoney } from '@/features/shop/model/shopSelection'
import { MILLION_TO_TEN_THOUSAND } from '@/widgets/season/lib/seasonWindowLayout'

/**
 * 시즌 화면이 쓰는 글자 서식.
 *
 * 금액만 원본 서식이 확정이고(0x55cf4), 타율·방어율 표기는 **근사**다 — 시즌 목표 화면의
 * 그리기 함수를 P4 가 찾지 못해(2b 절은 표와 판정식까지만) 자릿수·소수점 표기를 알 수 없다.
 */

/**
 * 시즌 소지금·가격(100만 원 단위) → 원본 금액 글.
 * 원본은 `0x55cf5(g, 값 × 100)` 로 **만원 단위** 서식 `0x55cf4` 에 넘긴다 (S3 3절 · R12).
 * 예: 표값 3 → 가격 300(100만) → 30000(만원) → `"3억"`.
 */
export function seasonMoneyTextOf(millions: number): string {
  return formatOriginalMoney(millions * MILLION_TO_TEN_THOUSAND)
}

/**
 * 경기 수입 글 — 표시(0xdea0)는 `"수입: X만"` 으로 `SR+0x66 × 100` 을 찍는다 (J 4-7).
 * 그래서 여기서는 억 서식을 쓰지 않고 만원 수를 그대로 쓴다.
 */
export function incomeTextOf(millions: number): string {
  return `${millions * MILLION_TO_TEN_THOUSAND}만`
}

/** 팀 타율 — 목표 표는 ×1000 정수다 (P4 2b). 표기는 **근사** */
export function battingAverageTextOf(perMille: number): string {
  return `0.${String(Math.max(0, Math.trunc(perMille))).padStart(3, '0').slice(-3)}`
}

/** 팀 방어율 — 목표 표는 ×100 정수다 (P4 2b, "방어율로 보임" 유력). 표기는 **근사** */
export function earnedRunAverageTextOf(perHundred: number): string {
  const value = Math.max(0, Math.trunc(perHundred))
  return `${Math.trunc(value / 100)}.${String(value % 100).padStart(2, '0')}`
}
