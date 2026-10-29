import { EMPTY_LEAGUE } from '@/entities/league/model/league'
import { EMPTY_LEAGUE_PLAYER_STATS } from '@/entities/league/model/leaguePlayerStats'
import { DEFAULT_TEAM_MORALE } from '@/entities/team/model/teamMorale'
import { seasonAwardWindowTextOf } from '@/app/model/seasonSession/awards/seasonAwards'
import { seasonEntryCellSourceOf } from '@/app/model/seasonSession/records/entryCells'
import { EMPTY_ROSTER, cpuRosterOf, recordPitcherOrderOf, tradeRecordRosterOf } from '@/app/model/seasonSession/roster/roster'
import type { SeasonSession } from '@/app/model/seasonSession/types/session'
import { statusBoardMoraleOf } from '@/app/model/seasonSession/year/nextYear'
import type { GameProgressActionsContext } from '@/app/model/seasonSession/game/useGameProgressActions'

/** `useSeasonSession` 이 돌려주는 값 — 훅 몸통 끝 `return` 을 그대로 옮겼다 (r346) */
export function seasonSessionOf(ctx: GameProgressActionsContext): SeasonSession {
  const { save, scene, recordSourceNow, gameOptions, squadPurpose, preGameAces, pendingGame, isMatchSettingsOpen, matchInfoStage } = ctx
  const { seasonMatchSettings, entryEdit, matchInfoStarterName, matchInfoOpponentStarterName, gameKind, resumeGame, leagueFirstAwardedBits } = ctx
  const { gamePoints, nextGameFromMenu, openedStadiumIds, openedHiddenIds, summaryEntry, eventPlayback, tradeRequest, trainingResult } = ctx
  const { outingPlace, outingResultText, incomeEvaluation, seasonMvpKindRef, isTradeRequestAlertOpen, menuCursors, notice, chooseTeam, goto } = ctx
  const { clearRecordAces, updateRecord, updateRoster, removeHallOfFamer, removeCareerPlayer, resetSeason, finishTrade, equipSeasonPlayer } = ctx
  const { buySeasonSubItem, buySeasonGpItem, recoverSeasonPitcherStamina, playNextGame, openNextGame, confirmNextGame, cancelNextGame } = ctx
  const { confirmIncome, confirmDayResults, answerTradeRequest, cancelTradeRequest, closeTradeResult, moveMenuCursor, choosePreGameAceAction } = ctx
  const { cancelPreGameAceAction, startPendingGame, cancelMatchInfo, toggleMatchSettings, applyMatchSettings, openEntryEdit } = ctx
  const { pressEntryKeyAction, pointEntryCursorAction, closeEntryAceLocked, playCupGame, finishCup, finishGame, constructScene } = ctx
  const { pressManagementConfirm, saveGameProgress, enterGameSettlement, resumeSavedGame, leaveGame, continuePostseason, runTraining } = ctx
  const { closeTrainingResult, enterOuting, runOuting, closeOutingResult, awardLeagueFirst, spendGamePoint, finishSeason, openStadiumItems } = ctx
  const { openCupHiddenTeams, receiveEndingBonus, finishEnding, finishSeasonEvent, giveSeasonEventReward, confirmSeasonEventChoice } = ctx
  const { confirmEventSystemWindow, clearNotice, quit } = ctx
  return {
    state: save?.state ?? null,
    scene,
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
    gameOptions,
    squadPurpose,
    preGameAces,
    pendingGame,
    isMatchSettingsOpen,
    matchInfoStage,
    matchSettings: seasonMatchSettings,
    entryEdit,
    matchInfoStarterName,
    matchInfoOpponentStarterName,
    gameKind,
    isGameInProgress: save?.isGameInProgress === true,
    resumeGame,
    leagueFirstAwardedBits,
    // 지갑이 주인이다 (`?무한G` 도 지갑 안에서 갈린다) — 위 `gamePoints` 주석 참고
    gamePoints,
    isNextGameFromMenu: nextGameFromMenu,
    openedStadiumIds,
    openedHiddenIds,
    summaryEntry,
    cup: save?.cup ?? null,
    statusBoardMorale: save === null ? DEFAULT_TEAM_MORALE : statusBoardMoraleOf(save),
    eventPlayback,
    tradeRequest,
    trainingResult,
    outingPlace,
    outingResultText,
    incomeEvaluation,
    awardWindowTextOf: (sub: number) =>
      save === null || eventPlayback === null
        ? null
        : seasonAwardWindowTextOf(eventPlayback.eventId, sub, save, recordSourceNow(), seasonMvpKindRef.current),
    isTradeRequestAlertOpen,
    menuCursors,
    notice,
    actions: {
      chooseTeam,
      goto,
      clearRecordAces,
      updateRecord,
      updateRoster,
      removeHallOfFamer,
      removeCareerPlayer,
      resetSeason,
      finishTrade,
      equipSeasonPlayer,
      buySeasonSubItem,
      buySeasonGpItem,
      recoverSeasonPitcherStamina,
      playNextGame,
      openNextGame,
      confirmNextGame,
      cancelNextGame,
      confirmIncome,
      confirmDayResults,
      answerTradeRequest,
      cancelTradeRequest,
      closeTradeResult,
      moveMenuCursor,
      choosePreGameAce: choosePreGameAceAction,
      cancelPreGameAce: cancelPreGameAceAction,
      startPendingGame,
      cancelMatchInfo,
      toggleMatchSettings,
      applyMatchSettings,
      openEntryEdit,
      pressEntryKey: pressEntryKeyAction,
      pointEntryCursor: pointEntryCursorAction,
      closeEntryAceLocked,
      playCupGame,
      finishCup,
      finishGame,
      constructScene,
      pressManagementConfirm,
      saveGameProgress,
      enterGameSettlement,
      resumeSavedGame,
      leaveGame,
      continuePostseason,
      runTraining,
      closeTrainingResult,
      enterOuting,
      runOuting,
      closeOutingResult,
      awardLeagueFirst,
      spendGamePoint,
      finishSeason,
      openStadiumItems,
      openCupHiddenTeams,
      receiveEndingBonus,
      finishEnding,
      finishSeasonEvent,
      giveSeasonEventReward,
      confirmSeasonEventChoice,
      confirmEventSystemWindow,
      clearNotice,
      quit,
    },
  }
}
