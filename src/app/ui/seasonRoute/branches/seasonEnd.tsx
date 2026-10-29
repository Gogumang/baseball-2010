import type { ReactNode } from 'react'
import { GameIncomeScreen, SeasonEndingScreen, SeasonChainFrameScreen, SeasonSummaryScreen, DayResultBoardScreen } from '@/pages/season'
import { RawScreen } from '@/shared/ui'
import { SEASON_YEAR_GOAL_LABEL_SET } from '@/pages/story/lib/yearGoalWindow'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { judgeSeasonEnding } from '@/entities/season-mode/model/seasonRewards'
import { NationalCupScreen } from '@/pages/national-cup/ui/NationalCupScreen'
import { seasonGoalWindowNumbersFor, seasonPostseasonRankOf } from '@/app/model/useSeasonSession'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import type { SeasonBranchInput } from '@/app/ui/seasonRoute/branchInput'

export function nationalCupBranch({ scene, state, session, actions, cup, random, hallOfFame }: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.국가대항전 || cup === null) return null
  return (
    <NationalCupScreen
      mode="시즌모드"
      cup={cup}
      yearIndex={state.record.yearIndex}
      gamePoint={session.gamePoints}
      random={random}
      // 대회 경기 — 세션이 대표팀 경기 옵션을 세워 팀 경기 화면으로 간다(사람이 조작한다, 시즌 221)
      onStartGame={(matchup) => actions.playCupGame(matchup.myTeam, matchup.opponent)}
      onFinish={(finish) => actions.finishCup(finish)}
      // 0xf3 갱신 0xe684 — 틀마다 0x65de5(전역, 0) 대한민국 · 우승국(SR+0x144)이 10 이면 결승 상대도 연다. 처음 열리면
      // 0x65de4 가 전역 +0x7a+k = 1 · 저장 · StrCOMMON[138] 팝업 0x22 (나리 134 진입 0x19f30 과 같은 함수)
      openedHiddenIds={[...(hallOfFame?.openedHiddenIds ?? []), ...session.openedHiddenIds]}
      onOpenHiddenTeams={actions.openCupHiddenTeams}
      // 공통 앞그림 0xb810 — 0xf3 · 0xf4 는 0xdd · 0xe0 · 0xe1 밖이라 공 무늬를 먼저 깐다(그림 0x896c 는 화면을 안 지운다)
      underlay={<SkinBackdrop kind="공무늬" />}
    />
  )
}

// ── 시즌 끝 사슬 (0xee → 0xeb → 0xec → 0xed → 0xf0 → 0xef) ──────────────────
// 그리기는 모두 0x9fe4 → 공통 틀 0x9f60(0xee 는 가운데 판 없음)이고, 진입 함수가 phase 를 세우고 이벤트
// (392 · 370 · 371 · 376 · 401~403)를 튼다. 세션이 들어온 틀에 곧장 0xd3 으로 넘기므로 한 틀만 그린다.
// 시상 내용은 이벤트의 system 3 · 4 창, 결과 이벤트는 세션의 실행기 끝 갈래(0x8b04c · 0x8b370)가 맡는다
const SEASON_END_CHAIN_SCENES: readonly number[] = [
  SEASON_SCENE_STATE.포스트시즌시작,
  SEASON_SCENE_STATE.정규시즌순위,
  SEASON_SCENE_STATE.타자시상,
  SEASON_SCENE_STATE.투수시상,
  SEASON_SCENE_STATE.최우수선수,
]

export function seasonEndChainBranch({ scene, state, session }: SeasonBranchInput): ReactNode {
  if (!SEASON_END_CHAIN_SCENES.includes(scene)) return null
  return (
    <SeasonChainFrameScreen
      state={state}
      gamePoint={session.gamePoints}
      cursor={session.menuCursors.management}
      showsCenterStage={scene !== SEASON_SCENE_STATE.포스트시즌시작}
    />
  )
}

export function seasonSummaryBranch({ scene, state, session, actions, league, series }: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.시즌결산) return null
  return (
    <SeasonSummaryScreen
      record={state.record}
      series={series}
      // 0x85ec 의 0xb7aa0(리그, 팀, 0) — 0 우승 · 1 준우승(한국시리즈에서 진 팀) · 그 밖은 보상 없음
      postseasonRank={seasonPostseasonRankOf(state.record, league, series)}
      leagueFirstAwardedBits={session.leagueFirstAwardedBits}
      entry={session.summaryEntry}
      onLeagueFirstAward={actions.awardLeagueFirst}
      onContinuePostseason={actions.continuePostseason}
      onFinish={actions.finishSeason}
      gamePoint={session.gamePoints}
    />
  )
}

export function endingBranch({ scene, state, actions, setEndingFadeIn }: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.엔딩) return null
  return (
    <SeasonEndingScreen
      // 엔딩 번호는 레코드에서 다시 판정한다 (0xa3084). 여기 올 때 레코드가 그대로라 값이 같다.
      // 판정값 e 의 `전역기록+0xa0+e = 1`(0x6e0c 6e22~6e38)은 앱이 이 레코드로 기록연감 엔딩 칸에 켜 저장한다(App → useCollection).
      // 손댄 세이브 등으로 10년차가 아닌 채 phase 6 이면 0(비 인기 구단)으로 둔다
      endingIndex={judgeSeasonEnding(state.record) ?? 0}
      // SR+0x7b — 판정 0 은 진입 0x6be8 이, 그 밖은 보너스 팝업 0x2b 닫힘(0x8bd8)이 세운다. 서 있으면 키 0x6b3c 가 팝업 없이 넘긴다
      isBonusReceived={state.record.endingBonusReceived}
      onBonusReceived={actions.receiveEndingBonus}
      // 키 0x6b3c → 단계 1 → 전환이 끝나면 0x8bd8 8ccc~8d2c: SR+0x1bc = 1 · 저장 · **관리 메뉴 0xc9**(메인 메뉴가 아니다)
      onFinish={() => {
        actions.finishEnding()
        setEndingFadeIn(true)
      }}
    />
  )
}

// 경기 뒤 마무리 0xf1 — 같은 날 다른 네 경기 결과판 (그림 0xb400, SR+0x1c0). 확인 키 0x49a4
export function dayResultBranch({ scene, state, session, actions }: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.경기뒤마무리) return null
  return <DayResultBoardScreen board={state.record.dayBoard} onConfirm={actions.confirmDayResults} gamePoint={session.gamePoints} />
}

export function incomeBranch({ scene, state, session, actions, goalSource }: SeasonBranchInput): ReactNode {
  if (scene !== SEASON_SCENE_STATE.관중수입) return null
  // 0xe9 는 그리기가 없다 — 진입 틀에 이벤트를 쌓기 전 한 틀은 빈 화면
  if (session.incomeEvaluation === null) return <RawScreen>{null}</RawScreen>
  return (
    <GameIncomeScreen
      record={state.record}
      teamMorale={state.teamMorale}
      gamePoint={session.gamePoints}
      line={session.incomeEvaluation.line}
      storeExpired={session.incomeEvaluation.storeExpired}
      goals={{ labelSet: SEASON_YEAR_GOAL_LABEL_SET, ...seasonGoalWindowNumbersFor(goalSource) }}
      // 0xd3 이 끝나면 0xdea0 이 걸어 둔 다음 상태로 — 구내매점은 0xe9 진입이 이미 줄였다
      onDone={() => actions.confirmIncome(state.record)}
    />
  )
}
