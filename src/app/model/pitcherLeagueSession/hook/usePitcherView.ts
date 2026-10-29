import type { PitcherScope } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { managementBgmRestartAtom, sceneAtom, storyAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import {
  endingFromResumeAtom,
  heldEndingIndexAtom,
  isYearCoverHeldAtom,
  postseasonPopupAtom,
  yearCoverAfterHoldAtom,
  yearCoverFromResumeAtom,
} from '@/app/model/pitcherLeagueSession/atoms/yearEndAtoms'
import {
  aceMatchAtom,
  cupMatchAtom,
  cupViewAtom,
  entryViewAtom,
  gameOptionsAtom,
  matchAcesAtom,
  matchInfoStageAtom,
  nextGameFromManagementAtom,
} from '@/app/model/pitcherLeagueSession/atoms/gameAtoms'
import {
  outingNoticeAtom,
  outingPresentationAtom,
  outingRecoveryNoticeAtom,
  outingResultAtom,
  outingReturnPlaceIdAtom,
  shopGpDetailAtom,
  shopNoticeAtom,
  shopTabAtom,
} from '@/app/model/pitcherLeagueSession/atoms/uiAtoms'

/** 세션이 내보이는 화면 칸 — atom 을 그림에 읽는다 (커리어 · 이벤트 목록 · 칭호 · 액션은 세션 훅이 붙인다) */
export function usePitcherView({ atoms }: PitcherScope) {
  const scene = usePitcherValue(atoms, sceneAtom)
  const entryView = usePitcherValue(atoms, entryViewAtom)
  return {
    scene,
    yearCoverFromResume: usePitcherValue(atoms, yearCoverFromResumeAtom),
    isYearCoverHeld: usePitcherValue(atoms, isYearCoverHeldAtom),
    yearCoverAfterHold: usePitcherValue(atoms, yearCoverAfterHoldAtom),
    heldEndingIndex: usePitcherValue(atoms, heldEndingIndexAtom),
    endingFromResume: usePitcherValue(atoms, endingFromResumeAtom),
    managementBgmRestart: usePitcherValue(atoms, managementBgmRestartAtom),
    nextGameFromManagement: usePitcherValue(atoms, nextGameFromManagementAtom),
    matchAces: usePitcherValue(atoms, matchAcesAtom),
    matchInfoStage: usePitcherValue(atoms, matchInfoStageAtom),
    entryView: scene === '경기준비' ? entryView : null,
    gameOptions: usePitcherValue(atoms, gameOptionsAtom),
    shopTab: usePitcherValue(atoms, shopTabAtom),
    shopNotice: usePitcherValue(atoms, shopNoticeAtom),
    shopGpDetail: usePitcherValue(atoms, shopGpDetailAtom),
    outingNotice: usePitcherValue(atoms, outingNoticeAtom),
    outingResult: usePitcherValue(atoms, outingResultAtom),
    outingPresentation: usePitcherValue(atoms, outingPresentationAtom),
    outingRecoveryNotice: usePitcherValue(atoms, outingRecoveryNoticeAtom),
    story: usePitcherValue(atoms, storyAtom),
    outingReturnPlaceId: usePitcherValue(atoms, outingReturnPlaceIdAtom),
    aceMatch: usePitcherValue(atoms, aceMatchAtom),
    postseasonPopup: usePitcherValue(atoms, postseasonPopupAtom),
    cup: usePitcherValue(atoms, cupViewAtom),
    cupMatch: usePitcherValue(atoms, cupMatchAtom),
  }
}
