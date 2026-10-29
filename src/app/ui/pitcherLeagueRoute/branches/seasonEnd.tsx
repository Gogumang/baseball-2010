import type { ReactNode } from 'react'
import { NationalCupScreen } from '@/pages/national-cup/ui/NationalCupScreen'
import { PostseasonScreen } from '@/pages/season-end/ui/PostseasonScreen'
import { nationalCupStandingsTitleOf } from '@/entities/career/model/titles'
import type { PitcherBranchInput } from '@/app/ui/pitcherLeagueRoute/branchInput'

export function aceMatchBranch(input: PitcherBranchInput): ReactNode {
  const { session, renderAceMatch, scene, actions } = input
  if (scene !== '마선수대결' || session.aceMatch === null) return null
  return <>{renderAceMatch(session.aceMatch, actions.finishAceMatch)}</>
}

// 128 포스트시즌 대진 — 타자편과 같은 화면·같은 상태 함수(모드 갈림은 해금 id 하나, `postseasonFlow`)
export function postseasonBranch(input: PitcherBranchInput): ReactNode {
  const { session, career, scene, actions } = input
  if (scene !== '포스트시즌') return null
  return (
    <PostseasonScreen
      series={career.postseason}
      edition="투수편"
      gamePoint={career.gamePoint}
      popup={session.postseasonPopup}
      onConfirm={actions.pressPostseason}
      onClosePopup={actions.closePostseasonPopup}
    />
  )
}

// 국가대항전 134 대진 · 135 순위 — 타자편과 같은 상태·같은 화면 (모드 3·4 공용 0x19f30 · 0x19fdc · 0x10680)
export function nationalCupBranch(input: PitcherBranchInput): ReactNode {
  const { session, random, openedHiddenIds, career, scene, actions } = input
  if (scene !== '국가대항전' || session.cup === null) return null
  return (
    <NationalCupScreen
      mode="나만의리그"
      // 머리띠 0x169ea~0x16a00: 장면+0xcc(모드) == 4 ? 8 : 9 — 투수편(모드 3)은 제목 9 "나만의리그투수편"
      edition="투수편"
      cup={session.cup.cup}
      // 제 n 회 = (연차 idx >> 1) + 1 (0x85e6c) — 대회는 끝난 해의 연말이라 지금 시즌 − 1
      yearIndex={career.season - 1}
      gamePoint={career.gamePoint}
      random={random}
      onStartGame={actions.startCupGame}
      onFinish={actions.finishCup}
      // 142 취소로 돌아오면 135(순위표)부터
      initialStep={session.cup.atStandings ? '순위' : '대진'}
      // 134 진입 0x19f30 — 처음 열리는 히든 팀마다 StrCOMMON[138] 팝업 0x22 · 전역 해금. 전역 해금표(기록연감)까지 본다
      openedHiddenIds={[...career.openedHiddenIds, ...openedHiddenIds]}
      onOpenHiddenTeams={actions.openCupHiddenTeams}
      // 134 첫 틀 0x1b92c 머리 — 비트 8 이 없으면 칭호 8 "국가 대표" 팝업 0x78, 확인 0x1b1e4 가 주고 장착
      entryTitle={nationalCupStandingsTitleOf(career.titleIds)}
      onConfirmEntryTitle={actions.confirmCupTitle}
    />
  )
}
