import type { ReactNode } from 'react'
import { NextGameStandingsScreen } from '@/pages/management/ui/NextGameStandingsScreen'
import { NariMatchInfoScreen } from '@/pages/management/ui/NariMatchInfoScreen'
import { EntryEditorScreen } from '@/widgets/entry-editor'
import { MatchInfoStadiumBackdrop } from '@/widgets/batting-stage/ui/MatchInfoStadiumBackdrop'
import { batterMatchInfoOf, cupMatchInfoOf } from '@/pages/management/lib/nariMatchPrepare'
import { NariScreenPush } from '@/pages/management/ui/NariScreenPush'
import { TEAMS } from '@/shared/config/original/teams'
import type { CareerScreenInput, ScreenOf } from '@/app/ui/careerRoutes/careerScreenInput'

export function nextGameStandingsScreenOf(input: CareerScreenInput, screen: ScreenOf<'다음경기순위'>): ReactNode {
  const { career, actions } = input
  return (
    <NextGameStandingsScreen
      league={career.league}
      edition="타자편"
      gamePoint={career.gamePoint}
      isFromManagement={screen.fromManagement}
      onConfirm={actions.confirmNextGameStandings}
      onCancel={actions.cancelNextGameStandings}
    />
  )
}

export function matchPrepareScreenOf(input: CareerScreenInput, screen: ScreenOf<'경기준비'>): ReactNode {
  const { session, career, actions, isMatchInfoEntryAnimated } = input
  // 142 ↔ 143 은 화면 밀기(효과기 종류 8, 0xbdae9(…, 8, 0, 3/4, 1000))로 바뀐다 (`NariScreenPush`)
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
  // 142 경기 준비 — 진입 0x1c46c · 키 0x13c30 · 그림 0x15d98
  // 국가대항전(135 에서 옴)이면 대회 표 · 마선수 "-" (1c5fe)
  const match = screen.cup === undefined ? batterMatchInfoOf(career, session.matchAces) : cupMatchInfoOf(career, screen.cup.matchup, screen.cup.cup)
  return (
    <NariScreenPush view={pushView}>
      <NariMatchInfoScreen
        lines={match.lines}
        myTeamId={match.myTeamId}
        opponentTeamId={match.opponentTeamId}
        playerSide={match.playerSide}
        edition="타자편"
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
