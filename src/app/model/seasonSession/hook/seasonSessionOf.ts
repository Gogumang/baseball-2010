import { EMPTY_LEAGUE } from '@/entities/league/model/league'
import { EMPTY_LEAGUE_PLAYER_STATS } from '@/entities/league/model/leaguePlayerStats'
import { DEFAULT_TEAM_MORALE } from '@/entities/team/model/teamMorale'
import { seasonAwardWindowTextOf } from '@/app/model/seasonSession/awards/seasonAwards'
import { seasonEntryCellSourceOf } from '@/app/model/seasonSession/records/entryCells'
import { EMPTY_ROSTER, cpuRosterOf, recordPitcherOrderOf, tradeRecordRosterOf } from '@/app/model/seasonSession/roster/roster'
import type { SeasonSession } from '@/app/model/seasonSession/types/session'
import type { SeasonEntryRecordSource } from '@/entities/season-mode/model/seasonEntry'
import { statusBoardMoraleOf } from '@/app/model/seasonSession/year/nextYear'
import type { SeasonActions } from '@/app/model/seasonSession/types/actions'
import type { SeasonAtoms } from '@/app/model/seasonSession/atoms/seasonScope'
import { seasonMvpKindAtom } from '@/app/model/seasonSession/atoms/eventAtoms'
import type { SeasonView } from '@/app/model/seasonSession/hook/useSeasonView'

/** 세션 바깥에서 받아 그대로 싣는 것 — 명전 기록 읽기 · 경기정보 선발 이름 */
interface SeasonSessionExtras {
  readonly recordSourceNow: () => SeasonEntryRecordSource | undefined
  readonly matchInfoStarterName: string | null
  readonly matchInfoOpponentStarterName: string | null
}

/** `useSeasonSession` 이 돌려주는 값 — 그림의 칸(`useSeasonView`)과 액션을 `SeasonSession` 꼴로 엮는다 */
export function seasonSessionOf(atoms: SeasonAtoms, view: SeasonView, extras: SeasonSessionExtras, actions: SeasonActions): SeasonSession {
  const { save, eventPlayback } = view
  const { recordSourceNow } = extras
  return {
    state: save?.state ?? null,
    scene: view.scene,
    league: save?.league ?? EMPTY_LEAGUE,
    roster: save?.roster ?? EMPTY_ROSTER,
    cpuRosterOf: (teamId: number) => cpuRosterOf(save, teamId),
    entryCellSourceOf: (teamId: number) => (save === null ? undefined : seasonEntryCellSourceOf(save, teamId, teamId === save.state.record.teamId)),
    recordSource: recordSourceNow,
    tradeRoster: save === null ? EMPTY_ROSTER : tradeRecordRosterOf(save, save.state.record.teamId, save.roster),
    myRecordAces: save?.recordAces?.[save.state.record.teamId],
    pitcherRecordOrder: save === null ? [] : recordPitcherOrderOf(save, save.state.record.teamId, save.roster.pitchers.length),
    tradeRosterOf: (teamId: number) => (save === null ? cpuRosterOf(save, teamId) : tradeRecordRosterOf(save, teamId, cpuRosterOf(save, teamId))),
    playerStats: save?.playerStats ?? EMPTY_LEAGUE_PLAYER_STATS,
    series: save?.series ?? null,
    ranking: save?.ranking ?? [],
    gameOptions: view.gameOptions,
    squadPurpose: view.squadPurpose,
    preGameAces: view.preGameAces,
    pendingGame: view.pendingGame,
    isMatchSettingsOpen: view.isMatchSettingsOpen,
    matchInfoStage: view.matchInfoStage,
    matchSettings: view.matchSettings,
    entryEdit: view.entryEdit,
    matchInfoStarterName: extras.matchInfoStarterName,
    matchInfoOpponentStarterName: extras.matchInfoOpponentStarterName,
    gameKind: view.gameKind,
    isGameInProgress: save?.isGameInProgress === true,
    resumeGame: view.resumeGame,
    leagueFirstAwardedBits: view.leagueFirstAwardedBits,
    // 지갑이 주인이다 (`?무한G` 도 지갑 안에서 갈린다) — `gamePointsOf` 주석 참고
    gamePoints: view.gamePoints,
    isNextGameFromMenu: view.isNextGameFromMenu,
    openedStadiumIds: view.openedStadiumIds,
    openedHiddenIds: view.openedHiddenIds,
    summaryEntry: view.summaryEntry,
    cup: save?.cup ?? null,
    statusBoardMorale: save === null ? DEFAULT_TEAM_MORALE : statusBoardMoraleOf(save),
    eventPlayback,
    tradeRequest: view.tradeRequest,
    trainingResult: view.trainingResult,
    outingPlace: view.outingPlace,
    outingResultText: view.outingResultText,
    incomeEvaluation: view.incomeEvaluation,
    awardWindowTextOf: (sub: number) =>
      save === null || eventPlayback === null
        ? null
        : seasonAwardWindowTextOf(eventPlayback.eventId, sub, save, recordSourceNow(), atoms.get(seasonMvpKindAtom)),
    isTradeRequestAlertOpen: view.isTradeRequestAlertOpen,
    menuCursors: view.menuCursors,
    notice: view.notice,
    actions,
  }
}
