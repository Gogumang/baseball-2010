import type { ReactNode } from 'react'
import { NextGameStandingsScreen } from '@/pages/management/ui/NextGameStandingsScreen'
import { NariMatchInfoScreen } from '@/pages/management/ui/NariMatchInfoScreen'
import { EntryEditorScreen } from '@/widgets/entry-editor'
import { MatchInfoStadiumBackdrop } from '@/widgets/batting-stage/ui/MatchInfoStadiumBackdrop'
import { pitcherCupMatchInfoOf, pitcherMatchInfoOf } from '@/pages/pitcher-league/lib/pitcherMatchInfo'
import { NariScreenPush } from '@/pages/management/ui/NariScreenPush'
import { TEAMS } from '@/shared/config/original/teams'
import type { PitcherBranchInput } from '@/app/ui/pitcherLeagueRoute/branchInput'

export function nextGameStandingsBranch(input: PitcherBranchInput): ReactNode {
  const { session, career, scene, actions } = input
  if (scene !== '다음경기순위') return null
  return (
    <NextGameStandingsScreen
      league={career.league}
      edition="투수편"
      gamePoint={career.gamePoint}
      isFromManagement={session.nextGameFromManagement}
      onConfirm={actions.confirmNextGameStandings}
      onCancel={actions.cancelNextGameStandings}
    />
  )
}

export function matchPrepareBranch(input: PitcherBranchInput): ReactNode {
  const { session, career, scene, actions, isMatchInfoEntryAnimated } = input
  if (scene !== '경기준비') return null
  // 142 ↔ 143 은 화면 밀기(효과기 종류 8, 0xbdae9(…, 8, 0, 3/4, 1000))로 바뀐다 (`NariScreenPush` — 타자편과 같다)
  const entryView = session.entryView
  const pushView = entryView === null ? '142' : entryView.isMyTeam ? '143:내팀' : '143:상대'
  // 143 경기 전 엔트리 보기 — 진입 0x16af8 · 키 0x1457c · 그림 0x16738 (보기 전용, 끝 코드로 142 로 돌아간다)
  if (entryView !== null) {
    return (
      <NariScreenPush view={pushView}>
        <EntryEditorScreen
          editor={entryView.editor}
          lists={entryView.lists}
          teamName={TEAMS[entryView.teamId]?.name ?? ''}
          isAceLocked={false}
          gamePoint={career.gamePoint}
          onKey={actions.pressEntryViewKey}
          onMoveCursor={actions.pointEntryViewCursor}
          onCloseAceLocked={() => {}}
          // 나리 틀 0x16928 은 142~144 면 142 진입이 떠 둔 구장 바탕(0x581dc)을 깐다
          underlay={<MatchInfoStadiumBackdrop stage={session.matchInfoStage} />}
          slides={false}
        />
      </NariScreenPush>
    )
  }
  // 142 경기 준비 — 진입 0x1c46c · 키 0x13c30 · 그림 0x15d98 (타자편과 같은 상태)
  // 국가대항전(135 에서 옴)이면 대회 표 · 마선수 "-" (1c5fe)
  const match =
    session.cupMatch === null
      ? pitcherMatchInfoOf(career, session.matchAces)
      : pitcherCupMatchInfoOf(career, session.cupMatch.matchup, session.cupMatch.cup)
  return (
    <NariScreenPush view={pushView}>
      <NariMatchInfoScreen
        lines={match.lines}
        myTeamId={match.myTeamId}
        opponentTeamId={match.opponentTeamId}
        playerSide={match.playerSide}
        edition="투수편"
        gamePoint={career.gamePoint}
        stage={session.matchInfoStage}
        onStart={actions.confirmMatchPrepare}
        onCancel={actions.cancelMatchPrepare}
        onEntry={actions.openEntryView}
        isEntryAnimated={isMatchInfoEntryAnimated}
      />
    </NariScreenPush>
  )
}
