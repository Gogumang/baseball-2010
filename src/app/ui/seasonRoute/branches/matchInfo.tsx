import type { ReactNode } from 'react'
import { NextGameScreen, SeasonMatchInfoScreen, seasonMatchInfoLines } from '@/pages/season'
import { EntryEditorScreen } from '@/widgets/entry-editor'
import { MatchInfoStadiumBackdrop } from '@/widgets/batting-stage/ui/MatchInfoStadiumBackdrop'
import { TEAMS } from '@/shared/config/original/teams'
import { MatchSettingsWindow } from '@/pages/match-settings'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import type { SeasonBranchInput } from '@/app/ui/seasonRoute/branchInput'

type PendingGame = NonNullable<SeasonBranchInput['session']['pendingGame']>

/** 경기정보 목록 k 4 의 줄 — 국가대항전이면 마선수 칸이 없다(−1) */
function matchInfoLinesOf({ state, session, league, series, cup }: SeasonBranchInput, { options, kind }: PendingGame) {
  const isCup = kind === '국가대항전'
  return seasonMatchInfoLines({
    league,
    series,
    cup,
    inPostseason: state.record.inPostseason,
    myTeamId: options.ourTeamId,
    opponentTeamId: options.opponentTeamId,
    dayCounter: options.dayCounter ?? 0,
    ...(options.opponentDayCounter === undefined ? {} : { opponentDayCounter: options.opponentDayCounter }),
    ...(options.opponentPitcherOrder === undefined ? {} : { opponentPitcherOrder: options.opponentPitcherOrder }),
    acePitcherId: isCup ? -1 : session.preGameAces.pitcher,
    aceBatterId: isCup ? -1 : session.preGameAces.batter,
    opponentAces: options.opponentAces ?? null,
    myStarterName: session.matchInfoStarterName,
    opponentStarterName: session.matchInfoOpponentStarterName,
  })
}

// 경기 직전 경기정보 0xdd — 목록 k 4 + 경기진행 설정 창 0x6042c (그림 0xb398)
export function matchInfoBranch(input: SeasonBranchInput): ReactNode {
  const { scene, session, actions, previousScene } = input
  if (scene !== SEASON_SCENE_STATE.경기정보 || session.pendingGame === null) return null
  const { options } = session.pendingGame
  return (
    <>
      <SeasonMatchInfoScreen
        lines={matchInfoLinesOf(input, session.pendingGame)}
        myTeamId={options.ourTeamId}
        opponentTeamId={options.opponentTeamId}
        playerSide={options.playerSide}
        gamePoint={session.gamePoints}
        // 0xdd 진입 0x6548 → 0x5fd04 가 떠 둔 구장 바탕 (공통 앞그림 0xb810 이 0xdd 면 0x581dc 로 찍는다)
        stage={session.matchInfoStage}
        // 그림 0xb398 의 0x63b15 넷째 인자 = 이전 상태 ≠ 0xe0(엔트리 편집) — 들어올 때 머리띠 · 배너 연출
        isEntryAnimated={previousScene !== SEASON_SCENE_STATE.엔트리편집}
        onStart={() => {
          // 설정 창이 열려 있으면 키가 모두 창으로 간다 (0x83f2 메뉴+0x2ba)
          if (!session.isMatchSettingsOpen) actions.startPendingGame()
        }}
        onOpenSettings={() => {
          if (!session.isMatchSettingsOpen) actions.toggleMatchSettings()
        }}
        onCancel={() => {
          if (!session.isMatchSettingsOpen) actions.cancelMatchInfo()
        }}
        onOpenEntry={(isUserTeam) => {
          if (!session.isMatchSettingsOpen) actions.openEntryEdit(isUserTeam)
        }}
        isSettingsOpen={session.isMatchSettingsOpen}
        // 설정 창 0x6042c 는 화면 판 안, 머리띠 앞에 그린다 (0xb398)
        settingsWindow={
          session.isMatchSettingsOpen && (
            <MatchSettingsWindow settings={session.matchSettings} onConfirm={actions.applyMatchSettings} onClose={actions.toggleMatchSettings} />
          )
        }
      />
    </>
  )
}

// 엔트리 편집 0xe0 — 엔트리 목록 창 0x5cfec + 머리띠 (그림 0xb074), 키 0x7044 → 편집기 0x55864
export function entryEditBranch({ scene, session, actions }: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.엔트리편집 || session.entryEdit === null) return null
  const { entryEdit } = session
  return (
    <EntryEditorScreen
      editor={entryEdit.editor}
      lists={entryEdit.lists}
      teamName={`${TEAMS[entryEdit.teamId]?.name ?? ''} ${entryEdit.isUserTeam ? '(PLAYER)' : '(COM)'}`}
      isAceLocked={entryEdit.isAceLocked}
      gamePoint={session.gamePoints}
      onKey={actions.pressEntryKey}
      onMoveCursor={actions.pointEntryCursor}
      onCloseAceLocked={actions.closeEntryAceLocked}
      // 공통 앞그림 0xb810 은 0xe0 에서도 0xdd 진입이 떠 둔 구장 바탕(0x581dc)을 깐다
      underlay={<MatchInfoStadiumBackdrop stage={session.matchInfoStage} />}
      // 그림 0xb074 는 공용 목록 0x63b14 를 안 불러 [skin+0x84] 를 세우지 않는다 — 머리띠는 다 내려온 자리
      slides={false}
    />
  )
}

export function nextGameBranch({ scene, session, actions, league }: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.다음경기) return null
  // 0xd8 — 리그 순위표 한 장 (그림 0xae24 → 0x7f070). 확인은 경기로, 취소는 관리 메뉴에서 왔을 때만
  return (
    <NextGameScreen
      league={league}
      onConfirm={actions.confirmNextGame}
      onCancel={actions.cancelNextGame}
      isFromManagement={session.isNextGameFromMenu}
      gamePoint={session.gamePoints}
    />
  )
}
