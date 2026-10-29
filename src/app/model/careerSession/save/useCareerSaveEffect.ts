import { useEffect } from 'react'
import { savedCareerOf } from '@/entities/career/model/seasonFlow'
import { type CareerScope, useCareerValue } from '@/app/model/careerSession/atoms/careerScope'
import { isSaveErasedAtom, rawCareerAtom, savedCareerAtom, unsavedCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import { useShownCareer } from '@/app/model/careerSession/state/useShownCareer'

/**
 * 커리어가 바뀔 때마다 저장한다. 저장 실패는 게임 진행을 막지 않는다.
 * 원본은 저장(0x22755)을 부르는 자리가 67곳으로 정해져 있다(re.py xref 0x22754). 이벤트 재생 중에는 보상 명령마다(0x8c460 끝 —
 * 0x8b0e4 · 0x8cd44), system 창 답 0(0x7fe90), 경기 명령(0x8d870), 마지막 명령 뒤 끝(0x8cfc0)과 114 끝 처리(0x1c014)가
 * 저장한다 — 웹 커리어가 이벤트 중에 바뀌는 자리(보상 · 목표 창 · 끝)가 모두 그 자리라 이 자리에서는 원본보다 잦지 않다
 * (`giveEventReward`). 관리 장면(0x106) 안의 저장 안 하는 변경(122 스킬 켬/끔 0x147b0 의 3·4 → 0xa4b04 만 · 129 칭호 등)은
 * 메인 메뉴로 나가는 길이 늘 105 진입 0x11910(119a2 — 조건 없이 저장)을 지나므로 웹이 곧바로 써도 재진입 결과가 같다.
 * 장면 밖으로 저장 없이 나가는 길은 경기 중 나가기 0x40140 하나라, 경기 중 변경(돌발 보상 0x8e34c)만 `unsavedCareerAtom` 으로 뺀다.
 */
export function useCareerSaveEffect(scope: CareerScope): void {
  const { atoms, saveGame } = scope
  const career = useShownCareer(scope)
  const rawCareer = useCareerValue(atoms, rawCareerAtom)
  useEffect(() => {
    if (career === null || atoms.get(isSaveErasedAtom)) return
    if (rawCareer !== null && rawCareer === atoms.get(unsavedCareerAtom)) return
    // 판정 없음(e = −1) 엔딩은 141 이 저장하지 않는다 — 엔딩 칸을 비운 114 끝의 커리어가 남는다 (`savedCareerOf`)
    const persisted = savedCareerOf(career)
    saveGame.save(persisted)
    atoms.set(savedCareerAtom, persisted)
  }, [atoms, career, rawCareer, saveGame])
}
