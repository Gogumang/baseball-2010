import type { SeasonScope } from '@/app/model/seasonSession/atoms/seasonScope'
import { useSeasonValue } from '@/app/model/seasonSession/atoms/seasonScope'
import { globalsAtom, ownGamePointsAtom, rewardRecordAtom, saveAtom } from '@/app/model/seasonSession/atoms/saveAtoms'
import { gameKindAtom, gameOptionsAtom, noticeAtom, resumeGameAtom, sceneAtom } from '@/app/model/seasonSession/atoms/sceneAtoms'
import {
  entryEditAtom,
  isMatchSettingsOpenAtom,
  matchInfoStageAtom,
  nextGameFromMenuAtom,
  pendingGameAtom,
  preGameAcesAtom,
  squadPurposeAtom,
} from '@/app/model/seasonSession/atoms/nextGameAtoms'
import {
  eventPlaybackAtom,
  incomeEvaluationAtom,
  menuCursorsAtom,
  openedHiddenIdsAtom,
  outingPlaceAtom,
  outingResultTextAtom,
  summaryEntryAtom,
  tradeRequestAlertOpenAtom,
  tradeRequestAtom,
  trainingResultAtom,
} from '@/app/model/seasonSession/atoms/uiAtoms'
import { gamePointsOf } from '@/app/model/seasonSession/state/useGamePointPurse'
import { useSeasonMatchSettings } from '@/app/model/seasonSession/state/useSeasonMatchSettings'

/** 화면에 내보내는 세션 칸 — atom 을 그림에 읽는다 (`seasonSessionOf` 가 `SeasonSession` 꼴로 엮는다) */
export function useSeasonView(scope: SeasonScope) {
  const { atoms, wallet } = scope
  return {
    save: useSeasonValue(atoms, saveAtom),
    scene: useSeasonValue(atoms, sceneAtom),
    gameOptions: useSeasonValue(atoms, gameOptionsAtom),
    squadPurpose: useSeasonValue(atoms, squadPurposeAtom),
    preGameAces: useSeasonValue(atoms, preGameAcesAtom),
    pendingGame: useSeasonValue(atoms, pendingGameAtom),
    isMatchSettingsOpen: useSeasonValue(atoms, isMatchSettingsOpenAtom),
    matchInfoStage: useSeasonValue(atoms, matchInfoStageAtom),
    matchSettings: useSeasonMatchSettings(scope),
    entryEdit: useSeasonValue(atoms, entryEditAtom),
    gameKind: useSeasonValue(atoms, gameKindAtom),
    resumeGame: useSeasonValue(atoms, resumeGameAtom),
    leagueFirstAwardedBits: useSeasonValue(atoms, rewardRecordAtom).awardedBits,
    gamePoints: gamePointsOf(wallet, useSeasonValue(atoms, ownGamePointsAtom)),
    isNextGameFromMenu: useSeasonValue(atoms, nextGameFromMenuAtom),
    openedStadiumIds: useSeasonValue(atoms, globalsAtom).openedStadiumIds,
    openedHiddenIds: useSeasonValue(atoms, openedHiddenIdsAtom),
    summaryEntry: useSeasonValue(atoms, summaryEntryAtom),
    eventPlayback: useSeasonValue(atoms, eventPlaybackAtom),
    tradeRequest: useSeasonValue(atoms, tradeRequestAtom),
    trainingResult: useSeasonValue(atoms, trainingResultAtom),
    outingPlace: useSeasonValue(atoms, outingPlaceAtom),
    outingResultText: useSeasonValue(atoms, outingResultTextAtom),
    incomeEvaluation: useSeasonValue(atoms, incomeEvaluationAtom),
    isTradeRequestAlertOpen: useSeasonValue(atoms, tradeRequestAlertOpenAtom),
    menuCursors: useSeasonValue(atoms, menuCursorsAtom),
    notice: useSeasonValue(atoms, noticeAtom),
  }
}

export type SeasonView = ReturnType<typeof useSeasonView>
