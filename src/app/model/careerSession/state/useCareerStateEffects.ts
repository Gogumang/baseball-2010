import { useEffect } from 'react'
import { BATTER_LEAGUE_MODE, skillEquipStatEventsOf } from '@/entities/collection/model/annalsStats'
import { type CareerScope, useCareerValue } from '@/app/model/careerSession/atoms/careerScope'
import { equippedBeforeAtom, rawCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { progressAtom } from '@/app/model/careerSession/atoms/gameAtoms'

/**
 * 경기 중에 환경설정 "주루" 를 바꾸면 **그 자리에서** 먹게 잇는다 — 원본은 이 칸(설정 +0xbd)을
 * 매 틱 다시 읽으므로(`0x5261c`) 다음 경기까지 기다리지 않는다. 값이 같으면 손대지 않는다.
 */
export function useRunningModeSync({ atoms, runningModeManual }: CareerScope): void {
  useEffect(() => {
    const current = atoms.get(progressAtom)
    if (current === null || current.runningModeManual === runningModeManual) return
    atoms.set(progressAtom, { ...current, runningModeManual })
  }, [atoms, runningModeManual])
}

/**
 * **켠 스킬 통계** (`0xb663c` → `[mgr+0xc8]+0xf4`, 모드 4). 원본은 장착 0xa4b04 가 새로 켤 때마다 비트를 OR 한다 —
 * 켜는 길이 스킬 창(0x147b0)·획득 자동 장착(0xa4bd8, 이벤트·보상)으로 갈라져 있어, 커리어가 바뀔 때 앞뒤 장착 목록을
 * 견줘 새로 켜진 것만 적는다. 선수를 불러오거나 새로 만들 때(앞이 없거나 다른 선수)는 견주지 않는다.
 */
export function useEquippedSkillStat({ atoms, recordStat }: CareerScope): void {
  const rawCareer = useCareerValue(atoms, rawCareerAtom)
  useEffect(() => {
    const before = atoms.get(equippedBeforeAtom)
    if (rawCareer === null) {
      atoms.set(equippedBeforeAtom, null)
      return
    }
    atoms.set(equippedBeforeAtom, { name: rawCareer.name, ids: rawCareer.equippedSkillIds })
    if (before === null || before.name !== rawCareer.name || before.ids === rawCareer.equippedSkillIds) return
    skillEquipStatEventsOf(BATTER_LEAGUE_MODE, before.ids, rawCareer.equippedSkillIds).forEach(recordStat)
  }, [atoms, rawCareer, recordStat])
}
