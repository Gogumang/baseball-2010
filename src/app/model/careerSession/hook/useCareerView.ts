import { type CareerScope, useCareerValue } from '@/app/model/careerSession/atoms/careerScope'
import { savedCareerAtom } from '@/app/model/careerSession/atoms/careerAtoms'
import * as gameAtoms from '@/app/model/careerSession/atoms/gameAtoms'
import { isYearCoverHeldAtom } from '@/app/model/careerSession/atoms/sceneAtoms'
import * as uiAtoms from '@/app/model/careerSession/atoms/uiAtoms'

/** 세션이 내보이는 그림 값 (옛 `useState` 값 자리) — 차례는 옛 반환 모양 그대로 */
export function useCareerView({ atoms, screen }: CareerScope) {
  const entryView = useCareerValue(atoms, uiAtoms.entryViewAtom)
  return {
    savedCareer: useCareerValue(atoms, savedCareerAtom),
    progress: useCareerValue(atoms, gameAtoms.progressAtom),
    shopNotice: useCareerValue(atoms, uiAtoms.shopNoticeAtom),
    /** 새 시즌 0x1b768 뒤 앞 상태(134 · 141)가 아직 그리는 아홉 틀 — 앱이 그 화면 위에 효과기를 칠한다 */
    isYearCoverHeld: useCareerValue(atoms, isYearCoverHeldAtom),
    shopGpDetail: useCareerValue(atoms, uiAtoms.shopGpDetailAtom),
    outingNotice: useCareerValue(atoms, uiAtoms.outingNoticeAtom),
    outingResult: useCareerValue(atoms, uiAtoms.outingResultAtom),
    outingPresentation: useCareerValue(atoms, uiAtoms.outingPresentationAtom),
    managementNotice: useCareerValue(atoms, uiAtoms.managementNoticeAtom),
    managementDetail: useCareerValue(atoms, uiAtoms.managementDetailAtom),
    loadingTip: useCareerValue(atoms, gameAtoms.loadingTipAtom),
    stadiumSkyRow: useCareerValue(atoms, gameAtoms.stadiumSkyRowAtom),
    sceneStadium: useCareerValue(atoms, gameAtoms.sceneStadiumAtom),
    matchInfoStage: useCareerValue(atoms, uiAtoms.matchInfoStageAtom),
    matchAces: useCareerValue(atoms, uiAtoms.matchAcesAtom),
    /** 143 경기 전 엔트리 보기 — 142(`경기준비`) 위에 선다 */
    entryView: screen.kind === '경기준비' ? entryView : null,
  }
}
