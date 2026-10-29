import { useCallback } from 'react'
import { SALARY_EVENT_ID, salaryOfferOf } from '@/entities/career/model/seasonFlow'
import { formatOriginalMoney } from '@/features/shop/model/shopSelection'
import { type PitcherAtoms, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'

/** 연봉 칸 한 단위(100만원)를 금액 서식(만원 단위)으로 — 0x8bc4c 의 ×100 */
const MONEY_TEXT_SCALE = 100

/** 380 "올해 네 연봉은 %s만 상승해서 %s만이다" — 0x8bc4c 가 상승분·새 연봉을 ×100 해서 금액 서식 0x55cf4 로 */
export function useStoryReplacements(atoms: PitcherAtoms) {
  const career = usePitcherValue(atoms, careerAtom)
  return useCallback(
    (eventId: number): readonly string[] | undefined => {
      if (career === null || eventId !== SALARY_EVENT_ID) return undefined
      const offer = salaryOfferOf(career)
      return [formatOriginalMoney(offer.raise * MONEY_TEXT_SCALE), formatOriginalMoney(offer.salary * MONEY_TEXT_SCALE)]
    },
    [career],
  )
}
