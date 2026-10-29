import { useEffect } from 'react'
import { PITCHER_LEAGUE_MODE, skillEquipStatEventsOf } from '@/entities/collection/model/annalsStats'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom, equippedBeforeAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'

/**
 * **켠 스킬 통계** (`0xb663c` → `[mgr+0xc8]+0xf8`, 모드 3) — 장착 0xa4b04 가 새로 켤 때마다 비트를 OR 한다.
 * 켜는 길(스킬 창 0x147b0 · 획득 자동 장착 0xa4bd8)이 어디든 앞뒤 장착 목록을 견줘 새로 켜진 것만 적는다.
 * 불러오기·새 선수(앞이 없거나 다른 선수)는 견주지 않는다.
 */
export function useEquippedSkillStat({ atoms, recordStat }: PitcherScope): void {
  const career = usePitcherValue(atoms, careerAtom)
  useEffect(() => {
    const before = atoms.get(equippedBeforeAtom)
    if (career === null) {
      atoms.set(equippedBeforeAtom, null)
      return
    }
    atoms.set(equippedBeforeAtom, { name: career.name, ids: career.equippedSkillIds })
    if (before === null || before.name !== career.name || before.ids === career.equippedSkillIds) return
    skillEquipStatEventsOf(PITCHER_LEAGUE_MODE, before.ids, career.equippedSkillIds).forEach(recordStat)
  }, [atoms, career, recordStat])
}
